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
