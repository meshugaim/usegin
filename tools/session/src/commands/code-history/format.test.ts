/**
 * Pure-formatter tests for `session code-history`.
 *
 * Golden-test style: pin the exact bytes we emit so slices 4/5/6 (session
 * line, linear line, JSON) can layer on top of a stable rule set.
 *
 * Coverage so far:
 *   - `formatHeader` — AC 5         (ENG-5040 slice 1)
 *   - `formatBody`   — AC 8, AC 9   (ENG-5041 slice 2)
 */

import { describe, test, expect } from "bun:test";

import {
  formatHeader,
  formatBody,
  BODY_PREVIEW_MAX_LEN,
  BODY_PREVIEW_ELLIPSIS,
} from "./format";
import type { DecoratedCommit } from "./types";

function makeCommit(overrides: Partial<DecoratedCommit> = {}): DecoratedCommit {
  return {
    sha: "4fff467fb48a632519c742358505e9a0a739d525",
    date: "2026-04-18",
    // Slice 4 (ENG-5043) added `committedAt`. Header tests don't care
    // about its exact value — they assert on `<sha>  <date>  <subject>`
    // — but every fresh commit needs a plausible ISO timestamp so slice-4
    // helpers (`formatSinceTimestamp`) don't blow up on re-used fixtures.
    committedAt: "2026-04-18T08:43:00+00:00",
    subject: "chore(pre-push): instrument per-stage timings + logger",
    body: "",
    ...overrides,
  };
}

describe("formatHeader (AC 5)", () => {
  test(
    "ENG-5040: emits `<short-sha>  <YYYY-MM-DD>  <subject>` with two spaces between fields",
    () => {
      const commit = makeCommit();
      expect(formatHeader(commit)).toBe(
        "4fff467f  2026-04-18  chore(pre-push): instrument per-stage timings + logger",
      );
    },
  );

  test("ENG-5040: uses exactly 8-char short SHA", () => {
    const commit = makeCommit({ sha: "abcdef0123456789abcdef0123456789abcdef01" });
    const header = formatHeader(commit);
    // The short SHA is the first 8 hex chars.
    expect(header.startsWith("abcdef01  ")).toBe(true);
    // And it's NOT 7 (git's default --short) or 12 or 40 chars.
    expect(header.startsWith("abcdef0  ")).toBe(false);
    expect(header.startsWith("abcdef0123  ")).toBe(false);
  });

  test("ENG-5040: separates each field with exactly two spaces", () => {
    const header = formatHeader(
      makeCommit({ sha: "a".repeat(40), date: "2026-01-02", subject: "hello world" }),
    );
    // Exactly two double-space separators and no tab characters.
    expect(header).toBe("aaaaaaaa  2026-01-02  hello world");
    expect(header).not.toContain("\t");
  });

  test("ENG-5040: preserves the subject verbatim (no trimming, no truncation)", () => {
    const subject = "feat(thing): a subject   with   weird  spacing";
    const header = formatHeader(makeCommit({ subject }));
    expect(header.endsWith(subject)).toBe(true);
  });

  test(
    "ENG-5040: defensively handles a SHA shorter than 8 chars — never happens in practice, but the format layer should not blow up",
    () => {
      // Real SHAs are 40 hex chars; git's short form is 7+. We still
      // want this layer to be total: if a synthesized or mocked commit
      // slips in with a 3-char SHA, emit it as-is (no padding, no
      // truncation to empty) rather than crashing or producing a
      // header that loses the SHA entirely.
      const header = formatHeader(
        makeCommit({ sha: "abc", date: "2026-01-02", subject: "x" }),
      );
      expect(header.startsWith("abc")).toBe(true);
      // Must not be padded to 8 chars (no trailing spaces/zeros sneaking in).
      expect(header.startsWith("abc0")).toBe(false);
      expect(header.startsWith("abc ")).toBe(true); // "abc" then the two-space separator
    },
  );
});

// =============================================================================
// formatBody (AC 8, AC 9) — ENG-5041
// =============================================================================
//
// Pin the exact contract of the body-preview renderer so slices 4 (session
// line), 5 (linear line), and 6 (JSON) layer on top of a stable rule set.
// Key invariants:
//   - Strips trailers at the END only (mid-body `Key: value` is preserved)
//   - Takes first 2 non-blank body lines, joined by a single space
//   - Truncates to exactly BODY_PREVIEW_MAX_LEN chars with the ellipsis
//     counting as one char (no off-by-one on what "160 max" means)
//   - Returns `""` when the body has no non-trailer content — caller
//     omits the `body:` line entirely (AC 9 "missing layer → no line")

describe("formatBody (AC 8, AC 9)", () => {
  test(
    "ENG-5041 (AC 8): 5-line body with 2 trailing trailers → first 2 non-trailer lines, space-joined, under max len",
    () => {
      const body = [
        "First line of body.",
        "Second line of body.",
        "Third line of body.",
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "Part of: ENG-5041",
      ].join("\n");
      expect(formatBody(body)).toBe("First line of body. Second line of body.");
    },
  );

  test(
    "ENG-5041 (AC 8): truncates to exactly BODY_PREVIEW_MAX_LEN with trailing ellipsis when first line is too long",
    () => {
      // One long first line, no second. Preview length = max; last char = ellipsis.
      const longLine = "x".repeat(BODY_PREVIEW_MAX_LEN * 2);
      const preview = formatBody(longLine);
      expect(preview.length).toBe(BODY_PREVIEW_MAX_LEN);
      expect(preview.endsWith(BODY_PREVIEW_ELLIPSIS)).toBe(true);
      // The chars before the ellipsis are all from the original input
      // (no weird padding or marker chars sneaking in).
      expect(preview.slice(0, BODY_PREVIEW_MAX_LEN - 1)).toBe(
        "x".repeat(BODY_PREVIEW_MAX_LEN - 1),
      );
    },
  );

  test(
    "ENG-5041 (AC 8): truncation boundary — body exactly at max stays unchanged (no ellipsis added)",
    () => {
      // Pins the "only truncate if STRICTLY over the limit" rule. A body
      // that happens to be exactly BODY_PREVIEW_MAX_LEN chars stays whole.
      const exact = "y".repeat(BODY_PREVIEW_MAX_LEN);
      const preview = formatBody(exact);
      expect(preview.length).toBe(BODY_PREVIEW_MAX_LEN);
      expect(preview).toBe(exact);
      expect(preview.endsWith(BODY_PREVIEW_ELLIPSIS)).toBe(false);
    },
  );

  test(
    "ENG-5041 (AC 8): truncation boundary — body at MAX+1 chars truncates to MAX with ellipsis",
    () => {
      // The tight edge case between "exactly at max → keep" and "truncate".
      // BODY_PREVIEW_MAX (160) stays; BODY_PREVIEW_MAX + 1 (161) truncates.
      // This catches the `>= MAX_LEN` vs `> MAX_LEN` off-by-one that the
      // exact-at-max test alone doesn't expose: a buggy `>= MAX_LEN` would
      // truncate the exact-at-max body (caught above), but a buggy
      // `> MAX_LEN + 1` would only show up here.
      const oneOver = "z".repeat(BODY_PREVIEW_MAX_LEN + 1);
      const preview = formatBody(oneOver);
      expect(preview.length).toBe(BODY_PREVIEW_MAX_LEN);
      expect(preview.endsWith(BODY_PREVIEW_ELLIPSIS)).toBe(true);
      // The chars before the ellipsis are the first (MAX - 1) of the
      // original — the 160th and 161st original chars got replaced by `…`.
      expect(preview.slice(0, BODY_PREVIEW_MAX_LEN - 1)).toBe(
        "z".repeat(BODY_PREVIEW_MAX_LEN - 1),
      );
    },
  );

  test(
    "ENG-5041 (AC 8): blank lines between content are skipped — first 2 NON-BLANK lines are taken",
    () => {
      // Gap-happy body: blank line between real content should not be
      // counted as "a line". Otherwise a body like "foo\n\nbar" would
      // render as "foo " (with a trailing space) which looks like a bug.
      const body = ["First.", "", "Second.", "", "Third."].join("\n");
      expect(formatBody(body)).toBe("First. Second.");
    },
  );

  test(
    "ENG-5041 (AC 9): body that's pure trailers → empty string (caller omits the `body:` line)",
    () => {
      const body = [
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "Claude-Session: abc-123",
      ].join("\n");
      expect(formatBody(body)).toBe("");
    },
  );

  test("ENG-5041 (AC 9): empty body → empty string", () => {
    expect(formatBody("")).toBe("");
  });

  test(
    "ENG-5041 (AC 8): mid-body trailer-lookalike is NOT stripped — `Note:` stays, both lines kept",
    () => {
      // Regression guard for the "mid-body `Foo: bar` looks like a trailer
      // but isn't" rule. `formatBody` must not naively match
      // TRAILER_LINE_RE against every line.
      const body = [
        "Note: this applies to edge cases.",
        "More context here.",
      ].join("\n");
      expect(formatBody(body)).toBe(
        "Note: this applies to edge cases. More context here.",
      );
    },
  );

  test(
    "ENG-5041 (AC 8): strips a variety of trailer keys (Co-Authored-By, Claude-Session, Part of, Closes, Signed-off-by, arbitrary Key)",
    () => {
      const body = [
        "Real body line.",
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "Claude-Session: abc-123",
        "Part of: ENG-5041",
        "Closes: ENG-5678",
        "Signed-off-by: foo <foo@example.com>",
        "XyZ-Name: arbitrary trailer",
      ].join("\n");
      expect(formatBody(body)).toBe("Real body line.");
    },
  );

  test(
    "ENG-5041 (AC 8): single-line body under max length is returned as-is (no ellipsis, no trimming)",
    () => {
      expect(formatBody("Short body.")).toBe("Short body.");
    },
  );
});
