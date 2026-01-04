import { describe, test, expect, beforeEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  addReminder,
  listReminders,
  clearReminders,
  removeReminder,
  exportTemplate,
  importTemplate,
  listTemplates,
  importFromSession,
  listSessions,
  type WorkflowDeps,
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
