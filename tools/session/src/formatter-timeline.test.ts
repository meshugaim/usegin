import { test, expect, describe } from "bun:test";
import { formatTimeline } from "./formatter-timeline";
import type { TimelineEvent } from "./timeline";
import { asAgentId } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Shorthand to build a timeline event with a Date from a relative offset.
 *
 * base is "2025-01-15T10:00:00.000Z" (matches TEST_TIMESTAMP).
 * offsetMs shifts forward from base.
 */
const BASE = new Date("2025-01-15T10:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(BASE.getTime() + offsetMs);
}

/** Convenience: minutes to ms */
function mins(n: number): number {
  return n * 60_000;
}

/** Convenience: seconds to ms */
function secs(n: number): number {
  return n * 1000;
}

// ============================================================================
// EMPTY EVENTS
// ============================================================================

describe("formatTimeline with empty events", () => {
  test("returns empty array for empty events", () => {
    expect(formatTimeline([])).toEqual([]);
  });

  test("returns empty array for empty events with showHints", () => {
    expect(formatTimeline([], { showHints: true })).toEqual([]);
  });
});

// ============================================================================
// BASIC RENDERING
// ============================================================================

describe("formatTimeline basic rendering", () => {
  test("renders header from session_start", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
    ];

    const lines = formatTimeline(events);

    expect(lines[0]).toContain("\u2500\u2500\u2500 Timeline ");
    // Header should be padded with rule characters
    expect(lines[0]).toMatch(/^─── Timeline ─+$/);
  });

  test("renders footer from session_end with duration", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
      { kind: "session_end", timestamp: at(mins(3) + secs(15)), totalDurationMs: mins(3) + secs(15) },
    ];

    const lines = formatTimeline(events, { showHints: false });
    const footer = lines[lines.length - 1];

    expect(footer).toContain("End (3m 15s)");
    expect(footer).toMatch(/^─── End \(3m 15s\) ─+$/);
  });

  test("renders footer without duration when totalDurationMs is undefined", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
      { kind: "session_end", timestamp: at(mins(5)) },
    ];

    const lines = formatTimeline(events, { showHints: false });
    const footer = lines[lines.length - 1];

    expect(footer).toContain("End ");
    expect(footer).not.toContain("(");
  });

  test("renders a minimal session with header, user message, and footer", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
      { kind: "user_message", timestamp: at(0), text: "Hello world" },
      { kind: "session_end", timestamp: at(mins(1)), totalDurationMs: mins(1) },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Timeline");
    expect(lines[1]).toContain('User: "Hello world"');
    expect(lines[2]).toContain("End (1m 00s)");
  });
});

// ============================================================================
// RELATIVE TIMESTAMP FORMATTING (MM:SS)
// ============================================================================

describe("formatTimeline relative timestamps", () => {
  test("formats timestamps as MM:SS relative to session start", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
      { kind: "user_message", timestamp: at(0), text: "First message" },
      { kind: "user_message", timestamp: at(secs(12)), text: "12 seconds later" },
      { kind: "user_message", timestamp: at(mins(1) + secs(30)), text: "90 seconds later" },
      { kind: "user_message", timestamp: at(mins(14) + secs(32)), text: "Long session" },
    ];

    const lines = formatTimeline(events, { showHints: false });

    // First message at 00:00
    expect(lines[1]).toContain("00:00");
    expect(lines[1]).toContain("First message");

    // 12 seconds
    expect(lines[2]).toContain("00:12");

    // 1m 30s
    expect(lines[3]).toContain("01:30");

    // 14m 32s
    expect(lines[4]).toContain("14:32");
  });

  test("uses absolute HH:MM:SS when no session_start event", () => {
    const events: TimelineEvent[] = [
      { kind: "user_message", timestamp: at(0), text: "No start event" },
      { kind: "user_message", timestamp: at(mins(5)), text: "Later" },
    ];

    const lines = formatTimeline(events, { showHints: false });

    // Should use absolute time (UTC) — base is 10:00:00
    expect(lines[0]).toContain("10:00:00");
    expect(lines[1]).toContain("10:05:00");
  });
});

// ============================================================================
// EACH EVENT KIND RENDERS CORRECTLY
// ============================================================================

describe("formatTimeline event kinds", () => {
  // Shared session start for relative timestamps
  const start: TimelineEvent = { kind: "session_start", timestamp: at(0) };

  test("user_message shows quoted text", () => {
    const events: TimelineEvent[] = [
      start,
      { kind: "user_message", timestamp: at(secs(5)), text: "Fix the login bug" },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe('  00:05  User: "Fix the login bug"');
  });

  test("tool_call shows right arrow and tool name with summary", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "tool_call",
        timestamp: at(secs(12)),
        toolName: "Read",
        summary: "/src/auth.ts",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  00:12  \u2192 Read: /src/auth.ts");
  });

  test("tool_call with empty summary shows just tool name", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "tool_call",
        timestamp: at(secs(12)),
        toolName: "CustomTool",
        summary: "",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  00:12  \u2192 CustomTool");
  });

  test("subagent_spawn shows right arrow, Task label, description, and short agent ID", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_spawn",
        timestamp: at(secs(15)),
        agentId: asAgentId("agent-d4e2"),
        description: "Search for TODO comments",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe('  00:15  \u2192 Task: "Search for TODO comments" (agent-d4e2)');
  });

  test("subagent_spawn with empty description omits quotes", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_spawn",
        timestamp: at(secs(15)),
        agentId: asAgentId("agent-d4e2"),
        description: "",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  00:15  \u2192 Task: (agent-d4e2)");
  });

  test("subagent_return shows left arrow, agent ID, turns, and duration", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_return",
        timestamp: at(secs(45)),
        agentId: asAgentId("agent-d4e2"),
        turns: 12,
        durationMs: 33_000,
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  00:45  \u2190 agent-d4e2 returned (12 turns, 33s)");
  });

  test("subagent_return without duration omits it", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_return",
        timestamp: at(secs(45)),
        agentId: asAgentId("agent-d4e2"),
        turns: 8,
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  00:45  \u2190 agent-d4e2 returned (8 turns)");
  });

  test("commit shows bullet, short hash, and message", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "commit",
        timestamp: at(mins(1) + secs(2)),
        hash: "abc1234def5678",
        subject: "fix: resolve login edge case",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toBe("  01:02  \u25cf abc1234 fix: resolve login edge case");
  });

  test("commit hash is truncated to 7 characters", () => {
    const events: TimelineEvent[] = [
      start,
      {
        kind: "commit",
        timestamp: at(0),
        hash: "abc1234def5678901234567890abcdef12345678",
        subject: "msg",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toContain("abc1234 msg");
    expect(lines[1]).not.toContain("abc1234d");
  });
});

// ============================================================================
// SINGLE EVENT
// ============================================================================

describe("formatTimeline single event", () => {
  test("renders a single user_message without session boundaries", () => {
    const events: TimelineEvent[] = [
      { kind: "user_message", timestamp: at(0), text: "Solo message" },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Solo message");
  });

  test("renders a single session_start as just the header", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Timeline");
  });
});

// ============================================================================
// TRUNCATION OF LONG TEXT
// ============================================================================

describe("formatTimeline text truncation", () => {
  const start: TimelineEvent = { kind: "session_start", timestamp: at(0) };

  test("truncates long user message text to 60 chars", () => {
    const longText = "A".repeat(100);
    const events: TimelineEvent[] = [
      start,
      { kind: "user_message", timestamp: at(0), text: longText },
    ];

    const lines = formatTimeline(events, { showHints: false });

    // The displayed text inside quotes should be 60 chars (57 chars + "...")
    const match = lines[1]!.match(/User: "(.+)"/);
    expect(match).not.toBeNull();
    expect(match![1]!.length).toBe(60);
    expect(match![1]!.endsWith("...")).toBe(true);
  });

  test("truncates long commit subject", () => {
    const longSubject = "B".repeat(100);
    const events: TimelineEvent[] = [
      start,
      {
        kind: "commit",
        timestamp: at(0),
        hash: "abc1234",
        subject: longSubject,
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    // Subject should be truncated to 60 chars
    const bulletIdx = lines[1]!.indexOf("\u25cf");
    const afterBullet = lines[1]!.slice(bulletIdx + 2); // skip "● "
    // "abc1234 " = 8 chars, then truncated subject
    const subject = afterBullet.slice(8);
    expect(subject.length).toBe(60);
    expect(subject.endsWith("...")).toBe(true);
  });

  test("truncates long subagent description", () => {
    const longDesc = "C".repeat(100);
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_spawn",
        timestamp: at(0),
        agentId: asAgentId("agent-x"),
        description: longDesc,
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    // Description should be truncated to 50 chars
    const match = lines[1]!.match(/"(.+)"/);
    expect(match).not.toBeNull();
    expect(match![1]!.length).toBe(50);
    expect(match![1]!.endsWith("...")).toBe(true);
  });

  test("does not truncate short text", () => {
    const events: TimelineEvent[] = [
      start,
      { kind: "user_message", timestamp: at(0), text: "Short" },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toContain('"Short"');
    expect(lines[1]).not.toContain("...");
  });
});

// ============================================================================
// LONG AGENT IDs
// ============================================================================

describe("formatTimeline long agent IDs", () => {
  const start: TimelineEvent = { kind: "session_start", timestamp: at(0) };

  test("truncates long agent IDs to 12 chars", () => {
    const longId = asAgentId("agent-d4e2f891abcd1234");
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_spawn",
        timestamp: at(0),
        agentId: longId,
        description: "Work",
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toContain("(agent-d4e2f8)");
    expect(lines[1]).not.toContain("agent-d4e2f891");
  });

  test("preserves short agent IDs", () => {
    const shortId = asAgentId("agent-d4e2");
    const events: TimelineEvent[] = [
      start,
      {
        kind: "subagent_return",
        timestamp: at(0),
        agentId: shortId,
        turns: 5,
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines[1]).toContain("agent-d4e2 returned");
  });
});

// ============================================================================
// HINTS SHOWN / HIDDEN
// ============================================================================

describe("formatTimeline hints", () => {
  const events: TimelineEvent[] = [
    { kind: "session_start", timestamp: at(0) },
    { kind: "user_message", timestamp: at(0), text: "Hello" },
    { kind: "session_end", timestamp: at(mins(1)), totalDurationMs: mins(1) },
  ];

  test("shows hint by default (showHints=true)", () => {
    const lines = formatTimeline(events);
    const lastLine = lines[lines.length - 1];

    expect(lastLine).toContain("--timeline --subagents");
  });

  test("shows hint when showHints is explicitly true", () => {
    const lines = formatTimeline(events, { showHints: true });
    const lastLine = lines[lines.length - 1];

    expect(lastLine).toContain("--timeline --subagents to include subagent internals");
  });

  test("hides hint when showHints is false", () => {
    const lines = formatTimeline(events, { showHints: false });

    const joined = lines.join("\n");
    expect(joined).not.toContain("--timeline");
    expect(joined).not.toContain("subagent internals");
  });
});

// ============================================================================
// FULL TIMELINE RENDERING
// ============================================================================

describe("formatTimeline full session", () => {
  test("renders a complete timeline with interleaved events", () => {
    const events: TimelineEvent[] = [
      { kind: "session_start", timestamp: at(0) },
      { kind: "user_message", timestamp: at(0), text: "Fix the authentication module" },
      { kind: "tool_call", timestamp: at(secs(5)), toolName: "Read", summary: "/src/auth.ts" },
      { kind: "tool_call", timestamp: at(secs(8)), toolName: "Bash", summary: "bun test" },
      {
        kind: "subagent_spawn",
        timestamp: at(secs(15)),
        agentId: asAgentId("agent-d4e2"),
        description: "Run linting checks",
      },
      {
        kind: "subagent_return",
        timestamp: at(secs(45)),
        agentId: asAgentId("agent-d4e2"),
        turns: 12,
        durationMs: 30_000,
      },
      {
        kind: "commit",
        timestamp: at(mins(1) + secs(2)),
        hash: "abc1234",
        subject: "fix: auth token refresh",
      },
      {
        kind: "session_end",
        timestamp: at(mins(3) + secs(15)),
        totalDurationMs: mins(3) + secs(15),
      },
    ];

    const lines = formatTimeline(events, { showHints: false });

    expect(lines).toHaveLength(8);
    expect(lines[0]).toContain("Timeline");
    expect(lines[1]).toContain('00:00  User: "Fix the authentication module"');
    expect(lines[2]).toContain("00:05  \u2192 Read: /src/auth.ts");
    expect(lines[3]).toContain("00:08  \u2192 Bash: bun test");
    expect(lines[4]).toContain('00:15  \u2192 Task: "Run linting checks" (agent-d4e2)');
    expect(lines[5]).toContain("00:45  \u2190 agent-d4e2 returned (12 turns, 30s)");
    expect(lines[6]).toContain("01:02  \u25cf abc1234 fix: auth token refresh");
    expect(lines[7]).toContain("End (3m 15s)");
  });
});
