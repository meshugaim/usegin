/**
 * Trailer-stripping helpers for commit bodies.
 *
 * Git's trailer convention (per `git-interpret-trailers(1)`): a trailer is a
 * group of `Key: value` lines at the END of a commit message, separated from
 * the body proper by at least one blank line. Mid-body lines that happen to
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
 * Rules:
 *   - The trailer block is the contiguous run of trailer-shaped lines at
 *     the END of the body. In canonical git form it's preceded by at
 *     least one blank line, but we also collapse a body that is ONLY
 *     trailer-shaped lines (no preamble) to `""` — defensive against
 *     malformed `%b` output.
 *   - Mid-body lines that look like trailers are NOT stripped: the
 *     trailer block must either (a) start at line 0, or (b) be preceded
 *     by one or more blank lines.
 *   - If the entire body is trailers (or empty), returns `""`.
 *   - Otherwise, returns the body with the trailing blank line(s) and
 *     trailer block removed, and no trailing `\n`.
 *   - Any trailing blank lines are stripped regardless of whether a
 *     trailer block was found — callers never see a phantom blank tail.
 *     Slices 4/5 rely on this when reusing `stripTrailers` upstream of
 *     `session:` / `linear:` line extraction.
 *
 * @param body Raw commit body as produced by `git log --format=%b` (or empty).
 */
export function stripTrailers(body: string): string {
  if (body.length === 0) return "";

  const lines = body.split("\n");

  // Walk backwards from the end, consuming a contiguous run of
  // trailer-shaped lines. That run is the candidate trailer block.
  let trailerStart = lines.length;
  while (trailerStart > 0 && isTrailerLine(lines[trailerStart - 1]!)) {
    trailerStart -= 1;
  }

  // No trailer-shaped tail → no stripping needed (modulo trimming
  // trailing blank lines, which we do unconditionally at the end).
  if (trailerStart === lines.length) {
    return trimTrailingBlank(lines).join("\n");
  }

  // The trailer block is only a real trailer block when it starts at
  // the top of the body OR is preceded by at least one blank line.
  // Otherwise those lines are mid-body prose that happens to be
  // trailer-shaped (e.g. "Note: this applies to edge cases.") and we
  // leave them in place.
  const precededByBlank =
    trailerStart === 0 || lines[trailerStart - 1] === "";
  if (!precededByBlank) {
    return trimTrailingBlank(lines).join("\n");
  }

  // Strip the trailer block, then also strip the blank-line separator(s)
  // that preceded it so callers don't get a phantom blank tail.
  const kept = lines.slice(0, trailerStart);
  return trimTrailingBlank(kept).join("\n");
}

/**
 * Drop trailing blank lines from a line array. Used after trailer
 * stripping so the preserved body ends on a real content line with no
 * trailing `\n`.
 */
function trimTrailingBlank(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end -= 1;
  return lines.slice(0, end);
}

/**
 * True iff the given line matches the git-trailer shape. Exported so the
 * body formatter (slice 2) and the session/linear extractors (slices 4-5)
 * agree on exactly one definition of "what counts as a trailer line".
 */
export function isTrailerLine(line: string): boolean {
  return TRAILER_LINE_RE.test(line);
}

// =============================================================================
// Claude-Session trailer extraction (slice 4 — ENG-5043)
// =============================================================================

/**
 * Regex for the `Claude-Session:` trailer line, pinned by the ENG-5039
 * spec:
 *
 *   `/^Claude-Session:\s*(\S+)\s*$/m`
 *
 * - Multiline (`m`) so `^` / `$` anchor on line boundaries within the
 *   raw body, not just the string start/end.
 * - `\s*` on both sides of the UUID tolerates incidental whitespace
 *   around the value.
 * - `\S+` captures the UUID verbatim — UUIDs have no whitespace, so
 *   this is the widest safe net (don't hard-code UUID v4 shape here;
 *   validation belongs at the `resolveSessionPath` boundary).
 *
 * Global flag is set so `matchAll` can enumerate multiple trailers in
 * amend-case commits. The caller takes the LAST match per spec.
 */
const CLAUDE_SESSION_TRAILER_RE = /^Claude-Session:\s*(\S+)\s*$/gm;

/**
 * Extract the `Claude-Session: <uuid>` UUID from a raw commit body.
 *
 * Returns:
 *   - `null` when the body contains no `Claude-Session:` trailer.
 *   - The UUID string (verbatim — no validation) when exactly one
 *     trailer is present.
 *   - The UUID from the LAST trailer when multiple are present
 *     (amend case: an amended commit accumulates trailers from each
 *     amendment; the last one reflects the final session that touched
 *     the commit).
 *
 * This function does NOT require the trailer to be in a canonical
 * trailer block (separated by a blank line). The spec's regex is
 * line-anchored, so a `Claude-Session:` that happens to appear mid-body
 * on its own line also matches. In practice `git log --format=%b`
 * always produces trailers at the end, so this flexibility is
 * theoretical — but it matches the spec-pinned regex exactly and
 * avoids reinventing the trailer-block vs mid-body distinction here
 * (that distinction belongs to `stripTrailers` for body-preview, not
 * to trailer extraction).
 *
 * Slice 4 (ENG-5043) uses this to decide whether to populate
 * `DecoratedCommit.session`. Slice 5 will add a matching
 * `extractLinearTrailer` once the Linear-line work lands.
 */
export function extractClaudeSessionTrailer(body: string): string | null {
  // Enumerate every line that matches the pinned Claude-Session regex.
  // `matchAll` returns each occurrence in document order; the LAST one
  // is the one that reflects the final session touching the commit
  // (amend case). Using `matchAll` over `match(/…/g)` so we get the
  // capture group on each hit.
  let last: string | null = null;
  for (const m of body.matchAll(CLAUDE_SESSION_TRAILER_RE)) {
    last = m[1] ?? null;
  }
  return last;
}
