/**
 * Tests for short session ID resolution in crun --resume
 */

import { describe, test, expect } from "bun:test";
import {
  isSessionIdOrPrefix,
  AmbiguousSessionError,
  resolveSessionPath,
  discoverSessions,
  extractSessionIdFromPath,
} from "../../session/src/finder";

describe("session ID prefix detection", () => {
  test("recognizes full UUID as valid", () => {
    expect(isSessionIdOrPrefix("502de9c7-684a-4724-b592-34aa88aac626")).toBe(true);
  });

  test("recognizes 8-char prefix as valid", () => {
    expect(isSessionIdOrPrefix("502de9c7")).toBe(true);
  });

  test("recognizes 6-char prefix as valid", () => {
    expect(isSessionIdOrPrefix("502de9")).toBe(true);
  });

  test("recognizes 4-char prefix as minimum valid", () => {
    expect(isSessionIdOrPrefix("502d")).toBe(true);
  });

  test("rejects 3-char prefix as too short", () => {
    expect(isSessionIdOrPrefix("502")).toBe(false);
  });

  test("rejects paths", () => {
    expect(isSessionIdOrPrefix("/home/user/.claude/session.jsonl")).toBe(false);
  });
});

describe("resolving short session IDs", () => {
  test("resolves unique short prefix to full path", async () => {
    // Get a real session to test with
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) {
      console.log("Skipping: no sessions available for testing");
      return;
    }

    const targetSession = sessions[0];
    // Use first 8 chars as unique prefix
    const prefix = targetSession.id.slice(0, 8);

    // Check if this prefix is unique
    const matchingCount = sessions.filter(s => s.id.startsWith(prefix)).length;
    if (matchingCount !== 1) {
      console.log("Skipping: prefix not unique enough for test");
      return;
    }

    const resolvedPath = await resolveSessionPath(prefix);
    expect(resolvedPath).toBe(targetSession.path);
  });

  test("throws AmbiguousSessionError with helpful message", () => {
    const matches = [
      { id: "abcd1111-0000-0000-0000-000000000001", path: "/p1", mtime: new Date(), project: "p" },
      { id: "abcd2222-0000-0000-0000-000000000002", path: "/p2", mtime: new Date(), project: "p" },
    ];

    const error = new AmbiguousSessionError("abcd", matches);

    expect(error.message).toContain("abcd");
    expect(error.message).toContain("Did you mean");
    expect(error.message).toContain("abcd1111");
    expect(error.message).toContain("abcd2222");
    expect(error.matches).toHaveLength(2);
    expect(error.prefix).toBe("abcd");
  });

  test("throws not found for invalid prefix", async () => {
    await expect(resolveSessionPath("00000000")).rejects.toThrow(/not found/i);
  });
});

describe("crun with short session ID resolution", () => {
  test("resolves short ID to full UUID when resuming", async () => {
    // Get a real session
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) {
      console.log("Skipping: no sessions available");
      return;
    }

    const targetSession = sessions[0];
    const shortId = targetSession.id.slice(0, 8);

    // Verify we can resolve the short ID to the full session ID
    const resolvedPath = await resolveSessionPath(shortId);
    const fullId = extractSessionIdFromPath(resolvedPath);

    expect(fullId).toBe(targetSession.id);
    expect(fullId.startsWith(shortId)).toBe(true);
  });

  test("resolves 6-char prefix", async () => {
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) {
      console.log("Skipping: no sessions available");
      return;
    }

    const targetSession = sessions[0];
    const shortId = targetSession.id.slice(0, 6);

    // Check if this prefix is unique
    const matchingCount = sessions.filter(s => s.id.startsWith(shortId)).length;
    if (matchingCount !== 1) {
      console.log("Skipping: prefix not unique");
      return;
    }

    const resolvedPath = await resolveSessionPath(shortId);
    const fullId = extractSessionIdFromPath(resolvedPath);

    expect(fullId).toBe(targetSession.id);
  });

  test("full UUID resolves to itself", async () => {
    const sessions = await discoverSessions({ allProjects: true });
    if (sessions.length === 0) {
      console.log("Skipping: no sessions available");
      return;
    }

    const targetSession = sessions[0];

    // Full UUID should resolve to itself
    const resolvedPath = await resolveSessionPath(targetSession.id);
    const fullId = extractSessionIdFromPath(resolvedPath);

    expect(fullId).toBe(targetSession.id);
  });
});
