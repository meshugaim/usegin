/**
 * Tests for typed tool inputs (ENG-1396)
 *
 * These tests verify that:
 * 1. ToolInputMap defines inputs for common tools
 * 2. ToolUseContent can be generically typed
 * 3. Type guards work correctly
 * 4. Unknown tools fall back to Record<string, unknown>
 *
 * ## Why typed tool inputs?
 *
 * Currently, tool inputs are `Record<string, unknown>`, requiring unsafe casts:
 * ```ts
 * const filePath = input.file_path as string;  // Unsafe!
 * ```
 *
 * With ToolInputMap, we get compile-time safety:
 * ```ts
 * if (isToolInput("Read", input)) {
 *   const filePath = input.file_path;  // Type: string
 * }
 * ```
 */

import { describe, it, expect } from "bun:test";
import {
  type ToolInputMap,
  type ToolUseContent,
  type ToolCall,
  type TypedToolUseContent,
  isKnownToolName,
  getToolInput,
  getToolCallInput,
  asToolUseId,
  normalizeToolResultContent,
} from "./types";

describe("ToolInputMap", () => {
  describe("known tool types", () => {
    it("defines Read tool input", () => {
      // Type-level test: this should compile
      const readInput: ToolInputMap["Read"] = {
        file_path: "/src/index.ts",
        offset: 0,
        limit: 100,
      };

      expect(readInput.file_path).toBe("/src/index.ts");
      expect(readInput.offset).toBe(0);
      expect(readInput.limit).toBe(100);
    });

    it("Read tool requires file_path, optional offset/limit", () => {
      // Minimal valid input
      const minimal: ToolInputMap["Read"] = { file_path: "/test.ts" };
      expect(minimal.file_path).toBe("/test.ts");

      // Full input
      const full: ToolInputMap["Read"] = {
        file_path: "/test.ts",
        offset: 10,
        limit: 50,
      };
      expect(full.offset).toBe(10);
    });

    it("defines Write tool input", () => {
      const writeInput: ToolInputMap["Write"] = {
        file_path: "/src/new.ts",
        content: "export const x = 1;",
      };

      expect(writeInput.file_path).toBe("/src/new.ts");
      expect(writeInput.content).toBe("export const x = 1;");
    });

    it("defines Edit tool input", () => {
      const editInput: ToolInputMap["Edit"] = {
        file_path: "/src/index.ts",
        old_string: "const x = 1;",
        new_string: "const x = 2;",
        replace_all: false,
      };

      expect(editInput.file_path).toBe("/src/index.ts");
      expect(editInput.old_string).toBe("const x = 1;");
      expect(editInput.new_string).toBe("const x = 2;");
      expect(editInput.replace_all).toBe(false);
    });

    it("defines Bash tool input", () => {
      const bashInput: ToolInputMap["Bash"] = {
        command: "ls -la",
        description: "List files",
        timeout: 30000,
      };

      expect(bashInput.command).toBe("ls -la");
      expect(bashInput.description).toBe("List files");
      expect(bashInput.timeout).toBe(30000);
    });

    it("defines Glob tool input", () => {
      const globInput: ToolInputMap["Glob"] = {
        pattern: "**/*.ts",
        path: "/src",
      };

      expect(globInput.pattern).toBe("**/*.ts");
      expect(globInput.path).toBe("/src");
    });

    it("defines Grep tool input", () => {
      const grepInput: ToolInputMap["Grep"] = {
        pattern: "TODO",
        path: "/src",
        glob: "*.ts",
      };

      expect(grepInput.pattern).toBe("TODO");
      expect(grepInput.path).toBe("/src");
      expect(grepInput.glob).toBe("*.ts");
    });

    it("defines Task tool input", () => {
      const taskInput: ToolInputMap["Task"] = {
        prompt: "Find all TODOs",
        description: "Code search task",
      };

      expect(taskInput.prompt).toBe("Find all TODOs");
      expect(taskInput.description).toBe("Code search task");
    });

    it("defines Skill tool input", () => {
      const skillInput: ToolInputMap["Skill"] = {
        skill: "writing-specs",
        args: "--verbose",
      };

      expect(skillInput.skill).toBe("writing-specs");
      expect(skillInput.args).toBe("--verbose");
    });

    it("defines TodoWrite tool input", () => {
      const todoInput: ToolInputMap["TodoWrite"] = {
        todos: [
          { id: "1", content: "First task", status: "pending" },
          { id: "2", content: "Second task", status: "completed" },
        ],
      };

      expect(todoInput.todos).toHaveLength(2);
      expect(todoInput.todos[0]?.content).toBe("First task");
    });
  });

  describe("TypedToolUseContent", () => {
    it("provides typed access to Read tool input", () => {
      const toolUse: TypedToolUseContent<"Read"> = {
        type: "tool_use",
        id: "toolu_123",
        name: "Read",
        input: { file_path: "/src/index.ts" },
      };

      // TypeScript knows input.file_path is string
      expect(toolUse.input.file_path).toBe("/src/index.ts");
    });

    it("provides typed access to Bash tool input", () => {
      const toolUse: TypedToolUseContent<"Bash"> = {
        type: "tool_use",
        id: "toolu_456",
        name: "Bash",
        input: { command: "git status" },
      };

      expect(toolUse.input.command).toBe("git status");
    });
  });

  describe("isKnownToolName", () => {
    it("returns true for known tool names", () => {
      expect(isKnownToolName("Read")).toBe(true);
      expect(isKnownToolName("Write")).toBe(true);
      expect(isKnownToolName("Edit")).toBe(true);
      expect(isKnownToolName("Bash")).toBe(true);
      expect(isKnownToolName("Glob")).toBe(true);
      expect(isKnownToolName("Grep")).toBe(true);
      expect(isKnownToolName("Task")).toBe(true);
      expect(isKnownToolName("Skill")).toBe(true);
      expect(isKnownToolName("TodoWrite")).toBe(true);
    });

    it("returns false for unknown tool names", () => {
      expect(isKnownToolName("UnknownTool")).toBe(false);
      expect(isKnownToolName("MCP_custom")).toBe(false);
      expect(isKnownToolName("")).toBe(false);
    });
  });

  describe("getToolInput", () => {
    it("returns typed input for Read tool", () => {
      const toolUse: ToolUseContent = {
        type: "tool_use",
        id: "toolu_123",
        name: "Read",
        input: { file_path: "/test.ts", offset: 10 },
      };

      const input = getToolInput("Read", toolUse);
      if (input) {
        // Type should be ToolInputMap["Read"]
        expect(input.file_path).toBe("/test.ts");
        expect(input.offset).toBe(10);
      }
    });

    it("returns undefined if tool name does not match", () => {
      const toolUse: ToolUseContent = {
        type: "tool_use",
        id: "toolu_123",
        name: "Write",
        input: { file_path: "/test.ts", content: "hello" },
      };

      const input = getToolInput("Read", toolUse);
      expect(input).toBeUndefined();
    });

    it("returns typed input for Bash tool", () => {
      const toolUse: ToolUseContent = {
        type: "tool_use",
        id: "toolu_456",
        name: "Bash",
        input: { command: "ls -la", description: "List files" },
      };

      const input = getToolInput("Bash", toolUse);
      if (input) {
        expect(input.command).toBe("ls -la");
        expect(input.description).toBe("List files");
      }
    });

    it("works with unknown tools (falls back to untyped)", () => {
      const toolUse: ToolUseContent = {
        type: "tool_use",
        id: "toolu_789",
        name: "CustomTool",
        input: { customField: "value" },
      };

      // For unknown tools, we can still access input but it's untyped
      expect(toolUse.input.customField).toBe("value");
    });
  });
});

describe("getToolCallInput", () => {
  it("returns typed input for Read tool call", () => {
    const toolCall: ToolCall = {
      id: asToolUseId("toolu_123"),
      name: "Read",
      input: { file_path: "/test.ts", offset: 10 },
    };

    const input = getToolCallInput("Read", toolCall);
    if (input) {
      expect(input.file_path).toBe("/test.ts");
      expect(input.offset).toBe(10);
    }
  });

  it("returns undefined if tool name does not match", () => {
    const toolCall: ToolCall = {
      id: asToolUseId("toolu_123"),
      name: "Write",
      input: { file_path: "/test.ts", content: "hello" },
    };

    const input = getToolCallInput("Read", toolCall);
    expect(input).toBeUndefined();
  });

  it("returns typed input for Bash tool call", () => {
    const toolCall: ToolCall = {
      id: asToolUseId("toolu_456"),
      name: "Bash",
      input: { command: "ls -la", description: "List files" },
    };

    const input = getToolCallInput("Bash", toolCall);
    if (input) {
      expect(input.command).toBe("ls -la");
      expect(input.description).toBe("List files");
    }
  });

  it("returns typed input for TodoWrite tool call", () => {
    const toolCall: ToolCall = {
      id: asToolUseId("toolu_789"),
      name: "TodoWrite",
      input: {
        todos: [{ id: "1", content: "Test", status: "pending" }],
      },
    };

    const input = getToolCallInput("TodoWrite", toolCall);
    if (input) {
      expect(input.todos).toHaveLength(1);
      expect(input.todos[0]?.content).toBe("Test");
    }
  });
});

describe("normalizeToolResultContent", () => {
  it("returns string content unchanged", () => {
    expect(normalizeToolResultContent("hello world")).toBe("hello world");
    expect(normalizeToolResultContent("")).toBe("");
  });

  it("extracts text from Task tool array format", () => {
    const content = [
      { type: "text", text: "First paragraph." },
      { type: "text", text: "Second paragraph." },
    ];
    expect(normalizeToolResultContent(content)).toBe(
      "First paragraph.\nSecond paragraph."
    );
  });

  it("handles single-item array", () => {
    const content = [{ type: "text", text: "Only one block." }];
    expect(normalizeToolResultContent(content)).toBe("Only one block.");
  });

  it("handles empty array", () => {
    expect(normalizeToolResultContent([])).toBe("");
  });

  it("handles array with non-text items gracefully", () => {
    const content = [
      { type: "text", text: "Normal text." },
      { type: "image", data: "base64..." }, // Unknown type
    ];
    // Non-text items are JSON stringified as fallback
    expect(normalizeToolResultContent(content)).toBe(
      'Normal text.\n{"type":"image","data":"base64..."}'
    );
  });

  it("handles null/undefined by JSON stringifying", () => {
    expect(normalizeToolResultContent(null)).toBe("null");
    expect(normalizeToolResultContent(undefined)).toBe(undefined);
  });

  it("handles plain objects by JSON stringifying", () => {
    const content = { foo: "bar" };
    expect(normalizeToolResultContent(content)).toBe('{"foo":"bar"}');
  });
});

describe("backward compatibility", () => {
  it("ToolUseContent still accepts Record<string, unknown> input", () => {
    // This ensures existing code doesn't break
    const toolUse: ToolUseContent = {
      type: "tool_use",
      id: "toolu_abc",
      name: "AnyTool",
      input: { arbitrary: "data", nested: { value: 42 } },
    };

    expect(toolUse.name).toBe("AnyTool");
    expect(toolUse.input.arbitrary).toBe("data");
  });

  it("existing formatter patterns still work", () => {
    // Simulate how formatter.ts accesses tool inputs
    const toolUse: ToolUseContent = {
      type: "tool_use",
      id: "toolu_def",
      name: "Read",
      input: { file_path: "/src/index.ts" },
    };

    // Old pattern: casting (still works but we want to phase this out)
    const filePath = toolUse.input.file_path as string;
    expect(filePath).toBe("/src/index.ts");

    // New pattern: type guard
    const input = getToolInput("Read", toolUse);
    if (input) {
      expect(input.file_path).toBe("/src/index.ts");
    }
  });

  it("ToolCall still works with existing code patterns", () => {
    const toolCall: ToolCall = {
      id: asToolUseId("toolu_xyz"),
      name: "TodoWrite",
      input: {
        todos: [{ id: "1", content: "Test", status: "pending" }],
      },
    };

    // Old pattern: casting
    const todos = toolCall.input.todos as Array<{ content: string }>;
    expect(todos[0]?.content).toBe("Test");

    // New pattern: type guard
    const input = getToolCallInput("TodoWrite", toolCall);
    if (input) {
      expect(input.todos[0]?.content).toBe("Test");
    }
  });
});
