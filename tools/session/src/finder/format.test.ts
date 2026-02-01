/**
 * Tests for session formatting functions
 */

import { describe, test, expect } from "bun:test";
import {
  formatSessionLine,
  formatMultiLineEntry,
  formatOutput,
  type SessionInfo,
} from "../finder";

describe("formatSessionLine", () => {
  test("formats session as date + path", () => {
    const session: SessionInfo = {
      path: "/home/user/.claude/projects/foo/abc123.jsonl",
      id: "abc123",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "foo",
    };

    const line = formatSessionLine(session);

    // Should contain date
    expect(line).toContain("2024-11-29");
    // Should contain path (for selection)
    expect(line).toContain("/home/user/.claude/projects/foo/abc123.jsonl");
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

describe("formatMultiLineEntry with summary", () => {
  test("shows summary with star prefix when present", () => {
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
