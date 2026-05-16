/**
 * User-prompt extraction from parsed session turns.
 *
 * Pure functions that extract human-typed user messages from session turns
 * and format them for display in fzf or grep output.
 *
 * Filters out tool-result-only user turns and system-tag turns (those
 * starting with `<`, e.g. <command-name>, <system-reminder>, <bash-input>).
 */

import type { Turn } from "./types";

export interface UserPrompt {
  /** The user's typed text, newlines preserved. */
  text: string;
  /** ISO timestamp from the turn (null if absent). */
  timestamp: string | null;
  /** Session id (UUID string) the prompt came from. */
  sessionId: string;
  /** Turn index within the session. */
  turnIndex: number;
}

/**
 * Field separator used in formatted fzf entries.
 * Tab is reserved as the display/encoded-original boundary; round-trip tests
 * confirm prompts containing literal tabs are preserved through JSON encoding.
 */
const FIELD_SEP = "\t";

/** Display marker for newlines on the single-row display side. */
const NEWLINE_MARKER = " ⏎ ";

export function extractUserPrompts(turns: Turn[], sessionId: string): UserPrompt[] {
  const prompts: UserPrompt[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== "user") continue;
    const trimmed = turn.text.trim();
    if (!trimmed) continue;
    // Skip system-tag turns: <command-*>, <local-command-*>, <system-reminder>,
    // <bash-input>, <bash-stdout>, <user-prompt-submit-hook>, etc.
    if (trimmed.startsWith("<")) continue;
    prompts.push({
      text: turn.text,
      timestamp: turn.timestamp ?? null,
      sessionId,
      turnIndex: i,
    });
  }
  return prompts;
}

/**
 * Sort by timestamp descending, then dedup by exact text (most recent wins).
 * Null timestamps sort last (treated as oldest).
 */
export function dedupPrompts(prompts: UserPrompt[]): UserPrompt[] {
  const sorted = [...prompts].sort((a, b) => {
    if (a.timestamp && b.timestamp) return b.timestamp.localeCompare(a.timestamp);
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return 0;
  });
  const seen = new Set<string>();
  const out: UserPrompt[] = [];
  for (const p of sorted) {
    if (seen.has(p.text)) continue;
    seen.add(p.text);
    out.push(p);
  }
  return out;
}

/**
 * Format a UserPrompt as an fzf entry.
 *
 * Shape: `<display>\t<JSON-encoded original>`
 *
 * The display side flattens newlines to ⏎ and appends timestamp + session
 * prefix. The second tab-separated field carries the original text encoded
 * as JSON so any character (newlines, tabs, quotes) survives round-trip.
 *
 * Caller should drive fzf with `--delimiter=\t --with-nth=1` to show only
 * the display side while preserving the full entry on selection.
 */
export function formatPromptEntry(p: UserPrompt): string {
  const ts = p.timestamp
    ? new Date(p.timestamp).toISOString().slice(0, 16).replace("T", " ")
    : "                ";
  const flat = p.text.replace(/\n/g, NEWLINE_MARKER);
  const display = `${flat}    [${ts}  ${p.sessionId.slice(0, 8)}]`;
  return `${display}${FIELD_SEP}${JSON.stringify(p.text)}`;
}

/**
 * Recover the original prompt text from an fzf selection.
 *
 * Splits on the field separator and JSON-decodes the encoded-original side.
 * Falls back to returning the input unchanged when no separator is present
 * (defensive — shouldn't happen for entries produced by formatPromptEntry).
 */
export function extractPromptFromSelection(selection: string): string {
  // Use lastIndexOf: the display side may contain literal tabs from the original
  // prompt, but the JSON-encoded suffix never does (tabs encode as the two-char
  // sequence \t). The last tab in the entry is reliably the field separator.
  const idx = selection.lastIndexOf(FIELD_SEP);
  if (idx < 0) return selection;
  const encoded = selection.slice(idx + 1).trim();
  try {
    const parsed = JSON.parse(encoded);
    if (typeof parsed === "string") return parsed;
  } catch {
    // fall through
  }
  return selection;
}

/**
 * Non-interactive grep-style output: filter prompts containing the pattern
 * (case-insensitive) and render with the same per-entry display.
 */
export function formatPromptGrep(prompts: UserPrompt[], pattern: string): string {
  const lower = pattern.toLowerCase();
  const matches = prompts.filter((p) => p.text.toLowerCase().includes(lower));
  if (matches.length === 0) return `No prompts matching "${pattern}".`;
  const lines: string[] = [`Found ${matches.length} prompt(s) matching "${pattern}":`, ""];
  for (const p of matches) {
    const entry = formatPromptEntry(p);
    const display = entry.split(FIELD_SEP)[0];
    lines.push(display);
    lines.push("");
  }
  return lines.join("\n");
}
