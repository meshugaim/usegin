import { test, expect, describe } from "bun:test";
import { formatTerminal } from "./formatter";
import {
  makeSession,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";

// =============================================================================
// HELPER FUNCTIONS (tested through formatTerminal since they're not exported)
// =============================================================================

describe("formatTerminal helpers", () => {
  describe("truncateLines (via Bash tool result)", () => {
    test("shows all lines when at limit", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "ls" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "line1\nline2\nline3\nline4")],
          }),
        ],
      });

      const output = formatTerminal(session);

      expect(output).toContain("line1");
      expect(output).toContain("line4");
      expect(output).not.toContain("… +");
    });

    test("truncates when over limit", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "ls" })],
          }),
          userTurn("u1", "", {
            toolResults: [
              toolResult("t1", "line1\nline2\nline3\nline4\nline5\nline6\nline7"),
            ],
          }),
        ],
      });

      const output = formatTerminal(session);

      expect(output).toContain("line1");
      expect(output).toContain("… +3 lines (ctrl+o to expand)");
    });

    test("handles empty content in Bash result", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "true" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "")],
          }),
        ],
      });

      const output = formatTerminal(session);

      expect(output).toContain("(No output)");
    });

    test("handles single line content", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "echo hi" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "hi")],
          }),
        ],
      });

      const output = formatTerminal(session);

      expect(output).toContain("⎿ hi");
      expect(output).not.toContain("… +");
    });
  });

  describe("stripAnsi (via tool results)", () => {
    test("strips ANSI escape codes from content", () => {
      // Use Bash since it renders raw content (unlike Read which just shows line count)
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "echo" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "\x1b[32mgreen text\x1b[0m")],
          }),
        ],
      });

      const output = formatTerminal(session);

      expect(output).toContain("green text");
      expect(output).not.toContain("\x1b[32m");
      expect(output).not.toContain("\x1b[0m");
    });

    test("passes through content with no ANSI codes unchanged", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "plain text\nsecond line")],
          }),
        ],
      });

      const output = formatTerminal(session);

      // Read shows line count
      expect(output).toContain("Read 2 lines");
    });

    test("handles empty string", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [toolCall("t1", "Bash", { command: "noop" })],
          }),
          userTurn("u1", "", {
            toolResults: [toolResult("t1", "  ")],
          }),
        ],
      });

      const output = formatTerminal(session);

      // Empty/whitespace Bash output shows (No output)
      expect(output).toContain("(No output)");
    });
  });
});

// =============================================================================
// TOOL PARAMETER FORMATTING (getTerminalToolParams via formatTerminalToolCall)
// =============================================================================

describe("formatTerminal tool parameters", () => {
  test("Read shows file path", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/index.ts" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Read(/src/index.ts)");
  });

  test("Write shows file path", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Write", { file_path: "/src/new.ts", content: "hello" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Write(/src/new.ts)");
  });

  test("Edit shows file path", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Edit", {
              file_path: "/src/app.ts",
              old_string: "foo",
              new_string: "bar",
            }),
          ],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Edit(/src/app.ts)");
  });

  test("Bash shows command", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "ls -la" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Bash(ls -la)");
  });

  test("Bash truncates long commands at 70 characters", () => {
    const longCommand = "a".repeat(80);
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: longCommand })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Bash(" + "a".repeat(70) + "...)");
    expect(output).not.toContain("a".repeat(80));
  });

  test("Grep shows pattern without path", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "TODO" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain('● Grep(pattern: "TODO")');
  });

  test("Grep shows pattern and path when both present", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "handleLogin", path: "src/" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain('● Grep(pattern: "handleLogin", path: "src/")');
  });

  test("Search shows same format as Grep", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Search", { pattern: "error" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain('● Search(pattern: "error")');
  });

  test("Glob shows pattern", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Glob", { pattern: "**/*.ts" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain('● Glob(pattern: "**/*.ts")');
  });

  test("default fallback uses first short string value", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "UnknownTool", { query: "test query" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● UnknownTool(test query)");
  });

  test("default fallback shows tool name only when no short string inputs", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "AskUserQuestion", {})],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● AskUserQuestion");
    // Should not have parentheses with empty params
    expect(output).not.toContain("● AskUserQuestion(");
  });
});

// =============================================================================
// TOOL RESULT FORMATTING
// =============================================================================

describe("formatTerminal tool results", () => {
  test("Read shows line count", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "line1\nline2\nline3")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Read 3 lines");
  });

  test("Grep shows match count", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Grep", { pattern: "TODO" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "src/a.ts:1:TODO fix\nsrc/b.ts:3:TODO refactor")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Found 2 matches");
  });

  test("Search shows match count (same as Grep)", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Search", { pattern: "error" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "file1.ts\nfile2.ts\nfile3.ts")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Found 3 matches");
  });

  test("Glob shows file count", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Glob", { pattern: "**/*.ts" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "src/a.ts\nsrc/b.ts")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Found 2 files");
  });

  test("Bash truncates output to 4 lines", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "find ." })],
        }),
        userTurn("u1", "", {
          toolResults: [
            toolResult("t1", "line1\nline2\nline3\nline4\nline5\nline6"),
          ],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ line1");
    expect(output).toContain("line4");
    expect(output).toContain("… +2 lines (ctrl+o to expand)");
  });

  test("Bash shows (No output) for empty result", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "true" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ (No output)");
  });

  test("error results show Error prefix", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/missing.ts" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "File not found: /missing.ts", true)],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Error: File not found: /missing.ts");
  });

  test("error results truncate long errors to 3 lines", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Bash", { command: "fail" })],
        }),
        userTurn("u1", "", {
          toolResults: [
            toolResult("t1", "err1\nerr2\nerr3\nerr4\nerr5", true),
          ],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("⎿ Error: err1");
    expect(output).toContain("err3");
    expect(output).toContain("… +2 lines (ctrl+o to expand)");
  });

  test("default tool with empty output produces no result line", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Write", { file_path: "/test.ts", content: "x" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "")],
        }),
      ],
    });

    const output = formatTerminal(session);

    // Write with empty result should not produce a ⎿ line
    expect(output).toContain("● Write(/test.ts)");
    expect(output).not.toContain("⎿");
  });
});

// =============================================================================
// MAIN FORMATTER INTEGRATION
// =============================================================================

describe("formatTerminal", () => {
  test("formats basic user turn with > prefix", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello world")],
    });

    const output = formatTerminal(session);

    expect(output).toContain("> Hello world");
  });

  test("formats basic assistant text with bullet prefix", () => {
    const session = makeSession({
      turns: [assistantTurn("a1", "Here is my response")],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Here is my response");
  });

  test("formats tool call display", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/app.ts" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Read(/src/app.ts)");
  });

  test("pairs tool call with result via toolUseId", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
        }),
        userTurn("u1", "", {
          toolResults: [toolResult("t1", "const x = 1;\nconst y = 2;")],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Read(/test.ts)");
    expect(output).toContain("⎿ Read 2 lines");
  });

  test("handles result not found for a tool call", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
        }),
        // Next turn has a result but for a different tool use ID
        userTurn("u1", "", {
          toolResults: [toolResult("t-other", "some content")],
        }),
      ],
    });

    const output = formatTerminal(session);

    // Tool call shows but no result line
    expect(output).toContain("● Read(/test.ts)");
    expect(output).not.toContain("⎿");
  });

  test("formats multiple tool calls in one turn", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Let me check multiple files", {
          toolCalls: [
            toolCall("t1", "Read", { file_path: "/src/a.ts" }),
            toolCall("t2", "Read", { file_path: "/src/b.ts" }),
            toolCall("t3", "Bash", { command: "ls" }),
          ],
        }),
        userTurn("u1", "", {
          toolResults: [
            toolResult("t1", "content a"),
            toolResult("t2", "content b\nline2"),
            toolResult("t3", "file1\nfile2"),
          ],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Let me check multiple files");
    expect(output).toContain("● Read(/src/a.ts)");
    expect(output).toContain("⎿ Read 1 lines");
    expect(output).toContain("● Read(/src/b.ts)");
    expect(output).toContain("⎿ Read 2 lines");
    expect(output).toContain("● Bash(ls)");
    expect(output).toContain("⎿ file1");
  });

  test("skips rewound turns (isOnCurrentBranch: false)", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "First attempt"),
        assistantTurn("a1", "Bad response", { isOnCurrentBranch: false }),
        userTurn("u2", "Second attempt", { isOnCurrentBranch: false }),
        assistantTurn("a2", "Good response"),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("> First attempt");
    expect(output).not.toContain("Bad response");
    expect(output).not.toContain("Second attempt");
    expect(output).toContain("● Good response");
  });

  test("indents multiline user message", () => {
    const session = makeSession({
      turns: [userTurn("u1", "First line\nSecond line\nThird line")],
    });

    const output = formatTerminal(session);

    expect(output).toContain("> First line");
    expect(output).toContain("Second line");
    expect(output).toContain("Third line");
  });

  test("empty session produces empty output", () => {
    const session = makeSession({ turns: [] });

    const output = formatTerminal(session);

    expect(output).toBe("");
  });

  test("full conversation flow with user, assistant, tool call, and result", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Fix the bug in app.ts"),
        assistantTurn("a1", "Let me look at the file", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/app.ts" })],
        }),
        userTurn("u2", "", {
          toolResults: [toolResult("t1", "function buggy() {\n  return null;\n}")],
        }),
        assistantTurn("a2", "I found the issue", {
          toolCalls: [
            toolCall("t2", "Edit", {
              file_path: "/src/app.ts",
              old_string: "return null;",
              new_string: "return value;",
            }),
          ],
        }),
        userTurn("u3", "", {
          toolResults: [toolResult("t2", "File edited successfully")],
        }),
        assistantTurn("a3", "Fixed the bug by replacing null with value"),
      ],
    });

    const output = formatTerminal(session);

    // Verify conversation flow ordering
    const lines = output.split("\n");
    const userIdx = lines.findIndex((l) => l.includes("> Fix the bug"));
    const readIdx = lines.findIndex((l) => l.includes("● Read(/src/app.ts)"));
    const readResultIdx = lines.findIndex((l) => l.includes("⎿ Read 3 lines"));
    const editIdx = lines.findIndex((l) => l.includes("● Edit(/src/app.ts)"));
    const fixedIdx = lines.findIndex((l) => l.includes("● Fixed the bug"));

    expect(userIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeGreaterThan(userIdx);
    expect(readResultIdx).toBeGreaterThan(readIdx);
    expect(editIdx).toBeGreaterThan(readResultIdx);
    expect(fixedIdx).toBeGreaterThan(editIdx);
  });

  test("assistant text and tool calls in same turn both appear", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Checking the file", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
        }),
      ],
    });

    const output = formatTerminal(session);

    expect(output).toContain("● Checking the file");
    expect(output).toContain("● Read(/test.ts)");
  });
});
