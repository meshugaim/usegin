import { describe, test, expect, beforeEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  addReminder,
  listReminders,
  clearReminders,
  removeReminder,
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
