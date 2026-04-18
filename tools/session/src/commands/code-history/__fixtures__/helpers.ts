/**
 * Shared fixtures for `session code-history` tests.
 *
 * Parameterized helpers live here so slices 2+ (session trailers, Linear
 * trailers, context extractors, JSON mode) can build richer commits by
 * passing structured commit specs — without forking a new fixture helper
 * per slice.
 *
 * Layout:
 *   - `makeFixtureRepo(spec?)` — create a throwaway git repo with a
 *     sequence of commits that all touch the same line of a known file.
 *   - `runCli(args, cwd)`      — spawn the session CLI as a subprocess.
 *
 * WHY SUBPROCESS (not in-process):
 *   The E2E tests exercise the whole dispatch path — argv parsing,
 *   subcommand routing, command execution, formatter output, and exit
 *   codes. The command layer calls `process.exit(1)` on invalid args,
 *   which would kill the test runner if we invoked `runCodeHistory`
 *   directly. A ~50ms subprocess-startup cost per test is the price we
 *   pay for that full-path coverage. Pure-format and pure-parser tests
 *   stay in-process (see `../format.test.ts` and the
 *   `parseCodeHistoryArgs` suite in `../code-history.test.ts`).
 */

import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Path to the CLI entrypoint so `Bun.spawn` can invoke it. The `"..", "..",
 * ".."` chain assumes this file lives at
 * `src/commands/code-history/__fixtures__/helpers.ts`; if `__fixtures__`
 * ever moves, the `statSync` guard below fails loudly at module load
 * rather than silently feeding a nonexistent path to `bun` (which would
 * surface as every E2E test failing with a confusing "Cannot find module"
 * in stderr).
 */
const CLI_ENTRY = join(import.meta.dir, "..", "..", "..", "cli.ts");
try {
  statSync(CLI_ENTRY);
} catch (err) {
  throw new Error(
    `code-history test helpers: CLI_ENTRY not found at ${CLI_ENTRY}. ` +
      `If __fixtures__ was moved, update the "..", "..", ".." path in helpers.ts. ` +
      `Original error: ${(err as Error).message}`,
  );
}

/**
 * Pinned author/committer identity for every `git` invocation in a
 * fixture repo. Centralized so the tests see a stable author across CI
 * environments that may not have a global git identity configured.
 */
const FIXTURE_GIT_ENV = {
  GIT_AUTHOR_NAME: "Code History Test",
  GIT_AUTHOR_EMAIL: "code-history-test@example.com",
  GIT_COMMITTER_NAME: "Code History Test",
  GIT_COMMITTER_EMAIL: "code-history-test@example.com",
} as const;

/**
 * Run a `git` (or other) command in the given directory and return its
 * stdout. Throws on non-zero exit with the stderr inlined, so a broken
 * fixture setup points at the first failing git step rather than a
 * mystery later in the test.
 *
 * Extracted because `makeFixtureRepo` and `makeFixtureRepoWithRename`
 * previously defined identical inner `run(cmd)` closures with the same
 * env-vars dance. Centralizing the spawn keeps the identity config
 * (see {@link FIXTURE_GIT_ENV}) in one place and makes it trivial to
 * add features like `stdin` uniformly across both fixture shapes.
 */
function runGit(
  cwd: string,
  cmd: string[],
  opts: { stdin?: string } = {},
): string {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...FIXTURE_GIT_ENV },
    stdin: opts.stdin ? new TextEncoder().encode(opts.stdin) : undefined,
  });
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`git command failed: ${cmd.join(" ")}\n${stderr}`);
  }
  return new TextDecoder().decode(proc.stdout);
}

/**
 * One commit in a fixture repo.
 *
 * Slices 2+ will use `body` to add `Claude-Session: <id>` / `ENG-XXXX`
 * trailers when wiring up the session- and linear-line context.
 */
export interface FixtureCommitSpec {
  /** Commit subject line. */
  subject: string;
  /** Optional commit body. Trailers like `Claude-Session: <id>` go here. */
  body?: string;
  /**
   * Optional trailers (appended under `body` with a blank line). Convenience
   * for slice 2+ which will assert on `Claude-Session:` / `ENG-XXXX`.
   * Example: `{ "Claude-Session": "abc-123", "Part of": "ENG-5041" }`.
   */
  trailers?: Record<string, string>;
}

export interface FixtureRepoSpec {
  /**
   * Commits to apply, in order. Commit N writes `line N+1 vN` into the
   * same position of the target file, so `git log -L` against line 2
   * surfaces every commit that changed that line.
   *
   * Default: 3 commits, only the third touches the "watched" line with a
   * known subject.
   */
  commits?: FixtureCommitSpec[];
}

export interface FixtureRepo {
  /** Repo root (cwd to use when spawning the CLI). */
  dir: string;
  /** Target file path, relative to `dir`. */
  file: string;
  /** Subject of the final commit — the one tests assert the header against. */
  expectedSubject: string;
  /** Short (8-char) SHA of the final commit — lets E2E pin the exact header. */
  expectedSha: string;
  /**
   * Line number of an uncommitted line that exists in the working tree
   * but has no committed history. Drives the AC 19 "No committed history"
   * test without reusing a line number that's already been committed.
   * See `makeFixtureRepo` for how this line is seeded.
   */
  uncommittedLine: number;
}

/**
 * Create a throwaway git repo with a sequence of commits touching line 2
 * of a known file. Returns the repo root, the file path, and the expected
 * subject + short SHA of the final commit.
 *
 * The caller is responsible for `rmSync(dir, { recursive: true, force: true })`.
 */
export function makeFixtureRepo(spec: FixtureRepoSpec = {}): FixtureRepo {
  const commits: FixtureCommitSpec[] = spec.commits ?? [
    { subject: "initial: add target file" },
    { subject: "chore: tweak another line" },
    { subject: "feat(target): change the watched line" },
  ];

  const dir = mkdtempSync(join(tmpdir(), "code-history-fixture-"));
  const file = "src/target.ts";

  mkdirSync(join(dir, "src"), { recursive: true });

  runGit(dir, ["git", "init", "-q", "-b", "main"]);

  commits.forEach((commit, index) => {
    // Every commit rewrites the file so line 2 changes — `git log -L 2,2`
    // should then surface every commit in order.
    const contents = `line 1\nline 2 v${index + 1}\nline 3\n`;
    writeFileSync(join(dir, file), contents);
    runGit(dir, ["git", "add", file]);

    const message = composeCommitMessage(commit);
    runGit(dir, ["git", "commit", "-q", "-m", message]);
  });

  // After committing, append an UNCOMMITTED 4th line. This gives us a
  // working-tree line that exists (so upfront file-length validation
  // doesn't reject it) but has no committed history (so `git log -L`
  // returns empty / errors, which the command surfaces via AC 19's
  // "No committed history for <file>:<line>" path). Keeping this inside
  // the fixture — rather than having each AC 19 test append its own line —
  // means every test sees the same canonical "staged-only / uncommitted"
  // shape.
  const committedContents = `line 1\nline 2 v${commits.length}\nline 3\n`;
  const uncommittedLine = 4;
  writeFileSync(
    join(dir, file),
    `${committedContents}line ${uncommittedLine} uncommitted\n`,
  );

  const expectedSubject = commits[commits.length - 1]!.subject;
  const fullSha = runGit(dir, ["git", "rev-parse", "HEAD"]).trim();
  const expectedSha = fullSha.slice(0, 8);

  return { dir, file, expectedSubject, expectedSha, uncommittedLine };
}

/**
 * Compose a commit message from a subject, optional body, and optional
 * trailers. Upholds git's trailer convention: trailers are separated from
 * the body (or from the subject, when body is absent) by exactly one
 * blank line, so `git interpret-trailers --parse` will read them.
 *
 * Exported so unit tests can pin the exact output shape — slices 2+
 * depend on that shape when asserting `Claude-Session:` / `ENG-XXXX`
 * trailers round-trip through git into the formatter.
 */
export function composeCommitMessage(commit: FixtureCommitSpec): string {
  const parts: string[] = [commit.subject];
  if (commit.body && commit.body.length > 0) {
    parts.push("", commit.body);
  }
  if (commit.trailers && Object.keys(commit.trailers).length > 0) {
    const trailerLines = Object.entries(commit.trailers).map(
      ([key, value]) => `${key}: ${value}`,
    );
    parts.push("", trailerLines.join("\n"));
  }
  return parts.join("\n");
}

/**
 * Fixture repo seeded with a file that was RENAMED across commits.
 *
 * Used by the AC 20 E2E test (ENG-5041) to confirm `git log -L` follows
 * renames inherently when `--no-follow` is NOT passed. The DEFAULT repo
 * has:
 *
 *   1. pre-rename commit: create `src/original.ts` with known content
 *      on 3 lines.
 *   2. rename commit: `git mv src/original.ts src/renamed.ts`, no
 *      content change.
 *
 * So `session code-history src/renamed.ts:2` — asking for a line under
 * the POST-rename path whose last edit happened in the pre-rename
 * commit under the PRE-rename path — only returns that commit when
 * rename-following works. If a future regression passed `--no-follow`,
 * the command would return "no history" for that query. That's the AC
 * 20 invariant this fixture forces.
 *
 * The default shape is deliberately MINIMAL (no post-rename content
 * edit) so the query line's last commit is unambiguously the pre-
 * rename commit. An earlier version included a third commit that
 * edited line 2 of `renamed.ts` directly, which defeated the test:
 * `git log -L 2,2:renamed.ts -n 1` returned that third commit
 * regardless of whether follow worked — a false safety net.
 *
 * Slices 4+ can parameterize this fixture via {@link FixtureRepoWithRenameSpec}
 * to embed `Claude-Session:` / `Part of: ENG-XXXX` trailers on either
 * side of the rename. The parameterization is designed to KEEP the
 * "line 2 never edited post-creation" invariant even when extra
 * commits are added.
 */
export interface FixtureRepoWithRename {
  /** Repo root. */
  dir: string;
  /** The pre-rename path (first commit's file). */
  originalFile: string;
  /** The post-rename path (the one users query after the rename commit). */
  renamedFile: string;
  /**
   * Subject of the commit that introduced the watched line (pre-rename).
   * If rename-following works, `git log -L 2,2:<renamedFile>` reaches it.
   * This is also the subject the AC 20 test asserts against — reaching
   * the pre-rename subject is the whole point of the test.
   */
  preRenameSubject: string;
  /**
   * The post-rename commits that were applied (if any). Exposed so
   * future slices can assert on trailers / session IDs in post-rename
   * history without re-deriving the commit list. Empty when the default
   * minimal fixture is used.
   */
  postRenameCommits: FixtureCommitSpec[];
}

/**
 * Optional spec for {@link makeFixtureRepoWithRename}.
 *
 * Mirrors {@link FixtureRepoSpec}'s `{ commits: [...] }` shape so
 * callers don't have to learn two different fixture idioms. All fields
 * optional — omitting the spec entirely yields the minimal
 * "create then rename" fixture the AC 20 test uses today.
 *
 * Slices 4+ can pass `preRenameCommits` / `postRenameCommits` to embed
 * `Claude-Session:` / `Part of: ENG-XXXX` trailers on either side of
 * the rename without forking another helper.
 */
export interface FixtureRepoWithRenameSpec {
  /**
   * Commits to apply BEFORE the rename, in order. The first commit
   * creates `rename.from` with 3 known lines (watched line at line 2).
   * Subsequent pre-rename commits (if any) edit lines 1 and 3 only —
   * they never touch line 2 — so the AC 20 invariant (line 2's last
   * touch is the introducing commit) survives extra commits.
   *
   * Default: a single `"initial: add original.ts with watched line"`.
   */
  preRenameCommits?: FixtureCommitSpec[];
  /**
   * The rename pair. Default: `{ from: "src/original.ts", to:
   * "src/renamed.ts" }`. Done via `git mv` so `git log --follow` sees
   * a 100% similarity move.
   */
  rename?: { from: string; to: string };
  /**
   * Commits to apply AFTER the rename, in order. Each post-rename
   * commit edits lines OTHER than line 2, preserving the AC 20
   * invariant (otherwise we'd be back to the "commit 3 edits line 2"
   * pitfall that defeated the earlier fixture).
   *
   * Default: none (minimal fixture).
   */
  postRenameCommits?: FixtureCommitSpec[];
}

/**
 * Seed a fixture repo where a tracked file was renamed. See
 * {@link FixtureRepoWithRename} for the exact shape.
 *
 * Caller is responsible for `rmSync(dir, { recursive: true, force: true })`.
 *
 * @param spec Optional — defaults to a minimal "create then rename"
 * fixture that preserves the AC 20 invariant. Pass `preRenameCommits`
 * / `postRenameCommits` to embed trailers while keeping that invariant.
 */
export function makeFixtureRepoWithRename(
  spec: FixtureRepoWithRenameSpec = {},
): FixtureRepoWithRename {
  const preRenameCommits: FixtureCommitSpec[] = spec.preRenameCommits ?? [
    { subject: "initial: add original.ts with watched line" },
  ];
  if (preRenameCommits.length === 0) {
    // Without at least one pre-rename commit there's nothing to rename.
    // Fail loudly rather than producing a repo where `git mv` errors
    // out mid-seed.
    throw new Error(
      "makeFixtureRepoWithRename: preRenameCommits must include at least one commit (the one that creates the file to be renamed)",
    );
  }
  const rename = spec.rename ?? {
    from: "src/original.ts",
    to: "src/renamed.ts",
  };
  const postRenameCommits = spec.postRenameCommits ?? [];

  const dir = mkdtempSync(join(tmpdir(), "code-history-rename-fixture-"));
  const preRenameSubject = preRenameCommits[0]!.subject;

  // `from` and `to` may live in different subdirs. Create the parent
  // dir of each on demand so callers aren't forced to pick paths under
  // a single pre-existing subdir.
  mkdirSync(join(dir, dirname(rename.from)), { recursive: true });
  mkdirSync(join(dir, dirname(rename.to)), { recursive: true });

  runGit(dir, ["git", "init", "-q", "-b", "main"]);

  // Pre-rename commits. The first commit creates the file with 3 known
  // lines (watched line at line 2). Each subsequent pre-rename commit
  // edits line 1 or line 3 ONLY — never the watched line 2 — so the
  // AC 20 invariant (line 2's last touch is commit 0) survives extra
  // commits.
  preRenameCommits.forEach((commit, index) => {
    // Alternate edits between line 1 and line 3 so each extra commit
    // produces a diff a reviewer can read off at a glance.
    const lineIdx = index % 2 === 0 ? 0 : 2;
    const contents = [
      `line 1${index === 0 ? "" : lineIdx === 0 ? ` v${index}` : ""}`,
      "line 2 original",
      `line 3${index === 0 ? "" : lineIdx === 2 ? ` v${index}` : ""}`,
    ];
    writeFileSync(join(dir, rename.from), `${contents.join("\n")}\n`);
    runGit(dir, ["git", "add", rename.from]);
    runGit(dir, ["git", "commit", "-q", "-m", composeCommitMessage(commit)]);
  });

  // Rename commit — pure `git mv`, no content change. Using `git mv`
  // (vs fs rename + `git add -A`) is intentional: `git mv` stages the
  // rename deterministically so `git log --follow` sees a 100%
  // similarity move without relying on rename-detection heuristics.
  runGit(dir, ["git", "mv", rename.from, rename.to]);
  runGit(dir, [
    "git",
    "commit",
    "-q",
    "-m",
    `chore: rename ${rename.from} to ${rename.to}`,
  ]);

  // Post-rename commits. Same "never touch line 2" invariant as the
  // pre-rename sequence — otherwise we'd be back to the pitfall where
  // a post-rename edit defeats the rename-follow test.
  postRenameCommits.forEach((commit, index) => {
    const lineIdx = index % 2 === 0 ? 0 : 2;
    const contents = [
      `line 1${lineIdx === 0 ? ` post${index}` : ""}`,
      "line 2 original",
      `line 3${lineIdx === 2 ? ` post${index}` : ""}`,
    ];
    writeFileSync(join(dir, rename.to), `${contents.join("\n")}\n`);
    runGit(dir, ["git", "add", rename.to]);
    runGit(dir, ["git", "commit", "-q", "-m", composeCommitMessage(commit)]);
  });

  return {
    dir,
    originalFile: rename.from,
    renamedFile: rename.to,
    preRenameSubject,
    postRenameCommits,
  };
}

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn the session CLI with `args` and `cwd`. See the module header for
 * why we go through a subprocess instead of calling `runCodeHistory`
 * directly.
 */
export function runCli(args: string[], cwd: string): CliResult {
  const proc = Bun.spawnSync(["bun", CLI_ENTRY, ...args], { cwd });
  return {
    exitCode: proc.exitCode ?? -1,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

/**
 * Run `fn` in a fresh throwaway tmp directory, then remove it no matter
 * what `fn` does. Works for both sync and async callbacks — `await` on a
 * non-promise is a no-op.
 *
 * Extracted because the tmp-dir dance (`mkdtempSync` → `try { fn } finally
 * { rmSync }`) appeared 5 times across `code-history.test.ts` and
 * `git.test.ts`. Naming the helper "tmp-dir-scoped work" makes the intent
 * obvious at each call site and keeps the cleanup guarantee uniform.
 *
 * `prefix` is the `mkdtempSync` prefix — pass something that identifies
 * the test (e.g. `"code-history-help-"`) so leftover dirs from a crashed
 * run are easy to attribute.
 */
export async function withTempDir<T>(
  prefix: string,
  fn: (dir: string) => T | Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
