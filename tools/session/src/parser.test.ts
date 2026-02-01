import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parseEntries, parseSession, listRelatedFiles, isWarmupSubagent } from "./parser";
import type { Entry, ParsedSubagent } from "./types";
import { asSessionId, asAgentId, asEntryUuid, asToolUseId } from "./types";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeSubagent, userTurn, assistantTurn, toolCall, toolResult } from "./testing";

describe("parseEntries", () => {
  test("parses system init entry", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "abc",
        session_id: "session-1",
        cwd: "/workspaces/test",
        tools: ["Read", "Write"],
        model: "claude-sonnet",
      },
    ];

    const result = parseEntries(entries);

    expect(result.sessionId).toBe("session-1");
    expect(result.cwd).toBe("/workspaces/test");
    expect(result.model).toBe("claude-sonnet");
    expect(result.tools).toEqual(["Read", "Write"]);
  });

  test("parses user text message", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello world" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.role).toBe("user");
    expect(result.turns[0]?.text).toBe("Hello world");
  });

  test("parses assistant with tool calls", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Let me read that file" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "Read",
              input: { file_path: "/test.ts" },
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.text).toBe("Let me read that file");
    expect(result.turns[0]?.toolCalls).toHaveLength(1);
    expect(result.turns[0]?.toolCalls[0]?.name).toBe("Read");
    expect(result.turns[0]?.toolCalls[0]?.input).toEqual({ file_path: "/test.ts" });
  });

  test("parses tool results in user message", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "file contents here",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.toolResults).toHaveLength(1);
    expect(result.turns[0]?.toolResults[0]?.content).toBe("file contents here");
    expect(result.turns[0]?.toolResults[0]?.isError).toBe(false);
  });

  test("parses result entry", () => {
    const entries: Entry[] = [
      {
        type: "result",
        subtype: "success",
        uuid: "r1",
        session_id: "s1",
        result: "Done",
        duration_ms: 5000,
        total_cost_usd: 0.05,
      },
    ];

    const result = parseEntries(entries);

    expect(result.result?.success).toBe(true);
    expect(result.result?.durationMs).toBe(5000);
    expect(result.result?.costUsd).toBe(0.05);
  });

  test("handles string content format", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: "Plain string content",
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns[0]?.text).toBe("Plain string content");
  });

  test("extracts sessionId from entries without system init", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        sessionId: "session-from-entry", // Note: sessionId not session_id
        message: {
          role: "user",
          content: "Hello",
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.sessionId).toBe("session-from-entry");
  });

  test("initializes empty subagents array", () => {
    const entries: Entry[] = [];
    const result = parseEntries(entries);

    expect(result.subagents).toEqual([]);
  });

  test("initializes empty triggeredSkills array", () => {
    const entries: Entry[] = [];
    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual([]);
  });
});

describe("skill detection", () => {
  test("extracts skill name from Skill tool call", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "I'll use the spec writing skill" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: { skill: "writing-specs" },
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual(["writing-specs"]);
  });

  test("extracts multiple skills from different turns", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: { skill: "writing-specs" },
            },
          ],
        },
      },
      {
        type: "assistant",
        uuid: "a2",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-2",
              name: "Skill",
              input: { skill: "implementing-specs" },
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual(["writing-specs", "implementing-specs"]);
  });

  test("deduplicates repeated skill invocations", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: { skill: "writing-specs" },
            },
          ],
        },
      },
      {
        type: "assistant",
        uuid: "a2",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-2",
              name: "Skill",
              input: { skill: "writing-specs" }, // Same skill again
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual(["writing-specs"]);
  });

  test("ignores non-Skill tool calls", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Read",
              input: { file_path: "/test.ts" },
            },
            {
              type: "tool_use",
              id: "tool-2",
              name: "Grep",
              input: { pattern: "test" },
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual([]);
  });

  test("handles Skill tool call without skill input gracefully", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: {}, // Missing skill field
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.triggeredSkills).toEqual([]);
  });
});

// Test fixtures for file-based tests
const TEST_DIR = "/tmp/session-parser-test";
const SESSION_ID = "test-session-12345678";

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
    expect(session.subagents[0]?.agentId).toBe("agent-abc123");
    expect(session.subagents[0]?.turns).toHaveLength(2);
    expect(session.subagents[0]?.startTimestamp).toBe("2025-01-01T10:00:00.000Z");
  });

  test("excludes subagents from other sessions", async () => {
    const session = await parseSession(join(TEST_DIR, `${SESSION_ID}.jsonl`), {
      includeSubagents: true,
    });

    // Should only have agent-abc123, not agent-other
    expect(session.subagents).toHaveLength(1);
    expect(session.subagents[0]?.agentId).toBe("agent-abc123");
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
    expect(session.subagents[0]?.agentId).toBe("agent-real");
  });

  test("includes warmup subagents when includeWarmups is true", async () => {
    const session = await parseSession(join(WARMUP_TEST_DIR, `${WARMUP_SESSION_ID}.jsonl`), {
      includeSubagents: true,
      includeWarmups: true,
    });

    expect(session.subagents).toHaveLength(2);
    const agentIds = session.subagents.map((s) => s.agentId);
    expect(agentIds).toContain("agent-warmup");
    expect(agentIds).toContain("agent-real");
  });
});

describe("parseSession with debug option", () => {
  const DEBUG_TEST_DIR = "/tmp/session-parser-debug-test";
  const DEBUG_SESSION_ID = "debug-test-session";

  beforeAll(async () => {
    await mkdir(DEBUG_TEST_DIR, { recursive: true });

    const mainSession = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: DEBUG_SESSION_ID,
        cwd: "/test",
        tools: ["Read"],
        model: "claude",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: DEBUG_SESSION_ID,
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), mainSession);
  });

  afterAll(async () => {
    await rm(DEBUG_TEST_DIR, { recursive: true, force: true });
  });

  test("accepts debug option without error", async () => {
    const session = await parseSession(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), {
      debug: true,
    });

    expect(session.sessionId).toBe(DEBUG_SESSION_ID);
    expect(session.turns).toHaveLength(1);
  });

  test("works normally with debug disabled", async () => {
    const session = await parseSession(join(DEBUG_TEST_DIR, `${DEBUG_SESSION_ID}.jsonl`), {
      debug: false,
    });

    expect(session.sessionId).toBe(DEBUG_SESSION_ID);
  });
});

describe("parseSession malformed JSONL handling", () => {
  const MALFORMED_TEST_DIR = "/tmp/session-parser-malformed-test";

  beforeAll(async () => {
    await mkdir(MALFORMED_TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(MALFORMED_TEST_DIR, { recursive: true, force: true });
  });

  test("skips lines with invalid JSON", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "malformed-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      "{invalid json line",
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "malformed-test",
        message: { role: "user", content: "Hello" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "invalid-json.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "invalid-json.jsonl"));

    expect(session.sessionId).toBe("malformed-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Hello");
  });

  test("skips entries with unknown type", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "unknown-type-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      JSON.stringify({
        type: "unknown_type_xyz",
        uuid: "unknown1",
        session_id: "unknown-type-test",
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "unknown-type-test",
        message: { role: "user", content: "Valid message" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "unknown-type.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "unknown-type.jsonl"));

    expect(session.sessionId).toBe("unknown-type-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Valid message");
  });

  test("skips entries with missing type field", async () => {
    const content = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "missing-type-test",
        cwd: "/test",
        tools: [],
        model: "claude",
      }),
      JSON.stringify({
        uuid: "no-type",
        session_id: "missing-type-test",
        message: { role: "user", content: "No type field" },
      }),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        session_id: "missing-type-test",
        message: { role: "user", content: "Has type field" },
      }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "missing-type.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "missing-type.jsonl"));

    expect(session.sessionId).toBe("missing-type-test");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.text).toBe("Has type field");
  });

  test("handles file with all invalid entries", async () => {
    const content = [
      "{invalid json",
      JSON.stringify({ uuid: "no-type" }),
      JSON.stringify({ type: "unknown" }),
    ].join("\n");

    await writeFile(join(MALFORMED_TEST_DIR, "all-invalid.jsonl"), content);

    const session = await parseSession(join(MALFORMED_TEST_DIR, "all-invalid.jsonl"));

    expect(session.sessionId).toBe("");
    expect(session.turns).toHaveLength(0);
  });

  test("handles empty file", async () => {
    await writeFile(join(MALFORMED_TEST_DIR, "empty.jsonl"), "");

    const session = await parseSession(join(MALFORMED_TEST_DIR, "empty.jsonl"));

    expect(session.sessionId).toBe("");
    expect(session.turns).toHaveLength(0);
  });
});
