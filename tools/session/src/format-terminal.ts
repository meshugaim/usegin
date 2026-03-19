/**
 * Terminal output format for session transcripts (replicates /export format)
 *
 * Format:
 * - User messages: "> message"
 * - Assistant text: plain text
 * - Tool calls: "● ToolName(params)"
 * - Tool results: "  ⎿ result"
 */

import type {
  ParsedSession,
  ToolCall,
} from "./types";
import { getToolCallInput } from "./types";
import type { FormatOptions } from "./format-shared";
import { defaultOptions } from "./format-shared";

/**
 * Truncate by lines, showing first few and indicating how many more
 */
function truncateLines(str: string, maxLines: number): string {
  const lines = str.split("\n");
  if (lines.length <= maxLines) return str;
  const shown = lines.slice(0, maxLines).join("\n");
  const remaining = lines.length - maxLines;
  return `${shown}\n    … +${remaining} lines (ctrl+o to expand)`;
}

/**
 * Strip ANSI escape codes from a string
 */
function stripAnsi(str: string): string {
  // Match ANSI escape sequences: ESC[ followed by params and a letter
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Format a session in terminal style (replicates /export format)
 */
export function formatTerminal(
  session: ParsedSession,
  options: Partial<FormatOptions> = {}
): string {
  const formatOptions = { ...defaultOptions, ...options };
  const lines: string[] = [];

  // Process turns - we need to pair tool calls with their results
  // Tool results come in the next user turn after tool calls
  for (let i = 0; i < session.turns.length; i++) {
    const turn = session.turns[i];
    if (!turn) continue;
    const nextTurn = session.turns[i + 1];

    // Skip rewound branches unless they have meaningful content
    if (turn.isOnCurrentBranch === false) {
      continue;
    }

    if (turn.role === "user") {
      // User message - prefix with >
      if (turn.text) {
        // Indent multi-line user messages
        const userLines = turn.text.split("\n");
        const firstLine = userLines[0] ?? "";
        lines.push(`> ${firstLine}`);
        for (let lineIndex = 1; lineIndex < userLines.length; lineIndex++) {
          lines.push(userLines[lineIndex] ?? "");
        }
        lines.push("");
      }
      // Tool results are handled when we process the preceding assistant turn
    } else if (turn.role === "assistant") {
      // Assistant text
      if (turn.text) {
        lines.push(`● ${turn.text}`);
        lines.push("");
      }

      // Tool calls with results from next turn
      for (const tool of turn.toolCalls) {
        const toolLine = formatTerminalToolCall(tool);
        lines.push(toolLine);

        // Find matching result in next turn (if it's a user turn with results)
        if (nextTurn && nextTurn.role === "user") {
          const result = nextTurn.toolResults.find(
            (toolResult) => toolResult.toolUseId === tool.id
          );
          if (result) {
            const resultLine = formatTerminalToolResult(tool, result, formatOptions);
            if (resultLine) {
              lines.push(resultLine);
            }
          }
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format a tool call in terminal style: ● ToolName(params)
 */
function formatTerminalToolCall(tool: ToolCall): string {
  const params = getTerminalToolParams(tool);
  if (params) {
    return `● ${tool.name}(${params})`;
  }
  return `● ${tool.name}`;
}

/**
 * Get parameters string for terminal tool display
 */
function getTerminalToolParams(tool: ToolCall): string {
  const input = tool.input;

  switch (tool.name) {
    case "Read":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    case "Edit":
      return String(input.file_path || "");
    case "Glob":
      return `pattern: "${input.pattern || ""}"`;
    case "Grep":
    case "Search": {
      const pattern = input.pattern || "";
      const path = input.path || "";
      if (path) {
        return `pattern: "${pattern}", path: "${path}"`;
      }
      return `pattern: "${pattern}"`;
    }
    case "Bash": {
      const cmd = String(input.command || "");
      // Truncate long commands
      return cmd.length > 70 ? cmd.slice(0, 70) + "..." : cmd;
    }
    case "Task":
      return String(input.description || "");
    case "TodoWrite": {
      const todoInput = getToolCallInput("TodoWrite", tool);
      return `${todoInput?.todos.length ?? 0} todos`;
    }
    case "Skill":
      return String(input.skill || "");
    case "AskUserQuestion":
      return "";
    default:
      // Return first short string value found
      for (const inputValue of Object.values(input)) {
        if (typeof inputValue === "string" && inputValue.length > 0 && inputValue.length < 100) {
          return inputValue;
        }
      }
      return "";
  }
}

/**
 * Format a tool result in terminal style: ⎿ result
 */
function formatTerminalToolResult(
  tool: ToolCall,
  result: { content: string; isError: boolean },
  _formatOptions: FormatOptions
): string {
  const indent = "  ⎿ ";

  // Ensure content is a string and strip ANSI codes
  const rawContent = typeof result.content === "string" ? result.content : String(result.content || "");
  const content = stripAnsi(rawContent);

  if (result.isError) {
    const errorContent = truncateLines(content, 3);
    return `${indent}Error: ${errorContent}`;
  }

  // Special formatting for certain tools
  switch (tool.name) {
    case "Read": {
      // Count lines read
      const lineCount = content.split("\n").length;
      return `${indent}Read ${lineCount} lines`;
    }
    case "Grep":
    case "Search": {
      // Show match count
      const matchLines = content.split("\n").filter((line) => line.trim());
      return `${indent}Found ${matchLines.length} matches`;
    }
    case "Glob": {
      const files = content.split("\n").filter((line) => line.trim());
      return `${indent}Found ${files.length} files`;
    }
    case "Bash": {
      if (!content.trim()) {
        return `${indent}(No output)`;
      }
      const truncated = truncateLines(content.trim(), 4);
      // Indent continuation lines
      const resultLines = truncated.split("\n");
      return resultLines.map((line, i) => (i === 0 ? `${indent}${line}` : `    ${line}`)).join("\n");
    }
    default: {
      if (!content.trim()) {
        return "";
      }
      const truncated = truncateLines(content.trim(), 4);
      const resultLines = truncated.split("\n");
      return resultLines.map((line, i) => (i === 0 ? `${indent}${line}` : `    ${line}`)).join("\n");
    }
  }
}
