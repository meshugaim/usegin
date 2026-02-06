import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parseSession, listRelatedFiles, isWarmupSubagent } from "./parser";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeSubagent, userTurn, assistantTurn, toolCall, toolResult } from "./testing";
import { asSessionId, asAgentId } from "./types";

// Test fixtures for file-based tests
const TEST_DIR = "/tmp/session-parser-test";
const SESSION_ID = asSessionId("test-session-12345678");

describe("parseSession with subagents", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });

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

    await writeFile(join(TEST_DIR, `${SESSION_ID}.jsonl`), mainSession);

    // Create subagent file that belongs to this session (with tool results so not a warmup)
    const subagent1 = [
      JSON.stringify({
        type: "assistant",
        uuid: "a1",
        sessionId: SESSION_ID,
        agentId: "agent-abc123",
        timestamp: "2025-01-01T10:00:00.000Z",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Let me search" },
            { type: "tool_use", id: "t1", name: "Grep", input: { pattern: "test" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u2",
        sessionId: SESSION_ID,
        agentId: "agent-abc123",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "found it" }],
        },
      }),
    ].join("\n");

    await writeFile(join(TEST_DIR, "agent-abc123.jsonl"), subagent1);

    // Create subagent file for a DIFFERENT session (should not be included)
    const otherSubagent = [
      JSON.stringify({
        type: "assistant",
        uuid: "a2",
        sessionId: "other-session",
        agentId: "agent-other",
        timestamp: "2025-01-01T11:00:00.000Z",
        message: { role: "assistant", model: "claude", content: "Other session" },
      }),
    ].join("\n");

    await writeFile(join(TEST_DIR, "agent-other.jsonl"), otherSubagent);
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("parses session without subagents by default", async () => {
    const session = await parseSession(join(TEST_DIR, `${SESSION_ID}.jsonl`));

    expect(session.sessionId).toBe(SESSION_ID);
    expect(session.subagents).toEqual([]);
  });

  test("discovers and parses subagents when includeSubagents is true", async () => {
    const session = await parseSession(join(TEST_DIR, `${SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    expect(session.sessionId).toBe(SESSION_ID);
    expect(session.subagents).toHaveLength(1);
    expect(session.subagents[0]?.agentId).toBe(asAgentId("agent-abc123"));
    expect(session.subagents[0]?.turns).toHaveLength(2);
    expect(session.subagents[0]?.startTimestamp).toBe("2025-01-01T10:00:00.000Z");
  });

  test("excludes subagents from other sessions", async () => {
    const session = await parseSession(join(TEST_DIR, `${SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    // Should only have agent-abc123, not agent-other
    expect(session.subagents).toHaveLength(1);
    expect(session.subagents[0]?.agentId).toBe(asAgentId("agent-abc123"));
  });
});

describe("listRelatedFiles", () => {
  const LIST_FILES_DIR = "/tmp/session-parser-list-files-test";
  const LIST_SESSION_ID = "list-test-session";

  beforeAll(async () => {
    await mkdir(LIST_FILES_DIR, { recursive: true });

    // Create main session file
    const mainSession = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: LIST_SESSION_ID,
      message: { role: "user", content: "Hello" },
    });
    await writeFile(join(LIST_FILES_DIR, `${LIST_SESSION_ID}.jsonl`), mainSession);

    // Create subagent file that belongs to this session
    const subagent = JSON.stringify({
      type: "assistant",
      uuid: "a1",
      sessionId: LIST_SESSION_ID,
      agentId: "agent-list-test",
      message: { role: "assistant", model: "claude", content: "Response" },
    });
    await writeFile(join(LIST_FILES_DIR, "agent-list-test.jsonl"), subagent);

    // Create subagent for different session
    const otherSubagent = JSON.stringify({
      type: "assistant",
      uuid: "a2",
      sessionId: "other-session",
      agentId: "agent-other",
      message: { role: "assistant", model: "claude", content: "Other" },
    });
    await writeFile(join(LIST_FILES_DIR, "agent-other.jsonl"), otherSubagent);
  });

  afterAll(async () => {
    await rm(LIST_FILES_DIR, { recursive: true, force: true });
  });

  test("lists main file and related subagent files", async () => {
    const files = await listRelatedFiles(join(LIST_FILES_DIR, `${LIST_SESSION_ID}.jsonl`));

    expect(files).toContain(join(LIST_FILES_DIR, `${LIST_SESSION_ID}.jsonl`));
    expect(files).toContain(join(LIST_FILES_DIR, "agent-list-test.jsonl"));
    expect(files).not.toContain(join(LIST_FILES_DIR, "agent-other.jsonl"));
  });

  test("returns only main file when no subagents exist", async () => {
    // Create isolated test file
    const isolatedDir = join(LIST_FILES_DIR, "isolated");
    await mkdir(isolatedDir, { recursive: true });

    const isolatedSession = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "isolated-session",
      message: { role: "user", content: "Hello" },
    });

    await writeFile(join(isolatedDir, "isolated-session.jsonl"), isolatedSession);

    const files = await listRelatedFiles(join(isolatedDir, "isolated-session.jsonl"));

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("isolated-session.jsonl");
  });
});

describe("isWarmupSubagent", () => {
  test("detects warmup subagent (single message, no tool results)", () => {
    const warmup = makeSubagent("warmup-agent", [
      assistantTurn("a1", "I'll start by exploring the codebase to understand its structure."),
    ]);

    expect(isWarmupSubagent(warmup)).toBe(true);
  });

  test("detects warmup with tool_use in text but no results", () => {
    // Some warmups have <function_calls> in their text but never got results
    const warmup = makeSubagent("warmup-agent", [
      assistantTurn("a1", "I'll start exploring.\n<function_calls>\n...", {
        toolCalls: [toolCall("t1", "Glob", {})],
      }),
    ]);

    expect(isWarmupSubagent(warmup)).toBe(true);
  });

  test("real subagent with tool results is not a warmup", () => {
    const realSubagent = makeSubagent("real-agent", [
      assistantTurn("a1", "Let me search for that.", {
        toolCalls: [toolCall("t1", "Grep", { pattern: "test" })],
      }),
      userTurn("u1", "", {
        toolResults: [toolResult("t1", "found results")],
      }),
      assistantTurn("a2", "I found the results."),
    ]);

    expect(isWarmupSubagent(realSubagent)).toBe(false);
  });

  test("subagent with many turns is not a warmup", () => {
    const manyTurns = makeSubagent("many-turns-agent", [
      assistantTurn("a1", "Turn 1"),
      userTurn("u1", "Turn 2"),
      assistantTurn("a2", "Turn 3"),
    ]);

    expect(isWarmupSubagent(manyTurns)).toBe(false);
  });
});

describe("parseSession warmup filtering", () => {
  const WARMUP_TEST_DIR = "/tmp/session-parser-warmup-test";
  const WARMUP_SESSION_ID = "warmup-test-session";

  beforeAll(async () => {
    await mkdir(WARMUP_TEST_DIR, { recursive: true });

    // Create main session file
    const mainSession = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: WARMUP_SESSION_ID,
        cwd: "/test",
        tools: ["Read"],
        model: "claude",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: WARMUP_SESSION_ID,
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(WARMUP_TEST_DIR, `${WARMUP_SESSION_ID}.jsonl`), mainSession);

    // Create warmup subagent (single message, no tool results)
    const warmupSubagent = JSON.stringify({
      type: "assistant",
      uuid: "a1",
      sessionId: WARMUP_SESSION_ID,
      agentId: "agent-warmup",
      timestamp: "2025-01-01T10:00:00.000Z",
      message: {
        role: "assistant",
        model: "claude",
        content: [{ type: "text", text: "I'll start exploring the codebase." }],
      },
    });

    await writeFile(join(WARMUP_TEST_DIR, "agent-warmup.jsonl"), warmupSubagent);

    // Create real subagent (has tool results)
    const realSubagent = [
      JSON.stringify({
        type: "assistant",
        uuid: "a2",
        sessionId: WARMUP_SESSION_ID,
        agentId: "agent-real",
        timestamp: "2025-01-01T11:00:00.000Z",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Let me search." },
            { type: "tool_use", id: "t1", name: "Grep", input: { pattern: "test" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u2",
        sessionId: WARMUP_SESSION_ID,
        agentId: "agent-real",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "found results" },
          ],
        },
      }),
    ].join("\n");

    await writeFile(join(WARMUP_TEST_DIR, "agent-real.jsonl"), realSubagent);
  });

  afterAll(async () => {
    await rm(WARMUP_TEST_DIR, { recursive: true, force: true });
  });

  test("excludes warmup subagents by default", async () => {
    const session = await parseSession(join(WARMUP_TEST_DIR, `${WARMUP_SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    expect(session.subagents).toHaveLength(1);
    expect(session.subagents[0]?.agentId).toBe(asAgentId("agent-real"));
  });

  test("includes warmup subagents when includeWarmups is true", async () => {
    const session = await parseSession(join(WARMUP_TEST_DIR, `${WARMUP_SESSION_ID}.jsonl`), {
      includeSubagents: true,
      includeWarmups: true,
    });

    expect(session.subagents).toHaveLength(2);
    const agentIds = session.subagents.map((s) => s.agentId);
    expect(agentIds).toContain(asAgentId("agent-warmup"));
    expect(agentIds).toContain(asAgentId("agent-real"));
  });
});

describe("discoverSubagents with nested subagents directory", () => {
  const NESTED_TEST_DIR = "/tmp/session-parser-nested-subagents-test";
  const NESTED_SESSION_ID = asSessionId("nested-test-session-abcd1234");

  beforeAll(async () => {
    // Create the directory structure matching the NEW Claude Code layout:
    //   tmpdir/
    //     nested-test-session-abcd1234.jsonl        <- main session
    //     nested-test-session-abcd1234/              <- directory named after session
    //       subagents/                               <- subagents subdirectory
    //         agent-abc1234.jsonl                    <- subagent file
    //         agent-def5678.jsonl                    <- another subagent
    const subagentsDir = join(NESTED_TEST_DIR, NESTED_SESSION_ID, "subagents");
    await mkdir(subagentsDir, { recursive: true });

    // Create main session file
    const mainSession = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: NESTED_SESSION_ID,
        cwd: "/test",
        tools: ["Read"],
        model: "claude",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: NESTED_SESSION_ID,
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(NESTED_TEST_DIR, `${NESTED_SESSION_ID}.jsonl`), mainSession);

    // Create first subagent in the nested subagents directory
    const subagent1 = [
      JSON.stringify({
        type: "assistant",
        uuid: "a1",
        sessionId: NESTED_SESSION_ID,
        agentId: "agent-abc1234",
        timestamp: "2025-01-01T10:00:00.000Z",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Let me search for that." },
            { type: "tool_use", id: "t1", name: "Grep", input: { pattern: "test" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u2",
        sessionId: NESTED_SESSION_ID,
        agentId: "agent-abc1234",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "found results" }],
        },
      }),
    ].join("\n");

    await writeFile(join(subagentsDir, "agent-abc1234.jsonl"), subagent1);

    // Create second subagent in the nested subagents directory
    const subagent2 = [
      JSON.stringify({
        type: "assistant",
        uuid: "a3",
        sessionId: NESTED_SESSION_ID,
        agentId: "agent-def5678",
        timestamp: "2025-01-01T11:00:00.000Z",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Reading the file now." },
            { type: "tool_use", id: "t2", name: "Read", input: { file_path: "/foo.ts" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u3",
        sessionId: NESTED_SESSION_ID,
        agentId: "agent-def5678",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t2", content: "file contents here" }],
        },
      }),
    ].join("\n");

    await writeFile(join(subagentsDir, "agent-def5678.jsonl"), subagent2);
  });

  afterAll(async () => {
    await rm(NESTED_TEST_DIR, { recursive: true, force: true });
  });

  test("discovers subagents in <sessionId>/subagents/ directory", async () => {
    const session = await parseSession(join(NESTED_TEST_DIR, `${NESTED_SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    expect(session.sessionId).toBe(NESTED_SESSION_ID);
    expect(session.subagents).toHaveLength(2);

    const agentIds = session.subagents.map((s) => s.agentId).sort();
    expect(agentIds).toContain(asAgentId("agent-abc1234"));
    expect(agentIds).toContain(asAgentId("agent-def5678"));
  });

  test("subagents from nested directory have correct timestamps", async () => {
    const session = await parseSession(join(NESTED_TEST_DIR, `${NESTED_SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    // Sorted by startTimestamp, so abc1234 (10:00) comes before def5678 (11:00)
    expect(session.subagents[0]?.agentId).toBe(asAgentId("agent-abc1234"));
    expect(session.subagents[0]?.startTimestamp).toBe("2025-01-01T10:00:00.000Z");
    expect(session.subagents[1]?.agentId).toBe(asAgentId("agent-def5678"));
    expect(session.subagents[1]?.startTimestamp).toBe("2025-01-01T11:00:00.000Z");
  });

  test("listRelatedFiles finds files in nested subagents directory", async () => {
    const files = await listRelatedFiles(join(NESTED_TEST_DIR, `${NESTED_SESSION_ID}.jsonl`));

    // Should include the main file plus both subagent files from the nested directory
    expect(files).toContain(join(NESTED_TEST_DIR, `${NESTED_SESSION_ID}.jsonl`));
    expect(files).toContain(
      join(NESTED_TEST_DIR, NESTED_SESSION_ID, "subagents", "agent-abc1234.jsonl")
    );
    expect(files).toContain(
      join(NESTED_TEST_DIR, NESTED_SESSION_ID, "subagents", "agent-def5678.jsonl")
    );
    expect(files).toHaveLength(3);
  });
});
