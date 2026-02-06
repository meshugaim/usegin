/**
 * Tests for session formatting functions
 */

import { describe, test, expect } from "bun:test";
import {
  formatSessionLine,
  formatMultiLineEntry,
  formatOutput,
  formatRelativeTime,
  formatListLine,
  truncateMessage,
  type SessionInfo,
  type SessionMeta,
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

// =============================================================================
// RELATIVE TIME FORMATTING
// =============================================================================

describe("formatRelativeTime", () => {
  // Use a fixed "now" for deterministic tests
  const now = new Date("2024-12-01T12:00:00Z").getTime();

  test("returns 'just now' for times less than a minute ago", () => {
    const date = new Date(now - 30 * 1000); // 30 seconds ago
    expect(formatRelativeTime(date, now)).toBe("just now");
  });

  test("returns 'just now' for times 0 seconds ago", () => {
    const date = new Date(now);
    expect(formatRelativeTime(date, now)).toBe("just now");
  });

  test("returns 'just now' for future dates", () => {
    const date = new Date(now + 60 * 1000); // 1 minute in the future
    expect(formatRelativeTime(date, now)).toBe("just now");
  });

  test("formats minutes correctly", () => {
    expect(formatRelativeTime(new Date(now - 2 * 60 * 1000), now)).toBe("2m ago");
    expect(formatRelativeTime(new Date(now - 45 * 60 * 1000), now)).toBe("45m ago");
    expect(formatRelativeTime(new Date(now - 59 * 60 * 1000), now)).toBe("59m ago");
  });

  test("formats hours correctly", () => {
    expect(formatRelativeTime(new Date(now - 1 * 60 * 60 * 1000), now)).toBe("1h ago");
    expect(formatRelativeTime(new Date(now - 2 * 60 * 60 * 1000), now)).toBe("2h ago");
    expect(formatRelativeTime(new Date(now - 23 * 60 * 60 * 1000), now)).toBe("23h ago");
  });

  test("formats days correctly", () => {
    expect(formatRelativeTime(new Date(now - 1 * 24 * 60 * 60 * 1000), now)).toBe("1d ago");
    expect(formatRelativeTime(new Date(now - 5 * 24 * 60 * 60 * 1000), now)).toBe("5d ago");
    expect(formatRelativeTime(new Date(now - 13 * 24 * 60 * 60 * 1000), now)).toBe("13d ago");
  });

  test("formats weeks correctly", () => {
    expect(formatRelativeTime(new Date(now - 14 * 24 * 60 * 60 * 1000), now)).toBe("2w ago");
    expect(formatRelativeTime(new Date(now - 21 * 24 * 60 * 60 * 1000), now)).toBe("3w ago");
    expect(formatRelativeTime(new Date(now - 49 * 24 * 60 * 60 * 1000), now)).toBe("7w ago");
  });

  test("formats months correctly for large durations", () => {
    expect(formatRelativeTime(new Date(now - 60 * 24 * 60 * 60 * 1000), now)).toBe("2mo ago");
    expect(formatRelativeTime(new Date(now - 90 * 24 * 60 * 60 * 1000), now)).toBe("3mo ago");
  });

  test("boundary: 60 minutes becomes 1h ago", () => {
    expect(formatRelativeTime(new Date(now - 60 * 60 * 1000), now)).toBe("1h ago");
  });

  test("boundary: 24 hours becomes 1d ago", () => {
    expect(formatRelativeTime(new Date(now - 24 * 60 * 60 * 1000), now)).toBe("1d ago");
  });
});

// =============================================================================
// MESSAGE TRUNCATION
// =============================================================================

describe("truncateMessage for list display", () => {
  test("returns short messages unchanged", () => {
    expect(truncateMessage("hello world", 50)).toBe("hello world");
  });

  test("truncates long messages with ellipsis", () => {
    const long = "a".repeat(60);
    const result = truncateMessage(long, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
  });

  test("replaces newlines with spaces", () => {
    expect(truncateMessage("hello\nworld\nfoo", 50)).toBe("hello world foo");
  });

  test("returns exactly maxLen when input is exactly maxLen", () => {
    const exact = "a".repeat(50);
    expect(truncateMessage(exact, 50)).toBe(exact);
    expect(truncateMessage(exact, 50).length).toBe(50);
  });

  test("truncates at maxLen - 3 and adds ellipsis", () => {
    const text = "a".repeat(51);
    const result = truncateMessage(text, 50);
    expect(result).toBe("a".repeat(47) + "...");
  });
});

// =============================================================================
// RICH LIST LINE FORMATTING
// =============================================================================

describe("formatListLine", () => {
  // Fixed time for deterministic relative time output
  const fixedNow = new Date("2024-12-01T12:00:00Z");

  function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
    return {
      path: "/home/user/.claude/projects/foo/4a7ffc84-1234-5678-9abc-def012345678.jsonl",
      id: "4a7ffc84-1234-5678-9abc-def012345678",
      mtime: new Date(fixedNow.getTime() - 2 * 60 * 60 * 1000), // 2h ago
      project: "foo",
      ...overrides,
    };
  }

  function makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
    return {
      messages: ["can you try to use agent-browser to test this flow"],
      lineCount: 300,
      turnCount: 281,
      summary: null,
      hasUserMessages: true,
      ...overrides,
    };
  }

  test("includes short session ID (8 chars)", () => {
    const line = formatListLine(makeSession(), makeMeta());
    expect(line).toContain("4a7ffc84");
    // Should NOT include the full UUID
    expect(line).not.toContain("4a7ffc84-1234-5678-9abc-def012345678");
  });

  test("includes turn count", () => {
    const line = formatListLine(makeSession(), makeMeta({ turnCount: 281 }));
    expect(line).toContain("281 turns");
  });

  test("includes first user message in quotes", () => {
    const line = formatListLine(
      makeSession(),
      makeMeta({ messages: ["can you try to use agent-browser to test"] }),
    );
    expect(line).toContain('"can you try to use agent-browser to test"');
  });

  test("prefers AI summary over first user message", () => {
    const line = formatListLine(
      makeSession(),
      makeMeta({
        summary: "Session about browser testing",
        messages: ["can you try to use agent-browser to test"],
      }),
    );
    expect(line).toContain('"Session about browser testing"');
    expect(line).not.toContain("agent-browser");
  });

  test("handles session with no messages and no summary", () => {
    const line = formatListLine(
      makeSession(),
      makeMeta({ messages: [], summary: null }),
    );
    // Should still have ID and turn count, just no quoted prompt
    expect(line).toContain("4a7ffc84");
    expect(line).toContain("281 turns");
    expect(line).not.toContain('"');
  });

  test("truncates long first messages to ~50 chars", () => {
    const longMsg = "a]".repeat(50); // 100 chars
    const line = formatListLine(
      makeSession(),
      makeMeta({ messages: [longMsg] }),
    );
    // The quoted prompt should be truncated (50 chars max inside truncateMessage)
    const quoteMatch = line.match(/"([^"]*)"/);
    expect(quoteMatch).not.toBeNull();
    expect(quoteMatch![1].length).toBeLessThanOrEqual(50);
    expect(quoteMatch![1]).toContain("...");
  });

  test("formats a complete line matching the expected pattern", () => {
    const session = makeSession();
    const line = formatListLine(session, makeMeta());
    // Should match pattern: 8-char-hex  <relative-time>  <N> turns  "prompt"
    // The relative time depends on Date.now() so we just check structure
    expect(line).toMatch(/^[0-9a-f]{8}\s+\S+ ago\s+\d+ turns\s+".*"$/);
  });

  test("handles zero turns gracefully", () => {
    const line = formatListLine(
      makeSession(),
      makeMeta({ turnCount: 0, messages: [] }),
    );
    expect(line).toContain("0 turns");
  });
});
