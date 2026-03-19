import { test, expect, describe } from "bun:test";
import {
  parseGitLogOutput,
  getCommitsFromGitHistory,
  getCommitsByTrailer,
  getCommitsBySha,
  getSessionCommits,
  type GitCommit,
} from "./git-commits";

// ============================================================================
// parseGitLogOutput — pure parsing, no git required
// ============================================================================

describe("parseGitLogOutput", () => {
  // ==========================================================================
  // EMPTY / TRIVIAL INPUT
  // ==========================================================================

  test("returns empty array for empty string", () => {
    expect(parseGitLogOutput("")).toEqual([]);
  });

  test("returns empty array for whitespace-only input", () => {
    expect(parseGitLogOutput("   \n\n  ")).toEqual([]);
  });

  test("returns empty array for input with no commit markers", () => {
    expect(parseGitLogOutput("some random text\nno commits here")).toEqual([]);
  });

  // ==========================================================================
  // SINGLE COMMIT
  // ==========================================================================

  test("parses a single commit without shortstat", () => {
    const raw = [
      "---COMMIT_START---",
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "a1b2c3d",
      "fix: resolve login bug",
      "Alice Smith",
      "alice@example.com",
      "2025-01-15T10:30:00+00:00",
      "---COMMIT_END---",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual({
      hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      shortHash: "a1b2c3d",
      subject: "fix: resolve login bug",
      authorName: "Alice Smith",
      authorEmail: "alice@example.com",
      timestamp: "2025-01-15T10:30:00+00:00",
    });
  });

  test("parses a single commit with shortstat", () => {
    const raw = [
      "---COMMIT_START---",
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "a1b2c3d",
      "feat: add search feature",
      "Bob Builder",
      "bob@example.com",
      "2025-01-15T11:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 3 files changed, 42 insertions(+), 7 deletions(-)",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.filesChanged).toBe(3);
    expect(commits[0]!.insertions).toBe(42);
    expect(commits[0]!.deletions).toBe(7);
  });

  test("parses shortstat with only insertions", () => {
    const raw = [
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      "feat: new file",
      "Dev",
      "dev@test.com",
      "2025-01-15T09:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 1 file changed, 10 insertions(+)",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.filesChanged).toBe(1);
    expect(commits[0]!.insertions).toBe(10);
    expect(commits[0]!.deletions).toBe(0);
  });

  test("parses shortstat with only deletions", () => {
    const raw = [
      "---COMMIT_START---",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bbbbbbb",
      "chore: remove dead code",
      "Dev",
      "dev@test.com",
      "2025-01-15T09:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 2 files changed, 15 deletions(-)",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.filesChanged).toBe(2);
    expect(commits[0]!.insertions).toBe(0);
    expect(commits[0]!.deletions).toBe(15);
  });

  // ==========================================================================
  // MULTIPLE COMMITS
  // ==========================================================================

  test("parses multiple commits and sorts by timestamp ascending", () => {
    // git log outputs newest first — parser should reverse to ascending
    const raw = [
      // Second commit (newer, listed first by git log)
      "---COMMIT_START---",
      "2222222222222222222222222222222222222222",
      "2222222",
      "feat: second commit",
      "Alice",
      "alice@test.com",
      "2025-01-15T11:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 1 file changed, 5 insertions(+)",
      // First commit (older, listed second by git log)
      "---COMMIT_START---",
      "1111111111111111111111111111111111111111",
      "1111111",
      "fix: first commit",
      "Bob",
      "bob@test.com",
      "2025-01-15T10:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 2 files changed, 3 insertions(+), 1 deletions(-)",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(2);
    // Should be sorted ascending (oldest first)
    expect(commits[0]!.shortHash).toBe("1111111");
    expect(commits[1]!.shortHash).toBe("2222222");
  });

  test("parses multiple commits with mixed shortstat presence", () => {
    const raw = [
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      "commit with stats",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:00:00+00:00",
      "---COMMIT_END---",
      "",
      " 1 file changed, 2 insertions(+)",
      "---COMMIT_START---",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bbbbbbb",
      "merge commit (no stats)",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:05:00+00:00",
      "---COMMIT_END---",
      "---COMMIT_START---",
      "cccccccccccccccccccccccccccccccccccccccc",
      "ccccccc",
      "another commit with stats",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:10:00+00:00",
      "---COMMIT_END---",
      "",
      " 5 files changed, 100 insertions(+), 20 deletions(-)",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(3);

    // First commit has stats
    expect(commits[0]!.shortHash).toBe("aaaaaaa");
    expect(commits[0]!.filesChanged).toBe(1);

    // Second commit (merge) has no stats
    expect(commits[1]!.shortHash).toBe("bbbbbbb");
    expect(commits[1]!.filesChanged).toBeUndefined();

    // Third commit has stats
    expect(commits[2]!.shortHash).toBe("ccccccc");
    expect(commits[2]!.filesChanged).toBe(5);
    expect(commits[2]!.insertions).toBe(100);
    expect(commits[2]!.deletions).toBe(20);
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  test("skips commits with invalid hash", () => {
    const raw = [
      "---COMMIT_START---",
      "not-a-valid-hash",
      "nope",
      "bad commit",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:00:00+00:00",
      "---COMMIT_END---",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toEqual([]);
  });

  test("handles malformed blocks (missing COMMIT_END)", () => {
    const raw = [
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      "orphaned commit start",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:00:00+00:00",
      // Missing COMMIT_END — should be skipped
      "---COMMIT_START---",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bbbbbbb",
      "valid commit",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:05:00+00:00",
      "---COMMIT_END---",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    // Only the valid commit should parse
    expect(commits).toHaveLength(1);
    expect(commits[0]!.shortHash).toBe("bbbbbbb");
  });

  test("handles truncated output (insufficient lines after COMMIT_START)", () => {
    const raw = [
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      // Only 2 fields, then EOF — not enough
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toEqual([]);
  });

  test("handles subjects with special characters", () => {
    const raw = [
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      'feat(session): add "quotes" & <angles> [ENG-1234]',
      "Dev O'Brien",
      "dev+special@test.com",
      "2025-01-15T10:00:00+00:00",
      "---COMMIT_END---",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.subject).toBe(
      'feat(session): add "quotes" & <angles> [ENG-1234]'
    );
    expect(commits[0]!.authorName).toBe("Dev O'Brien");
    expect(commits[0]!.authorEmail).toBe("dev+special@test.com");
  });

  test("handles trailing newlines and whitespace", () => {
    const raw = [
      "",
      "---COMMIT_START---",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaa",
      "clean commit",
      "Dev",
      "dev@test.com",
      "2025-01-15T10:00:00+00:00",
      "---COMMIT_END---",
      "",
      "",
    ].join("\n");

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]!.subject).toBe("clean commit");
  });
});

// ============================================================================
// getCommitsFromGitHistory — integration with actual git
// ============================================================================

describe("getCommitsFromGitHistory", () => {
  // These tests run against the real git repo we're in.

  test("returns commits from the current repo within a valid time window", async () => {
    // Use a wide window that should include at least the most recent commit
    const endTime = new Date().toISOString();
    const startTime = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    ).toISOString(); // 1 year ago

    const commits = await getCommitsFromGitHistory({
      cwd: "/workspaces/test-mvp",
      startTime,
      endTime,
    });

    // We're in a git repo, so there should be at least one commit
    expect(commits.length).toBeGreaterThan(0);

    // Verify structure of the first commit
    const first = commits[0]!;
    expect(first.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(first.shortHash.length).toBeGreaterThanOrEqual(7);
    expect(first.subject.length).toBeGreaterThan(0);
    expect(first.authorName.length).toBeGreaterThan(0);
    expect(first.authorEmail.length).toBeGreaterThan(0);
    expect(first.timestamp.length).toBeGreaterThan(0);
  });

  test("returns empty array for a time window with no commits", async () => {
    // Use a time window in the distant past
    const commits = await getCommitsFromGitHistory({
      cwd: "/workspaces/test-mvp",
      startTime: "1990-01-01T00:00:00Z",
      endTime: "1990-01-02T00:00:00Z",
    });

    expect(commits).toEqual([]);
  });

  test("returns sorted commits (ascending by timestamp)", async () => {
    const endTime = new Date().toISOString();
    const startTime = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    const commits = await getCommitsFromGitHistory({
      cwd: "/workspaces/test-mvp",
      startTime,
      endTime,
    });

    // Verify ascending order
    for (let i = 1; i < commits.length; i++) {
      const prevTime = new Date(commits[i - 1]!.timestamp).getTime();
      const currTime = new Date(commits[i]!.timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  // ==========================================================================
  // GRACEFUL ERROR HANDLING
  // ==========================================================================

  test("returns empty array for non-existent directory", async () => {
    const commits = await getCommitsFromGitHistory({
      cwd: "/nonexistent/path/that/does/not/exist",
      startTime: "2025-01-01T00:00:00Z",
      endTime: "2025-12-31T23:59:59Z",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for directory that is not a git repo", async () => {
    const commits = await getCommitsFromGitHistory({
      cwd: "/tmp",
      startTime: "2025-01-01T00:00:00Z",
      endTime: "2025-12-31T23:59:59Z",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for invalid startTime", async () => {
    const commits = await getCommitsFromGitHistory({
      cwd: "/workspaces/test-mvp",
      startTime: "not-a-date",
      endTime: "2025-12-31T23:59:59Z",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for invalid endTime", async () => {
    const commits = await getCommitsFromGitHistory({
      cwd: "/workspaces/test-mvp",
      startTime: "2025-01-01T00:00:00Z",
      endTime: "not-a-date",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for empty cwd", async () => {
    const commits = await getCommitsFromGitHistory({
      cwd: "",
      startTime: "2025-01-01T00:00:00Z",
      endTime: "2025-12-31T23:59:59Z",
    });

    expect(commits).toEqual([]);
  });
});

// ============================================================================
// getCommitsByTrailer — trailer-based commit discovery
// ============================================================================

describe("getCommitsByTrailer", () => {
  test("returns empty array for empty cwd", async () => {
    const commits = await getCommitsByTrailer({
      cwd: "",
      sessionId: "abc-123",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for empty sessionId", async () => {
    const commits = await getCommitsByTrailer({
      cwd: "/workspaces/test-mvp",
      sessionId: "",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for non-existent directory", async () => {
    const commits = await getCommitsByTrailer({
      cwd: "/nonexistent/path/that/does/not/exist",
      sessionId: "abc-123",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for directory that is not a git repo", async () => {
    const commits = await getCommitsByTrailer({
      cwd: "/tmp",
      sessionId: "abc-123",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array when no commits match the trailer", async () => {
    // Use a session ID that no commit will ever have
    const commits = await getCommitsByTrailer({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
    });

    expect(commits).toEqual([]);
  });
});

// ============================================================================
// getSessionCommits — trailer-first, time-window fallback
// ============================================================================

describe("getSessionCommits", () => {
  test("returns empty array for empty cwd", async () => {
    const commits = await getSessionCommits({
      cwd: "",
      sessionId: "abc-123",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for empty sessionId and no time window", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "",
    });

    expect(commits).toEqual([]);
  });

  test("falls back to time-window when no trailer commits found", async () => {
    // Use a session ID that won't match any trailers, but a wide time window
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      startTime,
      endTime,
    });

    // Should fall back to time-window and find commits
    expect(commits.length).toBeGreaterThan(0);
  });

  test("returns empty array when no trailer match and no time window provided", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array when no trailer match and time window has no commits", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      startTime: "1990-01-01T00:00:00Z",
      endTime: "1990-01-02T00:00:00Z",
    });

    expect(commits).toEqual([]);
  });

  // ==========================================================================
  // SHA-BASED STRATEGY IN getSessionCommits
  // ==========================================================================

  test("uses SHA-based strategy first when shas are provided", async () => {
    // Get a real SHA from this repo
    const proc = Bun.spawn(["git", "log", "-1", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const sha = (await new Response(proc.stdout).text()).trim();

    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      shas: [sha],
    });

    // SHA-based should succeed, no need to fall through to trailer/time-window
    expect(commits).toHaveLength(1);
    expect(commits[0]!.hash).toBe(sha);
  });

  test("skips SHA strategy when shas is empty array", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      shas: [],
    });

    // Empty shas -> skip SHA strategy -> no trailer match -> no time window -> empty
    expect(commits).toEqual([]);
  });

  test("skips SHA strategy when shas is undefined", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      shas: undefined,
    });

    // undefined shas -> skip SHA strategy -> no trailer match -> no time window -> empty
    expect(commits).toEqual([]);
  });

  test("falls through from SHA to trailer when all SHAs are invalid", async () => {
    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      shas: ["0000000000000000000000000000000000000000", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
    });

    // Invalid SHAs -> SHA strategy returns empty -> trailer returns empty -> no time window -> empty
    expect(commits).toEqual([]);
  });

  test("falls through from SHA to time-window when SHAs invalid and no trailer match", async () => {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const commits = await getSessionCommits({
      cwd: "/workspaces/test-mvp",
      sessionId: "nonexistent-session-id-that-no-commit-has-99999",
      startTime,
      endTime,
      shas: ["0000000000000000000000000000000000000000"],
    });

    // Invalid SHA -> trailer miss -> fall through to time-window
    expect(commits.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// getCommitsBySha — SHA-based commit discovery
// ============================================================================

describe("getCommitsBySha", () => {
  // ==========================================================================
  // VALID SHAs (integration tests against real repo)
  // ==========================================================================

  test("returns enriched commit for a valid full SHA", async () => {
    // Get the most recent SHA from this repo
    const proc = Bun.spawn(["git", "log", "-1", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const sha = (await new Response(proc.stdout).text()).trim();

    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: [sha],
    });

    expect(commits).toHaveLength(1);
    const commit = commits[0]!;
    expect(commit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(commit.shortHash.length).toBeGreaterThanOrEqual(7);
    expect(commit.subject.length).toBeGreaterThan(0);
    expect(commit.authorName.length).toBeGreaterThan(0);
    expect(commit.authorEmail.length).toBeGreaterThan(0);
    expect(commit.timestamp.length).toBeGreaterThan(0);
  });

  test("returns enriched commits for multiple valid SHAs", async () => {
    const proc = Bun.spawn(["git", "log", "-3", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const shas = (await new Response(proc.stdout).text()).trim().split("\n");

    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas,
    });

    expect(commits).toHaveLength(3);
    // Each commit should have valid structure
    for (const commit of commits) {
      expect(commit.hash).toMatch(/^[0-9a-f]{40}$/);
      expect(commit.subject.length).toBeGreaterThan(0);
    }
  });

  test("works with short (7-char) SHAs", async () => {
    const proc = Bun.spawn(["git", "log", "-1", "--format=%h"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const shortSha = (await new Response(proc.stdout).text()).trim();

    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: [shortSha],
    });

    expect(commits).toHaveLength(1);
    // The returned hash should be the full 40-char hash (enriched)
    expect(commits[0]!.hash).toMatch(/^[0-9a-f]{40}$/);
  });

  // ==========================================================================
  // EMPTY / TRIVIAL INPUT
  // ==========================================================================

  test("returns empty array for empty SHA list", async () => {
    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: [],
    });

    expect(commits).toEqual([]);
  });

  test("returns empty array for empty cwd", async () => {
    const commits = await getCommitsBySha({
      cwd: "",
      shas: ["abc1234"],
    });

    expect(commits).toEqual([]);
  });

  // ==========================================================================
  // GRACEFUL ERROR HANDLING
  // ==========================================================================

  test("gracefully handles non-existent SHAs", async () => {
    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: ["0000000000000000000000000000000000000000", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
    });

    expect(commits).toEqual([]);
  });

  test("handles mix of valid and invalid SHAs", async () => {
    // Get one real SHA
    const proc = Bun.spawn(["git", "log", "-1", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const validSha = (await new Response(proc.stdout).text()).trim();

    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: [validSha, "0000000000000000000000000000000000000000"],
    });

    // Should return only the valid commit, skipping the invalid one
    expect(commits).toHaveLength(1);
    expect(commits[0]!.hash).toBe(validSha);
  });

  test("returns empty for non-git directory", async () => {
    const commits = await getCommitsBySha({
      cwd: "/tmp",
      shas: ["abc1234"],
    });

    expect(commits).toEqual([]);
  });

  test("returns empty for non-existent directory", async () => {
    const commits = await getCommitsBySha({
      cwd: "/nonexistent/path/that/does/not/exist",
      shas: ["abc1234"],
    });

    expect(commits).toEqual([]);
  });

  // ==========================================================================
  // PRECISION TEST — demonstrates the core value of SHA-based scoping
  // ==========================================================================

  test("returns exactly the requested commit, not neighboring ones", async () => {
    // Get 2 recent real SHAs
    const proc = Bun.spawn(["git", "log", "-2", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const shas = (await new Response(proc.stdout).text()).trim().split("\n");
    expect(shas).toHaveLength(2);

    // Ask for only the first one
    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas: [shas[0]!],
    });

    // Should return exactly 1 commit — the one we asked for, not both
    expect(commits).toHaveLength(1);
    expect(commits[0]!.hash).toBe(shas[0]!);
  });

  test("returns commits sorted by timestamp ascending", async () => {
    const proc = Bun.spawn(["git", "log", "-5", "--format=%H"], {
      cwd: "/workspaces/test-mvp",
      stdout: "pipe",
    });
    const shas = (await new Response(proc.stdout).text()).trim().split("\n");

    const commits = await getCommitsBySha({
      cwd: "/workspaces/test-mvp",
      shas,
    });

    // Verify ascending order
    for (let i = 1; i < commits.length; i++) {
      const prevTime = new Date(commits[i - 1]!.timestamp).getTime();
      const currTime = new Date(commits[i]!.timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });
});
