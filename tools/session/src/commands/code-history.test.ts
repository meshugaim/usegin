/**
 * Tests for `session code-history` command.
 *
 * Covers ENG-5040 slice 1 — the skeleton that implements AC 1, 2, 3, 4, 5,
 * and 19. Later slices extend this suite with session / linear / body
 * lines and `--json` mode.
 *
 * Layout:
 *   1. `parseCodeHistoryArgs` — pure arg parsing (AC 1, AC 2)
 *   2. `session code-history --help` — help output (AC 3)
 *   3. End-to-end CLI behavior (AC 4, AC 5, AC 19) against a fixture git repo
 *
 * Shared fixture helpers (`makeFixtureRepo`, `runCli`) live in
 * `./code-history/__fixtures__/helpers.ts` so slices 2+ can extend them
 * with trailers/bodies without forking a new helper.
 *
 * Tests MUST NOT read from the real monorepo's git history — that couples
 * to real commits and will break on every rewrite.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseCodeHistoryArgs } from "../cli-args";
import {
  makeFixtureRepo,
  runCli,
  withTempDir,
  type FixtureRepo,
} from "./code-history/__fixtures__/helpers";

// =============================================================================
// ARG PARSER (AC 1, AC 2)
// =============================================================================
//
// See `parseCodeHistoryArgs` in `../cli-args.ts` for the contract. The
// pattern reference is `parseFetchArgs` in the same file — but code-history
// is unique in accepting a `file:line` positional (the only parser in this
// codebase with a colon-embedded positional), so last-colon-is-separator
// edge cases get their own tests below.

describe("parseCodeHistoryArgs (AC 1, AC 2)", () => {
  test("ENG-5040: parses `file.ts:42` into { file, line }", () => {
    expect(parseCodeHistoryArgs(["src/foo.ts:42"])).toEqual({
      file: "src/foo.ts",
      line: 42,
    });
  });

  test("ENG-5040: accepts relative paths with `./`", () => {
    expect(parseCodeHistoryArgs(["./src/foo.ts:1"])).toEqual({
      file: "./src/foo.ts",
      line: 1,
    });
  });

  test("ENG-5040: accepts absolute paths", () => {
    expect(
      parseCodeHistoryArgs(["/workspaces/test-mvp/src/foo.ts:42"]),
    ).toEqual({
      file: "/workspaces/test-mvp/src/foo.ts",
      line: 42,
    });
  });

  test(
    "ENG-5040: last colon is the file/line separator (paths with embedded colons)",
    () => {
      // A path like `weird:name.ts:42` splits at the LAST colon: file is
      // `weird:name.ts`, line is `42`. Pinning the rule here so later
      // slices don't have to re-decide.
      expect(parseCodeHistoryArgs(["weird:name.ts:42"])).toEqual({
        file: "weird:name.ts",
        line: 42,
      });
    },
  );

  test("ENG-5040: recognizes --help", () => {
    expect(parseCodeHistoryArgs(["--help"])).toBe("help");
    expect(parseCodeHistoryArgs(["-h"])).toBe("help");
  });

  test("ENG-5040: throws when the positional arg is missing", () => {
    expect(() => parseCodeHistoryArgs([])).toThrow(/file.*line/i);
  });

  test("ENG-5040: throws when the arg has no colon separator", () => {
    // Pin EXACT wording — downstream slices and the E2E stderr assertion
    // below re-use this phrasing. This is the canonical "what you typed
    // doesn't match the grammar" message.
    expect(() => parseCodeHistoryArgs(["src/foo.ts"])).toThrow(
      'Expected <file>:<line>, got "src/foo.ts"',
    );
  });

  test("ENG-5040: throws when the line is non-integer", () => {
    expect(() => parseCodeHistoryArgs(["src/foo.ts:abc"])).toThrow(/line/i);
    expect(() => parseCodeHistoryArgs(["src/foo.ts:1.5"])).toThrow(/line/i);
  });

  test("ENG-5040: throws when the line is zero or negative", () => {
    expect(() => parseCodeHistoryArgs(["src/foo.ts:0"])).toThrow(/line/i);
    expect(() => parseCodeHistoryArgs(["src/foo.ts:-3"])).toThrow(/line/i);
  });

  test("ENG-5040: throws when the file portion is empty", () => {
    expect(() => parseCodeHistoryArgs([":42"])).toThrow(/file/i);
  });

  test("ENG-5040: throws when extra positionals are present (grammar is exactly one)", () => {
    // Regression guard: an earlier implementation silently kept the first
    // positional and dropped the rest — `session code-history foo:1 bar:2`
    // used to take `foo:1` and ignore `bar:2` with no warning. The grammar
    // is closed: extras are a hard error.
    expect(() =>
      parseCodeHistoryArgs(["src/foo.ts:1", "src/bar.ts:2"]),
    ).toThrow(/extra|unexpected|one <file>:<line>/i);
    // The error message should echo all the positionals the user typed so
    // they can see what we saw.
    expect(() =>
      parseCodeHistoryArgs(["src/foo.ts:1", "src/bar.ts:2"]),
    ).toThrow(/src\/bar\.ts:2/);
  });
});

// =============================================================================
// HELP (AC 3)
// =============================================================================

describe("session code-history --help (AC 3)", () => {
  // NOTE: no git fixture here — `--help` is pure output and doesn't touch
  // the git layer. Each test creates its own no-git tmp dir so we don't
  // pay ~200ms for `git init` + seed commits on tests that never need them.
  // The E2E describe below keeps its git fixture.

  test(
    "ENG-5040: prints command-specific help containing the usage line and exits 0",
    async () => {
      await withTempDir("code-history-help-", (tmpDir) => {
        const result = runCli(["code-history", "--help"], tmpDir);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("session code-history");
        expect(result.stdout).toMatch(/<file>:<line>/);
        // Must NOT print the top-level help (which starts with "Session - Parse").
        expect(result.stdout).not.toContain("Session - Parse Claude session");
      });
    },
  );

  test(
    "ENG-5040: --help works outside a git repo (guards against calling `getMostRecentCommit` before branching on help)",
    async () => {
      // A tmp dir with no `.git` — the command must branch on
      // `parsed === 'help'` BEFORE reaching the git layer, otherwise help
      // breaks when invoked anywhere outside a repo.
      await withTempDir("code-history-nohelp-", (noRepoDir) => {
        const result = runCli(["code-history", "--help"], noRepoDir);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("session code-history");
      });
    },
  );
});

// =============================================================================
// END-TO-END CLI (AC 4, AC 5, AC 19, plus AC 2 stderr checks)
// =============================================================================

describe("session code-history end-to-end", () => {
  let fixture: FixtureRepo;

  beforeAll(() => {
    fixture = makeFixtureRepo();
  });

  afterAll(() => {
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  test(
    "ENG-5040 (AC 4, AC 5): prints one header block for the most recent commit touching the line",
    () => {
      const result = runCli(
        ["code-history", `${fixture.file}:2`],
        fixture.dir,
      );

      expect(result.exitCode).toBe(0);

      // AC 5 exact header shape: `<short-sha>  <YYYY-MM-DD>  <subject>`.
      // SHA and subject are asserted exactly (SHA pinned via
      // `git rev-parse HEAD` in the fixture; subject pinned in the spec).
      // The date is soft-pinned on shape only (YYYY-MM-DD) to tolerate
      // CI clock skew — asserting today's date verbatim would make this
      // test flaky near midnight UTC / across slow CI queues.
      const firstLine = result.stdout.split("\n").find((l) => l.length > 0) ?? "";
      const match = firstLine.match(
        /^([0-9a-f]{8}) {2}(\d{4}-\d{2}-\d{2}) {2}(.+)$/,
      );
      expect(match).not.toBeNull();
      const [, sha, , subject] = match!;
      expect(sha).toBe(fixture.expectedSha);
      expect(subject).toBe(fixture.expectedSubject);

      // AC 4: only ONE commit block for this slice (no `-n` multi-commit yet).
      // A single header line is enough to assert the "one block" contract.
      const headerLines = result.stdout
        .split("\n")
        .filter((l) => /^[0-9a-f]{8} {2}\d{4}-\d{2}-\d{2} {2}/.test(l));
      expect(headerLines.length).toBe(1);
    },
  );

  test(
    "ENG-5040 (AC 19): line with no committed history → stderr message, exit 0",
    () => {
      // The fixture seeds an uncommitted line at `fixture.uncommittedLine`.
      // That line exists in the working tree (so upfront file-length
      // validation passes) but has no committed history (so `git log -L`
      // produces no output → the command takes AC 19's degradation path).
      // Using the sentinel instead of a magic number keeps this test's
      // intent — "line exists but wasn't committed" — on the page.
      const line = fixture.uncommittedLine;
      const result = runCli(
        ["code-history", `${fixture.file}:${line}`],
        fixture.dir,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain(
        `No committed history for ${fixture.file}:${line}`,
      );
      // Nothing goes to stdout in the "no history" path.
      expect(result.stdout.trim()).toBe("");
    },
  );

  test(
    "ENG-5040 (AC 2): missing file argument → non-zero exit, stderr message",
    () => {
      const result = runCli(["code-history"], fixture.dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toMatch(/file.*line|missing/);
    },
  );

  test(
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

  test(
    "ENG-5040 (AC 2): unparseable file:line (no colon) → non-zero exit, stderr explains the format",
    () => {
      const result = runCli(
        ["code-history", "src/foo.ts"],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr echoes the exact parser wording (pinned in the parser
      // test above) so wording drift in either place breaks the other.
      expect(result.stderr).toContain(
        'Expected <file>:<line>, got "src/foo.ts"',
      );
    },
  );

  test(
    "ENG-5040 (AC 2): nonexistent file → non-zero exit, stderr names the file AND explains it wasn't found",
    () => {
      const result = runCli(
        ["code-history", "src/does-not-exist.ts:1"],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Must emit a clear "file not found" message upfront, not let
      // `git log -L` error bubble out with a cryptic complaint. Accept
      // any common wording: "not found", "no such file", "does not exist".
      expect(result.stderr).toMatch(
        /src\/does-not-exist\.ts.*(not.*found|no such|does not exist)|((not.*found|no such|does not exist).*src\/does-not-exist\.ts)/i,
      );
    },
  );

  test(
    "ENG-5040: running outside a git repo → non-zero exit with a clear git error, NOT a misleading 'No committed history' message",
    async () => {
      // Regression guard: an earlier implementation silently routed any
      // `git log` nonzero exit to AC 19's "No committed history" path.
      // Outside a git repo, git errors with `fatal: not a git repository`
      // — that must surface to the user, not get squashed into the
      // no-history path.
      await withTempDir("code-history-norepo-", (noRepoDir) => {
        // Create a real file so upfront file-existence validation passes —
        // we want to exercise the git-layer failure path, not the AC 2
        // "file not found" path.
        const file = "target.ts";
        writeFileSync(join(noRepoDir, file), "line 1\nline 2\nline 3\n");

        const result = runCli(["code-history", `${file}:1`], noRepoDir);

        expect(result.exitCode).not.toBe(0);
        // Must surface the real git error under the `"Error: "` prefix.
        expect(result.stderr).toContain("Error:");
        // Must NOT take AC 19's no-history path — that would hide the real
        // failure from the user.
        expect(result.stderr).not.toContain(`No committed history for ${file}:1`);
      });
    },
  );

  test(
    "ENG-5040 (AC 2): line > file length → non-zero exit, stderr mentions the line being out of range",
    () => {
      // The fixture file has exactly 3 lines; ask for line 50.
      // AC 2 says this is an ERROR (not "no committed history"), because
      // the user asked for a line that doesn't exist in the file.
      const result = runCli(
        ["code-history", `${fixture.file}:50`],
        fixture.dir,
      );
      expect(result.exitCode).not.toBe(0);
      // Stderr must clearly signal that line 50 is out of range — not
      // just contain the digits "50" anywhere (a stack frame would
      // satisfy that weaker check).
      expect(result.stderr.toLowerCase()).toMatch(
        /line.*50|50.*line|exceed|out of range/,
      );
    },
  );
});
