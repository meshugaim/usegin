/**
 * Unit tests for the trailer-stripping helper.
 *
 * Shared module used by:
 *   - Slice 2 (ENG-5041): body-preview line strips trailers before truncating.
 *   - Slice 4 (session line): extract `Claude-Session: <uuid>` trailers.
 *   - Slice 5 (linear line): extract `Part of: ENG-XXXX` / `Closes: ENG-XXXX`.
 */

import { describe, test, expect } from "bun:test";

import {
  stripTrailers,
  isTrailerLine,
  extractClaudeSessionTrailer,
} from "./trailers";

describe("stripTrailers (ENG-5041)", () => {
  test("ENG-5041: strips a trailing trailer block separated by a blank line", () => {
    const body = [
      "This is the real body.",
      "It has two lines.",
      "",
      "Co-Authored-By: Claude <noreply@anthropic.com>",
      "Part of: ENG-5041",
    ].join("\n");
    expect(stripTrailers(body)).toBe("This is the real body.\nIt has two lines.");
  });

  test(
    "ENG-5041: returns empty string when the body is entirely trailers (after a blank-line preamble)",
    () => {
      // Git's `%b` for a commit with no body but trailers will often emit
      // the trailer block on its own. The "missing layer → no line"
      // invariant (AC 9) hinges on this returning `""`.
      const body = [
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "Claude-Session: abc-123",
      ].join("\n");
      expect(stripTrailers(body)).toBe("");
    },
  );

  test(
    "ENG-5041: returns empty string when the body is ONLY trailers with no preamble",
    () => {
      // Defensive: even if git ever emits the trailer block without a
      // leading blank line, a body that's entirely trailer-shaped lines
      // should collapse to empty.
      const body = [
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "Signed-off-by: foo <foo@example.com>",
      ].join("\n");
      expect(stripTrailers(body)).toBe("");
    },
  );

  test("ENG-5041: returns empty string for an empty body", () => {
    expect(stripTrailers("")).toBe("");
  });

  test(
    "ENG-5041: does NOT strip mid-body trailer-lookalikes when real body content follows",
    () => {
      // The rule is "trailers at the END" — a `Key: value` line in the
      // middle of prose (e.g. "Note: this edge case...") is body content,
      // not a trailer, and must be preserved.
      const body = [
        "Here is some context.",
        "Note: this applies to edge cases.",
        "More prose after the note.",
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
      ].join("\n");
      expect(stripTrailers(body)).toBe(
        "Here is some context.\nNote: this applies to edge cases.\nMore prose after the note.",
      );
    },
  );

  test(
    "ENG-5041: strips a variety of trailer keys (Co-Authored-By, Claude-Session, Part of, Closes, Signed-off-by, arbitrary)",
    () => {
      // The spec says "any `FooBar: baz` line that matches the git-trailer
      // regex" at the end of the body is stripped. This pins the "we don't
      // maintain a known-key allowlist" decision.
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
      expect(stripTrailers(body)).toBe("Real body line.");
    },
  );

  test(
    "ENG-5041: a single line of plain prose is returned unchanged",
    () => {
      expect(stripTrailers("Just one plain line.")).toBe("Just one plain line.");
    },
  );

  test(
    "ENG-5041: trims trailing blank lines from the stripped result so callers get no phantom blank tail",
    () => {
      const body = [
        "Body line.",
        "",
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
      ].join("\n");
      // No trailing newline, no trailing blank line.
      expect(stripTrailers(body)).toBe("Body line.");
    },
  );
});

describe("isTrailerLine (ENG-5041)", () => {
  // isTrailerLine is a regex check — these tests lock in the exact
  // contract so slices 4/5 can build extractors on top of it without
  // re-discovering the edge cases.
  test("ENG-5041: matches canonical trailer keys", () => {
    expect(isTrailerLine("Co-Authored-By: Claude <noreply@anthropic.com>")).toBe(true);
    expect(isTrailerLine("Claude-Session: abc-123")).toBe(true);
    expect(isTrailerLine("Part of: ENG-5041")).toBe(true);
    expect(isTrailerLine("Closes: ENG-5678")).toBe(true);
    expect(isTrailerLine("Signed-off-by: foo <foo@example.com>")).toBe(true);
    expect(isTrailerLine("XyZ-Name: arbitrary")).toBe(true);
  });

  test("ENG-5041: rejects non-trailer-shaped lines", () => {
    // No space after colon.
    expect(isTrailerLine("Foo:bar")).toBe(false);
    // Starts with digit.
    expect(isTrailerLine("1Foo: bar")).toBe(false);
    // No colon at all.
    expect(isTrailerLine("Just some prose")).toBe(false);
    // Empty line.
    expect(isTrailerLine("")).toBe(false);
    // Leading whitespace — not anchored-start trailer.
    expect(isTrailerLine(" Foo: bar")).toBe(false);
  });
});

// =============================================================================
// extractClaudeSessionTrailer (ENG-5043)
// =============================================================================
//
// Pin the UUID-extraction contract used by `runCodeHistory` to decide
// whether to populate `DecoratedCommit.session`. The regex itself is
// spec-pinned (`/^Claude-Session:\s*(\S+)\s*$/m`) so these tests focus
// on the SEMANTICS layered on top of that regex: null when absent, last
// match when multiple.

const FIXTURE_UUID_A = "533a2546-684a-4724-b592-34aa88aac626";
const FIXTURE_UUID_B = "6e1b04b8-3f88-47a0-9a6c-88a4e5b9f001";

describe("extractClaudeSessionTrailer (ENG-5043)", () => {
  test(
    "ENG-5043: returns the UUID when a single Claude-Session trailer is present",
    () => {
      const body = [
        "feat: add the thing",
        "",
        "Part of: ENG-5043",
        `Claude-Session: ${FIXTURE_UUID_A}`,
      ].join("\n");
      expect(extractClaudeSessionTrailer(body)).toBe(FIXTURE_UUID_A);
    },
  );

  test("ENG-5043: returns null when NO trailer is present", () => {
    const body = [
      "feat: add the thing",
      "",
      "Part of: ENG-5043",
    ].join("\n");
    expect(extractClaudeSessionTrailer(body)).toBeNull();
  });

  test("ENG-5043: returns null on an empty body", () => {
    expect(extractClaudeSessionTrailer("")).toBeNull();
  });

  test(
    "ENG-5043: takes the LAST match when multiple trailers are present (amend case)",
    () => {
      // An amended commit accumulates trailers from each amendment; the
      // last one reflects the final session that touched the commit.
      const body = [
        "feat: amended thing",
        "",
        `Claude-Session: ${FIXTURE_UUID_A}`,
        `Claude-Session: ${FIXTURE_UUID_B}`,
      ].join("\n");
      expect(extractClaudeSessionTrailer(body)).toBe(FIXTURE_UUID_B);
    },
  );

  test(
    "ENG-5043: regex is line-anchored — `Claude-Session:` embedded mid-line does NOT match",
    () => {
      // Guards against a non-anchored match that would pick up prose
      // like "see Claude-Session: abc in the log". The spec regex uses
      // `^...$` under `m`, so only whole-line matches count.
      const body = "See Claude-Session: foo in the log, not a real trailer.";
      expect(extractClaudeSessionTrailer(body)).toBeNull();
    },
  );

  test(
    "ENG-5043: tolerates incidental whitespace around the UUID value",
    () => {
      // The spec regex uses `\s*` on both sides of the capture. A stray
      // leading space or trailing whitespace must still yield the UUID.
      const body = `Claude-Session:   ${FIXTURE_UUID_A}   `;
      expect(extractClaudeSessionTrailer(body)).toBe(FIXTURE_UUID_A);
    },
  );
});
