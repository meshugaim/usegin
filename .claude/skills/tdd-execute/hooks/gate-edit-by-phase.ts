#!/usr/bin/env bun
/**
 * tdd-execute Edit-gating hook (ENG-5370).
 *
 * Skill-scoped PreToolUse hook that enforces TDD phase discipline by
 * blocking phase-illegal edits — including from the Director itself.
 *
 * Spec: docs/research/tdd-skills/99-design-memo.md §4c "Hook contract" + §6
 *       docs/research/tdd-skills/07-enforcement-mechanisms.md §1.2, §7
 *
 * Matchers (declared in tdd-execute's SKILL.md frontmatter — separate worker):
 *   PreToolUse:
 *     - matcher: "Write|Edit|MultiEdit"
 *     - matcher: "Bash"
 *
 * Workspace discovery:
 *   1. TDD_WORKSPACE env var (wins if set), points at the dir containing state.json.
 *   2. Otherwise, climb from tool_input.file_path looking for
 *      `.tdd-execute/<slice-id>/state.json` (memo §4c).
 *   3. If neither yields a workspace, exit 0 (allow — the file is outside any
 *      tdd-execute slice).
 *
 * Decision rules (memo §4c "Hook contract"):
 *   phase=red       → file_path must match isTestPath(); else deny.
 *   phase=green     → file_path must NOT match isTestPath(); else deny.
 *   phase=refactor  → require last_test_run with failed==0 AND fresh
 *                     (within 5 min OR no source-edit events since the run).
 *   phase=complete  → deny all edits.
 *
 * Output channel: Channel B — JSON to stdout with permissionDecision (matches
 * the prior art at tools/worker-reviewer-experiment/hooks/validate-submission.ts).
 *
 * Robustness: malformed input → exit 0 (allow). The hook is best-effort; we'd
 * rather miss an edge case than block legit work because of a parse error.
 */

import {
  readState,
  StateSchema,
  isTestPath,
  readEvents,
  type State,
  type Phase,
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
} from "../../../../tools/tdd-shared/src/index";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { dirname, join } from "path";

// ---- Hook input shape ---------------------------------------------------

interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    [k: string]: unknown;
  };
  session_id?: string;
}

// ---- Output helpers -----------------------------------------------------

function emitDeny(reason: string): never {
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny" as const,
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

function allow(): never {
  process.exit(0);
}

// ---- Bash redirect parsing ---------------------------------------------
//
// The Bash matcher is a sibling to the Edit matcher (memo §4c). We need to
// catch the heredoc-bypass class — `cat > foo.ts <<EOF` — without false-
// positiving on every Bash command. Strategy: scan the command for shell
// redirection targets and pick the first one that looks like a source path
// (i.e. anything not /dev/null or a /tmp scratch path).
//
// Limitation (documented per the spec brief): this naive regex won't catch
// every exotic shell construct (subshells, dynamic redirections, eval'd
// strings). It covers `> file`, `>> file`, `tee file`, `tee -a file`, and
// `cat > file <<EOF`. That's the empirically-attested bypass surface.

const REDIRECT_PATTERNS: RegExp[] = [
  // `> path`, `>> path` — append, truncate
  /(?:^|[^>&\d])>>?\s*([^\s|;&<>()]+)/g,
  // `tee path`, `tee -a path`, `tee --append path`
  /\btee\b(?:\s+-{1,2}\w+)*\s+([^\s|;&<>()]+)/g,
  // `cat > path <<EOF` — heredoc into file (also caught by the first
  // pattern, but listed for documentation)
];

function extractRedirectTargets(command: string): string[] {
  const out: string[] = [];
  for (const re of REDIRECT_PATTERNS) {
    re.lastIndex = 0;
    for (const m of command.matchAll(re)) {
      const target = m[1];
      if (!target) continue;
      // Skip /dev/* sinks — they're never source files.
      if (target.startsWith("/dev/")) continue;
      out.push(target);
    }
  }
  return out;
}

// ---- Workspace discovery ------------------------------------------------
//
// We need the workspace *directory* (containing state.json), not the
// state.json path itself. The tdd-shared `climbToWorkspace` returns the
// state.json path; we climb manually so we can tolerate either layout
// (`.tdd-execute/<slice-id>/state.json` or — for tests / TDD_WORKSPACE —
// a flat directory containing state.json directly).

const MAX_CLIMB = 12;

function findWorkspaceDir(filePath: string): string | null {
  if (process.env.TDD_WORKSPACE) {
    const ws = process.env.TDD_WORKSPACE;
    if (existsSync(join(ws, "state.json"))) return ws;
    return null;
  }

  let dir: string;
  try {
    const st = statSync(filePath);
    dir = st.isDirectory() ? filePath : dirname(filePath);
  } catch {
    dir = dirname(filePath);
  }

  for (let i = 0; i < MAX_CLIMB; i++) {
    // Layout 1: .tdd-execute/<slice-id>/state.json under this dir.
    const tddDir = join(dir, ".tdd-execute");
    if (existsSync(tddDir)) {
      try {
        if (statSync(tddDir).isDirectory()) {
          for (const entry of readdirSync(tddDir)) {
            const candidate = join(tddDir, entry);
            if (existsSync(join(candidate, "state.json"))) {
              return candidate;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    // Layout 2: state.json directly in dir (used by TDD_WORKSPACE and tests).
    if (existsSync(join(dir, "state.json"))) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---- Refactor freshness check ------------------------------------------
//
// Refactor lets you edit anything iff the suite is green AND that knowledge
// is "fresh." Fresh = (test run ts within 5 min) OR (no source-edit events
// recorded since the test run).
//
// "source-edit events" are events.jsonl entries whose kind looks like an
// edit signal. The Director records `edit-applied` (or similar) per the
// memo's events vocabulary; we accept any kind containing "edit" or
// "write" as a conservative match. If the Director hasn't logged any such
// events the freshness check falls through to the time window only.

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function isRefactorFresh(state: State, workspaceDir: string): boolean {
  const ltr = state.last_test_run;
  if (!ltr) return false;
  if (ltr.failed !== 0) return false;

  const runTs = Date.parse(ltr.ts);
  if (Number.isNaN(runTs)) return false;

  // Window check
  if (Date.now() - runTs < FIVE_MINUTES_MS) return true;

  // Stale-by-time, but allow if no edit events have happened since.
  let events: ReturnType<typeof readEvents>;
  try {
    events = readEvents(workspaceDir);
  } catch {
    return false;
  }
  for (const ev of events) {
    const evTs = Date.parse(ev.ts);
    if (Number.isNaN(evTs)) continue;
    if (evTs <= runTs) continue;
    const kind = String(ev.kind || "").toLowerCase();
    if (kind.includes("edit") || kind.includes("write") || kind.includes("apply")) {
      return false;
    }
  }
  return true;
}

// ---- Phase decision -----------------------------------------------------

function decide(
  phase: Phase,
  filePath: string,
  state: State,
  workspaceDir: string,
): { allow: true } | { allow: false; reason: string } {
  switch (phase) {
    case "red":
      if (!isTestPath(filePath)) {
        return {
          allow: false,
          reason:
            `TDD: in RED phase. Only test-file edits allowed. ` +
            `Spawn the red-tweaker via Task; do not edit directly. ` +
            `Production-path edit attempted: ${filePath}`,
        };
      }
      return { allow: true };

    case "green":
      if (isTestPath(filePath)) {
        return {
          allow: false,
          reason:
            `TDD: in GREEN phase. Test files are locked while you make the failing test pass. ` +
            `Edit production code only. Test-path edit attempted: ${filePath}`,
        };
      }
      return { allow: true };

    case "refactor":
      if (!isRefactorFresh(state, workspaceDir)) {
        return {
          allow: false,
          reason:
            `TDD: in REFACTOR phase, but tests aren't green-and-fresh. ` +
            `Re-run the suite (bun test / uv run pytest) before editing.`,
        };
      }
      return { allow: true };

    case "complete":
      return {
        allow: false,
        reason:
          `TDD: slice complete. No further edits in this workspace. ` +
          `Start a new slice or close out.`,
      };
  }
}

// ---- Main ---------------------------------------------------------------

async function main(): Promise<void> {
  // Read stdin. If anything goes wrong, allow (best-effort hook).
  let raw: string;
  try {
    raw = await Bun.stdin.text();
  } catch {
    allow();
  }

  let input: HookInput;
  try {
    input = JSON.parse(raw!) as HookInput;
  } catch {
    allow();
  }

  const toolName = input!.tool_name;
  const toolInput = input!.tool_input || {};

  // Determine the file path under contention.
  let filePath: string | undefined;
  if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
    filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : undefined;
  } else if (toolName === "Bash") {
    const cmd = typeof toolInput.command === "string" ? toolInput.command : "";
    if (!cmd) allow();
    const targets = extractRedirectTargets(cmd);
    if (targets.length === 0) allow(); // No file write — Bash is fine.
    filePath = targets[0]; // First match wins per the spec.
  } else {
    allow();
  }

  if (!filePath) allow();

  // Workspace discovery.
  const workspaceDir = findWorkspaceDir(filePath!);
  if (!workspaceDir) allow();

  // Read & validate state.
  let state: State;
  try {
    state = readState(workspaceDir!);
  } catch {
    // Either missing (shouldn't happen — climb said it exists) or schema-invalid.
    // Surface the schema problem so the human fixes it rather than silently
    // letting edits through under a broken state.
    const stateRawPath = join(workspaceDir!, "state.json");
    let detail = "";
    try {
      const raw = JSON.parse(readFileSync(stateRawPath, "utf-8"));
      const r = StateSchema.safeParse(raw);
      if (!r.ok) {
        detail = "\n" + r.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n");
      }
    } catch {
      // unreadable — leave detail blank
    }
    emitDeny(`tdd-execute state.json invalid — fix before continuing.${detail}`);
  }

  const verdict = decide(state!.phase, filePath!, state!, workspaceDir!);
  if (verdict.allow) allow();
  emitDeny(verdict.reason);
}

main().catch(() => {
  // Best-effort: never crash the user's tool call because of a hook bug.
  process.exit(0);
});
