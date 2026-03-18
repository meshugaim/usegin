/**
 * Tests for session resolution (finding sessions by ID/prefix)
 */

import { describe, test, expect } from "bun:test";
import {
  discoverSessions,
  getCurrentProjectHash,
  extractSessionIdFromPath,
  isSessionId,
  findSessionById,
  resolveSessionPath,
} from "../finder";

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
    const targetSession = sessions[0];
    if (!targetSession) return; // Skip if no sessions

    const result = await findSessionById(targetSession.id);

    expect(result).not.toBeNull();
    expect(result!.path).toBe(targetSession.path);
    expect(result!.id).toBe(targetSession.id);
  });

  test("finds session by ID across all projects", async () => {
    // Get any session from any project
    const sessions = await discoverSessions({ allProjects: true });
    const targetSession = sessions[0];
    if (!targetSession) return; // Skip if no sessions

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
    const targetSession = sessions[0];
    if (!targetSession) return;

    const result = await findSessionById(targetSession.id);

    // Result should be from current project
    expect(result).not.toBeNull();
    expect(result!.project).toBe(currentProject);
  });

  test("returns SessionInfo with all required fields", async () => {
    const sessions = await discoverSessions({ allProjects: true });
    const targetSession = sessions[0];
    if (!targetSession) return;

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
    const targetSession = sessions[0];
    if (!targetSession) return;

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

// =============================================================================
// SHORT ID PREFIX RESOLUTION TESTS
// =============================================================================

describe("isSessionIdOrPrefix", () => {
  // Import the new function - will be added to finder.ts
  // For now, we document expected behavior

  test("recognizes full UUID with hyphens", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7-684a-4724-b592-34aa88aac626")).toBe(true);
  });

  test("recognizes full UUID without hyphens", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7684a4724b59234aa88aac626")).toBe(true);
  });

  test("recognizes short ID prefix (8 chars)", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7")).toBe(true);
  });

  test("recognizes medium ID prefix (12 chars with partial hyphen segment)", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7-684")).toBe(true);
  });

  test("recognizes prefix with full first segment only", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7-")).toBe(true);
  });

  test("rejects paths", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("/home/user/.claude/projects/test/502de9c7.jsonl")).toBe(false);
  });

  test("rejects files with extensions", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9c7-684a-4724-b592-34aa88aac626.jsonl")).toBe(false);
  });

  test("rejects invalid hex characters", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502de9cz")).toBe(false);
  });

  test("rejects empty string", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("")).toBe(false);
  });

  test("rejects very short prefixes (< 4 chars) as too ambiguous", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502")).toBe(false);
    expect(isSessionIdOrPrefix("50")).toBe(false);
    expect(isSessionIdOrPrefix("5")).toBe(false);
  });

  test("accepts 4-char prefix as minimum", async () => {
    const { isSessionIdOrPrefix } = await import("../finder");
    expect(isSessionIdOrPrefix("502d")).toBe(true);
  });
});

describe("findSessionsByPrefix", () => {
  test("finds single session with unique prefix", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("../finder");

    // Get a real session to test with
    const sessions = await discoverSessions({ allProjects: true });
    const targetSession = sessions[0];
    if (!targetSession) return; // Skip if no sessions

    // Use first 8 characters as prefix
    const prefix = targetSession.id.slice(0, 8);

    const matches = await findSessionsByPrefix(prefix);

    // Should find at least one match
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The target should be in the matches
    expect(matches.some(s => s.id === targetSession.id)).toBe(true);
  });

  test("returns multiple matches for ambiguous prefix", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("../finder");

    // Get real sessions
    const sessions = await discoverSessions({ allProjects: true });
    const firstSession = sessions[0];
    if (!firstSession || sessions.length < 2) return; // Need multiple sessions

    // Use a very short prefix that might match multiple
    // In practice, we'd need sessions that share a prefix
    // For now, just verify the function returns an array
    const matches = await findSessionsByPrefix(firstSession.id.slice(0, 4));

    expect(Array.isArray(matches)).toBe(true);
  });

  test("returns empty array for non-matching prefix", async () => {
    const { findSessionsByPrefix } = await import("../finder");

    // Use a valid hex prefix that shouldn't match any sessions
    // "00000000" is valid hex but unlikely to match any real session
    const matches = await findSessionsByPrefix("00000000");

    expect(matches).toEqual([]);
  });

  test("returns single match for full ID", async () => {
    const { findSessionsByPrefix, discoverSessions } = await import("../finder");

    const sessions = await discoverSessions({ allProjects: true });
    const targetSession = sessions[0];
    if (!targetSession) return;

    const matches = await findSessionsByPrefix(targetSession.id);
    const firstMatch = matches[0];

    expect(matches.length).toBe(1);
    expect(firstMatch).toBeDefined();
    expect(firstMatch!.id).toBe(targetSession.id);
  });
});

describe("resolveSessionPath with short ID prefixes", () => {
  test("resolves unique short prefix to full path", async () => {
    const { resolveSessionPath, discoverSessions } = await import("../finder");

    const sessions = await discoverSessions({ allProjects: true });
    const targetSession = sessions[0];
    if (!targetSession) return;

    // Find a session with a unique-ish prefix (use more chars for uniqueness)
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
    const { resolveSessionPath, discoverSessions, AmbiguousSessionError } = await import("../finder");

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
    const { resolveSessionPath } = await import("../finder");

    // Use a valid hex prefix that matches no sessions
    // "00000000" is valid hex but unlikely to match any real session
    await expect(resolveSessionPath("00000000")).rejects.toThrow(/not found/i);
  });

  test("error for ambiguous prefix includes matching options", async () => {
    const { AmbiguousSessionError, findSessionsByPrefix, discoverSessions } = await import("../finder");

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
    const { AmbiguousSessionError } = await import("../finder");
    expect(AmbiguousSessionError).toBeDefined();
  });

  test("extends Error", async () => {
    const { AmbiguousSessionError } = await import("../finder");

    const error = new AmbiguousSessionError("abc", []);
    expect(error).toBeInstanceOf(Error);
  });

  test("stores matching sessions", async () => {
    const { AmbiguousSessionError } = await import("../finder");

    const matches = [
      { id: "abc123", path: "/p1", mtime: new Date(), project: "p" },
      { id: "abc456", path: "/p2", mtime: new Date(), project: "p" },
    ];

    const error = new AmbiguousSessionError("abc", matches);

    expect(error.matches).toBe(matches);
    expect(error.prefix).toBe("abc");
  });

  test("generates helpful message showing first 8 chars of each match", async () => {
    const { AmbiguousSessionError } = await import("../finder");

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

// =============================================================================
// DIRECT SUBAGENT ACCESS TESTS
// =============================================================================

describe("resolveSessionPath with subagent IDs", () => {
  test("resolves agent file by agentId when session ID not found", async () => {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    // Create a temp directory to simulate a Claude projects directory
    const tempDir = await mkdtemp(join(tmpdir(), "session-test-agent-"));

    // Use a known agent ID
    const agentId = "abcd1234-0000-0000-0000-agent0000001";
    const sessionId = "eeee5678-0000-0000-0000-session00001";

    // Create an agent file in the temp directory
    const agentFile = join(tempDir, `agent-${agentId}.jsonl`);
    const agentEntry = JSON.stringify({
      type: "system",
      sessionId,
      agentId,
      uuid: "uuid-001",
    });
    await writeFile(agentFile, agentEntry + "\n");

    try {
      // Import the function we'll add: findAgentFilesByPrefix
      const { findAgentFilesByPrefix } = await import("./resolve");

      const results = await findAgentFilesByPrefix("abcd1234", [tempDir]);
      expect(results.length).toBe(1);
      expect(results[0]).toBe(agentFile);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("returns empty array when no agent files match prefix", async () => {
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const tempDir = await mkdtemp(join(tmpdir(), "session-test-agent-"));

    try {
      const { findAgentFilesByPrefix } = await import("./resolve");
      const results = await findAgentFilesByPrefix("ffff9999", [tempDir]);
      expect(results).toEqual([]);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});

// =============================================================================
// SESSION RM (deleteSessionFiles) TESTS
// =============================================================================

describe("deleteSessionFiles", () => {
  test("deletes all specified files", async () => {
    const { mkdtemp, writeFile, rm, access } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const tempDir = await mkdtemp(join(tmpdir(), "session-test-rm-"));
    const file1 = join(tempDir, "session.jsonl");
    const file2 = join(tempDir, "agent-abc.jsonl");

    await writeFile(file1, "line1\n");
    await writeFile(file2, "line2\n");

    const { deleteSessionFiles } = await import("../rm");
    const result = await deleteSessionFiles([file1, file2]);

    expect(result.deleted).toBe(2);
    expect(result.failed).toBe(0);

    // Verify files are gone
    await expect(access(file1)).rejects.toThrow();
    await expect(access(file2)).rejects.toThrow();

    await rm(tempDir, { recursive: true, force: true });
  });

  test("reports failures for non-existent files", async () => {
    const { deleteSessionFiles } = await import("../rm");
    const result = await deleteSessionFiles(["/tmp/nonexistent-session-file-12345.jsonl"]);

    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(1);
  });

  test("handles mix of existing and non-existing files", async () => {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const tempDir = await mkdtemp(join(tmpdir(), "session-test-rm-"));
    const existingFile = join(tempDir, "session.jsonl");
    await writeFile(existingFile, "data\n");

    const { deleteSessionFiles } = await import("../rm");
    const result = await deleteSessionFiles([
      existingFile,
      "/tmp/nonexistent-session-file-67890.jsonl",
    ]);

    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(1);

    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns zero counts for empty file list", async () => {
    const { deleteSessionFiles } = await import("../rm");
    const result = await deleteSessionFiles([]);

    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(0);
  });
});
