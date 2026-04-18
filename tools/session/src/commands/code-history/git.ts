/**
 * Git layer for `session code-history`.
 *
 * Thin wrapper around `git log -L <line>,<line>:<file>` that returns a
 * single decorated commit (or null if the line has no committed history).
 *
 * Uses `Bun.spawn` with an argv array — no shell interpolation — because
 * `file` flows in from user input and we must not offer a command-injection
 * surface (see spec Risks & Hazards).
 */

import type { DecoratedCommit } from "./types";

/**
 * Options for `getMostRecentCommit`.
 *
 * `cwd` lets callers run `git log` in a specific repo without relying on
 * `process.cwd()` — useful for unit tests (no `process.chdir()` dance)
 * and for future slices that may need to query a sibling worktree.
 * Command-layer callers default to `process.cwd()`.
 */
export interface GetMostRecentCommitOptions {
  /** Working directory for the `git log` invocation. Defaults to `process.cwd()`. */
  cwd?: string;
}

/**
 * Find the single most recent commit that touched `line` in `file`.
 *
 * Returns `null` when the line has no committed history (untracked file,
 * staged-but-uncommitted line, binary file that `-L` rejects, etc.) — the
 * caller decides how to surface that (spec AC 19 → stderr + exit 0).
 *
 * Implementation note for the Green phase:
 *   - Spawn: `git log -L <line>,<line>:<file> -n 1 --no-patch --format=%H%x00%cs%x00%s%x00%b`
 *   - Parse NUL-separated fields (robust to SHAs/dates/subjects with spaces).
 *   - Empty stdout OR nonzero exit that looks like "no history" → null.
 *   - Do NOT pass `--no-follow`: renames must be followed (spec AC 20).
 *   - Honor `options.cwd` (fall back to `process.cwd()`).
 */
export async function getMostRecentCommit(
  _file: string,
  _line: number,
  _options?: GetMostRecentCommitOptions,
): Promise<DecoratedCommit | null> {
  // TODO(ENG-5040 Green): implement the real `git log -L` spawn per the
  // notes above.
  throw new Error("getMostRecentCommit not yet implemented");
}
