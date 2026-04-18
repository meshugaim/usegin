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
import { join } from "node:path";

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

  const run = (cmd: string[], opts: { stdin?: string } = {}) => {
    const proc = Bun.spawnSync(cmd, {
      cwd: dir,
      env: {
        ...process.env,
        // Pinned author/committer so `git log --format=%an/%ae` stays
        // deterministic across CI environments that may not have a global
        // git identity configured.
        GIT_AUTHOR_NAME: "Code History Test",
        GIT_AUTHOR_EMAIL: "code-history-test@example.com",
        GIT_COMMITTER_NAME: "Code History Test",
        GIT_COMMITTER_EMAIL: "code-history-test@example.com",
      },
      stdin: opts.stdin ? new TextEncoder().encode(opts.stdin) : undefined,
    });
    if (proc.exitCode !== 0) {
      const stderr = new TextDecoder().decode(proc.stderr);
      throw new Error(`git command failed: ${cmd.join(" ")}\n${stderr}`);
    }
    return new TextDecoder().decode(proc.stdout);
  };

  run(["git", "init", "-q", "-b", "main"]);

  commits.forEach((commit, index) => {
    // Every commit rewrites the file so line 2 changes — `git log -L 2,2`
    // should then surface every commit in order.
    const contents = `line 1\nline 2 v${index + 1}\nline 3\n`;
    writeFileSync(join(dir, file), contents);
    run(["git", "add", file]);

    const message = composeCommitMessage(commit);
    run(["git", "commit", "-q", "-m", message]);
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
  const fullSha = run(["git", "rev-parse", "HEAD"]).trim();
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
