import { test, expect, describe } from "bun:test";
import { formatNarrative, formatMarkdown, formatToolFilter, dedupTaskNotifications } from "./formatter";
import {
  makeSession,
  makeSubagent,
  makeRewind,
  makeCommit,
  makeGitCommit,
  makeCompaction,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";
import { asSessionId, asEntryUuid } from "./types";

describe("formatNarrative", () => {
  test("formats basic user/assistant turns", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi there!"),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("USER: Hello");
    expect(output).toContain("ASSISTANT: Hi there!");
  });

  test("formats tool calls with summary", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Let me check", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/index.ts" })],
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Read: /src/index.ts");
  });

  test("includes tool input when flag set", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "TODO", path: "src/" })],
        }),
      ],
    });

    const output = formatNarrative(session, { toolInput: true });

    expect(output).toContain("input:");
    expect(output).toContain('"pattern": "TODO"');
  });

  test("includes tool output when flag set", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "Found 3 matches")],
        }),
      ],
    });

    const output = formatNarrative(session, { toolOutput: true });

    expect(output).toContain("output: Found 3 matches");
  });

  test("shows error prefix for failed tool results", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "File not found", true)],
        }),
      ],
    });

    const output = formatNarrative(session, { toolOutput: true });

    expect(output).toContain("error: File not found");
  });

  test("truncates long output", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "x".repeat(1000))],
        }),
      ],
    });

    const output = formatNarrative(session, { toolOutput: true, truncate: 100 });

    expect(output.length).toBeLessThan(500);
    expect(output).toContain("...");
  });

  test("formats Bash command summary", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "ls -la" })],
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Bash: ls -la");
  });

  test("formats Grep pattern summary", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "handleLogin" })],
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain('→ Grep: pattern="handleLogin"');
  });
});

describe("formatNarrative with subagents", () => {
  test("does not show subagents section by default", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent("agent-123", [assistantTurn("sa1", "Subagent work")], {
          startTimestamp: "2025-01-01T10:00:00.000Z",
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("SUBAGENTS");
    expect(output).not.toContain("agent-123");
  });

  test("shows subagents section when includeSubagents is true", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent("agent-123", [assistantTurn("sa1", "Subagent work")], {
          startTimestamp: "2025-01-01T10:00:00.000Z",
        }),
      ],
    });

    const output = formatNarrative(session, { includeSubagents: true });

    expect(output).toContain("SUBAGENTS (1)");
    expect(output).toContain("SUBAGENT: agent-123");
    expect(output).toContain("Started: 2025-01-01T10:00:00.000Z");
    expect(output).toContain("Turns: 1");
    expect(output).toContain("Subagent work");
  });

  test("shows multiple subagents", () => {
    const session = makeSession({
      subagents: [
        makeSubagent("agent-aaa", [assistantTurn("a1", "First agent")]),
        makeSubagent("agent-bbb", [assistantTurn("a2", "Second agent")]),
      ],
    });

    const output = formatNarrative(session, { includeSubagents: true });

    expect(output).toContain("SUBAGENTS (2)");
    expect(output).toContain("SUBAGENT: agent-aaa");
    expect(output).toContain("SUBAGENT: agent-bbb");
    expect(output).toContain("First agent");
    expect(output).toContain("Second agent");
  });

  test("does not show subagents section when empty", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [],
    });

    const output = formatNarrative(session, { includeSubagents: true });

    expect(output).not.toContain("SUBAGENTS");
  });
});

describe("formatNarrative with rewinds", () => {
  test("marks rewound branch turns with prefix", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        // Rewound branch
        userTurn("u2", "What is 2+2?", { isOnCurrentBranch: false }),
        assistantTurn("a2", "4", { isOnCurrentBranch: false }),
        // Current branch (after rewind)
        userTurn("u3", "What is 3+3?"),
        assistantTurn("a3", "6"),
      ],
      rewinds: [makeRewind("a1", ["u2", "a2"])],
    });

    const output = formatNarrative(session);

    // Rewound turns should be marked
    expect(output).toContain("[REWIND] USER: What is 2+2?");
    expect(output).toContain("[REWIND] ASSISTANT: 4");

    // Current branch should NOT be marked
    expect(output).toContain("USER: What is 3+3?");
    expect(output).not.toContain("[REWIND] USER: What is 3+3?");
    expect(output).toContain("ASSISTANT: 6");
    expect(output).not.toContain("[REWIND] ASSISTANT: 6");
  });

  test("shows rewind summary in header section", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", "Abandoned", { isOnCurrentBranch: false }),
        userTurn("u3", "Current"),
      ],
      rewinds: [makeRewind("a1", ["u2"])],
    });

    const output = formatNarrative(session);

    expect(output).toContain("REWINDS: 1");
    // Header should be wrapped in separator lines
    expect(output).toContain("─".repeat(40));
  });

  test("does not show rewind info when no rewinds", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      rewinds: [],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("REWINDS");
    expect(output).not.toContain("[REWIND]");
  });
});

describe("formatNarrative with summary", () => {
  test("shows summary header when present", () => {
    const session = makeSession({
      summary: "Claude Code CLI Implementation",
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatNarrative(session);

    expect(output).toContain("★ Claude Code CLI Implementation");
    expect(output).toContain("━"); // Header separator
  });

  test("does not show summary section when no summary", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("★");
    expect(output).not.toContain("━");
  });

  test("shows summary before other header items", () => {
    const session = makeSession({
      summary: "Test Summary",
      triggeredSkills: ["writing-specs"],
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatNarrative(session);

    // Summary should appear before SKILLS
    const summaryIndex = output.indexOf("★ Test Summary");
    const skillsIndex = output.indexOf("SKILLS:");
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(skillsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeLessThan(skillsIndex);
  });
});

describe("formatNarrative with skills", () => {
  test("shows skills summary in header section", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      triggeredSkills: ["writing-specs"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("SKILLS: writing-specs");
    // Header should be wrapped in separator lines
    expect(output).toContain("─".repeat(40));
  });

  test("shows multiple skills comma-separated", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      triggeredSkills: ["writing-specs", "implementing-specs", "session-retro"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("SKILLS: writing-specs, implementing-specs, session-retro");
  });

  test("does not show header section when no skills or rewinds", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      triggeredSkills: [],
      rewinds: [],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("SKILLS:");
    expect(output).not.toContain("─".repeat(40));
  });

  test("formats Skill tool call with skill name summary", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Skill", { skill: "writing-specs" })],
        }),
      ],
      triggeredSkills: ["writing-specs"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Skill: writing-specs");
  });

  test("shows skills before rewinds in header", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        userTurn("u2", "Abandoned", { isOnCurrentBranch: false }),
      ],
      triggeredSkills: ["writing-specs"],
      rewinds: [makeRewind("u1", ["u2"])],
    });

    const output = formatNarrative(session);

    // Skills should appear before REWINDS
    const skillsIndex = output.indexOf("SKILLS:");
    const rewindsIndex = output.indexOf("REWINDS:");
    expect(skillsIndex).toBeGreaterThan(-1);
    expect(rewindsIndex).toBeGreaterThan(-1);
    expect(skillsIndex).toBeLessThan(rewindsIndex);
  });
});

describe("formatNarrative with commits", () => {
  test("shows commits section when commits exist", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [
        makeCommit("abc1234", "Fix auth callback token validation"),
        makeCommit("def5678", "Add privacy policy page"),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("─── Commits ");
    expect(output).toContain("abc1234  Fix auth callback token validation");
    expect(output).toContain("def5678  Add privacy policy page");
  });

  test("does not show commits section when no commits", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("Commits");
  });

  test("truncates long hashes to 7 characters", () => {
    const fullHash = "abc1234def5678901234567890abcdef12345678";
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [makeCommit(fullHash, "Update seed data")],
    });

    const output = formatNarrative(session);

    expect(output).toContain("abc1234  Update seed data");
    expect(output).not.toContain(fullHash);
  });

  test("shows richer git-history commits when gitCommits available", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      gitCommits: [
        makeGitCommit("abc1234", "fix: login bug", {
          insertions: 42,
          deletions: 7,
        }),
        makeGitCommit("def5678", "feat: add search", {
          insertions: 100,
          deletions: 30,
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("─── Commits ");
    expect(output).toContain("abc1234  fix: login bug  (+42/-7)");
    expect(output).toContain("def5678  feat: add search  (+100/-30)");
  });

  test("prefers gitCommits over regex commits when both present", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [makeCommit("old1234", "old regex commit")],
      gitCommits: [
        makeGitCommit("new1234", "new git commit", {
          insertions: 10,
          deletions: 5,
        }),
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("new1234  new git commit  (+10/-5)");
    expect(output).not.toContain("old1234");
  });

  test("falls back to regex commits when gitCommits is empty", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [makeCommit("abc1234", "Fix auth callback token validation")],
      gitCommits: [],
    });

    const output = formatNarrative(session);

    expect(output).toContain("abc1234  Fix auth callback token validation");
  });

  test("shows gitCommits without diffstats when insertions/deletions undefined", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      gitCommits: [
        makeGitCommit("abc1234", "merge commit"),
      ],
    });

    const output = formatNarrative(session);

    // Should still show the commit but without diffstat suffix
    expect(output).toContain("abc1234  merge commit");
    // No (+/-) suffix when no diffstats
    expect(output).not.toContain("(+");
  });
});

describe("formatMarkdown", () => {
  test("uses summary as title when present", () => {
    const session = makeSession({
      summary: "CLI Tool Implementation",
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("# CLI Tool Implementation");
  });

  test("uses session ID as title when no summary", () => {
    const session = makeSession({
      sessionId: asSessionId("abc123"),
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("# Session abc123");
  });

  test("includes metadata section", () => {
    const session = makeSession({
      sessionId: asSessionId("test-session"),
      cwd: "/test/path",
      model: "claude-opus",
      triggeredSkills: ["writing-specs"],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("## Metadata");
    expect(output).toContain("**Session ID:** test-session");
    expect(output).toContain("**Working Directory:** /test/path");
    expect(output).toContain("**Model:** claude-opus");
    expect(output).toContain("**Skills:** writing-specs");
  });

  test("formats conversation with user and assistant turns", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi there!"),
      ],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("## Conversation");
    expect(output).toContain("### **User**");
    expect(output).toContain("Hello");
    expect(output).toContain("### **Assistant**");
    expect(output).toContain("Hi there!");
  });

  test("formats tool calls as blockquotes", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Let me check", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/index.ts" })],
        }),
      ],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("> 🔧 **Read**: /src/index.ts");
  });
});

describe("formatToolFilter", () => {
  test("shows matching tool calls with count header", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Let me run some commands", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "ls -la" }),
            toolCall("t2", "Read", { file_path: "/src/index.ts" }),
            toolCall("t3", "Bash", { command: "bun test" }),
          ],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash");

    expect(output).toContain("Bash (2 calls)");
    expect(output).toContain("→ Bash: ls -la");
    expect(output).toContain("→ Bash: bun test");
    expect(output).not.toContain("Read");
  });

  test("shows singular 'call' for single match", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "TODO" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "Grep");

    expect(output).toContain("Grep (1 call)");
    expect(output).toContain('→ Grep: pattern="TODO"');
  });

  test("returns not-found message for missing tool", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "echo hi" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "Write");

    expect(output).toBe("No Write calls found in this session.");
  });

  test("is case-sensitive", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "echo hi" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "bash");

    expect(output).toBe("No bash calls found in this session.");
  });

  test("collects calls across multiple turns", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "First", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/a.ts" })],
        }),
        userTurn("u1", "continue"),
        assistantTurn("a2", "Second", {
          toolCalls: [toolCall("t2", "Read", { file_path: "/b.ts" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "Read");

    expect(output).toContain("Read (2 calls)");
    expect(output).toContain("→ Read: /a.ts");
    expect(output).toContain("→ Read: /b.ts");
  });

  test("ignores user turns (only assistant turns have tool calls)", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "do something"),
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "echo test" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash");

    expect(output).toContain("Bash (1 call)");
  });

  test("shows tool input when toolInput flag set", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "bun test" })],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash", { toolInput: true });

    expect(output).toContain("command");
    expect(output).toContain("bun test");
    expect(output).toContain("input:");
  });

  test("shows tool output when toolOutput flag set", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "bun test" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "3 tests passed")],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash", { toolOutput: true });

    expect(output).toContain("3 tests passed");
    expect(output).toContain("output:");
  });

  test("respects truncate for tool output", () => {
    const longOutput = "x".repeat(200);
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "bun test" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", longOutput)],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash", { toolOutput: true, truncate: 50 });

    expect(output).not.toContain(longOutput);
    expect(output).toContain("...");
  });

  test("shows both input and output together", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "bun test" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "3 tests passed")],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash", {
      toolInput: true,
      toolOutput: true,
      truncate: 2000,
    });

    expect(output).toContain("input:");
    expect(output).toContain("command");
    expect(output).toContain("3 tests passed");
  });

  test("backward compatible — no options means summary only", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "bun test" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "3 tests passed")],
        }),
      ],
    });

    const output = formatToolFilter(session, "Bash");

    expect(output).toContain("→ Bash: bun test");
    expect(output).not.toContain("input:");
    expect(output).not.toContain("output:");
    expect(output).not.toContain("3 tests passed");
  });
});

describe("formatNarrative with queued messages", () => {
  test("renders queued messages as USER (queued)", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Working on it", { timestamp: "2025-01-15T10:00:05.000Z" }),
      ],
      queuedMessages: [
        {
          timestamp: "2025-01-15T10:00:03.000Z",
          content: "also check the tests",
        },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("USER (queued): also check the tests");
  });

  test("interleaves queued messages chronologically with turns", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Start", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Working", { timestamp: "2025-01-15T10:00:10.000Z" }),
      ],
      queuedMessages: [
        {
          timestamp: "2025-01-15T10:00:05.000Z",
          content: "mid-turn message",
        },
      ],
    });

    const output = formatNarrative(session);

    // The queued message (T+5s) should appear between the user turn (T+0s) and assistant turn (T+10s)
    const startIdx = output.indexOf("USER: Start");
    const queuedIdx = output.indexOf("USER (queued): mid-turn message");
    const assistIdx = output.indexOf("ASSISTANT: Working");

    expect(startIdx).toBeGreaterThan(-1);
    expect(queuedIdx).toBeGreaterThan(-1);
    expect(assistIdx).toBeGreaterThan(-1);
    expect(startIdx).toBeLessThan(queuedIdx);
    expect(queuedIdx).toBeLessThan(assistIdx);
  });

  test("renders without queued messages when none exist", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("USER (queued)");
    expect(output).toContain("USER: Hello");
    expect(output).toContain("ASSISTANT: Hi!");
  });

  test("handles multiple queued messages", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Go", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Done", { timestamp: "2025-01-15T10:05:00.000Z" }),
      ],
      queuedMessages: [
        { timestamp: "2025-01-15T10:01:00.000Z", content: "first nudge" },
        { timestamp: "2025-01-15T10:03:00.000Z", content: "second nudge" },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("USER (queued): first nudge");
    expect(output).toContain("USER (queued): second nudge");

    // Verify ordering
    const firstIdx = output.indexOf("USER (queued): first nudge");
    const secondIdx = output.indexOf("USER (queued): second nudge");
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});

// ============================================================================
// COMPACTION DISPLAY
// ============================================================================

describe("formatNarrative with compactions", () => {
  const LONG_SUMMARY =
    "This session is being continued from a previous conversation that ran out of context. The main focus of the work has been implementing a session CLI tool for parsing and displaying Claude Code sessions. " +
    "A".repeat(16000);

  test("inserts compaction boundary marker before summary turn", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing after compaction"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should contain a compaction marker line
    expect(output).toContain("Compaction #1");
    // The marker should appear before the compaction summary
    const markerIdx = output.indexOf("Compaction #1");
    const summaryIdx = output.indexOf("USER (compaction summary):");
    expect(markerIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(markerIdx).toBeLessThan(summaryIdx);
  });

  test("includes trigger and token count in boundary marker", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should contain trigger info
    expect(output).toContain("auto");
    // Should contain token count (172k)
    expect(output).toContain("172k");
  });

  test("includes segment context in boundary marker", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // 1 compaction = 2 segments
    expect(output).toContain("Segment 2 of 2");
  });

  test("truncates compaction summary content with char count", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should show the beginning of the summary text
    expect(output).toContain("This session is being continued");
    // Should NOT contain the full 16k+ summary
    expect(output.length).toBeLessThan(LONG_SUMMARY.length);
    // Should show truncation indicator with char count
    expect(output).toMatch(/\d[\d,]+ chars/);
    expect(output).toContain("compaction summary truncated");
  });

  test("labels compaction summary turns differently from regular user turns", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should use distinct label for compaction summaries
    expect(output).toContain("USER (compaction summary):");
    // Regular user turn should remain as-is
    expect(output).toContain("USER: Hello");
    // Should NOT have bare "USER:" for the compaction summary
    const lines = output.split("\n");
    const compactionLines = lines.filter(
      (l) => l.includes("This session is being continued")
    );
    for (const line of compactionLines) {
      expect(line).not.toMatch(/^USER: This session/);
    }
  });

  test("handles multiple compactions with correct numbering", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "After first compaction"),
        userTurn("u3", "More work"),
        assistantTurn("a3", "Done"),
        userTurn("u4", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a4", "After second compaction"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
        makeCompaction("2025-01-15T16:20:00.000Z", 174000, {
          summaryMessageUuid: asEntryUuid("u4"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should number compactions sequentially
    expect(output).toContain("Compaction #1");
    expect(output).toContain("Compaction #2");
    // Should show correct segment context (2 compactions = 3 segments)
    expect(output).toContain("Segment 2 of 3");
    expect(output).toContain("Segment 3 of 3");
  });

  test("uses heavy separator characters for visual distinction", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", LONG_SUMMARY, { isCompactionSummary: true }),
        assistantTurn("a2", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Should use heavy box-drawing characters (━) for compaction markers
    // to visually distinguish from regular section separators (─)
    expect(output).toContain("━━━");
  });

  test("session with no compactions renders identically to before", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", "Follow up"),
        assistantTurn("a2", "Sure!"),
      ],
    });

    const output = formatNarrative(session);

    // No compaction markers
    expect(output).not.toContain("Compaction");
    expect(output).not.toContain("compaction summary");
    expect(output).not.toContain("Segment");
    // Normal rendering
    expect(output).toContain("USER: Hello");
    expect(output).toContain("ASSISTANT: Hi!");
  });

  test("compaction summary with short text still gets truncation treatment", () => {
    const shortSummary = "This session is being continued from a previous conversation.";
    const session = makeSession({
      turns: [
        userTurn("u1", shortSummary, { isCompactionSummary: true }),
        assistantTurn("a1", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 50000, {
          summaryMessageUuid: asEntryUuid("u1"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // Short summaries should still be labeled as compaction summaries
    expect(output).toContain("USER (compaction summary):");
    // Should still have the marker
    expect(output).toContain("Compaction #1");
  });

  test("trims trailing newlines from compaction summary text", () => {
    const summaryWithTrailingNewlines = "This session is being continued.\n\n\n\n";
    const session = makeSession({
      turns: [
        userTurn("u1", summaryWithTrailingNewlines, { isCompactionSummary: true }),
        assistantTurn("a1", "Continuing"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 50000, {
          summaryMessageUuid: asEntryUuid("u1"),
        }),
      ],
    });

    const output = formatNarrative(session);

    // The summary text should be trimmed — no 4+ blank lines
    expect(output).toContain("This session is being continued.");
    expect(output).not.toContain("continued.\n\n\n");
  });

  test("compaction markers appear in correct position with queued messages", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Hi!", { timestamp: "2025-01-15T10:01:00.000Z" }),
        userTurn("u2", LONG_SUMMARY, {
          isCompactionSummary: true,
          timestamp: "2025-01-15T14:55:00.000Z",
        }),
        assistantTurn("a2", "Continuing", { timestamp: "2025-01-15T14:56:00.000Z" }),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00.000Z", 172000, {
          summaryMessageUuid: asEntryUuid("u2"),
        }),
      ],
      queuedMessages: [
        { timestamp: "2025-01-15T10:00:30.000Z", content: "also do X" },
      ],
    });

    const output = formatNarrative(session);

    // Should contain both queued message and compaction marker
    expect(output).toContain("USER (queued): also do X");
    expect(output).toContain("Compaction #1");
    // Queued message should be before compaction
    const queuedIdx = output.indexOf("USER (queued):");
    const compactionIdx = output.indexOf("Compaction #1");
    expect(queuedIdx).toBeLessThan(compactionIdx);
  });
});

// ============================================================================
// MULTI-TOOL FILTER
// ============================================================================

describe("formatToolFilter with multiple tools", () => {
  test("--tools Bash,Edit shows both, excludes Read", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Working", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "ls" }),
            toolCall("t2", "Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }),
            toolCall("t3", "Read", { file_path: "/b.ts" }),
          ],
        }),
      ],
    });

    const output = formatToolFilter(session, ["Bash", "Edit"]);

    expect(output).toContain("Bash");
    expect(output).toContain("Edit");
    expect(output).not.toContain("Read");
  });

  test("header shows comma-separated tool names", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "ls" }),
            toolCall("t2", "Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }),
          ],
        }),
      ],
    });

    const output = formatToolFilter(session, ["Bash", "Edit"]);

    expect(output).toContain("Bash, Edit");
  });

  test("single-element array works same as string", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "echo hi" }),
            toolCall("t2", "Read", { file_path: "/b.ts" }),
          ],
        }),
      ],
    });

    const arrayOutput = formatToolFilter(session, ["Bash"]);
    const stringOutput = formatToolFilter(session, "Bash");

    // Both should show Bash and exclude Read
    expect(arrayOutput).toContain("Bash");
    expect(arrayOutput).not.toContain("Read");
    expect(stringOutput).toContain("Bash");
    expect(stringOutput).not.toContain("Read");
  });

  test("--tools with --tool-output shows results", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "bun test" }),
            toolCall("t2", "Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }),
          ],
        }),
        userTurn("u1", "", {
          toolResults: [
            toolResult("t1", "3 tests passed"),
            toolResult("t2", "File edited"),
          ],
        }),
      ],
    });

    const output = formatToolFilter(session, ["Bash", "Edit"], { toolOutput: true });

    expect(output).toContain("3 tests passed");
    expect(output).toContain("File edited");
  });

  test("returns not-found message when no tools match array", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "echo hi" })],
        }),
      ],
    });

    const output = formatToolFilter(session, ["Write", "Glob"]);

    expect(output).toBe("No Write, Glob calls found in this session.");
  });

  test("counts calls across multiple tool types correctly", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Bash", { command: "ls" }),
            toolCall("t2", "Bash", { command: "pwd" }),
            toolCall("t3", "Edit", { file_path: "/a.ts", old_string: "x", new_string: "y" }),
          ],
        }),
      ],
    });

    const output = formatToolFilter(session, ["Bash", "Edit"]);

    expect(output).toContain("3 calls");
  });
});

// ============================================================================
// DEDUP TASK NOTIFICATIONS
// ============================================================================

describe("dedupTaskNotifications", () => {
  test("two turns with same task-id: only the later one kept", () => {
    const turns = [
      userTurn("u1", "Hello"),
      userTurn("u2", "<task-notification><task-id>task-abc</task-id>queued</task-notification>"),
      assistantTurn("a1", "Working"),
      userTurn("u3", "<task-notification><task-id>task-abc</task-id>result: done</task-notification>"),
    ];

    const result = dedupTaskNotifications(turns);

    expect(result).toHaveLength(3);
    // u2 (the earlier occurrence) should be removed
    expect(result[0].uuid).toEqual(asEntryUuid("u1"));
    expect(result[1].uuid).toEqual(asEntryUuid("a1"));
    expect(result[2].uuid).toEqual(asEntryUuid("u3"));
  });

  test("turns without task notifications unchanged", () => {
    const turns = [
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi!"),
      userTurn("u2", "How are you?"),
    ];

    const result = dedupTaskNotifications(turns);

    expect(result).toHaveLength(3);
    expect(result[0].uuid).toEqual(asEntryUuid("u1"));
    expect(result[1].uuid).toEqual(asEntryUuid("a1"));
    expect(result[2].uuid).toEqual(asEntryUuid("u2"));
  });

  test("three turns with same task-id: only last kept", () => {
    const turns = [
      userTurn("u1", "<task-notification><task-id>task-xyz</task-id>queued</task-notification>"),
      userTurn("u2", "<task-notification><task-id>task-xyz</task-id>in-progress</task-notification>"),
      userTurn("u3", "<task-notification><task-id>task-xyz</task-id>done</task-notification>"),
    ];

    const result = dedupTaskNotifications(turns);

    expect(result).toHaveLength(1);
    expect(result[0].uuid).toEqual(asEntryUuid("u3"));
  });

  test("different task-ids both preserved", () => {
    const turns = [
      userTurn("u1", "<task-notification><task-id>task-aaa</task-id>queued</task-notification>"),
      userTurn("u2", "<task-notification><task-id>task-bbb</task-id>queued</task-notification>"),
      userTurn("u3", "<task-notification><task-id>task-aaa</task-id>done</task-notification>"),
      userTurn("u4", "<task-notification><task-id>task-bbb</task-id>done</task-notification>"),
    ];

    const result = dedupTaskNotifications(turns);

    expect(result).toHaveLength(2);
    expect(result[0].uuid).toEqual(asEntryUuid("u3"));
    expect(result[1].uuid).toEqual(asEntryUuid("u4"));
  });

  test("empty array returns empty", () => {
    expect(dedupTaskNotifications([])).toHaveLength(0);
  });

  test("single turn with task notification is preserved", () => {
    const turns = [
      userTurn("u1", "<task-notification><task-id>task-solo</task-id>result</task-notification>"),
    ];

    const result = dedupTaskNotifications(turns);

    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// COMMIT INTERLEAVING (--commits flag)
// ============================================================================

describe("formatNarrative with commits interleaved (commits: true)", () => {
  test("interleaves commits chronologically with turns when commits option is true", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Fix the login bug", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Fixed it", { timestamp: "2025-01-15T10:01:00.000Z" }),
        userTurn("u2", "Now add tests", { timestamp: "2025-01-15T10:05:00.000Z" }),
        assistantTurn("a2", "Tests added", { timestamp: "2025-01-15T10:06:00.000Z" }),
      ],
      gitCommits: [
        makeGitCommit("abc1234", "fix: login bug", {
          timestamp: "2025-01-15T10:02:00+00:00",
          insertions: 10,
          deletions: 3,
        }),
        makeGitCommit("def5678", "test: add login tests", {
          timestamp: "2025-01-15T10:07:00+00:00",
          insertions: 42,
          deletions: 0,
        }),
      ],
    });

    const output = formatNarrative(session, { commits: true });

    // First commit should appear between first assistant turn and second user turn
    const fixedIdx = output.indexOf("ASSISTANT: Fixed it");
    const commitIdx = output.indexOf("commit abc1234");
    const testsIdx = output.indexOf("USER: Now add tests");
    expect(fixedIdx).toBeGreaterThan(-1);
    expect(commitIdx).toBeGreaterThan(-1);
    expect(testsIdx).toBeGreaterThan(-1);
    expect(fixedIdx).toBeLessThan(commitIdx);
    expect(commitIdx).toBeLessThan(testsIdx);

    // Second commit should appear after the last assistant turn
    const testCommitIdx = output.indexOf("commit def5678");
    const testsAddedIdx = output.indexOf("ASSISTANT: Tests added");
    expect(testCommitIdx).toBeGreaterThan(-1);
    expect(testsAddedIdx).toBeGreaterThan(-1);
    expect(testsAddedIdx).toBeLessThan(testCommitIdx);
  });

  test("commit block includes subject and stats", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Go", { timestamp: "2025-01-15T10:00:00.000Z" }),
      ],
      gitCommits: [
        makeGitCommit("abc1234", "fix: resolve login bug", {
          timestamp: "2025-01-15T10:01:00+00:00",
          insertions: 42,
          deletions: 7,
          filesChanged: 3,
        }),
      ],
    });

    const output = formatNarrative(session, { commits: true });

    expect(output).toContain("commit abc1234");
    expect(output).toContain("fix: resolve login bug");
    expect(output).toContain("+42");
    expect(output).toContain("-7");
    expect(output).toContain("3 files");
  });

  test("commit block omits stats when none available", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Go", { timestamp: "2025-01-15T10:00:00.000Z" }),
      ],
      gitCommits: [
        makeGitCommit("abc1234", "merge commit", {
          timestamp: "2025-01-15T10:01:00+00:00",
        }),
      ],
    });

    const output = formatNarrative(session, { commits: true });

    expect(output).toContain("commit abc1234");
    expect(output).toContain("merge commit");
    // No stats parenthetical
    expect(output).not.toContain("+");
    expect(output).not.toContain("files");
  });

  test("without commits flag, gitCommits are appended at end (existing behavior)", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Fix the login bug", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Fixed it", { timestamp: "2025-01-15T10:01:00.000Z" }),
      ],
      gitCommits: [
        makeGitCommit("abc1234", "fix: login bug", {
          timestamp: "2025-01-15T10:02:00+00:00",
          insertions: 10,
          deletions: 3,
        }),
      ],
    });

    // Default (no commits option) should NOT interleave
    const output = formatNarrative(session);

    // Should have the old-style commits section at end
    expect(output).toContain("─── Commits ");
    expect(output).toContain("abc1234  fix: login bug");
    // Should NOT have interleaved commit blocks
    expect(output).not.toContain("commit abc1234");
  });

  test("interleaving works with empty gitCommits array", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello", { timestamp: "2025-01-15T10:00:00.000Z" }),
        assistantTurn("a1", "Hi!", { timestamp: "2025-01-15T10:01:00.000Z" }),
      ],
      gitCommits: [],
    });

    const output = formatNarrative(session, { commits: true });

    // Should render normally without commits
    expect(output).toContain("USER: Hello");
    expect(output).toContain("ASSISTANT: Hi!");
    expect(output).not.toContain("commit ");
  });

  test("commit block uses box-drawing characters for visual separators", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Go", { timestamp: "2025-01-15T10:00:00.000Z" }),
      ],
      gitCommits: [
        makeGitCommit("abc1234", "feat: new thing", {
          timestamp: "2025-01-15T10:01:00+00:00",
        }),
      ],
    });

    const output = formatNarrative(session, { commits: true });

    // Commit blocks should use box-drawing dash characters
    expect(output).toContain("──");
    expect(output).toContain("─".repeat(40));
  });
});
