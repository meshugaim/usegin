/**
 * Pure-formatter tests for `session code-history`.
 *
 * Golden-test style: pin the exact bytes we emit so slices 5/6 (linear
 * line, JSON) can layer on top of a stable rule set.
 *
 * Coverage so far:
 *   - `formatHeader`         — AC 5             (ENG-5040 slice 1)
 *   - `formatBody`           — AC 8, AC 9       (ENG-5041 slice 2)
 *   - `formatSinceTimestamp` — AC 6             (ENG-5043 slice 4)
 *   - `formatSessionBlock`   — AC 6, AC 9, AC 13 (ENG-5043 slice 4)
 */

import { describe, test, expect } from "bun:test";

import {
  formatHeader,
  formatBody,
  formatSinceTimestamp,
  formatSessionBlock,
  BODY_PREVIEW_MAX_LEN,
  BODY_PREVIEW_ELLIPSIS,
} from "./format";
import type { DecoratedCommit } from "./types";
import {
  SESSION_FIXTURE_ID,
  SESSION_FIXTURE_SHORT_ID,
  EXPECTED_HINT_CMD,
} from "./__fixtures__/session";

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

// =============================================================================
// formatSinceTimestamp (AC 6) — ENG-5043
// =============================================================================
//
// Pure arithmetic: subtract 30 minutes from an ISO timestamp, format as
// `YYYY-MM-DDTHH:MMZ` in UTC with minute precision. Edge-case pins cover
// the obvious boundaries (minute=00, day / month / year rollover) so slice-5
// (Linear line) and slice-6 (JSON) can reuse the same helper without
// relitigating the rounding rule.

describe("formatSinceTimestamp (AC 6)", () => {
  test("ENG-5043: basic — 08:43 commit → 08:13 since-timestamp", () => {
    expect(formatSinceTimestamp("2026-04-18T08:43:00Z")).toBe(
      "2026-04-18T08:13Z",
    );
  });

  test(
    "ENG-5043: minute=00 — 09:00 commit → 08:30 (pins exact arithmetic)",
    () => {
      expect(formatSinceTimestamp("2026-04-18T09:00:00Z")).toBe(
        "2026-04-18T08:30Z",
      );
    },
  );

  test(
    "ENG-5043: day boundary — 00:15 commit → previous day 23:45",
    () => {
      expect(formatSinceTimestamp("2026-04-18T00:15:00Z")).toBe(
        "2026-04-17T23:45Z",
      );
    },
  );

  test(
    "ENG-5043: month+year boundary — Jan 1 00:15 UTC → Dec 31 23:45 (prev year)",
    () => {
      expect(formatSinceTimestamp("2026-01-01T00:15:00Z")).toBe(
        "2025-12-31T23:45Z",
      );
    },
  );

  test(
    "ENG-5043: non-UTC input — `+02:00` offset normalizes to UTC before subtraction",
    () => {
      // 10:43+02:00 == 08:43 UTC — minus 30m == 08:13Z. Guards against a
      // naive implementation that slices the string rather than parsing it.
      expect(formatSinceTimestamp("2026-04-18T10:43:00+02:00")).toBe(
        "2026-04-18T08:13Z",
      );
    },
  );

  test(
    "ENG-5043: output always ends with `Z` (UTC), never a numeric offset",
    () => {
      // Format pin — guard against a future change that accidentally emits
      // the source tz offset (e.g. `+00:00` instead of `Z`). Slices 5/6 rely
      // on the `Z` suffix when composing the `--since-timestamp` CLI arg.
      const out = formatSinceTimestamp("2026-04-18T08:43:00+05:30");
      expect(out.endsWith("Z")).toBe(true);
      expect(out).not.toMatch(/[+-]\d{2}:\d{2}$/);
    },
  );

  test(
    "ENG-5043: minute precision — seconds are dropped (pinned format is `HH:MMZ`)",
    () => {
      // Even when the source has seconds, the output truncates to the
      // minute. Guards against a copy-paste that kept `.toISOString()`'s
      // full shape without slicing off seconds.
      const out = formatSinceTimestamp("2026-04-18T08:43:37Z");
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
      // Subtract 30 from 43 → 13. Seconds :37 get dropped.
      expect(out).toBe("2026-04-18T08:13Z");
    },
  );
});

// =============================================================================
// formatSessionBlock (AC 6) — ENG-5043
// =============================================================================
//
// Pin the exact multi-line block bytes so slice 5 (Linear) / slice 6
// (JSON) can layer on a stable shape. Each nested line is OPTIONAL —
// missing extractors produce OMITTED lines, NOT placeholders.

// Session-block fixtures (ID, short-id, hint) are imported from
// `./__fixtures__/session` so this module and `session-decorate.test.ts`
// share the same pinned literal — no drift between layers.

function commitWithSession(
  session?: Partial<NonNullable<DecoratedCommit["session"]>>,
): DecoratedCommit {
  const commit: DecoratedCommit = {
    sha: "4fff467fb48a632519c742358505e9a0a739d525",
    date: "2026-04-18",
    committedAt: "2026-04-18T08:43:00+00:00",
    subject: "chore(pre-push): instrument per-stage timings + logger",
    body: "",
  };
  if (session !== undefined) {
    commit.session = {
      id: SESSION_FIXTURE_ID,
      sinceTimestampCmd: EXPECTED_HINT_CMD,
      ...session,
    };
  }
  return commit;
}

describe("formatSessionBlock (AC 6)", () => {
  test(
    "ENG-5043 (AC 6): all fields present — 4-line block with exact indents + alignment",
    () => {
      const commit = commitWithSession({
        intent: "Wire session extractors into code-history.",
        trigger: "Add the session block to the plain-mode output.",
        outcome: "Session line and three nested context lines rendered.",
      });
      const block = formatSessionBlock(commit);
      // Exact bytes — all 4 lines joined with `\n`. Pinning the entire
      // block (rather than line-by-line) catches label-column drift in
      // one place and documents the full output shape in-source.
      const expected = [
        `    session:  ${SESSION_FIXTURE_ID}  (→ ${EXPECTED_HINT_CMD})`,
        `      intent:   Wire session extractors into code-history.`,
        `      trigger:  Add the session block to the plain-mode output.`,
        `      outcome:  Session line and three nested context lines rendered.`,
      ].join("\n");
      expect(block).toBe(expected);
    },
  );

  test(
    "ENG-5043 (AC 6): `session` absent on commit → returns null (missing layer → no line)",
    () => {
      const commit = commitWithSession(undefined);
      expect(formatSessionBlock(commit)).toBeNull();
    },
  );

  test(
    "ENG-5043 (AC 6): intent only (trigger + outcome undefined) → session + intent lines only",
    () => {
      // AC 9 invariant: missing extractors → lines omitted entirely,
      // no placeholder, no blank line.
      const commit = commitWithSession({ intent: "Just the intent." });
      const block = formatSessionBlock(commit);
      const expected = [
        `    session:  ${SESSION_FIXTURE_ID}  (→ ${EXPECTED_HINT_CMD})`,
        `      intent:   Just the intent.`,
      ].join("\n");
      expect(block).toBe(expected);
    },
  );

  test(
    "ENG-5043 (AC 6): trigger only → session + trigger lines only",
    () => {
      const commit = commitWithSession({ trigger: "Only trigger." });
      const block = formatSessionBlock(commit);
      const expected = [
        `    session:  ${SESSION_FIXTURE_ID}  (→ ${EXPECTED_HINT_CMD})`,
        `      trigger:  Only trigger.`,
      ].join("\n");
      expect(block).toBe(expected);
    },
  );

  test(
    "ENG-5043 (AC 6): outcome only → session + outcome lines only",
    () => {
      const commit = commitWithSession({ outcome: "Only outcome." });
      const block = formatSessionBlock(commit);
      const expected = [
        `    session:  ${SESSION_FIXTURE_ID}  (→ ${EXPECTED_HINT_CMD})`,
        `      outcome:  Only outcome.`,
      ].join("\n");
      expect(block).toBe(expected);
    },
  );

  test(
    "ENG-5043 (AC 13): none of intent/trigger/outcome → just the session line (fetch-failure degradation)",
    () => {
      // AC 13: on SessionNotFoundError, pipeline populates `commit.session`
      // with `{id, sinceTimestampCmd}` only — no extractors. Block renders
      // as a SINGLE line, useful because the `→` hint is still actionable.
      const commit = commitWithSession({});
      const block = formatSessionBlock(commit);
      const expected =
        `    session:  ${SESSION_FIXTURE_ID}  (→ ${EXPECTED_HINT_CMD})`;
      expect(block).toBe(expected);
    },
  );

  test(
    "ENG-5043 (AC 6): label alignment — values in the nested group start at the same column regardless of which lines are present",
    () => {
      // Column-alignment regression guard. The value column for the
      // nested block is `6 spaces indent + 8-char label incl colon + 2 spaces = 16`.
      // Intent's label is 7 chars (intent:), so it pads to 10 chars total
      // (intent: + 3 spaces). Trigger/outcome are 8 chars (trigger:, outcome:),
      // so they pad to 10 (trigger: + 2 spaces). Values align at column 16.
      const commit = commitWithSession({
        intent: "I",
        trigger: "T",
        outcome: "O",
      });
      const block = formatSessionBlock(commit) ?? "";
      const lines = block.split("\n");
      const nestedLines = lines.filter((l) => /^ {6}/.test(l));
      expect(nestedLines).toHaveLength(3);
      for (const line of nestedLines) {
        // Value (single char "I" / "T" / "O") MUST start at column 16
        // (0-indexed). If alignment drifts, this assertion catches it
        // regardless of which lines are present.
        expect(line.length).toBe(17); // 16 cols + 1 char value
        expect(line[16]).toMatch(/[ITO]/);
      }
    },
  );
});
