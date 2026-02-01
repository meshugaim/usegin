import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parseEntries, parseSession, listRelatedFiles, isWarmupSubagent, extractCommitsFromToolResult } from "./parser";
import type { Entry, ParsedSubagent } from "./types";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
    const warmup: ParsedSubagent = {
      agentId: "warmup-agent",
      sessionId: "test-session",
      turns: [
        {
          role: "assistant",
          text: "I'll start by exploring the codebase to understand its structure.",
          toolCalls: [],
          toolResults: [],
        },
      ],
    };

    expect(isWarmupSubagent(warmup)).toBe(true);
  });

  test("detects warmup with tool_use in text but no results", () => {
    // Some warmups have <function_calls> in their text but never got results
    const warmup: ParsedSubagent = {
      agentId: "warmup-agent",
      sessionId: "test-session",
      turns: [
        {
          role: "assistant",
          text: "I'll start exploring.\n<function_calls>\n...",
          toolCalls: [{ id: "t1", name: "Glob", input: {} }],
          toolResults: [],
        },
      ],
    };

    expect(isWarmupSubagent(warmup)).toBe(true);
  });

  test("real subagent with tool results is not a warmup", () => {
    const realSubagent: ParsedSubagent = {
      agentId: "real-agent",
      sessionId: "test-session",
      turns: [
        {
          role: "assistant",
          text: "Let me search for that.",
          toolCalls: [{ id: "t1", name: "Grep", input: { pattern: "test" } }],
          toolResults: [],
        },
        {
          role: "user",
          text: "",
          toolCalls: [],
          toolResults: [{ toolUseId: "t1", content: "found results", isError: false }],
        },
        {
          role: "assistant",
          text: "I found the results.",
          toolCalls: [],
          toolResults: [],
        },
      ],
    };

    expect(isWarmupSubagent(realSubagent)).toBe(false);
  });

  test("subagent with many turns is not a warmup", () => {
    const manyTurns: ParsedSubagent = {
      agentId: "many-turns-agent",
      sessionId: "test-session",
      turns: [
        { role: "assistant", text: "Turn 1", toolCalls: [], toolResults: [] },
        { role: "user", text: "Turn 2", toolCalls: [], toolResults: [] },
        { role: "assistant", text: "Turn 3", toolCalls: [], toolResults: [] },
      ],
    };

    expect(isWarmupSubagent(manyTurns)).toBe(false);
  });
});

describe("rewind detection", () => {
  test("detects linear conversation with no rewinds", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi there" },
      },
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "How are you?" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "I'm good!" },
      },
    ];

    const result = parseEntries(entries);

    expect(result.rewinds).toEqual([]);
    expect(result.turns.every((t) => t.isOnCurrentBranch)).toBe(true);
  });

  test("detects rewind when parentUuid jumps back", () => {
    const entries: Entry[] = [
      // Initial conversation
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi there" },
      },
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "What is 2+2?" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "4" },
      },
      // REWIND: new message points back to a1, not a2
      {
        type: "user",
        uuid: "u3",
        parentUuid: "a1", // <-- rewind point
        session_id: "s1",
        message: { role: "user", content: "What is 3+3?" },
      },
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u3",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "6" },
      },
    ];

    const result = parseEntries(entries);

    // Should detect one rewind
    expect(result.rewinds).toHaveLength(1);
    expect(result.rewinds[0]).toEqual({
      fromUuid: "a1",
      abandonedBranchUuids: ["u2", "a2"],
    });

    // Abandoned branch messages should be marked
    const u2Turn = result.turns.find((t) => t.uuid === "u2");
    const a2Turn = result.turns.find((t) => t.uuid === "a2");
    expect(u2Turn?.isOnCurrentBranch).toBe(false);
    expect(a2Turn?.isOnCurrentBranch).toBe(false);

    // Current branch messages should be marked
    const u3Turn = result.turns.find((t) => t.uuid === "u3");
    const a3Turn = result.turns.find((t) => t.uuid === "a3");
    expect(u3Turn?.isOnCurrentBranch).toBe(true);
    expect(a3Turn?.isOnCurrentBranch).toBe(true);
  });

  test("handles multiple rewinds", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Start" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Response 1" },
      },
      // First branch (abandoned)
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "Branch 1" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Branch 1 response" },
      },
      // First rewind
      {
        type: "user",
        uuid: "u3",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "Branch 2" },
      },
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u3",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Branch 2 response" },
      },
      // Second branch continued then abandoned
      {
        type: "user",
        uuid: "u4",
        parentUuid: "a3",
        session_id: "s1",
        message: { role: "user", content: "Continue branch 2" },
      },
      // Second rewind - back to a3
      {
        type: "user",
        uuid: "u5",
        parentUuid: "a3",
        session_id: "s1",
        message: { role: "user", content: "Branch 3" },
      },
      {
        type: "assistant",
        uuid: "a5",
        parentUuid: "u5",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Final response" },
      },
    ];

    const result = parseEntries(entries);

    expect(result.rewinds).toHaveLength(2);

    // First branch (u2, a2) should not be on current branch
    expect(result.turns.find((t) => t.uuid === "u2")?.isOnCurrentBranch).toBe(false);
    expect(result.turns.find((t) => t.uuid === "a2")?.isOnCurrentBranch).toBe(false);

    // u4 should not be on current branch (abandoned in second rewind)
    expect(result.turns.find((t) => t.uuid === "u4")?.isOnCurrentBranch).toBe(false);

    // Current branch: u1, a1, u3, a3, u5, a5
    expect(result.turns.find((t) => t.uuid === "u1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u3")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a3")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u5")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a5")?.isOnCurrentBranch).toBe(true);
  });

  test("handles entries without parentUuid (legacy format)", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi" },
      },
    ];

    const result = parseEntries(entries);

    // Should work without errors, assume linear
    expect(result.rewinds).toEqual([]);
    expect(result.turns.every((t) => t.isOnCurrentBranch)).toBe(true);
  });

  test("handles cycles in parent chain without hanging", () => {
    // This reproduces a bug found in Claude Code 2.1.27+ where new entry types
    // (progress, saved_hook_context) can form cycles in the parent chain.
    // The parser must detect cycles and break instead of looping forever.
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi" },
      },
      // Simulate a progress entry that creates a cycle: a1 -> hook1 -> a1
      {
        type: "system",
        subtype: "init",
        uuid: "hook1",
        parentUuid: "a1",
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude",
      } as Entry,
      {
        type: "user",
        uuid: "u2",
        parentUuid: "hook1",
        session_id: "s1",
        message: { role: "user", content: "Continue" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Ok" },
      },
    ];

    // Add a cycle: make hook1's parent point to a2 (which descends from hook1)
    // This creates: a2 -> u2 -> hook1 -> a2 (cycle!)
    (entries[2] as any).parentUuid = "a2";

    // This should complete without hanging (timeout would indicate failure)
    const result = parseEntries(entries);

    // Basic sanity check - we parsed the turns
    expect(result.turns).toHaveLength(4);
    // The parser should handle the cycle gracefully
    expect(result.sessionId).toBe("s1");
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

describe("StreamingParser", () => {
  test("parses single complete line", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    const output = parser.feed(line + "\n");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("USER:");
    expect(output[0]).toContain("Hello");
  });

  test("buffers incomplete lines", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    // Feed partial line
    const output1 = parser.feed(line.slice(0, 20));
    expect(output1).toHaveLength(0);

    // Feed rest of line + newline
    const output2 = parser.feed(line.slice(20) + "\n");
    expect(output2).toHaveLength(1);
    expect(output2[0]).toContain("Hello");
  });

  test("parses multiple lines in one chunk", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line1 = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "First" },
    });
    const line2 = JSON.stringify({
      type: "assistant",
      uuid: "a1",
      session_id: "s1",
      message: { role: "assistant", model: "claude", content: "Second" },
    });

    const output = parser.feed(line1 + "\n" + line2 + "\n");

    expect(output).toHaveLength(2);
    expect(output[0]).toContain("First");
    expect(output[1]).toContain("Second");
  });

  test("end() flushes remaining buffer", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Final" },
    });

    // Feed without trailing newline
    parser.feed(line);
    const output = parser.end();

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Final");
  });

  test("skips system entries", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const systemLine = JSON.stringify({
      type: "system",
      subtype: "init",
      uuid: "sys1",
      session_id: "s1",
      cwd: "/test",
      tools: ["Read"],
      model: "claude",
    });
    const userLine = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    const output = parser.feed(systemLine + "\n" + userLine + "\n");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Hello");
  });
});

describe("extractCommitsFromToolResult", () => {
  test("extracts commit hash from standard git commit output", () => {
    const content = "[main abc1234] fix: some bug";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("abc1234");
    expect(commits[0]?.message).toBe("fix: some bug");
  });

  test("extracts commit from branch with slash", () => {
    const content = "[wt/ENG-123 def5678] feat: add feature";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("def5678");
    expect(commits[0]?.message).toBe("feat: add feature");
  });

  test("extracts commit from multiline output", () => {
    const content = `[wt/ENG-295 315fca6] feat(plan-cli): allow titles to wrap
 2 files changed, 168 insertions(+), 4 deletions(-)
✓ Autosync: Pushed to origin/main`;
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("315fca6");
    expect(commits[0]?.message).toBe("feat(plan-cli): allow titles to wrap");
  });

  test("extracts multiple commits from output", () => {
    const content = `[main abc1234] first commit
[main def5678] second commit`;
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.hash).toBe("abc1234");
    expect(commits[1]?.hash).toBe("def5678");
  });

  test("returns empty array when no commits found", () => {
    const content = "On branch main\nnothing to commit";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toEqual([]);
  });

  test("handles full 40-char commit hash", () => {
    const content = "[main 1234567890abcdef1234567890abcdef12345678] long hash";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("1234567890abcdef1234567890abcdef12345678");
  });

  test("ignores short hashes (less than 7 chars)", () => {
    // Git hashes are at least 7 characters
    const content = "[main abc123] too short";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toEqual([]);
  });
});

describe("commit detection in parseEntries", () => {
  test("extracts commits from tool results", () => {
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
              content: "[main abc1234] fix: some bug\n 1 file changed, 5 insertions(+)",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[0]?.message).toBe("fix: some bug");
  });

  test("extracts multiple commits from session", () => {
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
              content: "[main abc1234] first commit",
              is_error: false,
            },
          ],
        },
      },
      {
        type: "user",
        uuid: "u2",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-2",
              content: "[main def5678] second commit",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[1]?.hash).toBe("def5678");
  });

  test("deduplicates commits by hash", () => {
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
              content: "[main abc1234] some commit",
              is_error: false,
            },
          ],
        },
      },
      {
        type: "user",
        uuid: "u2",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-2",
              content: "[main abc1234] same commit hash", // Same hash, different message
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
  });

  test("ignores tool results without git output", () => {
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

    expect(result.commits).toEqual([]);
  });

  test("initializes empty commits array", () => {
    const entries: Entry[] = [];
    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
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
