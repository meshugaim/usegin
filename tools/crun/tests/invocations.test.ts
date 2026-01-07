import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  recordInvocation,
  updateInvocation,
  listInvocations,
  generateInvocationId,
  getInvocationsPath,
  type InvocationEntry,
  type InvocationStatus,
} from "../src/invocations";

const TEST_DIR = join(tmpdir(), "crun-invocations-test");
const TEST_INVOCATIONS_PATH = join(TEST_DIR, "invocations.jsonl");

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("InvocationEntry types", () => {
  test("InvocationEntry has required fields", () => {
    const entry: InvocationEntry = {
      id: "abc123",
      sessionId: "session-uuid",
      pid: 12345,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/workspaces/test",
      status: "running",
      prompt: "Test prompt",
    };

    expect(entry.id).toBe("abc123");
    expect(entry.sessionId).toBe("session-uuid");
    expect(entry.pid).toBe(12345);
    expect(entry.startedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(entry.cwd).toBe("/workspaces/test");
    expect(entry.status).toBe("running");
    expect(entry.prompt).toBe("Test prompt");
  });

  test("InvocationEntry supports optional fields", () => {
    const entry: InvocationEntry = {
      id: "abc123",
      sessionId: "session-uuid",
      pid: 12345,
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:05:00.000Z",
      exitCode: 0,
      noteToSelf: "If tests pass, merge",
      cwd: "/workspaces/test",
      status: "completed",
      prompt: "Test prompt",
    };

    expect(entry.completedAt).toBe("2024-01-01T00:05:00.000Z");
    expect(entry.exitCode).toBe(0);
    expect(entry.noteToSelf).toBe("If tests pass, merge");
  });

  test("InvocationStatus union type", () => {
    const running: InvocationStatus = "running";
    const completed: InvocationStatus = "completed";
    const failed: InvocationStatus = "failed";

    expect(running).toBe("running");
    expect(completed).toBe("completed");
    expect(failed).toBe("failed");
  });
});

describe("generateInvocationId", () => {
  test("generates short ID (6-8 chars)", () => {
    const id = generateInvocationId();
    expect(id.length).toBeGreaterThanOrEqual(6);
    expect(id.length).toBeLessThanOrEqual(8);
  });

  test("generates URL-safe characters", () => {
    const id = generateInvocationId();
    // nanoid uses A-Za-z0-9_- by default
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateInvocationId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("recordInvocation", () => {
  test("appends entry to JSONL file", async () => {
    const entry: InvocationEntry = {
      id: "test-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Test prompt",
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);

    const content = await Bun.file(TEST_INVOCATIONS_PATH).text();
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.id).toBe("test-id");
    expect(parsed.sessionId).toBe("session-123");
  });

  test("creates directory if it does not exist", async () => {
    const nestedPath = join(TEST_DIR, "nested", "dir", "invocations.jsonl");
    const entry: InvocationEntry = {
      id: "test-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Test",
    };

    await recordInvocation(entry, nestedPath);

    const content = await Bun.file(nestedPath).text();
    expect(content).toContain("test-id");
  });

  test("appends to existing file", async () => {
    const entry1: InvocationEntry = {
      id: "id-1",
      sessionId: "session-1",
      pid: 1,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "First",
    };
    const entry2: InvocationEntry = {
      id: "id-2",
      sessionId: "session-2",
      pid: 2,
      startedAt: "2024-01-01T00:01:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Second",
    };

    await recordInvocation(entry1, TEST_INVOCATIONS_PATH);
    await recordInvocation(entry2, TEST_INVOCATIONS_PATH);

    const content = await Bun.file(TEST_INVOCATIONS_PATH).text();
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  test("truncates long prompts to ~100 chars", async () => {
    const longPrompt = "x".repeat(200);
    const entry: InvocationEntry = {
      id: "test-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: longPrompt,
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);

    const content = await Bun.file(TEST_INVOCATIONS_PATH).text();
    const parsed = JSON.parse(content.trim());
    expect(parsed.prompt.length).toBeLessThanOrEqual(103); // 100 + "..."
    expect(parsed.prompt).toContain("...");
  });
});

describe("updateInvocation", () => {
  test("appends update entry with same ID", async () => {
    const entry: InvocationEntry = {
      id: "test-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Test",
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);
    await updateInvocation(
      "test-id",
      {
        completedAt: "2024-01-01T00:05:00.000Z",
        exitCode: 0,
        status: "completed",
      },
      TEST_INVOCATIONS_PATH
    );

    const content = await Bun.file(TEST_INVOCATIONS_PATH).text();
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const update = JSON.parse(lines[1]);
    expect(update.id).toBe("test-id");
    expect(update.completedAt).toBe("2024-01-01T00:05:00.000Z");
    expect(update.exitCode).toBe(0);
    expect(update.status).toBe("completed");
  });

  test("allows partial updates", async () => {
    await updateInvocation(
      "test-id",
      { exitCode: 1, status: "failed" },
      TEST_INVOCATIONS_PATH
    );

    const content = await Bun.file(TEST_INVOCATIONS_PATH).text();
    const parsed = JSON.parse(content.trim());
    expect(parsed.id).toBe("test-id");
    expect(parsed.exitCode).toBe(1);
    expect(parsed.status).toBe("failed");
  });
});

describe("listInvocations", () => {
  test("returns empty array when file does not exist", async () => {
    const result = await listInvocations({}, TEST_INVOCATIONS_PATH);
    expect(result).toEqual([]);
  });

  test("returns empty array for empty file", async () => {
    await Bun.write(TEST_INVOCATIONS_PATH, "");
    const result = await listInvocations({}, TEST_INVOCATIONS_PATH);
    expect(result).toEqual([]);
  });

  test("deduplicates by ID with latest entry winning", async () => {
    const entry1: InvocationEntry = {
      id: "test-id",
      sessionId: "session-123",
      pid: 1234,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Test",
    };

    await recordInvocation(entry1, TEST_INVOCATIONS_PATH);
    await updateInvocation(
      "test-id",
      {
        completedAt: "2024-01-01T00:05:00.000Z",
        exitCode: 0,
        status: "completed",
      },
      TEST_INVOCATIONS_PATH
    );

    const result = await listInvocations({}, TEST_INVOCATIONS_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("test-id");
    expect(result[0].status).toBe("completed");
    expect(result[0].exitCode).toBe(0);
    // Original fields should be preserved
    expect(result[0].sessionId).toBe("session-123");
    expect(result[0].startedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  test("filters by running status", async () => {
    const running: InvocationEntry = {
      id: "running-1",
      sessionId: "s1",
      pid: 1,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Running",
    };
    const completed: InvocationEntry = {
      id: "completed-1",
      sessionId: "s2",
      pid: 2,
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:05:00.000Z",
      exitCode: 0,
      cwd: "/test",
      status: "completed",
      prompt: "Completed",
    };

    await recordInvocation(running, TEST_INVOCATIONS_PATH);
    await recordInvocation(completed, TEST_INVOCATIONS_PATH);

    const result = await listInvocations({ running: true }, TEST_INVOCATIONS_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("running-1");
  });

  test("filters by today", async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const todayEntry: InvocationEntry = {
      id: "today-1",
      sessionId: "s1",
      pid: 1,
      startedAt: today,
      cwd: "/test",
      status: "running",
      prompt: "Today",
    };
    const yesterdayEntry: InvocationEntry = {
      id: "yesterday-1",
      sessionId: "s2",
      pid: 2,
      startedAt: yesterday,
      cwd: "/test",
      status: "running",
      prompt: "Yesterday",
    };

    await recordInvocation(yesterdayEntry, TEST_INVOCATIONS_PATH);
    await recordInvocation(todayEntry, TEST_INVOCATIONS_PATH);

    const result = await listInvocations({ today: true }, TEST_INVOCATIONS_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("today-1");
  });

  test("limits results", async () => {
    for (let i = 0; i < 10; i++) {
      await recordInvocation(
        {
          id: `id-${i}`,
          sessionId: `s${i}`,
          pid: i,
          startedAt: `2024-01-01T00:0${i}:00.000Z`,
          cwd: "/test",
          status: "running",
          prompt: `Prompt ${i}`,
        },
        TEST_INVOCATIONS_PATH
      );
    }

    const result = await listInvocations({ limit: 5 }, TEST_INVOCATIONS_PATH);
    expect(result).toHaveLength(5);
  });

  test("returns most recent first", async () => {
    await recordInvocation(
      {
        id: "old",
        sessionId: "s1",
        pid: 1,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Old",
      },
      TEST_INVOCATIONS_PATH
    );
    await recordInvocation(
      {
        id: "new",
        sessionId: "s2",
        pid: 2,
        startedAt: "2024-01-02T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "New",
      },
      TEST_INVOCATIONS_PATH
    );

    const result = await listInvocations({}, TEST_INVOCATIONS_PATH);
    expect(result[0].id).toBe("new");
    expect(result[1].id).toBe("old");
  });

  test("combines multiple filters", async () => {
    const today = new Date().toISOString();

    await recordInvocation(
      {
        id: "running-today",
        sessionId: "s1",
        pid: 1,
        startedAt: today,
        cwd: "/test",
        status: "running",
        prompt: "Running today",
      },
      TEST_INVOCATIONS_PATH
    );
    await recordInvocation(
      {
        id: "completed-today",
        sessionId: "s2",
        pid: 2,
        startedAt: today,
        cwd: "/test",
        status: "completed",
        prompt: "Completed today",
      },
      TEST_INVOCATIONS_PATH
    );
    await recordInvocation(
      {
        id: "running-yesterday",
        sessionId: "s3",
        pid: 3,
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        cwd: "/test",
        status: "running",
        prompt: "Running yesterday",
      },
      TEST_INVOCATIONS_PATH
    );

    const result = await listInvocations(
      { running: true, today: true },
      TEST_INVOCATIONS_PATH
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("running-today");
  });

  test("handles malformed JSON lines gracefully", async () => {
    const entry: InvocationEntry = {
      id: "valid",
      sessionId: "s1",
      pid: 1,
      startedAt: "2024-01-01T00:00:00.000Z",
      cwd: "/test",
      status: "running",
      prompt: "Valid",
    };

    await recordInvocation(entry, TEST_INVOCATIONS_PATH);
    // Append malformed JSON
    await Bun.write(TEST_INVOCATIONS_PATH,
      (await Bun.file(TEST_INVOCATIONS_PATH).text()) + "not valid json\n"
    );

    const result = await listInvocations({}, TEST_INVOCATIONS_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("valid");
  });
});

describe("getInvocationsPath", () => {
  test("returns default path in ~/.crun/", () => {
    const path = getInvocationsPath();
    expect(path).toContain(".crun");
    expect(path).toContain("invocations.jsonl");
  });
});
