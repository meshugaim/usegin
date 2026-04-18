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
 *       (decorator DI stubs the fetch to return null/value without
 *        touching subprocess), and
 *   (b) subprocess-level integration tests in `code-history.test.ts`
 *       with a fake `plan` binary on `PATH`.
 *
 * The `test.failing` marks are the Red-phase pins — Green will remove
 * each mark as the real implementation lands. See CLAUDE.md /
 * `.claude/skills/tdd-ci` for the workflow.
 */

import { describe, test, expect } from "bun:test";

import { extractLinearRef, formatLinearLine } from "./linear";
import {
  LINEAR_FIXTURE_ID,
  LINEAR_FIXTURE_TITLE,
  LINEAR_FIXTURE_STATUS,
  EXPECTED_LINEAR_LINE,
} from "./__fixtures__/linear";

// =============================================================================
// extractLinearRef — unit (ENG-5044)
// =============================================================================
//
// Scan the RAW body (including trailers) for `ENG-\d+`. First match
// wins per spec. `null` when no match. These tests pin the regex
// contract so slices 5/6 can't drift to a subtly different rule.

describe("extractLinearRef (ENG-5044)", () => {
  test.failing(
    "ENG-5044: no ENG ref in body → null",
    () => {
      expect(extractLinearRef("Just a plain body with no issue ref.")).toBeNull();
    },
  );

  test.failing(
    "ENG-5044: empty body → null",
    () => {
      expect(extractLinearRef("")).toBeNull();
    },
  );

  test.failing(
    "ENG-5044: single `ENG-5039` in prose → returns `ENG-5039`",
    () => {
      expect(
        extractLinearRef("Implements the code-history command for ENG-5039."),
      ).toBe("ENG-5039");
    },
  );

  test.failing(
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

  test.failing(
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

  test.failing(
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

  test.failing(
    "ENG-5044: ENG ref with arbitrary-length digits → captures all digits verbatim",
    () => {
      expect(extractLinearRef("ref: ENG-99999")).toBe("ENG-99999");
      expect(extractLinearRef("ref: ENG-7")).toBe("ENG-7");
    },
  );

  test.failing(
    "ENG-5044: non-ENG project prefixes (ACME-123, FOO-9) are IGNORED",
    () => {
      // The spec fixes the regex at `ENG-\d+` — only ENG-prefixed
      // refs count. Guards against a naive `/[A-Z]+-\d+/` that would
      // sweep up issue IDs from other Linear teams.
      expect(extractLinearRef("Fixes ACME-123 and FOO-9.")).toBeNull();
    },
  );

  test.failing(
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

  test.failing(
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

  test.failing(
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

  test.failing(
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

  test.failing(
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

  test.failing(
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

  test.failing(
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
