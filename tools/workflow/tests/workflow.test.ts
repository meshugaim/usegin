import { describe, test, expect, beforeEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  addReminder,
  addReminders,
  listReminders,
  getRawReminders,
  clearReminders,
  removeReminder,
  exportTemplate,
  importTemplate,
  listTemplates,
  importFromSession,
  listSessions,
  setUnblockStopCount,
  getUnblockStopCount,
  decrementUnblockStopCount,
  type WorkflowDeps,
  type Reminder,
} from "../src/workflow";

const TEST_SESSION_ID = "test-session-123";
const TEST_STORAGE_DIR = join(tmpdir(), "workflow-test");

function createTestDeps(): WorkflowDeps {
  return {
    storageDir: TEST_STORAGE_DIR,
    sessionId: TEST_SESSION_ID,
  };
}

beforeEach(async () => {
  await rm(TEST_STORAGE_DIR, { recursive: true, force: true });
  await mkdir(TEST_STORAGE_DIR, { recursive: true });
});

describe("workflow reminders", () => {
  describe("addReminder", () => {
    test("adds a reminder to empty list", async () => {
      const deps = createTestDeps();
      await addReminder("verify tests pass", deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["verify tests pass"]);
    });

    test("adds multiple reminders", async () => {
      const deps = createTestDeps();
      await addReminder("verify tests pass", deps);
      await addReminder("run lint", deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["verify tests pass", "run lint"]);
    });

    test("trims whitespace from reminder", async () => {
      const deps = createTestDeps();
      await addReminder("  spaces around  ", deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["spaces around"]);
    });

    test("adds reminder with default frequency 0.2", async () => {
      const deps = createTestDeps();
      await addReminder("sometimes show", deps);

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders).toHaveLength(1);
      expect(rawReminders[0].text).toBe("sometimes show");
      expect(rawReminders[0].frequency).toBe(0.2);
      expect(rawReminders[0].created).toBeDefined();
    });

    test("adds reminder with custom frequency", async () => {
      const deps = createTestDeps();
      await addReminder("sometimes show", deps, { frequency: 0.5 });

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders).toHaveLength(1);
      expect(rawReminders[0].text).toBe("sometimes show");
      expect(rawReminders[0].frequency).toBe(0.5);
    });

    test("clamps frequency to 0-1 range", async () => {
      const deps = createTestDeps();
      await addReminder("high freq", deps, { frequency: 1.5 });
      await addReminder("low freq", deps, { frequency: -0.5 });

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders[0].frequency).toBe(1.0);
      expect(rawReminders[1].frequency).toBe(0.0);
    });

    test("stores created timestamp", async () => {
      const deps = createTestDeps();
      const before = new Date().toISOString();
      await addReminder("timestamped", deps);
      const after = new Date().toISOString();

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders[0].created >= before).toBe(true);
      expect(rawReminders[0].created <= after).toBe(true);
    });
  });

  describe("listReminders", () => {
    test("returns empty array when no reminders", async () => {
      const deps = createTestDeps();
      const reminders = await listReminders(deps);
      expect(reminders).toEqual([]);
    });

    test("returns all reminders in order", async () => {
      const deps = createTestDeps();
      await addReminder("first", deps);
      await addReminder("second", deps);
      await addReminder("third", deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["first", "second", "third"]);
    });
  });

  describe("removeReminder", () => {
    test("removes reminder by index", async () => {
      const deps = createTestDeps();
      await addReminder("first", deps);
      await addReminder("second", deps);
      await addReminder("third", deps);

      await removeReminder(1, deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["first", "third"]);
    });

    test("throws on invalid index", async () => {
      const deps = createTestDeps();
      await addReminder("only one", deps);

      await expect(removeReminder(5, deps)).rejects.toThrow("Invalid index");
    });
  });

  describe("clearReminders", () => {
    test("removes all reminders", async () => {
      const deps = createTestDeps();
      await addReminder("first", deps);
      await addReminder("second", deps);

      await clearReminders(deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual([]);
    });

    test("works on empty list", async () => {
      const deps = createTestDeps();
      await clearReminders(deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual([]);
    });
  });

  describe("session isolation", () => {
    test("different sessions have separate reminders", async () => {
      const deps1 = { ...createTestDeps(), sessionId: "session-1" };
      const deps2 = { ...createTestDeps(), sessionId: "session-2" };

      await addReminder("reminder for session 1", deps1);
      await addReminder("reminder for session 2", deps2);

      const reminders1 = await listReminders(deps1);
      const reminders2 = await listReminders(deps2);

      expect(reminders1).toEqual(["reminder for session 1"]);
      expect(reminders2).toEqual(["reminder for session 2"]);
    });
  });

  describe("JSON storage format", () => {
    test("stores data as JSON file with .json extension", async () => {
      const deps = createTestDeps();
      await addReminder("test reminder", deps);

      const filePath = join(TEST_STORAGE_DIR, `${TEST_SESSION_ID}.json`);
      const file = Bun.file(filePath);
      expect(await file.exists()).toBe(true);

      const content = await file.json();
      expect(content).toHaveProperty("reminders");
      expect(Array.isArray(content.reminders)).toBe(true);
    });

    test("JSON structure matches expected format", async () => {
      const deps = createTestDeps();
      await addReminder("write tests first", deps, { frequency: 0.8 });

      const filePath = join(TEST_STORAGE_DIR, `${TEST_SESSION_ID}.json`);
      const content = await Bun.file(filePath).json();

      expect(content.reminders[0]).toMatchObject({
        text: "write tests first",
        frequency: 0.8,
      });
      expect(typeof content.reminders[0].created).toBe("string");
    });
  });

  describe("getRawReminders", () => {
    test("returns full reminder objects with metadata", async () => {
      const deps = createTestDeps();
      await addReminder("reminder 1", deps, { frequency: 1.0 });
      await addReminder("reminder 2", deps, { frequency: 0.5 });

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders).toHaveLength(2);
      expect(rawReminders[0]).toMatchObject({ text: "reminder 1", frequency: 1.0 });
      expect(rawReminders[1]).toMatchObject({ text: "reminder 2", frequency: 0.5 });
    });
  });

  describe("addReminders", () => {
    test("adds multiple reminders in one call", async () => {
      const deps = createTestDeps();
      await addReminders(["tdd", "commit-often", "verify"], deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["tdd", "commit-often", "verify"]);
    });

    test("adds to existing reminders", async () => {
      const deps = createTestDeps();
      await addReminder("existing", deps);
      await addReminders(["new1", "new2"], deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["existing", "new1", "new2"]);
    });

    test("applies same frequency to all reminders", async () => {
      const deps = createTestDeps();
      await addReminders(["a", "b", "c"], deps, { frequency: 0.5 });

      const rawReminders = await getRawReminders(deps);
      expect(rawReminders).toHaveLength(3);
      expect(rawReminders[0].frequency).toBe(0.5);
      expect(rawReminders[1].frequency).toBe(0.5);
      expect(rawReminders[2].frequency).toBe(0.5);
    });

    test("trims whitespace from all reminders", async () => {
      const deps = createTestDeps();
      await addReminders(["  spaced  ", "  also spaced  "], deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["spaced", "also spaced"]);
    });

    test("handles empty array", async () => {
      const deps = createTestDeps();
      await addReminders([], deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual([]);
    });

    test("handles single item array", async () => {
      const deps = createTestDeps();
      await addReminders(["only one"], deps);

      const reminders = await listReminders(deps);
      expect(reminders).toEqual(["only one"]);
    });
  });
});

describe("workflow templates", () => {
  describe("exportTemplate", () => {
    test("saves current reminders as template", async () => {
      const deps = createTestDeps();
      await addReminder("reminder 1", deps);
      await addReminder("reminder 2", deps);

      await exportTemplate("my-template", deps);

      const templates = await listTemplates(deps);
      expect(templates).toContain("my-template");
    });
  });

  describe("importTemplate", () => {
    test("loads reminders from template", async () => {
      const deps = createTestDeps();
      await addReminder("template reminder", deps);
      await exportTemplate("test-template", deps);

      // Clear and use different session
      const newDeps = { ...deps, sessionId: "new-session" };
      await importTemplate("test-template", newDeps);

      const reminders = await listReminders(newDeps);
      expect(reminders).toEqual(["template reminder"]);
    });

    test("throws on non-existent template", async () => {
      const deps = createTestDeps();
      await expect(importTemplate("non-existent", deps)).rejects.toThrow(
        "Template not found"
      );
    });
  });

  describe("listTemplates", () => {
    test("returns empty array when no templates", async () => {
      const deps = createTestDeps();
      const templates = await listTemplates(deps);
      expect(templates).toEqual([]);
    });

    test("returns all template names", async () => {
      const deps = createTestDeps();
      await addReminder("r1", deps);
      await exportTemplate("template-a", deps);
      await exportTemplate("template-b", deps);

      const templates = await listTemplates(deps);
      expect(templates).toContain("template-a");
      expect(templates).toContain("template-b");
    });
  });
});

describe("workflow import from session", () => {
  describe("listSessions", () => {
    test("returns sessions with reminders", async () => {
      const deps1 = { ...createTestDeps(), sessionId: "session-a" };
      const deps2 = { ...createTestDeps(), sessionId: "session-b" };

      await addReminder("reminder a", deps1);
      await addReminder("reminder b", deps2);

      const sessions = await listSessions(createTestDeps());
      expect(sessions).toContain("session-a");
      expect(sessions).toContain("session-b");
    });
  });

  describe("importFromSession", () => {
    test("copies reminders from another session", async () => {
      const sourceDeps = { ...createTestDeps(), sessionId: "source-session" };
      await addReminder("source reminder 1", sourceDeps);
      await addReminder("source reminder 2", sourceDeps);

      const targetDeps = { ...createTestDeps(), sessionId: "target-session" };
      await importFromSession("source-session", targetDeps);

      const reminders = await listReminders(targetDeps);
      expect(reminders).toEqual(["source reminder 1", "source reminder 2"]);
    });

    test("throws on non-existent session", async () => {
      const deps = createTestDeps();
      await expect(importFromSession("non-existent", deps)).rejects.toThrow(
        "Session not found"
      );
    });
  });
});

describe("workflow unblock-stop", () => {
  describe("setUnblockStopCount", () => {
    test("sets unblock count in storage", async () => {
      const deps = createTestDeps();
      await setUnblockStopCount(3, deps);

      const count = await getUnblockStopCount(deps);
      expect(count).toBe(3);
    });

    test("overwrites previous count", async () => {
      const deps = createTestDeps();
      await setUnblockStopCount(5, deps);
      await setUnblockStopCount(2, deps);

      const count = await getUnblockStopCount(deps);
      expect(count).toBe(2);
    });

    test("validates count is positive integer", async () => {
      const deps = createTestDeps();
      await expect(setUnblockStopCount(-1, deps)).rejects.toThrow(
        "Count must be a positive integer"
      );
      await expect(setUnblockStopCount(0, deps)).rejects.toThrow(
        "Count must be a positive integer"
      );
      await expect(setUnblockStopCount(1.5, deps)).rejects.toThrow(
        "Count must be a positive integer"
      );
    });
  });

  describe("getUnblockStopCount", () => {
    test("returns 0 when no count set", async () => {
      const deps = createTestDeps();
      const count = await getUnblockStopCount(deps);
      expect(count).toBe(0);
    });

    test("returns 0 when storage file doesn't exist", async () => {
      const deps = { ...createTestDeps(), sessionId: "nonexistent-session" };
      const count = await getUnblockStopCount(deps);
      expect(count).toBe(0);
    });
  });

  describe("decrementUnblockStopCount", () => {
    test("decrements count by 1", async () => {
      const deps = createTestDeps();
      await setUnblockStopCount(3, deps);
      await decrementUnblockStopCount(deps);

      const count = await getUnblockStopCount(deps);
      expect(count).toBe(2);
    });

    test("does not go below 0", async () => {
      const deps = createTestDeps();
      await setUnblockStopCount(1, deps);
      await decrementUnblockStopCount(deps);
      await decrementUnblockStopCount(deps);

      const count = await getUnblockStopCount(deps);
      expect(count).toBe(0);
    });

    test("works when no count was set", async () => {
      const deps = createTestDeps();
      await decrementUnblockStopCount(deps);

      const count = await getUnblockStopCount(deps);
      expect(count).toBe(0);
    });
  });

  describe("storage integration", () => {
    test("unblock count coexists with reminders", async () => {
      const deps = createTestDeps();
      await addReminder("test reminder", deps);
      await setUnblockStopCount(2, deps);

      const reminders = await listReminders(deps);
      const count = await getUnblockStopCount(deps);

      expect(reminders).toEqual(["test reminder"]);
      expect(count).toBe(2);
    });

    test("clearReminders does not affect unblock count", async () => {
      const deps = createTestDeps();
      await addReminder("test reminder", deps);
      await setUnblockStopCount(2, deps);
      await clearReminders(deps);

      const reminders = await listReminders(deps);
      const count = await getUnblockStopCount(deps);

      expect(reminders).toEqual([]);
      expect(count).toBe(2);
    });
  });
});
