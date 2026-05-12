/**
 * JSONL session-id rewriter (ENG-5862 step 8, AC 36 — `session resume --fork`).
 *
 * When the user invokes `session resume <id> --fork`, the cross-env CLI takes
 * a copy of the source JSONL under a fresh UUIDv4 and resumes the copy. The
 * one structural change between source and fork is the top-level `sessionId`
 * field on every JSONL entry that carries one — claude code keys its own
 * resume lookup on this field, so the fork must self-identify as the new id.
 *
 * ## Design — string-level, NOT JSON parse + stringify
 *
 * We operate at the *string* level for two reasons:
 *
 *   1. **Performance**: the parent's JSONL can be megabytes; reparsing every
 *      line + restringifying allocates an order of magnitude more than a
 *      single-substring scan + targeted replace.
 *
 *   2. **Byte-identical pass-through**: lines without a top-level `sessionId`
 *      (e.g. `file-history-snapshot`, `attachment`, `last-prompt`,
 *      `permission-mode` entries) MUST emerge byte-equal to the source. A
 *      JSON round-trip would silently reorder keys, drop whitespace, or
 *      re-encode numbers — all benign for a parser but a contract violation
 *      for callers that compare bytes (the fork-test pins exact equality).
 *
 * ## What gets rewritten
 *
 * Only the **top-level** `sessionId` field. Nested UUID-shaped fields
 * (`uuid`, `parentUuid`, `leafUuid`, `sourceToolAssistantUUID`, `messageId`,
 * subagent uuids inside tool-results, etc.) are preserved verbatim — they
 * identify *messages and tool-calls*, not the session, and claude code keys
 * its own resume on the top-level `sessionId` alone.
 *
 * ## Malformed lines
 *
 * A line that doesn't parse as JSON is passed through byte-identical. The
 * rewriter never throws on corrupted content; the cost of skipping a
 * corrupted line is at worst losing the rewrite on that one line, which the
 * downstream sync flow surfaces as a clean error rather than a crash here.
 *
 * Part of: ENG-5862 (slice 2, AC 36)
 */

/**
 * Rewrite the top-level `sessionId` field on every JSONL entry to `newId`.
 *
 * @param content    Raw JSONL content (newline-delimited JSON objects).
 * @param newId      The fresh session UUID (typically `crypto.randomUUID()`).
 * @returns          Rewritten content. Lines without `sessionId` are passed
 *                   through byte-identical. Malformed lines are passed
 *                   through byte-identical too.
 */
export function rewriteJsonlSessionId(content: string, newId: string): string {
	throw new Error(
		"rewriteJsonlSessionId: not implemented (ENG-5862 step 8 Red)",
	);
}
