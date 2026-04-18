/**
 * Trailer-stripping helpers for commit bodies.
 *
 * Git's trailer convention (per `git-interpret-trailers(1)`): a trailer is a
 * group of `Key: value` lines at the END of a commit message, separated from
 * the body proper by exactly one blank line. Mid-body lines that happen to
 * match `Key: value` (e.g. "Note: this is a special case") are NOT trailers.
 *
 * WHY PURE TYPESCRIPT (not `git interpret-trailers --parse`):
 *   - This module is called per commit by the formatter. Slices 4 and 5 will
 *     reuse it to extract `Claude-Session:` IDs and `ENG-XXXX` references.
 *     A subprocess per commit is unnecessary cost when the rule is "block of
 *     `Key: value` lines at end, separated by a blank line" — ~20 lines of TS.
 *   - `git interpret-trailers` would still leave us to strip the trailer
 *     block ourselves; it only tells us WHICH lines are trailers, not what's
 *     left after removing them.
 *   - Keeping this pure means the format layer stays trivially testable and
 *     the tests don't need a git fixture just to exercise body-preview logic.
 *
 * Slice 2 (ENG-5041) uses `stripTrailers` for the body-preview line.
 * Slice 4 will add `extractTrailers` to surface `Claude-Session: <uuid>`.
 * Slice 5 will reuse that to look for `Part of: ENG-XXXX` / `Closes: ENG-XXXX`.
 */

/**
 * Standard git-trailer line shape. Matches `Key: value` at the start of a
 * line, where `Key` is one or more space-separated tokens of
 * letters/digits/dashes, each starting with a letter. The trailing space
 * after `:` is REQUIRED — `Foo:bar` is not a trailer.
 *
 * The space-separated multi-token form accommodates keys like `Part of`
 * and `Signed-off-by` that the spec explicitly lists as strippable
 * trailers. Git's `interpret-trailers` treats these as valid trailer
 * tokens; our regex does the same.
 *
 * Anchored with `^` so the caller feeds one line at a time; no `m` flag
 * needed at this layer.
 */
const TRAILER_LINE_RE = /^[A-Za-z][A-Za-z0-9-]*(?: [A-Za-z][A-Za-z0-9-]*)*:\s/;

/**
 * Remove the trailing trailer block from a commit body and return the
 * remaining body lines.
 *
 * Rules (Red-phase placeholder — Green will implement):
 *   - The trailer block is the contiguous run of trailer-shaped lines at
 *     the END of the body, preceded by at least one blank line.
 *   - Mid-body lines that look like trailers are NOT stripped.
 *   - If the entire body is trailers (or empty), returns `""`.
 *   - Otherwise, returns the body with the trailing blank line(s) and
 *     trailer block removed, and no trailing `\n`.
 *
 * @param body Raw commit body as produced by `git log --format=%b` (or empty).
 */
export function stripTrailers(_body: string): string {
  // Red-phase stub: not yet implemented. Tests marked `test.failing` drive
  // the Green-phase implementation that will use `TRAILER_LINE_RE` and the
  // block-at-end-preceded-by-blank rule described in the module header.
  return "<unimplemented>";
}

/**
 * True iff the given line matches the git-trailer shape. Exported so the
 * body formatter (slice 2) and the session/linear extractors (slices 4-5)
 * agree on exactly one definition of "what counts as a trailer line".
 */
export function isTrailerLine(line: string): boolean {
  return TRAILER_LINE_RE.test(line);
}
