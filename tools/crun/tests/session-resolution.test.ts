/**
 * Tests for short session ID resolution in crun --resume
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";

// Test fixtures
const TEST_SESSION_ID = "test-1234-5678-abcd-ef0123456789";
const TEST_INVOCATION_ID = "test-inv1";
const TEST_LOG_DIR = join(tmpdir(), "crun-session-test-logs");
const TEST_WORKFLOWS_DIR = join(tmpdir(), "crun-session-test-workflows");
const TEST_PRESETS_DIR = join(tmpdir(), "crun-session-test-presets");
const TEST_INVOCATIONS_PATH = join(tmpdir(), "crun-session-test-invocations", "invocations.jsonl");

// Import the session resolution function from session tool
import {
  isSessionIdOrPrefix,
  AmbiguousSessionError,
  resolveSessionPath,
  discoverSessions,
  extractSessionIdFromPath,
} from "../../session/src/finder";

// Import run deps for testing
import { type RunDeps, type RunOptions, run } from "../src/run";

/**
 * Create mock deps with spawnClaude mocked
 */
function createMockDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  return {
    generateSessionId: mock(() => Promise.resolve(TEST_SESSION_ID)),
    generateInvocationId: mock(() => TEST_INVOCATION_ID),
    spawnClaude: mock(() =>
      Promise.resolve({
        exitCode: 0,
        stdout: "Claude output here",
        stderr: "",
      })
    ),
    logDir: TEST_LOG_DIR,
    claudeCommand: ["echo"],
    workflowsDir: TEST_WORKFLOWS_DIR,
    userPresetsDir: TEST_PRESETS_DIR,
    invocationsPath: TEST_INVOCATIONS_PATH,
    ...overrides,
  };
}

beforeEach(async () => {
  await rm(TEST_LOG_DIR, { recursive: true, force: true });
  await rm(TEST_WORKFLOWS_DIR, { recursive: true, force: true });
  await rm(TEST_PRESETS_DIR, { recursive: true, force: true });
  await rm(join(tmpdir(), "crun-session-test-invocations"), { recursive: true, force: true });
  await mkdir(TEST_LOG_DIR, { recursive: true });
  await mkdir(TEST_WORKFLOWS_DIR, { recursive: true });
  await mkdir(TEST_PRESETS_DIR, { recursive: true });
});

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
