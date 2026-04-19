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
import { dirname, join } from "node:path";

import {
  parseCodeHistoryArgs,
  CODE_HISTORY_RESERVED_FLAGS,
  CODE_HISTORY_RESERVED_FLAG_MESSAGE,
} from "../cli-args";
import {
  makeFixtureRepo,
  makeFixtureRepoWithRename,
  runCli,
  seedSessionJsonl,
  withFakePlanBin,
  withFixtureRepo,
  withTempDir,
  type FixtureRepo,
  type FixtureRepoWithRename,
} from "./code-history/__fixtures__/helpers";
import {
  SESSION_FIXTURE_ID,
  SESSION_FIXTURE_SHORT_ID,
} from "./code-history/__fixtures__/session";
import {
  LINEAR_FIXTURE_ID,
  LINEAR_FIXTURE_TITLE,
  LINEAR_FIXTURE_STATUS,
  EXPECTED_LINEAR_LINE,
} from "./code-history/__fixtures__/linear";
import { userEntry, assistantEntry, systemEntry } from "../testing";
import { LINEAR_FETCH_TIMEOUT_MS } from "./code-history/linear";

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
          const bodyLine = lines.find((l) => l.trimStart().startsWith("body:"));
          expect(bodyLine).toBeDefined();
          // 4-space indent + `body:` + 5 spaces so the value column
          // aligns at col 14 with `session:` / `linear:` (spec's
          // Concrete example).
          expect(bodyLine).toBe(
            "    body:     This commit does the thing. It also does the other thing.",
          );
        },
      );
    },
  );

  test(
    "ENG-5041 (AC 8): body line renders at 4-space indent with value at column 14 (spec's Concrete example — regression for pre-existing ENG-5041 drift)",
    async () => {
      // Regression guard for the pre-existing drift where the `body:`
      // line rendered at column 0 (`body: <preview>`) instead of the
      // spec's 4-space indent (`    body:     <preview>`). Pinning the
      // indent + column-14 alignment here keeps `body:` consistent
      // with `session:` / `linear:` across the plain block.
      await withFixtureRepo(
        {
          commits: [
            { subject: "initial: seed target file" },
            {
              subject: "feat: pin the body indent",
              body: "Every run appends a JSONL record.",
            },
          ],
        },
        (fx) => {
          const result = runCli(["code-history", `${fx.file}:2`], fx.dir);
          expect(result.exitCode).toBe(0);

          const bodyLine = result.stdout
            .split("\n")
            .find((l) => l.trimStart().startsWith("body:"));
          expect(bodyLine).toBeDefined();
          // Indent is exactly 4 spaces.
          expect(bodyLine!.startsWith("    body:")).toBe(true);
          expect(bodyLine!.startsWith("   body:")).toBe(false);
          expect(bodyLine!.startsWith("     body:")).toBe(false);
          // Value column is at char index 14 (matches
          // `session:` / `linear:` value columns so the three layer
          // lines stay visually columnar).
          expect(bodyLine![14]).toBe("E");
          // And the exact bytes, for a belt-and-braces pin.
          expect(bodyLine).toBe(
            "    body:     Every run appends a JSONL record.",
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
          // No line in stdout (after trimming leading indent) may
          // start with "body:". Using `trimStart` so the assertion
          // survives the 4-space body-line indent (spec's Concrete
          // example).
          const hasBodyLine = result.stdout
            .split("\n")
            .some((l) => l.trimStart().startsWith("body:"));
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
          .some((l) => l.trimStart().startsWith("body:"));
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

// =============================================================================
// END-TO-END CLI — session block (AC 6, AC 13) — ENG-5043
// =============================================================================
//
// These tests exercise the full slice-4 pipeline through the CLI: trailer
// parse → `fetchSession` (local-hit) → `parseSession` → extractors →
// `formatSessionBlock`. `HOME` is redirected to a per-test temp dir so
// `getClaudeProjectsDir()` looks up a fixture JSONL we seed by hand,
// never the developer's real `~/.claude/projects/`.
//
// The in-process tests in `code-history/session-decorate.test.ts` cover
// the SessionNotFoundError vs generic-error classification without the
// subprocess cost. These tests here pin the stdout SHAPE produced by
// the real CLI for the happy / no-trailer / multi-trailer / fetch-miss
// paths.

/**
 * Build a minimal JSONL payload for a Claude-authored commit. The
 * extractors (`extractIntent`/`extractTrigger`/`extractOutcome`) drive
 * what values show up in the session block, so the turn sequence here
 * is shaped to exercise all three:
 *
 *   1. User intent message.
 *   2. Assistant runs `git commit`, tool_result reports the SHA.
 *   3. Assistant outcome message.
 *
 * `commitShortSha` MUST match the actual short SHA of the fixture
 * commit — otherwise `findCommitAuthoringTurnIndex` can't pair the
 * tool_use to a commit and trigger/outcome degrade to `null`.
 */
function makeSessionJsonl(commitShortSha: string): string {
  // Realistic shape: a `system`/`init` entry precedes the conversation
  // entries, and every entry carries a `timestamp`. Mirrors what
  // Claude Code actually writes to JSONL so later slices (ENG-5044/5045)
  // don't trip when the extractors tighten their expectations.
  const entries = [
    systemEntry("sys-init"),
    userEntry("u1", "Wire session extractors into code-history.", {
      parentUuid: null,
      timestamp: "2026-04-18T08:13:00.000Z",
    }),
    assistantEntry("a1", "", {
      parentUuid: "u1",
      timestamp: "2026-04-18T08:14:00.000Z",
      toolCalls: [
        {
          id: "bash-1",
          name: "Bash",
          input: { command: `git commit -m "feat: add session block"` },
        },
      ],
    }),
    userEntry("u2", "", {
      parentUuid: "a1",
      timestamp: "2026-04-18T08:14:30.000Z",
      toolResults: [
        {
          toolUseId: "bash-1",
          content: `[main ${commitShortSha}] feat: add session block`,
        },
      ],
    }),
    assistantEntry("a2", "Committed the session block. Running tests next.", {
      parentUuid: "u2",
      timestamp: "2026-04-18T08:15:00.000Z",
    }),
  ];
  return entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

describe("session code-history session block (AC 6, AC 13) — ENG-5043", () => {
  test(
    "ENG-5043 (AC 6): Claude-Session trailer + resolvable session JSONL → full block renders after header, before body",
    async () => {
      await withTempDir("code-history-session-home-", async (homeDir) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed target file" },
              {
                subject: "feat: add the session block",
                body: "Make the plain-mode render cover the session layer.",
                trailers: {
                  "Claude-Session": SESSION_FIXTURE_ID,
                  "Part of": "ENG-5043",
                },
              },
            ],
          },
          async (fx) => {
            // Seed the session JSONL at the path `fetchSession` /
            // `findSessionById` will look when HOME is pointed at `homeDir`
            // and cwd is `fx.dir`. Extractors need the commit's short SHA
            // to find the authoring Bash turn → pair trigger / outcome to
            // it. The fixture returns the short form already.
            seedSessionJsonl(
              homeDir,
              fx.dir,
              SESSION_FIXTURE_ID,
              makeSessionJsonl(fx.expectedSha),
            );

            const result = runCli(
              ["code-history", `${fx.file}:2`],
              fx.dir,
              { env: { HOME: homeDir } },
            );

            expect(result.exitCode).toBe(0);

            const lines = result.stdout.split("\n");
            // Block ordering: header → session → body. Pin the FIRST four
            // non-empty lines so ordering is unambiguous.
            const nonEmpty = lines.filter((l) => l.length > 0);
            expect(nonEmpty.length).toBeGreaterThanOrEqual(5);
            // Line 0: header (sha + date + subject)
            expect(nonEmpty[0]).toMatch(
              /^[0-9a-f]{8} {2}\d{4}-\d{2}-\d{2} {2}feat: add the session block$/,
            );
            // Line 1: session line at 4-space indent
            expect(nonEmpty[1]).toMatch(
              new RegExp(
                `^ {4}session: {2}${SESSION_FIXTURE_ID} {2}\\(→ session ${SESSION_FIXTURE_SHORT_ID} --since-timestamp \\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}Z\\)$`,
              ),
            );
            // Lines 2-4: nested context lines at 6-space indent
            const nestedLines = nonEmpty.slice(2, 5);
            expect(nestedLines[0]).toBe(
              "      intent:   Wire session extractors into code-history.",
            );
            expect(nestedLines[1]).toBe(
              "      trigger:  Wire session extractors into code-history.",
            );
            expect(nestedLines[2]).toBe(
              "      outcome:  Committed the session block. Running tests next.",
            );
            // Body line comes AFTER the session block — pin ordering
            // explicitly so a future tweak that re-orders doesn't slip.
            const bodyIdx = nonEmpty.findIndex((l) =>
              l.trimStart().startsWith("body:"),
            );
            expect(bodyIdx).toBeGreaterThan(4);
            expect(nonEmpty[bodyIdx]).toBe(
              "    body:     Make the plain-mode render cover the session layer.",
            );
          },
        );
      });
    },
  );

  test(
    "ENG-5043 (AC 6): commit without Claude-Session trailer → no session line in stdout",
    async () => {
      // Default-shape fixture: commits have subject only, no trailers.
      // Session block must be completely absent — not a placeholder, not
      // a blank line.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", `${fx.file}:2`],
          fx.dir,
        );
        expect(result.exitCode).toBe(0);
        const hasSessionLine = result.stdout
          .split("\n")
          .some((l) => l.trimStart().startsWith("session:"));
        expect(hasSessionLine).toBe(false);
      });
    },
  );

  test(
    "ENG-5043 (AC 6): multiple Claude-Session trailers (amend case) → LAST trailer's UUID used in session line",
    async () => {
      const UUID_EARLIER = "11111111-1111-4111-8111-111111111111";
      const UUID_LATER = "22222222-2222-4222-8222-222222222222";

      await withTempDir("code-history-session-multi-", async (homeDir) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: amended with two session trailers",
                trailers: {
                  // Record insertion order — the LATER one overwrites
                  // any prior value of the same key. Git's trailer
                  // convention keeps both on separate lines though, so
                  // compose a body manually to emit both.
                },
                body: [
                  "Amended body preamble.",
                  "",
                  `Claude-Session: ${UUID_EARLIER}`,
                  `Claude-Session: ${UUID_LATER}`,
                ].join("\n"),
              },
            ],
          },
          async (fx) => {
            // Seed the LATER UUID's session so fetchSession succeeds for
            // the one we expect to win — the earlier UUID has no JSONL.
            seedSessionJsonl(
              homeDir,
              fx.dir,
              UUID_LATER,
              makeSessionJsonl(fx.expectedSha),
            );

            const result = runCli(
              ["code-history", `${fx.file}:2`],
              fx.dir,
              { env: { HOME: homeDir } },
            );
            expect(result.exitCode).toBe(0);

            const sessionLine = result.stdout
              .split("\n")
              .find((l) => l.trimStart().startsWith("session:"));
            expect(sessionLine).toBeDefined();
            expect(sessionLine).toContain(UUID_LATER);
            expect(sessionLine).not.toContain(UUID_EARLIER);
          },
        );
      });
    },
  );

  test(
    "ENG-5043 (AC 13): Claude-Session trailer but JSONL missing on disk → session line only, no extractors, exit 0, no stderr noise",
    async () => {
      // SessionNotFoundError path. The trailer points at a UUID for which
      // no JSONL exists under HOME or the (non-existent) agent-records
      // archive. The command MUST degrade to the session line + hint,
      // omit the nested context lines, and exit 0.
      await withTempDir("code-history-session-missing-", async (homeDir) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: commit whose session is gone",
                trailers: {
                  "Claude-Session": SESSION_FIXTURE_ID,
                },
              },
            ],
          },
          (fx) => {
            // HOME points at a fresh empty dir — .claude/projects/ doesn't
            // even exist, so findSessionById returns null → SessionNotFoundError.
            const result = runCli(
              ["code-history", `${fx.file}:2`],
              fx.dir,
              { env: { HOME: homeDir } },
            );

            expect(result.exitCode).toBe(0);

            // Session line renders with the hint.
            const sessionLine = result.stdout
              .split("\n")
              .find((l) => l.trimStart().startsWith("session:"));
            expect(sessionLine).toBeDefined();
            expect(sessionLine).toContain(SESSION_FIXTURE_ID);
            expect(sessionLine).toContain(SESSION_FIXTURE_SHORT_ID);
            expect(sessionLine).toContain("--since-timestamp");

            // No extractor lines when fetch failed.
            const hasIntent = result.stdout
              .split("\n")
              .some((l) => l.trimStart().startsWith("intent:"));
            const hasTrigger = result.stdout
              .split("\n")
              .some((l) => l.trimStart().startsWith("trigger:"));
            const hasOutcome = result.stdout
              .split("\n")
              .some((l) => l.trimStart().startsWith("outcome:"));
            expect(hasIntent).toBe(false);
            expect(hasTrigger).toBe(false);
            expect(hasOutcome).toBe(false);

            // AC 13: no stderr noise on this path. Missing context lines
            // are sufficient signal.
            expect(result.stderr).toBe("");
          },
        );
      });
    },
  );
});

// =============================================================================
// END-TO-END CLI — linear line (AC 7, AC 18) — ENG-5044
// =============================================================================
//
// Exercises the full slice-5 pipeline through the CLI: raw-body scan
// for `ENG-\d+` → spawn `plan show <id> --json` → parse JSON →
// populate `commit.linear` → render. A fake `plan` binary seeded on
// PATH (`withFakePlanBin`) stands in for the real Linear CLI so these
// tests are deterministic and don't hit the Linear API.
//
// In-process failure-path tests in `code-history/linear-decorate.test.ts`
// cover the decorator's null-from-fetch → warn-and-omit contract
// without subprocess cost. These tests here pin the stdout shape
// produced by the real CLI across the spec's AC-18 failure flavors:
// timeout, nonzero exit, malformed JSON, missing `plan` CLI.

/**
 * Shape of the JSON that `plan show <id> --json` emits, stripped to the
 * three fields the decorator reads. Kept local to the test file because
 * it's fixture data — the prod code reads directly from the plan-cli
 * JSON output and the decorator's type lives in `linear.ts`.
 */
function makePlanShowJson(overrides: Partial<{
  identifier: string;
  title: string;
  status: string;
}> = {}): string {
  return JSON.stringify({
    id: "uuid-of-issue",
    identifier: overrides.identifier ?? LINEAR_FIXTURE_ID,
    title: overrides.title ?? LINEAR_FIXTURE_TITLE,
    status: overrides.status ?? LINEAR_FIXTURE_STATUS,
    url: "https://linear.app/askeffi/issue/ENG-5039/foo",
    description: "Some description.",
    labels: ["Feature"],
  });
}

describe("session code-history linear line (AC 7, AC 18) — ENG-5044", () => {
  test(
    "ENG-5044 (AC 7, P1): ENG ref in body + plan show succeeds → `linear:` line renders after session block, before body",
    async () => {
      await withFakePlanBin(
        { stdout: makePlanShowJson(), exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed target file" },
                {
                  subject: "feat: wire the linear line",
                  body: `Implements ${LINEAR_FIXTURE_ID}.`,
                  trailers: { "Part of": LINEAR_FIXTURE_ID },
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const lines = result.stdout.split("\n");
              const nonEmpty = lines.filter((l) => l.length > 0);

              // Find the linear line — exact bytes match the pinned
              // fixture.
              const linearLine = nonEmpty.find((l) =>
                l.trimStart().startsWith("linear:"),
              );
              expect(linearLine).toBeDefined();
              expect(linearLine).toBe(EXPECTED_LINEAR_LINE);

              // Ordering — linear line after header, before body.
              const headerIdx = 0;
              const linearIdx = nonEmpty.indexOf(linearLine!);
              const bodyIdx = nonEmpty.findIndex((l) =>
                l.trimStart().startsWith("body:"),
              );
              expect(linearIdx).toBeGreaterThan(headerIdx);
              expect(bodyIdx).toBeGreaterThan(linearIdx);

              // No stderr on the happy path.
              expect(result.stderr).toBe("");
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (AC 7): linear line renders between session block and body when both are present",
    async () => {
      // Full plain-block shape: header → session → linear → body.
      // Uses BOTH a Claude-Session trailer (so the session block
      // renders) AND an ENG ref (so the linear line renders).
      await withFakePlanBin(
        { stdout: makePlanShowJson(), exitCode: 0 },
        async (bin) => {
          await withTempDir("code-history-linear-full-", async (homeDir) => {
            await withFixtureRepo(
              {
                commits: [
                  { subject: "initial: seed target file" },
                  {
                    subject: "feat: full plain block",
                    body: `Implements ${LINEAR_FIXTURE_ID}.`,
                    trailers: {
                      "Claude-Session": SESSION_FIXTURE_ID,
                      "Part of": LINEAR_FIXTURE_ID,
                    },
                  },
                ],
              },
              async (fx) => {
                // Seed a session JSONL so the session block renders
                // with full extractors. Makes the ordering assertion
                // across all 3 layers (session / linear / body)
                // unambiguous.
                seedSessionJsonl(
                  homeDir,
                  fx.dir,
                  SESSION_FIXTURE_ID,
                  // Minimal valid JSONL — the exact contents don't
                  // matter for this test (we only assert on
                  // ordering, not on extracted values).
                  JSON.stringify(systemEntry("sys-init")) +
                    "\n" +
                    JSON.stringify(
                      userEntry("u1", "Do the thing.", {
                        parentUuid: null,
                        timestamp: "2026-04-18T08:13:00.000Z",
                      }),
                    ) +
                    "\n",
                );

                const result = runCli(
                  ["code-history", `${fx.file}:2`],
                  fx.dir,
                  {
                    env: {
                      HOME: homeDir,
                      PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                    },
                  },
                );
                expect(result.exitCode).toBe(0);

                const lines = result.stdout.split("\n").filter((l) => l.length > 0);
                const sessionIdx = lines.findIndex((l) =>
                  l.trimStart().startsWith("session:"),
                );
                const linearIdx = lines.findIndex((l) =>
                  l.trimStart().startsWith("linear:"),
                );
                const bodyIdx = lines.findIndex((l) =>
                  l.trimStart().startsWith("body:"),
                );

                expect(sessionIdx).toBeGreaterThan(-1);
                expect(linearIdx).toBeGreaterThan(sessionIdx);
                expect(bodyIdx).toBeGreaterThan(linearIdx);

                // Also pin the linear line bytes.
                expect(lines[linearIdx]).toBe(EXPECTED_LINEAR_LINE);

                // No spurious stderr on the happy path.
                expect(result.stderr).toBe("");
              },
            );
          });
        },
      );
    },
  );

  test(
    "ENG-5044 (AC 7): Green MUST invoke `plan show <id> --json` with exactly those argv (argv-pin via fake plan)",
    async () => {
      // Argv-pin: the fake `plan` binary asserts its `$@` matches the
      // expected list and exits non-zero on any drift. Without this
      // pin, a Green implementation that calls `plan list` or omits
      // `--json` (or reorders / adds flags) would still collect the
      // fake's canned stdout and satisfy the happy-path test.
      //
      // Pins the exact wire contract at the subprocess boundary —
      // once Green wires `plan show <id> --json`, any future
      // refactor that changes argv (e.g. adds `--team`, swaps to
      // `plan issue show`) flips this test red before it lands.
      await withFakePlanBin(
        {
          stdout: makePlanShowJson(),
          exitCode: 0,
          expectArgs: ["show", LINEAR_FIXTURE_ID, "--json"],
        },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed target file" },
                {
                  subject: "feat: argv-pinned wire",
                  body: `Implements ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              // No argv-mismatch diagnostic leaked to stderr — if the
              // fake's argv assertion had fired, "fake plan:" would
              // appear. Absent → Green invoked the expected argv.
              expect(result.stderr).not.toContain("fake plan:");

              // Happy-path stdout still renders the line — confirms
              // the fake took the normal exit path (not the argv-
              // mismatch bail-out).
              const linearLine = result.stdout
                .split("\n")
                .find((l) => l.trimStart().startsWith("linear:"));
              expect(linearLine).toBe(EXPECTED_LINEAR_LINE);
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (G3 / ENG-5042): over-long plan-show title → rendered title is truncated with `…` at CONTEXT_MAX_LEN",
    async () => {
      // Title-truncation pin. The agent's design #7 note on the
      // decorator calls out that `fetchLinearIssue` applies `truncate`
      // to the title for consistency with the session extractors
      // (ENG-5042 — 200-char cap with `…`). Without this test, a
      // Green implementation could forget the truncate call and the
      // happy-path assertions would still pass (they use a short
      // fixture title).
      //
      // Build a title that exceeds CONTEXT_MAX_LEN (200 chars) so the
      // output MUST contain `…`. Asserting `<= CONTEXT_MAX_LEN` keeps
      // the pin on the RULE (cap + ellipsis counts as one char)
      // rather than the literal — matches the truncate contract in
      // context.ts.
      const CONTEXT_MAX_LEN = 200;
      const longTitle = "x".repeat(250);
      await withFakePlanBin(
        {
          stdout: makePlanShowJson({ title: longTitle }),
          exitCode: 0,
        },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed target file" },
                {
                  subject: "feat: over-long linear title",
                  body: `Implements ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const linearLine = result.stdout
                .split("\n")
                .find((l) => l.trimStart().startsWith("linear:"));
              expect(linearLine).toBeDefined();
              // Raw 250-char title must NOT appear verbatim.
              expect(linearLine).not.toContain(longTitle);
              // Ellipsis present — truncate was applied.
              expect(linearLine).toContain("…");
              // Sanity: the truncated title portion (the chunk
              // between id+2sp and the trailing `  [status]`) is at
              // most CONTEXT_MAX_LEN chars.
              const titleChunk = linearLine!
                .slice(linearLine!.indexOf(LINEAR_FIXTURE_ID) + LINEAR_FIXTURE_ID.length + 2)
                .replace(/  \[[^\]]*\]$/, "");
              expect(titleChunk.length).toBeLessThanOrEqual(CONTEXT_MAX_LEN);
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (N1 / AC 9): no ENG ref in body → no `linear:` line, no stderr warning, exit 0",
    async () => {
      // Plain `test` — the Red stub + Green both naturally satisfy
      // this: when `extractLinearRef` returns null, decorator
      // returns commit unchanged; renderer sees `decorated.linear`
      // absent and omits the line. Regression-guard for AC 9.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", `${fx.file}:2`],
          fx.dir,
        );
        expect(result.exitCode).toBe(0);
        const hasLinearLine = result.stdout
          .split("\n")
          .some((l) => l.trimStart().startsWith("linear:"));
        expect(hasLinearLine).toBe(false);
        // No AC-18 warning either — missing ref is the normal case.
        expect(result.stderr).not.toContain("plan show");
      });
    },
  );

  test(
    "ENG-5044 (N5 / AC 18): plan show exits non-zero → no `linear:` line, stderr warning names the id, exit 0",
    async () => {
      // The subprocess test for nonzero-exit failure. Fake `plan`
      // exits 1 with no output. AC 18: one-line stderr warning
      // naming the id, linear line omitted, overall command still
      // exits 0 (the linear failure doesn't fail the whole command).
      await withFakePlanBin(
        { exitCode: 1 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: references an unknown issue",
                  body: `Fixes ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              // Linear line omitted.
              const hasLinearLine = result.stdout
                .split("\n")
                .some((l) => l.trimStart().startsWith("linear:"));
              expect(hasLinearLine).toBe(false);

              // AC 18: single-line stderr warning naming the id.
              expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
              expect(result.stderr).toContain("plan show");
              // One line — strip the trailing newline and assert no
              // other newline inside.
              const warningLine = result.stderr.replace(/\n$/, "");
              expect(warningLine).not.toContain("\n");
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (N4 / AC 18): plan show returns unparseable JSON → no `linear:` line, stderr warning, exit 0",
    async () => {
      await withFakePlanBin(
        { stdout: "<not-json>", exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: malformed plan output",
                  body: `Fixes ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const hasLinearLine = result.stdout
                .split("\n")
                .some((l) => l.trimStart().startsWith("linear:"));
              expect(hasLinearLine).toBe(false);

              expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
              expect(result.stderr).toContain("plan show");
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (G4 / AC 18): plan show returns JSON missing required fields → treated as malformed, warn + omit",
    async () => {
      // Partial response — has `identifier` but missing `title` and
      // `status`. Per G4, all three are required; partial response
      // → treat as malformed → null from fetch → warn + omit.
      const partialJson = JSON.stringify({
        id: "uuid",
        identifier: LINEAR_FIXTURE_ID,
        // title missing
        // status missing
        url: "https://linear.app/x",
      });
      await withFakePlanBin(
        { stdout: partialJson, exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: partial plan output",
                  body: `Fixes ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const hasLinearLine = result.stdout
                .split("\n")
                .some((l) => l.trimStart().startsWith("linear:"));
              expect(hasLinearLine).toBe(false);

              expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (G4 / AC 18): plan show returns JSON with empty-string title/status/identifier → treated as malformed, warn + omit",
    async () => {
      // Empty-string partial-response. All three required fields are
      // present and string-typed, but one is `""`. Without a length
      // check the decorator would render
      //   `    linear:   ENG-5039    []`
      // (or similar) with column misalignment and no user-visible
      // signal that the upstream response was broken. G4 rule: empty
      // = absent = malformed → null → warn + omit. Guards against a
      // `plan show` backend hiccup that emits placeholder empties.
      const emptyFieldsJson = JSON.stringify({
        identifier: LINEAR_FIXTURE_ID,
        title: "", // ← empty
        status: "In Progress",
      });
      await withFakePlanBin(
        { stdout: emptyFieldsJson, exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: empty-field plan output",
                  body: `Fixes ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const hasLinearLine = result.stdout
                .split("\n")
                .some((l) => l.trimStart().startsWith("linear:"));
              expect(hasLinearLine).toBe(false);

              expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
            },
          );
        },
      );
    },
  );

  test(
    "ENG-5044 (N3 / AC 18): `plan` binary not on PATH → no `linear:` line, stderr warning, no crash, exit 0",
    async () => {
      // Override PATH to drop `plan` while keeping `bun` resolvable —
      // `runCli` spawns `bun <cli.ts> …`, so the test process's env
      // (`bun`, basic system dirs) must still be able to find `bun`.
      // The subprocess then calls `Bun.spawn(["plan", …])` inside
      // `fetchLinearIssue` — THAT lookup uses the PATH we pass, which
      // only contains `bunDir + emptyBin`, and any dir seeded with a
      // fake `plan` is deliberately NOT in it — the spawn fails with
      // ENOENT, `fetchLinearIssue` catches it, decorator warns and
      // omits. Using `process.execPath`'s dir (rather than whatever
      // `/usr/local/bin` / nvm layout the host happens to have) keeps
      // this test portable across devcontainer / CI / local-laptop
      // setups.
      const bunDir = dirname(process.execPath);
      await withTempDir("code-history-no-plan-", async (emptyBin) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: no plan CLI available",
                body: `Fixes ${LINEAR_FIXTURE_ID}.`,
              },
            ],
          },
          (fx) => {
            const result = runCli(
              ["code-history", `${fx.file}:2`],
              fx.dir,
              {
                // PATH contains only bun's dir + an empty dir — `plan`
                // cannot resolve. Deliberately excludes
                // `process.env.PATH` so stray `plan` installs on the
                // host don't leak in and silently satisfy the lookup.
                env: { PATH: `${bunDir}:${emptyBin}` },
              },
            );
            expect(result.exitCode).toBe(0);

            const hasLinearLine = result.stdout
              .split("\n")
              .some((l) => l.trimStart().startsWith("linear:"));
            expect(hasLinearLine).toBe(false);

            // AC 18: stderr warning naming the id.
            expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
            expect(result.stderr).toContain("plan show");
          },
        );
      });
    },
  );

  test(
    "ENG-5044 (N2 / G1 / AC 18): plan show exceeds 5s timeout → subprocess aborted, stderr warning, exit 0",
    async () => {
      // Fake `plan` sleeps 10s — comfortably beyond the 5s timeout.
      // The decorator's subprocess should be aborted via
      // AbortSignal.timeout(5000), fetchLinearIssue returns null,
      // warn + omit.
      await withFakePlanBin(
        { sleepSeconds: 10, exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: slow plan show",
                  body: `Fixes ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const start = Date.now();
              const result = runCli(
                ["code-history", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              const elapsed = Date.now() - start;

              expect(result.exitCode).toBe(0);
              // The subprocess timeout is `LINEAR_FETCH_TIMEOUT_MS`
              // (5s today) — the whole command should finish
              // comfortably before the fake's 10s sleep completes.
              // Upper bound: `LINEAR_FETCH_TIMEOUT_MS + 4000` gives
              // ~4s of CI-jitter + bun-startup headroom on top of
              // the real timeout, while still catching "timeout
              // didn't fire and we waited the full sleep"
              // (10_000ms > 5_000 + 4_000 = 9_000ms). Referencing
              // the exported constant keeps this assertion honest
              // against any future tweak of the timeout literal.
              expect(elapsed).toBeLessThan(LINEAR_FETCH_TIMEOUT_MS + 4000);

              const hasLinearLine = result.stdout
                .split("\n")
                .some((l) => l.trimStart().startsWith("linear:"));
              expect(hasLinearLine).toBe(false);

              expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
              expect(result.stderr).toContain("plan show");
            },
          );
        },
      );
    },
    // Bun test default per-test timeout is 5s. Bump to 20s so the
    // 10s fake-plan sleep + the command's 5s internal timeout have
    // headroom. If the timeout DOESN'T fire (regression), the test
    // still fails on the elapsed-time assertion at ~10s.
    20000,
  );
});
