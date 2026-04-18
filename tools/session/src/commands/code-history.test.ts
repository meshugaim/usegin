/**
 * Tests for `session code-history` command.
 *
 * Covers acceptance criteria landed so far:
 *   - AC 1, 2     — arg parsing + upfront validation (ENG-5040 slice 1)
 *   - AC 3        — command-specific help            (ENG-5040 slice 1)
 *   - AC 4, 5, 19 — header line + no-history path    (ENG-5040 slice 1)
 *   - AC 8, 9     — body preview + missing-layer rule (ENG-5041 slice 2)
 *   - AC 20       — rename following                 (ENG-5041 slice 2)
 *   - AC 24       — reserved-flag rejection          (ENG-5041 slice 2)
 *
 * Later slices will extend this suite with session / linear lines and
 * `--json` mode (slices 4-6).
 *
 * Layout:
 *   1. `parseCodeHistoryArgs` — pure arg parsing
 *   2. Reserved flags — parser layer
 *   3. `session code-history --help` — help output
 *   4. End-to-end CLI behavior against a fixture git repo
 *   5. Body preview + missing-layer ("no `body:` line") cases
 *   6. Rename-following regression guard
 *   7. Reserved flags — E2E layer
 *
 * Shared fixture helpers (`makeFixtureRepo`, `runCli`, `withFixtureRepo`,
 * `withTempDir`) live in `./code-history/__fixtures__/helpers.ts` so
 * slices 4+ can extend them with session / linear trailers without
 * forking a new helper.
 *
 * Tests MUST NOT read from the real monorepo's git history — that couples
 * to real commits and will break on every rewrite.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseCodeHistoryArgs,
  CODE_HISTORY_RESERVED_FLAGS,
  CODE_HISTORY_RESERVED_FLAG_MESSAGE,
} from "../cli-args";
import {
  makeFixtureRepo,
  makeFixtureRepoWithRename,
  runCli,
  withFixtureRepo,
  withTempDir,
  type FixtureRepo,
  type FixtureRepoWithRename,
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
// RESERVED FLAGS (AC 24) — ENG-5041
// =============================================================================
//
// Spec AC 24 carves out `-n <N>`, `--all`, `-L N,M`, `--func <name>` as
// reserved for a follow-up tracked in ENG-5048. The parser MUST reject
// these with a dedicated "not yet" message — not fall through to the
// generic "unexpected positional" path (which would happen today because
// `-n 3` sheds the `-n` and feeds `3` as a positional).
//
// Wording is pinned by CODE_HISTORY_RESERVED_FLAG_MESSAGE so the parser,
// the E2E stderr check, and any future CLAUDE.md / docs reference one
// canonical string.

describe("parseCodeHistoryArgs reserved flags (AC 24)", () => {
  // Two-tier coverage:
  //   1. BASIC PRESENCE — uniform `[flag, "3", "src/foo.ts:1"]` shape,
  //      iterates every reserved flag. Confirms each one trips the
  //      reject, independent of how it's normally invoked.
  //   2. REALISTIC SHAPES — per-flag tests using the SAME shape users
  //      would actually type (`-n 3`, `--all` bare, `-L 2,5`, `--func
  //      myFn`). Guards against a parser that rejects the uniform shape
  //      but accidentally accepts the real shape — e.g. a parser that
  //      expects a numeric arg after `--all` would pass tier 1 but let
  //      the bare `--all` slip through.
  //
  // Use a test.each-style loop so each reserved flag gets its own named
  // test — clearer failure output than one test with a forEach inside.
  // (Bun test supports dynamic test registration inside describe.)
  for (const flag of CODE_HISTORY_RESERVED_FLAGS) {
    test(
      `ENG-5041 (AC 24): rejects reserved flag \`${flag}\` with the pinned "not yet / ENG-5048" message (basic presence)`,
      () => {
        // Flag BEFORE the positional: `-n 3 file.ts:1`. The parser must
        // reject before even looking at the positional.
        expect(() => parseCodeHistoryArgs([flag, "3", "src/foo.ts:1"])).toThrow(
          CODE_HISTORY_RESERVED_FLAG_MESSAGE,
        );
      },
    );

    test(
      `ENG-5041 (AC 24): rejects reserved flag \`${flag}\` even when it appears AFTER the positional (basic presence)`,
      () => {
        // Regression guard: an implementation that only scans `args[0]`
        // for the reserved check would miss this ordering.
        expect(() =>
          parseCodeHistoryArgs(["src/foo.ts:1", flag, "3"]),
        ).toThrow(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
      },
    );
  }

  // Realistic-shape tests — one per reserved flag, matching the shape a
  // user would actually type. All reject with the same pinned message.
  test(
    "ENG-5041 (AC 24): rejects `-n 3 <file>:<line>` (user form — count flag + numeric arg)",
    () => {
      expect(() =>
        parseCodeHistoryArgs(["-n", "3", "src/foo.ts:1"]),
      ).toThrow(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
    },
  );

  test(
    "ENG-5041 (AC 24): rejects `--all <file>:<line>` (user form — bare flag, no argument)",
    () => {
      // Guards the "parser expects a value after every reserved flag"
      // bug — `--all` is a boolean flag and takes no argument.
      expect(() =>
        parseCodeHistoryArgs(["--all", "src/foo.ts:1"]),
      ).toThrow(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
    },
  );

  test(
    "ENG-5041 (AC 24): rejects `-L 2,5 <file>:<line>` (user form — range arg like git log -L)",
    () => {
      // `-L` in git takes a `start,end` range. We must reject the flag
      // itself before the parser tries to interpret `2,5` as anything.
      expect(() =>
        parseCodeHistoryArgs(["-L", "2,5", "src/foo.ts:1"]),
      ).toThrow(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
    },
  );

  test(
    "ENG-5041 (AC 24): rejects `--func myFn <file>:<line>` (user form — value arg that isn't a number)",
    () => {
      // `--func` takes a function name. Guards against a parser that
      // only rejects when the value after the flag is numeric (since
      // `-n 3` and `-L 2,5` both have numeric-shaped values).
      expect(() =>
        parseCodeHistoryArgs(["--func", "myFn", "src/foo.ts:1"]),
      ).toThrow(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
    },
  );

  // Split into two separate tests: the constant-shape check is a pure
  // data assertion over the exported string, and the parser-contract
  // check asserts the parser actually throws the pinned constant (not
  // a hand-rolled copy of its text). Clearer signal: if the parser
  // starts building its own message, only the parser-contract test
  // fires, pointing right at the drift.

  test(
    "ENG-5041 (AC 24): the pinned message references ENG-5048 and says 'not yet' so users know where the follow-up lives",
    () => {
      // Pure constant-shape check — already passes today, guards
      // against wording drift that would decouple the message from
      // ENG-5048 tracking.
      expect(CODE_HISTORY_RESERVED_FLAG_MESSAGE).toContain("ENG-5048");
      expect(CODE_HISTORY_RESERVED_FLAG_MESSAGE.toLowerCase()).toContain("not yet");
    },
  );

  test(
    "ENG-5041 (AC 24): the parser actually USES the pinned constant (guards against drift to a hardcoded string)",
    () => {
      // Parser-contract check. If the parser ever builds its own string
      // instead of throwing the pinned constant, this fails even if the
      // basic-presence tests above still pass (since they only check
      // `.toThrow(substring)` against the same constant's text).
      expect(() => parseCodeHistoryArgs(["-n", "3", "src/foo.ts:1"])).toThrow(
        CODE_HISTORY_RESERVED_FLAG_MESSAGE,
      );
    },
  );
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

  // Fixture convention: use `beforeAll` when multiple tests share the same
  // fixture shape (amortizes git-init cost across the describe); use
  // `withFixtureRepo` when each test wants its own tailored commit shape.
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

// =============================================================================
// END-TO-END CLI — body preview & "missing layer → no line" (AC 8, AC 9)
// =============================================================================
//
// Each test builds its own fixture with a tailored commit body/trailer
// shape. We deliberately don't reuse the top-level `fixture` repo so the
// body cases stay self-contained — reviewers can read one test and know
// exactly what's committed.

describe("session code-history body preview (AC 8, AC 9)", () => {
  // AC 8 pins the positive case (body line IS rendered when there's
  // real body content). AC 9 pins the negative case (NO `body:` line
  // when the body is empty or pure trailers). The AC 9 tests also act
  // as regression guards against future slices emitting a spurious
  // empty `body:` line for subject-only / trailers-only commits.

  test(
    "ENG-5041 (AC 8): commit with body + trailers → stdout includes `body:` line after the header",
    async () => {
      await withFixtureRepo(
        {
          commits: [
            { subject: "initial: seed target file" },
            {
              subject: "feat: add a thoughtful feature",
              body: "This commit does the thing. It also does the other thing.",
              trailers: {
                "Co-Authored-By": "Claude <noreply@anthropic.com>",
                "Part of": "ENG-5041",
              },
            },
          ],
        },
        (fx) => {
          const result = runCli(["code-history", `${fx.file}:2`], fx.dir);
          expect(result.exitCode).toBe(0);

          // The body line must follow the `<sha>  <date>  <subject>` header.
          // Pin the exact preview content — trailers stripped, two lines
          // space-joined.
          const lines = result.stdout.split("\n").filter((l) => l.length > 0);
          const bodyLine = lines.find((l) => l.startsWith("body:"));
          expect(bodyLine).toBeDefined();
          expect(bodyLine).toBe(
            "body: This commit does the thing. It also does the other thing.",
          );
        },
      );
    },
  );

  test(
    "ENG-5041 (AC 9): commit with ONLY trailers (no real body) → stdout has NO `body:` line",
    async () => {
      // The "missing layer → no line" invariant: when the body collapses
      // to pure trailers, omit the `body:` line entirely. No placeholder,
      // no blank line. Slices 4 and 5 follow this same pattern for the
      // session / linear lines.
      await withFixtureRepo(
        {
          commits: [
            { subject: "initial: seed" },
            {
              subject: "feat: thing with trailers only",
              trailers: {
                "Co-Authored-By": "Claude <noreply@anthropic.com>",
                "Claude-Session": "abc-123",
              },
            },
          ],
        },
        (fx) => {
          const result = runCli(["code-history", `${fx.file}:2`], fx.dir);
          expect(result.exitCode).toBe(0);
          // No line in stdout may START with "body:" — searching the raw
          // output catches even a line with trailing whitespace.
          const hasBodyLine = result.stdout
            .split("\n")
            .some((l) => l.startsWith("body:"));
          expect(hasBodyLine).toBe(false);
        },
      );
    },
  );

  test(
    "ENG-5041 (AC 9): commit with subject ONLY (no body, no trailers) → stdout has NO `body:` line",
    async () => {
      // Companion case to the trailers-only test — guards the other
      // branch of "empty body after stripping". The default fixture
      // commits are subject-only, so the default shape is a natural
      // fixture for this scenario.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(["code-history", `${fx.file}:2`], fx.dir);
        expect(result.exitCode).toBe(0);
        const hasBodyLine = result.stdout
          .split("\n")
          .some((l) => l.startsWith("body:"));
        expect(hasBodyLine).toBe(false);
      });
    },
  );
});

// =============================================================================
// END-TO-END CLI — rename following (AC 20)
// =============================================================================

describe("session code-history follows renames (AC 20)", () => {
  // Regression guard only — slice 1 already passes this invariant because
  // `getMostRecentCommit` deliberately omits `--no-follow`, so `git log
  // -L` follows renames inherently. If anyone ever adds `--no-follow` (or
  // switches to `--no-renames`), this fails loudly. The spec calls out
  // AC 20 as a "test only, no production change" acceptance criterion
  // for this slice.
  //
  // The fixture commits are: (1) create `original.ts` with the watched
  // line, (2) `git mv` it to `renamed.ts`. We query a line UNDER the
  // post-rename path whose ONLY commit-touch lives pre-rename. The only
  // way to reach that commit is rename-following — which is exactly why
  // this test fails loudly if follow ever breaks.
  //
  // Separate fixture because the rename case seeds a different set of
  // commits and files than the default fixture. `beforeAll`/`afterAll`
  // amortize the `git init` + commits across the tests in this describe.
  let fx: FixtureRepoWithRename;

  beforeAll(() => {
    fx = makeFixtureRepoWithRename();
  });

  afterAll(() => {
    rmSync(fx.dir, { recursive: true, force: true });
  });

  test(
    "ENG-5041 (AC 20): querying a post-rename path whose line was last touched pre-rename surfaces the pre-rename commit, exit 0",
    () => {
      // The watched line (line 2 of `renamed.ts`) was introduced under
      // `original.ts` in commit 1 and never edited after the rename — so
      // reaching it requires following the rename back to `original.ts`.
      // If `--no-follow` ever leaks into the git layer, this test fails
      // because the line has no history under `renamed.ts` alone.
      const result = runCli(
        ["code-history", `${fx.renamedFile}:2`],
        fx.dir,
      );
      expect(result.exitCode).toBe(0);
      // The header's subject field is the final field on the first
      // non-empty stdout line — pin it to the PRE-rename subject.
      const firstLine =
        result.stdout.split("\n").find((l) => l.length > 0) ?? "";
      expect(firstLine.endsWith(fx.preRenameSubject)).toBe(true);
    },
  );
});

// =============================================================================
// END-TO-END CLI — reserved flags (AC 24)
// =============================================================================

describe("session code-history reserved flags (AC 24)", () => {
  // No git fixture needed — reserved-flag rejection happens at the parser
  // layer, before any filesystem or git access. Use a no-git tmp dir so
  // we don't pay for `git init` on tests that never need it.

  for (const flag of CODE_HISTORY_RESERVED_FLAGS) {
    test(
      `ENG-5041 (AC 24): \`${flag}\` → exit 1, stderr contains "not yet" AND "ENG-5048"`,
      async () => {
        await withTempDir("code-history-reserved-", (tmpDir) => {
          // Also seed a real file so the error can't be attributed to the
          // AC 2 "file not found" path even if the parser check ever
          // regresses — we want an unambiguous signal that the reserved
          // flag is what rejected it.
          writeFileSync(join(tmpDir, "target.ts"), "line 1\nline 2\nline 3\n");

          const result = runCli(
            ["code-history", flag, "3", "target.ts:1"],
            tmpDir,
          );
          expect(result.exitCode).toBe(1);
          // Stderr must pass through the `"Error: "`-prefixed path,
          // consistent with AC 2's error shape.
          expect(result.stderr).toContain("Error:");
          expect(result.stderr.toLowerCase()).toContain("not yet");
          expect(result.stderr).toContain("ENG-5048");
        });
      },
    );
  }
});
