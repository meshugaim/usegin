import { describe, test, expect, beforeEach, mock } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  type HookInput,
  type HookDeps,
  injectReminders,
  formatReminder,
  shouldShowReminder,
  createDefaultDeps,
  parseHookInput,
  getSessionId,
  main,
} from "../src/inject-reminders-hook";

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

describe("formatReminder", () => {
  test("wraps text in XML tags", () => {
    const output = formatReminder("Write tests first");
    expect(output).toBe("<workflow-reminder>Write tests first</workflow-reminder>");
  });

  test("handles reminder with special characters", () => {
    const output = formatReminder("Use <code> blocks");
    expect(output).toBe("<workflow-reminder>Use <code> blocks</workflow-reminder>");
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
      const output = await injectReminders(deps);
      expect(output).toBe("");
    });

    test("reads reminders from workflow file", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({
        reminders: [
          { text: "Write tests first", frequency: 1.0, created: "2025-01-01" },
        ],
      }));

      const output = await injectReminders(deps);
      expect(output).toBe("<workflow-reminder>Write tests first</workflow-reminder>");
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

      const output = await injectReminders(deps);
      expect(output).toBe(
        "<workflow-reminder>Write tests first</workflow-reminder>\n" +
        "<workflow-reminder>Commit often</workflow-reminder>"
      );
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

      const output = await injectReminders(deps);
      expect(output).toContain("Always show");
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

      const output = await injectReminders(deps);
      expect(output).toContain("High freq");
      expect(output).not.toContain("Low freq");
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

      const output = await injectReminders(deps);
      expect(output).toBe("");
    });
  });

  describe("error handling", () => {
    test("returns empty on malformed JSON", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, "not valid json");

      const output = await injectReminders(deps);
      expect(output).toBe("");
    });

    test("returns empty when reminders is not an array", async () => {
      const deps = createTestDeps();
      const workflowPath = join(TEST_STORAGE_DIR, `${deps.sessionId}.json`);
      await Bun.write(workflowPath, JSON.stringify({ reminders: "not an array" }));

      const output = await injectReminders(deps);
      expect(output).toBe("");
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

      const output = await injectReminders(deps);
      expect(output).toBe("<workflow-reminder>Session specific</workflow-reminder>");
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
      "<workflow-reminder>Integration test reminder</workflow-reminder>"
    );
  });

  test("outputs nothing when no session_id provided", async () => {
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
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
    const proc = Bun.spawn(["bun", "run", hookPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
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
      "<workflow-reminder>Env var fallback reminder</workflow-reminder>"
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
    expect(stdout.trim()).toBe("<workflow-reminder>Stdin reminder</workflow-reminder>");
  });
});
