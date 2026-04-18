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
 * NUL separator used in the `--format=%H%x00%cs%x00%s%x00%b` template.
 * `%x00` emits a literal NUL — robust to SHAs / dates / subjects / bodies
 * that might contain spaces, tabs, or newlines (bodies almost always do).
 *
 * Named `GIT_LOG_FIELD_SEP` to disambiguate from the visible two-space
 * separator used in `formatHeader` (see `./format.ts`). Both layers
 * previously used a constant called `FIELD_SEP`, which made grepping for
 * "the separator" ambiguous when slices 2+ add more formatted lines.
 */
const GIT_LOG_FIELD_SEP = "\x00";

/**
 * Minimum number of fields per the `%H%x00%cs%x00%s%x00%b` format.
 *
 * The format emits 4 NUL-separated fields; a body containing NULs (git
 * doesn't emit them in `%b`, but defensively) would yield more fields,
 * which we rejoin. So this is a LOWER BOUND, not an exact count — hence
 * `MIN_FIELDS`.
 */
const MIN_FIELDS = 4;

/**
 * Git `-L` stderr phrases that indicate the requested line has no
 * committed history (as opposed to a genuine git failure like "not a
 * repo" or "unable to read"). When stderr matches one of these, we return
 * `null` so the command layer takes AC 19's plain-message path. Anything
 * else is re-thrown so the caller surfaces a real error.
 *
 * Phrasing pinned from upstream git `line-log.c`:
 *   - "There is no path X in the commit"      — untracked / new file
 *   - "file X has only N lines"               — line beyond committed range
 *   - "no such path X in the commit"          — older git phrasing for the same
 *
 * Test coverage (keep aligned as patterns evolve):
 *   - "no path"       → exercised by nonexistent-file test in `./git.test.ts`
 *                       and by the E2E nonexistent-file test in
 *                       `../code-history.test.ts`
 *   - "has only "     → exercised by the uncommitted-line test in
 *                       `./git.test.ts` (line beyond committed range) and
 *                       the AC 19 E2E test in `../code-history.test.ts`
 *   - "no such path"  → legacy git phrasing, not currently exercised by a
 *                       dedicated test — kept as a defensive hedge against
 *                       older git versions that may still reach this layer
 *
 * These are substring matches — git formats the messages with variable
 * filenames / line numbers, so we match on the stable prefix. The trailing
 * space in `"has only "` forces a following token so a hypothetical future
 * git string like `has_only` or `has onlyXYZ` can't accidentally match.
 */
const NO_HISTORY_STDERR_PATTERNS: readonly string[] = [
  "no path",
  "no such path",
  "has only ",
];

/**
 * Find the single most recent commit that touched `line` in `file`.
 *
 * Returns `null` when the line has no committed history (untracked file,
 * staged-but-uncommitted line, binary file that `-L` rejects, etc.) — the
 * caller decides how to surface that (spec AC 19 → stderr + exit 0).
 *
 * Uses `Bun.spawn` with an argv array (no shell) so user-controlled `file`
 * can't inject shell metacharacters. Renames are followed inherently by
 * `git log -L` — we deliberately do NOT pass `--no-follow` (spec AC 20).
 */
export async function getMostRecentCommit(
  file: string,
  line: number,
  options?: GetMostRecentCommitOptions,
): Promise<DecoratedCommit | null> {
  const cwd = options?.cwd ?? process.cwd();

  const proc = Bun.spawn(
    [
      "git",
      "log",
      `-L`,
      `${line},${line}:${file}`,
      "-n",
      "1",
      "--no-patch",
      `--format=%H%x00%cs%x00%s%x00%b`,
    ],
    {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  // Distinguish "no committed history for this line" from a genuine git
  // error (not in a repo, permission denied, unreadable object, etc.).
  // The former → `null` → caller takes AC 19's plain "No committed
  // history for ..." stderr path. The latter → throw, so the caller
  // surfaces the git stderr under the `"Error: "` prefix — otherwise
  // a real failure gets silently misreported as "no committed history"
  // and the user has no idea what actually went wrong.
  if (exitCode !== 0) {
    if (isNoHistoryStderr(stderr)) {
      return null;
    }
    throw new Error(
      `git log failed for ${file}:${line} (exit ${exitCode}): ${stderr.trim()}`,
    );
  }

  // A zero-exit-but-empty-stdout result also means "no history" — git's
  // `-L` treats some edge cases (e.g. fully-deleted lines) this way.
  const trimmed = stdout.replace(/\n+$/, "");
  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split(GIT_LOG_FIELD_SEP);
  if (parts.length < MIN_FIELDS) {
    // Malformed output — if this ever fires we want to hear about it;
    // include stderr so the operator has something to go on.
    throw new Error(
      `git log produced unexpected output for ${file}:${line} ` +
        `(got ${parts.length} NUL-separated fields, expected at least ${MIN_FIELDS}). ` +
        `stderr: ${stderr.trim()}`,
    );
  }

  const [sha, date, subject, ...bodyParts] = parts;
  // The body may itself contain NULs? Git doesn't emit them in %b, but
  // if upstream behavior ever changes, rejoining preserves the full
  // body rather than silently dropping the tail.
  const body = bodyParts.join(GIT_LOG_FIELD_SEP).replace(/\n+$/, "");

  return {
    sha: sha!,
    date: date!,
    subject: subject!,
    body,
  };
}

/**
 * Classify a `git log -L` stderr as "this just means the line has no
 * committed history" vs "git actually failed for some other reason".
 *
 * We match on stable substrings (see `NO_HISTORY_STDERR_PATTERNS`) rather
 * than exact strings because git formats these messages with the filename
 * and line numbers interpolated. Case-insensitive as a very small hedge
 * against localization / version drift.
 */
function isNoHistoryStderr(stderr: string): boolean {
  const haystack = stderr.toLowerCase();
  return NO_HISTORY_STDERR_PATTERNS.some((p) => haystack.includes(p));
}
