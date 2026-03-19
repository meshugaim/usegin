/**
 * Shared formatter utilities used by multiple format modules.
 *
 * This module breaks the circular dependency between formatter.ts and the
 * format-specific modules (format-narrative.ts, format-terminal.ts, etc.).
 *
 * Format files import from here; formatter.ts re-exports everything.
 */

import type {
  ParsedSession,
  Turn,
  ToolCall,
} from "./types";
import { getToolCallInput } from "./types";
import { truncate } from "./format-utils";

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface FormatOptions {
  toolInput: boolean;
  toolOutput: boolean;
  truncate: number;
  includeSubagents: boolean;
  /** When true, interleave git commits chronologically with turns instead of appending at end. */
  commits?: boolean;
}

export const defaultOptions: FormatOptions = {
  toolInput: false,
  toolOutput: false,
  truncate: 500,
  includeSubagents: false,
};

// ============================================================================
// SHARED TURN FORMATTING
// ============================================================================

/**
 * Format a single turn
 */
export function formatTurn(turn: Turn, formatOptions: FormatOptions): string {
  const lines: string[] = [];

  // Role header with rewind prefix if not on current branch
  const role = turn.role.toUpperCase();
  const prefix = turn.isOnCurrentBranch === false ? "[REWIND] " : "";

  // Text content — compaction summaries get special treatment
  if (turn.isCompactionSummary && turn.text) {
    const summaryPreview = formatCompactionSummaryText(turn.text);
    lines.push(`${prefix}USER (compaction summary):\n${summaryPreview}`);
  } else if (turn.text) {
    lines.push(`${prefix}${role}: ${turn.text}`);
  } else if (turn.toolCalls.length > 0 || turn.toolResults.length > 0) {
    lines.push(`${prefix}${role}:`);
  }

  // Tool calls (for assistant turns)
  for (const tool of turn.toolCalls) {
    lines.push(formatToolCall(tool, formatOptions));
  }

  // Tool results (for user turns - these are tool responses)
  if (formatOptions.toolOutput) {
    for (const result of turn.toolResults) {
      const content = truncate(result.content, formatOptions.truncate);
      const prefix = result.isError ? "    error:" : "    output:";
      lines.push(`${prefix} ${content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format a tool call
 */
function formatToolCall(tool: ToolCall, formatOptions: FormatOptions): string {
  const lines: string[] = [];

  // Tool name with key input summary
  const summary = getToolSummary(tool);
  lines.push(`  → ${tool.name}: ${summary}`);

  // Full input if requested
  if (formatOptions.toolInput) {
    const inputStr = truncate(JSON.stringify(tool.input, null, 2), formatOptions.truncate);
    lines.push(`    input: ${inputStr}`);
  }

  return lines.join("\n");
}

/**
 * Get a brief summary of a tool call's key input
 */
export function getToolSummary(tool: ToolCall): string {
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
    case "Bash": {
      const cmd = String(input.command || "");
      return cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
    }
    case "Task":
      return String(input.description || "");
    case "TodoWrite": {
      const todoInput = getToolCallInput("TodoWrite", tool);
      return `${todoInput?.todos.length ?? 0} todos`;
    }
    case "Skill":
      return String(input.skill || "");
    default:
      // Return first string value found
      for (const inputValue of Object.values(input)) {
        if (typeof inputValue === "string" && inputValue.length > 0) {
          return inputValue.length > 60 ? inputValue.slice(0, 60) + "..." : inputValue;
        }
      }
      return "";
  }
}

// ============================================================================
// TASK NOTIFICATION DEDUP
// ============================================================================

/**
 * Deduplicate turns that contain the same `<task-id>`.
 *
 * Task notifications appear twice in the session: once when queued and once
 * when delivered. Both contain `<task-notification>` with the same `<task-id>`.
 * This function removes earlier duplicates, keeping only the last occurrence
 * of each task-id (the delivery, which has the actual result).
 *
 * Turns without task notifications pass through unchanged.
 */
export function dedupTaskNotifications(turns: Turn[]): Turn[] {
  const taskIdPattern = /<task-id>([^<]+)<\/task-id>/;
  const taskIdToIndices = new Map<string, number[]>();

  for (let i = 0; i < turns.length; i++) {
    const match = turns[i].text.match(taskIdPattern);
    if (match) {
      const taskId = match[1];
      const indices = taskIdToIndices.get(taskId) || [];
      indices.push(i);
      taskIdToIndices.set(taskId, indices);
    }
  }

  // For each task-id with multiple turns, mark all but the last for removal
  const removeIndices = new Set<number>();
  for (const indices of taskIdToIndices.values()) {
    if (indices.length > 1) {
      for (let i = 0; i < indices.length - 1; i++) {
        removeIndices.add(indices[i]);
      }
    }
  }

  return turns.filter((_, i) => !removeIndices.has(i));
}

// ============================================================================
// COMPACTION HELPERS (used by formatTurn)
// ============================================================================

/** Max chars of compaction summary text to show before truncating */
const COMPACTION_SUMMARY_PREVIEW_CHARS = 200;

/**
 * Truncate compaction summary text for narrative display.
 *
 * Shows the first ~200 chars of the summary followed by a truncation
 * indicator with the total character count.
 *
 * Short summaries (<= preview limit) are shown in full.
 */
function formatCompactionSummaryText(text: string): string {
  // Trim trailing whitespace/newlines — raw summary text often has trailing
  // newlines that cause excess blank lines in the output.
  const trimmed = text.trim();
  if (trimmed.length <= COMPACTION_SUMMARY_PREVIEW_CHARS) {
    return trimmed;
  }
  const preview = trimmed.slice(0, COMPACTION_SUMMARY_PREVIEW_CHARS);
  const totalChars = trimmed.length.toLocaleString("en-US");
  return `${preview}\n  ... [${totalChars} chars — compaction summary truncated]`;
}

// ============================================================================
// TOOL FILTER FORMAT
// ============================================================================

/**
 * Format a filtered view showing only calls for a specific tool type.
 *
 * This is a standalone output mode — when a future Claude sees "39x Bash"
 * in the stats card and wants to drill in, they run:
 *
 *   session <id> --tool Bash
 *
 * Output:
 *   --- Bash (39 calls) ---...
 *     -> Bash: bun install -g agent-browser 2>&1
 *     -> Bash: export PATH=...
 *     ...
 */
export function formatToolFilter(
  session: ParsedSession,
  toolName: string | string[],
  options: Partial<FormatOptions> = {}
): string {
  const formatOptions = { ...defaultOptions, ...options };
  const toolNames = Array.isArray(toolName) ? toolName : [toolName];
  const matchingCalls: ToolCall[] = [];

  for (const turn of session.turns) {
    if (turn.role !== "assistant") continue;
    for (const tc of turn.toolCalls) {
      if (toolNames.includes(tc.name)) {
        matchingCalls.push(tc);
      }
    }
  }

  const displayName = toolNames.join(", ");

  if (matchingCalls.length === 0) {
    return `No ${displayName} calls found in this session.`;
  }

  const noun = matchingCalls.length === 1 ? "call" : "calls";
  const header = `${"─".repeat(3)} ${displayName} (${matchingCalls.length} ${noun}) ${"─".repeat(Math.max(0, 38 - displayName.length - String(matchingCalls.length).length - noun.length - 8))}`;

  const lines: string[] = [header];

  for (const tc of matchingCalls) {
    lines.push(formatToolCall(tc, formatOptions));

    if (formatOptions.toolOutput) {
      for (const turn of session.turns) {
        for (const result of turn.toolResults) {
          if (result.toolUseId === tc.id) {
            const content = truncate(result.content, formatOptions.truncate);
            const prefix = result.isError ? "    error:" : "    output:";
            lines.push(`${prefix} ${content}`);
          }
        }
      }
    }
  }

  return lines.join("\n");
}
