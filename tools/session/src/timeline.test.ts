import { test, expect, describe } from "bun:test";
import {
  buildTimeline,
  summarizeToolCall,
  classifyUserMessage,
  type TimelineEvent,
} from "./timeline";
import {
  makeSession,
  makeSubagent,
  makeCommit,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
  createTimestampGenerator,
} from "./testing";
import { asAgentId } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

/** Extract kinds from a timeline for quick assertions. */
function kinds(events: TimelineEvent[]): string[] {
  return events.map((e) => e.kind);
}

/** Get ISO string from a Date for assertion readability. */
function iso(events: TimelineEvent[]): string[] {
  return events.map((e) => e.timestamp.toISOString());
}

// ============================================================================
// summarizeToolCall
// ============================================================================

describe("summarizeToolCall", () => {
  test("summarizes Read with file_path", () => {
    const tc = toolCall("t1", "Read", { file_path: "/src/index.ts" });
    expect(summarizeToolCall(tc)).toBe("/src/index.ts");
  });

  test("summarizes Bash with truncated command", () => {
    const longCmd = "find / -name '*.ts' -exec grep -l 'import' {} \\; | sort | uniq -c | sort -rn | head -20";
    const tc = toolCall("t1", "Bash", { command: longCmd });
    const summary = summarizeToolCall(tc);
    expect(summary.length).toBeLessThanOrEqual(63); // 60 + "..."
    expect(summary.endsWith("...")).toBe(true);
  });

  test("summarizes Grep with pattern", () => {
    const tc = toolCall("t1", "Grep", { pattern: "TODO" });
    expect(summarizeToolCall(tc)).toBe('pattern="TODO"');
  });

  test("summarizes Task with description", () => {
    const tc = toolCall("t1", "Task", {
      prompt: "Search the codebase",
      description: "Find TODOs",
    });
    expect(summarizeToolCall(tc)).toBe("Find TODOs");
  });

  test("summarizes unknown tool with first string value", () => {
    const tc = toolCall("t1", "CustomTool", { query: "hello world" });
    expect(summarizeToolCall(tc)).toBe("hello world");
  });

  test("returns empty string for unknown tool with no string values", () => {
    const tc = toolCall("t1", "CustomTool", { count: 42 });
    expect(summarizeToolCall(tc)).toBe("");
  });
});

// ============================================================================
// classifyUserMessage
// ============================================================================

describe("classifyUserMessage", () => {
  test("classifies empty string as tool_result_only", () => {
    expect(classifyUserMessage("")).toBe("tool_result_only");
  });

  test("classifies whitespace-only as tool_result_only", () => {
    expect(classifyUserMessage("   ")).toBe("tool_result_only");
  });

  test("classifies notification messages", () => {
    expect(classifyUserMessage("<task-notification>Agent completed</task-notification>")).toBe("notification");
  });

  test("classifies command messages", () => {
    expect(classifyUserMessage("<command-message>commit</command-message>")).toBe("command");
  });

  test("classifies skill injection with Base directory prefix", () => {
    expect(classifyUserMessage("Base directory for this skill: /workspaces/test-mvp\n\nInstructions...")).toBe("skill_injection");
  });

  test("classifies skill injection with header and Triggered by", () => {
    expect(classifyUserMessage("# Auto-Handoff\n\nTriggered by /auto-handoff\n\nExport session...")).toBe("skill_injection");
  });

  test("classifies interrupted request", () => {
    expect(classifyUserMessage("[Request interrupted by user]")).toBe("interrupted");
  });

  test("classifies normal human text", () => {
    expect(classifyUserMessage("Fix the login bug")).toBe("human");
  });

  test("classifies multi-line human text", () => {
    expect(classifyUserMessage("Can you refactor this?\nMake it cleaner.")).toBe("human");
  });
});

// ============================================================================
// buildTimeline — simple session
// ============================================================================

describe("buildTimeline", () => {
  describe("simple session with user + assistant turns", () => {
    test("creates session_start, user_message, tool_call, and session_end events", () => {
      const ts = createTimestampGenerator();
      const t1 = ts(); // 10:00
      const t2 = ts(); // 10:01
      const t3 = ts(); // 10:02

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t3,
        turns: [
          userTurn("u1", "Fix the login bug", { timestamp: t1 }),
          assistantTurn("a1", "Let me check", {
            timestamp: t2,
            toolCalls: [
              toolCall("tc1", "Read", { file_path: "/src/auth.ts" }),
              toolCall("tc2", "Bash", { command: "bun test" }),
            ],
          }),
          userTurn("u2", "", {
            timestamp: t3,
            toolResults: [
              toolResult("tc1", "file contents"),
              toolResult("tc2", "all pass"),
            ],
          }),
        ],
      });

      const events = buildTimeline(session);

      expect(kinds(events)).toEqual([
        "session_start",
        "user_message",
        "tool_call",
        "tool_call",
        // u2 has empty text, so no user_message
        "session_end",
      ]);

      // Verify session_start
      expect(events[0]!.kind).toBe("session_start");
      expect(events[0]!.timestamp.toISOString()).toBe(t1);

      // Verify user_message
      const userMsg = events[1] as TimelineEvent & { kind: "user_message" };
      expect(userMsg.text).toBe("Fix the login bug");

      // Verify tool_calls
      const readCall = events[2] as TimelineEvent & { kind: "tool_call" };
      expect(readCall.toolName).toBe("Read");
      expect(readCall.summary).toBe("/src/auth.ts");

      const bashCall = events[3] as TimelineEvent & { kind: "tool_call" };
      expect(bashCall.toolName).toBe("Bash");
      expect(bashCall.summary).toBe("bun test");

      // Verify session_end
      const endEvent = events[4] as TimelineEvent & { kind: "session_end" };
      expect(endEvent.timestamp.toISOString()).toBe(t3);
      expect(endEvent.totalDurationMs).toBe(120000); // 2 minutes
    });

    test("truncates long user messages to 80 chars", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const longMessage = "A".repeat(100);
      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [userTurn("u1", longMessage, { timestamp: t1 })],
      });

      const events = buildTimeline(session);
      const userMsg = events.find((e) => e.kind === "user_message") as
        | (TimelineEvent & { kind: "user_message" })
        | undefined;

      expect(userMsg).toBeDefined();
      expect(userMsg!.text.length).toBe(80);
      expect(userMsg!.text.endsWith("...")).toBe(true);
    });
  });

  // ========================================================================
  // SUBAGENT SPAWNS AND RETURNS
  // ========================================================================

  describe("subagent spawns and returns", () => {
    test("creates subagent_spawn and subagent_return events", () => {
      const ts = createTimestampGenerator();
      const t1 = ts(); // 10:00
      const t2 = ts(); // 10:01
      const t3 = ts(); // 10:02
      const t4 = ts(); // 10:03

      const agentId = asAgentId("agent-abc");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t4,
        turns: [
          userTurn("u1", "Search for TODOs", { timestamp: t1 }),
          assistantTurn("a1", "Spawning subagent", {
            timestamp: t2,
            toolCalls: [
              toolCall("task1", "Task", {
                prompt: "Find all TODO comments",
                description: "Search TODOs",
              }),
            ],
          }),
          userTurn("u2", "", {
            timestamp: t4,
            toolResults: [
              toolResult("task1", `Done. agentId: ${String(agentId)}`),
            ],
          }),
        ],
        subagents: [
          makeSubagent(
            agentId,
            [
              assistantTurn("sa1", "Searching the codebase", {
                timestamp: t2,
                toolCalls: [toolCall("st1", "Grep", { pattern: "TODO" })],
              }),
              userTurn("su1", "", {
                timestamp: t3,
                toolResults: [toolResult("st1", "5 matches")],
              }),
            ],
            { startTimestamp: t2 },
          ),
        ],
      });

      const events = buildTimeline(session);

      // Verify subagent_spawn exists
      const spawn = events.find((e) => e.kind === "subagent_spawn") as
        | (TimelineEvent & { kind: "subagent_spawn" })
        | undefined;
      expect(spawn).toBeDefined();
      expect(spawn!.agentId).toBe(agentId);
      // description is preferred over prompt for spawn descriptions
      expect(spawn!.description).toBe("Search TODOs");

      // Verify subagent_return exists
      const ret = events.find((e) => e.kind === "subagent_return") as
        | (TimelineEvent & { kind: "subagent_return" })
        | undefined;
      expect(ret).toBeDefined();
      expect(ret!.agentId).toBe(agentId);
      expect(ret!.turns).toBe(2);
      expect(ret!.durationMs).toBe(60000); // 1 minute (t2 to t3)
    });

    test("Task tool calls are not emitted as tool_call events", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          assistantTurn("a1", "Spawning", {
            timestamp: t1,
            toolCalls: [
              toolCall("task1", "Task", { prompt: "Do work", description: "Work" }),
              toolCall("tc1", "Read", { file_path: "/a.ts" }),
            ],
          }),
        ],
      });

      const events = buildTimeline(session);
      const toolCalls = events.filter((e) => e.kind === "tool_call");

      // Only the Read call, not the Task call
      expect(toolCalls).toHaveLength(1);
      expect((toolCalls[0] as TimelineEvent & { kind: "tool_call" }).toolName).toBe("Read");
    });

    test("uses first assistant text as spawn description fallback", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const agentId = asAgentId("agent-fallback");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [],
        subagents: [
          makeSubagent(
            agentId,
            [
              assistantTurn("sa1", "Analyzing the authentication module carefully", {
                timestamp: t1,
              }),
            ],
            { startTimestamp: t1 },
          ),
        ],
      });

      const events = buildTimeline(session);
      const spawn = events.find((e) => e.kind === "subagent_spawn") as
        | (TimelineEvent & { kind: "subagent_spawn" })
        | undefined;

      expect(spawn).toBeDefined();
      expect(spawn!.description).toBe("Analyzing the authentication module carefully");
    });
  });

  // ========================================================================
  // CHRONOLOGICAL SORTING
  // ========================================================================

  describe("chronological sorting", () => {
    test("sorts all events by timestamp", () => {
      const ts = createTimestampGenerator();
      const t1 = ts(); // 10:00
      const t2 = ts(); // 10:01
      const t3 = ts(); // 10:02
      const t4 = ts(); // 10:03
      const t5 = ts(); // 10:04

      const agentId = asAgentId("agent-sort");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t5,
        turns: [
          userTurn("u1", "Hello", { timestamp: t1 }),
          assistantTurn("a1", "Working", {
            timestamp: t3,
            toolCalls: [toolCall("tc1", "Read", { file_path: "/a.ts" })],
          }),
        ],
        subagents: [
          makeSubagent(
            agentId,
            [
              assistantTurn("sa1", "Sub work", { timestamp: t2 }),
              assistantTurn("sa2", "Sub done", { timestamp: t4 }),
            ],
            { startTimestamp: t2 },
          ),
        ],
      });

      const events = buildTimeline(session);
      const timestamps = iso(events);

      // Verify ascending order
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]! >= timestamps[i - 1]!).toBe(true);
      }

      // Verify the interleaving: session_start, user, subagent_spawn, tool_call,
      // subagent_return, session_end
      expect(kinds(events)).toEqual([
        "session_start",
        "user_message",
        "subagent_spawn",
        "tool_call",
        "subagent_return",
        "session_end",
      ]);
    });
  });

  // ========================================================================
  // MISSING TIMESTAMPS
  // ========================================================================

  describe("missing timestamps", () => {
    test("skips turns without timestamps", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          userTurn("u1", "Has timestamp", { timestamp: t1 }),
          userTurn("u2", "No timestamp"), // no timestamp
          assistantTurn("a1", "Also no timestamp"), // no timestamp
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(1);
      expect((userMessages[0] as TimelineEvent & { kind: "user_message" }).text).toBe("Has timestamp");
    });

    test("skips session_start when startTimestamp is missing", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        endTimestamp: t1,
        turns: [userTurn("u1", "Hello", { timestamp: t1 })],
      });

      const events = buildTimeline(session);
      expect(events.some((e) => e.kind === "session_start")).toBe(false);
    });

    test("skips session_end when endTimestamp is missing", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        turns: [userTurn("u1", "Hello", { timestamp: t1 })],
      });

      const events = buildTimeline(session);
      expect(events.some((e) => e.kind === "session_end")).toBe(false);
    });

    test("skips subagent events when subagent has no timestamps", () => {
      const agentId = asAgentId("agent-no-ts");
      const session = makeSession({
        subagents: [
          makeSubagent(agentId, [
            assistantTurn("sa1", "No timestamps"),
          ]),
        ],
      });

      const events = buildTimeline(session);
      expect(events.filter((e) => e.kind === "subagent_spawn")).toHaveLength(0);
      expect(events.filter((e) => e.kind === "subagent_return")).toHaveLength(0);
    });

    test("returns empty array for completely empty session", () => {
      const session = makeSession();
      const events = buildTimeline(session);
      expect(events).toEqual([]);
    });
  });

  // ========================================================================
  // COMMITS INTERLEAVED
  // ========================================================================

  describe("commits interleaved", () => {
    test("interleaves commit events by timestamp", () => {
      const ts = createTimestampGenerator();
      const t1 = ts(); // 10:00
      const t2 = ts(); // 10:01
      const t3 = ts(); // 10:02
      const t4 = ts(); // 10:03

      // Commits with timestamp property (duck-typed from GitCommit)
      const commitsWithTimestamp = [
        { hash: "abc1234", message: "fix: login bug", timestamp: t2 },
        { hash: "def5678", message: "feat: add search", timestamp: t3 },
      ] as any[];

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t4,
        commits: commitsWithTimestamp,
        turns: [
          userTurn("u1", "Fix the bugs", { timestamp: t1 }),
          assistantTurn("a1", "Done", { timestamp: t4 }),
        ],
      });

      const events = buildTimeline(session);

      // Commits should be interleaved chronologically
      const commitEvents = events.filter((e) => e.kind === "commit");
      expect(commitEvents).toHaveLength(2);

      const commit1 = commitEvents[0] as TimelineEvent & { kind: "commit" };
      expect(commit1.hash).toBe("abc1234");
      expect(commit1.subject).toBe("fix: login bug");
      expect(commit1.timestamp.toISOString()).toBe(t2);

      const commit2 = commitEvents[1] as TimelineEvent & { kind: "commit" };
      expect(commit2.hash).toBe("def5678");

      // Verify chronological ordering
      // The assistant turn "Done" at t4 has text but no tool calls, so it
      // produces an assistant_message event alongside session_end.
      expect(kinds(events)).toEqual([
        "session_start",
        "user_message",
        "commit",
        "commit",
        "assistant_message",
        "session_end",
      ]);
    });

    test("skips commits without timestamp property", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        commits: [
          makeCommit("abc1234", "fix: something"), // no timestamp
        ],
        turns: [userTurn("u1", "Hello", { timestamp: t1 })],
      });

      const events = buildTimeline(session);
      expect(events.filter((e) => e.kind === "commit")).toHaveLength(0);
    });
  });

  // ========================================================================
  // SESSION_END DURATION
  // ========================================================================

  describe("session_end totalDurationMs", () => {
    test("computes totalDurationMs from start to end", () => {
      const session = makeSession({
        startTimestamp: "2025-01-15T10:00:00.000Z",
        endTimestamp: "2025-01-15T10:05:00.000Z",
      });

      const events = buildTimeline(session);
      const endEvent = events.find((e) => e.kind === "session_end") as
        | (TimelineEvent & { kind: "session_end" })
        | undefined;

      expect(endEvent).toBeDefined();
      expect(endEvent!.totalDurationMs).toBe(300000); // 5 minutes
    });

    test("omits totalDurationMs when startTimestamp is missing", () => {
      const session = makeSession({
        endTimestamp: "2025-01-15T10:05:00.000Z",
      });

      const events = buildTimeline(session);
      const endEvent = events.find((e) => e.kind === "session_end") as
        | (TimelineEvent & { kind: "session_end" })
        | undefined;

      expect(endEvent).toBeDefined();
      expect(endEvent!.totalDurationMs).toBeUndefined();
    });
  });

  // ========================================================================
  // USER MESSAGE CLASSIFICATION
  // ========================================================================

  describe("user message classification", () => {
    test("filters out notification messages", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          userTurn("u1", '<task-notification>Agent completed task</task-notification>', { timestamp: t1 }),
          userTurn("u2", "Fix the bug", { timestamp: t2 }),
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(1);
      expect((userMessages[0] as TimelineEvent & { kind: "user_message" }).text).toBe("Fix the bug");
    });

    test("filters out command messages", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          userTurn("u1", '<command-message>commit</command-message>', { timestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(0);
    });

    test("filters out skill injection messages", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          userTurn("u1", "Base directory for this skill: /workspaces/test-mvp\n\n# Auto-Handoff\nInstructions here...", { timestamp: t1 }),
          userTurn("u2", "# My Skill\n\nTriggered by /my-skill\n\nDo the thing.", { timestamp: t2 }),
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(0);
    });

    test("keeps interrupted messages", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          userTurn("u1", "[Request interrupted by user]", { timestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(1);
      expect((userMessages[0] as TimelineEvent & { kind: "user_message" }).text).toBe("[Request interrupted by user]");
    });

    test("keeps normal human messages", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          userTurn("u1", "Can you refactor the auth module?", { timestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const userMessages = events.filter((e) => e.kind === "user_message");

      expect(userMessages).toHaveLength(1);
    });
  });

  // ========================================================================
  // ASSISTANT MESSAGES
  // ========================================================================

  describe("assistant messages", () => {
    test("creates assistant_message for text-only assistant turns", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          userTurn("u1", "What is this project?", { timestamp: t1 }),
          assistantTurn("a1", "This is a monorepo with a Next.js frontend and Python backend.", {
            timestamp: t2,
          }),
        ],
      });

      const events = buildTimeline(session);
      const assistantMessages = events.filter((e) => e.kind === "assistant_message");

      expect(assistantMessages).toHaveLength(1);
      const msg = assistantMessages[0] as TimelineEvent & { kind: "assistant_message" };
      expect(msg.text).toBe("This is a monorepo with a Next.js frontend and Python backend.");
    });

    test("does NOT create assistant_message when assistant has tool calls", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          assistantTurn("a1", "Let me check the file.", {
            timestamp: t1,
            toolCalls: [toolCall("tc1", "Read", { file_path: "/src/index.ts" })],
          }),
        ],
      });

      const events = buildTimeline(session);
      const assistantMessages = events.filter((e) => e.kind === "assistant_message");

      expect(assistantMessages).toHaveLength(0);
    });

    test("does NOT create assistant_message for empty text", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          assistantTurn("a1", "", { timestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const assistantMessages = events.filter((e) => e.kind === "assistant_message");

      expect(assistantMessages).toHaveLength(0);
    });

    test("truncates long assistant messages to 80 chars", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();

      const longMessage = "A".repeat(100);
      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t1,
        turns: [
          assistantTurn("a1", longMessage, { timestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const msg = events.find((e) => e.kind === "assistant_message") as
        | (TimelineEvent & { kind: "assistant_message" })
        | undefined;

      expect(msg).toBeDefined();
      expect(msg!.text.length).toBe(80);
      expect(msg!.text.endsWith("...")).toBe(true);
    });
  });

  // ========================================================================
  // IDLE GAP DETECTION
  // ========================================================================

  describe("idle gap detection", () => {
    test("inserts idle_gap when events are more than 5 minutes apart", () => {
      const session = makeSession({
        startTimestamp: "2025-01-15T10:00:00.000Z",
        endTimestamp: "2025-01-15T10:10:00.000Z",
        turns: [
          userTurn("u1", "First message", { timestamp: "2025-01-15T10:00:00.000Z" }),
          // 10 minute gap — well above 5 minute threshold
          userTurn("u2", "Second message", { timestamp: "2025-01-15T10:10:00.000Z" }),
        ],
      });

      const events = buildTimeline(session);
      const idleGaps = events.filter((e) => e.kind === "idle_gap");

      expect(idleGaps).toHaveLength(1);
      const gap = idleGaps[0] as TimelineEvent & { kind: "idle_gap" };
      expect(gap.durationMs).toBe(600000); // 10 minutes
    });

    test("does NOT insert idle_gap when events are less than 5 minutes apart", () => {
      const ts = createTimestampGenerator();
      const t1 = ts(); // 10:00
      const t2 = ts(); // 10:01 (1 minute apart)

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          userTurn("u1", "First message", { timestamp: t1 }),
          userTurn("u2", "Second message", { timestamp: t2 }),
        ],
      });

      const events = buildTimeline(session);
      const idleGaps = events.filter((e) => e.kind === "idle_gap");

      expect(idleGaps).toHaveLength(0);
    });

    test("does NOT insert idle_gap at exactly 5 minutes", () => {
      const session = makeSession({
        startTimestamp: "2025-01-15T10:00:00.000Z",
        endTimestamp: "2025-01-15T10:05:00.000Z",
        turns: [
          userTurn("u1", "First", { timestamp: "2025-01-15T10:00:00.000Z" }),
          userTurn("u2", "Second", { timestamp: "2025-01-15T10:05:00.000Z" }),
        ],
      });

      const events = buildTimeline(session);
      const idleGaps = events.filter((e) => e.kind === "idle_gap");

      // Threshold is strictly greater than 5 minutes
      expect(idleGaps).toHaveLength(0);
    });

    test("inserts multiple idle_gaps for multiple long pauses", () => {
      const session = makeSession({
        startTimestamp: "2025-01-15T10:00:00.000Z",
        endTimestamp: "2025-01-15T10:30:00.000Z",
        turns: [
          userTurn("u1", "First", { timestamp: "2025-01-15T10:00:00.000Z" }),
          userTurn("u2", "Second", { timestamp: "2025-01-15T10:10:00.000Z" }),
          userTurn("u3", "Third", { timestamp: "2025-01-15T10:25:00.000Z" }),
        ],
      });

      const events = buildTimeline(session);
      const idleGaps = events.filter((e) => e.kind === "idle_gap");

      expect(idleGaps).toHaveLength(2);
    });

    test("idle_gap timestamp is set to the event BEFORE the gap", () => {
      const session = makeSession({
        startTimestamp: "2025-01-15T10:00:00.000Z",
        endTimestamp: "2025-01-15T10:10:00.000Z",
        turns: [
          userTurn("u1", "First message", { timestamp: "2025-01-15T10:00:00.000Z" }),
          userTurn("u2", "Second message", { timestamp: "2025-01-15T10:10:00.000Z" }),
        ],
      });

      const events = buildTimeline(session);
      const idleGap = events.find((e) => e.kind === "idle_gap") as
        | (TimelineEvent & { kind: "idle_gap" })
        | undefined;

      expect(idleGap).toBeDefined();
      // Timestamp should be at the event before the gap (first user message at 10:00)
      expect(idleGap!.timestamp.toISOString()).toBe("2025-01-15T10:00:00.000Z");
    });
  });

  // ========================================================================
  // SUBAGENT SPAWN DESCRIPTION PRIORITY
  // ========================================================================

  describe("subagent spawn description priority", () => {
    test("prefers description over prompt", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const agentId = asAgentId("agent-desc-prio");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          assistantTurn("a1", "Spawning", {
            timestamp: t1,
            toolCalls: [
              toolCall("task1", "Task", {
                prompt: "Search the entire codebase for all TODO comments and categorize them",
                description: "Search TODOs",
              }),
            ],
          }),
          userTurn("u1", "", {
            timestamp: t2,
            toolResults: [
              toolResult("task1", `Done. agentId: ${String(agentId)}`),
            ],
          }),
        ],
        subagents: [
          makeSubagent(agentId, [
            assistantTurn("sa1", "Working", { timestamp: t1 }),
          ], { startTimestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const spawn = events.find((e) => e.kind === "subagent_spawn") as
        | (TimelineEvent & { kind: "subagent_spawn" })
        | undefined;

      expect(spawn).toBeDefined();
      expect(spawn!.description).toBe("Search TODOs");
    });

    test("falls back to prompt when description is empty", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const agentId = asAgentId("agent-prompt-fb");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          assistantTurn("a1", "Spawning", {
            timestamp: t1,
            toolCalls: [
              toolCall("task1", "Task", {
                prompt: "Analyze the auth module for security issues",
                description: "",
              }),
            ],
          }),
          userTurn("u1", "", {
            timestamp: t2,
            toolResults: [
              toolResult("task1", `Done. agentId: ${String(agentId)}`),
            ],
          }),
        ],
        subagents: [
          makeSubagent(agentId, [
            assistantTurn("sa1", "Working", { timestamp: t1 }),
          ], { startTimestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const spawn = events.find((e) => e.kind === "subagent_spawn") as
        | (TimelineEvent & { kind: "subagent_spawn" })
        | undefined;

      expect(spawn).toBeDefined();
      expect(spawn!.description).toBe("Analyze the auth module for security issues");
    });

    test("includes name in spawn description when available", () => {
      const ts = createTimestampGenerator();
      const t1 = ts();
      const t2 = ts();

      const agentId = asAgentId("agent-named");

      const session = makeSession({
        startTimestamp: t1,
        endTimestamp: t2,
        turns: [
          assistantTurn("a1", "Spawning", {
            timestamp: t1,
            toolCalls: [
              toolCall("task1", "Task", {
                prompt: "Search for security issues",
                description: "Security audit",
                name: "security-checker",
              }),
            ],
          }),
          userTurn("u1", "", {
            timestamp: t2,
            toolResults: [
              toolResult("task1", `Done. agentId: ${String(agentId)}`),
            ],
          }),
        ],
        subagents: [
          makeSubagent(agentId, [
            assistantTurn("sa1", "Working", { timestamp: t1 }),
          ], { startTimestamp: t1 }),
        ],
      });

      const events = buildTimeline(session);
      const spawn = events.find((e) => e.kind === "subagent_spawn") as
        | (TimelineEvent & { kind: "subagent_spawn" })
        | undefined;

      expect(spawn).toBeDefined();
      expect(spawn!.description).toBe("security-checker: Security audit");
    });
  });
});
