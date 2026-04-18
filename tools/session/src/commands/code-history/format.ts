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

/** Field separator in the header line (spec AC 5). */
const FIELD_SEP = "  ";

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
  return `${shortSha}${FIELD_SEP}${commit.date}${FIELD_SEP}${commit.subject}`;
}
