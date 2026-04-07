/**
 * Tests for bash-history — pure functions that extract and format
 * Bash commands from parsed session turns.
 */

import { describe, it, expect } from "bun:test";
import { extractBashCommands, formatBashEntry, formatBashGrep } from "./bash-history";
import { userTurn, assistantTurn, toolCall, toolResult } from "./testing";

describe("extractBashCommands", () => {
  it("extracts command, description, output from turns", () => {
    const turns = [
      userTurn("u1", "Run the tests"),
      assistantTurn("a1", "Running tests", {
        timestamp: "2025-03-18T10:00:00Z",
        toolCalls: [
          toolCall("t1", "Bash", { command: "bun test", description: "Run all tests" }),
        ],
      }),
      userTurn("u2", "", {
        toolResults: [toolResult("t1", "3 tests passed")],
      }),
    ];

    const commands = extractBashCommands(turns);
    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe("bun test");
    expect(commands[0].description).toBe("Run all tests");
    expect(commands[0].output).toBe("3 tests passed");
    expect(commands[0].isError).toBe(false);
    expect(commands[0].timestamp).toBe("2025-03-18T10:00:00Z");
    expect(commands[0].turnIndex).toBe(1);
  });

  it("pairs tool calls with results by toolUseId", () => {
    const turns = [
      assistantTurn("a1", "Let me check", {
        timestamp: "2025-03-18T10:00:00Z",
        toolCalls: [
          toolCall("t1", "Bash", { command: "ls", description: "List files" }),
          toolCall("t2", "Bash", { command: "pwd", description: "Show directory" }),
        ],
      }),
      userTurn("u1", "", {
        toolResults: [
          toolResult("t2", "/home/user"),
          toolResult("t1", "file1.ts\nfile2.ts"),
        ],
      }),
    ];

    const commands = extractBashCommands(turns);
    expect(commands).toHaveLength(2);
    // First command should get its own result
    expect(commands[0].command).toBe("ls");
    expect(commands[0].output).toBe("file1.ts\nfile2.ts");
    // Second command should get its own result
    expect(commands[1].command).toBe("pwd");
    expect(commands[1].output).toBe("/home/user");
  });

  it("skips non-Bash tool calls", () => {
    const turns = [
      assistantTurn("a1", "Reading file", {
        toolCalls: [
          toolCall("t1", "Read", { file_path: "/test.ts" }),
          toolCall("t2", "Bash", { command: "echo hello", description: "Test" }),
          toolCall("t3", "Write", { file_path: "/out.ts", content: "data" }),
        ],
      }),
      userTurn("u1", "", {
        toolResults: [
          toolResult("t1", "file contents"),
          toolResult("t2", "hello"),
          toolResult("t3", "wrote file"),
        ],
      }),
    ];

    const commands = extractBashCommands(turns);
    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe("echo hello");
  });

  it("handles missing results gracefully", () => {
    const turns = [
      assistantTurn("a1", "Running", {
        timestamp: "2025-03-18T10:00:00Z",
        toolCalls: [
          toolCall("t1", "Bash", { command: "sleep 60", description: "Long wait" }),
        ],
      }),
      // No tool result for t1
    ];

    const commands = extractBashCommands(turns);
    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe("sleep 60");
    expect(commands[0].output).toBe("");
    expect(commands[0].isError).toBe(false);
  });

  it("skips empty commands", () => {
    const turns = [
      assistantTurn("a1", "Hmm", {
        toolCalls: [
          toolCall("t1", "Bash", { command: "", description: "Empty" }),
          toolCall("t2", "Bash", { command: "ls", description: "List" }),
        ],
      }),
      userTurn("u1", "", {
        toolResults: [toolResult("t2", "files")],
      }),
    ];

    const commands = extractBashCommands(turns);
    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe("ls");
  });
});

describe("formatBashEntry", () => {
  it.failing("renders command first, then timestamp + description", () => {
    const entry = formatBashEntry({
      timestamp: "2025-03-18T10:30:00Z",
      description: "Run the test suite",
      command: "bun test src/parser.test.ts",
      output: "",
      isError: false,
      turnIndex: 2,
    });

    const lines = entry.split("\n");
    expect(lines[0]).toBe("$ bun test src/parser.test.ts");
    expect(lines[1]).toContain("2025-03-18 10:30");
    expect(lines[1]).toContain("Run the test suite");
  });

  it("handles missing timestamp", () => {
    const entry = formatBashEntry({
      timestamp: null,
      description: "Quick check",
      command: "whoami",
      output: "",
      isError: false,
      turnIndex: 0,
    });

    // Should not crash, should still show command
    expect(entry).toContain("$ whoami");
    expect(entry).toContain("Quick check");
  });
});

describe("formatBashGrep", () => {
  it("filters by pattern across command, description, output", () => {
    const commands = [
      {
        timestamp: "2025-03-18T10:00:00Z",
        description: "Install deps",
        command: "bun install",
        output: "packages installed",
        isError: false,
        turnIndex: 0,
      },
      {
        timestamp: "2025-03-18T10:01:00Z",
        description: "Run tests",
        command: "bun test",
        output: "FAIL: connection error on postgres",
        isError: true,
        turnIndex: 1,
      },
      {
        timestamp: "2025-03-18T10:02:00Z",
        description: "Check database",
        command: "pg_isready",
        output: "accepting connections",
        isError: false,
        turnIndex: 2,
      },
    ];

    // Match in output
    const result1 = formatBashGrep(commands, "postgres");
    expect(result1).toContain("1 command(s)");
    expect(result1).toContain("bun test");

    // Match in command
    const result2 = formatBashGrep(commands, "pg_isready");
    expect(result2).toContain("1 command(s)");
    expect(result2).toContain("pg_isready");

    // Match in description
    const result3 = formatBashGrep(commands, "Install");
    expect(result3).toContain("1 command(s)");
    expect(result3).toContain("bun install");
  });

  it("returns no-match message", () => {
    const commands = [
      {
        timestamp: "2025-03-18T10:00:00Z",
        description: "List files",
        command: "ls",
        output: "file1.ts",
        isError: false,
        turnIndex: 0,
      },
    ];

    const result = formatBashGrep(commands, "nonexistent-pattern-xyz");
    expect(result).toContain("No commands matching");
    expect(result).toContain("nonexistent-pattern-xyz");
  });
});
