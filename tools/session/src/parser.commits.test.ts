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

// ============================================================================
// Helper: create a Bash tool call -> tool result pair as entries
// ============================================================================

/**
 * Creates an assistant entry with a Bash tool call followed by a user entry
 * with the corresponding tool result. This mirrors the real session structure:
 * assistant dispatches tool_use, user entry carries the tool_result.
 */
function bashCommitEntries(
  toolUseId: string,
  command: string,
  output: string,
  uuids: { assistant: string; user: string }
): Entry[] {
  return [
    {
      type: "assistant",
      uuid: uuids.assistant,
      session_id: "s1",
      message: {
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        content: [
          {
            type: "tool_use",
            id: toolUseId,
            name: "Bash",
            input: { command },
          },
        ],
      },
    },
    {
      type: "user",
      uuid: uuids.user,
      session_id: "s1",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: output,
            is_error: false,
          },
        ],
      },
    },
  ];
}

/**
 * Creates an assistant entry with a non-Bash tool call followed by a user
 * entry with the corresponding tool result.
 */
function nonBashToolEntries(
  toolName: string,
  toolUseId: string,
  input: Record<string, unknown>,
  output: string,
  uuids: { assistant: string; user: string }
): Entry[] {
  return [
    {
      type: "assistant",
      uuid: uuids.assistant,
      session_id: "s1",
      message: {
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        content: [
          {
            type: "tool_use",
            id: toolUseId,
            name: toolName,
            input,
          },
        ],
      },
    },
    {
      type: "user",
      uuid: uuids.user,
      session_id: "s1",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: output,
            is_error: false,
          },
        ],
      },
    },
  ];
}

describe("commit detection in parseEntries", () => {
  test("extracts commits from Bash tool results", () => {
    const entries: Entry[] = bashCommitEntries(
      "tool-1",
      'git commit -m "fix: some bug"',
      "[main abc1234] fix: some bug\n 1 file changed, 5 insertions(+)",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[0]?.message).toBe("fix: some bug");
  });

  test("extracts multiple commits from session", () => {
    const entries: Entry[] = [
      ...bashCommitEntries(
        "tool-1",
        'git commit -m "first commit"',
        "[main abc1234] first commit",
        { assistant: "a1", user: "u1" }
      ),
      ...bashCommitEntries(
        "tool-2",
        'git commit -m "second commit"',
        "[main def5678] second commit",
        { assistant: "a2", user: "u2" }
      ),
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]?.hash).toBe("abc1234");
    expect(result.commits[1]?.hash).toBe("def5678");
  });

  test("deduplicates commits by hash", () => {
    const entries: Entry[] = [
      ...bashCommitEntries(
        "tool-1",
        'git commit -m "some commit"',
        "[main abc1234] some commit",
        { assistant: "a1", user: "u1" }
      ),
      ...bashCommitEntries(
        "tool-2",
        "git log --oneline",
        "[main abc1234] same commit hash", // Same hash appears in different output
        { assistant: "a2", user: "u2" }
      ),
    ];

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("abc1234");
  });

  test("ignores Bash tool results without git output", () => {
    const entries: Entry[] = bashCommitEntries(
      "tool-1",
      "ls -la",
      "total 8\ndrwxr-xr-x  2 user user 4096 Jan  1 00:00 .",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  test("initializes empty commits array", () => {
    const entries: Entry[] = [];
    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  // ============================================================================
  // False positive prevention: only Bash tool results are scanned
  // ============================================================================

  test("ignores Read tool results containing commit-like patterns", () => {
    // A file might contain text that looks like git commit output.
    // Since it comes from Read (not Bash), it should not be detected.
    const entries: Entry[] = nonBashToolEntries(
      "Read",
      "tool-1",
      { file_path: "/workspaces/project/CHANGELOG.md" },
      "## Recent changes\n[main abc1234] fix: some bug\n[main def5678] feat: new feature",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  test("ignores Grep tool results containing commit-like patterns", () => {
    const entries: Entry[] = nonBashToolEntries(
      "Grep",
      "tool-1",
      { pattern: "commit", path: "/workspaces/project" },
      "[main abc1234] fix: some bug",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  test("ignores tool results with no matching assistant tool call", () => {
    // Edge case: a tool result with no preceding tool_use (orphan result).
    // This should not be scanned since we can't confirm it's from Bash.
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
              tool_use_id: "orphan-tool-id",
              content: "[main abc1234] fix: some bug",
              is_error: false,
            },
          ],
        },
      },
    ];

    const result = parseEntries(entries);

    expect(result.commits).toEqual([]);
  });

  test("extracts commits from Bash even without git commit in command", () => {
    // The output pattern is the source of truth, not the command text.
    // git cherry-pick, git merge, git revert, or even complex shell scripts
    // can produce commit output. We just need the result to be from Bash.
    const entries: Entry[] = bashCommitEntries(
      "tool-1",
      "git cherry-pick abc1234",
      "[main def5678] fix: cherry-picked bug fix",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("def5678");
    expect(result.commits[0]?.message).toBe("fix: cherry-picked bug fix");
  });

  test("extracts commits from git merge output", () => {
    const entries: Entry[] = bashCommitEntries(
      "tool-1",
      "git merge feature-branch",
      "[main 9a8b7c6] Merge branch 'feature-branch' into main",
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("9a8b7c6");
  });

  test("extracts commits from git revert output", () => {
    const entries: Entry[] = bashCommitEntries(
      "tool-1",
      "git revert HEAD",
      '[main fedcba9] Revert "feat: add feature"',
      { assistant: "a1", user: "u1" }
    );

    const result = parseEntries(entries);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("fedcba9");
  });

  test("handles mixed Bash and non-Bash results in same session", () => {
    // A realistic session: Read a file that happens to mention commits,
    // then actually run git commit via Bash. Only the Bash result counts.
    const entries: Entry[] = [
      // Read a changelog that mentions commits
      ...nonBashToolEntries(
        "Read",
        "tool-read",
        { file_path: "/workspaces/project/CHANGELOG.md" },
        "Previous release:\n[main aaa1111] feat: old feature\n[main bbb2222] fix: old bug",
        { assistant: "a1", user: "u1" }
      ),
      // Actually commit something
      ...bashCommitEntries(
        "tool-bash",
        'git commit -m "fix: new bug"',
        "[main ccc3333] fix: new bug\n 1 file changed, 2 insertions(+)",
        { assistant: "a2", user: "u2" }
      ),
    ];

    const result = parseEntries(entries);

    // Only the real Bash commit should be detected
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]?.hash).toBe("ccc3333");
    expect(result.commits[0]?.message).toBe("fix: new bug");
  });
});
