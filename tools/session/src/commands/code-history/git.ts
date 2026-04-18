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
 */
export async function getMostRecentCommit(
  _file: string,
  _line: number,
): Promise<DecoratedCommit | null> {
  // Red-phase stub — Green agent implements the real `git log -L` spawn.
  throw new Error("getMostRecentCommit not yet implemented");
}
