/**
 * Unit tests for the Linear integration pure helpers (slice 5 —
 * ENG-5044).
 *
 * Covers:
 *   - `extractLinearRef(body)` — first-match regex against raw bodies.
 *   - `formatLinearLine(linear)` — golden-string tests for the
 *     plain-mode line (4-space indent, spec-pinned spacing).
 *
 * `fetchLinearIssue` is NOT covered here — it shells out to the `plan`
 * CLI and is exercised via:
 *   (a) in-process failure-path tests in `linear-decorate.test.ts`
 *       (decorator DI stubs the fetch to return the discriminated
 *        `{ ok: false, detail? }` | `{ id, title, status }` shape
 *        without touching subprocess), and
 *   (b) subprocess-level integration tests in `code-history.test.ts`
 *       with a fake `plan` binary on `PATH`.
 *
 * All tests land as plain `test`. Green (ENG-5044) removed the Red-phase
 * `test.failing` marks once the real implementations in `./linear.ts`
 * started satisfying each assertion. See CLAUDE.md / `.claude/skills/tdd-ci`
 * for the workflow.
 */

import { describe, test, expect } from "bun:test";

import { extractLinearRef, fetchLinearIssue, formatLinearLine } from "./linear";
import {
  LINEAR_FIXTURE_ID,
  LINEAR_FIXTURE_TITLE,
  LINEAR_FIXTURE_STATUS,
  EXPECTED_LINEAR_LINE,
} from "./__fixtures__/linear";
import { withFakePlanBin } from "./__fixtures__/helpers";

/**
 * Build the JSON that a fake `plan show <id> --json` would emit. Mirrors
 * the `makePlanShowJson` shape used in `code-history.test.ts` /
 * `code-history.json.test.ts` — kept local to this file because these
 * tests want to flex the `url` field directly (absent / null / "" /
 * non-empty), which the shared helper doesn't parameterize.
 */
function makePlanShowJson(
  overrides: Partial<{
    identifier: string;
    title: string;
    status: string;
    url: string | null | undefined;
  }> = {},
): string {
  const base: Record<string, unknown> = {
    id: "uuid-of-issue",
    identifier: overrides.identifier ?? LINEAR_FIXTURE_ID,
    title: overrides.title ?? LINEAR_FIXTURE_TITLE,
    status: overrides.status ?? LINEAR_FIXTURE_STATUS,
    description: "Some description.",
    labels: ["Feature"],
  };
  // Caller sentinels: `undefined` → omit `url` from the JSON entirely,
  // `null` → emit `"url": null`, string → emit verbatim (including "").
  if ("url" in overrides) {
    base.url = overrides.url;
  }
  return JSON.stringify(base);
}

// =============================================================================
// extractLinearRef — unit (ENG-5044)
// =============================================================================
//
// Scan the RAW body (including trailers) for `ENG-\d+`. First match
// wins per spec. `null` when no match. These tests pin the regex
// contract so slices 5/6 can't drift to a subtly different rule.

describe("extractLinearRef (ENG-5044)", () => {
  test(
    "ENG-5044: no ENG ref in body → null",
    () => {
      expect(extractLinearRef("Just a plain body with no issue ref.")).toBeNull();
    },
  );

  test(
    "ENG-5044: empty body → null",
    () => {
      expect(extractLinearRef("")).toBeNull();
    },
  );

  test(
    "ENG-5044: single `ENG-5039` in prose → returns `ENG-5039`",
    () => {
      expect(
        extractLinearRef("Implements the code-history command for ENG-5039."),
      ).toBe("ENG-5039");
    },
  );

  test(
    "ENG-5044: ENG ref in a `Part of:` trailer → returns the ref (raw-body scan, no trailer stripping)",
    () => {
      // Forward-pointer context from prior slices: `stripTrailers` is
      // NOT applied before this extractor. The trailer is a valid
      // source of the ref.
      const body = [
        "Real body prose.",
        "",
        "Part of: ENG-5044",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
      ].join("\n");
      expect(extractLinearRef(body)).toBe("ENG-5044");
    },
  );

  test(
    "ENG-5044: ENG ref in a `Closes:` trailer → returns the ref",
    () => {
      const body = [
        "Body.",
        "",
        "Closes: ENG-1234",
      ].join("\n");
      expect(extractLinearRef(body)).toBe("ENG-1234");
    },
  );

  test(
    "ENG-5044 (G2): multiple ENG refs → FIRST match only (spec-explicit)",
    () => {
      // Spec Algorithm step 5b: "scan body for first ENG-\d+ match".
      // Body has two refs, we return the earlier one — no ambiguity,
      // no multi-issue rendering in v1.
      const body = [
        "This commit touches ENG-100 and also ENG-200.",
        "",
        "Part of: ENG-300",
      ].join("\n");
      expect(extractLinearRef(body)).toBe("ENG-100");
    },
  );

  test(
    "ENG-5044: ENG ref with arbitrary-length digits → captures all digits verbatim",
    () => {
      expect(extractLinearRef("ref: ENG-99999")).toBe("ENG-99999");
      expect(extractLinearRef("ref: ENG-7")).toBe("ENG-7");
    },
  );

  test(
    "ENG-5044: non-ENG project prefixes (ACME-123, FOO-9) are IGNORED",
    () => {
      // The spec fixes the regex at `ENG-\d+` — only ENG-prefixed
      // refs count. Guards against a naive `/[A-Z]+-\d+/` that would
      // sweep up issue IDs from other Linear teams.
      expect(extractLinearRef("Fixes ACME-123 and FOO-9.")).toBeNull();
    },
  );

  test(
    "ENG-5044: `ENG-5039` embedded in a URL still matches (extractor is word-agnostic)",
    () => {
      // Linear URLs embed the identifier — `linear.app/.../ENG-5039/…`.
      // First match of the regex wins wherever it appears; no URL
      // carve-out is needed.
      expect(
        extractLinearRef("See https://linear.app/foo/issue/ENG-5039/title"),
      ).toBe("ENG-5039");
    },
  );
});

// =============================================================================
// formatLinearLine — unit (ENG-5044)
// =============================================================================
//
// Golden-string pins for the plain-mode line shape. The value column
// aligns with `session:`/`body:` at column 14 (4 indent + 8-char
// label-incl-colon-pad + 2 spaces) — `linear:` pads with 3 trailing
// spaces to hit that column, matching `formatSessionBlock`'s label
// column.

describe("formatLinearLine (ENG-5044)", () => {
  test(
    "ENG-5044 (AC 9): linear absent → null (regression-guard for missing-layer invariant)",
    () => {
      // Plain `test` (not `test.failing`) — the Red stub already
      // returns null for `undefined`, and Green must keep this
      // behavior. This is a regression-guard for the AC 9 invariant.
      expect(formatLinearLine(undefined)).toBeNull();
    },
  );

  test(
    "ENG-5044 (P1): canonical fixture → exact pinned bytes (indent + field spacing + bracketed status)",
    () => {
      const line = formatLinearLine({
        id: LINEAR_FIXTURE_ID,
        title: LINEAR_FIXTURE_TITLE,
        status: LINEAR_FIXTURE_STATUS,
      });
      expect(line).toBe(EXPECTED_LINEAR_LINE);
    },
  );

  test(
    "ENG-5044: indent is exactly 4 spaces (value column matches session: / body:)",
    () => {
      const line = formatLinearLine({
        id: "ENG-1",
        title: "t",
        status: "Done",
      }) ?? "";
      // Must start with 4 spaces, then `linear:`. Guards column-14
      // value alignment — if indent drifts to 2 / 6 spaces the
      // whole plain block loses its alignment with session: / body:.
      expect(line.startsWith("    linear:")).toBe(true);
      expect(line.startsWith("   linear:")).toBe(false);
      expect(line.startsWith("     linear:")).toBe(false);
    },
  );

  test(
    "ENG-5044: the value column starts at character index 14 (aligned with `session:`'s column)",
    () => {
      // Slice 4 pins `session:` values at column 14 (see
      // `formatSessionBlock`). The `linear:` label is 7 chars
      // (`linear:`) vs `session:`'s 8 chars — we compensate with 3
      // trailing spaces after the colon (vs session's 2) so values
      // land at the SAME column.
      const line = formatLinearLine({
        id: "X",
        title: "t",
        status: "s",
      }) ?? "";
      expect(line[14]).toBe("X");
    },
  );

  test(
    "ENG-5044: fields separated by exactly 2 spaces (mirrors header and session separators)",
    () => {
      // id ␣␣ title ␣␣ [status]. Guarding the "2 spaces" rule
      // because slice 6 (JSON) doesn't care about this shape — only
      // the plain renderer does, so any drift would silently change
      // alignment here while JSON mode stayed green.
      const line = formatLinearLine({
        id: "ENG-9",
        title: "title text",
        status: "Todo",
      }) ?? "";
      // Exact shape: `    linear:   ENG-9  title text  [Todo]`
      expect(line).toBe("    linear:   ENG-9  title text  [Todo]");
    },
  );

  test(
    "ENG-5044 (P4): archived / canceled status renders verbatim inside square brackets",
    () => {
      // The AC 7 test bar pinned "archived/canceled issue still
      // renders with status". `formatLinearLine` doesn't filter on
      // status — any string lands inside `[ ]` verbatim. Guards
      // against a future "only render open issues" bug.
      const line = formatLinearLine({
        id: "ENG-123",
        title: "old work",
        status: "Canceled",
      });
      expect(line).toBe("    linear:   ENG-123  old work  [Canceled]");
    },
  );

  test(
    "ENG-5044 (S-6): long title is truncated at RENDER time (`…` at CONTEXT_MAX_LEN), raw title untouched on the input",
    () => {
      // S-6 refactor: truncation moved from `fetchLinearIssue` to
      // `formatLinearLine`. `DecoratedCommit.linear.title` carries the
      // raw upstream string so slice 6's JSON mode can emit it
      // verbatim; plain mode applies the 200-char cap at render.
      //
      // Unit-level pin for the render invariant — complements the
      // subprocess-level integration test in `../code-history.test.ts`
      // (`ENG-5044 (G3 / ENG-5042): over-long plan-show title …`).
      // If a future refactor drops the `truncateString` call in
      // `formatLinearLine`, this test fires without needing the
      // fake-`plan`-bin fixture.
      const CONTEXT_MAX_LEN = 200;
      const longTitle = "x".repeat(250);
      const input = {
        id: "ENG-1",
        title: longTitle,
        status: "Todo",
      };
      const line = formatLinearLine(input) ?? "";

      // Raw 250-char title must NOT appear verbatim.
      expect(line).not.toContain(longTitle);
      // Ellipsis present — truncate was applied.
      expect(line).toContain("…");
      // The input object is unchanged (render-layer truncation doesn't
      // mutate the record — guards against a future implementation
      // that rewrites `linear.title` in place, which would defeat
      // slice 6's raw-in-JSON invariant).
      expect(input.title).toBe(longTitle);
    },
  );

  test(
    "ENG-5044: status with spaces (`In Progress`) renders without quoting",
    () => {
      // Multi-word statuses ("In Progress", "In Review") are common
      // Linear state names — they go into `[ ]` as-is with no
      // escape / quote dance.
      const line = formatLinearLine({
        id: "ENG-1",
        title: "t",
        status: "In Progress",
      });
      expect(line).toBe("    linear:   ENG-1  t  [In Progress]");
    },
  );
});

// =============================================================================
// fetchLinearIssue — `url` soft-miss unit coverage (ENG-5055)
// =============================================================================
//
// `url` is a slice-6 addition: the JSON renderer emits `linear.url` when
// `plan show` returned a non-empty string, and OMITS the key otherwise.
// Plain mode doesn't render url — so if this contract drifts, only JSON
// consumers notice, and only if they happen to exercise the failure path.
// Pin the four shapes directly on `fetchLinearIssue` with a fake `plan`
// binary on PATH so a future refactor can't silently narrow / widen the
// soft-miss set.
//
// Why here rather than in `linear-decorate.test.ts`: these pin the
// fetch layer's observable behavior (subprocess → record) rather than
// the decorator's warning-and-omit contract. Decorator tests already
// cover the "fetch failed → warn + omit" path; fetch tests own
// "fetch succeeded, but with/without url" — an orthogonal axis.
//
// These tests use `withFakePlanBin` and override `process.env.PATH` for
// the duration of each call. `fetchLinearIssue` is async + spawns a
// subprocess, so tests are async and the `await` is load-bearing —
// omitting it would let the subprocess outlive the test body.

describe("fetchLinearIssue url soft-miss (ENG-5055)", () => {
  // Helper: run `fn` with `process.env.PATH` prepended by `extraDir`,
  // then restore PATH no matter what. Mirrors the scoped-cleanup
  // pattern used elsewhere (`withFixtureRepo`, `withTempDir`,
  // `withFakePlanBin`) — test failures mustn't leak PATH mutations
  // into sibling tests that also care about PATH (e.g. the subprocess
  // integration tests above).
  async function withPathPrepended<T>(
    extraDir: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const original = process.env.PATH;
    process.env.PATH = `${extraDir}:${original ?? ""}`;
    try {
      return await fn();
    } finally {
      process.env.PATH = original;
    }
  }

  test(
    "url present (non-empty string) → populated on the returned issue record",
    async () => {
      await withFakePlanBin(
        {
          stdout: makePlanShowJson({
            url: "https://linear.app/askeffi/issue/ENG-5039/foo",
          }),
          exitCode: 0,
        },
        async (bin) => {
          await withPathPrepended(bin.dir, async () => {
            const result = await fetchLinearIssue(LINEAR_FIXTURE_ID);
            // Happy path: id/title/status still populated, url too.
            expect("ok" in result).toBe(false);
            if ("ok" in result) return;
            expect(result.id).toBe(LINEAR_FIXTURE_ID);
            expect(result.title).toBe(LINEAR_FIXTURE_TITLE);
            expect(result.status).toBe(LINEAR_FIXTURE_STATUS);
            expect(result.url).toBe(
              "https://linear.app/askeffi/issue/ENG-5039/foo",
            );
          });
        },
      );
    },
  );

  test(
    "url absent (key missing from JSON) → id/title/status returned, no url key",
    async () => {
      await withFakePlanBin(
        // Omit `url` via the `in` sentinel in makePlanShowJson.
        { stdout: makePlanShowJson(), exitCode: 0 },
        async (bin) => {
          await withPathPrepended(bin.dir, async () => {
            const result = await fetchLinearIssue(LINEAR_FIXTURE_ID);
            expect("ok" in result).toBe(false);
            if ("ok" in result) return;
            expect(result.id).toBe(LINEAR_FIXTURE_ID);
            expect(result.title).toBe(LINEAR_FIXTURE_TITLE);
            expect(result.status).toBe(LINEAR_FIXTURE_STATUS);
            // Soft miss: record succeeds, url key absent.
            expect("url" in result).toBe(false);
          });
        },
      );
    },
  );

  test(
    "url null → id/title/status returned, no url key (null is not a string)",
    async () => {
      await withFakePlanBin(
        { stdout: makePlanShowJson({ url: null }), exitCode: 0 },
        async (bin) => {
          await withPathPrepended(bin.dir, async () => {
            const result = await fetchLinearIssue(LINEAR_FIXTURE_ID);
            expect("ok" in result).toBe(false);
            if ("ok" in result) return;
            expect(result.id).toBe(LINEAR_FIXTURE_ID);
            // Soft miss: null is non-string, url omitted from record.
            expect("url" in result).toBe(false);
          });
        },
      );
    },
  );

  test(
    "url empty string → id/title/status returned, no url key (empty string treated as absent)",
    async () => {
      await withFakePlanBin(
        { stdout: makePlanShowJson({ url: "" }), exitCode: 0 },
        async (bin) => {
          await withPathPrepended(bin.dir, async () => {
            const result = await fetchLinearIssue(LINEAR_FIXTURE_ID);
            expect("ok" in result).toBe(false);
            if ("ok" in result) return;
            expect(result.id).toBe(LINEAR_FIXTURE_ID);
            // Soft miss: empty string is not a useful click-through.
            // The fetch layer omits the key so JSON mode doesn't emit
            // `"url": ""` — which would look like a bug to a consumer
            // clicking through to a blank page.
            expect("url" in result).toBe(false);
          });
        },
      );
    },
  );
});
