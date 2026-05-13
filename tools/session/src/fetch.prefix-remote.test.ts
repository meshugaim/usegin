/**
 * Tests for `fetchSession` resolving a session by 8-char prefix when the
 * session lives only on the dev_sessions API (cross-environment, not yet
 * downloaded locally and not in `~/agent-records/`).
 *
 * Bug context (ENG-5986):
 *
 *   $ session list --remote --since 30d
 *   [R] 7c99a7ed   1d ago    51 turns  "how do i auth..."
 *
 *   $ session resume 7c99a7ed
 *   Error: Session not found: 7c99a7ed
 *   Searched: ~/.claude/projects/-workspaces-test-mvp/ and ~/agent-records/
 *
 *   $ session resume 7c99a7ed-e185-435c-b888-dac13dd1aad1   # full UUID
 *   Fetched session 7c99a7ed (...) → resume proceeds
 *
 * The prefix branch in `fetch.ts` short-circuits to `SessionNotFoundError`
 * BEFORE consulting the dev_sessions API. The full-UUID branch reaches the
 * API via the Supabase fallback and succeeds. From the user's point of
 * view: `session list` shows it, `session resume <prefix>` can't find it.
 *
 * This file pins the contract for the fix:
 *
 *   1. Local miss + agent-records miss + prefix matches exactly one remote
 *      session via the API → `fetchSession` resolves to the full UUID and
 *      returns a `FetchResult` whose `source === "supabase"`.
 *   2. All three sources miss → `SessionNotFoundError` whose message names
 *      the prefix (so the user knows what we searched for).
 *   3. Prefix matches multiple remote sessions → `AmbiguousSessionError`
 *      (the class the codebase already uses for this case in
 *      `resolveRemote`'s agent-records branch — mirroring that semantic
 *      keeps the CLI's error-class contract uniform across the prefix
 *      lookup sources).
 *   4. Full-UUID input still resolves via the existing cross-env path
 *      (regression net — the fix must not break the full-UUID flow).
 *
 * Design observations Wes-Green will need to pick:
 *
 *   A. Lookup order. Today: local → agent-records → Supabase (full UUID
 *      only). Green can either:
 *        - thread a fourth source (API prefix lookup) AFTER agent-records'
 *          prefix path misses, or
 *        - replace `resolveRemote`'s prefix path entirely with an API
 *          prefix lookup (agent-records still serves full-UUID lookups).
 *      These tests pin the OUTCOME (prefix matching a remote-only session
 *      resolves), not the mechanism. Test 1 stubs the API prefix lookup
 *      at `./supabase-fetch` (the same boundary the full-UUID path uses);
 *      whichever mechanism Green picks, the call-site shape it commits to
 *      must satisfy this test's stubbing surface.
 *
 *   B. API param. `GET /api/v1/dev-sessions` today has no
 *      `session_id_prefix` query param. The companion API-level tests
 *      (`list-prefix-filter.test.ts`) pin a new `?session_id_prefix=<hex>`
 *      shape. The CLI side surfaces "use case 1 happened" via the same
 *      stub seam that already exists for the full-UUID Supabase fallback,
 *      so this test file doesn't second-guess the wire — Green decides
 *      whether to extend `fetchFromSupabase` or add a new finder.
 *
 *   C. Ambiguous-prefix error class. The codebase already throws
 *      `AmbiguousSessionError` from `resolveRemote`'s agent-records prefix
 *      branch (`fetch.ts` line 127-128); the original charter prose said
 *      "SessionNotFoundError with a helpful message" but the
 *      lowest-redo-cost default is to mirror the existing class so callers
 *      and `cli.ts` keep a uniform `instanceof AmbiguousSessionError`
 *      path. Pinned here; flip to SessionNotFoundError in Green if the
 *      product wants a different shape (one-word flip).
 *
 * Mocking strategy mirrors `fetch.supabase.test.ts` — `mock.module` swaps
 * `./finder` and `./supabase-fetch` per test; lazy `await import("./fetch")`
 * each test picks up freshly installed mocks. The `afterAll` re-installs
 * the real namespaces so subsequent test files don't see our skeletons.
 *
 * Part of: ENG-5986
 */

import { afterAll, describe, expect, mock, test } from "bun:test";
import type { SessionInfo } from "./finder/types";
import { AmbiguousSessionError } from "./finder/types";
import { SessionNotFoundError } from "./errors";
import * as supabaseFetchModule from "./supabase-fetch";
import * as RealFinder from "./finder";
import type { SupabaseFetchResult } from "./supabase-fetch";

// =============================================================================
// Test-file scoped module re-install — see fetch.supabase.test.ts header
// for the rationale.
// =============================================================================

const REAL_FINDER_EXPORTS = { ...RealFinder };
const REAL_SUPABASE_FETCH_EXPORTS = { ...supabaseFetchModule };

afterAll(() => {
  mock.module("./finder", () => REAL_FINDER_EXPORTS);
  mock.module("./supabase-fetch", () => REAL_SUPABASE_FETCH_EXPORTS);
});

// =============================================================================
// Fixtures
// =============================================================================

const FULL_UUID = "7c99a7ed-e185-435c-b888-dac13dd1aad1";
const PREFIX_8 = FULL_UUID.slice(0, 8); // "7c99a7ed"

// A second UUID sharing the same 8-char prefix is impossible (the prefix IS
// the first 8 chars of one UUID), so for the ambiguous test we use a 7-char
// prefix that two distinct fixture UUIDs share. `isSessionIdOrPrefix`
// accepts ≥4-char prefixes (see `finder/resolve.ts:64`).
const AMBIGUOUS_PREFIX = "7c99a7e";
const AMBIGUOUS_UUID_A = "7c99a7e1-aaaa-bbbb-cccc-111111111111";
const AMBIGUOUS_UUID_B = "7c99a7e2-aaaa-bbbb-cccc-222222222222";

// =============================================================================
// Module mocking helpers (same shape as fetch.supabase.test.ts)
// =============================================================================

interface FinderOverrides {
  local?: SessionInfo | null;
  remote?: SessionInfo | null;
  /** When non-null, `findRemoteSessionsByPrefix` returns this list (covers
   * the ambiguous-prefix-in-agent-records branch the existing
   * `resolveRemote` already handles). Independent of `remote` so tests can
   * pin both a single-match and a no-match agent-records state. */
  remotePrefixMatches?: SessionInfo[];
  projectHash?: string | null;
  claudeProjectsDir?: string;
}

function mockFinder(overrides: FinderOverrides) {
  const local = overrides.local ?? null;
  const remote = overrides.remote ?? null;
  const remotePrefixMatches =
    overrides.remotePrefixMatches ?? (remote ? [remote] : []);
  const projectHash =
    overrides.projectHash === undefined
      ? "-workspaces-test-mvp"
      : overrides.projectHash;
  const claudeProjectsDir =
    overrides.claudeProjectsDir ?? "/tmp/fake-local/projects";

  mock.module("./finder", () => ({
    findSessionById: mock(async () => local),
    findSessionsByPrefix: mock(async () => (local ? [local] : [])),
    findRemoteSessionById: mock(async () => remote),
    findRemoteSessionsByPrefix: mock(async () => remotePrefixMatches),

    isSessionId: (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
    isSessionIdOrPrefix: (s: string) => {
      if (!s || s.length < 4) return false;
      if (s.includes("/") || s.includes(".")) return false;
      return /^[0-9a-f]+(-[0-9a-f]*)*$/i.test(s);
    },

    getCurrentProjectHash: () => projectHash,
    getClaudeProjectsDir: () => claudeProjectsDir,
  }));
}

function mockSupabaseFetch(result: SupabaseFetchResult) {
  mock.module("./supabase-fetch", () => ({
    fetchFromSupabase: mock(async () => result),
  }));
}

/**
 * Variant: drive `fetchFromSupabase` with a function so the test can branch
 * on what the production code passed in (full UUID vs. prefix). This is how
 * test 1 pins "Green resolved the prefix to a full UUID before downloading"
 * without committing to a specific mechanism — `fetchFromSupabase` is the
 * point at which the bytes hit the wire, so whatever resolution Green
 * inserts upstream is observable here.
 */
function mockSupabaseFetchFn(
  fn: (input: string) => Promise<SupabaseFetchResult>,
) {
  mock.module("./supabase-fetch", () => ({
    fetchFromSupabase: mock(fn),
  }));
}

// =============================================================================
// Tests
// =============================================================================

describe("ENG-5986 — session resume <prefix> falls back to remote API", () => {
  // ===========================================================================
  // Test 1 — Prefix that matches a remote-only session resolves end-to-end
  // ===========================================================================
  //
  // The headline bug: `session resume 7c99a7ed` for a session that exists
  // only in dev_sessions (not local, not in agent-records) currently throws
  // `SessionNotFoundError` because `fetch.ts` line 237's `!isSessionId(input)`
  // branch returns before consulting the API.
  //
  // The contract: Green resolves the prefix to a full UUID, downloads
  // bytes, and returns a `FetchResult` whose `source === "supabase"`. The
  // mechanism (new API param vs. list-with-filter, threaded into a new
  // finder vs. extending `fetchFromSupabase`) is Green's call — this test
  // pins only the outcome and the resolved-id observability via the
  // `fetchFromSupabase` stub seam.

  test.failing(
    "ENG-5986: prefix resolves to remote-only session → FetchResult.sessionId is full UUID",
    async () => {
      mockFinder({
        local: null,
        remote: null,
        remotePrefixMatches: [],
      });

      // Drive the wire-level seam with a function so the test can observe
      // what input the production code passed in. Two valid Green
      // mechanisms exist (see header note A); both must converge on the
      // same OUTCOME: the FetchResult carries the FULL UUID for the
      // prefix the user typed.
      //
      // Mechanism path 1 (extend `fetchFromSupabase`): Green teaches the
      // wire to accept either a prefix or a full id, server resolves,
      // returns bytes. In this case `fetchFromSupabase` is called with
      // the prefix and the returned `localPath` reflects the resolved id.
      //
      // Mechanism path 2 (separate finder, then existing wire): Green
      // adds a new `resolveRemoteByApi(prefix)`-shaped step that yields
      // a full UUID, then re-enters the existing full-UUID path.
      // `fetchFromSupabase` is called with the resolved UUID.
      //
      // The stub accepts either input shape and returns a result whose
      // `localPath` is keyed on the full UUID — that's the load-bearing
      // observable. The asserted outcome (`result.sessionId === FULL_UUID`)
      // is what the user actually sees and is the only contract worth
      // pinning at this layer.
      const fakeLocalPath = `/tmp/fake-local/projects/-workspaces-test-mvp/${FULL_UUID}.jsonl`;
      mockSupabaseFetchFn(async () => ({
        ok: true,
        localPath: fakeLocalPath,
        compressedSize: 100,
        decompressedSize: 500,
        subagentCount: 0,
      }));

      const { fetchSession } = await import("./fetch");
      const result = await fetchSession(PREFIX_8);

      // The headline contract. `fetchSession("7c99a7ed")` must end up
      // with the full UUID on the result — without this, the CLI's
      // `claude --resume <id>` follow-up call would get a partial id
      // and fail.
      expect(result.sessionId).toBe(FULL_UUID);
      expect(result.localPath).toBe(fakeLocalPath);
      expect(result.alreadyLocal).toBe(false);
      // Source is "supabase" iff Green keeps the existing wire; if Green
      // adds a new source label, this assertion documents the expectation
      // and Green flips the label here. Either way the result is NOT
      // sourced from `local` or `agent-records`.
      expect(result.source).toBe("supabase");
    },
  );

  // ===========================================================================
  // Test 2 — Prefix matches nothing anywhere → SessionNotFoundError
  // ===========================================================================
  //
  // Regression-net + new behavior: today this case throws the legacy
  // "Session not found: <prefix>" without touching the API. After Green,
  // the API IS consulted and returns no matches; the error must still
  // surface as `SessionNotFoundError` and the message must include the
  // prefix the user typed (so they can paste it into a bug report) and
  // distinguish "we already checked the remote API" from the legacy
  // local-only error.

  // Regression net (plain `test()`): the current production code already
  // throws `SessionNotFoundError` containing the prefix on this path
  // (fetch.ts:239 with `searchedLocation` set). Marked plain rather than
  // `.failing` because it passes today AND must keep passing through
  // Green — a Green that widens the message (e.g., to mention the API)
  // is fine as long as `not found` and the prefix both still appear.
  test(
    "ENG-5986 regression net: prefix with no matches anywhere → SessionNotFoundError mentioning the prefix",
    async () => {
      mockFinder({
        local: null,
        remote: null,
        remotePrefixMatches: [],
      });
      // Even if Green calls into `fetchFromSupabase`, a no-match result
      // (or a no-call result) must end up at the same error class. The
      // not_found stub covers the "Green wired through Supabase and the
      // server said nope" path; if Green wires a prefix-list endpoint
      // that returns []  before reaching `fetchFromSupabase`, the error
      // class is still pinned here.
      mockSupabaseFetch({ ok: false, error: { kind: "not_found" } });

      const { fetchSession } = await import("./fetch");

      let caught: unknown;
      try {
        await fetchSession(PREFIX_8);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(SessionNotFoundError);
      const message = (caught as Error).message;
      expect(message).toContain(PREFIX_8);
      expect(message.toLowerCase()).toContain("not found");
    },
  );

  // ===========================================================================
  // Test 3 — Prefix matches multiple remote sessions → AmbiguousSessionError
  // ===========================================================================
  //
  // When the API prefix lookup returns 2+ sessions, the CLI must not
  // silently pick the first one (a deterministic "first" by mtime could
  // resume the wrong session and the user would never know). It must
  // throw with both candidate IDs in the message so the user can pick
  // the full UUID.
  //
  // We pin `AmbiguousSessionError` — the class `resolveRemote` already
  // throws from `fetch.ts:127-128` for the same situation in
  // agent-records. Mirroring the class keeps the CLI's instanceof
  // routing uniform. If product wants a separate `RemoteAmbiguous*`
  // error or a re-shape onto `SessionNotFoundError`, that's a one-word
  // flip in Green.

  // Regression net (plain `test()`): the existing `resolveRemote`'s
  // agent-records branch already throws `AmbiguousSessionError` with
  // both candidate short-ids in the message. This test pins that
  // contract so a Green that adds a parallel API prefix lookup uses
  // the SAME error class — i.e., callers can keep their single
  // `instanceof AmbiguousSessionError` route regardless of which
  // source produced the ambiguity.
  test(
    "ENG-5986 regression net: ambiguous prefix from remote (agent-records) → AmbiguousSessionError lists matches",
    async () => {
      const matchA = {
        path: `/fake/agent-records/${AMBIGUOUS_UUID_A}.jsonl.gz`,
        id: AMBIGUOUS_UUID_A,
        mtime: new Date("2026-05-12T00:00:00Z"),
        project: "x",
        source: "remote" as const,
        username: "user",
      };
      const matchB = {
        path: `/fake/agent-records/${AMBIGUOUS_UUID_B}.jsonl.gz`,
        id: AMBIGUOUS_UUID_B,
        mtime: new Date("2026-05-13T00:00:00Z"),
        project: "x",
        source: "remote" as const,
        username: "user",
      };

      // Today the existing `findRemoteSessionsByPrefix` (agent-records
      // backed) is the only finder that returns multi-match. After
      // Green, the API prefix lookup is another source of multi-match
      // signal. To keep this test mechanism-agnostic, we drive the
      // existing finder seam — if Green adds a NEW finder, it still
      // must collapse to the same AmbiguousSessionError class.
      //
      // Note: this case fails today not because the production code
      // misbehaves on agent-records ambiguity (it correctly throws
      // AmbiguousSessionError there), but because the bug scenario is
      // about REMOTE-ONLY ambiguity. Until Green adds the API prefix
      // lookup, two API-only sessions sharing a prefix would both fail
      // to surface — the test is `.failing` because the production
      // code path that proves "API prefix lookup handles multi-match"
      // doesn't exist yet. We drive it through the agent-records seam
      // for now; Green can wire the API path through the same
      // throw-site or a parallel one with the same class.
      mockFinder({
        local: null,
        remote: null,
        remotePrefixMatches: [matchA, matchB],
      });

      const { fetchSession } = await import("./fetch");

      let caught: unknown;
      try {
        await fetchSession(AMBIGUOUS_PREFIX);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AmbiguousSessionError);
      const message = (caught as Error).message;
      // Both candidate short-ids must appear so the user can disambiguate.
      expect(message).toContain(AMBIGUOUS_UUID_A.slice(0, 8));
      expect(message).toContain(AMBIGUOUS_UUID_B.slice(0, 8));
    },
  );

  // ===========================================================================
  // Test 4 — Full-UUID input still resolves via cross-env (regression net)
  // ===========================================================================
  //
  // The fix targets the prefix branch; the full-UUID branch must keep
  // working. This duplicates a slice of `fetch.supabase.test.ts:Test 3`
  // but lives here as a guardrail — a Green that accidentally widens
  // the prefix branch to capture all `isSessionIdOrPrefix` inputs (and
  // forgets to special-case full UUIDs) would silently break the
  // already-shipped cross-env full-UUID resume flow.
  //
  // Plain `test()` (no `.failing`) — this passes today and must keep
  // passing through Green.

  test(
    "ENG-5986 regression net: full-UUID input still resolves via Supabase fallback",
    async () => {
      mockFinder({ local: null, remote: null, remotePrefixMatches: [] });
      const fakeLocalPath = `/tmp/fake-local/projects/-workspaces-test-mvp/${FULL_UUID}.jsonl`;
      mockSupabaseFetch({
        ok: true,
        localPath: fakeLocalPath,
        compressedSize: 100,
        decompressedSize: 500,
        subagentCount: 0,
      });

      const { fetchSession } = await import("./fetch");
      const result = await fetchSession(FULL_UUID);

      expect(result.sessionId).toBe(FULL_UUID);
      expect(result.source).toBe("supabase");
      expect(result.localPath).toBe(fakeLocalPath);
    },
  );
});
