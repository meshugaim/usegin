/**
 * Type guards and validation for JSONL entry parsing.
 *
 * These guards provide runtime validation for parsed JSON, replacing
 * unsafe `as Entry` casts with proper type narrowing.
 */

import type { Entry, EntryType } from "./types";
import { KNOWN_ENTRY_TYPES } from "./types";

/**
 * Check if a value is a non-null object.
 * This is the foundation for all entry validation.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check if a value is a valid EntryType.
 * Uses the KNOWN_ENTRY_TYPES array for validation.
 */
function isValidEntryType(type: unknown): type is EntryType {
  return typeof type === "string" && KNOWN_ENTRY_TYPES.includes(type);
}

/**
 * Type guard to check if a parsed JSON value is a valid Entry.
 *
 * This performs minimal validation - checking that the value is an object
 * with a valid `type` field. Individual entry type validation is left to
 * the specific parsing logic which already handles missing/malformed fields.
 *
 * @param value - The parsed JSON value to validate
 * @returns true if the value has the structure of an Entry
 *
 * @example
 * ```ts
 * const parsed = JSON.parse(line);
 * if (!isEntry(parsed)) {
 *   debugLog(debug, "Skipping invalid entry");
 *   continue;
 * }
 * // parsed is now typed as Entry
 * ```
 */
export function isEntry(value: unknown): value is Entry {
  if (!isObject(value)) {
    return false;
  }

  // Must have a valid type field
  if (!isValidEntryType(value.type)) {
    return false;
  }

  return true;
}

/**
 * Type guard specifically for entries that might have session ID.
 * Useful for filtering subagent files by session.
 *
 * Checks that the entry has either session_id or sessionId field.
 */
export function hasSessionId(
  entry: Entry
): entry is Entry & { session_id: string } | Entry & { sessionId: string } {
  return (
    (typeof entry.session_id === "string" && entry.session_id.length > 0) ||
    (typeof entry.sessionId === "string" && entry.sessionId.length > 0)
  );
}

/**
 * Extract session ID from an entry, checking both field names.
 * Returns empty string if no session ID is present.
 */
export function getSessionId(entry: Entry): string {
  return entry.session_id || entry.sessionId || "";
}

/**
 * Type guard for entries with an agentId field (subagent entries).
 */
export function hasAgentId(entry: Entry): entry is Entry & { agentId: string } {
  return typeof entry.agentId === "string" && entry.agentId.length > 0;
}
