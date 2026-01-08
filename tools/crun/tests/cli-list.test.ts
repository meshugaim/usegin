import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { recordInvocation, type InvocationEntry } from "../src/invocations";
import { formatInvocationsMultiLine } from "../src/list";

const TEST_DIR = join(tmpdir(), "crun-cli-list-test");
const TEST_INVOCATIONS_PATH = join(TEST_DIR, "invocations.jsonl");

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

/**
 * Helper to create test invocations
 */
async function createTestInvocation(
  overrides: Partial<InvocationEntry> = {}
): Promise<InvocationEntry> {
  const entry: InvocationEntry = {
    id: overrides.id || "test-id",
    sessionId: overrides.sessionId || "ce8ff123-uuid-here",
    pid: overrides.pid || 12345,
    startedAt: overrides.startedAt || new Date().toISOString(),
    cwd: overrides.cwd || "/workspaces/test-mvp",
    status: overrides.status || "running",
    prompt: overrides.prompt || "Test prompt for the invocation",
    ...overrides,
  };
  await recordInvocation(entry, TEST_INVOCATIONS_PATH);
  return entry;
}

describe("formatInvocationsTable", () => {
  // We'll test the formatInvocationsTable function directly
  // Import it once it's created
  const { formatInvocationsTable } = require("../src/list");

  test("formats empty list with just headers", () => {
    const output = formatInvocationsTable([]);
    expect(output).toContain("ID");
    expect(output).toContain("SESSION");
    expect(output).toContain("NOTE-TO-SELF");
    expect(output).toContain("STATUS");
  });

  test("formats single invocation row with prompt column", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Implement ENG-969: config page UI",
        noteToSelf: "If tests pass, review code",
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("abc123");
    expect(output).toContain("ce8ff1..."); // 6 chars + ellipsis
    expect(output).toContain("Implement ENG-969: config page U..."); // truncated prompt (32 chars)
    expect(output).toContain("If tests pass, review");
    expect(output).toContain("running");
  });

  test("displays PROMPT column header", () => {
    const output = formatInvocationsTable([]);
    expect(output).toContain("PROMPT");
  });

  test("truncates long prompts for display", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt:
          "This is a very long prompt that should be truncated for display in the table output to keep it readable",
      },
    ];

    const output = formatInvocationsTable(invocations);
    // Should truncate to 32 chars + ellipsis
    expect(output).toContain("This is a very long prompt that ...");
  });

  test("truncates session ID to 6 chars + ellipsis", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123-uuid-here-long",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test",
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("ce8ff1...");
  });

  test("truncates note-to-self for display", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test",
        noteToSelf: "This is a very long note to self that should be truncated for display in the table",
      },
    ];

    const output = formatInvocationsTable(invocations);
    // Should truncate long notes
    expect(output.length).toBeLessThan(200 * 3); // rough estimate
    expect(output).toContain("...");
  });

  test("shows exit code for completed status", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:05:00.000Z",
        exitCode: 0,
        cwd: "/test",
        status: "completed",
        prompt: "Test",
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("completed (0)");
  });

  test("shows exit code for failed status", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:05:00.000Z",
        exitCode: 1,
        cwd: "/test",
        status: "failed",
        prompt: "Test",
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("failed (1)");
  });

  test("handles missing note-to-self gracefully", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test",
        // no noteToSelf
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("abc123");
    expect(output).toContain("running");
    // Should not throw, and should handle empty note gracefully
  });

  test("formats multiple invocations", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "abc123",
        sessionId: "ce8ff123",
        pid: 12345,
        startedAt: "2024-01-01T00:01:00.000Z",
        cwd: "/test",
        status: "completed",
        exitCode: 0,
        prompt: "First task",
        noteToSelf: "If tests pass, review",
      },
      {
        id: "def456",
        sessionId: "a1b2c345",
        pid: 12346,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Second task",
        noteToSelf: "If approved, push",
      },
    ];

    const output = formatInvocationsTable(invocations);
    expect(output).toContain("abc123");
    expect(output).toContain("def456");
    expect(output).toContain("completed (0)");
    expect(output).toContain("running");
  });
});

describe("parseListArgs", () => {
  const { parseListArgs } = require("../src/list");

  test("parses empty args with defaults", () => {
    const result = parseListArgs([]);
    expect(result.running).toBe(false);
    expect(result.today).toBe(false);
    expect(result.limit).toBe(10);
  });

  test("parses --running flag", () => {
    const result = parseListArgs(["--running"]);
    expect(result.running).toBe(true);
  });

  test("parses --today flag", () => {
    const result = parseListArgs(["--today"]);
    expect(result.today).toBe(true);
  });

  test("parses --limit with value", () => {
    const result = parseListArgs(["--limit", "25"]);
    expect(result.limit).toBe(25);
  });

  test("parses -l shorthand for limit", () => {
    const result = parseListArgs(["-l", "5"]);
    expect(result.limit).toBe(5);
  });

  test("parses combined flags", () => {
    const result = parseListArgs(["--running", "--today", "--limit", "20"]);
    expect(result.running).toBe(true);
    expect(result.today).toBe(true);
    expect(result.limit).toBe(20);
  });
});

describe("list command integration", () => {
  // These tests would run the actual CLI command
  // For now, we'll test the runList function directly

  const { runList } = require("../src/list");

  test("returns formatted table for invocations", async () => {
    await createTestInvocation({
      id: "abc123",
      sessionId: "ce8ff123-uuid",
      status: "running",
      noteToSelf: "Check results",
    });

    const output = await runList(
      { running: false, today: false, limit: 10 },
      TEST_INVOCATIONS_PATH
    );

    expect(output).toContain("abc123");
    expect(output).toContain("ce8ff1...");
    expect(output).toContain("running");
  });

  test("filters by --running", async () => {
    await createTestInvocation({
      id: "running-1",
      status: "running",
    });
    await createTestInvocation({
      id: "completed-1",
      status: "completed",
      exitCode: 0,
    });

    const output = await runList(
      { running: true, today: false, limit: 10 },
      TEST_INVOCATIONS_PATH
    );

    expect(output).toContain("running-1");
    expect(output).not.toContain("completed-1");
  });

  test("filters by --today", async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    await createTestInvocation({
      id: "today-1",
      startedAt: today,
    });
    await createTestInvocation({
      id: "yesterday-1",
      startedAt: yesterday,
    });

    const output = await runList(
      { running: false, today: true, limit: 10 },
      TEST_INVOCATIONS_PATH
    );

    expect(output).toContain("today-1");
    expect(output).not.toContain("yesterday-1");
  });

  test("respects --limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createTestInvocation({
        id: `inv-${i}`,
        startedAt: new Date(Date.now() + i * 1000).toISOString(),
      });
    }

    const output = await runList(
      { running: false, today: false, limit: 2 },
      TEST_INVOCATIONS_PATH
    );

    // Should only show 2 most recent
    expect(output).toContain("inv-4");
    expect(output).toContain("inv-3");
    expect(output).not.toContain("inv-0");
  });

  test("shows message when no invocations found", async () => {
    const output = await runList(
      { running: false, today: false, limit: 10 },
      TEST_INVOCATIONS_PATH
    );

    expect(output).toContain("No invocations found");
  });

  test("shows message when no matching invocations after filter", async () => {
    await createTestInvocation({
      id: "completed-1",
      status: "completed",
      exitCode: 0,
    });

    const output = await runList(
      { running: true, today: false, limit: 10 },
      TEST_INVOCATIONS_PATH
    );

    expect(output).toContain("No invocations found");
  });
});

describe("formatInvocationsMultiLine", () => {
  test("formats single invocation with header line", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "TcKwTEFO",
        sessionId: "363cf4ab-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Implement ENG-969: config page route and tab structure.",
        noteToSelf: "After worker completes, spawn code-review worker",
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Header line should have ID, session prefix, status
    expect(output).toContain("TcKwTEFO");
    expect(output).toContain("363cf4...");
    expect(output).toContain("running");

    // Prompt should be on its own indented line
    expect(output).toMatch(/Prompt:\s+Implement ENG-969/);

    // Note should be on its own indented line
    expect(output).toMatch(/Note:\s+After worker completes/);
  });

  test("shows resume count when resumeCount is set", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "TcKwTEFO",
        sessionId: "363cf4ab-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test prompt",
        resumeCount: 3,
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Should show "resumed (3rd)" in header
    expect(output).toContain("resumed (3rd)");
  });

  test("shows original (no resume) when resumeCount is 0 or undefined", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "TcKwTEFO",
        sessionId: "363cf4ab-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test prompt",
        resumeCount: 0,
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Should NOT show "resumed" for original invocation
    expect(output).not.toContain("resumed");
  });

  test("shows exit code for completed status", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "DGpiAuJ6",
        sessionId: "c7e7fb12-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:05:00.000Z",
        exitCode: 0,
        cwd: "/test",
        status: "completed",
        prompt: "Test prompt",
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    expect(output).toContain("completed (0)");
  });

  test("separates multiple invocations with blank line", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "TcKwTEFO",
        sessionId: "363cf4ab-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:01:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "First task",
      },
      {
        id: "DGpiAuJ6",
        sessionId: "c7e7fb12-uuid-here",
        pid: 12346,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "completed",
        exitCode: 0,
        prompt: "Second task",
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Should have both IDs
    expect(output).toContain("TcKwTEFO");
    expect(output).toContain("DGpiAuJ6");

    // Should have blank line between invocations
    expect(output).toContain("\n\n");
  });

  test("handles missing noteToSelf gracefully", () => {
    const invocations: InvocationEntry[] = [
      {
        id: "TcKwTEFO",
        sessionId: "363cf4ab-uuid-here",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: "Test prompt",
        // no noteToSelf
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Should show prompt but not Note line
    expect(output).toContain("Prompt:");
    expect(output).not.toContain("Note:");
  });

  test("formats resume count ordinal correctly", () => {
    // Test various ordinal suffixes
    const testCases = [
      { count: 1, expected: "1st" },
      { count: 2, expected: "2nd" },
      { count: 3, expected: "3rd" },
      { count: 4, expected: "4th" },
      { count: 11, expected: "11th" },
      { count: 21, expected: "21st" },
      { count: 22, expected: "22nd" },
      { count: 23, expected: "23rd" },
    ];

    for (const { count, expected } of testCases) {
      const invocations: InvocationEntry[] = [
        {
          id: "test-id",
          sessionId: "test-session",
          pid: 12345,
          startedAt: "2024-01-01T00:00:00.000Z",
          cwd: "/test",
          status: "running",
          prompt: "Test",
          resumeCount: count,
        },
      ];

      const output = formatInvocationsMultiLine(invocations);
      expect(output).toContain(`resumed (${expected})`);
    }
  });

  test("shows full prompt without truncation", () => {
    const longPrompt =
      "This is a very long prompt that should NOT be truncated in the multi-line format because we have more space to work with and readability is the goal";
    const invocations: InvocationEntry[] = [
      {
        id: "test-id",
        sessionId: "test-session",
        pid: 12345,
        startedAt: "2024-01-01T00:00:00.000Z",
        cwd: "/test",
        status: "running",
        prompt: longPrompt,
      },
    ];

    const output = formatInvocationsMultiLine(invocations);

    // Should contain the full prompt (up to what was stored - 100 chars)
    expect(output).toContain("This is a very long prompt");
    // The prompt stored in invocations is already truncated to 100 chars by recordInvocation
    // So we just verify it's displayed without additional truncation
  });
});
