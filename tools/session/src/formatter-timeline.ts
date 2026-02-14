/**
 * Timeline formatter — renders chronological events as a human-readable view.
 *
 * Design principles:
 * - Relative timestamps from session start (MM:SS format)
 * - Falls back to absolute HH:MM:SS when no session_start is present
 * - Distinct symbols per event kind for scanability
 * - Long text truncated with generous limits (120 chars for messages/commits)
 * - Optional hints for discoverability of related flags
 */

import type { TimelineEvent } from "./timeline";
import { formatDuration } from "./formatter-stats";
import { truncate, formatTokenCount } from "./format-utils";

// ============================================================================
// PUBLIC API
// ============================================================================

export interface TimelineFormatOptions {
  /** Show flag hints like "(--timeline --subagents ...)". Disable for piped output. */
  showHints?: boolean;
  /** Show tool_call events in the timeline (default: false). */
  showTools?: boolean;
  /** Show commit events in the timeline (default: true). */
  showCommits?: boolean;
}

/**
 * Render a chronological timeline from a list of events.
 *
 * @param events - Sorted timeline events from buildTimeline()
 * @param options - Formatting options
 * @returns Array of formatted lines (join with "\n" for output)
 *
 * @example
 * ```ts
 * const events = buildTimeline(session);
 * const lines = formatTimeline(events, { showHints: process.stdout.isTTY });
 * console.log(lines.join("\n"));
 * ```
 */
export function formatTimeline(
  events: TimelineEvent[],
  options?: TimelineFormatOptions,
): string[] {
  if (events.length === 0) return [];

  const { showHints = true, showTools = false, showCommits = true } = options ?? {};
  const lines: string[] = [];

  // Filter events to show only the narrative by default.
  // tool_call events are hidden unless showTools is true.
  // commit events are shown by default but can be hidden.
  const filtered = events.filter((e) => {
    if (e.kind === "tool_call") return showTools;
    if (e.kind === "commit") return showCommits;
    return true;
  });

  // Determine the session start time for relative timestamps.
  // If no session_start event exists, we use absolute timestamps instead.
  const startEvent = filtered.find((e) => e.kind === "session_start");
  const sessionStartMs = startEvent?.timestamp.getTime();

  for (const event of filtered) {
    const result = formatEvent(event, sessionStartMs);
    if (result !== null) {
      if (Array.isArray(result)) {
        lines.push(...result);
      } else {
        lines.push(result);
      }
    }
  }

  if (showHints && lines.length > 0) {
    const hasCompactions = filtered.some((e) => e.kind === "compaction");
    const hints = ["--show-tools to include tool calls", "--subagents to include subagent internals"];
    if (hasCompactions) {
      hints.push("--full to read compaction summaries");
    }
    lines.push(padHint(`(${hints.join(", ")})`));
  }

  return lines;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HEADER_WIDTH = 44;
const LIGHT_RULE_CHAR = "\u2500";
const DOUBLE_RULE_CHAR = "\u2550"; // ═

// ============================================================================
// EVENT FORMATTING
// ============================================================================

/**
 * Format a single timeline event into one or more display lines.
 *
 * Returns a string (single line), string[] (multiple lines, e.g. subagent_return
 * with report), or null for events that produce no output.
 */
function formatEvent(
  event: TimelineEvent,
  sessionStartMs: number | undefined,
): string | string[] | null {
  switch (event.kind) {
    case "session_start":
      return formatHeader();

    case "session_end":
      return formatFooter(event.totalDurationMs);

    case "user_message": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      if (event.compactionSummary) {
        const charCount = event.originalLength ?? event.text.length;
        const preview = truncate(event.text.replace(/\n/g, " "), 80);
        return `  ${ts}  [compaction summary \u2014 ${formatCharCount(charCount)}: "${preview}"]`;
      }
      const text = truncate(event.text, 120);
      const label = event.queued ? "User (queued)" : "User";
      return `  ${ts}  ${label}: "${text}"`;
    }

    case "assistant_message": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const text = truncate(event.text, 120);
      return `  ${ts}  Claude: "${text}"`;
    }

    case "tool_call": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const summary = truncate(event.summary, 60 - event.toolName.length - 2);
      const detail = summary ? `${event.toolName}: ${summary}` : event.toolName;
      return `  ${ts}  \u2192 ${detail}`;
    }

    case "subagent_spawn": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const shortId = shortAgentId(event.agentId);
      const desc = truncate(event.description, 80);
      const descPart = desc ? ` "${desc}"` : "";
      const mainLine = `  ${ts}  \u2192 Task:${descPart} (${shortId})`;
      if (event.report) {
        const indent = " ".repeat(10);
        const reportLines = event.report.split("\n").filter(Boolean);
        const formattedReportLines = reportLines.map(
          (line) => `${indent}"${truncate(line, 120)}"`,
        );
        return [mainLine, ...formattedReportLines];
      }
      return mainLine;
    }

    case "subagent_resume": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const shortId = shortAgentId(event.agentId);
      const desc = truncate(event.description, 80);
      const descPart = desc ? ` "${desc}"` : "";
      const mainLine = `  ${ts}  \u21bb ${shortId} resumed:${descPart}`;
      if (event.report) {
        const indent = " ".repeat(10);
        const reportLines = event.report.split("\n").filter(Boolean);
        const formattedReportLines = reportLines.map(
          (line) => `${indent}"${truncate(line, 120)}"`,
        );
        return [mainLine, ...formattedReportLines];
      }
      return mainLine;
    }

    case "subagent_return": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const shortId = shortAgentId(event.agentId);
      const parts: string[] = [`${event.turns} turns`];
      if (event.durationMs !== undefined) {
        parts.push(formatDuration(event.durationMs));
      }
      const mainLine = `  ${ts}  \u2190 ${shortId} returned (${parts.join(", ")})`;
      if (event.report) {
        // Reports are typically on spawn/resume events now, but the return
        // event type still supports them for backward compatibility.
        const indent = " ".repeat(10);
        const reportLines = event.report.split("\n").filter(Boolean);
        const formattedReportLines = reportLines.map(
          (line) => `${indent}"${truncate(line, 120)}"`,
        );
        return [mainLine, ...formattedReportLines];
      }
      return mainLine;
    }

    case "commit": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const shortHash = event.hash.slice(0, 7);
      const subject = truncate(event.subject, 120);
      return `  ${ts}  \u25cf ${shortHash} ${subject}`;
    }

    case "interrupted": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      return `  ${ts}  \u2702 interrupted`;
    }

    case "compaction": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const tokens = formatTokenCount(event.preTokens);
      return formatCompactionMarker(event.number, event.trigger, tokens, event.segmentNumber, event.totalSegments);
    }

    case "idle_gap": {
      const ts = formatTimestamp(event.timestamp, sessionStartMs);
      const duration = formatDuration(event.durationMs);
      return `  ${ts}  \u22ef idle ${duration}`;
    }
  }
}

// ============================================================================
// HEADER / FOOTER
// ============================================================================

/**
 * Render the timeline header rule.
 *
 * Output: "─── Timeline ─────────────────────────────"
 */
function formatHeader(): string {
  const prefix = `${LIGHT_RULE_CHAR.repeat(3)} Timeline `;
  const remaining = Math.max(0, HEADER_WIDTH - prefix.length);
  return `${prefix}${LIGHT_RULE_CHAR.repeat(remaining)}`;
}

/**
 * Render the timeline footer rule with total duration.
 *
 * Output: "─── End (3m 15s) ─────────────────────────"
 */
function formatFooter(totalDurationMs: number | undefined): string {
  const durationStr =
    totalDurationMs !== undefined ? ` (${formatDuration(totalDurationMs)})` : "";
  const prefix = `${LIGHT_RULE_CHAR.repeat(3)} End${durationStr} `;
  const remaining = Math.max(0, HEADER_WIDTH - prefix.length);
  return `${prefix}${LIGHT_RULE_CHAR.repeat(remaining)}`;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format a timestamp as either relative MM:SS from session start,
 * or absolute HH:MM:SS if no session start is available.
 */
function formatTimestamp(date: Date, sessionStartMs: number | undefined): string {
  if (sessionStartMs !== undefined) {
    const deltaMs = date.getTime() - sessionStartMs;
    return formatRelativeTime(Math.max(0, deltaMs));
  }
  return formatAbsoluteTime(date);
}

/**
 * Format a duration in milliseconds as MM:SS.
 *
 * Examples: "00:00", "01:30", "14:32", "125:00"
 */
function formatRelativeTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format a Date as HH:MM:SS.
 *
 * Uses UTC to keep tests deterministic.
 */
function formatAbsoluteTime(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Shorten an agent ID for display.
 *
 * "agent-d4e2f891-..." → "agent-d4e2"
 * Short IDs (<=12 chars) are returned as-is.
 */
function shortAgentId(agentId: string): string {
  if (agentId.length <= 12) return agentId;
  return agentId.slice(0, 12);
}

/**
 * Pad a hint string with leading spaces.
 */
function padHint(hint: string): string {
  return `  ${hint}`;
}

// ============================================================================
// COMPACTION HELPERS
// ============================================================================

/**
 * Format a character count as a comma-separated string with " chars" suffix.
 *
 * Examples: 16234 → "16,234 chars", 42 → "42 chars"
 */
function formatCharCount(chars: number): string {
  return `${chars.toLocaleString("en-US")} chars`;
}

/**
 * Render a compaction boundary marker as a visually distinct separator.
 *
 * Output: "  ══════ Compaction #1 (auto) ══ 172k tokens ══ Segment 2 of 5 ══════"
 *
 * Uses double-line box-drawing characters (═) to stand out from the
 * regular timeline events and the single-line header/footer rules.
 */
function formatCompactionMarker(
  number: number,
  trigger: string,
  tokens: string,
  segmentNumber: number,
  totalSegments: number,
): string {
  const content = ` Compaction #${number} (${trigger}) ${DOUBLE_RULE_CHAR}${DOUBLE_RULE_CHAR} ${tokens} tokens ${DOUBLE_RULE_CHAR}${DOUBLE_RULE_CHAR} Segment ${segmentNumber} of ${totalSegments} `;
  const prefix = `  ${DOUBLE_RULE_CHAR.repeat(6)}`;
  const suffix = DOUBLE_RULE_CHAR.repeat(6);
  return `${prefix}${content}${suffix}`;
}
