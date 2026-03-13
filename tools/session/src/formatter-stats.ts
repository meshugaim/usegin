/**
 * Stats card formatter — renders a compact summary of a parsed session.
 *
 * Design principles:
 * - Empty sections vanish (no "Subagents: none" noise)
 * - Hints in parentheses show flags to expand sections
 * - TTY detection: hints suppressed when piping (showHints=false)
 * - Tool counts in 3-column layout, sorted by frequency
 * - Subagent descriptions truncated to fit one line
 * - Duration formatting: "14m 32s", "2h 05m", "45s"
 * - Session ID: first 8 chars of UUID
 */

import type { ParsedSession } from "./types";
import { computeStats } from "./stats";
import type { SessionStats, SubagentSummary, TurnDurationStats, CompactionStats } from "./stats";
import { formatCost as formatCostUsd } from "./pricing";
import { truncate, formatTokenCount } from "./format-utils";

// ============================================================================
// PUBLIC API
// ============================================================================

export interface StatsFormatOptions {
  /** Show flag hints like "(--full to expand)". Disable for piped output. */
  showHints?: boolean;
}

/**
 * Render a stats card for a parsed session.
 *
 * Calls computeStats internally — callers only need the parsed session.
 *
 * @example
 * ```ts
 * const session = parseSession(filePath);
 * const card = formatStats(session, { showHints: process.stdout.isTTY });
 * console.log(card);
 * ```
 */
export function formatStats(
  session: ParsedSession,
  options?: StatsFormatOptions
): string {
  const { showHints = true } = options ?? {};
  const stats = computeStats(session);
  const lines: string[] = [];

  // Top rule
  lines.push(HEAVY_RULE);

  // Header line: Session / Duration / Cost
  lines.push(formatHeaderLine(session.sessionId, stats, session.slug));

  // Sections — each returns lines or empty array if nothing to show
  appendSection(lines, formatConversationSection(stats, showHints));
  appendSection(lines, formatCompactionsSection(stats));
  appendSection(lines, formatTurnDurationsSection(stats));
  appendSection(lines, formatTokenStatsSection(stats));
  appendSection(lines, formatToolsSection(stats, showHints));
  appendSection(lines, formatSubagentsSection(stats, showHints));
  appendSection(lines, formatRewindsSection(stats, showHints));
  appendSection(lines, formatGitSection(stats, showHints));

  // Bottom rule
  lines.push(HEAVY_RULE);

  return lines.join("\n");
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CARD_WIDTH = 38;
const HEAVY_RULE = "\u2501".repeat(CARD_WIDTH);
const LIGHT_RULE_CHAR = "\u2500";

/** Tools displayed per row in the 3-column layout */
const TOOLS_PER_ROW = 3;

// ============================================================================
// HEADER
// ============================================================================

function formatHeaderLine(sessionId: string, stats: SessionStats, slug?: string): string {
  const parts: string[] = [];

  const sessionLabel = slug
    ? `Session   ${sessionId.slice(0, 8)}  ${slug}`
    : `Session   ${sessionId.slice(0, 8)}`;
  parts.push(sessionLabel);

  if (stats.durationMs !== undefined) {
    parts.push(`Duration  ${formatDuration(stats.durationMs)}`);
  }

  if (stats.costUsd !== undefined) {
    parts.push(`Cost  $${formatCost(stats.costUsd)}`);
  }

  if (stats.tokenStats) {
    const pct = Math.round(stats.tokenStats.peakContextPercent * 100);
    parts.push(`Context ${formatTokenCount(stats.tokenStats.peakContextTokens)} (${pct}%)`);
  } else if (stats.tokenUsage) {
    const total =
      stats.tokenUsage.inputTokens +
      stats.tokenUsage.outputTokens +
      stats.tokenUsage.cacheCreationInputTokens +
      stats.tokenUsage.cacheReadInputTokens;
    parts.push(`Tokens  ${formatTokenCount(total)}`);
  }

  return parts.join("    ");
}

// ============================================================================
// SECTION: CONVERSATION
// ============================================================================

function formatConversationSection(
  stats: SessionStats,
  showHints: boolean
): string[] {
  if (stats.turnCount.total === 0) return [];

  const lines: string[] = [];
  lines.push(sectionHeader("Conversation"));

  const hint = showHints ? padHint("(--full to expand)") : "";

  // For compacted sessions, show segment-aware turn count
  if (stats.compactionStats && stats.compactionStats.segmentTurnCounts.length > 1) {
    const { segmentTurnCounts } = stats.compactionStats;
    const segmentCount = segmentTurnCounts.length;
    const currentSegmentSize = segmentTurnCounts[segmentTurnCounts.length - 1]!;
    const turnSummary = `${stats.turnCount.total} turns across ${segmentCount} segments (${currentSegmentSize} in latest segment)`;
    lines.push(`${turnSummary}${hint}`);
  } else {
    const turnSummary = `${stats.turnCount.total} turns (${stats.turnCount.user} user, ${stats.turnCount.assistant} assistant)`;
    lines.push(`${turnSummary}${hint}`);
  }

  return lines;
}

// ============================================================================
// SECTION: COMPACTIONS
// ============================================================================

function formatCompactionsSection(stats: SessionStats): string[] {
  if (!stats.compactionStats) return [];

  const { count, events, segmentTurnCounts } = stats.compactionStats;
  const lines: string[] = [];
  lines.push(sectionHeader(`Compactions (${count})`));

  // One line per compaction event
  events.forEach((event, i) => {
    const index = `#${i + 1}`;
    const time = formatTime(event.timestamp);
    const tokens = formatTokenCount(event.preTokens);
    lines.push(`  ${index}  ${time}  ${tokens} tokens \u2192 compacted (${event.trigger})`);
  });

  // Segment turn breakdown — bracket the last (active) segment
  if (segmentTurnCounts.length > 1) {
    const segmentLabel = `${segmentTurnCounts.length} segments:`;
    const allButLast = segmentTurnCounts.slice(0, -1);
    const last = segmentTurnCounts[segmentTurnCounts.length - 1]!;
    const turnsList = [...allButLast, `[${last}]`].join(" \u2192 ");
    lines.push(`${segmentLabel} ${turnsList} turns`);
  }

  return lines;
}

/**
 * Extract HH:MM from an ISO timestamp.
 * Falls back to the raw string if parsing fails.
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// ============================================================================
// SECTION: TURN DURATIONS
// ============================================================================

function formatTurnDurationsSection(stats: SessionStats): string[] {
  if (!stats.turnDurationStats) return [];

  const { totalActiveMs, averageMs, longestMs, count } = stats.turnDurationStats;
  const lines: string[] = [];
  lines.push(sectionHeader("Active Time"));

  const parts: string[] = [
    `Total  ${formatDuration(totalActiveMs)}`,
    `Avg  ${formatDuration(averageMs)}`,
    `Max  ${formatDuration(longestMs)}`,
  ];
  lines.push(parts.join("    "));
  lines.push(`${count} turn${count === 1 ? "" : "s"} measured`);

  return lines;
}

// ============================================================================
// SECTION: TOKEN STATS
// ============================================================================

/**
 * Render a two-line token statistics section.
 *
 * Line 1: Context  164k / 200k (82%)    Cost  $4.27
 * Line 2: Output   892k tokens           Cache  94%
 *
 * Cost is omitted when model is unknown (estimatedCostUsd undefined).
 * Section is omitted entirely when no tokenStats are available.
 */
function formatTokenStatsSection(stats: SessionStats): string[] {
  if (!stats.tokenStats) return [];

  const ts = stats.tokenStats;
  const lines: string[] = [];
  lines.push(sectionHeader("Tokens"));

  // Line 1: Context + optional Cost
  const peak = formatTokenCount(ts.peakContextTokens);
  const window = formatTokenCount(ts.contextWindowSize);
  const pct = Math.round(ts.peakContextPercent * 100);
  const contextPart = `Context  ${peak} / ${window} (${pct}%)`;

  if (ts.estimatedCostUsd !== undefined) {
    const costPart = `Cost  ${formatCostUsd(ts.estimatedCostUsd)}`;
    lines.push(`${contextPart}${alignRight(contextPart, costPart)}`);
  } else {
    lines.push(contextPart);
  }

  // Line 2: Output + Cache
  const outputPart = `Output   ${formatTokenCount(ts.cumulativeOutputTokens)} tokens`;
  const cachePercent = Math.round(ts.cacheHitRate * 100);
  const cachePart = `Cache  ${cachePercent}%`;
  lines.push(`${outputPart}${alignRight(outputPart, cachePart)}`);

  return lines;
}

/**
 * Right-align a secondary label on the same line as a primary label.
 *
 * Returns a padding string + the right part, such that the total line
 * length is at least CARD_WIDTH. If the two parts together exceed
 * CARD_WIDTH, uses a minimum gap of 4 spaces.
 */
function alignRight(leftPart: string, rightPart: string): string {
  const minGap = 4;
  const targetLen = CARD_WIDTH;
  const gap = Math.max(minGap, targetLen - leftPart.length - rightPart.length);
  return " ".repeat(gap) + rightPart;
}

// ============================================================================
// SECTION: TOOLS
// ============================================================================

function formatToolsSection(
  stats: SessionStats,
  showHints: boolean
): string[] {
  const entries = Object.entries(stats.toolCounts);
  if (entries.length === 0) return [];

  const lines: string[] = [];
  lines.push(sectionHeader("Tools"));

  // Format in 3-column rows
  for (let i = 0; i < entries.length; i += TOOLS_PER_ROW) {
    const rowEntries = entries.slice(i, i + TOOLS_PER_ROW);
    const cells = rowEntries.map(([name, count]) => formatToolCell(count, name));
    lines.push(cells.join("  "));
  }

  if (showHints) {
    // Add hint to the last line
    const lastIndex = lines.length - 1;
    lines[lastIndex] = lines[lastIndex]! + padHint("(--tool-input to see commands)");
  }

  return lines;
}

/**
 * Format a single tool count cell: right-aligned count + tool name.
 * Each cell is a fixed width for alignment.
 */
function formatToolCell(count: number, name: string): string {
  const countStr = `${count}x`;
  return `${countStr.padStart(3)} ${name.padEnd(7)}`;
}

// ============================================================================
// SECTION: SUBAGENTS
// ============================================================================

function formatSubagentsSection(
  stats: SessionStats,
  showHints: boolean
): string[] {
  if (stats.subagentSummaries.length === 0) return [];

  const lines: string[] = [];
  lines.push(sectionHeader(`Subagents (${stats.subagentSummaries.length})`));

  stats.subagentSummaries.forEach((sub, i) => {
    lines.push(formatSubagentLine(i + 1, sub));
  });

  if (showHints) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = lines[lastIndex]! + padHint("(--timeline to see flow)");
  }

  return lines;
}

function formatSubagentLine(index: number, sub: SubagentSummary): string {
  const idShort = String(sub.agentId).slice(0, 10);
  const desc = sub.description
    ? `  "${truncate(sub.description, 24)}"`
    : "";

  const parts = [`${sub.turns} turns`, `${sub.toolCalls} tools`];
  if (sub.durationMs !== undefined) {
    parts.push(formatDuration(sub.durationMs));
  }
  if (sub.tokenUsage) {
    const total =
      sub.tokenUsage.inputTokens +
      sub.tokenUsage.outputTokens +
      sub.tokenUsage.cacheCreationInputTokens +
      sub.tokenUsage.cacheReadInputTokens;
    if (total > 0) {
      parts.push(`${formatTokenCount(total)} tok`);
    }
  }

  // Show parent lineage: who spawned this agent and with what tool
  let parentTag = "";
  if (sub.parentAgentId) {
    const parentId = sub.parentAgentId === "main" ? "main" : String(sub.parentAgentId).slice(0, 8);
    const tool = sub.spawnedBy ?? "?";
    parentTag = `  ←${parentId}(${tool})`;
  }

  return ` ${String(index).padStart(2)}. ${idShort}${desc}   ${parts.join("  ")}${parentTag}`;
}

// ============================================================================
// SECTION: REWINDS
// ============================================================================

function formatRewindsSection(
  stats: SessionStats,
  showHints: boolean
): string[] {
  if (stats.rewindCount === 0) return [];

  const lines: string[] = [];
  lines.push(sectionHeader(`Rewinds (${stats.rewindCount})`));

  const noun = stats.rewindCount === 1 ? "rewind" : "rewinds";
  const text = `${stats.rewindCount} ${noun} detected`;
  const hint = showHints ? padHint("(--full to see context)") : "";
  lines.push(` ${text}${hint}`);

  return lines;
}

// ============================================================================
// SECTION: GIT
// ============================================================================

function formatGitSection(stats: SessionStats, showHints: boolean): string[] {
  if (stats.commitCount === 0) return [];

  const lines: string[] = [];
  lines.push(sectionHeader("Git"));

  const noun = stats.commitCount === 1 ? "commit" : "commits";

  // When git-history data is available, show diffstat summary
  if (stats.gitCommits && stats.gitCommits.length > 0) {
    const totalInsertions = stats.gitCommits.reduce(
      (sum, c) => sum + (c.insertions ?? 0),
      0
    );
    const totalDeletions = stats.gitCommits.reduce(
      (sum, c) => sum + (c.deletions ?? 0),
      0
    );
    const hasDiffStats = totalInsertions > 0 || totalDeletions > 0;
    const diffSummary = hasDiffStats
      ? ` (+${totalInsertions}/-${totalDeletions} lines)`
      : "";
    const text = `${stats.commitCount} ${noun}${diffSummary}`;
    const hint = showHints ? padHint("(--full to see messages)") : "";
    lines.push(` ${text}${hint}`);
  } else {
    const text = `${stats.commitCount} ${noun}`;
    const hint = showHints ? padHint("(--full to see messages)") : "";
    lines.push(` ${text}${hint}`);
  }

  return lines;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format a section header with light rule decoration.
 *
 * Output: "--- Title ------..."
 */
function sectionHeader(title: string): string {
  const prefix = `${LIGHT_RULE_CHAR.repeat(3)} ${title} `;
  const remaining = Math.max(0, CARD_WIDTH - prefix.length);
  return `\n${prefix}${LIGHT_RULE_CHAR.repeat(remaining)}`;
}

/**
 * Pad a hint string with leading spaces so it sits at the end of a line.
 * We use a fixed small gap rather than trying to right-align to card width,
 * since content lines vary in length.
 */
function padHint(hint: string): string {
  return `  ${hint}`;
}

/**
 * Append section lines to the output, but only if non-empty.
 */
function appendSection(output: string[], section: string[]): void {
  if (section.length > 0) {
    output.push(...section);
  }
}

// ============================================================================
// VALUE FORMATTERS (exported for testing)
// ============================================================================

/**
 * Format milliseconds into human-friendly duration.
 *
 * - Under 1 minute: "45s"
 * - Under 1 hour:   "14m 32s"
 * - 1 hour+:        "2h 05m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Format a USD cost. Shows 2 decimal places, or 4 for sub-cent amounts.
 */
export function formatCost(usd: number): string {
  if (usd < 0.01 && usd > 0) {
    return usd.toFixed(4);
  }
  return usd.toFixed(2);
}

// Re-export for backward compatibility — other modules import from here
export { formatTokenCount } from "./format-utils";
