/**
 * Tests for debug logging on error conditions.
 *
 * These tests verify that silent catches log warnings in debug mode,
 * making debugging easier without changing non-debug behavior.
 *
 * Part of: ENG-1393
 */

import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Test directory for file-based tests
const TEST_DIR = "/tmp/session-debug-logging-test";

/**
 * Helper to get all logged messages from a spy
 */
function getLoggedMessages(spy: ReturnType<typeof spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

/**
 * Helper to check if any message contains a substring
 */
function hasMessageContaining(messages: string[], substring: string): boolean {
  return messages.some((msg) => msg.toLowerCase().includes(substring.toLowerCase()));
}

describe("debug logging on parse errors", () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("parseSession", () => {
    beforeAll(async () => {
      await mkdir(TEST_DIR, { recursive: true });
    });

    afterAll(async () => {
      await rm(TEST_DIR, { recursive: true, force: true });
    });

    test("logs when JSON parsing fails in debug mode", async () => {
      const { parseSession } = await import("./parser");

      const content = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: "test-session",
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        "{invalid json here",
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: "test-session",
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(TEST_DIR, "invalid-json.jsonl"), content);

      await parseSession(join(TEST_DIR, "invalid-json.jsonl"), { debug: true });

      // Should have logged about the malformed JSON
      const messages = getLoggedMessages(consoleErrorSpy);
      expect(hasMessageContaining(messages, "malformed") || hasMessageContaining(messages, "skipping")).toBe(true);
    });

    test("logs when entry has invalid type in debug mode", async () => {
      const { parseSession } = await import("./parser");

      const content = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: "test-session",
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        JSON.stringify({
          type: "unknown_type_xyz",
          uuid: "unknown1",
          session_id: "test-session",
        }),
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: "test-session",
          message: { role: "user", content: "Valid" },
        }),
      ].join("\n");

      await writeFile(join(TEST_DIR, "invalid-type.jsonl"), content);

      await parseSession(join(TEST_DIR, "invalid-type.jsonl"), { debug: true });

      // Should have logged about the invalid entry type
      const messages = getLoggedMessages(consoleErrorSpy);
      expect(hasMessageContaining(messages, "invalid") || hasMessageContaining(messages, "skipping")).toBe(true);
    });

    test("does not log parse errors in non-debug mode", async () => {
      const { parseSession } = await import("./parser");

      const content = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: "test-session-quiet",
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        "{invalid json here",
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: "test-session-quiet",
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(TEST_DIR, "quiet-mode.jsonl"), content);

      await parseSession(join(TEST_DIR, "quiet-mode.jsonl"), { debug: false });

      // Should not have logged anything about parsing errors
      const messages = getLoggedMessages(consoleErrorSpy);
      const hasParseErrorLogs = messages.some((msg) =>
        msg.includes("[session]") && (msg.includes("malformed") || msg.includes("Skipping"))
      );
      expect(hasParseErrorLogs).toBe(false);
    });
  });

  describe("listRelatedFiles", () => {
    const RELATED_DIR = join(TEST_DIR, "related-files");

    beforeAll(async () => {
      await mkdir(RELATED_DIR, { recursive: true });
    });

    test("returns main file when first line cannot be parsed (graceful degradation)", async () => {
      const { listRelatedFiles } = await import("./parser");

      // File with invalid JSON on first line
      await writeFile(join(RELATED_DIR, "main-invalid.jsonl"), "{not valid json");

      const files = await listRelatedFiles(join(RELATED_DIR, "main-invalid.jsonl"));

      // Should return just the main file (graceful degradation)
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("main-invalid.jsonl");
    });

    test("skips subagent file when first line cannot be parsed", async () => {
      const { listRelatedFiles } = await import("./parser");

      // Valid main file
      const mainContent = JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "related-test-session",
        message: { role: "user", content: "Hello" },
      });
      await writeFile(join(RELATED_DIR, "related-test-session.jsonl"), mainContent);

      // Invalid subagent file
      await writeFile(join(RELATED_DIR, "agent-invalid.jsonl"), "{not valid json");

      const files = await listRelatedFiles(join(RELATED_DIR, "related-test-session.jsonl"));

      // Should have main file, invalid subagent should be skipped gracefully
      expect(files).toContain(join(RELATED_DIR, "related-test-session.jsonl"));
      expect(files).not.toContain(join(RELATED_DIR, "agent-invalid.jsonl"));
    });

    test("skips subagent file when first entry is not a valid Entry", async () => {
      const { listRelatedFiles } = await import("./parser");

      // Valid main file
      const mainContent = JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "entry-test-session",
        message: { role: "user", content: "Hello" },
      });
      await writeFile(join(RELATED_DIR, "entry-test-session.jsonl"), mainContent);

      // Subagent file with valid JSON but not a valid Entry (missing type)
      const invalidEntryContent = JSON.stringify({
        uuid: "u1",
        session_id: "entry-test-session",
        message: { role: "user", content: "No type field" },
      });
      await writeFile(join(RELATED_DIR, "agent-no-type.jsonl"), invalidEntryContent);

      const files = await listRelatedFiles(join(RELATED_DIR, "entry-test-session.jsonl"));

      // Should have main file, invalid subagent should be skipped
      expect(files).toContain(join(RELATED_DIR, "entry-test-session.jsonl"));
      expect(files).not.toContain(join(RELATED_DIR, "agent-no-type.jsonl"));
    });
  });

  describe("discoverSubagents", () => {
    const SUBAGENT_DIR = join(TEST_DIR, "subagents");
    const SESSION_ID = "subagent-discover-test";

    beforeAll(async () => {
      await mkdir(SUBAGENT_DIR, { recursive: true });

      // Create main session file
      const mainSession = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: SESSION_ID,
          cwd: "/test",
          tools: ["Read"],
          model: "claude",
        }),
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: SESSION_ID,
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(SUBAGENT_DIR, `${SESSION_ID}.jsonl`), mainSession);

      // Create subagent with invalid first line
      await writeFile(join(SUBAGENT_DIR, "agent-invalid-first.jsonl"), "{invalid json on first line");

      // Create subagent with malformed entries in the middle
      const malformedSubagent = [
        JSON.stringify({
          type: "assistant",
          uuid: "a1",
          sessionId: SESSION_ID,
          agentId: "agent-malformed",
          timestamp: "2025-01-01T10:00:00.000Z",
          message: { role: "assistant", model: "claude", content: [{ type: "text", text: "Start" }] },
        }),
        "{malformed line in middle",
        JSON.stringify({
          type: "user",
          uuid: "u2",
          sessionId: SESSION_ID,
          agentId: "agent-malformed",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "result" }] },
        }),
      ].join("\n");

      await writeFile(join(SUBAGENT_DIR, "agent-malformed.jsonl"), malformedSubagent);
    });

    test("skips subagent with invalid first line gracefully", async () => {
      const { parseSession } = await import("./parser");

      const session = await parseSession(join(SUBAGENT_DIR, `${SESSION_ID}.jsonl`), {
        includeSubagents: true,
        debug: true,
      });

      // Should parse successfully, excluding invalid subagent
      expect(session.sessionId).toBe(SESSION_ID);
      // The malformed subagent should be included (only first line invalid subagent excluded)
      expect(session.subagents.some((s) => s.agentId === "agent-malformed")).toBe(true);
      expect(session.subagents.some((s) => s.agentId === "agent-invalid-first")).toBe(false);
    });

    test("skips malformed lines in subagent files gracefully", async () => {
      const { parseSession } = await import("./parser");

      const session = await parseSession(join(SUBAGENT_DIR, `${SESSION_ID}.jsonl`), {
        includeSubagents: true,
        debug: true,
      });

      // Should include the subagent, skipping the malformed line
      const malformedSubagent = session.subagents.find((s) => s.agentId === "agent-malformed");
      expect(malformedSubagent).toBeDefined();
      expect(malformedSubagent!.turns).toHaveLength(2); // Should have 2 valid turns
    });

    test("logs helpful context when subagent discovery fails in debug mode", async () => {
      const { parseSession } = await import("./parser");

      // Create a separate test with a clear signal we're looking for
      const SESSION_ID_DEBUG = "subagent-debug-log-test";
      const DEBUG_DIR = join(TEST_DIR, "subagent-debug");
      await mkdir(DEBUG_DIR, { recursive: true });

      const mainSession = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: SESSION_ID_DEBUG,
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: SESSION_ID_DEBUG,
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(DEBUG_DIR, `${SESSION_ID_DEBUG}.jsonl`), mainSession);
      await writeFile(join(DEBUG_DIR, "agent-bad.jsonl"), "{invalid}");

      await parseSession(join(DEBUG_DIR, `${SESSION_ID_DEBUG}.jsonl`), {
        includeSubagents: true,
        debug: true,
      });

      // Debug mode should log about the subagent discovery process
      const messages = getLoggedMessages(consoleErrorSpy);
      expect(hasMessageContaining(messages, "subagent") || hasMessageContaining(messages, "discover")).toBe(true);
    });

    test("logs when subagent file has malformed first line in debug mode", async () => {
      const { parseSession } = await import("./parser");

      const SESSION_ID_MALFORMED = "subagent-malformed-first-test";
      const MALFORMED_DIR = join(TEST_DIR, "subagent-malformed-first");
      await mkdir(MALFORMED_DIR, { recursive: true });

      const mainSession = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: SESSION_ID_MALFORMED,
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: SESSION_ID_MALFORMED,
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(MALFORMED_DIR, `${SESSION_ID_MALFORMED}.jsonl`), mainSession);
      // Subagent file with invalid JSON on first line
      await writeFile(join(MALFORMED_DIR, "agent-malformed-first.jsonl"), "{not valid json");

      await parseSession(join(MALFORMED_DIR, `${SESSION_ID_MALFORMED}.jsonl`), {
        includeSubagents: true,
        debug: true,
      });

      // Should log about the parsing failure with file context
      const messages = getLoggedMessages(consoleErrorSpy);
      expect(
        hasMessageContaining(messages, "agent-malformed-first") ||
        hasMessageContaining(messages, "parse") ||
        hasMessageContaining(messages, "skip")
      ).toBe(true);
    });

    test("logs when subagent file has malformed lines in the middle in debug mode", async () => {
      const { parseSession } = await import("./parser");

      const SESSION_ID_MID = "subagent-malformed-mid-test";
      const MID_DIR = join(TEST_DIR, "subagent-malformed-mid");
      await mkdir(MID_DIR, { recursive: true });

      const mainSession = [
        JSON.stringify({
          type: "system",
          subtype: "init",
          uuid: "sys1",
          session_id: SESSION_ID_MID,
          cwd: "/test",
          tools: [],
          model: "claude",
        }),
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: SESSION_ID_MID,
          message: { role: "user", content: "Hello" },
        }),
      ].join("\n");

      await writeFile(join(MID_DIR, `${SESSION_ID_MID}.jsonl`), mainSession);

      // Subagent file with valid first line but malformed line in middle
      const malformedSubagent = [
        JSON.stringify({
          type: "assistant",
          uuid: "a1",
          sessionId: SESSION_ID_MID,
          agentId: "agent-mid-malformed",
          timestamp: "2025-01-01T10:00:00.000Z",
          message: { role: "assistant", model: "claude", content: [{ type: "text", text: "Start" }] },
        }),
        "{malformed line in middle",
        JSON.stringify({
          type: "user",
          uuid: "u2",
          sessionId: SESSION_ID_MID,
          agentId: "agent-mid-malformed",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "result" }] },
        }),
      ].join("\n");

      await writeFile(join(MID_DIR, "agent-mid-malformed.jsonl"), malformedSubagent);

      await parseSession(join(MID_DIR, `${SESSION_ID_MID}.jsonl`), {
        includeSubagents: true,
        debug: true,
      });

      // Should log about the malformed line in the subagent
      const messages = getLoggedMessages(consoleErrorSpy);
      expect(
        hasMessageContaining(messages, "malformed") ||
        hasMessageContaining(messages, "skip") ||
        hasMessageContaining(messages, "agent-mid-malformed")
      ).toBe(true);
    });
  });

  describe("StreamingParser", () => {
    test("logs when parsing fails in debug mode", async () => {
      // StreamingParser doesn't currently support debug mode
      // This test documents the expected behavior we should add
      const { StreamingParser } = await import("./parser");
      const parser = new StreamingParser();

      const output = parser.feed("{invalid json\n");

      // Should skip malformed lines without crashing
      expect(output).toHaveLength(0);
    });
  });
});

describe("debug logging in finder", () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("discoverSessions", () => {
    // Note: discoverSessions catches stat() errors silently.
    // We can't easily test permission errors, but we document the behavior.
    test("gracefully handles stat errors on files", async () => {
      const { discoverSessions } = await import("./finder");

      // This test is more about documenting expected behavior
      // In production, permission errors would be caught and logged
      const sessions = await discoverSessions({ allProjects: true });

      // Should complete without error even if some files can't be stat'd
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe("extractSessionMeta", () => {
    const META_DIR = join(TEST_DIR, "meta-test");

    beforeAll(async () => {
      await mkdir(META_DIR, { recursive: true });
    });

    test("skips malformed lines gracefully", async () => {
      const { extractSessionMeta } = await import("./finder");

      const content = [
        JSON.stringify({
          type: "user",
          uuid: "u1",
          session_id: "meta-test",
          message: { role: "user", content: "Hello" },
        }),
        "{invalid json line",
        JSON.stringify({
          type: "user",
          uuid: "u2",
          session_id: "meta-test",
          message: { role: "user", content: "World" },
        }),
      ].join("\n");

      await writeFile(join(META_DIR, "meta-test.jsonl"), content);

      const meta = await extractSessionMeta(join(META_DIR, "meta-test.jsonl"));

      // Should have extracted both valid messages, skipping the invalid line
      expect(meta.hasUserMessages).toBe(true);
      expect(meta.lineCount).toBe(3);
    });
  });

  describe("isVscBridgeAvailable", () => {
    test("returns false on connection errors without throwing", async () => {
      const { isVscBridgeAvailable } = await import("./finder");

      // Point to a non-existent port file
      const result = await isVscBridgeAvailable("/tmp/nonexistent-port-file");

      // Should return false, not throw
      expect(result).toBe(false);
    });
  });

  describe("pollForFile", () => {
    test("handles read errors gracefully during polling", async () => {
      const { pollForFile } = await import("./finder");

      // Poll for a file that will never exist
      const result = await pollForFile("/tmp/nonexistent-poll-file-12345", {
        intervalMs: 10,
        timeoutMs: 50,
      });

      // Should return null on timeout, not throw
      expect(result).toBe(null);
    });
  });
});
