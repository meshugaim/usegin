#!/usr/bin/env bun
/**
 * tdd-execute Edit-gating hook (ENG-5370).
 *
 * Skill-scoped PreToolUse hook that enforces TDD phase discipline by
 * blocking phase-illegal edits — including from the Director itself.
 *
 * Spec: docs/research/tdd-skills/99-design-memo.md §4c "Hook contract" + §6
 *       docs/research/tdd-skills/07-enforcement-mechanisms.md §1.2, §7
 *       docs/research/tdd-skills/dry-runs/01-paper-review.md §4 (F-HOOK-*, F-DOC-5)
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
 * Decision rules (memo §4c "Hook contract", extended per dry-run §4):
 *   phase=pre-red       → production-path edits allowed only when file_path
 *                         matches state.pre_red.allowed_paths[]; test-path
 *                         edits always allowed. (F-HOOK-2)
 *   phase=red           → file_path must match isTestPath(); else deny.
 *   phase=green         → file_path must NOT match isTestPath(); else deny.
 *   phase=refactor      → require last_test_run with failed==0 AND fresh
 *                         (within 5 min OR no source-edit events since the run).
 *                         (F-HOOK-3, F-HOOK-5)
 *   phase=mutation-pass → production-path edits allowed only when file_path
 *                         matches state.mutation_pass.allowed_paths[];
 *                         test-path edits denied (mutation-pass touches
 *                         production code only). (F-HOOK-2 / F-MUT-2)
 *   phase=complete      → deny all edits.
 *
 * Bash gating (F-HOOK-1, F-HOOK-4, F-DOC-5):
 *   The hook also intercepts Bash commands with source-mutating effects:
 *     - shell redirects (>, >>, tee)
 *     - git checkout/restore against pathspecs
 *     - git stash push/pop
 *     - mv / cp / rm with file targets
 *     - sed -i with file target
 *     - python -c / node -e that write to files
 *   For each, the EFFECT path is parsed and run through the same phase rule.
 *
 *   Verifier carve-out (F-HOOK-1): the verifier sub-agent (spawned by the
 *   Director with TDD_VERIFIER=1) needs `git checkout HEAD -- <prod-file>`
 *   and `git stash push/pop` to perform the revert/restore proof during
 *   green. When that env var is set, those specific commands are allowed
 *   regardless of phase. Other source-mutating commands are still gated.
 *
 *   Early-exit (F-DOC-5): Bash commands with no source-mutating shape
 *   short-circuit immediately (no workspace climb), so `bun install`,
 *   `bun test`, `git status`, `git log`, etc. don't pay the discovery cost.
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
import { dirname, join, resolve, isAbsolute } from "path";

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

// ---- Path normalization (F-HOOK-4) -------------------------------------
//
// Bash captures of redirect/effect paths can come in many shapes:
//   > "src/foo.ts"      (quoted)
//   > ./src/foo.ts      (./-relative)
//   > $(echo foo).ts    (command substitution — opaque)
//   > `cmd`.ts          (backtick — opaque)
//
// Strategy: strip surrounding quotes, drop "./" prefix, and resolve to an
// absolute path against the hook's cwd so isTestPath/match logic sees a
// consistent shape. If the captured target contains an unresolved $(...)
// or backticked region we treat it as opaque and return null (allow).

function normalizeCapturedPath(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Strip matching surrounding quotes (single or double).
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
    if (!s) return null;
  }
  // Opaque shell substitutions — allow rather than guess.
  if (s.includes("$(") || s.includes("`")) return null;
  if (s.startsWith("./")) s = s.slice(2);
  if (s.startsWith("/dev/")) return null;
  // Resolve to absolute against cwd so callers' `path.includes(absolute)`
  // tests behave uniformly. Already-absolute paths pass through.
  return isAbsolute(s) ? s : resolve(process.cwd(), s);
}

// ---- Bash short-circuit (F-DOC-5) --------------------------------------
//
// Cheap pre-filter: if the Bash command contains *none* of these tokens,
// it cannot mutate source files in any way the hook understands, so we
// skip workspace discovery entirely. Keep the list tight — false negatives
// are denials we miss, false positives only add a discovery hop.

const BASH_MUTATION_TOKENS = [
  ">",          // redirect (also catches >>)
  "tee",        // tee target
  "cat",        // `cat > file <<EOF` heredoc
  "mv",
  "cp",
  "rm",
  "sed",
  "git checkout",
  "git restore",
  "git stash",
  "python -c",
  "node -e",
];

function bashCommandCouldMutate(command: string): boolean {
  for (const tok of BASH_MUTATION_TOKENS) {
    if (command.includes(tok)) return true;
  }
  return false;
}

// ---- Bash effect-path classifier (F-HOOK-1, F-HOOK-4) ------------------
//
// Returns the list of source paths the command will mutate, or null if
// none / opaque. We keep the parsing pragmatic — every classifier here is
// a *known bypass surface*, not a general shell parser. Unknown commands
// fall through to the redirect scan.
//
// Each classifier returns a flat list of normalized absolute paths, plus a
// tag describing which command shape was matched (used in deny reasons).

interface CommandEffect {
  paths: string[];
  shape: string;
}

// `git checkout [HEAD|HEAD~N|<sha>] -- <pathspec>...`
const GIT_CHECKOUT_RE = /\bgit\s+checkout\s+(?:--\s+|[\w~^.@/-]+\s+--\s+)([^\n;|&]+)/g;
// `git restore [--source <ref>] [--staged] -- <pathspec>...`
//  Also matches `git restore <pathspec>` without the `--` separator.
const GIT_RESTORE_RE = /\bgit\s+restore\s+(?:(?:--[\w-]+(?:[= ][^\s|;&]+)?\s+)*)(?:--\s+)?([^\n;|&]+)/g;
// `git stash push [-- <pathspec>...]` — the stash itself can contain mutating
// content via `git stash pop` (no pathspec to parse, but it's an effect).
const GIT_STASH_RE = /\bgit\s+stash\s+(push|pop|apply)(?:\s+([^\n;|&]+))?/g;
// `mv SRC DEST` / `cp SRC DEST` — DEST is the effect path.
const MV_CP_RE = /\b(mv|cp)\b(?:\s+-[a-zA-Z]+)*\s+([^\s|;&<>()]+)\s+([^\s|;&<>()]+)/g;
// `rm [-flags] <path>...` — every non-flag arg is an effect path.
const RM_RE = /\brm\b((?:\s+-[a-zA-Z]+)*)\s+([^\n;|&]+)/g;
// `sed -i ... <path>` — capture the trailing file argument(s).
const SED_INPLACE_RE = /\bsed\s+-i(?:[a-zA-Z]*)?\b(?:\s+-e\s+\S+|\s+'[^']*'|\s+"[^"]*"|\s+\S+)*\s+([^\n;|&]+)/g;
// `python -c "..."` / `node -e "..."` — opaque, but if it contains
// `open(...).write` or `writeFileSync`/`writeFile(` we treat as mutating
// without trying to extract the target. The conservative call is to deny
// such commands during phase-restrictive states (return a sentinel path).
const PY_NODE_INLINE_RE = /\b(python|python3)\s+-c\s+|node\s+-e\s+/;

function splitArgs(s: string): string[] {
  // Tiny tokenizer: splits on whitespace, respects matching quotes. Good
  // enough for pathspec lists; not a full shell parser.
  const out: string[] = [];
  let buf = "";
  let quote: string | null = null;
  for (const ch of s.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function extractCommandEffects(command: string): CommandEffect[] {
  const effects: CommandEffect[] = [];

  // 1. Shell redirects (>, >>, tee). The legacy heredoc-bypass surface.
  const REDIRECT_PATTERNS: { re: RegExp; shape: string }[] = [
    { re: /(?:^|[^>&\d])>>?\s*("[^"]+"|'[^']+'|[^\s|;&<>()]+)/g, shape: "redirect" },
    { re: /\btee\b(?:\s+-{1,2}\w+)*\s+("[^"]+"|'[^']+'|[^\s|;&<>()]+)/g, shape: "tee" },
  ];
  for (const { re, shape } of REDIRECT_PATTERNS) {
    re.lastIndex = 0;
    for (const m of command.matchAll(re)) {
      const norm = normalizeCapturedPath(m[1] ?? "");
      if (norm) effects.push({ paths: [norm], shape });
    }
  }

  // 2. git checkout -- <pathspec>
  GIT_CHECKOUT_RE.lastIndex = 0;
  for (const m of command.matchAll(GIT_CHECKOUT_RE)) {
    const args = splitArgs(m[1] ?? "");
    const paths: string[] = [];
    for (const a of args) {
      const norm = normalizeCapturedPath(a);
      if (norm) paths.push(norm);
    }
    if (paths.length) effects.push({ paths, shape: "git checkout" });
  }

  // 3. git restore [--] <pathspec>
  GIT_RESTORE_RE.lastIndex = 0;
  for (const m of command.matchAll(GIT_RESTORE_RE)) {
    const args = splitArgs(m[1] ?? "");
    const paths: string[] = [];
    for (const a of args) {
      if (a.startsWith("-")) continue;
      const norm = normalizeCapturedPath(a);
      if (norm) paths.push(norm);
    }
    if (paths.length) effects.push({ paths, shape: "git restore" });
  }

  // 4. git stash {push|pop|apply}
  GIT_STASH_RE.lastIndex = 0;
  for (const m of command.matchAll(GIT_STASH_RE)) {
    const sub = m[1];
    // For pop/apply we don't know which paths land — treat as "opaque
    // mutating" by tagging with shape only and an empty path list. Phase
    // gates decide based on shape (verifier carve-out applies).
    effects.push({ paths: [], shape: `git stash ${sub}` });
  }

  // 5. mv / cp — DEST path is what gets created/overwritten.
  MV_CP_RE.lastIndex = 0;
  for (const m of command.matchAll(MV_CP_RE)) {
    const dest = normalizeCapturedPath(m[3] ?? "");
    if (dest) effects.push({ paths: [dest], shape: m[1]! });
  }

  // 6. rm — every non-flag arg.
  RM_RE.lastIndex = 0;
  for (const m of command.matchAll(RM_RE)) {
    const args = splitArgs(m[2] ?? "");
    const paths: string[] = [];
    for (const a of args) {
      if (a.startsWith("-")) continue;
      const norm = normalizeCapturedPath(a);
      if (norm) paths.push(norm);
    }
    if (paths.length) effects.push({ paths, shape: "rm" });
  }

  // 7. sed -i — trailing file arg(s).
  SED_INPLACE_RE.lastIndex = 0;
  for (const m of command.matchAll(SED_INPLACE_RE)) {
    const args = splitArgs(m[1] ?? "");
    const paths: string[] = [];
    for (const a of args) {
      if (a.startsWith("-")) continue;
      // Heuristic: skip the script arg (looks like a sed expression).
      if (/^['"]?s\//.test(a)) continue;
      const norm = normalizeCapturedPath(a);
      if (norm) paths.push(norm);
    }
    if (paths.length) effects.push({ paths, shape: "sed -i" });
  }

  // 8. python -c / node -e — opaque mutation if it mentions write APIs.
  if (
    PY_NODE_INLINE_RE.test(command) &&
    (/\bopen\s*\([^)]*\)\s*\.\s*write\b/.test(command) ||
      /\bwriteFileSync\b|\bwriteFile\b|\bappendFileSync\b/.test(command))
  ) {
    effects.push({ paths: [], shape: "inline interpreter write" });
  }

  return effects;
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

// ---- Refactor freshness check (F-HOOK-3, F-HOOK-5) ---------------------
//
// Refactor lets you edit anything iff the suite is green AND that knowledge
// is "fresh." Fresh = (test run ts within window) AND (no canonical
// `kind: edit-applied` events have been logged since the run).
//
// Per F-HOOK-3 the Director is responsible for appending `kind: edit-applied`
// after every successful tweaker submit. We treat that kind as canonical
// and also accept legacy event shapes (kind containing edit/write/apply)
// for back-compat.
//
// Per F-HOOK-5 the window is configurable via state.refactor_freshness_window_ms
// (default 5 min). Stale-by-N-seconds is surfaced in the deny reason.

const DEFAULT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

interface FreshnessVerdict {
  fresh: boolean;
  /** ms by which the suite is past its freshness window (0 if fresh). */
  staleByMs: number;
  /** Reason fragment for the deny message. */
  detail: string;
}

function checkRefactorFreshness(state: State, workspaceDir: string): FreshnessVerdict {
  const ltr = state.last_test_run;
  if (!ltr) {
    return { fresh: false, staleByMs: 0, detail: "no last_test_run on record" };
  }
  if (ltr.failed !== 0) {
    return {
      fresh: false,
      staleByMs: 0,
      detail: `last_test_run had ${ltr.failed} failure(s)`,
    };
  }

  const runTs = Date.parse(ltr.ts);
  if (Number.isNaN(runTs)) {
    return { fresh: false, staleByMs: 0, detail: "last_test_run.ts unparseable" };
  }

  const window = state.refactor_freshness_window_ms ?? DEFAULT_FRESHNESS_WINDOW_MS;
  const age = Date.now() - runTs;

  // Canonical edit-applied scan first (F-HOOK-3): even if we're inside the
  // window, any edit logged since the run invalidates freshness.
  let events: ReturnType<typeof readEvents>;
  try {
    events = readEvents(workspaceDir);
  } catch {
    events = [];
  }
  for (const ev of events) {
    const evTs = Date.parse(ev.ts);
    if (Number.isNaN(evTs)) continue;
    if (evTs <= runTs) continue;
    const kind = String(ev.kind || "").toLowerCase();
    // Canonical: kind: edit-applied. Back-compat: anything containing
    // edit/write/apply.
    if (
      kind === "edit-applied" ||
      kind.includes("edit") ||
      kind.includes("write") ||
      kind.includes("apply")
    ) {
      return {
        fresh: false,
        staleByMs: age,
        detail: `edit-applied event at ${ev.ts} invalidates freshness`,
      };
    }
  }

  if (age < window) {
    return { fresh: true, staleByMs: 0, detail: "fresh" };
  }
  return {
    fresh: false,
    staleByMs: age - window,
    detail: `stale by ${Math.round((age - window) / 1000)}s (window=${Math.round(window / 1000)}s)`,
  };
}

// ---- Allowlist matching (F-HOOK-2) -------------------------------------
//
// pre-red and mutation-pass each carry an allowed_paths[] gate. We accept
// equality, suffix, and prefix-of-suffix matches because state.json may
// store either workspace-relative or repo-relative paths and the hook is
// invoked with absolute paths. Conservative: a file_path matches if any
// allowed path is found as a substring (with leading "/" alignment).

function matchesAllowedPath(filePath: string, allowed: string[]): boolean {
  const norm = filePath.replace(/\\/g, "/");
  for (const a of allowed) {
    const ax = a.replace(/\\/g, "/");
    if (norm === ax) return true;
    if (norm.endsWith("/" + ax)) return true;
    if (norm.endsWith(ax) && !ax.startsWith("/")) return true;
    if (ax.endsWith("/" + norm)) return true;
  }
  return false;
}

// ---- Verifier carve-out (F-HOOK-1) -------------------------------------
//
// The verifier sub-agent (Director-spawned with TDD_VERIFIER=1) needs to
// run `git checkout HEAD -- <prod-file>` and `git stash push/pop` during
// green to prove the suite breaks/heals as expected. Those specific Bash
// shapes — and only those — are allowed when the env var is set, regardless
// of phase. Other source-mutating Bash (e.g. raw heredoc into a prod file)
// is still gated.

const VERIFIER_ALLOWED_SHAPES = new Set([
  "git checkout",
  "git stash push",
  "git stash pop",
  "git stash apply",
]);

function isVerifierExempt(shape: string): boolean {
  if (process.env.TDD_VERIFIER !== "1") return false;
  return VERIFIER_ALLOWED_SHAPES.has(shape);
}

// ---- Phase decision -----------------------------------------------------

function decideForPath(
  phase: Phase,
  filePath: string,
  state: State,
  workspaceDir: string,
): { allow: true } | { allow: false; reason: string } {
  switch (phase) {
    case "pre-red": {
      // Test-path edits flow through unchanged (red is implicit during
      // pre-red — the outer test gets written here too in some plans).
      if (isTestPath(filePath)) return { allow: true };
      const allowed = state.pre_red?.allowed_paths ?? [];
      if (allowed.length === 0) {
        return {
          allow: false,
          reason:
            `TDD: in PRE-RED phase, but state.json has no pre_red.allowed_paths[]. ` +
            `Walking-skeleton scaffolding must enumerate its target files first. ` +
            `Production-path edit attempted: ${filePath}`,
        };
      }
      if (!matchesAllowedPath(filePath, allowed)) {
        return {
          allow: false,
          reason:
            `TDD: in PRE-RED phase. Edit not in pre_red.allowed_paths[]: ${filePath}. ` +
            `Allowed: ${allowed.join(", ")}`,
        };
      }
      return { allow: true };
    }

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

    case "refactor": {
      const f = checkRefactorFreshness(state, workspaceDir);
      if (!f.fresh) {
        return {
          allow: false,
          reason:
            `TDD: in REFACTOR phase, but tests aren't green-and-fresh — ${f.detail}. ` +
            `Re-run the suite (bun test / uv run pytest) before editing.`,
        };
      }
      return { allow: true };
    }

    case "mutation-pass": {
      if (isTestPath(filePath)) {
        return {
          allow: false,
          reason:
            `TDD: in MUTATION-PASS phase. Tests are locked; only production ` +
            `files named in mutation_pass.allowed_paths[] may be edited. ` +
            `Test-path edit attempted: ${filePath}`,
        };
      }
      const allowed = state.mutation_pass?.allowed_paths ?? [];
      if (allowed.length === 0) {
        return {
          allow: false,
          reason:
            `TDD: in MUTATION-PASS phase, but state.json has no mutation_pass.allowed_paths[]. ` +
            `Director must populate it from mutations[*].target_file before applying.`,
        };
      }
      if (!matchesAllowedPath(filePath, allowed)) {
        return {
          allow: false,
          reason:
            `TDD: in MUTATION-PASS phase. Edit not in mutation_pass.allowed_paths[]: ${filePath}. ` +
            `Allowed: ${allowed.join(", ")}`,
        };
      }
      return { allow: true };
    }

    case "complete":
      return {
        allow: false,
        reason:
          `TDD: slice complete. No further edits in this workspace. ` +
          `Start a new slice or close out.`,
      };
  }
}

// ---- Bash decision wrapper ---------------------------------------------
//
// For Bash we may have multiple effect entries (one command can both
// `cat > foo.ts` and `git checkout HEAD -- bar.ts`). We deny on the first
// phase-illegal effect. Verifier-exempt shapes are skipped.
//
// Effects with empty paths (git stash pop, opaque inline interpreter writes)
// can't be path-gated. Decision: outside the verifier carve-out, deny them
// in phase-restrictive states (anything other than refactor-fresh, green
// for production-side mutations, etc.). To stay conservative *and* avoid
// nuisance denies, we punt: they're allowed unless TDD_VERIFIER is unset
// AND phase ∈ {complete}. (red/green/pre-red/mutation-pass without a path
// can't be classified, so we err toward allow — the hook's other matchers
// catch the actual file write if it occurs via Edit/Write.)

function decideForBashEffects(
  effects: CommandEffect[],
  phase: Phase,
  state: State,
  workspaceDir: string,
): { allow: true } | { allow: false; reason: string } {
  for (const eff of effects) {
    if (isVerifierExempt(eff.shape)) continue;

    if (eff.paths.length === 0) {
      // Pathless mutating shape (git stash pop, inline interpreter write).
      // Only deny in phase=complete; other phases would need path context
      // to gate accurately.
      if (phase === "complete") {
        return {
          allow: false,
          reason:
            `TDD: slice complete. Bash command (${eff.shape}) cannot mutate state. ` +
            `Start a new slice or close out.`,
        };
      }
      continue;
    }

    for (const p of eff.paths) {
      const verdict = decideForPath(phase, p, state, workspaceDir);
      if (!verdict.allow) {
        return {
          allow: false,
          reason: `${verdict.reason} (via Bash ${eff.shape})`,
        };
      }
    }
  }
  return { allow: true };
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

  // ---- Edit/Write/MultiEdit branch ---------------------------------
  if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
    const filePath =
      typeof toolInput.file_path === "string" ? toolInput.file_path : undefined;
    if (!filePath) allow();

    const workspaceDir = findWorkspaceDir(filePath!);
    if (!workspaceDir) allow();

    const state = readStateOrDeny(workspaceDir!);
    const verdict = decideForPath(state.phase, filePath!, state, workspaceDir!);
    if (verdict.allow) allow();
    emitDeny(verdict.reason);
  }

  // ---- Bash branch (with F-DOC-5 short-circuit) --------------------
  if (toolName === "Bash") {
    const cmd = typeof toolInput.command === "string" ? toolInput.command : "";
    if (!cmd) allow();

    // Cheap short-circuit: no mutation tokens → no workspace climb.
    if (!bashCommandCouldMutate(cmd)) allow();

    const effects = extractCommandEffects(cmd);
    if (effects.length === 0) allow();

    // Pick a discovery anchor: first concrete path we can find. If all
    // effects are pathless we fall back on cwd (the verifier exemption
    // and workspace climb both still work).
    const firstPath =
      effects.flatMap((e) => e.paths).find((p) => Boolean(p)) ??
      process.cwd();

    const workspaceDir = findWorkspaceDir(firstPath);
    if (!workspaceDir) allow();

    const state = readStateOrDeny(workspaceDir!);
    const verdict = decideForBashEffects(effects, state.phase, state, workspaceDir!);
    if (verdict.allow) allow();
    emitDeny(verdict.reason);
  }

  allow();
}

function readStateOrDeny(workspaceDir: string): State {
  try {
    return readState(workspaceDir);
  } catch {
    const stateRawPath = join(workspaceDir, "state.json");
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
}

main().catch(() => {
  // Best-effort: never crash the user's tool call because of a hook bug.
  process.exit(0);
});
