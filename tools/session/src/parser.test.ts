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

  test("extracts cwd from entry fields when no system/init exists", () => {
    // Modern Claude Code sessions may not have a system/init entry,
    // but user/assistant/progress entries include a cwd field.
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:00.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
        // cwd is not in the UserEntry type definition, but exists at runtime
        // on real session entries — the parser uses a Record<string, unknown> cast
      } as Entry,
    ];

    // Inject cwd on the raw entry (simulating real session data)
    (entries[0] as unknown as Record<string, unknown>).cwd = "/workspaces/test-mvp";

    const result = parseEntries(entries);

    expect(result.cwd).toBe("/workspaces/test-mvp");
  });

  test("extracts cwd from progress entry when it appears first", () => {
    const entries: Entry[] = [
      {
        type: "progress",
        uuid: "p1",
        sessionId: "s1",
        timestamp: "2025-01-15T10:00:00.000Z",
      } as Entry,
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:01.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      } as Entry,
    ];

    // Inject cwd on both entries (progress has it, user has it)
    (entries[0] as unknown as Record<string, unknown>).cwd = "/workspaces/test-mvp";
    (entries[1] as unknown as Record<string, unknown>).cwd = "/workspaces/test-mvp";

    const result = parseEntries(entries);

    expect(result.cwd).toBe("/workspaces/test-mvp");
  });

  test("system/init cwd takes precedence over entry cwd fields", () => {
    // If a system/init entry exists, its cwd should be used (it's set in the switch case)
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      } as Entry,
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        cwd: "/from/system/init",
        tools: [],
        model: "claude-sonnet",
      },
    ];

    // User entry also has cwd, but system/init should win
    (entries[0] as unknown as Record<string, unknown>).cwd = "/from/user/entry";

    const result = parseEntries(entries);

    // The user entry cwd is captured first (since it appears first),
    // but system/init overwrites it
    expect(result.cwd).toBe("/from/system/init");
  });

  test("propagates timestamp from user entry to turn", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        timestamp: "2025-01-15T10:30:00.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.timestamp).toBe("2025-01-15T10:30:00.000Z");
  });

  test("propagates timestamp from assistant entry to turn", () => {
    const entries: Entry[] = [
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        timestamp: "2025-01-15T10:30:05.000Z",
        message: {
          role: "assistant",
          model: "claude",
          content: [{ type: "text", text: "Hi there" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.timestamp).toBe("2025-01-15T10:30:05.000Z");
  });

  test("turn timestamp is undefined when entry has no timestamp", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.timestamp).toBeUndefined();
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

describe("session timestamps", () => {
  test("captures startTimestamp from first entry and endTimestamp from last entry", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:00.000Z",
        cwd: "/test",
        tools: [],
        model: "claude-sonnet",
      },
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:05.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:10.000Z",
        message: {
          role: "assistant",
          model: "claude-sonnet",
          content: [{ type: "text", text: "Hi!" }],
        },
      },
      {
        type: "result",
        subtype: "success",
        uuid: "r1",
        session_id: "s1",
        timestamp: "2025-01-15T10:05:00.000Z",
        result: "Done",
        duration_ms: 5000,
      },
    ];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBe("2025-01-15T10:00:00.000Z");
    expect(result.endTimestamp).toBe("2025-01-15T10:05:00.000Z");
  });

  test("returns undefined timestamps when no entries have timestamps", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude-sonnet",
      },
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBeUndefined();
    expect(result.endTimestamp).toBeUndefined();
  });

  test("handles single entry with timestamp", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:00.000Z",
        cwd: "/test",
        tools: [],
        model: "claude-sonnet",
      },
    ];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBe("2025-01-15T10:00:00.000Z");
    expect(result.endTimestamp).toBe("2025-01-15T10:00:00.000Z");
  });

  test("skips entries without timestamps for start but tracks last seen", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        // No timestamp on system entry
        cwd: "/test",
        tools: [],
        model: "claude-sonnet",
      },
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:05.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        timestamp: "2025-01-15T10:00:10.000Z",
        message: {
          role: "assistant",
          model: "claude-sonnet",
          content: [{ type: "text", text: "Hi!" }],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBe("2025-01-15T10:00:05.000Z");
    expect(result.endTimestamp).toBe("2025-01-15T10:00:10.000Z");
  });

  test("returns undefined timestamps for empty entries", () => {
    const entries: Entry[] = [];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBeUndefined();
    expect(result.endTimestamp).toBeUndefined();
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

describe("tool result content normalization", () => {
  test("normalizes Task tool array content to string", () => {
    // Task tool returns content as array: [{type: "text", text: "..."}]
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
              // @ts-expect-error - Testing runtime behavior for array content
              content: [
                { type: "text", text: "First paragraph." },
                { type: "text", text: "Second paragraph." },
              ],
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.toolResults).toHaveLength(1);
    // Content should be normalized to a string with blocks joined by newlines
    expect(result.turns[0]?.toolResults[0]?.content).toBe(
      "First paragraph.\nSecond paragraph."
    );
  });

  test("preserves plain string content", () => {
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
              content: "Plain string result from Read/Bash/etc",
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns[0]?.toolResults[0]?.content).toBe(
      "Plain string result from Read/Bash/etc"
    );
  });

  test("handles single-item Task tool array content", () => {
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
              // @ts-expect-error - Testing runtime behavior for array content
              content: [{ type: "text", text: "Single response from subagent." }],
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns[0]?.toolResults[0]?.content).toBe(
      "Single response from subagent."
    );
  });

  test("handles empty array content gracefully", () => {
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
              // @ts-expect-error - Testing runtime behavior for empty array
              content: [],
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.turns[0]?.toolResults[0]?.content).toBe("");
  });

  // ==========================================================================
  // TOKEN USAGE AGGREGATION
  // ==========================================================================

  describe("token usage aggregation", () => {
    test("aggregates token usage from assistant entries", () => {
      const entries: Entry[] = [
        {
          type: "system",
          subtype: "init",
          uuid: "sys",
          session_id: "s1",
          cwd: "/test",
          tools: [],
          model: "claude-sonnet",
        },
        {
          type: "assistant",
          uuid: "a1",
          session_id: "s1",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            content: [{ type: "text", text: "Hello" }],
            usage: {
              input_tokens: 10,
              output_tokens: 50,
              cache_creation_input_tokens: 1000,
              cache_read_input_tokens: 5000,
            },
          },
        },
        {
          type: "assistant",
          uuid: "a2",
          session_id: "s1",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            content: [{ type: "text", text: "World" }],
            usage: {
              input_tokens: 20,
              output_tokens: 100,
              cache_creation_input_tokens: 2000,
              cache_read_input_tokens: 8000,
            },
          },
        },
      ];

      const result = parseEntries(entries);

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.inputTokens).toBe(30);
      expect(result.tokenUsage!.outputTokens).toBe(150);
      expect(result.tokenUsage!.cacheCreationInputTokens).toBe(3000);
      expect(result.tokenUsage!.cacheReadInputTokens).toBe(13000);
    });

    test("returns undefined tokenUsage when no usage data exists", () => {
      const entries: Entry[] = [
        {
          type: "system",
          subtype: "init",
          uuid: "sys",
          session_id: "s1",
          cwd: "/test",
          tools: [],
          model: "claude-sonnet",
        },
        {
          type: "assistant",
          uuid: "a1",
          session_id: "s1",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            content: [{ type: "text", text: "Hello" }],
          },
        },
      ];

      const result = parseEntries(entries);

      expect(result.tokenUsage).toBeUndefined();
    });

    test("handles missing cache fields gracefully", () => {
      const entries: Entry[] = [
        {
          type: "system",
          subtype: "init",
          uuid: "sys",
          session_id: "s1",
          cwd: "/test",
          tools: [],
          model: "claude-sonnet",
        },
        {
          type: "assistant",
          uuid: "a1",
          session_id: "s1",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            content: [{ type: "text", text: "Hello" }],
            usage: {
              input_tokens: 50,
              output_tokens: 200,
              // No cache fields — older API responses may omit these
            },
          },
        },
      ];

      const result = parseEntries(entries);

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.inputTokens).toBe(50);
      expect(result.tokenUsage!.outputTokens).toBe(200);
      expect(result.tokenUsage!.cacheCreationInputTokens).toBe(0);
      expect(result.tokenUsage!.cacheReadInputTokens).toBe(0);
    });
  });
});

// ==========================================================================
// QUEUED MESSAGES (queue-operation/enqueue)
// ==========================================================================

describe("queued messages", () => {
  test("extracts queued message from queue-operation enqueue entry", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "enqueue",
        timestamp: "2026-02-06T19:11:02.484Z",
        sessionId: "session-1",
        content: "super small steps, small commits",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeDefined();
    expect(result.queuedMessages).toHaveLength(1);
    expect(result.queuedMessages![0]!.timestamp).toBe("2026-02-06T19:11:02.484Z");
    expect(result.queuedMessages![0]!.content).toBe("super small steps, small commits");
  });

  test("extracts multiple queued messages", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "enqueue",
        timestamp: "2026-02-06T19:11:00.000Z",
        sessionId: "session-1",
        content: "first message",
      },
      {
        type: "queue-operation",
        operation: "enqueue",
        timestamp: "2026-02-06T19:12:00.000Z",
        sessionId: "session-1",
        content: "second message",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toHaveLength(2);
    expect(result.queuedMessages![0]!.content).toBe("first message");
    expect(result.queuedMessages![1]!.content).toBe("second message");
  });

  test("ignores queue-operation entries that are not enqueue", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "dequeue",
        timestamp: "2026-02-06T19:11:00.000Z",
        sessionId: "session-1",
        content: "some content",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeUndefined();
  });

  test("ignores enqueue entries with empty content", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "enqueue",
        timestamp: "2026-02-06T19:11:00.000Z",
        sessionId: "session-1",
        content: "   ",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeUndefined();
  });

  test("ignores enqueue entries with non-string content", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "enqueue",
        timestamp: "2026-02-06T19:11:00.000Z",
        sessionId: "session-1",
        content: { some: "object" },
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeUndefined();
  });

  test("ignores enqueue entries without timestamp", () => {
    const entries: Entry[] = [
      {
        type: "queue-operation",
        operation: "enqueue",
        sessionId: "session-1",
        content: "message without timestamp",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeUndefined();
  });

  test("returns undefined queuedMessages when none exist", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys",
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude-sonnet",
      },
    ];

    const result = parseEntries(entries);

    expect(result.queuedMessages).toBeUndefined();
  });
});
