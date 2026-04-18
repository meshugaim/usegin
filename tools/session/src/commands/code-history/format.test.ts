/**
 * Pure-formatter tests for `session code-history`.
 *
 * These assert the shape of the human-readable header line (spec AC 5).
 * All tests are RED-phase (`test.failing`) stubs for ENG-5040 — the
 * formatter currently exists but Green will confirm its contract by
 * flipping these to passing.
 *
 * Golden-test style: pin the exact bytes we emit. Future slices will add
 * more golden tests here (session line, linear line, body line) that
 * layer on top of the same `DecoratedCommit` shape.
 */

import { describe, test, expect } from "bun:test";

import { formatHeader } from "./format";
import type { DecoratedCommit } from "./types";

function makeCommit(overrides: Partial<DecoratedCommit> = {}): DecoratedCommit {
  return {
    sha: "4fff467fb48a632519c742358505e9a0a739d525",
    date: "2026-04-18",
    subject: "chore(pre-push): instrument per-stage timings + logger",
    body: "",
    ...overrides,
  };
}

describe("formatHeader (AC 5)", () => {
  test.failing(
    "ENG-5040: emits `<short-sha>  <YYYY-MM-DD>  <subject>` with two spaces between fields",
    () => {
      const commit = makeCommit();
      expect(formatHeader(commit)).toBe(
        "4fff467f  2026-04-18  chore(pre-push): instrument per-stage timings + logger",
      );
    },
  );

  test.failing("ENG-5040: uses exactly 8-char short SHA", () => {
    const commit = makeCommit({ sha: "abcdef0123456789abcdef0123456789abcdef01" });
    const header = formatHeader(commit);
    // The short SHA is the first 8 hex chars.
    expect(header.startsWith("abcdef01  ")).toBe(true);
    // And it's NOT 7 (git's default --short) or 12 or 40 chars.
    expect(header.startsWith("abcdef0  ")).toBe(false);
    expect(header.startsWith("abcdef0123  ")).toBe(false);
  });

  test.failing("ENG-5040: separates each field with exactly two spaces", () => {
    const header = formatHeader(
      makeCommit({ sha: "a".repeat(40), date: "2026-01-02", subject: "hello world" }),
    );
    // Exactly two double-space separators and no tab characters.
    expect(header).toBe("aaaaaaaa  2026-01-02  hello world");
    expect(header).not.toContain("\t");
  });

  test.failing("ENG-5040: preserves the subject verbatim (no trimming, no truncation)", () => {
    const subject = "feat(thing): a subject   with   weird  spacing";
    const header = formatHeader(makeCommit({ subject }));
    expect(header.endsWith(subject)).toBe(true);
  });
});
