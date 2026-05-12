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
 * Matches the top-level `"sessionId":"<value>"` field shape that JSON.stringify
 * produces. `[^"]*` is safe inside the value position: JSON escapes literal `"`
 * inside string values as `\"`, so the closing `"` is always the next
 * unescaped quote. Without the `g` flag, `.replace` substitutes only the
 * FIRST match per line — and the top-level sessionId is structurally first
 * (depth-0 keys serialize before nested objects), so any later occurrence is
 * transcript content, not structure, and stays verbatim.
 *
 * The pattern intentionally does NOT match `"sessionId"` on a malformed line
 * that lacks the closing quote (e.g. an unterminated string value) — those
 * lines fall through the regex and pass byte-identical, matching the spec's
 * "corrupted line never throws" rule.
 */
const SESSION_ID_FIELD = /"sessionId":"[^"]*"/;

/**
 * Rewrite the top-level `sessionId` field on every JSONL entry to `newId`.
 *
 * Strategy:
 *   - Empty input → empty output.
 *   - Split on `\n`. For each line:
 *     - No `"sessionId"` substring → byte-identical pass-through.
 *     - Otherwise → `.replace` the first `"sessionId":"<value>"` match.
 *   - Rejoin on `\n`.
 *
 * Lines without a sessionId field and lines whose sessionId substring is
 * malformed (no closing quote) both pass through byte-identical — neither
 * matches the regex.
 *
 * @param content    Raw JSONL content (newline-delimited JSON objects).
 * @param newId      The fresh session UUID (typically `crypto.randomUUID()`).
 * @returns          Rewritten content with byte-identical pass-through for
 *                   sessionId-less and malformed lines.
 */
export function rewriteJsonlSessionId(content: string, newId: string): string {
	if (content === "") return "";

	const replacement = `"sessionId":"${newId}"`;

	return content
		.split("\n")
		.map((line) => {
			// Hot-path short-circuit: file-history-snapshot, last-prompt,
			// permission-mode, and the trailing empty line never carry a
			// `"sessionId"` substring. Skipping them here saves a regex scan
			// per line on a megabyte-scale transcript.
			if (!line.includes('"sessionId"')) return line;
			return line.replace(SESSION_ID_FIELD, replacement);
		})
		.join("\n");
}
