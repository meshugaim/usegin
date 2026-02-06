/**
 * Output formatting utilities for the session finder.
 *
 * This module handles formatting session output in various formats
 * (path, id, json) and command line flag validation.
 */

import type { SessionInfo, SessionMeta, OutputFormat, ConflictingFlagsOptions } from "./types";
import { truncateMessage } from "./meta";

// =============================================================================
// OUTPUT FORMATTING
// =============================================================================

/**
 * Format session output based on requested format.
 */
export function formatOutput(session: SessionInfo, format: OutputFormat): string {
  switch (format) {
    case "id":
      return session.id;
    case "json":
      return JSON.stringify({
        path: session.path,
        id: session.id,
        date: session.mtime.toISOString(),
        project: session.project,
      });
    case "path":
    default:
      return session.path;
  }
}

// =============================================================================
// RELATIVE TIME FORMATTING
// =============================================================================

/**
 * Format a Date as a human-readable relative time string.
 *
 * Examples: "2m ago", "3h ago", "1d ago", "2w ago", "3mo ago"
 *
 * @param date The date to format relative to now
 * @param now  Optional reference time (defaults to Date.now(), useful for testing)
 */
export function formatRelativeTime(date: Date, now?: number): string {
  const nowMs = now ?? Date.now();
  const diffMs = nowMs - date.getTime();

  // Guard against future dates
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 14) return `${days}d ago`;
  if (weeks < 8) return `${weeks}w ago`;
  return `${months}mo ago`;
}

// =============================================================================
// RICH LIST LINE FORMATTING
// =============================================================================

/**
 * Format a session as a rich one-line summary for `session list`.
 *
 * Format:
 *   4a7ffc84  2h ago   281 turns   "can you try to use agent-browser..."
 *
 * The short ID, relative time, turn count, and first user prompt give
 * a future Claude (or human) enough to triage which session to dig into.
 */
export function formatListLine(
  session: SessionInfo,
  meta: SessionMeta,
): string {
  const shortId = session.id.slice(0, 8);
  const relTime = formatRelativeTime(session.mtime);
  const turns = meta.turnCount;

  // Pick the best summary text: AI summary > first user message > (none)
  let prompt = "";
  if (meta.summary) {
    prompt = truncateMessage(meta.summary, 50);
  } else if (meta.messages.length > 0) {
    prompt = truncateMessage(meta.messages[0], 50);
  }

  // Right-align the relative time and turn count for scanability.
  // Use explicit separators so columns never merge regardless of content width.
  const timePad = relTime.padStart(8);
  const turnStr = `${turns} turns`.padStart(10);

  const quotedPrompt = prompt ? `  "${prompt}"` : "";
  return `${shortId}  ${timePad}  ${turnStr}${quotedPrompt}`;
}

// =============================================================================
// FLAG VALIDATION
// =============================================================================

/**
 * Check for conflicting command line flags and return a warning message if found.
 *
 * @returns Warning message string, or null if no conflict
 */
export function warnIfConflictingFlags(options: ConflictingFlagsOptions): string | null {
  if (options.project && options.allProjects) {
    return "Ignoring --project because --all-projects specified";
  }
  return null;
}
