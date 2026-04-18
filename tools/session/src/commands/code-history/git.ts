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
 * Field separator used in the `--format=%H%x00%cs%x00%s%x00%b` template.
 * `%x00` emits a literal NUL — robust to SHAs / dates / subjects / bodies
 * that might contain spaces, tabs, or newlines (bodies almost always do).
 */
const FIELD_SEP = "\x00";

/**
 * Expected number of fields per the `%H%x00%cs%x00%s%x00%b` format.
 * Keeping this named makes the parse check read cleanly below.
 */
const EXPECTED_FIELDS = 4;

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

  // Nonzero exit means git couldn't find any history for this line —
  // e.g. the file exists on disk but the path was never committed, or
  // the requested line isn't in any tracked revision. Treat all nonzero
  // exits as "no committed history" so the caller can surface AC 19.
  if (exitCode !== 0) {
    return null;
  }

  // A zero-exit-but-empty-stdout result also means "no history" — git's
  // `-L` treats some edge cases (e.g. fully-deleted lines) this way.
  const trimmed = stdout.replace(/\n+$/, "");
  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split(FIELD_SEP);
  if (parts.length < EXPECTED_FIELDS) {
    // Malformed output — surface as "no history" rather than throw.
    // If this ever fires we want to hear about it: include stderr so
    // the operator has something to go on.
    throw new Error(
      `git log produced unexpected output for ${file}:${line} ` +
        `(got ${parts.length} NUL-separated fields, expected ${EXPECTED_FIELDS}). ` +
        `stderr: ${stderr.trim()}`,
    );
  }

  const [sha, date, subject, ...bodyParts] = parts;
  // The body may itself contain NULs? Git doesn't emit them in %b, but
  // if upstream behavior ever changes, rejoining with FIELD_SEP preserves
  // the full body rather than silently dropping the tail.
  const body = bodyParts.join(FIELD_SEP).replace(/\n+$/, "");

  return {
    sha: sha!,
    date: date!,
    subject: subject!,
    body,
  };
}
