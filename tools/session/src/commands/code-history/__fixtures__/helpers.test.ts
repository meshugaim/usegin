/**
 * Unit tests for the pure helpers in `./helpers.ts`.
 *
 * These pin the behavior of helpers so slices 2+ notice immediately if
 * the commit-message shape drifts away from git's trailer convention.
 */

import { describe, test, expect } from "bun:test";

import { composeCommitMessage } from "./helpers";

describe("composeCommitMessage", () => {
  test("subject-only message has no trailing blank line", () => {
    expect(composeCommitMessage({ subject: "feat: hello" })).toBe("feat: hello");
  });

  test("subject + body separates with exactly one blank line", () => {
    expect(
      composeCommitMessage({
        subject: "feat: hello",
        body: "Longer explanation.",
      }),
    ).toBe("feat: hello\n\nLonger explanation.");
  });

  test("subject + body + trailers uphold git's trailer convention (blank line before trailers)", () => {
    // git's `interpret-trailers --parse` requires trailers be separated
    // from the body by exactly one blank line — this test pins that
    // shape so slice 2's `Claude-Session:` trailers round-trip cleanly.
    const out = composeCommitMessage({
      subject: "feat: hello",
      body: "Longer explanation.",
      trailers: {
        "Claude-Session": "abc-123",
        "Part of": "ENG-5041",
      },
    });
    expect(out).toBe(
      "feat: hello\n\nLonger explanation.\n\nClaude-Session: abc-123\nPart of: ENG-5041",
    );
  });

  test("subject + trailers only (no body) still keeps one blank line before trailers", () => {
    expect(
      composeCommitMessage({
        subject: "feat: hello",
        trailers: { "Part of": "ENG-5041" },
      }),
    ).toBe("feat: hello\n\nPart of: ENG-5041");
  });
});
