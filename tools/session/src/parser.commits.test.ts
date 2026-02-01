import { test, expect, describe } from "bun:test";
import { parseEntries, extractCommitsFromToolResult } from "./parser";
import type { Entry } from "./types";

describe("extractCommitsFromToolResult", () => {
  test("extracts commit hash from standard git commit output", () => {
    const content = "[main abc1234] fix: some bug";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("abc1234");
    expect(commits[0]?.message).toBe("fix: some bug");
  });

  test("extracts commit from branch with slash", () => {
    const content = "[wt/ENG-123 def5678] feat: add feature";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("def5678");
    expect(commits[0]?.message).toBe("feat: add feature");
  });

  test("extracts commit from multiline output", () => {
    const content = `[wt/ENG-295 315fca6] feat(plan-cli): allow titles to wrap
 2 files changed, 168 insertions(+), 4 deletions(-)
✓ Autosync: Pushed to origin/main`;
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("315fca6");
    expect(commits[0]?.message).toBe("feat(plan-cli): allow titles to wrap");
  });

  test("extracts multiple commits from output", () => {
    const content = `[main abc1234] first commit
[main def5678] second commit`;
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.hash).toBe("abc1234");
    expect(commits[1]?.hash).toBe("def5678");
  });

  test("returns empty array when no commits found", () => {
    const content = "On branch main\nnothing to commit";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toEqual([]);
  });

  test("handles full 40-char commit hash", () => {
    const content = "[main 1234567890abcdef1234567890abcdef12345678] long hash";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.hash).toBe("1234567890abcdef1234567890abcdef12345678");
  });

  test("ignores short hashes (less than 7 chars)", () => {
    // Git hashes are at least 7 characters
    const content = "[main abc123] too short";
    const commits = extractCommitsFromToolResult(content);

    expect(commits).toEqual([]);
  });
});

describe("commit detection in parseEntries", () => {
  test("extracts commits from tool results", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "[main abc1234] fix: some bug\n 1 file changed, 5 insertions(+)",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[0]?.message).toBe("fix: some bug");
  });

  test("extracts multiple commits from session", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "[main abc1234] first commit",
              is_error: false,
            },
          ],
        },
      },
      {
        type: "user",
        uuid: "u2",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-2",
              content: "[main def5678] second commit",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[1]?.hash).toBe("def5678");
  });

  test("deduplicates commits by hash", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "[main abc1234] some commit",
              is_error: false,
            },
          ],
        },
      },
      {
        type: "user",
        uuid: "u2",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-2",
              content: "[main abc1234] same commit hash", // Same hash, different message
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
  });

  test("ignores tool results without git output", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "file contents here",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  test("initializes empty commits array", () => {
    const entries: Entry[] = [];
    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });
});
