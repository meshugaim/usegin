/**
 * Pure format functions for `session code-history`.
 *
 * Each formatter takes already-decorated data and returns a string.
 * No I/O, no spawning — these functions are trivially testable and will
 * be reused when future slices add the session / linear / body lines and
 * the `--json` branch.
 */

import type { DecoratedCommit } from "./types";

/**
 * Render the first line of a commit block:
 *
 *   `<short-sha>  <YYYY-MM-DD>  <subject>`
 *
 * Two spaces separate each field (spec AC 5). Short SHA is the first 8 hex
 * chars of the full SHA. The date is passed through as-is — `git log
 * --format=%cs` already emits ISO `YYYY-MM-DD`.
 *
 * TODO(ENG-5040 Green): returns a placeholder so format.test.ts fails at
 * assertion level. Implement the real rendering.
 */
export function formatHeader(_commit: DecoratedCommit): string {
  return "<header unimplemented>";
}
