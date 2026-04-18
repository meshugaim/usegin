/**
 * Pure format functions for `session code-history`.
 *
 * Each formatter takes already-decorated data and returns a string.
 * No I/O, no spawning — these functions are trivially testable and will
 * be reused when future slices add the session / linear / body lines and
 * the `--json` branch.
 */

import type { DecoratedCommit } from "./types";

/** Length of the short SHA we emit in headers. Git's default `--short` is
 * 7, but 8 gives a little more collision headroom without being unwieldy
 * and is what the spec pins. */
const SHORT_SHA_LEN = 8;

/**
 * Maximum length of the body-preview line (spec AC 8 — "truncated to
 * ~160 chars with '…'"). The truncation rule Green will implement:
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
 */
export const BODY_PREVIEW_ELLIPSIS = "…";

/**
 * Visible field separator in the header line (spec AC 5) — two spaces.
 *
 * Named `HEADER_FIELD_SEP` to disambiguate from the NUL separator used
 * in `./git.ts` (`GIT_LOG_FIELD_SEP`). Both files previously used a
 * constant called `FIELD_SEP`, which made grepping ambiguous once more
 * formatted lines get added in slices 2+ (session / linear / body).
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
 * Green-phase rules this stub will implement (pinned by `format.test.ts`):
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
export function formatBody(_body: string): string {
  // Red-phase stub — Green-phase implementation will apply the rules
  // enumerated in this function's doc comment. The stub returns a sentinel
  // so every `test.failing` in `format.test.ts` asserts against a known
  // wrong value rather than silently passing.
  return "<unimplemented>";
}
