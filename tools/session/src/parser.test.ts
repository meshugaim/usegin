import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parseEntries, parseSession } from "./parser";
import type { Entry } from "./types";
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
