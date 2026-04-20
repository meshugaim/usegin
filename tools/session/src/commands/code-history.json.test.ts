/**
 * End-to-end + parser-layer tests for `session code-history --json` (slice 6 — ENG-5055).
 *
 * Exercises the full slice-6 pipeline through the CLI: argv parse →
 * git layer → session/linear decoration → JSON render. Integration
 * tests reuse the same fixtures (`withFixtureRepo`, `withFakePlanBin`,
 * `seedSessionJsonl`) that slices 4/5 use — there is ONE subprocess
 * pipeline and the JSON path only differs at the render step.
 *
 * In-process pure-render tests (if/when a `renderJson` helper is
 * extracted during Green) should go in
 * `code-history/json.test.ts` alongside the other per-module unit
 * tests. Today slice 6's shape is still TBD, so all pins live here
 * against the CLI's observed stdout/stderr.
 *
 * Spec pins (ENG-5055 description):
 *   - 1-9   positive shape + omit invariants (AC 17)
 *   - 10-12 raw-in-JSON vs truncated-at-extractor-boundary (G3 + AC 15)
 *   - 13-14 failure modes (stderr stays stderr; AC 18)
 *   - 15-17 parser layer: `--json` flag + --help precedence
 *
 * `test.failing` marks are the Red-phase pins — Green will remove each
 * mark as the JSON render + parser recognition lands. See
 * `.claude/skills/tdd-ci` for the workflow.
 *
 * Fixture layout mirrors `code-history.test.ts`:
 *   - `withFixtureRepo`     — throwaway git repo with seeded commits
 *   - `withFakePlanBin`     — fake `plan show` on PATH
 *   - `seedSessionJsonl`    — fake `~/.claude/projects/<dashed-cwd>/<uuid>.jsonl`
 *
 * Tests MUST NOT read the real monorepo's git history — couples to real
 * commits and breaks on every rewrite.
 */

import { describe, test, expect } from "bun:test";

import { parseCodeHistoryArgs } from "../cli-args";
import {
  runCli,
  seedSessionJsonl,
  withFakePlanBin,
  withFixtureRepo,
  withTempDir,
} from "./code-history/__fixtures__/helpers";
import {
  SESSION_FIXTURE_ID,
  SESSION_FIXTURE_SHORT_ID,
} from "./code-history/__fixtures__/session";
import {
  LINEAR_FIXTURE_ID,
  LINEAR_FIXTURE_TITLE,
  LINEAR_FIXTURE_STATUS,
} from "./code-history/__fixtures__/linear";
import { userEntry, assistantEntry, systemEntry } from "../testing";

// =============================================================================
// Local fixture helpers (slice 6 — ENG-5055)
// =============================================================================

/**
 * Build the JSON that a fake `plan show <id> --json` would emit.
 * Mirrors `makePlanShowJson` in `code-history.test.ts` — kept local
 * here too because slice 6's JSON-mode test file is an independent
 * surface and importing a test-file helper across files would couple
 * suites unnecessarily. Keep the two copies in step by changing both
 * when the plan-cli output shape grows.
 */
function makePlanShowJson(
  overrides: Partial<{
    identifier: string;
    title: string;
    status: string;
  }> = {},
): string {
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

/**
 * Minimal session JSONL that pairs the commit's short SHA to a
 * user-intent turn, an assistant Bash turn that runs `git commit`,
 * and an assistant outcome turn. Mirrors the shape of
 * `makeSessionJsonl` in `code-history.test.ts` so extractors
 * produce all three of `intent`/`trigger`/`outcome`.
 *
 * `commitShortSha` MUST match the actual short SHA of the fixture
 * commit — otherwise `findCommitAuthoringTurnIndex` can't pair the
 * tool_use to a commit and trigger/outcome degrade to `null`.
 */
function makeSessionJsonl(commitShortSha: string): string {
  const entries = [
    systemEntry("sys-init"),
    userEntry("u1", "Wire JSON mode into code-history.", {
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
          input: { command: `git commit -m "feat: add JSON mode"` },
        },
      ],
    }),
    userEntry("u2", "", {
      parentUuid: "a1",
      timestamp: "2026-04-18T08:14:30.000Z",
      toolResults: [
        {
          toolUseId: "bash-1",
          content: `[main ${commitShortSha}] feat: add JSON mode`,
        },
      ],
    }),
    assistantEntry("a2", "Committed the JSON mode. Done.", {
      parentUuid: "u2",
      timestamp: "2026-04-18T08:15:00.000Z",
    }),
  ];
  return entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

/**
 * Session JSONL whose `intent`/`trigger`/`outcome` extractors produce
 * strings containing embedded whitespace runs. Used by test 12 to
 * pin that the JSON emits the already-collapsed form (AC 15
 * truncation + whitespace-collapse happens at extractor boundary,
 * not at render — mirrors plain mode's session block).
 */
function makeWhitespaceSessionJsonl(commitShortSha: string): string {
  const entries = [
    systemEntry("sys-init"),
    // Intent with double-space + tab + newline runs. Collapsed form
    // should contain single spaces only.
    userEntry("u1", "Wire   JSON\tmode   into\n\ncode-history.", {
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
          input: { command: `git commit -m "feat: whitespace fixture"` },
        },
      ],
    }),
    userEntry("u2", "", {
      parentUuid: "a1",
      timestamp: "2026-04-18T08:14:30.000Z",
      toolResults: [
        {
          toolUseId: "bash-1",
          content: `[main ${commitShortSha}] feat: whitespace fixture`,
        },
      ],
    }),
    // Outcome with whitespace runs.
    assistantEntry("a2", "Committed\t\tthe   JSON mode.\n\nDone.", {
      parentUuid: "u2",
      timestamp: "2026-04-18T08:15:00.000Z",
    }),
  ];
  return entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

/**
 * Parse the first non-empty line of stdout as JSON. JSON mode emits
 * exactly ONE object — a single-line `JSON.parse(stdout.trim())`
 * would also work, but this helper tolerates a trailing newline and
 * surfaces a clearer error message if stdout is empty (typical Red-
 * phase failure mode until JSON mode is wired in Green).
 *
 * Returns the parsed object (typed as `unknown` — tests narrow with
 * their own expectations).
 */
function parseJsonStdout(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error(
      `expected JSON on stdout, got empty string (full stdout: ${JSON.stringify(stdout)})`,
    );
  }
  return JSON.parse(trimmed) as Record<string, unknown>;
}

// =============================================================================
// 1-6: Positive shape (AC 17)
// =============================================================================
//
// Tests 1-6 pin the top-level JSON shape under different layer
// combinations. Field ordering (`sha, date, subject, body,
// session?, linear?`) is asserted once in test 2 (full-layer) —
// other tests assert on content + presence so ordering pins live in
// one place.

describe("session code-history --json (ENG-5055) — positive shape (AC 17)", () => {
  test.failing(
    "ENG-5055 (AC 17, P1): minimal commit → { sha, date, subject, body: null }, no session / linear keys",
    async () => {
      // Default fixture's last commit has subject only: no body,
      // no session trailer, no ENG ref. JSON emits the four
      // required keys with body: null, and OMITS session / linear.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", "--json", `${fx.file}:2`],
          fx.dir,
        );
        expect(result.exitCode).toBe(0);

        const obj = parseJsonStdout(result.stdout);
        // sha: full 40-char hex (NOT the 8-char shortened form used
        // in plain mode's header). The spec example shows `sha`
        // without truncation — JSON consumers prefer full.
        expect(typeof obj.sha).toBe("string");
        expect((obj.sha as string).length).toBeGreaterThanOrEqual(40);
        // date: ISO YYYY-MM-DD.
        expect(obj.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // subject: the final commit's subject.
        expect(obj.subject).toBe(fx.expectedSubject);
        // body: null (not omitted, not "") — per AC 17 + decision
        // "body: string | null is the lone exception".
        expect(obj.body).toBeNull();
        // No session / linear keys.
        expect("session" in obj).toBe(false);
        expect("linear" in obj).toBe(false);
      });
    },
  );

  test.failing(
    "ENG-5055 (AC 17, P2): full-layer commit → all six keys present in pinned order",
    async () => {
      // Full-layer commit: body + session trailer + ENG ref +
      // resolvable session JSONL + resolvable plan show.
      await withTempDir("code-history-json-full-", async (homeDir) => {
        await withFakePlanBin(
          { stdout: makePlanShowJson(), exitCode: 0 },
          async (bin) => {
            await withFixtureRepo(
              {
                commits: [
                  { subject: "initial: seed target file" },
                  {
                    subject: "feat: full JSON layer",
                    body: "Implements the full JSON mode render.",
                    trailers: {
                      "Claude-Session": SESSION_FIXTURE_ID,
                      "Part of": LINEAR_FIXTURE_ID,
                    },
                  },
                ],
              },
              (fx) => {
                seedSessionJsonl(
                  homeDir,
                  fx.dir,
                  SESSION_FIXTURE_ID,
                  makeSessionJsonl(fx.expectedSha),
                );

                const result = runCli(
                  ["code-history", "--json", `${fx.file}:2`],
                  fx.dir,
                  {
                    env: {
                      HOME: homeDir,
                      PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                    },
                  },
                );
                expect(result.exitCode).toBe(0);

                const obj = parseJsonStdout(result.stdout);
                // All six keys present.
                expect("sha" in obj).toBe(true);
                expect("date" in obj).toBe(true);
                expect("subject" in obj).toBe(true);
                expect("body" in obj).toBe(true);
                expect("session" in obj).toBe(true);
                expect("linear" in obj).toBe(true);
                // Pinned field ordering — sha, date, subject, body,
                // session, linear. JSON.stringify preserves insertion
                // order in V8/JSC; the Green serializer MUST build
                // the object in that order so downstream readers
                // (humans, docs, maybe diff tools) can rely on it.
                // If this assertion ever feels too strict, it is —
                // on purpose. AC 17 pins the example shape.
                expect(Object.keys(obj)).toEqual([
                  "sha",
                  "date",
                  "subject",
                  "body",
                  "session",
                  "linear",
                ]);
              },
            );
          },
        );
      });
    },
  );

  test.failing(
    "ENG-5055 (AC 17, P3): session resolvable → session.{id, shortId, intent, trigger, outcome, sinceTimestampCmd}",
    async () => {
      await withTempDir("code-history-json-session-ok-", async (homeDir) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed target file" },
              {
                subject: "feat: session resolvable",
                body: "Body prose for context.",
                trailers: { "Claude-Session": SESSION_FIXTURE_ID },
              },
            ],
          },
          (fx) => {
            seedSessionJsonl(
              homeDir,
              fx.dir,
              SESSION_FIXTURE_ID,
              makeSessionJsonl(fx.expectedSha),
            );

            const result = runCli(
              ["code-history", "--json", `${fx.file}:2`],
              fx.dir,
              { env: { HOME: homeDir } },
            );
            expect(result.exitCode).toBe(0);

            const obj = parseJsonStdout(result.stdout);
            const session = obj.session as Record<string, unknown>;
            expect(session).toBeDefined();
            expect(session.id).toBe(SESSION_FIXTURE_ID);
            expect(session.shortId).toBe(SESSION_FIXTURE_SHORT_ID);
            // Extractors produced non-null values — all three keys
            // present in the resolved case.
            expect(typeof session.intent).toBe("string");
            expect(typeof session.trigger).toBe("string");
            expect(typeof session.outcome).toBe("string");
            // sinceTimestampCmd: the chained `session <shortId>
            // --since-timestamp <t-30m>` command.
            expect(typeof session.sinceTimestampCmd).toBe("string");
            expect(session.sinceTimestampCmd).toContain(
              `session ${SESSION_FIXTURE_SHORT_ID}`,
            );
            expect(session.sinceTimestampCmd).toContain("--since-timestamp");
          },
        );
      });
    },
  );

  test.failing(
    "ENG-5055 (AC 17, P4): session fetch fails (SessionNotFoundError) → session: { id, sinceTimestampCmd } only",
    async () => {
      // AC 13 graceful degradation — the trailer points at a UUID
      // for which no JSONL exists. JSON emits session with JUST id
      // + sinceTimestampCmd; extractor fields (shortId is included
      // since it's derived, but intent/trigger/outcome are absent).
      //
      // Note on shortId: the description's test 4 wording says
      // "no shortId / intent / trigger / outcome". That degraded
      // shape matches plain mode's graceful-degradation branch
      // (session line + hint, no nested context lines). JSON
      // mirrors: session = { id, sinceTimestampCmd } — extractor-
      // derived fields AND shortId are absent. shortId is OK to
      // absent-or-present per your reading; we pin the stricter
      // interpretation from the test-list wording.
      await withTempDir(
        "code-history-json-session-missing-",
        async (homeDir) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: session gone",
                  trailers: { "Claude-Session": SESSION_FIXTURE_ID },
                },
              ],
            },
            (fx) => {
              // HOME points at a fresh empty dir — findSessionById
              // returns null → SessionNotFoundError.
              const result = runCli(
                ["code-history", "--json", `${fx.file}:2`],
                fx.dir,
                { env: { HOME: homeDir } },
              );
              expect(result.exitCode).toBe(0);

              const obj = parseJsonStdout(result.stdout);
              const session = obj.session as Record<string, unknown>;
              expect(session).toBeDefined();
              expect(session.id).toBe(SESSION_FIXTURE_ID);
              expect(typeof session.sinceTimestampCmd).toBe("string");
              // Extractor fields absent — degraded shape per AC 13.
              expect("shortId" in session).toBe(false);
              expect("intent" in session).toBe(false);
              expect("trigger" in session).toBe(false);
              expect("outcome" in session).toBe(false);
            },
          );
        },
      );
    },
  );

  test.failing(
    "ENG-5055 (AC 17, P5): linear resolvable → linear: { id, title, status, url }",
    async () => {
      // Spec AC 17 shape: linear has {id, title, status, url}. The
      // url is NEW in JSON mode (plain mode's linear line doesn't
      // include it — just id/title/[status]). JSON consumers can
      // click through, so url is a win for the JSON path.
      await withFakePlanBin(
        { stdout: makePlanShowJson(), exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: linear resolvable",
                  body: `Implements ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", "--json", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const obj = parseJsonStdout(result.stdout);
              const linear = obj.linear as Record<string, unknown>;
              expect(linear).toBeDefined();
              expect(linear.id).toBe(LINEAR_FIXTURE_ID);
              expect(linear.title).toBe(LINEAR_FIXTURE_TITLE);
              expect(linear.status).toBe(LINEAR_FIXTURE_STATUS);
              // url is carried through from plan-show's response.
              // Pin "linear.app" substring — the fake's JSON emits
              // a real-shape URL and we want JSON consumers to see
              // it.
              expect(typeof linear.url).toBe("string");
              expect(linear.url).toContain("linear.app");

              expect(result.stderr).toBe("");
            },
          );
        },
      );
    },
  );

  test.failing(
    "ENG-5055 (AC 17, P6): linear fetch fails → no `linear` key, AC-18 warning on stderr (see also test 13)",
    async () => {
      // N5 parity with plain mode: fake plan exits 1. JSON path
      // must NOT emit a linear key. The stderr warning is covered
      // separately by test 13 — here we only pin the stdout shape.
      await withFakePlanBin({ exitCode: 1 }, async (bin) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: linear fetch fails",
                body: `Fixes ${LINEAR_FIXTURE_ID}.`,
              },
            ],
          },
          (fx) => {
            const result = runCli(
              ["code-history", "--json", `${fx.file}:2`],
              fx.dir,
              {
                env: {
                  PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                },
              },
            );
            expect(result.exitCode).toBe(0);

            const obj = parseJsonStdout(result.stdout);
            expect("linear" in obj).toBe(false);
          },
        );
      });
    },
  );
});

// =============================================================================
// 7-9: Omit invariants (AC 17)
// =============================================================================
//
// AC 17 pins: absent optional fields are OMITTED (not null), with
// `body: string | null` as the lone exception.

describe("session code-history --json (ENG-5055) — omit invariants (AC 17)", () => {
  test.failing(
    "ENG-5055 (AC 17, I1): body empty → body: null (NOT omitted)",
    async () => {
      // Commit with subject only, no body. AC 17 exception: body
      // is always present, either string or null. Contrast with
      // session/linear which are omitted when absent.
      await withFixtureRepo(
        {
          commits: [
            { subject: "initial: seed" },
            { subject: "feat: subject-only commit" },
          ],
        },
        (fx) => {
          const result = runCli(
            ["code-history", "--json", `${fx.file}:2`],
            fx.dir,
          );
          expect(result.exitCode).toBe(0);

          const obj = parseJsonStdout(result.stdout);
          // Body key IS present.
          expect("body" in obj).toBe(true);
          // Body value is null (not "" and not undefined).
          expect(obj.body).toBeNull();
        },
      );
    },
  );

  test.failing(
    "ENG-5055 (AC 17, I2): no Claude-Session trailer → no `session` key at all",
    async () => {
      // Session is omitted, not null. Plain `test` would be fine
      // here too (omission is the default-empty behavior), but
      // Red-phase JSON mode doesn't exist yet so even trivial
      // shape assertions fail until Green lands.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", "--json", `${fx.file}:2`],
          fx.dir,
        );
        expect(result.exitCode).toBe(0);

        const obj = parseJsonStdout(result.stdout);
        expect("session" in obj).toBe(false);
      });
    },
  );

  test.failing(
    "ENG-5055 (AC 17, I3): no ENG ref in body → no `linear` key at all",
    async () => {
      // Mirrors test I2 for the linear side. Missing-layer invariant.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", "--json", `${fx.file}:2`],
          fx.dir,
        );
        expect(result.exitCode).toBe(0);

        const obj = parseJsonStdout(result.stdout);
        expect("linear" in obj).toBe(false);
      });
    },
  );
});

// =============================================================================
// 10-12: G3 raw-in-JSON vs truncated-at-extractor (AC 15)
// =============================================================================
//
// The G3 dividend: JSON emits the FULL raw values for `linear.title`
// and `body`, contrasting with plain mode's render-layer truncation.
// `intent`/`trigger`/`outcome` are the opposite — already truncated
// at the extractor boundary (AC 15) so JSON and plain mode share the
// same collapsed form (no re-truncation at render).

describe("session code-history --json (ENG-5055) — G3 + AC 15 raw/truncated invariants", () => {
  test.failing(
    "ENG-5055 (G3, test 10): linear.title > 60 chars → JSON emits FULL raw title (no truncation, no ellipsis)",
    async () => {
      // Plain mode's linear line truncates titles at CONTEXT_MAX_LEN
      // (200) for layout. JSON mode must emit the raw upstream
      // title — even titles exceeding plain's cap round-trip
      // verbatim. The >60 char threshold in the test list is
      // arbitrary; what matters is "long enough that truncation
      // would be visible". Use 250 chars to also exceed the
      // CONTEXT_MAX_LEN cap, so a future regression that
      // accidentally applies the plain-mode truncate to the JSON
      // path would be caught.
      const longTitle = "x".repeat(250);
      await withFakePlanBin(
        { stdout: makePlanShowJson({ title: longTitle }), exitCode: 0 },
        async (bin) => {
          await withFixtureRepo(
            {
              commits: [
                { subject: "initial: seed" },
                {
                  subject: "feat: over-long linear title",
                  body: `Implements ${LINEAR_FIXTURE_ID}.`,
                },
              ],
            },
            (fx) => {
              const result = runCli(
                ["code-history", "--json", `${fx.file}:2`],
                fx.dir,
                {
                  env: {
                    PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                  },
                },
              );
              expect(result.exitCode).toBe(0);

              const obj = parseJsonStdout(result.stdout);
              const linear = obj.linear as Record<string, unknown>;
              // Full raw title, verbatim. No ellipsis, no cap.
              expect(linear.title).toBe(longTitle);
              expect(linear.title).not.toContain("…");
            },
          );
        },
      );
    },
  );

  test.failing(
    "ENG-5055 (G3, test 11): body > 200 chars → JSON emits FULL raw body (no truncation, no ellipsis)",
    async () => {
      // Plain mode's body preview caps at BODY_PREVIEW_MAX_LEN
      // (160) with ellipsis. JSON mode emits the raw commit body
      // (post-trailer-strip so trailers don't leak, but NOT
      // preview-trimmed). Build a body comfortably over both the
      // 160 plain cap and the 200 context cap so any accidental
      // cap leak is visible.
      const longBodyLine =
        "This is a deliberately long body line meant to exceed the plain-mode body preview cap of 160 chars and also exceed the 200-char context truncation cap so any render-layer cap leak shows up clearly.";
      // 192 chars — over 160. Pad to 300 to really prove the point.
      const longBody = `${longBodyLine} ${"y".repeat(100)}`;
      await withFixtureRepo(
        {
          commits: [
            { subject: "initial: seed" },
            {
              subject: "feat: over-long body",
              body: longBody,
            },
          ],
        },
        (fx) => {
          const result = runCli(
            ["code-history", "--json", `${fx.file}:2`],
            fx.dir,
          );
          expect(result.exitCode).toBe(0);

          const obj = parseJsonStdout(result.stdout);
          // Full raw body (post-trailer-strip is a no-op here —
          // no trailers in the fixture commit). No ellipsis.
          expect(obj.body).toBe(longBody);
          expect(obj.body as string).not.toContain("…");
        },
      );
    },
  );

  test.failing(
    "ENG-5055 (AC 15, test 12): intent/trigger/outcome with whitespace runs → JSON emits the collapsed form (same as plain mode's session block)",
    async () => {
      // AC 15 invariant: whitespace collapse + 200-char cap lives
      // at the extractor boundary. Both plain mode and JSON mode
      // receive the already-collapsed+capped string from
      // `extractIntent`/`extractTrigger`/`extractOutcome`.
      //
      // Assert: the JSON emission of intent/trigger/outcome
      // contains NO whitespace runs (no `\t`, no `  ` double-space,
      // no `\n` inside the value) and is ≤ CONTEXT_MAX_LEN (200).
      //
      // Pins the shared boundary — a Green implementation that
      // accidentally re-reads the raw turn text for JSON mode
      // (bypassing the extractors) would surface uncollapsed
      // tabs/newlines here.
      await withTempDir("code-history-json-whitespace-", async (homeDir) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: whitespace runs in session turns",
                trailers: { "Claude-Session": SESSION_FIXTURE_ID },
              },
            ],
          },
          (fx) => {
            seedSessionJsonl(
              homeDir,
              fx.dir,
              SESSION_FIXTURE_ID,
              makeWhitespaceSessionJsonl(fx.expectedSha),
            );

            const result = runCli(
              ["code-history", "--json", `${fx.file}:2`],
              fx.dir,
              { env: { HOME: homeDir } },
            );
            expect(result.exitCode).toBe(0);

            const obj = parseJsonStdout(result.stdout);
            const session = obj.session as Record<string, unknown>;
            // Each extractor field, if present, must be collapsed
            // (no tabs, no newlines, no double-space runs) and
            // capped at CONTEXT_MAX_LEN (200).
            for (const key of ["intent", "trigger", "outcome"] as const) {
              const value = session[key];
              if (value === undefined) continue;
              expect(typeof value).toBe("string");
              const s = value as string;
              expect(s).not.toContain("\t");
              expect(s).not.toContain("\n");
              expect(s).not.toMatch(/ {2,}/);
              expect(s.length).toBeLessThanOrEqual(200);
            }
            // Sanity: at least one of them exists — otherwise the
            // loop above is a no-op and the test would pass
            // vacuously even if the JSON path bypassed the
            // extractors entirely.
            const anyExtractorPresent =
              "intent" in session ||
              "trigger" in session ||
              "outcome" in session;
            expect(anyExtractorPresent).toBe(true);
          },
        );
      });
    },
  );
});

// =============================================================================
// 13-14: Failure modes (stderr stays stderr) (AC 18)
// =============================================================================
//
// JSON mode MUST keep the AC-18 `Warning: plan show <id> failed;
// linear context skipped` line on STDERR, not inject it into stdout
// JSON. User-confirmed decision per ENG-5055 description: grep-
// discoverability from slice 5 S-10 carries forward.

describe("session code-history --json (ENG-5055) — failure modes (AC 18)", () => {
  test.failing(
    "ENG-5055 (test 13, AC 18): plan show fails in --json mode → stdout is pure JSON (no `linear` key); stderr carries the AC-18 warning",
    async () => {
      await withFakePlanBin({ exitCode: 1 }, async (bin) => {
        await withFixtureRepo(
          {
            commits: [
              { subject: "initial: seed" },
              {
                subject: "feat: linear fetch fails under --json",
                body: `Fixes ${LINEAR_FIXTURE_ID}.`,
              },
            ],
          },
          (fx) => {
            const result = runCli(
              ["code-history", "--json", `${fx.file}:2`],
              fx.dir,
              {
                env: {
                  PATH: `${bin.dir}:${process.env.PATH ?? ""}`,
                },
              },
            );
            expect(result.exitCode).toBe(0);

            // Stdout: pure JSON. The critical pin is that
            // JSON.parse succeeds on the entire trimmed stdout —
            // i.e. there is no stderr-like "Warning:" line
            // leaked onto stdout that would choke jq.
            const obj = parseJsonStdout(result.stdout);
            // Linear key omitted (fetch failed).
            expect("linear" in obj).toBe(false);

            // Stderr: AC-18 warning naming the id.
            expect(result.stderr).toContain(LINEAR_FIXTURE_ID);
            expect(result.stderr).toContain("plan show");
            expect(result.stderr).toContain("linear context skipped");

            // Stdout has NO "Warning:" line. Grep-safety for JSON
            // consumers piping to jq.
            expect(result.stdout).not.toContain("Warning:");
          },
        );
      });
    },
  );

  test.failing(
    "ENG-5055 (test 14, AC 19): no commit history for file:line in --json mode → non-zero exit, error on stderr, stdout EMPTY (no partial JSON)",
    async () => {
      // AC 19 path + JSON discipline: when the command can't
      // produce a full JSON object (no commit history for the
      // line), it emits NOTHING to stdout. A partial JSON object
      // with placeholder fields would violate the "exactly one
      // object" contract. The error goes to stderr (prefixed
      // `"Error: "` or the plain "No committed history" wording
      // — we only pin "stdout is empty" and "stderr names the
      // file:line").
      //
      // Fixture: `uncommittedLine` is line 4, seeded in the
      // fixture repo as a working-tree-only line with no
      // commit history.
      //
      // Note on exit code: the plain-mode AC 19 path exits 0
      // with "No committed history for <file>:<line>" on stderr.
      // JSON mode SHOULD exit NON-ZERO on this path because
      // there's no JSON object to emit — a 0 exit + empty
      // stdout would be ambiguous with "success but empty"
      // from a pipeline consumer's view. Pinning non-zero here
      // surfaces the decision; if Green / review disagrees, this
      // is the test that will flag it.
      await withFixtureRepo(undefined, (fx) => {
        const result = runCli(
          ["code-history", "--json", `${fx.file}:${fx.uncommittedLine}`],
          fx.dir,
        );
        expect(result.exitCode).not.toBe(0);

        // Stdout: empty (no partial JSON).
        expect(result.stdout.trim()).toBe("");

        // Stderr: names the file and line. Wording intentionally
        // flexible — AC 19 pins "No committed history" for plain
        // mode, and we expect JSON mode to reuse similar language,
        // but the exact phrasing isn't spec-pinned for JSON so we
        // assert on the observable: the file path appears on
        // stderr so users can diagnose.
        expect(result.stderr).toContain(fx.file);
      });
    },
  );
});

// =============================================================================
// 15-17: Parser layer (AC 17)
// =============================================================================
//
// Parser-layer tests — pure in-process, no subprocess. Pin the
// `--json` flag recognition on `parseCodeHistoryArgs` and the
// `--help` precedence.

describe("parseCodeHistoryArgs --json (ENG-5055) — parser layer", () => {
  test.failing(
    "ENG-5055 (test 15): --json flag recognized → { file, line, json: true }",
    () => {
      // Parser surface contract: `CodeHistoryArgs` grows a
      // `json: boolean` field. Default false (absence → plain
      // mode). Presence of `--json` → true.
      //
      // Two assertions in one test — the positive case (flag
      // present) is the load-bearing pin for test 15. The
      // default-false case is covered by the other `test.failing`
      // marks on this describe: every "no --json" subprocess
      // test above passes `[fx.file:N]` without `--json` and
      // expects JSON stdout to be absent, which is equivalent
      // to `json: false` going through the pipeline.
      const result = parseCodeHistoryArgs(["--json", "src/foo.ts:42"]);
      // Narrow off the "help" return value.
      expect(result).not.toBe("help");
      expect(result).toEqual({
        file: "src/foo.ts",
        line: 42,
        json: true,
      });
    },
  );

  test("ENG-5055 (test 16): `--help --json` → 'help' (help wins over --json)", () => {
    // GNU convention + pinned decision in ENG-5055: --help
    // precedes --json. When both are present, help takes
    // priority and the JSON path is NOT invoked.
    //
    // Plain `test` (not `test.failing`) — today's parser
    // already scans pass 1 for --help and returns "help"
    // before reaching any flag it doesn't recognize (current
    // behavior ignores --json silently). Once Green adds
    // --json recognition, this precedence still holds because
    // --help stays in pass 1. The pin guards the precedence
    // from future drift (e.g. if someone ever added --json
    // recognition BEFORE the --help pass).
    expect(parseCodeHistoryArgs(["--help", "--json"])).toBe("help");
  });

  test("ENG-5055 (test 17): `--json --help` → 'help' (order-independent)", () => {
    // Same as test 16 with reversed order — the precedence
    // rule doesn't depend on argv position. Mirrors pass-1 in
    // parseCodeHistoryArgs which already scans for --help
    // before any other recognition. Plain `test` for the same
    // reason as test 16.
    expect(parseCodeHistoryArgs(["--json", "--help"])).toBe("help");
  });
});
