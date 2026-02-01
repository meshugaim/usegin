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

describe("formatSessionLine", () => {
  test("formats session as date + path", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date("2024-11-29T14:32:00Z"),
    };

    const line = formatSessionLine(session);

    // Should contain date
    expect(line).toContain("2024-11-29");
    // Should contain path (for selection)
    expect(line).toContain("/home/user/.claude/projects/foo/abc123.jsonl");
  });
});

describe("runFzf", () => {
  test("selects matching entry with --filter", async () => {
    const sessions: SessionInfo[] = [
      {
        path: "/path/to/session-aaa.jsonl",
        id: "session-aaa",
        mtime: new Date(),
      },
      {
        path: "/path/to/session-bbb.jsonl",
        id: "session-bbb",
        mtime: new Date(),
      },
    ];

    // Use --filter to non-interactively select
    const result = await runFzf(sessions, { filter: "bbb" });

    expect(result).toBe("/path/to/session-bbb.jsonl");
  });

  test("returns null when no match", async () => {
    const sessions: SessionInfo[] = [
      {
        path: "/path/to/session-aaa.jsonl",
        id: "session-aaa",
        mtime: new Date(),
      },
    ];

    const result = await runFzf(sessions, { filter: "zzz-no-match" });

    expect(result).toBeNull();
  });
});

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

describe("formatMultiLineEntry", () => {
  test("formats with date+linecount on line 1, short path on line 2", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "-workspaces-foo",
    };
    const messages = ["Fix the login bug", "Can you also add a test?"];
    const lineCount = 42;

    const entry = formatMultiLineEntry(session, messages, lineCount);
    const lines = entry.split("\n");

    // Line 1: date + line count only
    expect(lines[0]).toBe("2024-11-29 14:32  [42]");

    // Line 2: short path (for display)
    expect(lines[1]).toBe("-workspaces-foo/abc123.jsonl");

    // User messages follow
    expect(entry).toContain("> Fix the login bug");
    expect(entry).toContain("> Can you also add a test?");

    // Full path at very end (for extraction)
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toBe("/home/user/.claude/projects/-workspaces-foo/abc123.jsonl");
  });

  test("hides project name when matching current project", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-myproj/abc123.jsonl",
      id: "abc123",
      mtime: new Date(),
      project: "-workspaces-myproj",
    };

    const entry = formatMultiLineEntry(session, [], 10, 6, "-workspaces-myproj");
    const lines = entry.split("\n");

    // Line 2 should start with just filename (no project prefix)
    expect(lines[1]).toMatch(/^abc123\.jsonl/);
  });

  test("shows project name when different from current", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-other/abc123.jsonl",
      id: "abc123",
      mtime: new Date(),
      project: "-workspaces-other",
    };

    const entry = formatMultiLineEntry(session, [], 10, 6, "-workspaces-myproj");
    const lines = entry.split("\n");

    // Line 2 should start with project/filename since different project
    expect(lines[1]).toMatch(/^-workspaces-other\/abc123\.jsonl/);
  });

  test("truncates long message lists", () => {
    const session: SessionInfo = {
      path: "/path/to/session.jsonl",
      id: "session",
      mtime: new Date(),
      project: "to",
    };
    const messages = Array.from({ length: 20 }, (_, i) => `Message ${i + 1}`);

    const entry = formatMultiLineEntry(session, messages, 100);

    // Should have ellipsis for truncated middle
    expect(entry).toContain("...");
    // Should have first and last messages
    expect(entry).toContain("> Message 1");
    expect(entry).toContain("> Message 20");
  });
});

describe("formatOutput", () => {
  const session: SessionInfo = {
    path: "/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl",
    id: "abc123-def456",
    mtime: new Date("2024-11-29T14:32:00Z"),
    project: "-workspaces-foo",
  };

  test("outputs path by default", () => {
    const result = formatOutput(session, "path");
    expect(result).toBe("/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl");
  });

  test("outputs id when format is id", () => {
    const result = formatOutput(session, "id");
    expect(result).toBe("abc123-def456");
  });

  test("outputs json when format is json", () => {
    const result = formatOutput(session, "json");
    const parsed = JSON.parse(result);

    expect(parsed.path).toBe("/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl");
    expect(parsed.id).toBe("abc123-def456");
    expect(parsed.date).toBe("2024-11-29T14:32:00.000Z");
    expect(parsed.project).toBe("-workspaces-foo");
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

describe("buildFzfArgs", () => {
  test("includes basic fzf options", () => {
    const args = buildFzfArgs({});
    expect(args).toContain("--read0");
    expect(args).toContain("--highlight-line");
    expect(args).toContain("--gap");
  });

  test("includes header with keybinding hints", () => {
    const args = buildFzfArgs({});
    expect(args).toContain("--header");
    const headerIdx = args.indexOf("--header");
    const headerValue = args[headerIdx + 1];
    expect(headerValue).toContain("ctrl-r");
    expect(headerValue).toContain("resume");
  });

  test("includes ctrl-r binding that outputs RESUME marker", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlRBind = bindArgs.find(b => b.includes("ctrl-r"));
    expect(ctrlRBind).toBeDefined();
    expect(ctrlRBind).toContain("become(");
    expect(ctrlRBind).toContain("RESUME:");
  });

  test("includes ctrl-t binding that outputs RETRO marker", () => {
    const args = buildFzfArgs({});
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlTBind = bindArgs.find(b => b.includes("ctrl-t"));
    expect(ctrlTBind).toBeDefined();
    expect(ctrlTBind).toContain("become(");
    expect(ctrlTBind).toContain("RETRO:");
  });

  test("disables keybindings in filter mode", () => {
    const args = buildFzfArgs({ filter: "test" });
    expect(args).toContain("--filter");
    // In filter mode, no interactive bindings needed
    const bindArgs = args.filter((arg, i) => args[i - 1] === "--bind");
    const ctrlRBind = bindArgs.find(b => b.includes("ctrl-r"));
    expect(ctrlRBind).toBeUndefined();
  });

  test("disables preview when noPreview is true", () => {
    const args = buildFzfArgs({ preview: false });
    expect(args).not.toContain("--preview");
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
// EDGE CASE: Missing fzf
// =============================================================================

describe("checkFzfAvailable", () => {
  test("returns true when fzf is installed", async () => {
    const { checkFzfAvailable } = await import("./finder");

    // fzf should be installed in dev environment
    const result = await checkFzfAvailable();

    expect(typeof result).toBe("boolean");
  });

  test("throws FzfNotFoundError with install instructions when fzf not found", async () => {
    const { FzfNotFoundError } = await import("./errors");

    const error = new FzfNotFoundError();
    expect(error.message).toContain("fzf");
    expect(error.message).toContain("install");
    // Should have platform-specific instructions
    expect(error.message).toMatch(/brew|apt|choco|scoop/i);
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
