import { test, expect, describe } from "bun:test";
import { parseEntries } from "./parser";
import { asSessionId, type Entry } from "./types";

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

    expect(result.sessionId).toBe(asSessionId("session-1"));
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

    expect(result.sessionId).toBe(asSessionId("session-from-entry"));
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
