import { test, expect, describe } from "bun:test";
import { formatNarrative, formatMarkdown, formatToolFilter } from "./formatter";
import {
  makeSession,
  makeSubagent,
  makeRewind,
  makeCommit,
  makeGitCommit,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";
import { asSessionId } from "./types";

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
});
