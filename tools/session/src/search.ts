/**
 * Search within a session's turns for matching text.
 *
 * Extracts the search logic as a pure function for testability.
 * Used by the `session search-in` subcommand.
 */

import type { Turn } from "./types";

export interface SearchMatch {
  /** Turn index in the session */
  index: number;
  /** Role of the turn (user or assistant) */
  role: "user" | "assistant";
  /** Context snippet around the match */
  snippet: string;
}

/**
 * Search through session turns for text matching a query.
 *
 * Searches both turn text and tool result content. Case-insensitive.
 * Returns matches with a context snippet showing surrounding text.
 *
 * @param turns - Array of parsed turns from the session
 * @param query - Text to search for (case-insensitive)
 * @returns Array of matches with turn index, role, and snippet
 */
export function searchInSession(turns: Turn[], query: string): SearchMatch[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const matches: SearchMatch[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    // Build searchable text from turn text and all tool result content
    const searchableText = [
      turn.text,
      ...turn.toolResults.map((r) => r.content),
    ].join("\n");

    if (searchableText.toLowerCase().includes(lowerQuery)) {
      // Extract a snippet around the first match
      const lowerSearchable = searchableText.toLowerCase();
      const matchIdx = lowerSearchable.indexOf(lowerQuery);
      const snippetStart = Math.max(0, matchIdx - 60);
      const snippetEnd = Math.min(
        searchableText.length,
        matchIdx + query.length + 60
      );
      const snippet =
        (snippetStart > 0 ? "..." : "") +
        searchableText.slice(snippetStart, snippetEnd) +
        (snippetEnd < searchableText.length ? "..." : "");

      matches.push({
        index: i,
        role: turn.role,
        snippet: snippet.replace(/\n/g, " "),
      });
    }
  }

  return matches;
}
