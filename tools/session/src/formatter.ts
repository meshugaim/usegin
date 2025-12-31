/**
 * Format parsed sessions into readable output
 */

import type { ParsedSession, ParsedSubagent, Turn, ToolCall } from "./types";

export interface FormatOptions {
  toolInput: boolean;
  toolOutput: boolean;
  truncate: number;
  includeSubagents: boolean;
}

const defaultOptions: FormatOptions = {
  toolInput: false,
  toolOutput: false,
  truncate: 500,
  includeSubagents: false,
};

/**
 * Format a session as a narrative transcript
 */
export function formatNarrative(
  session: ParsedSession,
  options: Partial<FormatOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const lines: string[] = [];

  // Summary header (separate from other metadata)
  if (session.summary) {
    lines.push("━".repeat(40));
    lines.push(`★ ${session.summary}`);
    lines.push("━".repeat(40));
    lines.push("");
  }

  // Header section (metadata about the session)
  const hasHeaders =
    (session.triggeredSkills && session.triggeredSkills.length > 0) ||
    (session.rewinds && session.rewinds.length > 0);

  if (hasHeaders) {
    lines.push("─".repeat(40));
    if (session.triggeredSkills && session.triggeredSkills.length > 0) {
      lines.push(`SKILLS: ${session.triggeredSkills.join(", ")}`);
    }
    if (session.rewinds && session.rewinds.length > 0) {
      lines.push(`REWINDS: ${session.rewinds.length}`);
    }
    lines.push("─".repeat(40));
    lines.push("");
  }

  // Main session turns
  for (const turn of session.turns) {
    lines.push(formatTurn(turn, opts));
    lines.push("");
  }

  // Subagent transcripts (appended at end)
  if (opts.includeSubagents && session.subagents.length > 0) {
    lines.push("");
    lines.push("═".repeat(60));
    lines.push(`SUBAGENTS (${session.subagents.length})`);
    lines.push("═".repeat(60));

    for (const subagent of session.subagents) {
      lines.push("");
      lines.push(formatSubagent(subagent, opts));
    }
  }

  return lines.join("\n");
}

/**
 * Format a subagent transcript
 */
function formatSubagent(subagent: ParsedSubagent, opts: FormatOptions): string {
  const lines: string[] = [];

  // Subagent header
  lines.push("─".repeat(40));
  lines.push(`SUBAGENT: ${subagent.agentId}`);
  if (subagent.startTimestamp) {
    lines.push(`Started: ${subagent.startTimestamp}`);
  }
  lines.push(`Turns: ${subagent.turns.length}`);
  lines.push("─".repeat(40));
  lines.push("");

  // Subagent turns
  for (const turn of subagent.turns) {
    lines.push(formatTurn(turn, opts));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format a single turn
 */
export function formatTurn(turn: Turn, opts: FormatOptions): string {
  const lines: string[] = [];

  // Role header with rewind prefix if not on current branch
  const role = turn.role.toUpperCase();
  const prefix = turn.isOnCurrentBranch === false ? "[REWIND] " : "";

  // Text content
  if (turn.text) {
    lines.push(`${prefix}${role}: ${turn.text}`);
  } else if (turn.toolCalls.length > 0 || turn.toolResults.length > 0) {
    lines.push(`${prefix}${role}:`);
  }

  // Tool calls (for assistant turns)
  for (const tool of turn.toolCalls) {
    lines.push(formatToolCall(tool, opts));
  }

  // Tool results (for user turns - these are tool responses)
  if (opts.toolOutput) {
    for (const result of turn.toolResults) {
      const content = truncate(result.content, opts.truncate);
      const prefix = result.isError ? "    error:" : "    output:";
      lines.push(`${prefix} ${content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format a tool call
 */
function formatToolCall(tool: ToolCall, opts: FormatOptions): string {
  const lines: string[] = [];

  // Tool name with key input summary
  const summary = getToolSummary(tool);
  lines.push(`  → ${tool.name}: ${summary}`);

  // Full input if requested
  if (opts.toolInput) {
    const inputStr = truncate(JSON.stringify(tool.input, null, 2), opts.truncate);
    lines.push(`    input: ${inputStr}`);
  }

  return lines.join("\n");
}

/**
 * Get a brief summary of a tool call's key input
 */
function getToolSummary(tool: ToolCall): string {
  const input = tool.input;

  switch (tool.name) {
    case "Read":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    case "Edit":
      return String(input.file_path || "");
    case "Glob":
      return `pattern="${input.pattern || ""}"`;
    case "Grep":
      return `pattern="${input.pattern || ""}"`;
    case "Bash":
      const cmd = String(input.command || "");
      return cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
    case "Task":
      return String(input.description || "");
    case "TodoWrite":
      const todos = input.todos as Array<{ content: string }> | undefined;
      return `${todos?.length || 0} todos`;
    case "Skill":
      return String(input.skill || "");
    default:
      // Return first string value found
      for (const val of Object.values(input)) {
        if (typeof val === "string" && val.length > 0) {
          return val.length > 60 ? val.slice(0, 60) + "..." : val;
        }
      }
      return "";
  }
}

/**
 * Truncate a string to max length
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

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
 * Format a session in terminal style (replicates /export format)
 *
 * Format:
 * - User messages: "> message"
 * - Assistant text: plain text
 * - Tool calls: "● ToolName(params)"
 * - Tool results: "  ⎿ result"
 */
export function formatTerminal(
  session: ParsedSession,
  options: Partial<FormatOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const lines: string[] = [];

  // Process turns - we need to pair tool calls with their results
  // Tool results come in the next user turn after tool calls
  for (let i = 0; i < session.turns.length; i++) {
    const turn = session.turns[i];
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
        lines.push(`> ${userLines[0]}`);
        for (let j = 1; j < userLines.length; j++) {
          lines.push(userLines[j]);
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
            (r) => r.toolUseId === tool.id
          );
          if (result) {
            const resultLine = formatTerminalToolResult(tool, result, opts);
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
    case "Search":
      const pattern = input.pattern || "";
      const path = input.path || "";
      if (path) {
        return `pattern: "${pattern}", path: "${path}"`;
      }
      return `pattern: "${pattern}"`;
    case "Bash":
      const cmd = String(input.command || "");
      // Truncate long commands
      return cmd.length > 70 ? cmd.slice(0, 70) + "..." : cmd;
    case "Task":
      return String(input.description || "");
    case "TodoWrite":
      const todos = input.todos as Array<{ content: string }> | undefined;
      return `${todos?.length || 0} todos`;
    case "Skill":
      return String(input.skill || "");
    case "AskUserQuestion":
      return "";
    default:
      // Return first short string value found
      for (const val of Object.values(input)) {
        if (typeof val === "string" && val.length > 0 && val.length < 100) {
          return val;
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
  opts: FormatOptions
): string {
  const indent = "  ⎿ ";

  // Ensure content is a string
  const content = typeof result.content === "string" ? result.content : String(result.content || "");

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
      const matchLines = content.split("\n").filter((l) => l.trim());
      return `${indent}Found ${matchLines.length} matches`;
    }
    case "Glob": {
      const files = content.split("\n").filter((l) => l.trim());
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

/**
 * Format a session as readable Markdown
 */
export function formatMarkdown(session: ParsedSession): string {
  const lines: string[] = [];

  // Title
  if (session.summary) {
    lines.push(`# ${session.summary}`);
  } else {
    lines.push(`# Session ${session.sessionId}`);
  }
  lines.push("");

  // Metadata
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Session ID:** ${session.sessionId}`);
  lines.push(`- **Working Directory:** ${session.cwd}`);
  lines.push(`- **Model:** ${session.model}`);
  if (session.triggeredSkills.length > 0) {
    lines.push(`- **Skills:** ${session.triggeredSkills.join(", ")}`);
  }
  if (session.rewinds.length > 0) {
    lines.push(`- **Rewinds:** ${session.rewinds.length}`);
  }
  if (session.result) {
    lines.push(`- **Duration:** ${(session.result.durationMs / 1000).toFixed(1)}s`);
    if (session.result.costUsd !== undefined) {
      lines.push(`- **Cost:** $${session.result.costUsd.toFixed(4)}`);
    }
  }
  lines.push("");

  // Conversation
  lines.push("## Conversation");
  lines.push("");

  for (const turn of session.turns) {
    const prefix = turn.isOnCurrentBranch === false ? "~~[REWIND]~~ " : "";
    const role = turn.role === "user" ? "**User**" : "**Assistant**";

    if (turn.text) {
      lines.push(`### ${prefix}${role}`);
      lines.push("");
      lines.push(turn.text);
      lines.push("");
    }

    // Tool calls
    for (const tool of turn.toolCalls) {
      const summary = getToolSummary(tool);
      lines.push(`> 🔧 **${tool.name}**: ${summary}`);
    }

    if (turn.toolCalls.length > 0) {
      lines.push("");
    }
  }

  // Subagents
  if (session.subagents.length > 0) {
    lines.push("## Subagents");
    lines.push("");

    for (const subagent of session.subagents) {
      lines.push(`### Subagent: ${subagent.agentId}`);
      lines.push("");

      for (const turn of subagent.turns) {
        const role = turn.role === "user" ? "**User**" : "**Assistant**";
        if (turn.text) {
          lines.push(`#### ${role}`);
          lines.push("");
          lines.push(turn.text);
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}
