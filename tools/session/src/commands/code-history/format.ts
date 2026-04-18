/**
 * Pure format functions for `session code-history`.
 *
 * Each formatter takes already-decorated data and returns a string.
 * No I/O, no spawning — these functions are trivially testable and will
 * be reused when future slices add the session / linear / body lines and
 * the `--json` branch.
 */

import { stripTrailers } from "./trailers";
import type { DecoratedCommit } from "./types";

/** Length of the short SHA we emit in headers. Git's default `--short` is
 * 7, but 8 gives a little more collision headroom without being unwieldy
 * and is what the spec pins. */
const SHORT_SHA_LEN = 8;

/**
 * Maximum length of the body-preview line (spec AC 8 — "truncated to
 * ~160 chars with '…'"). The truncation rule:
 *
 *   if the joined preview exceeds BODY_PREVIEW_MAX_LEN chars, keep the
 *   first (BODY_PREVIEW_MAX_LEN - 1) chars and append `…`, for a final
 *   length of exactly BODY_PREVIEW_MAX_LEN.
 *
 * Pinning the "160 total, ellipsis counts as one char" interpretation
 * here so slices 4/5/6 (session/linear/JSON) can't drift to a different
 * rule later.
 */
export const BODY_PREVIEW_MAX_LEN = 160;

/**
 * The ellipsis character appended when the preview is truncated. Single
 * char (Unicode `…`, U+2026) rather than three dots (`...`) — one char
 * makes the length arithmetic exact and matches what terminal-aware
 * output reviewers will recognize as "truncated, not end of sentence".
 *
 * Exported so tests and slices 4/5/6 reference the pinned character
 * rather than hardcoding it.
 */
export const BODY_PREVIEW_ELLIPSIS = "…";

/**
 * Visible field separator in the header line (spec AC 5) — two spaces.
 *
 * Named `HEADER_FIELD_SEP` to disambiguate from the NUL separator used
 * in `./git.ts` (`GIT_LOG_FIELD_SEP`). Both files previously used a
 * constant called `FIELD_SEP`, which made grepping ambiguous once more
 * formatted lines get added in slices 4+ (session / linear) and JSON
 * mode (slice 6).
 */
const HEADER_FIELD_SEP = "  ";

/**
 * Render the first line of a commit block:
 *
 *   `<short-sha>  <YYYY-MM-DD>  <subject>`
 *
 * Two spaces separate each field (spec AC 5). Short SHA is the first 8 hex
 * chars of the full SHA — but we don't pad a short SHA (never happens in
 * practice with real git, but keeps the layer total for synthesized /
 * mocked commits). The date is passed through as-is — `git log
 * --format=%cs` already emits ISO `YYYY-MM-DD`.
 */
export function formatHeader(commit: DecoratedCommit): string {
  const shortSha = commit.sha.slice(0, SHORT_SHA_LEN);
  return `${shortSha}${HEADER_FIELD_SEP}${commit.date}${HEADER_FIELD_SEP}${commit.subject}`;
}

/**
 * Render the body-preview string (spec AC 8) from a raw commit body.
 *
 * Rules (pinned by `format.test.ts`):
 *
 *   1. Strip trailing trailers using `stripTrailers` (see `./trailers.ts`).
 *   2. Split the remaining body into lines and drop blank lines.
 *   3. Take the first 2 non-blank body lines and space-join them.
 *   4. If the result is longer than {@link BODY_PREVIEW_MAX_LEN} chars,
 *      truncate to `(BODY_PREVIEW_MAX_LEN - 1)` chars and append
 *      {@link BODY_PREVIEW_ELLIPSIS}, for a total length of
 *      exactly {@link BODY_PREVIEW_MAX_LEN}.
 *   5. If the body is empty or becomes empty after trailer stripping,
 *      return `""` — the caller (`runCodeHistory`) is responsible for
 *      omitting the `body:` line entirely (spec AC 9, "missing layer
 *      → no line"). No placeholder, no blank line.
 *
 * Returning `""` (rather than `null` / `undefined`) keeps the return type
 * total — callers check `.length === 0` to decide whether to emit the
 * `body:` line. Slices 4/5 will follow the same "empty string → omit
 * line" pattern for session / linear rendering.
 */
export function formatBody(body: string): string {
  const stripped = stripTrailers(body);
  if (stripped.length === 0) return "";

  // Drop blank lines so `"foo\n\nbar"` renders as `"foo bar"`, not
  // `"foo "`. Taking the first 2 non-blank lines matches the spec's
  // "first 2 lines" rule without being tripped up by incidental gaps.
  //
  // Loop + break (rather than filter + slice) so slices 4/5 (which walk
  // multiple commits per invocation) don't scan past the first two
  // non-blank lines of each body. No measurable effect on slice 2 —
  // `stripTrailers` already walks the full body once, so `formatBody`
  // pays O(n) regardless on a single-commit invocation.
  const nonBlank: string[] = [];
  for (const l of stripped.split("\n")) {
    if (l.length > 0) nonBlank.push(l);
    if (nonBlank.length === 2) break;
  }
  if (nonBlank.length === 0) return "";

  const joined = nonBlank.join(" ");

  // Only truncate when STRICTLY over the limit. A body that is exactly
  // BODY_PREVIEW_MAX_LEN chars long stays whole; MAX+1 gets cut to
  // (MAX - 1) chars + ellipsis, for a final length of exactly MAX.
  if (joined.length <= BODY_PREVIEW_MAX_LEN) return joined;
  return joined.slice(0, BODY_PREVIEW_MAX_LEN - 1) + BODY_PREVIEW_ELLIPSIS;
}

// =============================================================================
// formatSinceTimestamp (AC 6 — ENG-5043)
// =============================================================================

/**
 * Compute the `--since-timestamp <t-30m>` string for the session-line hint.
 *
 * Input: an ISO-8601 commit timestamp (the `committedAt` field on
 * `DecoratedCommit`, derived from `git log --format=%cI`).
 *
 * Output: the commit time minus 30 minutes, formatted as
 * `YYYY-MM-DDTHH:MMZ` (UTC, minute precision). Seconds are dropped —
 * minute precision is sufficient for the "start from 30m before commit"
 * heuristic and produces shorter, human-readable CLI output.
 *
 * Edge cases pinned by unit tests (see format.test.ts):
 *   - minute=00:      `2026-04-18T09:00:00Z` → `2026-04-18T08:30Z`
 *   - day boundary:   `2026-04-18T00:15:00Z` → `2026-04-17T23:45Z`
 *   - month boundary: `2026-01-01T00:15:00Z` → `2025-12-31T23:45Z`
 *
 * Implementation: `new Date(iso) - 30*60*1000`, re-serialize with
 * `.toISOString()` (always UTC `Z`), slice off seconds.
 */
export function formatSinceTimestamp(_commitISO: string): string {
  // Red-phase stub — `<unimplemented>` is a pinned sentinel so the
  // test.failing assertions (which compare against the real expected
  // timestamps) fail at the assertion level rather than the import
  // level. Removed in the Green phase.
  return "<unimplemented>";
}

// =============================================================================
// formatSessionBlock (AC 6 — ENG-5043)
// =============================================================================

/**
 * Render the multi-line session block emitted after the header in plain
 * mode. Returns `null` when `commit.session` is absent — same
 * "missing layer → no line" convention as `formatBody` (AC 9), so the
 * caller omits the whole block cleanly with no blank-line padding.
 *
 * Format (values left-align via fixed-width label padding):
 *
 * ```
 *     session:  <full-uuid>  (→ session <8char-uuid> --since-timestamp <t-30m>)
 *       intent:   <value>
 *       trigger:  <value>
 *       outcome:  <value>
 * ```
 *
 * Layout rules (pinned by `format.test.ts`):
 *   - `session:` line at 4-space indent. `session:` is the widest label
 *     in the 4-space group (slice 5 adds `linear:`; slice 2 already emits
 *     `body:` via `formatBody` but not inside this block), so labels at
 *     the 4-space level pad to width 8 + ":" + 2 spaces before the value.
 *     For `session:` specifically that's `session:` (8 chars incl colon)
 *     + 2 spaces = value starts at column 4 + 8 + 2 = 14.
 *   - Nested `intent:` / `trigger:` / `outcome:` at 6-space indent. The
 *     widest labels in this group are `trigger:` and `outcome:` (8 chars
 *     incl colon). `intent:` (7 chars) pads with 3 spaces; `trigger:` /
 *     `outcome:` pad with 2 spaces. Values align at column 6 + 8 + 2 = 16.
 *   - Nested lines whose extractor returned `undefined` are OMITTED —
 *     no placeholder, no blank line (AC 9 invariant reused for the
 *     session-block nested lines). A session with only `intent`
 *     populated renders as `session:` + `intent:` lines, nothing else.
 *   - The `session:` line ALWAYS renders when `commit.session` is set.
 *     AC 13 (auto-fetch graceful degradation) relies on this: on
 *     `SessionNotFoundError`, the pipeline populates `commit.session`
 *     with just `id` + `sinceTimestampCmd` (no extractors), and the
 *     block renders as just the session line + hint.
 */
export function formatSessionBlock(_commit: DecoratedCommit): string | null {
  // Red-phase stub — returns a pinned `<unimplemented>` sentinel so
  // EVERY test.failing assertion (including the "session absent → null"
  // case) fails at the assertion level rather than passing by accident.
  // Green phase replaces this with the real renderer (which returns
  // `null` legitimately when `commit.session` is absent).
  return "<unimplemented>";
}
