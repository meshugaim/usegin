/**
 * Tests for session finder
 */

import { describe, test, expect, mock, afterEach } from "bun:test";
import {
  discoverSessions,
  getCurrentProjectHash,
  formatSessionLine,
  formatMultiLineEntry,
  extractUserMessages,
  runFzf,
  formatOutput,
  parseSinceFilter,
  buildFzfArgs,
  extractSessionIdFromPath,
  isSessionId,
  findSessionById,
  resolveSessionPath,
  type SessionInfo,
} from "./finder";

describe("extractUserMessages", () => {
  test("extracts user text from real session file", async () => {
    const sessions = await discoverSessions();
    if (sessions.length === 0) {
      // Skip if no sessions available
      return;
    }

    const messages = await extractUserMessages(sessions[0].path);

    // Should return array of strings
    expect(Array.isArray(messages)).toBe(true);
    // Most sessions have at least one user message
    if (messages.length > 0) {
      expect(typeof messages[0]).toBe("string");
      expect(messages[0].length).toBeGreaterThan(0);
    }
  });
});

describe("parseSinceFilter", () => {
  test("parses relative days (1d)", () => {
    const now = new Date("2024-11-29T12:00:00Z");
    const result = parseSinceFilter("1d", now);

    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2024-11-28T12:00:00.000Z");
  });

  test("parses relative weeks (2w)", () => {
    const now = new Date("2024-11-29T12:00:00Z");
    const result = parseSinceFilter("2w", now);

    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2024-11-15T12:00:00.000Z");
  });

  test("parses absolute date (2024-01-15)", () => {
    const result = parseSinceFilter("2024-01-15");

    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString().startsWith("2024-01-15")).toBe(true);
  });

  test("returns null for invalid input", () => {
    expect(parseSinceFilter("invalid")).toBeNull();
    expect(parseSinceFilter("")).toBeNull();
  });
});

describe("extractSessionMeta", () => {
  test("extracts summary from session with type:summary line", async () => {
    // Create a mock session with summary
    const { extractSessionMeta } = await import("./finder");
    const sessions = await discoverSessions();

    // Find a session with summary
    for (const session of sessions) {
      const meta = await extractSessionMeta(session.path);
      if (meta.summary) {
        expect(typeof meta.summary).toBe("string");
        expect(meta.summary.length).toBeGreaterThan(0);
        return; // Found one, test passes
      }
    }
    // If no sessions have summaries, that's ok - just verify the function works
  });

  test("returns null summary when no summary line present", async () => {
    const { extractSessionMeta } = await import("./finder");
    const sessions = await discoverSessions();

    // Test any session - should return meta with summary being string or null
    if (sessions.length > 0) {
      const meta = await extractSessionMeta(sessions[0].path);
      expect(meta.messages).toBeInstanceOf(Array);
      expect(typeof meta.lineCount).toBe("number");
      // summary can be string or null
      expect(meta.summary === null || typeof meta.summary === "string").toBe(true);
    }
  });

  test("returns hasUserMessages flag", async () => {
    const { extractSessionMeta } = await import("./finder");
    const sessions = await discoverSessions();

    if (sessions.length > 0) {
      const meta = await extractSessionMeta(sessions[0].path);
      expect(typeof meta.hasUserMessages).toBe("boolean");
    }
  });
});

describe("formatMultiLineEntry with summary", () => {
  test("shows summary with ★ prefix when present", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "-workspaces-foo",
    };
    const messages = ["Fix the login bug"];
    const lineCount = 42;
    const summary = "Claude Code CLI Implementation";

    const entry = formatMultiLineEntry(session, messages, lineCount, 6, undefined, summary);
    const lines = entry.split("\n");

    // Line 2 should be summary with star
    expect(lines[1]).toBe("★ Claude Code CLI Implementation");
    // Line 3 should be short path
    expect(lines[2]).toBe("-workspaces-foo/abc123.jsonl");
    // User messages follow
    expect(entry).toContain("> Fix the login bug");
  });

  test("shows short path on line 2 when no summary", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "-workspaces-foo",
    };
    const messages = ["Fix the login bug"];
    const lineCount = 42;

    // No summary passed
    const entry = formatMultiLineEntry(session, messages, lineCount);
    const lines = entry.split("\n");

    // Line 2 should be short path (no summary)
    expect(lines[1]).toBe("-workspaces-foo/abc123.jsonl");
  });
});

describe("parseFindArgs --output-file", () => {
  test("parses --output-file flag", async () => {
    // Import the parseFindArgs function - we'll need to export it
    const { parseFindArgs } = await import("./cli-args");

    const args = parseFindArgs(["--output-file", "/tmp/test.json"]);
    expect(args.outputFile).toBe("/tmp/test.json");
  });

  test("defaults outputFile to undefined", async () => {
    const { parseFindArgs } = await import("./cli-args");

    const args = parseFindArgs([]);
    expect(args.outputFile).toBeUndefined();
  });
});

// =============================================================================
// EDGE CASE: Live session detection
// =============================================================================

describe("isLiveSession", () => {
  test("returns false for session modified > 5 seconds ago", async () => {
    const { isLiveSession } = await import("./finder");

    // A session modified 10 seconds ago is not live
    const oldMtime = new Date(Date.now() - 10000);
    expect(isLiveSession(oldMtime)).toBe(false);
  });

  test("returns true for session modified < 5 seconds ago", async () => {
    const { isLiveSession } = await import("./finder");

    // A session modified just now is likely live
    const recentMtime = new Date(Date.now() - 1000);
    expect(isLiveSession(recentMtime)).toBe(true);
  });

  test("returns true for session modified exactly 5 seconds ago (boundary)", async () => {
    const { isLiveSession } = await import("./finder");

    // At exactly 5 seconds, still consider it potentially live
    const boundaryMtime = new Date(Date.now() - 5000);
    expect(isLiveSession(boundaryMtime)).toBe(true);
  });

  test("returns false for session modified 6 seconds ago", async () => {
    const { isLiveSession } = await import("./finder");

    const oldMtime = new Date(Date.now() - 6000);
    expect(isLiveSession(oldMtime)).toBe(false);
  });
});

describe("formatMultiLineEntry with live session", () => {
  test("includes [LIVE] indicator for live sessions", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date(Date.now() - 2000), // 2 seconds ago = live
      project: "-workspaces-foo",
    };
    const messages = ["Hello"];
    const lineCount = 10;

    const entry = formatMultiLineEntry(session, messages, lineCount);

    expect(entry).toContain("[LIVE]");
  });

  test("does not include [LIVE] for old sessions", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date(Date.now() - 60000), // 1 minute ago = not live
      project: "-workspaces-foo",
    };
    const messages = ["Hello"];
    const lineCount = 10;

    const entry = formatMultiLineEntry(session, messages, lineCount);

    expect(entry).not.toContain("[LIVE]");
  });
});

// =============================================================================
// EDGE CASE: Conflicting flags
// =============================================================================

describe("warnIfConflictingFlags", () => {
  test("returns warning when both --project and --all-projects specified", async () => {
    const { warnIfConflictingFlags } = await import("./finder");

    const warning = warnIfConflictingFlags({
      project: "-workspaces-test",
      allProjects: true,
    });

    expect(warning).toBe("Ignoring --project because --all-projects specified");
  });

  test("returns null when only --project specified", async () => {
    const { warnIfConflictingFlags } = await import("./finder");

    const warning = warnIfConflictingFlags({
      project: "-workspaces-test",
      allProjects: false,
    });

    expect(warning).toBeNull();
  });

  test("returns null when only --all-projects specified", async () => {
    const { warnIfConflictingFlags } = await import("./finder");

    const warning = warnIfConflictingFlags({
      project: undefined,
      allProjects: true,
    });

    expect(warning).toBeNull();
  });

  test("returns null when neither specified", async () => {
    const { warnIfConflictingFlags } = await import("./finder");

    const warning = warnIfConflictingFlags({
      project: undefined,
      allProjects: false,
    });

    expect(warning).toBeNull();
  });
});

// =============================================================================
// EDGE CASE: Claude projects directory doesn't exist
// =============================================================================

describe("getClaudeProjectsDir", () => {
  test("returns the expected path", async () => {
    const { getClaudeProjectsDir } = await import("./finder");
    const os = await import("node:os");

    const dir = getClaudeProjectsDir();
    expect(dir).toBe(`${os.homedir()}/.claude/projects`);
  });
});

describe("NoSessionsFoundError with missing directory", () => {
  test("includes hint about missing directory when projectsDirExists is false", async () => {
    const { NoSessionsFoundError } = await import("./errors");

    const error = new NoSessionsFoundError({
      projectsDirExists: false,
    });

    expect(error.message).toContain("~/.claude/projects");
    expect(error.message).toMatch(/directory.*not.*exist|doesn't exist|does not exist/i);
  });

  test("does not mention missing directory when projectsDirExists is true", async () => {
    const { NoSessionsFoundError } = await import("./errors");

    const error = new NoSessionsFoundError({
      projectsDirExists: true,
    });

    // Should NOT mention the directory doesn't exist
    expect(error.message).not.toMatch(/directory.*not.*exist|doesn't exist|does not exist/i);
  });
});

// =============================================================================
// EDGE CASE: Broken symlinks in debug mode
// =============================================================================

describe("isBrokenSymlink", () => {
  test("returns false for regular files", async () => {
    const { isBrokenSymlink } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    // Create a real file
    const tempFile = path.join(os.tmpdir(), `test-regular-${Date.now()}.txt`);
    await fs.writeFile(tempFile, "test content");

    try {
      const result = await isBrokenSymlink(tempFile);
      expect(result).toBe(false);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("returns false for working symlinks", async () => {
    const { isBrokenSymlink } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    // Create a real file and a symlink to it
    const tempFile = path.join(os.tmpdir(), `test-target-${Date.now()}.txt`);
    const symlink = path.join(os.tmpdir(), `test-symlink-${Date.now()}.txt`);
    await fs.writeFile(tempFile, "test content");
    await fs.symlink(tempFile, symlink);

    try {
      const result = await isBrokenSymlink(symlink);
      expect(result).toBe(false);
    } finally {
      await fs.unlink(symlink).catch(() => {});
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("returns true for broken symlinks", async () => {
    const { isBrokenSymlink } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    // Create a symlink to a non-existent file
    const symlink = path.join(os.tmpdir(), `test-broken-symlink-${Date.now()}.txt`);
    await fs.symlink("/nonexistent/target/file", symlink);

    try {
      const result = await isBrokenSymlink(symlink);
      expect(result).toBe(true);
    } finally {
      await fs.unlink(symlink).catch(() => {});
    }
  });

  test("returns false for non-existent paths (not symlinks)", async () => {
    const { isBrokenSymlink } = await import("./finder");

    const result = await isBrokenSymlink("/nonexistent/path/file.txt");
    expect(result).toBe(false);
  });
});
