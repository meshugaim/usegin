/**
 * Tests for session fetch module.
 *
 * Tests both the fetch logic and the result formatting.
 * Uses real local/remote sessions when available, with graceful skips
 * when the test environment doesn't have the expected data.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, statSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fetchSession, formatFetchResult, type FetchResult } from "./fetch";
import { AuthRequiredError, SessionNotFoundError } from "./errors";
import { discoverSessions, getCurrentProjectHash, getClaudeProjectsDir } from "./finder";
import { discoverRemoteSessions } from "./finder/remote";

// =============================================================================
// formatFetchResult
// =============================================================================

describe("formatFetchResult", () => {
  test("formats already-local result", () => {
    const result: FetchResult = {
      sessionId: "159b7095-3f96-4de5-a8a5-7cf445849bd6",
      shortId: "159b7095",
      localPath: "/home/user/.claude/projects/test/159b7095-3f96-4de5-a8a5-7cf445849bd6.jsonl",
      alreadyLocal: true,
      subagentCount: 0,
    };

    const output = formatFetchResult(result);
    expect(output).toContain("already available locally");
    expect(output).toContain(result.localPath);
  });

  test("formats fetched result with sizes", () => {
    const result: FetchResult = {
      sessionId: "159b7095-3f96-4de5-a8a5-7cf445849bd6",
      shortId: "159b7095",
      localPath: "/home/user/.claude/projects/test/159b7095-3f96-4de5-a8a5-7cf445849bd6.jsonl",
      alreadyLocal: false,
      compressedSize: 1024,
      decompressedSize: 10240,
      subagentCount: 0,
    };

    const output = formatFetchResult(result);
    expect(output).toContain("Fetched session 159b7095");
    expect(output).toContain("1.0 KB");
    expect(output).toContain("10.0 KB");
    expect(output).toContain(result.localPath);
    expect(output).not.toContain("subagent");
  });

  test("formats fetched result with subagents (singular)", () => {
    const result: FetchResult = {
      sessionId: "159b7095-3f96-4de5-a8a5-7cf445849bd6",
      shortId: "159b7095",
      localPath: "/home/user/.claude/projects/test/159b7095-3f96-4de5-a8a5-7cf445849bd6.jsonl",
      alreadyLocal: false,
      compressedSize: 512,
      decompressedSize: 5120,
      subagentCount: 1,
    };

    const output = formatFetchResult(result);
    expect(output).toContain("Fetched 1 subagent file");
    expect(output).not.toContain("files"); // singular
  });

  test("formats fetched result with subagents (plural)", () => {
    const result: FetchResult = {
      sessionId: "159b7095-3f96-4de5-a8a5-7cf445849bd6",
      shortId: "159b7095",
      localPath: "/home/user/.claude/projects/test/159b7095-3f96-4de5-a8a5-7cf445849bd6.jsonl",
      alreadyLocal: false,
      compressedSize: 2048,
      decompressedSize: 20480,
      subagentCount: 5,
    };

    const output = formatFetchResult(result);
    expect(output).toContain("Fetched 5 subagent files");
  });

  test("formats byte sizes correctly", () => {
    // Bytes
    const small: FetchResult = {
      sessionId: "abc",
      shortId: "abc",
      localPath: "/tmp/test",
      alreadyLocal: false,
      compressedSize: 500,
      decompressedSize: 900,
      subagentCount: 0,
    };
    expect(formatFetchResult(small)).toContain("500 B");
    expect(formatFetchResult(small)).toContain("900 B");

    // Megabytes
    const large: FetchResult = {
      sessionId: "abc",
      shortId: "abc",
      localPath: "/tmp/test",
      alreadyLocal: false,
      compressedSize: 1024 * 1024 * 2.5,
      decompressedSize: 1024 * 1024 * 15,
      subagentCount: 0,
    };
    expect(formatFetchResult(large)).toContain("2.5 MB");
    expect(formatFetchResult(large)).toContain("15.0 MB");
  });
});

// =============================================================================
// fetchSession - local sessions
// =============================================================================

describe("fetchSession - local sessions", () => {
  test("returns alreadyLocal=true for a session that exists locally", async () => {
    const projectHash = getCurrentProjectHash();
    if (!projectHash) return; // Skip if no project context

    const localSessions = await discoverSessions({ project: projectHash });
    const target = localSessions[0];
    if (!target) return; // Skip if no local sessions

    const result = await fetchSession(target.id);

    expect(result.alreadyLocal).toBe(true);
    expect(result.sessionId).toBe(target.id);
    expect(result.localPath).toBe(target.path);
    expect(result.subagentCount).toBe(0);
  });

  test("returns alreadyLocal=true for a short prefix that matches a local session", async () => {
    const projectHash = getCurrentProjectHash();
    if (!projectHash) return;

    const localSessions = await discoverSessions({ project: projectHash });
    const target = localSessions[0];
    if (!target) return;

    const prefix = target.id.slice(0, 8);
    const result = await fetchSession(prefix);

    expect(result.alreadyLocal).toBe(true);
    expect(result.sessionId).toBe(target.id);
  });

  test("non-existent session + no credentials → AuthRequiredError with effi-auth-login remediation", async () => {
    // Load-bearing contract (ENG-5862 step 7): a fake UUID that doesn't
    // exist locally, in agent-records, or in Supabase must throw a
    // typed error a CLI caller can route on — never a generic Error.
    //
    // Previously this test accepted either `AuthRequiredError` OR
    // `SessionNotFoundError` depending on whether the test environment
    // had credentials. That's two contracts in one assertion — a refactor
    // could break one outcome without the test noticing. We pin to ONE
    // outcome by forcing the "no credentials" environment via
    // `EFFI_CONFIG_DIR` pointing at a freshly-made empty tmp dir:
    // `readCredentials` returns null → `fetchFromSupabase` returns
    // `auth_missing` → `fetchSession` throws `AuthRequiredError` with
    // the `effi auth login` remediation a first-time teammate needs.
    //
    // (The other outcome — authed machine + honest 404 →
    // `SessionNotFoundError` mentioning "any environment" — is covered
    // by `fetch.supabase.test.ts`'s Test 4, which mocks the wire to
    // return `not_found`. Coverage is preserved, contracts are split.)
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const tmpConfigDir = `/tmp/effi-no-creds-${process.pid}-${Date.now()}`;
    mkdirSync(tmpConfigDir, { recursive: true });
    const prevConfigDir = process.env.EFFI_CONFIG_DIR;
    process.env.EFFI_CONFIG_DIR = tmpConfigDir;

    try {
      let caught: unknown;
      try {
        await fetchSession(fakeId);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AuthRequiredError);
      // Not SessionNotFoundError — we never reached the 404 branch
      // because we short-circuit at auth.
      expect(caught).not.toBeInstanceOf(SessionNotFoundError);
      expect((caught as AuthRequiredError).message).toContain("effi auth login");
    } finally {
      if (prevConfigDir === undefined) {
        delete process.env.EFFI_CONFIG_DIR;
      } else {
        process.env.EFFI_CONFIG_DIR = prevConfigDir;
      }
      rmSync(tmpConfigDir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// fetchSession - remote sessions
// =============================================================================

describe("fetchSession - remote sessions", () => {
  let remoteSessions: Awaited<ReturnType<typeof discoverRemoteSessions>>;
  let remoteOnly: typeof remoteSessions[0] | undefined;

  beforeAll(async () => {
    remoteSessions = await discoverRemoteSessions();

    // Find a remote session that does NOT already exist locally (in ANY project).
    // resolveLocal() falls back to searching all projects, so we must check all.
    const allLocalSessions = await discoverSessions({ allProjects: true });
    const localIds = new Set(allLocalSessions.map((s) => s.id));
    remoteOnly = remoteSessions.find((s) => !localIds.has(s.id));
  });

  test("fetches a remote-only session and creates local file", async () => {
    if (!remoteOnly) return; // Skip if no remote-only sessions

    const projectHash = getCurrentProjectHash();
    if (!projectHash) return;

    const localDir = join(getClaudeProjectsDir(), projectHash);
    const expectedLocalPath = join(localDir, `${remoteOnly.id}.jsonl`);

    // Clean up if it exists from a previous test run
    if (existsSync(expectedLocalPath)) {
      rmSync(expectedLocalPath);
    }

    try {
      const result = await fetchSession(remoteOnly.id);

      expect(result.alreadyLocal).toBe(false);
      expect(result.sessionId).toBe(remoteOnly.id);
      expect(result.localPath).toBe(expectedLocalPath);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.decompressedSize).toBeGreaterThan(0);
      expect(result.decompressedSize).toBeGreaterThanOrEqual(result.compressedSize!);
      expect(existsSync(expectedLocalPath)).toBe(true);

      // Verify the file is valid JSONL (first line parses as JSON)
      const content = await Bun.file(expectedLocalPath).text();
      const firstLine = content.split("\n")[0];
      expect(() => JSON.parse(firstLine!)).not.toThrow();

      // Fetching again should now return alreadyLocal=true
      const secondResult = await fetchSession(remoteOnly.id);
      expect(secondResult.alreadyLocal).toBe(true);
    } finally {
      // Clean up: remove the fetched file so we don't pollute local state
      if (existsSync(expectedLocalPath)) {
        rmSync(expectedLocalPath);
      }
      // Also clean up subagent directory if created
      const subagentDir = join(localDir, remoteOnly.id, "subagents");
      if (existsSync(subagentDir)) {
        rmSync(join(localDir, remoteOnly.id), { recursive: true });
      }
    }
  });

  test("fetches subagent files alongside the main session", async () => {
    if (!remoteOnly) return;

    const projectHash = getCurrentProjectHash();
    if (!projectHash) return;

    const localDir = join(getClaudeProjectsDir(), projectHash);
    const expectedLocalPath = join(localDir, `${remoteOnly.id}.jsonl`);

    // Clean up
    if (existsSync(expectedLocalPath)) {
      rmSync(expectedLocalPath);
    }

    try {
      const result = await fetchSession(remoteOnly.id);

      if (result.subagentCount > 0) {
        // Verify subagent directory was created
        const subagentDir = join(localDir, remoteOnly.id, "subagents");
        expect(existsSync(subagentDir)).toBe(true);
      }
      // If subagentCount is 0, just verify the main file was fetched
      expect(existsSync(expectedLocalPath)).toBe(true);
    } finally {
      if (existsSync(expectedLocalPath)) {
        rmSync(expectedLocalPath);
      }
      const subagentDir = join(localDir, remoteOnly.id);
      if (existsSync(subagentDir)) {
        rmSync(subagentDir, { recursive: true });
      }
    }
  });
});
