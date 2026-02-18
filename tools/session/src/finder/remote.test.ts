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
  mergeSessionLists,
  type SessionInfo,
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
// mergeSessionLists
// =============================================================================

describe("mergeSessionLists", () => {
  function makeLocal(id: string, mtimeMs: number): SessionInfo {
    return {
      path: `/home/user/.claude/projects/foo/${id}.jsonl`,
      id,
      mtime: new Date(mtimeMs),
      project: "foo",
      source: "local",
    };
  }

  function makeRemote(id: string, mtimeMs: number): SessionInfo {
    return {
      path: `/home/user/agent-records/user/2026-02/2026-02-18/120000-conversation-${id}.jsonl.gz`,
      id,
      mtime: new Date(mtimeMs),
      project: "",
      source: "remote",
      username: "user",
    };
  }

  test("returns local sessions when no remote sessions exist", () => {
    const local = [makeLocal("aaa", 3000), makeLocal("bbb", 2000)];
    const result = mergeSessionLists(local, []);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("aaa");
    expect(result[1]!.id).toBe("bbb");
  });

  test("returns remote sessions when no local sessions exist", () => {
    const remote = [makeRemote("ccc", 3000), makeRemote("ddd", 2000)];
    const result = mergeSessionLists([], remote);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("ccc");
    expect(result[1]!.id).toBe("ddd");
  });

  test("deduplicates by ID, keeping local version", () => {
    const local = [makeLocal("aaa", 1000)];
    const remote = [makeRemote("aaa", 5000)]; // Same ID, newer mtime

    const result = mergeSessionLists(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("aaa");
    expect(result[0]!.source).toBe("local"); // Local wins
    expect(result[0]!.path).toContain(".jsonl"); // Local path, not .jsonl.gz
  });

  test("includes remote sessions not present locally", () => {
    const local = [makeLocal("aaa", 3000)];
    const remote = [makeRemote("bbb", 2000)];

    const result = mergeSessionLists(local, remote);
    expect(result).toHaveLength(2);
    expect(result.some(s => s.id === "aaa")).toBe(true);
    expect(result.some(s => s.id === "bbb")).toBe(true);
  });

  test("sorts merged results by mtime descending", () => {
    const local = [makeLocal("aaa", 1000)];
    const remote = [makeRemote("bbb", 5000), makeRemote("ccc", 3000)];

    const result = mergeSessionLists(local, remote);
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe("bbb"); // 5000
    expect(result[1]!.id).toBe("ccc"); // 3000
    expect(result[2]!.id).toBe("aaa"); // 1000
  });

  test("handles multiple duplicates correctly", () => {
    const local = [
      makeLocal("aaa", 3000),
      makeLocal("bbb", 1000),
    ];
    const remote = [
      makeRemote("aaa", 5000), // Duplicate
      makeRemote("bbb", 4000), // Duplicate
      makeRemote("ccc", 2000), // Unique
    ];

    const result = mergeSessionLists(local, remote);
    expect(result).toHaveLength(3);

    // All three IDs present
    const ids = result.map(s => s.id);
    expect(ids).toContain("aaa");
    expect(ids).toContain("bbb");
    expect(ids).toContain("ccc");

    // Duplicates are local versions
    const aaaSrc = result.find(s => s.id === "aaa")!.source;
    expect(aaaSrc).toBe("local");
    const bbbSrc = result.find(s => s.id === "bbb")!.source;
    expect(bbbSrc).toBe("local");
    // Unique remote stays remote
    const cccSrc = result.find(s => s.id === "ccc")!.source;
    expect(cccSrc).toBe("remote");
  });

  test("returns empty array when both inputs are empty", () => {
    const result = mergeSessionLists([], []);
    expect(result).toHaveLength(0);
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
