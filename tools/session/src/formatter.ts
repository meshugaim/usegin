/**
 * Format parsed sessions into readable output
 */

import type {
  ParsedSession,
  ParsedSubagent,
  Turn,
  ToolCall,
  QueuedMessage,
  CompactionEvent,
  EntryUuid,
} from "./types";
import { getToolCallInput } from "./types";
import { truncate, formatTokenCount } from "./format-utils";

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
  const formatOptions = { ...defaultOptions, ...options };
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

  // Build compaction context: map from summary turn UUID -> compaction info
  const compactionCtx = buildCompactionContext(session.compactions);
  const totalSegments = session.compactions.length + 1;

  // Helper to render a turn with compaction awareness
  const renderTurn = (turn: Turn): void => {
    // Insert compaction boundary marker before compaction summary turns
    const ctx = compactionCtx.get(turn.uuid);
    if (ctx) {
      lines.push(formatCompactionMarker(ctx.compaction, ctx.index, totalSegments));
      lines.push("");
    }

    lines.push(formatTurn(turn, formatOptions));
    lines.push("");
  };

  // Main session turns, interleaved with queued messages chronologically
  const queuedMessages = session.queuedMessages ?? [];
  if (queuedMessages.length > 0) {
    // Merge turns and queued messages into a single chronological stream
    const timedTurns = session.turns.map((turn) => ({
      kind: "turn" as const,
      timestamp: turn.timestamp,
      turn,
    }));
    const timedQueued = queuedMessages.map((qm) => ({
      kind: "queued" as const,
      timestamp: qm.timestamp,
      message: qm,
    }));
    const merged = [...timedTurns, ...timedQueued];
    merged.sort((a, b) => {
      // Items without timestamps go first (preserve original behavior)
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return a.timestamp.localeCompare(b.timestamp);
    });

    for (const item of merged) {
      if (item.kind === "turn") {
        renderTurn(item.turn);
      } else {
        lines.push(`USER (queued): ${item.message.content}`);
        lines.push("");
      }
    }
  } else {
    for (const turn of session.turns) {
      renderTurn(turn);
    }
  }

  // Commits section — prefer git-history commits when available
  if (session.gitCommits && session.gitCommits.length > 0) {
    lines.push("─── Commits " + "─".repeat(28));
    for (const commit of session.gitCommits) {
      const diffStats =
        commit.insertions !== undefined || commit.deletions !== undefined
          ? `  (+${commit.insertions ?? 0}/-${commit.deletions ?? 0})`
          : "";
      lines.push(`  ${commit.shortHash}  ${commit.subject}${diffStats}`);
    }
    lines.push("");
  } else if (session.commits.length > 0) {
    lines.push("─── Commits " + "─".repeat(28));
    for (const commit of session.commits) {
      const shortHash = commit.hash.slice(0, 7);
      lines.push(`  ${shortHash}  ${commit.message ?? ""}`);
    }
    lines.push("");
  }

  // Subagent transcripts (appended at end)
  if (formatOptions.includeSubagents && session.subagents.length > 0) {
    lines.push("");
    lines.push("═".repeat(60));
    lines.push(`SUBAGENTS (${session.subagents.length})`);
    lines.push("═".repeat(60));

    for (const subagent of session.subagents) {
      lines.push("");
      lines.push(formatSubagent(subagent, formatOptions));
    }
  }

  return lines.join("\n");
}

/**
 * Format a subagent transcript
 */
function formatSubagent(subagent: ParsedSubagent, formatOptions: FormatOptions): string {
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
    lines.push(formatTurn(turn, formatOptions));
    lines.push("");
  }

  return lines.join("\n");
}

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
// COMPACTION HELPERS
// ============================================================================

/** Max chars of compaction summary text to show before truncating */
const COMPACTION_SUMMARY_PREVIEW_CHARS = 200;

interface CompactionTurnContext {
  compaction: CompactionEvent;
  /** 1-based compaction index */
  index: number;
}

/**
 * Build a lookup map from compaction summary turn UUID to its context.
 *
 * This allows O(1) lookup during turn rendering to decide whether a turn
 * needs a compaction boundary marker inserted before it.
 */
function buildCompactionContext(
  compactions: CompactionEvent[]
): Map<EntryUuid, CompactionTurnContext> {
  const map = new Map<EntryUuid, CompactionTurnContext>();
  for (let i = 0; i < compactions.length; i++) {
    const compaction = compactions[i]!;
    if (compaction.summaryMessageUuid) {
      map.set(compaction.summaryMessageUuid, {
        compaction,
        index: i + 1,
      });
    }
  }
  return map;
}

/**
 * Format a compaction boundary marker line.
 *
 * Example:
 *   ━━━ Compaction #1 (auto) ━━━ 172k tokens ━━━ Segment 2 of 5 ━━━
 */
function formatCompactionMarker(
  compaction: CompactionEvent,
  index: number,
  totalSegments: number
): string {
  const segmentNumber = index + 1; // Segment after this compaction
  const parts = [
    `Compaction #${index} (${compaction.trigger})`,
    `${formatTokenCount(compaction.preTokens)} tokens`,
    `Segment ${segmentNumber} of ${totalSegments}`,
  ];
  return `━━━ ${parts.join(" ━━━ ")} ━━━`;
}

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
// GENERAL HELPERS
// ============================================================================

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
