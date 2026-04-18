/**
 * Tests for `session code-history` command.
 *
 * ALL tests are RED-phase (`test.failing`) stubs for ENG-5040. The Green
 * agent flips them to passing by implementing the real behavior in
 * `./code-history/git.ts`, the real arg-parser validation, and any
 * additional stderr polish.
 *
 * Layout:
 *   1. `parseCodeHistoryArgs` — pure arg parsing (AC 1, AC 2)
 *   2. `session code-history --help` — help output (AC 3)
 *   3. End-to-end CLI behavior (AC 4, AC 5, AC 19) against a fixture git repo
 *
 * The fixture repo lives under a tmp dir (see `makeFixtureRepo`). Tests
 * MUST NOT read from the real monorepo's git history — that couples to
 * real commits and will break on every rewrite.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseCodeHistoryArgs } from "../cli-args";

// =============================================================================
// FIXTURE REPO
// =============================================================================

/**
 * Create a throwaway git repo with N commits touching a known file & line.
 *
 * Returns `{ dir, file }`:
 *   - `dir`: repo root (cwd to use when spawning the CLI)
 *   - `file`: path to the file inside the repo, relative to `dir`
 *
 * The file ends up with 3 commits, the most recent of which has a known
 * subject line the tests can assert on.
 */
function makeFixtureRepo(): { dir: string; file: string; expectedSubject: string } {
  const dir = mkdtempSync(join(tmpdir(), "code-history-fixture-"));
  const file = "src/target.ts";
  const expectedSubject = "feat(target): change the watched line";

  mkdirSync(join(dir, "src"), { recursive: true });

  const run = (cmd: string[], opts: { stdin?: string } = {}) => {
    const proc = Bun.spawnSync(cmd, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Red Test",
        GIT_AUTHOR_EMAIL: "red@example.com",
        GIT_COMMITTER_NAME: "Red Test",
        GIT_COMMITTER_EMAIL: "red@example.com",
      },
      stdin: opts.stdin ? new TextEncoder().encode(opts.stdin) : undefined,
    });
    if (proc.exitCode !== 0) {
      const stderr = new TextDecoder().decode(proc.stderr);
      throw new Error(`git command failed: ${cmd.join(" ")}\n${stderr}`);
    }
  };

  run(["git", "init", "-q", "-b", "main"]);

  // Commit 1: initial content.
  writeFileSync(join(dir, file), "line 1\nline 2\nline 3\n");
  run(["git", "add", file]);
  run(["git", "commit", "-q", "-m", "initial: add target file"]);

  // Commit 2: touch line 2 with an unrelated subject.
  writeFileSync(join(dir, file), "line 1\nline 2 v2\nline 3\n");
  run(["git", "add", file]);
  run(["git", "commit", "-q", "-m", "chore: tweak another line"]);

  // Commit 3: touch line 2 again — this is the commit we expect to see.
  writeFileSync(join(dir, file), "line 1\nline 2 v3 final\nline 3\n");
  run(["git", "add", file]);
  run(["git", "commit", "-q", "-m", expectedSubject]);

  return { dir, file, expectedSubject };
}

/** Path to the CLI entrypoint so `Bun.spawn` can invoke it. */
const CLI_ENTRY = join(import.meta.dir, "..", "cli.ts");

function runCli(
  args: string[],
  cwd: string,
): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["bun", CLI_ENTRY, ...args], { cwd });
  return {
    exitCode: proc.exitCode ?? -1,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

// =============================================================================
// ARG PARSER (AC 1, AC 2)
// =============================================================================

describe("parseCodeHistoryArgs (AC 1, AC 2)", () => {
  test.failing("ENG-5040: parses `file.ts:42` into { file, line }", () => {
    expect(parseCodeHistoryArgs(["src/foo.ts:42"])).toEqual({
      file: "src/foo.ts",
      line: 42,
    });
  });

  test.failing("ENG-5040: accepts relative paths with `./`", () => {
    expect(parseCodeHistoryArgs(["./src/foo.ts:1"])).toEqual({
      file: "./src/foo.ts",
      line: 1,
    });
  });

  test.failing("ENG-5040: recognizes --help", () => {
    expect(parseCodeHistoryArgs(["--help"])).toBe("help");
    expect(parseCodeHistoryArgs(["-h"])).toBe("help");
  });

  test.failing("ENG-5040: throws when the positional arg is missing", () => {
    expect(() => parseCodeHistoryArgs([])).toThrow(/file.*line/i);
  });

  test.failing("ENG-5040: throws when the arg has no colon separator", () => {
    expect(() => parseCodeHistoryArgs(["src/foo.ts"])).toThrow(/file.*line/i);
  });

  test.failing("ENG-5040: throws when the line is non-integer", () => {
    expect(() => parseCodeHistoryArgs(["src/foo.ts:abc"])).toThrow(/line/i);
    expect(() => parseCodeHistoryArgs(["src/foo.ts:1.5"])).toThrow(/line/i);
  });

  test.failing("ENG-5040: throws when the line is zero or negative", () => {
    expect(() => parseCodeHistoryArgs(["src/foo.ts:0"])).toThrow(/line/i);
    expect(() => parseCodeHistoryArgs(["src/foo.ts:-3"])).toThrow(/line/i);
  });

  test.failing("ENG-5040: throws when the file portion is empty", () => {
    expect(() => parseCodeHistoryArgs([":42"])).toThrow(/file/i);
  });
});

// =============================================================================
// HELP (AC 3)
// =============================================================================

describe("session code-history --help (AC 3)", () => {
  test.failing(
    "ENG-5040: prints command-specific help containing the usage line and exits 0",
    () => {
      // Use a freshly created repo as cwd so we don't execute git against
      // the monorepo — help should not care, but we don't want surprises.
      const { dir } = makeFixtureRepo();
      try {
        const result = runCli(["code-history", "--help"], dir);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("session code-history");
        expect(result.stdout).toMatch(/<file>:<line>/);
        // Must NOT print the top-level help (which starts with "Session - Parse").
        expect(result.stdout).not.toContain("Session - Parse Claude session");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

// =============================================================================
// END-TO-END CLI (AC 4, AC 5, AC 19, plus AC 2 stderr checks)
// =============================================================================

describe("session code-history end-to-end", () => {
  let fixture: { dir: string; file: string; expectedSubject: string };

  beforeAll(() => {
    fixture = makeFixtureRepo();
  });

  afterAll(() => {
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  test.failing(
    "ENG-5040 (AC 4, AC 5): prints one header block for the most recent commit touching the line",
    () => {
      const result = runCli(
        ["code-history", `${fixture.file}:2`],
        fixture.dir,
      );

      expect(result.exitCode).toBe(0);

      // AC 5 header shape: `<short-sha>  <YYYY-MM-DD>  <subject>`
      //   - 8 lowercase hex chars
      //   - two spaces
      //   - YYYY-MM-DD
      //   - two spaces
      //   - subject
      const firstLine = result.stdout.split("\n").find((l) => l.length > 0) ?? "";
      expect(firstLine).toMatch(
        /^[0-9a-f]{8} {2}\d{4}-\d{2}-\d{2} {2}.+/,
      );
      expect(firstLine).toContain(fixture.expectedSubject);

      // AC 4: only ONE commit block for this slice (no `-n` multi-commit yet).
      // A single header line is enough to assert the "one block" contract.
      const headerLines = result.stdout
        .split("\n")
        .filter((l) => /^[0-9a-f]{8} {2}\d{4}-\d{2}-\d{2} {2}/.test(l));
      expect(headerLines.length).toBe(1);
    },
  );

  test.failing(
    "ENG-5040 (AC 19): line with no committed history → stderr message, exit 0",
    () => {
      // Line 999 in a 3-line file has no committed history.
      const result = runCli(
        ["code-history", `${fixture.file}:999`],
        fixture.dir,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain(
        `No committed history for ${fixture.file}:999`,
      );
      // Nothing goes to stdout in the "no history" path.
      expect(result.stdout.trim()).toBe("");
    },
  );

  test.failing(
    "ENG-5040 (AC 2): missing file argument → non-zero exit, stderr message",
    () => {
      const result = runCli(["code-history"], fixture.dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toMatch(/file.*line|missing/);
    },
  );

  test.failing(
    "ENG-5040 (AC 2): non-integer line → non-zero exit, stderr explains the line is invalid",
    () => {
      const result = runCli(
        ["code-history", `${fixture.file}:not-a-number`],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr must reference the bad token the user typed AND name
      // "line" — not just bubble up a random stack trace that happens to
      // contain the word "line" in a source-code variable name.
      expect(result.stderr).toContain("not-a-number");
      expect(result.stderr.toLowerCase()).toMatch(/line/);
    },
  );

  test.failing(
    "ENG-5040 (AC 2): unparseable file:line (no colon) → non-zero exit, stderr explains the format",
    () => {
      const result = runCli(
        ["code-history", "src/foo.ts"],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr must explain the expected shape — not just be "some error".
      expect(result.stderr.toLowerCase()).toMatch(/file.*line|<file>:<line>|colon/);
    },
  );

  test.failing(
    "ENG-5040 (AC 2): nonexistent file → non-zero exit, stderr names the file",
    () => {
      const result = runCli(
        ["code-history", "src/does-not-exist.ts:1"],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr must actually tell the user WHICH file is missing, so they
      // can act on the error.
      expect(result.stderr).toContain("src/does-not-exist.ts");
    },
  );

  test.failing(
    "ENG-5040 (AC 2): line > file length → non-zero exit, stderr mentions the line",
    () => {
      // The fixture file has exactly 3 lines; ask for line 50.
      // AC 2 says this is an ERROR (not "no committed history"), because
      // the user asked for a line that doesn't exist in the file.
      const result = runCli(
        ["code-history", `${fixture.file}:50`],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr must name the out-of-range line number.
      expect(result.stderr).toContain("50");
    },
  );
});
