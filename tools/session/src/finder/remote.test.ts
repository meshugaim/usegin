/**
 * Tests for remote session discovery from ~/agent-records/
 */

import { describe, test, expect } from "bun:test";
import { join } from "path";
import { homedir } from "os";
import {
  AGENT_RECORDS_DIR,
  discoverRemoteSessions,
  findRemoteSessionById,
  findRemoteSessionsByPrefix,
} from "../finder";

// =============================================================================
// CONSTANTS
// =============================================================================

describe("AGENT_RECORDS_DIR", () => {
  test("points to ~/agent-records/", () => {
    expect(AGENT_RECORDS_DIR).toBe(join(homedir(), "agent-records"));
  });
});

// =============================================================================
// discoverRemoteSessions
// =============================================================================

describe("discoverRemoteSessions", () => {
  test("returns an array", async () => {
    const sessions = await discoverRemoteSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test("each session has required fields with correct types", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.path).toMatch(/\.jsonl\.gz$/);
      expect(session.id).toBeTruthy();
      expect(session.mtime).toBeInstanceOf(Date);
      expect(typeof session.project).toBe("string");
      expect(session.source).toBe("remote");
      expect(typeof session.username).toBe("string");
      expect(session.username!.length).toBeGreaterThan(0);
    }
  });

  test("extracts valid UUIDs as session IDs", async () => {
    const sessions = await discoverRemoteSessions();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    for (const session of sessions) {
      expect(session.id).toMatch(uuidRe);
    }
  });

  test("sets source to 'remote' on every session", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.source).toBe("remote");
    }
  });

  test("sets project to empty string", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.project).toBe("");
    }
  });

  test("sorts by mtime descending (most recent first)", async () => {
    const sessions = await discoverRemoteSessions();

    if (sessions.length >= 2) {
      for (let i = 1; i < sessions.length; i++) {
        const prev = sessions[i - 1];
        const curr = sessions[i];
        if (prev && curr) {
          expect(prev.mtime.getTime()).toBeGreaterThanOrEqual(
            curr.mtime.getTime()
          );
        }
      }
    }
  });

  test("excludes subagent files", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.path).not.toContain("/subagents/");
    }
  });

  test("paths are absolute", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.path.startsWith("/")).toBe(true);
    }
  });

  test("paths point to files inside AGENT_RECORDS_DIR", async () => {
    const sessions = await discoverRemoteSessions();

    for (const session of sessions) {
      expect(session.path.startsWith(AGENT_RECORDS_DIR)).toBe(true);
    }
  });
});

// =============================================================================
// discoverRemoteSessions with since filter
// =============================================================================

describe("discoverRemoteSessions with since filter", () => {
  test("filters sessions by date", async () => {
    const allSessions = await discoverRemoteSessions();
    if (allSessions.length === 0) return;

    const recentSessions = await discoverRemoteSessions({ since: "1w" });

    // Recent sessions should be a subset of all (or equal)
    expect(recentSessions.length).toBeLessThanOrEqual(allSessions.length);

    // All returned sessions should be within the time window
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const session of recentSessions) {
      expect(session.mtime.getTime()).toBeGreaterThanOrEqual(
        oneWeekAgo.getTime()
      );
    }
  });
});

// =============================================================================
// findRemoteSessionById
// =============================================================================

describe("findRemoteSessionById", () => {
  test("finds a session that exists", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return; // Skip if no remote sessions

    const result = await findRemoteSessionById(target.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(target.id);
    expect(result!.path).toBe(target.path);
    expect(result!.source).toBe("remote");
  });

  test("returns null for non-existent session ID", async () => {
    const result = await findRemoteSessionById(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(result).toBeNull();
  });

  test("returns SessionInfo with all expected fields", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return;

    const result = await findRemoteSessionById(target.id);

    expect(result).not.toBeNull();
    expect(result!.path).toMatch(/\.jsonl\.gz$/);
    expect(result!.id).toBeTruthy();
    expect(result!.mtime).toBeInstanceOf(Date);
    expect(result!.source).toBe("remote");
    expect(result!.username).toBeTruthy();
  });
});

// =============================================================================
// findRemoteSessionsByPrefix
// =============================================================================

describe("findRemoteSessionsByPrefix", () => {
  test("finds sessions matching a prefix", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return;

    // Use first 8 characters as prefix
    const prefix = target.id.slice(0, 8);
    const matches = await findRemoteSessionsByPrefix(prefix);

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((s) => s.id === target.id)).toBe(true);
  });

  test("returns empty array for non-matching prefix", async () => {
    const matches = await findRemoteSessionsByPrefix("00000000");
    expect(matches).toEqual([]);
  });

  test("returns single match for full ID used as prefix", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return;

    const matches = await findRemoteSessionsByPrefix(target.id);

    expect(matches.length).toBe(1);
    expect(matches[0]!.id).toBe(target.id);
  });

  test("all matches start with the given prefix", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return;

    const prefix = target.id.slice(0, 4);
    const matches = await findRemoteSessionsByPrefix(prefix);

    for (const match of matches) {
      expect(match.id.startsWith(prefix)).toBe(true);
    }
  });
});

// =============================================================================
// Integration: SessionInfo shape compatibility
// =============================================================================

describe("remote SessionInfo compatibility with local shape", () => {
  test("remote sessions have the same core fields as local sessions", async () => {
    const sessions = await discoverRemoteSessions();
    const target = sessions[0];
    if (!target) return;

    // These four fields are required by SessionInfo and used by all formatters
    expect(typeof target.path).toBe("string");
    expect(typeof target.id).toBe("string");
    expect(target.mtime).toBeInstanceOf(Date);
    expect(typeof target.project).toBe("string");

    // These are the new optional fields
    expect(target.source).toBe("remote");
    expect(typeof target.username).toBe("string");
  });
});
