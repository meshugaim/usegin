/**
 * Tests for searchInSession — pure function that searches within
 * session turns for matching text.
 */

import { describe, it, expect } from "bun:test";
import { searchInSession, type SearchMatch } from "./search";
import { userTurn, assistantTurn, toolResult } from "./testing";

describe("searchInSession", () => {
  it("finds matching text in turn text", () => {
    const turns = [
      userTurn("u1", "Hello world"),
      assistantTurn("a1", "The test failure was in login.test.ts"),
      userTurn("u2", "Fix the login test"),
    ];

    const matches = searchInSession(turns, "test failure");
    expect(matches).toHaveLength(1);
    expect(matches[0].index).toBe(1);
    expect(matches[0].role).toBe("assistant");
    expect(matches[0].snippet).toContain("test failure");
  });

  it("finds matching text in tool result content", () => {
    const turns = [
      userTurn("u1", "", {
        toolResults: [
          toolResult("t1", "Error: connection refused on port 5432"),
        ],
      }),
      assistantTurn("a1", "I see the database error"),
    ];

    const matches = searchInSession(turns, "connection refused");
    expect(matches).toHaveLength(1);
    expect(matches[0].index).toBe(0);
    expect(matches[0].role).toBe("user");
    expect(matches[0].snippet).toContain("connection refused");
  });

  it("performs case-insensitive matching", () => {
    const turns = [
      assistantTurn("a1", "Running the DATABASE migration now"),
    ];

    const matches = searchInSession(turns, "database migration");
    expect(matches).toHaveLength(1);
    expect(matches[0].snippet).toContain("DATABASE migration");
  });

  it("returns empty array for no matches", () => {
    const turns = [
      userTurn("u1", "Hello world"),
      assistantTurn("a1", "Hi there"),
    ];

    const matches = searchInSession(turns, "nonexistent query");
    expect(matches).toHaveLength(0);
  });

  it("returns empty array for empty query", () => {
    const turns = [
      userTurn("u1", "Hello world"),
    ];

    const matches = searchInSession(turns, "");
    expect(matches).toHaveLength(0);
  });

  it("snippet includes context around match", () => {
    const padding = "x".repeat(80);
    const turns = [
      assistantTurn("a1", `${padding}TARGET PHRASE${padding}`),
    ];

    const matches = searchInSession(turns, "TARGET PHRASE");
    expect(matches).toHaveLength(1);
    // Snippet should have ellipsis on both sides (match is deep in text)
    expect(matches[0].snippet).toMatch(/^\.\.\./);
    expect(matches[0].snippet).toMatch(/\.\.\.$/);
    // Snippet should contain the match itself
    expect(matches[0].snippet).toContain("TARGET PHRASE");
  });

  it("snippet has no leading ellipsis when match is at start", () => {
    const turns = [
      assistantTurn("a1", "TARGET at the start of a long message"),
    ];

    const matches = searchInSession(turns, "TARGET");
    expect(matches).toHaveLength(1);
    expect(matches[0].snippet).not.toMatch(/^\.\.\./);
  });

  it("finds multiple matches across turns", () => {
    const turns = [
      userTurn("u1", "Fix the login test failure"),
      assistantTurn("a1", "Looking at the code"),
      userTurn("u2", "The test failure persists"),
      assistantTurn("a2", "I found another test failure here"),
    ];

    const matches = searchInSession(turns, "test failure");
    expect(matches).toHaveLength(3);
    expect(matches[0].index).toBe(0);
    expect(matches[0].role).toBe("user");
    expect(matches[1].index).toBe(2);
    expect(matches[1].role).toBe("user");
    expect(matches[2].index).toBe(3);
    expect(matches[2].role).toBe("assistant");
  });

  it("searches across both text and tool results in same turn", () => {
    const turns = [
      userTurn("u1", "Check this file", {
        toolResults: [
          toolResult("t1", "the magic keyword appears here"),
        ],
      }),
    ];

    // Match in tool result, not in text
    const matches = searchInSession(turns, "magic keyword");
    expect(matches).toHaveLength(1);
    expect(matches[0].index).toBe(0);
  });

  it("replaces newlines in snippet with spaces", () => {
    const turns = [
      assistantTurn("a1", "line one\nmatching text\nline three"),
    ];

    const matches = searchInSession(turns, "matching text");
    expect(matches).toHaveLength(1);
    expect(matches[0].snippet).not.toContain("\n");
  });
});
