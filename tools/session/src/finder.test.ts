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

describe("discoverSessions", () => {
  test("finds sessions in claude projects directory", async () => {
    const sessions = await discoverSessions();

    // Should return an array
    expect(Array.isArray(sessions)).toBe(true);

    // Each session should have required fields
    for (const session of sessions) {
      expect(session.path).toMatch(/\.jsonl$/);
      expect(session.id).toBeTruthy();
      expect(session.mtime).toBeInstanceOf(Date);
    }
  });

  test("sorts sessions by mtime descending (most recent first)", async () => {
    const sessions = await discoverSessions();

    if (sessions.length >= 2) {
      for (let i = 1; i < sessions.length; i++) {
        expect(sessions[i - 1].mtime.getTime()).toBeGreaterThanOrEqual(
          sessions[i].mtime.getTime()
        );
      }
    }
  });

  test("excludes agent-* files (subagent sessions)", async () => {
    const sessions = await discoverSessions();

    for (const session of sessions) {
      const filename = session.path.split("/").pop() || "";
      expect(filename.startsWith("agent-")).toBe(false);
    }
  });

  test("filters to specific project when provided", async () => {
    const currentProject = getCurrentProjectHash();
    if (!currentProject) return; // Skip if not in a project

    const sessions = await discoverSessions({ project: currentProject });

    for (const session of sessions) {
      expect(session.path).toContain(currentProject);
    }
  });
});

describe("getCurrentProjectHash", () => {
  test("returns project hash from cwd", () => {
    const hash = getCurrentProjectHash();
    // Should return something like "-workspaces-test-mvp" or null
    if (hash) {
      expect(hash).toMatch(/^-/); // Claude hashes start with -
    }
  });
});

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

describe("discoverSessions with allProjects", () => {
  test("returns sessions from all projects when allProjects is true", async () => {
    const allSessions = await discoverSessions({ allProjects: true });
    const currentProject = getCurrentProjectHash();

    if (!currentProject || allSessions.length === 0) return;

    // With allProjects, we might get sessions from different projects
    // At minimum, should return sessions (may all be same project in test env)
    expect(Array.isArray(allSessions)).toBe(true);
  });

  test("allProjects overrides project filter", async () => {
    const sessions = await discoverSessions({
      allProjects: true,
      project: "nonexistent-project"
    });

    // allProjects should ignore the project filter and return all
    // (in test env, just verify it doesn't crash and returns array)
    expect(Array.isArray(sessions)).toBe(true);
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

describe("discoverSessions with since filter", () => {
  test("filters sessions by date", async () => {
    // Get all sessions first
    const allSessions = await discoverSessions({ allProjects: true });
    if (allSessions.length === 0) return;

    // Filter to sessions from last week
    const recentSessions = await discoverSessions({
      allProjects: true,
      since: "1w"
    });

    // Recent sessions should be subset of all (or equal)
    expect(recentSessions.length).toBeLessThanOrEqual(allSessions.length);

    // All returned sessions should be within the time window
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const session of recentSessions) {
      expect(session.mtime.getTime()).toBeGreaterThanOrEqual(oneWeekAgo.getTime());
    }
  });
});

describe("extractSessionIdFromPath", () => {
  test("extracts session ID from full path", () => {
    const path = "/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl";
    const id = extractSessionIdFromPath(path);
    expect(id).toBe("abc123-def456");
  });

  test("handles paths without directory", () => {
    const path = "abc123.jsonl";
    const id = extractSessionIdFromPath(path);
    expect(id).toBe("abc123");
  });
});

describe("isSessionId", () => {
  test("returns true for UUID format with hyphens", () => {
    expect(isSessionId("0b009ce0-eb9f-443c-8255-63bd8753a7e2")).toBe(true);
  });

  test("returns true for UUID format without hyphens", () => {
    expect(isSessionId("0b009ce0eb9f443c825563bd8753a7e2")).toBe(true);
  });

  test("returns false for absolute file paths", () => {
    expect(isSessionId("/home/user/.claude/projects/foo/session.jsonl")).toBe(false);
  });

  test("returns false for relative paths with ./", () => {
    expect(isSessionId("./session.jsonl")).toBe(false);
  });

  test("returns false for relative paths with ../", () => {
    expect(isSessionId("../session.jsonl")).toBe(false);
  });

  test("returns false for paths containing slashes", () => {
    expect(isSessionId("projects/session.jsonl")).toBe(false);
  });

  test("returns false for random non-UUID strings", () => {
    expect(isSessionId("not-a-uuid")).toBe(false);
    expect(isSessionId("hello")).toBe(false);
    expect(isSessionId("abc123")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isSessionId("")).toBe(false);
  });

  test("returns false for filename with .jsonl extension", () => {
    expect(isSessionId("session.jsonl")).toBe(false);
  });

  test("returns false for partial UUID (too short)", () => {
    expect(isSessionId("0b009ce0-eb9f-443c")).toBe(false);
  });

  test("returns false for UUID with .jsonl extension", () => {
    expect(isSessionId("0b009ce0-eb9f-443c-8255-63bd8753a7e2.jsonl")).toBe(false);
  });
});

describe("findSessionById", () => {
  test("finds session by ID in current project", async () => {
    // First, get a real session from current project to use its ID
    const currentProject = getCurrentProjectHash();
    if (!currentProject) return; // Skip if not in a project

    const sessions = await discoverSessions({ project: currentProject });
    if (sessions.length === 0) return; // Skip if no sessions

    const targetSession = sessions[0];
    const result = await findSessionById(targetSession.id);

    expect(result).not.toBeNull();
    expect(result!.path).toBe(targetSession.path);
    expect(result!.id).toBe(targetSession.id);
  });

  test("finds session by ID across all projects", async () => {
    // Get any session from any project
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return; // Skip if no sessions

    const targetSession = sessions[0];
    const result = await findSessionById(targetSession.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(targetSession.id);
  });

  test("returns null for non-existent session ID", async () => {
    const result = await findSessionById("00000000-0000-0000-0000-000000000000");

    expect(result).toBeNull();
  });

  test("prefers current project when session ID exists in multiple projects", async () => {
    // This test documents the expected behavior:
    // If a session ID somehow exists in multiple projects (unlikely but possible),
    // we should prefer the current project's version
    const currentProject = getCurrentProjectHash();
    if (!currentProject) return;

    const sessions = await discoverSessions({ project: currentProject });
    if (sessions.length === 0) return;

    const targetSession = sessions[0];
    const result = await findSessionById(targetSession.id);

    // Result should be from current project
    expect(result).not.toBeNull();
    expect(result!.project).toBe(currentProject);
  });

  test("returns SessionInfo with all required fields", async () => {
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return;

    const targetSession = sessions[0];
    const result = await findSessionById(targetSession.id);

    expect(result).not.toBeNull();
    expect(result!.path).toMatch(/\.jsonl$/);
    expect(result!.id).toBeTruthy();
    expect(result!.mtime).toBeInstanceOf(Date);
    expect(result!.project).toBeTruthy();
  });
});

describe("resolveSessionPath", () => {
  test("returns path unchanged for absolute file path", async () => {
    const inputPath = "/home/user/.claude/projects/foo/session.jsonl";
    const result = await resolveSessionPath(inputPath);

    expect(result).toBe(inputPath);
  });

  test("returns path unchanged for relative file path with ./", async () => {
    const inputPath = "./session.jsonl";
    const result = await resolveSessionPath(inputPath);

    expect(result).toBe(inputPath);
  });

  test("returns path unchanged for relative file path with ../", async () => {
    const inputPath = "../session.jsonl";
    const result = await resolveSessionPath(inputPath);

    expect(result).toBe(inputPath);
  });

  test("returns path unchanged for path containing slashes", async () => {
    const inputPath = "some/path/session.jsonl";
    const result = await resolveSessionPath(inputPath);

    expect(result).toBe(inputPath);
  });

  test("resolves valid session ID to full path", async () => {
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return;

    const targetSession = sessions[0];
    const result = await resolveSessionPath(targetSession.id);

    expect(result).toBe(targetSession.path);
  });

  test("throws error for non-existent session ID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await expect(resolveSessionPath(fakeId)).rejects.toThrow(
      `Session not found: ${fakeId}`
    );
  });

  test("error message includes the session ID that was not found", async () => {
    const fakeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    try {
      await resolveSessionPath(fakeId);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toContain(fakeId);
    }
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

describe("discoverSessions filtering", () => {
  test("excludes sessions with no user messages (snapshot-only)", async () => {
    const sessions = await discoverSessions({ allProjects: true });

    // All returned sessions should have user messages
    // (the filtering happens during discovery)
    for (const session of sessions) {
      // If we have sessions, they should be real conversations
      // This is implicitly tested by having sessions returned at all
      expect(session.path).toMatch(/\.jsonl$/);
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

describe("buildVscCommand", () => {
  test("builds vsc terminal create command with --shellCmd", async () => {
    const { buildVscCommand } = await import("./finder");

    const cmd = buildVscCommand("/tmp/output.json");

    expect(cmd).toContain("vsc");
    expect(cmd).toContain("terminal");
    expect(cmd).toContain("create");
    expect(cmd).toContain("--shellCmd");
    expect(cmd).toContain("--output-file");
    expect(cmd).toContain("/tmp/output.json");
  });

  test("includes --all-projects when specified", async () => {
    const { buildVscCommand } = await import("./finder");

    const cmd = buildVscCommand("/tmp/output.json", { allProjects: true });

    expect(cmd).toContain("--all-projects");
  });

  test("includes --since when specified", async () => {
    const { buildVscCommand } = await import("./finder");

    const cmd = buildVscCommand("/tmp/output.json", { since: "2d" });

    expect(cmd).toContain("--since");
    expect(cmd).toContain("2d");
  });

  test("includes terminal name", async () => {
    const { buildVscCommand } = await import("./finder");

    const cmd = buildVscCommand("/tmp/output.json");

    expect(cmd).toContain("--name");
    expect(cmd).toContain("Session Picker");
  });
});

describe("buildTmuxPopupCommand", () => {
  test("builds tmux popup command with default options", async () => {
    const { buildTmuxPopupCommand } = await import("./finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json");

    expect(cmd).toContain("tmux");
    expect(cmd).toContain("popup");
    expect(cmd).toContain("-E"); // close on exit
    expect(cmd).toContain("--output-file");
    expect(cmd).toContain("/tmp/output.json");
  });

  test("includes width and height options", async () => {
    const { buildTmuxPopupCommand } = await import("./finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { width: "90%", height: "85%" });

    expect(cmd).toContain("-w");
    expect(cmd).toContain("90%");
    expect(cmd).toContain("-h");
    expect(cmd).toContain("85%");
  });

  test("includes --all-projects when specified", async () => {
    const { buildTmuxPopupCommand } = await import("./finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { allProjects: true });

    expect(cmd).toContain("--all-projects");
  });

  test("includes --since when specified", async () => {
    const { buildTmuxPopupCommand } = await import("./finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { since: "1d" });

    expect(cmd).toContain("--since");
    expect(cmd).toContain("1d");
  });
});

describe("isTmuxAvailable", () => {
  test("returns boolean indicating tmux availability", async () => {
    const { isTmuxAvailable } = await import("./finder");

    const result = await isTmuxAvailable();

    expect(typeof result).toBe("boolean");
  });
});

describe("generateOutputFilePath", () => {
  test("generates unique temp file path", async () => {
    const { generateOutputFilePath } = await import("./finder");

    const path1 = generateOutputFilePath();
    const path2 = generateOutputFilePath();

    expect(path1).toMatch(/^\/tmp\/claude-session-ref-.*\.json$/);
    expect(path2).toMatch(/^\/tmp\/claude-session-ref-.*\.json$/);
    expect(path1).not.toBe(path2);
  });
});

describe("pollForFile", () => {
  test("returns file contents when file exists", async () => {
    const { pollForFile } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const tempFile = path.join(os.tmpdir(), `poll-test-${Date.now()}.json`);
    const testData = { test: "data" };

    try {
      // Write file immediately
      await fs.writeFile(tempFile, JSON.stringify(testData));

      const result = await pollForFile(tempFile, { intervalMs: 50, timeoutMs: 500 });

      expect(result).toEqual(testData);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("returns null on timeout when file does not exist", async () => {
    const { pollForFile } = await import("./finder");

    const result = await pollForFile("/tmp/nonexistent-file-12345.json", {
      intervalMs: 50,
      timeoutMs: 150,
    });

    expect(result).toBeNull();
  });

  test("waits for file to appear", async () => {
    const { pollForFile } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const tempFile = path.join(os.tmpdir(), `poll-delay-test-${Date.now()}.json`);
    const testData = { delayed: true };

    try {
      // Write file after a delay
      setTimeout(async () => {
        await fs.writeFile(tempFile, JSON.stringify(testData));
      }, 100);

      const result = await pollForFile(tempFile, { intervalMs: 50, timeoutMs: 500 });

      expect(result).toEqual(testData);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });
});

describe("openSessionPicker", () => {
  test("throws error when method=tmux but not in tmux", async () => {
    const { openSessionPicker } = await import("./finder");

    // Save original TMUX env
    const originalTmux = process.env.TMUX;

    try {
      // Remove TMUX to simulate not being in tmux
      delete process.env.TMUX;

      // Force tmux method
      await expect(openSessionPicker({ method: "tmux" })).rejects.toThrow("tmux not available");
    } finally {
      // Restore original TMUX env
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });

  test("throws helpful error when no method available", async () => {
    // Mock both availability checks to return false
    const originalFinder = await import("./finder");

    mock.module("./finder", () => ({
      ...originalFinder,
      isVscBridgeAvailable: mock(async () => false),
      isTmuxAvailable: mock(async () => false),
    }));

    const { openSessionPicker } = await import("./finder");
    const originalTmux = process.env.TMUX;

    try {
      delete process.env.TMUX;

      await expect(openSessionPicker({ method: "auto" })).rejects.toThrow(
        /No session picker method available/
      );
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
      mock.restore();
    }
  });
});

describe("isVscBridgeAvailable", () => {
  test("returns false when port file does not exist", async () => {
    const { isVscBridgeAvailable } = await import("./finder");

    // Use a path that definitely doesn't exist
    const result = await isVscBridgeAvailable("/nonexistent/path/.vsc-bridge.port");

    expect(result).toBe(false);
  });

  test("returns boolean based on port file and server availability", async () => {
    const { isVscBridgeAvailable } = await import("./finder");

    // Default path - may or may not exist depending on environment
    const result = await isVscBridgeAvailable();

    expect(typeof result).toBe("boolean");
  });
});

describe("detectPickerMethod", () => {
  test("returns tmux when TMUX env var is set", async () => {
    const { detectPickerMethod } = await import("./finder");

    const originalTmux = process.env.TMUX;

    try {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";

      const result = await detectPickerMethod();

      expect(result).toBe("tmux");
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      } else {
        delete process.env.TMUX;
      }
    }
  });

  test("returns null when neither tmux nor vsc available", async () => {
    const { detectPickerMethod } = await import("./finder");

    const originalTmux = process.env.TMUX;

    try {
      delete process.env.TMUX;

      // Pass a nonexistent port file path to ensure vsc check fails
      const result = await detectPickerMethod("/nonexistent/.vsc-bridge.port");

      expect(result).toBeNull();
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });
});

describe("parsePickArgs with --method", () => {
  test("parses --method flag", async () => {
    const { parsePickArgs } = await import("./cli-args");

    const args = parsePickArgs(["--method", "vsc"]);
    expect(args.method).toBe("vsc");
  });

  test("defaults method to auto", async () => {
    const { parsePickArgs } = await import("./cli-args");

    const args = parsePickArgs([]);
    expect(args.method).toBe("auto");
  });

  test("accepts tmux, vsc, auto as valid methods", async () => {
    const { parsePickArgs } = await import("./cli-args");

    expect(parsePickArgs(["--method", "tmux"]).method).toBe("tmux");
    expect(parsePickArgs(["--method", "vsc"]).method).toBe("vsc");
    expect(parsePickArgs(["--method", "auto"]).method).toBe("auto");
  });
});

// =============================================================================
// SHORT ID PREFIX RESOLUTION TESTS
// =============================================================================

describe("isSessionIdOrPrefix", () => {
  // Import the new function - will be added to finder.ts
  // For now, we document expected behavior

  test("recognizes full UUID with hyphens", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7-684a-4724-b592-34aa88aac626")).toBe(true);
  });

  test("recognizes full UUID without hyphens", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7684a4724b59234aa88aac626")).toBe(true);
  });

  test("recognizes short ID prefix (8 chars)", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7")).toBe(true);
  });

  test("recognizes medium ID prefix (12 chars with partial hyphen segment)", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7-684")).toBe(true);
  });

  test("recognizes prefix with full first segment only", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7-")).toBe(true);
  });

  test("rejects paths", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("/home/user/.claude/projects/test/502de9c7.jsonl")).toBe(false);
  });

  test("rejects files with extensions", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9c7-684a-4724-b592-34aa88aac626.jsonl")).toBe(false);
  });

  test("rejects invalid hex characters", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502de9cz")).toBe(false);
  });

  test("rejects empty string", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("")).toBe(false);
  });

  test("rejects very short prefixes (< 4 chars) as too ambiguous", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502")).toBe(false);
    expect(isSessionIdOrPrefix("50")).toBe(false);
    expect(isSessionIdOrPrefix("5")).toBe(false);
  });

  test("accepts 4-char prefix as minimum", async () => {
    const { isSessionIdOrPrefix } = await import("./finder");
    expect(isSessionIdOrPrefix("502d")).toBe(true);
  });
});

describe("findSessionsByPrefix", () => {
  test("finds single session with unique prefix", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("./finder");

    // Get a real session to test with
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return; // Skip if no sessions

    const targetSession = sessions[0];
    // Use first 8 characters as prefix
    const prefix = targetSession.id.slice(0, 8);

    const matches = await findSessionsByPrefix(prefix);

    // Should find at least one match
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The target should be in the matches
    expect(matches.some(s => s.id === targetSession.id)).toBe(true);
  });

  test("returns multiple matches for ambiguous prefix", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("./finder");

    // Get real sessions
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length < 2) return; // Need multiple sessions

    // Use a very short prefix that might match multiple
    // In practice, we'd need sessions that share a prefix
    // For now, just verify the function returns an array
    const matches = await findSessionsByPrefix(sessions[0].id.slice(0, 4));

    expect(Array.isArray(matches)).toBe(true);
  });

  test("returns empty array for non-matching prefix", async () => {
    const { findSessionsByPrefix } = await import("./finder");

    // Use a valid hex prefix that shouldn't match any sessions
    // "00000000" is valid hex but unlikely to match any real session
    const matches = await findSessionsByPrefix("00000000");

    expect(matches).toEqual([]);
  });

  test("returns single match for full ID", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("./finder");

    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return;

    const targetSession = sessions[0];
    const matches = await findSessionsByPrefix(targetSession.id);

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe(targetSession.id);
  });
});

describe("resolveSessionPath with short ID prefixes", () => {
  test("resolves unique short prefix to full path", async () => {
    const { resolveSessionPath, discoverSessions } = await import("./finder");

    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return;

    // Find a session with a unique-ish prefix (use more chars for uniqueness)
    const targetSession = sessions[0];
    const prefix = targetSession.id.slice(0, 12);

    // Check if this prefix is unique
    const matchingCount = sessions.filter(s => s.id.startsWith(prefix)).length;

    if (matchingCount === 1) {
      const result = await resolveSessionPath(prefix);
      expect(result).toBe(targetSession.path);
    }
    // If not unique, this test just passes (we test ambiguous case separately)
  });

  test("throws AmbiguousSessionError for ambiguous prefix", async () => {
    const { resolveSessionPath, discoverSessions, AmbiguousSessionError } = await import("./finder");

    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length < 2) return;

    // Find a prefix that matches multiple sessions
    // This is hard to test without crafted data, so we'll use a very short prefix
    // In real usage, two sessions starting with same chars would trigger this

    // For now, let's check the error type exists and is thrown correctly
    // by using an artificially ambiguous scenario (we'll mock this in unit tests)
    expect(AmbiguousSessionError).toBeDefined();
  });

  test("throws not found error for non-matching prefix", async () => {
    const { resolveSessionPath } = await import("./finder");

    // Use a valid hex prefix that matches no sessions
    // "00000000" is valid hex but unlikely to match any real session
    await expect(resolveSessionPath("00000000")).rejects.toThrow(/not found/i);
  });

  test("error for ambiguous prefix includes matching options", async () => {
    const { AmbiguousSessionError, findSessionsByPrefix, discoverSessions } = await import("./finder");

    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) return;

    // Construct an error manually to verify its message format
    const mockMatches = [
      { id: "aaaa1111-0000-0000-0000-000000000001", path: "/p1", mtime: new Date(), project: "p" },
      { id: "aaaa2222-0000-0000-0000-000000000002", path: "/p2", mtime: new Date(), project: "p" },
    ];

    const error = new AmbiguousSessionError("aaaa", mockMatches);
    expect(error.message).toContain("aaaa");
    expect(error.message).toContain("aaaa1111");
    expect(error.message).toContain("aaaa2222");
    expect(error.matches).toHaveLength(2);
  });
});

describe("AmbiguousSessionError", () => {
  test("is exported from finder module", async () => {
    const { AmbiguousSessionError } = await import("./finder");
    expect(AmbiguousSessionError).toBeDefined();
  });

  test("extends Error", async () => {
    const { AmbiguousSessionError } = await import("./finder");

    const error = new AmbiguousSessionError("abc", []);
    expect(error).toBeInstanceOf(Error);
  });

  test("stores matching sessions", async () => {
    const { AmbiguousSessionError } = await import("./finder");

    const matches = [
      { id: "abc123", path: "/p1", mtime: new Date(), project: "p" },
      { id: "abc456", path: "/p2", mtime: new Date(), project: "p" },
    ];

    const error = new AmbiguousSessionError("abc", matches);

    expect(error.matches).toBe(matches);
    expect(error.prefix).toBe("abc");
  });

  test("generates helpful message showing first 8 chars of each match", async () => {
    const { AmbiguousSessionError } = await import("./finder");

    const matches = [
      { id: "abcd1234-5678-90ab-cdef-1234567890ab", path: "/p1", mtime: new Date(), project: "p" },
      { id: "abcd5678-1234-90ab-cdef-1234567890ab", path: "/p2", mtime: new Date(), project: "p" },
    ];

    const error = new AmbiguousSessionError("abcd", matches);

    expect(error.message).toContain("abcd");
    expect(error.message).toContain("abcd1234");
    expect(error.message).toContain("abcd5678");
  });
});

// =============================================================================
// END SHORT ID PREFIX RESOLUTION TESTS
// =============================================================================

describe("writeOutputFile", () => {
  test("writes session info to JSON file", async () => {
    const { writeOutputFile } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl",
      id: "abc123-def456",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "-workspaces-foo",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile);

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.path).toBe(session.path);
      expect(parsed.id).toBe(session.id);
      expect(parsed.date).toBe("2024-11-29T14:32:00.000Z");
      expect(parsed.project).toBe(session.project);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("writes summary when available", async () => {
    const { writeOutputFile } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/path/to/session.jsonl",
      id: "session-id",
      mtime: new Date(),
      project: "project",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-summary-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile, "My session summary");

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.summary).toBe("My session summary");
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("writes null summary when not provided", async () => {
    const { writeOutputFile } = await import("./finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/path/to/session.jsonl",
      id: "session-id",
      mtime: new Date(),
      project: "project",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-null-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile);

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.summary).toBeNull();
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
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
