/**
 * Tests for the tdd-execute Edit-gating hook.
 *
 * Run: bun test .claude/skills/tdd-execute/hooks/
 *
 * Test strategy: spawn the hook as a subprocess (matching how Claude Code
 * itself invokes hooks), feed JSON to stdin, assert on exit code + stdout.
 * Each test sets up an isolated workspace under bun's tmp dir so workspace
 * climbing yields the right state.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  appendFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

const HOOK_PATH = join(import.meta.dir, "gate-edit-by-phase.ts");

interface HookResult {
  exitCode: number;
  decision: "allow" | "deny";
  reason: string;
  stdout: string;
  stderr: string;
}

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

async function runHook(
  input: HookInput,
  env: Record<string, string> = {},
): Promise<HookResult> {
  const proc = spawn({
    cmd: ["bun", HOOK_PATH],
    stdin: new TextEncoder().encode(JSON.stringify(input)),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  let decision: "allow" | "deny" = "allow";
  let reason = "";
  if (stdout.trim()) {
    try {
      const out = JSON.parse(stdout);
      decision = out.hookSpecificOutput?.permissionDecision ?? "allow";
      reason = out.hookSpecificOutput?.permissionDecisionReason ?? "";
    } catch {
      // Not JSON — treat as allow.
    }
  }

  return { exitCode, decision, reason, stdout, stderr };
}

interface StatePartial {
  phase:
    | "pre-red"
    | "red"
    | "green"
    | "refactor"
    | "mutation-pass"
    | "complete";
  last_test_run?: {
    ts: string;
    passed: number;
    failed: number;
    failing_tests: string[];
  };
  pre_red?: { allowed_paths: string[] };
  mutation_pass?: { allowed_paths: string[]; current_mutation_id?: string };
  refactor_freshness_window_ms?: number;
}

function makeState(p: StatePartial) {
  return {
    plan: "impl-plan.md",
    step_index: 0,
    phase: p.phase,
    current_target_test_id: "T1",
    cycle_attempts: 0,
    cycle_index: 0,
    ...(p.last_test_run ? { last_test_run: p.last_test_run } : {}),
    ...(p.pre_red ? { pre_red: p.pre_red } : {}),
    ...(p.mutation_pass ? { mutation_pass: p.mutation_pass } : {}),
    ...(p.refactor_freshness_window_ms !== undefined
      ? { refactor_freshness_window_ms: p.refactor_freshness_window_ms }
      : {}),
  };
}

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "tdd-gate-"));
});

afterEach(() => {
  try {
    rmSync(workspace, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function writeState(state: object): void {
  writeFileSync(join(workspace, "state.json"), JSON.stringify(state, null, 2));
}

describe("gate-edit-by-phase", () => {
  test("allow: file outside any tdd-execute workspace", async () => {
    // No state.json anywhere on the climb path → should allow.
    // We point at a path that has no state.json above it within climb depth.
    // Use a fresh tmpdir that we deliberately don't write state.json into.
    const r = await runHook({
      tool_name: "Edit",
      tool_input: { file_path: join(workspace, "src/foo.ts") },
    });
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("allow: phase=red + test path", async () => {
    writeState(makeState({ phase: "red" }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.test.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: phase=red + production path", async () => {
    writeState(makeState({ phase: "red" }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("RED phase");
    expect(r.reason).toContain("red-tweaker");
  });

  test("deny: phase=green + test path", async () => {
    writeState(makeState({ phase: "green" }));
    const r = await runHook(
      {
        tool_name: "Write",
        tool_input: {
          file_path: join(workspace, "src/foo.test.ts"),
          content: "x",
        },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("GREEN phase");
    expect(r.reason).toContain("locked");
  });

  test("allow: phase=green + production path", async () => {
    writeState(makeState({ phase: "green" }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("allow: phase=refactor + test path + last_test_run green-and-fresh", async () => {
    writeState(
      makeState({
        phase: "refactor",
        last_test_run: {
          ts: new Date().toISOString(), // now → fresh
          passed: 17,
          failed: 0,
          failing_tests: [],
        },
      }),
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.test.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: phase=refactor + last_test_run failed > 0", async () => {
    writeState(
      makeState({
        phase: "refactor",
        last_test_run: {
          ts: new Date().toISOString(),
          passed: 16,
          failed: 1,
          failing_tests: ["foo.test.ts:42"],
        },
      }),
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("REFACTOR");
    expect(r.reason).toContain("Re-run");
  });

  test("deny: phase=refactor + last_test_run stale (manufactured timestamp)", async () => {
    // Run timestamp is 1 hour ago AND we log an edit event after it.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const justNow = new Date().toISOString();

    writeState(
      makeState({
        phase: "refactor",
        last_test_run: {
          ts: oneHourAgo,
          passed: 17,
          failed: 0,
          failing_tests: [],
        },
      }),
    );

    // Append an edit event AFTER the test run → freshness fails.
    appendFileSync(
      join(workspace, "events.jsonl"),
      JSON.stringify({ ts: justNow, kind: "edit-applied" }) + "\n",
    );

    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("REFACTOR");
  });

  test("deny: phase=complete + any edit", async () => {
    writeState(makeState({ phase: "complete" }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("complete");
  });

  test("allow: Bash command with no redirect", async () => {
    writeState(makeState({ phase: "red" }));
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: "bun test src/foo.test.ts" },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: Bash heredoc into production file while phase=red", async () => {
    writeState(makeState({ phase: "red" }));
    const prodPath = join(workspace, "src/prod.ts");
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: `cat > ${prodPath} <<EOF\nexport const x = 1;\nEOF` },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("RED phase");
  });

  test("allow: malformed stdin (graceful no-op)", async () => {
    const proc = spawn({
      cmd: ["bun", HOOK_PATH],
      stdin: new TextEncoder().encode("this is not json {{{"),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(""); // no JSON output → implicit allow
  });

  // Bonus edge case: Bash redirect to /dev/null is not a "write" we care about.
  test("allow: Bash redirect to /dev/null", async () => {
    writeState(makeState({ phase: "red" }));
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: "bun test 2>/dev/null > /dev/null" },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  // ---- F-HOOK-1: command-effect classifier (git checkout / mv / cp / rm / sed) ----

  test("deny: phase=green + git checkout HEAD -- prod path (no verifier env)", async () => {
    writeState(makeState({ phase: "green" }));
    const prodPath = join(workspace, "src/foo.test.ts"); // test path
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: `git checkout HEAD -- ${prodPath}` },
      },
      { TDD_WORKSPACE: workspace },
    );
    // green phase: test-path edits are denied. The git checkout EFFECT is
    // a write to a test file → deny.
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("git checkout");
  });

  test("allow: phase=green + git checkout with TDD_VERIFIER=1 (verifier carve-out)", async () => {
    writeState(makeState({ phase: "green" }));
    const prodPath = join(workspace, "src/foo.ts");
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: `git checkout HEAD -- ${prodPath}` },
      },
      { TDD_WORKSPACE: workspace, TDD_VERIFIER: "1" },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: phase=red + mv into a production path", async () => {
    writeState(makeState({ phase: "red" }));
    const dest = join(workspace, "src/prod.ts");
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: `mv /tmp/scratch ${dest}` },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("RED phase");
    expect(r.reason).toContain("mv");
  });

  test("deny: phase=red + sed -i against production path", async () => {
    writeState(makeState({ phase: "red" }));
    const target = join(workspace, "src/prod.ts");
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: `sed -i 's/old/new/' ${target}` },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("sed -i");
  });

  test("allow: phase=green + git stash pop with TDD_VERIFIER=1", async () => {
    writeState(makeState({ phase: "green" }));
    const r = await runHook(
      { tool_name: "Bash", tool_input: { command: "git stash pop" } },
      { TDD_WORKSPACE: workspace, TDD_VERIFIER: "1" },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  // ---- F-HOOK-2: pre-red phase + allowed_paths -------------------------

  test("allow: phase=pre-red + production-path edit listed in pre_red.allowed_paths", async () => {
    const prodPath = join(workspace, "src/skeleton.ts");
    writeState(
      makeState({
        phase: "pre-red",
        pre_red: { allowed_paths: [prodPath] },
      }),
    );
    const r = await runHook(
      { tool_name: "Edit", tool_input: { file_path: prodPath } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: phase=pre-red + production-path edit NOT in allowed_paths", async () => {
    writeState(
      makeState({
        phase: "pre-red",
        pre_red: { allowed_paths: [join(workspace, "src/other.ts")] },
      }),
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/sneaky.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("PRE-RED");
    expect(r.reason).toContain("allowed_paths");
  });

  test("deny: phase=pre-red with empty allowed_paths denies any prod edit", async () => {
    writeState(makeState({ phase: "pre-red", pre_red: { allowed_paths: [] } }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("PRE-RED");
  });

  test("allow: phase=pre-red + test-file edit always allowed", async () => {
    writeState(makeState({ phase: "pre-red", pre_red: { allowed_paths: [] } }));
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.test.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("allow: phase=mutation-pass + edit on listed target_file", async () => {
    const target = join(workspace, "lib/csv/parse.ts");
    writeState(
      makeState({
        phase: "mutation-pass",
        mutation_pass: { allowed_paths: [target], current_mutation_id: "M1" },
      }),
    );
    const r = await runHook(
      { tool_name: "Edit", tool_input: { file_path: target } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("deny: phase=mutation-pass + edit outside allowed_paths", async () => {
    writeState(
      makeState({
        phase: "mutation-pass",
        mutation_pass: {
          allowed_paths: [join(workspace, "lib/csv/parse.ts")],
        },
      }),
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "lib/csv/other.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("MUTATION-PASS");
  });

  // ---- F-HOOK-4: redirect-target normalization ------------------------

  test("deny: phase=red + heredoc with quoted target path", async () => {
    writeState(makeState({ phase: "red" }));
    const prodPath = join(workspace, "src/prod.ts");
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: {
          command: `cat > "${prodPath}" <<EOF\nexport const x = 1;\nEOF`,
        },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("RED phase");
  });

  test("deny: phase=red + redirect with ./-relative path resolves to prod", async () => {
    writeState(makeState({ phase: "red" }));
    // Run the hook with cwd = workspace by spawning via cwd-aware spawn.
    // The hook resolves ./src/prod.ts against process.cwd() — which by
    // default is the test runner's cwd. Use TDD_WORKSPACE for discovery
    // and assert the captured path normalizes (regardless of cwd).
    const r = await runHook(
      {
        tool_name: "Bash",
        tool_input: { command: "echo hi > ./src/prod.ts" },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("RED phase");
  });

  // ---- F-DOC-5: Bash short-circuit -----------------------------------
  // These commands have no mutation-tokens, so the hook must early-exit
  // (no workspace discovery, immediate allow) — verified by allowing even
  // when phase=complete (which would otherwise deny everything).

  test("short-circuit: bun install in phase=complete is allowed", async () => {
    writeState(makeState({ phase: "complete" }));
    const r = await runHook(
      { tool_name: "Bash", tool_input: { command: "bun install" } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("short-circuit: bun test in phase=complete is allowed", async () => {
    writeState(makeState({ phase: "complete" }));
    const r = await runHook(
      { tool_name: "Bash", tool_input: { command: "bun test src/foo.test.ts" } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("short-circuit: git status in phase=complete is allowed", async () => {
    writeState(makeState({ phase: "complete" }));
    const r = await runHook(
      { tool_name: "Bash", tool_input: { command: "git status" } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  test("short-circuit: git log --oneline in phase=complete is allowed", async () => {
    writeState(makeState({ phase: "complete" }));
    const r = await runHook(
      { tool_name: "Bash", tool_input: { command: "git log --oneline -5" } },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("allow");
  });

  // ---- F-HOOK-3: canonical edit-applied event invalidates freshness ---

  test("deny: phase=refactor + edit-applied event since last_test_run (canonical)", async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    writeState(
      makeState({
        phase: "refactor",
        last_test_run: {
          ts: tenMinAgo,
          passed: 17,
          failed: 0,
          failing_tests: [],
        },
      }),
    );
    appendFileSync(
      join(workspace, "events.jsonl"),
      JSON.stringify({ ts: oneMinAgo, kind: "edit-applied" }) + "\n",
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("edit-applied");
  });

  // ---- F-HOOK-5: configurable freshness window ------------------------

  test("deny: phase=refactor + stale by N seconds in deny reason", async () => {
    // Window is 10s; last run was 60s ago → stale by ~50s.
    const sixtySecAgo = new Date(Date.now() - 60 * 1000).toISOString();
    writeState(
      makeState({
        phase: "refactor",
        refactor_freshness_window_ms: 10 * 1000,
        last_test_run: {
          ts: sixtySecAgo,
          passed: 17,
          failed: 0,
          failing_tests: [],
        },
      }),
    );
    const r = await runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: join(workspace, "src/foo.ts") },
      },
      { TDD_WORKSPACE: workspace },
    );
    expect(r.exitCode).toBe(0);
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("stale by");
  });
});
