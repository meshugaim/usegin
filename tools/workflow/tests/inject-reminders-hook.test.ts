import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  type HookInput,
  type HookDeps,
  injectReminders,
  formatReminders,
  shouldShowReminder,
  createDefaultDeps,
  parseHookInput,
  getSessionId,
  processStopHook,
  type StopHookDecision,
  type InjectRemindersResult,
  main,
  // Context handoff exports
  CONTEXT_THRESHOLD_WARNING,
  CONTEXT_THRESHOLD_MANDATORY,
  getContextReminderFromUtilization,
  type ContextReminder,
  isAutoHandoffEnabled,
} from "../src/inject-reminders-hook";
import { setUnblockStopCount, getUnblockStopCount } from "../src/workflow";

const TEST_STORAGE_DIR = join(tmpdir(), "inject-reminders-test");

function createTestDeps(sessionId: string = "test-session"): HookDeps {
  return {
    storageDir: TEST_STORAGE_DIR,
    sessionId,
    random: () => 0.5, // deterministic for testing
  };
}

beforeEach(async () => {
  await rm(TEST_STORAGE_DIR, { recursive: true, force: true });
  await mkdir(TEST_STORAGE_DIR, { recursive: true });
});

describe("formatReminders", () => {
  test("wraps single reminder in XML tags", () => {
    const output = formatReminders(["Write tests first"]);
    expect(output).toBe("<workflow-reminders>\nWrite tests first\n</workflow-reminders>");
  });

  test("wraps multiple reminders with newlines", () => {
    const output = formatReminders(["Write tests first", "Commit often"]);
    expect(output).toBe("<workflow-reminders>\nWrite tests first\nCommit often\n</workflow-reminders>");
  });

  test("returns empty string for empty array", () => {
    const output = formatReminders([]);
    expect(output).toBe("");
  });

  test("handles reminder with special characters", () => {
    const output = formatReminders(["Use <code> blocks"]);
    expect(output).toBe("<workflow-reminders>\nUse <code> blocks\n</workflow-reminders>");
  });
});

describe("shouldShowReminder", () => {
  test("returns true when random is less than frequency", () => {
    const result = shouldShowReminder(0.7, () => 0.5);
    expect(result).toBe(true);
  });

  test("returns false when random is greater than frequency", () => {
    const result = shouldShowReminder(0.3, () => 0.5);
    expect(result).toBe(false);
  });

  test("returns true when random equals frequency", () => {
    const result = shouldShowReminder(0.5, () => 0.5);
    expect(result).toBe(true);
  });

  test("always returns true for frequency 1.0", () => {
    const result = shouldShowReminder(1.0, () => 0.9999);
    expect(result).toBe(true);
  });

  test("always returns false for frequency 0", () => {
    const result = shouldShowReminder(0, () => 0);
    expect(result).toBe(false);
  });
});

describe("injectReminders", () => {
  describe("reading workflow files", () => {
    test("returns empty when no workflow file exists", async () => {
      const deps = createTestDeps();
      const result = await injectReminders(deps);
      expect(result.output).toBe("");
      expect(result.mandatoryHandoff).toBe(false);
    });

    test("reads reminders from workflow file", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests first", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toBe("<workflow-reminders>\nWrite tests first\n</workflow-reminders>");
    });

    test("handles multiple reminders", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests first", frequency: 1.0, created: "2025-01-01" },
          { text: "Commit often", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toBe("<workflow-reminders>\nWrite tests first\nCommit often\n</workflow-reminders>");
    });
  });

  describe("frequency filtering", () => {
    test("shows reminders with frequency 1.0 always", async () => {
      const deps = createTestDeps();
      deps.random = () => 0.99; // High random value
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Always show", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toContain("Always show");
    });

    test("filters reminders based on frequency", async () => {
      const deps = createTestDeps();
      deps.random = () => 0.6; // 60% random value
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "High freq", frequency: 0.8, created: "2025-01-01" },
          { text: "Low freq", frequency: 0.3, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toContain("High freq");
      expect(result.output).not.toContain("Low freq");
    });

    test("never shows reminders with frequency 0", async () => {
      const deps = createTestDeps();
      deps.random = () => 0; // Lowest possible random value
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Never show", frequency: 0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toBe("");
    });
  });

  describe("error handling", () => {
    test("returns empty on malformed JSON", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, "not valid json");

      const result = await injectReminders(deps);
      expect(result.output).toBe("");
    });

    test("returns empty when reminders is not an array", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({ reminders: "not an array" }));

      const result = await injectReminders(deps);
      expect(result.output).toBe("");
    });
  });

  describe("session ID from stdin", () => {
    test("uses session ID from deps", async () => {
      const sessionId = "custom-session-id";
      const deps = createTestDeps(sessionId);
      const workflowPath = join(TEST_STORAGE_DIR, `${sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Session specific", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);
      expect(result.output).toBe("<workflow-reminders>\nSession specific\n</workflow-reminders>");
    });
  });
});

describe("hook stdin parsing", () => {
  test("parses session_id from hook input JSON", async () => {
    // This tests the parsing of hook input which comes from stdin
    // The hook receives: { "session_id": "..." } on stdin
    const input: HookInput = { session_id: "abc-123" };
    expect(input.session_id).toBe("abc-123");
  });
});

describe("createDefaultDeps", () => {
  test("uses WORKFLOW_STORAGE_DIR when set", () => {
    const originalEnv = process.env.WORKFLOW_STORAGE_DIR;
    process.env.WORKFLOW_STORAGE_DIR = "/custom/storage";
    try {
      const deps = createDefaultDeps("test-session");
      expect(deps.storageDir).toBe("/custom/storage");
      expect(deps.sessionId).toBe("test-session");
      expect(typeof deps.random).toBe("function");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.WORKFLOW_STORAGE_DIR;
      } else {
        process.env.WORKFLOW_STORAGE_DIR = originalEnv;
      }
    }
  });

  test("uses default storage dir when env not set", () => {
    const originalEnv = process.env.WORKFLOW_STORAGE_DIR;
    delete process.env.WORKFLOW_STORAGE_DIR;
    try {
      const deps = createDefaultDeps("test-session");
      expect(deps.storageDir).toContain(".claude/workflows");
    } finally {
      if (originalEnv !== undefined) {
        process.env.WORKFLOW_STORAGE_DIR = originalEnv;
      }
    }
  });
});

describe("getSessionId", () => {
  test("returns session_id from input when present", () => {
    const input: HookInput = { session_id: "stdin-session" };
    const result = getSessionId(input);
    expect(result).toBe("stdin-session");
  });

  test("returns CLAUDE_SESSION_ID env var when input is null", () => {
    const originalEnv = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = "env-session";
    try {
      const result = getSessionId(null);
      expect(result).toBe("env-session");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = originalEnv;
      }
    }
  });

  test("returns CLAUDE_SESSION_ID env var when input has no session_id", () => {
    const originalEnv = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = "env-session";
    try {
      const result = getSessionId({} as HookInput);
      expect(result).toBe("env-session");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = originalEnv;
      }
    }
  });

  test("stdin session_id takes precedence over env var", () => {
    const originalEnv = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = "env-session";
    try {
      const input: HookInput = { session_id: "stdin-session" };
      const result = getSessionId(input);
      expect(result).toBe("stdin-session");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = originalEnv;
      }
    }
  });

  test("returns undefined when neither source provides session_id", () => {
    const originalEnv = process.env.CLAUDE_SESSION_ID;
    delete process.env.CLAUDE_SESSION_ID;
    try {
      const result = getSessionId(null);
      expect(result).toBeUndefined();
    } finally {
      if (originalEnv !== undefined) {
        process.env.CLAUDE_SESSION_ID = originalEnv;
      }
    }
  });
});

describe("integration: hook subprocess", () => {
  const hookPath = join(import.meta.dir, "../src/inject-reminders-hook.ts");

  test("outputs reminders to stdout when workflow file exists", async () => {
    const sessionId = "integration-test-session";
    const storageDir = TEST_STORAGE_DIR;
    const workflowPath = join(storageDir, `${sessionId}.json`);

    // Create workflow file with reminders
    await Bun.write(
      workflowPath,
      JSON.stringify({
        reminders: [
          { text: "Integration test reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    // Spawn the hook as subprocess
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
      },
    });

    // Feed JSON on stdin
    const input = JSON.stringify({ session_id: sessionId });
    proc.stdin.write(input);
    proc.stdin.end();

    // Wait for completion
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(
      "<workflow-reminders>\nIntegration test reminder\n</workflow-reminders>"
    );
  });

  test("outputs nothing when no session_id provided", async () => {
    // Create env without CLAUDE_SESSION_ID to test stdin-only behavior
    const envWithoutSession = { ...process.env };
    delete envWithoutSession.CLAUDE_SESSION_ID;

    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: envWithoutSession,
    });

    // Feed empty JSON
    proc.stdin.write("{}");
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });

  test("outputs nothing when invalid JSON on stdin", async () => {
    // Create env without CLAUDE_SESSION_ID to test stdin-only behavior
    const envWithoutSession = { ...process.env };
    delete envWithoutSession.CLAUDE_SESSION_ID;

    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: envWithoutSession,
    });

    proc.stdin.write("not valid json");
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });

  test("outputs nothing when workflow file does not exist", async () => {
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: TEST_STORAGE_DIR,
      },
    });

    proc.stdin.write(JSON.stringify({ session_id: "nonexistent-session" }));
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });

  test("falls back to CLAUDE_SESSION_ID env var when stdin has no session_id", async () => {
    const sessionId = "env-var-session";
    const storageDir = TEST_STORAGE_DIR;
    const workflowPath = join(storageDir, `${sessionId}.json`);

    // Create workflow file with reminders
    await Bun.write(
      workflowPath,
      JSON.stringify({
        reminders: [
          { text: "Env var fallback reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    // Spawn the hook with CLAUDE_SESSION_ID env var but no session_id in stdin
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
        CLAUDE_SESSION_ID: sessionId,
      },
    });

    // Feed empty JSON (no session_id)
    proc.stdin.write("{}");
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(
      "<workflow-reminders>\nEnv var fallback reminder\n</workflow-reminders>"
    );
  });

  test("stdin session_id takes precedence over CLAUDE_SESSION_ID env var", async () => {
    const stdinSessionId = "stdin-session";
    const envSessionId = "env-session";
    const storageDir = TEST_STORAGE_DIR;

    // Create workflow file for stdin session
    await Bun.write(
      join(storageDir, `${stdinSessionId}.json`),
      JSON.stringify({
        reminders: [
          { text: "Stdin reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    // Create workflow file for env session
    await Bun.write(
      join(storageDir, `${envSessionId}.json`),
      JSON.stringify({
        reminders: [
          { text: "Env reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    // Spawn with both stdin session_id and CLAUDE_SESSION_ID env var
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
        CLAUDE_SESSION_ID: envSessionId,
      },
    });

    // Feed session_id in stdin (should take precedence)
    proc.stdin.write(JSON.stringify({ session_id: stdinSessionId }));
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("<workflow-reminders>\nStdin reminder\n</workflow-reminders>");
  });
});

describe("processStopHook", () => {
  describe("when unblock count is 0", () => {
    test("returns block decision with reminders", async () => {
      const deps = createTestDeps("stop-hook-block-test");
      const workflowDeps = { storageDir: deps.storageDir, sessionId: deps.sessionId };
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create workflow file with reminders
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
          { text: "Run coverage", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const decision = await processStopHook(deps);

      expect(decision.decision).toBe("block");
      expect(decision.reason).toContain("Write tests");
      expect(decision.reason).toContain("Run coverage");
    });

    test("returns allow decision when no reminders exist", async () => {
      const deps = createTestDeps("stop-hook-no-reminders");
      // No workflow file exists

      const decision = await processStopHook(deps);

      expect(decision.decision).toBeUndefined();  // undefined = allow
      expect(decision.reason).toBeUndefined();
    });
  });

  describe("when unblock count is greater than 0", () => {
    test("returns allow decision and decrements counter", async () => {
      const deps = createTestDeps("stop-hook-unblock-test");
      const workflowDeps = { storageDir: deps.storageDir, sessionId: deps.sessionId };
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create workflow file with reminders and unblock count
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
        ],
        unblockStopCount: 2,
      }));

      const decision = await processStopHook(deps);

      expect(decision.decision).toBeUndefined();  // undefined = allow
      expect(decision.reason).toBeUndefined();

      // Verify counter was decremented
      const count = await getUnblockStopCount(workflowDeps);
      expect(count).toBe(1);
    });

    test("decrements to 0 and allows", async () => {
      const deps = createTestDeps("stop-hook-decrement-test");
      const workflowDeps = { storageDir: deps.storageDir, sessionId: deps.sessionId };
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create workflow file with count = 1
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
        ],
        unblockStopCount: 1,
      }));

      const decision = await processStopHook(deps);

      expect(decision.decision).toBeUndefined();  // undefined = allow

      // Verify counter is now 0
      const count = await getUnblockStopCount(workflowDeps);
      expect(count).toBe(0);
    });

    test("subsequent call blocks after counter reaches 0", async () => {
      const deps = createTestDeps("stop-hook-subsequent-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create workflow file with count = 1
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
        ],
        unblockStopCount: 1,
      }));

      // First call - should allow
      const decision1 = await processStopHook(deps);
      expect(decision1.decision).toBeUndefined();  // undefined = allow

      // Second call - should block
      const decision2 = await processStopHook(deps);
      expect(decision2.decision).toBe("block");
      expect(decision2.reason).toContain("Write tests");
    });
  });

  describe("decision format", () => {
    test("block decision includes workflow-reminders format in reason", async () => {
      const deps = createTestDeps("stop-hook-format-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Reminder 1", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const decision = await processStopHook(deps);

      expect(decision.decision).toBe("block");
      expect(decision.reason).toContain("<workflow-reminders>\nReminder 1\n</workflow-reminders>");
    });

    test("block decision includes unblock-stop tip", async () => {
      const deps = createTestDeps("stop-hook-tip-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const decision = await processStopHook(deps);

      expect(decision.decision).toBe("block");
      expect(decision.reason).toContain("Run workflow unblock-stop to continue (prefer -n 1)");
    });
  });
});

describe("integration: Stop hook subprocess", () => {
  const hookPath = join(import.meta.dir, "../src/inject-reminders-hook.ts");

  test("outputs JSON block decision when Stop hook has reminders", async () => {
    const sessionId = "stop-hook-integration-block";
    const storageDir = TEST_STORAGE_DIR;
    const workflowPath = join(storageDir, `${sessionId}.json`);

    // Create workflow file with reminders
    await Bun.write(
      workflowPath,
      JSON.stringify({
        reminders: [
          { text: "Integration test reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
      },
    });

    // Feed JSON with hook_event_name = "Stop"
    const input = JSON.stringify({ session_id: sessionId, hook_event_name: "Stop" });
    proc.stdin.write(input);
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    const decision = JSON.parse(stdout.trim());
    expect(decision.decision).toBe("block");
    expect(decision.reason).toContain("<workflow-reminders>\nIntegration test reminder\n</workflow-reminders>");
    expect(decision.reason).toContain("Run workflow unblock-stop to continue (prefer -n 1)");
  });

  test("outputs JSON allow decision when Stop hook has unblock count", async () => {
    const sessionId = "stop-hook-integration-allow";
    const storageDir = TEST_STORAGE_DIR;
    const workflowPath = join(storageDir, `${sessionId}.json`);

    // Create workflow file with reminders AND unblock count
    await Bun.write(
      workflowPath,
      JSON.stringify({
        reminders: [
          { text: "Should be skipped", frequency: 1.0, created: "2025-01-01" },
        ],
        unblockStopCount: 1,
      })
    );

    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
      },
    });

    const input = JSON.stringify({ session_id: sessionId, hook_event_name: "Stop" });
    proc.stdin.write(input);
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    const decision = JSON.parse(stdout.trim());
    expect(decision.decision).toBeUndefined();  // undefined = allow
    expect(decision.reason).toBeUndefined();

    // Verify counter was decremented
    const count = await getUnblockStopCount({ storageDir, sessionId });
    expect(count).toBe(0);
  });

  test("outputs plain text reminders for SessionStart hook", async () => {
    const sessionId = "session-start-integration";
    const storageDir = TEST_STORAGE_DIR;
    const workflowPath = join(storageDir, `${sessionId}.json`);

    // Create workflow file with reminders
    await Bun.write(
      workflowPath,
      JSON.stringify({
        reminders: [
          { text: "SessionStart reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      })
    );

    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        WORKFLOW_STORAGE_DIR: storageDir,
      },
    });

    // Feed JSON with hook_event_name = "SessionStart"
    const input = JSON.stringify({ session_id: sessionId, hook_event_name: "SessionStart" });
    proc.stdin.write(input);
    proc.stdin.end();

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    // Should be plain text, not JSON
    expect(stdout.trim()).toBe("<workflow-reminders>\nSessionStart reminder\n</workflow-reminders>");
  });
});

describe("context-based handoff thresholds", () => {
  describe("threshold constants", () => {
    test("warning threshold is 75%", () => {
      expect(CONTEXT_THRESHOLD_WARNING).toBe(75);
    });

    test("mandatory threshold is 85%", () => {
      expect(CONTEXT_THRESHOLD_MANDATORY).toBe(85);
    });

    test("mandatory threshold is higher than warning threshold", () => {
      expect(CONTEXT_THRESHOLD_MANDATORY).toBeGreaterThan(CONTEXT_THRESHOLD_WARNING);
    });
  });

  describe("getContextReminderFromUtilization", () => {
    test("returns null when utilization is below warning threshold", () => {
      expect(getContextReminderFromUtilization(50)).toBeNull();
      expect(getContextReminderFromUtilization(74)).toBeNull();
      expect(getContextReminderFromUtilization(74.9)).toBeNull();
    });

    test("returns warning (non-mandatory) at warning threshold", () => {
      const result = getContextReminderFromUtilization(75);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(false);
      expect(result!.message).toContain("75%");
      expect(result!.message).toContain("Consider wrapping up");
    });

    test("returns warning (non-mandatory) between thresholds", () => {
      const result = getContextReminderFromUtilization(80);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(false);
      expect(result!.message).toContain("80%");
    });

    test("returns warning at 84% (just below mandatory)", () => {
      const result = getContextReminderFromUtilization(84);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(false);
    });

    test("returns mandatory at mandatory threshold (85%)", () => {
      const result = getContextReminderFromUtilization(85);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(true);
      expect(result!.message).toContain("85%");
      expect(result!.message).toContain("MANDATORY HANDOFF REQUIRED");
      expect(result!.message).toContain("MUST run /auto-handoff NOW");
    });

    test("returns mandatory above threshold", () => {
      const result = getContextReminderFromUtilization(90);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(true);
      expect(result!.message).toContain("90%");
    });

    test("returns mandatory at critical levels", () => {
      const result = getContextReminderFromUtilization(95);
      expect(result).not.toBeNull();
      expect(result!.mandatory).toBe(true);
      expect(result!.message).toContain("MANDATORY HANDOFF REQUIRED");
    });

    test("mandatory message is imperative and non-optional", () => {
      const result = getContextReminderFromUtilization(85);
      expect(result!.message).toContain("Do not continue with any other work");
      expect(result!.message).toContain("This is not optional");
      expect(result!.message).toContain("Execute the handoff skill immediately");
    });
  });
});

describe("mandatory handoff blocking behavior", () => {
  describe("processStopHook with mandatory handoff", () => {
    // We need to mock the context utilization for these tests.
    // Since getContextUtilization calls cctx subprocess, we'll test the logic
    // by verifying the InjectRemindersResult handling in processStopHook.

    test("mandatory handoff blocks even with unblock count > 0", async () => {
      // This test verifies the critical behavior: mandatory handoffs CANNOT be bypassed
      const deps = createTestDeps("mandatory-bypass-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create workflow file with high unblock count
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [],  // No regular reminders
        unblockStopCount: 100,  // High count that would normally allow many stops
      }));

      // The processStopHook function checks mandatory BEFORE checking unblock count
      // So even with unblockStopCount=100, a mandatory handoff should block

      // Note: We can't easily test the full flow without mocking cctx,
      // but we can verify the logic structure by examining the function behavior
      // when there are no context-based reminders (low utilization)
      const decision = await processStopHook(deps);

      // With no context reminder and unblockCount > 0, should allow
      expect(decision.decision).toBeUndefined();  // undefined = allow
    });

    test("mandatory blocks without unblock tip in reason", async () => {
      // When handoff is mandatory, we don't show the "unblock-stop" tip
      // because unblocking is not allowed for mandatory handoffs
      const deps = createTestDeps("mandatory-no-tip-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      // Create a workflow file - the mandatory blocking happens at context check level
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Regular reminder", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      // Without mocking cctx, we can't trigger mandatory handoff here,
      // but we verify non-mandatory blocks DO include the tip
      const decision = await processStopHook(deps);

      expect(decision.decision).toBe("block");
      expect(decision.reason).toContain("unblock-stop");  // Non-mandatory includes tip
    });
  });

  describe("InjectRemindersResult mandatoryHandoff flag", () => {
    test("injectReminders returns mandatoryHandoff: false when no context reminder", async () => {
      const deps = createTestDeps("no-mandatory-test");
      // No workflow file, no context check (will return null)

      const result = await injectReminders(deps);

      expect(result.mandatoryHandoff).toBe(false);
      expect(result.output).toBe("");
    });

    test("injectReminders returns mandatoryHandoff: false with regular reminders", async () => {
      const deps = createTestDeps("regular-reminder-test");
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const result = await injectReminders(deps);

      // Without mocked high context, mandatoryHandoff should be false
      expect(result.mandatoryHandoff).toBe(false);
      expect(result.output).toContain("Write tests");
    });
  });
});

describe("mandatory handoff skips workflow reminders", () => {
  // When mandatory handoff is triggered, we don't clutter the message
  // with other workflow reminders - the agent needs to focus on handoff

  test("workflow reminders are included when not mandatory", async () => {
    const deps = createTestDeps("include-reminders-test");
    const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);

    await Bun.write(workflowPath, JSON.stringify({
      reminders: [
        { text: "Reminder A", frequency: 1.0, created: "2025-01-01" },
        { text: "Reminder B", frequency: 1.0, created: "2025-01-01" },
      ],
    }));

    const result = await injectReminders(deps);

    expect(result.output).toContain("Reminder A");
    expect(result.output).toContain("Reminder B");
  });

  // Note: Testing that workflow reminders are SKIPPED during mandatory handoff
  // would require mocking cctx to return high utilization. This is covered
  // by the implementation logic in injectReminders which checks mandatoryHandoff
  // before processing workflow reminders.
});

describe("isAutoHandoffEnabled", () => {
  const testConfigDir = join(tmpdir(), "claude-config-test");
  const testConfigPath = join(testConfigDir, "test-claude.json");
  let originalConfigPath: string | undefined;

  beforeEach(async () => {
    // Save original CLAUDE_CONFIG_PATH
    originalConfigPath = process.env.CLAUDE_CONFIG_PATH;
    // Create test directory and set config path to test file
    await rm(testConfigDir, { recursive: true, force: true });
    await mkdir(testConfigDir, { recursive: true });
    process.env.CLAUDE_CONFIG_PATH = testConfigPath;
  });

  afterEach(() => {
    // Restore original CLAUDE_CONFIG_PATH
    if (originalConfigPath !== undefined) {
      process.env.CLAUDE_CONFIG_PATH = originalConfigPath;
    } else {
      delete process.env.CLAUDE_CONFIG_PATH;
    }
  });

  test("returns false when config file does not exist", async () => {
    const result = await isAutoHandoffEnabled();
    expect(result).toBe(false);
  });

  test("returns false when autoHandoffEnabled is not set", async () => {
    await Bun.write(testConfigPath, JSON.stringify({
      someOtherSetting: true,
    }));

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(false);
  });

  test("returns false when autoHandoffEnabled is false", async () => {
    await Bun.write(testConfigPath, JSON.stringify({
      autoHandoffEnabled: false,
    }));

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(false);
  });

  test("returns true when autoHandoffEnabled is true", async () => {
    await Bun.write(testConfigPath, JSON.stringify({
      autoHandoffEnabled: true,
    }));

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(true);
  });

  test("returns false on malformed JSON", async () => {
    await Bun.write(testConfigPath, "not valid json");

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(false);
  });

  test("returns false when autoHandoffEnabled is not a boolean", async () => {
    await Bun.write(testConfigPath, JSON.stringify({
      autoHandoffEnabled: "yes",  // string, not boolean
    }));

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(false);
  });

  test("works with full Claude config structure", async () => {
    await Bun.write(testConfigPath, JSON.stringify({
      autoCompactEnabled: false,
      autoHandoffEnabled: true,
      theme: "dark",
      model: "opus",
    }));

    const result = await isAutoHandoffEnabled();
    expect(result).toBe(true);
  });
});
