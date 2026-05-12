/**
 * Tests for the cross-environment Supabase fallback in `fetchSession`
 * (ENG-5862 step 7, AC 34).
 *
 * These tests pin the **fallback-chain contract** for `session resume <id>`:
 *
 *   1. Local hit (`~/.claude/projects/`)   → no Supabase call.
 *   2. agent-records hit (`~/agent-records/`) → no Supabase call.
 *   3. Both miss → call `fetchFromSupabase`, translate the result.
 *
 * The actual HTTP wire (signed-URL GET, credentials read, decompress)
 * lives behind `./supabase-fetch`. The Red phase stubs that module's
 * one export to throw "Not implemented (ENG-5862 step 7 Red)". Green
 * replaces the body with a real four-step implementation:
 *   1. `readCredentials()` from `tools/lib/auth/credentials` → Bearer + api_url.
 *   2. `GET {api_url}/api/v1/dev-sessions/{sessionId}` → `{ session, signed_url }`.
 *   3. `GET <signed_url>` → gzipped JSONL bytes.
 *   4. Decompress and write to `~/.claude/projects/<project-hash>/<sessionId>.jsonl`.
 *
 * Red-phase shape (`.claude/skills/tdd-ci`):
 *   - Tests #1 and #2 land as plain `test`. They pin **existing** behavior
 *     (the order of the fallback chain) — they pass today and must keep
 *     passing after Green. Treating them as `.failing` would be wrong:
 *     the Green commit shouldn't have to remove a mark on a regression
 *     pin. We use `spyOn` to count calls into the real (stubbed) module
 *     without replacing it — the local/remote branches short-circuit
 *     before the stub is touched, so it doesn't matter that the stub
 *     would throw if called.
 *   - Tests #3-#5 land as `test.failing`. They drive `fetchSession` past
 *     local + agent-records (both mocked to miss) into the third branch.
 *     The real stub throws "Not implemented (ENG-5862 step 7 Red)" —
 *     which bubbles up as a plain `Error` whose message contains
 *     "Not implemented", failing the structured assertions (`source
 *     === "supabase"`, `instanceof SessionNotFoundError`, contains
 *     "effi auth login"). Right-reason Red.
 *
 * Mock hygiene: we use `mock.module` to swap `./finder` only. Each test
 * installs its own finder mock at entry, so the last installer wins —
 * no per-test cleanup is needed (and per repo policy, the explicit
 * reset call is disallowed in test files anyway).
 *
 * Linear: ENG-5862
 */

import { describe, test, expect, mock, spyOn, afterAll } from "bun:test";

import type { SessionInfo } from "./finder/types";
import { SessionNotFoundError } from "./errors";
import * as supabaseFetchModule from "./supabase-fetch";
import * as RealFinder from "./finder";

// Snapshot the real `./finder` exports so we can re-install them after
// the test file finishes. `mock.module` is process-global — once we
// swap `./finder` in `mockFinder()`, subsequent test files (e.g.
// `bash.test.ts`) that import from `../finder` would see our skeleton
// shape and explode with `Export named 'discoverSessions' not found`.
// Re-installing the real namespace in `afterAll` keeps the rest of the
// suite green. The repo's per-test-cleanup policy doesn't apply here:
// a file-scope re-install via `mock.module` with the real exports is
// the canonical workaround for the global-scope leak.
const REAL_FINDER_EXPORTS = { ...RealFinder };

afterAll(() => {
  mock.module("./finder", () => REAL_FINDER_EXPORTS);
});

// =============================================================================
// Fixtures
// =============================================================================

const FULL_UUID = "11111111-2222-3333-4444-555555555555";

function makeLocalSessionInfo(id: string): SessionInfo {
  return {
    path: `/tmp/fake-local/projects/x/${id}.jsonl`,
    id,
    mtime: new Date("2026-01-01T00:00:00Z"),
    project: "x",
    source: "local",
  };
}

function makeRemoteSessionInfo(id: string): SessionInfo {
  return {
    path: `/tmp/fake-agent-records/user/2026-01/2026-01-01/000000-conversation-${id}.jsonl.gz`,
    id,
    mtime: new Date("2026-01-01T00:00:00Z"),
    project: "x",
    source: "remote",
    username: "user",
  };
}

// =============================================================================
// Finder mocking helper
// =============================================================================
//
// `mock.module` replaces a module's exports for **all** subsequent
// `import()` calls in the test process. We re-install at the entry of
// every test to keep each scenario isolated — last installer wins.
// Lazy imports of `./fetch` inside each test ensure it picks up the
// freshly installed finder mock rather than a version captured by a
// top-level import.

interface FinderOverrides {
  local?: SessionInfo | null;
  remote?: SessionInfo | null;
}

function mockFinder(overrides: FinderOverrides) {
  // We override the four exports `fetch.ts` calls into. Everything else
  // is preserved by re-implementing the predicates locally (they're
  // pure and tiny) and pinning the dir helpers to a stable fake so the
  // not-found branch's error message is deterministic.
  const local = overrides.local ?? null;
  const remote = overrides.remote ?? null;

  mock.module("./finder", () => ({
    findSessionById: mock(async () => local),
    findSessionsByPrefix: mock(async () => (local ? [local] : [])),
    findRemoteSessionById: mock(async () => remote),
    findRemoteSessionsByPrefix: mock(async () => (remote ? [remote] : [])),

    isSessionId: (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
    isSessionIdOrPrefix: (s: string) => /^[0-9a-f-]+$/i.test(s),

    getCurrentProjectHash: () => "-workspaces-test-mvp",
    getClaudeProjectsDir: () => "/tmp/fake-local/projects",
  }));
}

// =============================================================================
// Tests
// =============================================================================

describe("ENG-5862 step 7 — cross-env fallback (AC 34)", () => {
  // ===========================================================================
  // Test 1 — Local hit short-circuits the chain (regression pin)
  // ===========================================================================

  test("local hit → no Supabase call", async () => {
    mockFinder({ local: makeLocalSessionInfo(FULL_UUID) });
    const supabaseSpy = spyOn(supabaseFetchModule, "fetchFromSupabase");

    const { fetchSession } = await import("./fetch");
    const result = await fetchSession(FULL_UUID);

    expect(result.alreadyLocal).toBe(true);
    expect(result.sessionId).toBe(FULL_UUID);
    expect(result.source).toBe("local");
    // The contract: fallback ORDER. If the chain ever reaches Supabase
    // for a session that's already local, we've regressed the cheap
    // path and the test name tells the next reader why we care.
    expect(supabaseSpy.mock.calls.length).toBe(0);
  });

  // ===========================================================================
  // Test 2 — agent-records hit short-circuits Supabase (regression pin)
  // ===========================================================================

  test("agent-records hit → no Supabase call", async () => {
    mockFinder({
      local: null,
      remote: makeRemoteSessionInfo(FULL_UUID),
    });
    const supabaseSpy = spyOn(supabaseFetchModule, "fetchFromSupabase");

    const { fetchSession } = await import("./fetch");

    // The real `decompressAndWrite` would try to read the fake remote
    // path and explode. That's fine for THIS test's purpose — we only
    // care that we got far enough to confirm the Supabase branch was
    // skipped. Catch the eventual decompress error and assert on the
    // spy directly.
    try {
      await fetchSession(FULL_UUID);
    } catch {
      // Expected: the fake remote path doesn't exist on disk. The
      // agent-records branch was reached (which is what we're pinning);
      // the read just can't complete in a fixture-free test.
    }

    expect(supabaseSpy.mock.calls.length).toBe(0);
  });

  // ===========================================================================
  // Test 3 — Both miss + Supabase success → JSONL lands locally
  // ===========================================================================

  test.failing(
    "ENG-5862: both miss + Supabase 200 → writes JSONL to local projects dir",
    async () => {
      mockFinder({ local: null, remote: null });

      const fakeLocalPath = `/tmp/fake-local/projects/-workspaces-test-mvp/${FULL_UUID}.jsonl`;

      const { fetchSession } = await import("./fetch");
      const result = await fetchSession(FULL_UUID);

      // Red: the real stub throws "Not implemented (ENG-5862 step 7
      // Red)" before the chain can produce a result. Green replaces
      // the stub with a real fetch that returns an ok:true
      // SupabaseFetchResult; `fetchSession` already knows how to
      // shape that into a FetchResult with source: "supabase".
      expect(result.alreadyLocal).toBe(false);
      expect(result.sessionId).toBe(FULL_UUID);
      expect(result.localPath).toBe(fakeLocalPath);
      expect(result.source).toBe("supabase");
    },
  );

  // ===========================================================================
  // Test 4 — Both miss + Supabase 404 → SessionNotFoundError naming the id
  // ===========================================================================

  test.failing(
    "ENG-5862: both miss + Supabase 404 → SessionNotFoundError names session_id",
    async () => {
      mockFinder({ local: null, remote: null });

      const { fetchSession } = await import("./fetch");

      let caught: unknown;
      try {
        await fetchSession(FULL_UUID);
      } catch (err) {
        caught = err;
      }

      // Red: stub throws a plain `Error("Not implemented ...")` — NOT
      // a SessionNotFoundError — so the instanceof check fails. Green
      // makes the stub return `{ok:false, error:{kind:"not_found"}}`,
      // which `translateSupabaseError` maps to a SessionNotFoundError
      // whose message names the session_id and notes the cross-env
      // search scope.
      expect(caught).toBeInstanceOf(SessionNotFoundError);
      const message = (caught as Error).message;
      // Two anchors: the session_id itself (so the user can copy it
      // into a bug report) and "not found" prose that names the
      // cross-environment scope. The exact phrasing is locked here so
      // refactors can't quietly drop the "in any environment" signal.
      expect(message).toContain(FULL_UUID);
      expect(message.toLowerCase()).toContain("not found");
      // The "any environment" phrasing is what distinguishes the
      // cross-env path from the legacy local-only "Session not found"
      // error. Without this anchor, test #4 would accidentally pass
      // against the old error too (which also names the session_id
      // and says "not found").
      expect(message.toLowerCase()).toContain("any environment");
    },
  );

  // ===========================================================================
  // Test 5 — Both miss + missing/expired auth → "effi auth login" hint
  // ===========================================================================

  test.failing(
    "ENG-5862: missing credentials → error directs to `effi auth login`",
    async () => {
      mockFinder({ local: null, remote: null });

      const { fetchSession } = await import("./fetch");

      let caught: unknown;
      try {
        await fetchSession(FULL_UUID);
      } catch (err) {
        caught = err;
      }

      // Red: stub throws "Not implemented ..." — message doesn't
      // contain "effi auth login". Green makes the stub detect a
      // missing credentials file and return
      // `{ok:false, error:{kind:"auth_missing"}}`, which the
      // translator maps to an error directing the user to log in.
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("effi auth login");
    },
  );

  test.failing(
    "ENG-5862: 401 from server → error mentions auth + directs to `effi auth login`",
    async () => {
      mockFinder({ local: null, remote: null });

      const { fetchSession } = await import("./fetch");

      let caught: unknown;
      try {
        await fetchSession(FULL_UUID);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      // Distinct from auth_missing: this user HAS credentials, they
      // just don't work. The hint is the same (`effi auth login`),
      // but the prefix should make clear it's a refresh, not a setup.
      expect(message.toLowerCase()).toMatch(/auth/);
      expect(message).toContain("effi auth login");
    },
  );
});
