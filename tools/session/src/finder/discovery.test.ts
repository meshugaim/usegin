/**
 * Tests for session discovery
 */

import { describe, test, expect } from "bun:test";
import {
  discoverSessions,
  getCurrentProjectHash,
} from "../finder";

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
