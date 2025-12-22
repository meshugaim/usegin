import { test, expect, describe } from "bun:test";
import { formatNarrative, formatMarkdown } from "./formatter";
import type { ParsedSession } from "./types";

// Helper to create a basic session with required fields
function makeSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: "s1",
    cwd: "/test",
    model: "claude",
    tools: [],
    turns: [],
    subagents: [],
    rewinds: [],
    triggeredSkills: [],
    ...overrides,
  };
}

describe("formatNarrative", () => {
  test("formats basic user/assistant turns", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
        { role: "assistant", text: "Hi there!", toolCalls: [], toolResults: [], uuid: "a1", isOnCurrentBranch: true },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("USER: Hello");
    expect(output).toContain("ASSISTANT: Hi there!");
  });

  test("formats tool calls with summary", () => {
    const session = makeSession({
      turns: [
        {
          role: "assistant",
          text: "Let me check",
          toolCalls: [
            { id: "t1", name: "Read", input: { file_path: "/src/index.ts" } },
          ],
          toolResults: [],
          uuid: "a1",
        },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Read: /src/index.ts");
  });

  test("includes tool input when flag set", () => {
    const session = makeSession({
      turns: [
        {
          role: "assistant",
          text: "",
          toolCalls: [
            { id: "t1", name: "Grep", input: { pattern: "TODO", path: "src/" } },
          ],
          toolResults: [],
          uuid: "a1",
        },
      ],
    });

    const output = formatNarrative(session, { toolInput: true });

    expect(output).toContain("input:");
    expect(output).toContain('"pattern": "TODO"');
  });

  test("includes tool output when flag set", () => {
    const session = makeSession({
      turns: [
        {
          role: "user",
          text: "",
          toolCalls: [],
          toolResults: [
            { toolUseId: "t1", content: "Found 3 matches", isError: false },
          ],
          uuid: "u1",
        },
      ],
    });

    const output = formatNarrative(session, { toolOutput: true });

    expect(output).toContain("output: Found 3 matches");
  });

  test("shows error prefix for failed tool results", () => {
    const session = makeSession({
      turns: [
        {
          role: "user",
          text: "",
          toolCalls: [],
          toolResults: [
            { toolUseId: "t1", content: "File not found", isError: true },
          ],
          uuid: "u1",
        },
      ],
    });

    const output = formatNarrative(session, { toolOutput: true });

    expect(output).toContain("error: File not found");
  });

  test("truncates long output", () => {
    const session = makeSession({
      turns: [
        {
          role: "user",
          text: "",
          toolCalls: [],
          toolResults: [
            { toolUseId: "t1", content: "x".repeat(1000), isError: false },
          ],
          uuid: "u1",
        },
      ],
    });

    const output = formatNarrative(session, { toolOutput: true, truncate: 100 });

    expect(output.length).toBeLessThan(500);
    expect(output).toContain("...");
  });

  test("formats Bash command summary", () => {
    const session = makeSession({
      turns: [
        {
          role: "assistant",
          text: "",
          toolCalls: [
            { id: "t1", name: "Bash", input: { command: "ls -la" } },
          ],
          toolResults: [],
          uuid: "a1",
        },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Bash: ls -la");
  });

  test("formats Grep pattern summary", () => {
    const session = makeSession({
      turns: [
        {
          role: "assistant",
          text: "",
          toolCalls: [
            { id: "t1", name: "Grep", input: { pattern: "handleLogin" } },
          ],
          toolResults: [],
          uuid: "a1",
        },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain('→ Grep: pattern="handleLogin"');
  });
});

describe("formatNarrative with subagents", () => {
  test("does not show subagents section by default", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
      subagents: [
        {
          agentId: "agent-123",
          sessionId: "s1",
          turns: [
            { role: "assistant", text: "Subagent work", toolCalls: [], toolResults: [], uuid: "sa1", isOnCurrentBranch: true },
          ],
          startTimestamp: "2025-01-01T10:00:00.000Z",
        },
      ],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("SUBAGENTS");
    expect(output).not.toContain("agent-123");
  });

  test("shows subagents section when includeSubagents is true", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
      subagents: [
        {
          agentId: "agent-123",
          sessionId: "s1",
          turns: [
            { role: "assistant", text: "Subagent work", toolCalls: [], toolResults: [], uuid: "sa1", isOnCurrentBranch: true },
          ],
          startTimestamp: "2025-01-01T10:00:00.000Z",
        },
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
        {
          agentId: "agent-aaa",
          sessionId: "s1",
          turns: [
            { role: "assistant", text: "First agent", toolCalls: [], toolResults: [], uuid: "a1", isOnCurrentBranch: true },
          ],
        },
        {
          agentId: "agent-bbb",
          sessionId: "s1",
          turns: [
            { role: "assistant", text: "Second agent", toolCalls: [], toolResults: [], uuid: "a2", isOnCurrentBranch: true },
          ],
        },
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
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
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
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
        { role: "assistant", text: "Hi!", toolCalls: [], toolResults: [], uuid: "a1", isOnCurrentBranch: true },
        // Rewound branch
        { role: "user", text: "What is 2+2?", toolCalls: [], toolResults: [], uuid: "u2", isOnCurrentBranch: false },
        { role: "assistant", text: "4", toolCalls: [], toolResults: [], uuid: "a2", isOnCurrentBranch: false },
        // Current branch (after rewind)
        { role: "user", text: "What is 3+3?", toolCalls: [], toolResults: [], uuid: "u3", isOnCurrentBranch: true },
        { role: "assistant", text: "6", toolCalls: [], toolResults: [], uuid: "a3", isOnCurrentBranch: true },
      ],
      rewinds: [{ fromUuid: "a1", abandonedBranchUuids: ["u2", "a2"] }],
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
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
        { role: "assistant", text: "Hi!", toolCalls: [], toolResults: [], uuid: "a1", isOnCurrentBranch: true },
        { role: "user", text: "Abandoned", toolCalls: [], toolResults: [], uuid: "u2", isOnCurrentBranch: false },
        { role: "user", text: "Current", toolCalls: [], toolResults: [], uuid: "u3", isOnCurrentBranch: true },
      ],
      rewinds: [{ fromUuid: "a1", abandonedBranchUuids: ["u2"] }],
    });

    const output = formatNarrative(session);

    expect(output).toContain("REWINDS: 1");
    // Header should be wrapped in separator lines
    expect(output).toContain("─".repeat(40));
  });

  test("does not show rewind info when no rewinds", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
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
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
    });

    const output = formatNarrative(session);

    expect(output).toContain("★ Claude Code CLI Implementation");
    expect(output).toContain("━"); // Header separator
  });

  test("does not show summary section when no summary", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
    });

    const output = formatNarrative(session);

    expect(output).not.toContain("★");
    expect(output).not.toContain("━");
  });

  test("shows summary before other header items", () => {
    const session = makeSession({
      summary: "Test Summary",
      triggeredSkills: ["writing-specs"],
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
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
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
      triggeredSkills: ["writing-specs"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("SKILLS: writing-specs");
    // Header should be wrapped in separator lines
    expect(output).toContain("─".repeat(40));
  });

  test("shows multiple skills comma-separated", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
      triggeredSkills: ["writing-specs", "implementing-specs", "session-retro"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("SKILLS: writing-specs, implementing-specs, session-retro");
  });

  test("does not show header section when no skills or rewinds", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
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
        {
          role: "assistant",
          text: "",
          toolCalls: [
            { id: "t1", name: "Skill", input: { skill: "writing-specs" } },
          ],
          toolResults: [],
          uuid: "a1",
          isOnCurrentBranch: true,
        },
      ],
      triggeredSkills: ["writing-specs"],
    });

    const output = formatNarrative(session);

    expect(output).toContain("→ Skill: writing-specs");
  });

  test("shows skills before rewinds in header", () => {
    const session = makeSession({
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
        { role: "user", text: "Abandoned", toolCalls: [], toolResults: [], uuid: "u2", isOnCurrentBranch: false },
      ],
      triggeredSkills: ["writing-specs"],
      rewinds: [{ fromUuid: "u1", abandonedBranchUuids: ["u2"] }],
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

describe("formatMarkdown", () => {
  test("uses summary as title when present", () => {
    const session = makeSession({
      summary: "CLI Tool Implementation",
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("# CLI Tool Implementation");
  });

  test("uses session ID as title when no summary", () => {
    const session = makeSession({
      sessionId: "abc123",
      turns: [
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
      ],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("# Session abc123");
  });

  test("includes metadata section", () => {
    const session = makeSession({
      sessionId: "test-session",
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
        { role: "user", text: "Hello", toolCalls: [], toolResults: [], uuid: "u1", isOnCurrentBranch: true },
        { role: "assistant", text: "Hi there!", toolCalls: [], toolResults: [], uuid: "a1", isOnCurrentBranch: true },
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
        {
          role: "assistant",
          text: "Let me check",
          toolCalls: [{ id: "t1", name: "Read", input: { file_path: "/src/index.ts" } }],
          toolResults: [],
          uuid: "a1",
          isOnCurrentBranch: true,
        },
      ],
    });

    const output = formatMarkdown(session);

    expect(output).toContain("> 🔧 **Read**: /src/index.ts");
  });
});
