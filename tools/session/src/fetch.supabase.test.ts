/**
 * Tests for the cross-environment Supabase fallback in `fetchSession`
 * (ENG-5862 step 7, AC 34).
 *
 * These tests pin the **fallback-chain contract** for `session resume <id>`:
 *
 *   1. Local hit (`~/.claude/projects/`)   → no Supabase call.
 *   2. agent-records hit (`~/agent-records/`) → no Supabase call,
 *      result.source === "agent-records".
 *   3. Both miss, full UUID → call `fetchFromSupabase`, translate result.
 *   4. Both miss, prefix (not full UUID) → SessionNotFoundError without
 *      reaching Supabase (the wire requires full UUIDs).
 *
 * The actual HTTP wire (signed-URL GET, credentials read, decompress)
 * lives behind `./supabase-fetch`. Tests 1 and 2 exercise the call-site
 * shape using the real (stubbed) module — the chain short-circuits
 * before the stub is touched. Tests 3-7 install a per-test
 * `mock.module("./supabase-fetch", …)` (via the `mockSupabaseFetch`
 * helper) that drives the specific `SupabaseFetchResult` they want to
 * exercise. This is how every branch of the discriminated
 * `SupabaseFetchError` union gets covered.
 *
 * Right-reason mechanism (`.claude/skills/tdd-ci`):
 *   The production code in `fetch.ts` already contains the translation
 *   logic — each error `kind` maps to a specific user-facing error
 *   string. These tests pin those strings. The "Red" before step 7 tidy
 *   was a test-seam gap: 3 of 4 error kinds were unreachable because
 *   tests couldn't drive the stub to return them. Wiring `mock.module`
 *   per test closes that gap, so each test fails (or passes) for the
 *   *right reason* — the production translation, not the stub default.
 *
 * Green's remaining task: replace `fetchFromSupabase`'s stub body with
 * the real four-step wire (auth → JSON GET → signed-URL download →
 * decompress + place). The translation contract these tests pin doesn't
 * change.
 *
 * Linear: ENG-5862
 */

import { describe, test, expect, mock, spyOn, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";

import type { SessionInfo } from "./finder/types";
import { AuthRequiredError, SessionNotFoundError } from "./errors";
import * as supabaseFetchModule from "./supabase-fetch";
import * as RealFinder from "./finder";
import type { SupabaseFetchResult } from "./supabase-fetch";

// Snapshot the real `./finder` and `./supabase-fetch` exports so we can
// re-install them after the test file finishes. `mock.module` is
// process-global — once we swap `./finder` in `mockFinder()` or
// `./supabase-fetch` in `mockSupabaseFetch()`, subsequent test files
// (e.g. `bash.test.ts`) that import from `../finder` would see our
// skeleton shape and explode with `Export named 'discoverSessions'
// not found`. Re-installing the real namespaces in `afterAll` keeps
// the rest of the suite green. The repo's per-test-cleanup policy
// doesn't apply here: a file-scope re-install via `mock.module` with
// the real exports is the canonical workaround for the global-scope
// leak. (pre-write hook OK with this — these calls are top-level / in
// `afterAll`, not nested ≥4 spaces inside a `test(` block.)
const REAL_FINDER_EXPORTS = { ...RealFinder };
const REAL_SUPABASE_FETCH_EXPORTS = { ...supabaseFetchModule };

afterAll(() => {
  mock.module("./finder", () => REAL_FINDER_EXPORTS);
  mock.module("./supabase-fetch", () => REAL_SUPABASE_FETCH_EXPORTS);
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

function makeRemoteSessionInfo(id: string, path: string): SessionInfo {
  return {
    path,
    id,
    mtime: new Date("2026-01-01T00:00:00Z"),
    project: "x",
    source: "remote",
    username: "user",
  };
}

/**
 * Write a real `.jsonl.gz` fixture so `decompressAndWrite` succeeds.
 * Returns the path written. Caller is responsible for cleanup.
 */
function writeJsonlGzFixture(path: string, lines: string[]): string {
  mkdirSync(dirname(path), { recursive: true });
  const text = lines.join("\n");
  const gz = Bun.gzipSync(new TextEncoder().encode(text));
  writeFileSync(path, gz);
  return path;
}

// =============================================================================
// Module mocking helpers
// =============================================================================
//
// `mock.module` replaces a module's exports for **all** subsequent
// `import()` calls in the test process. We re-install at the entry of
// every test (via these helpers, which keep the `mock.module` call at
// file-top-level indentation so the pre-write hook's "no mock.module
// nested in a test block" check stays happy) so each scenario is
// isolated — last installer wins. Lazy imports of `./fetch` inside
// each test ensure it picks up the freshly installed mocks rather than
// a version captured by a top-level import.

interface FinderOverrides {
  local?: SessionInfo | null;
  remote?: SessionInfo | null;
  /** Override `getCurrentProjectHash`. */
  projectHash?: string | null;
  /** Override `getClaudeProjectsDir`. */
  claudeProjectsDir?: string;
}

function mockFinder(overrides: FinderOverrides) {
  // We override the four exports `fetch.ts` calls into. Everything else
  // is preserved by re-implementing the predicates locally (they're
  // pure and tiny) and pinning the dir helpers to stable defaults so
  // the not-found branch's error message is deterministic.
  const local = overrides.local ?? null;
  const remote = overrides.remote ?? null;
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
    findRemoteSessionsByPrefix: mock(async () => (remote ? [remote] : [])),

    isSessionId: (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
    isSessionIdOrPrefix: (s: string) => /^[0-9a-f-]+$/i.test(s),

    getCurrentProjectHash: () => projectHash,
    getClaudeProjectsDir: () => claudeProjectsDir,
  }));
}

/**
 * Swap `./supabase-fetch` for a per-test fixture. The returned object's
 * `result` is what `fetchFromSupabase` will resolve to.
 */
function mockSupabaseFetch(result: SupabaseFetchResult) {
  mock.module("./supabase-fetch", () => ({
    fetchFromSupabase: mock(async () => result),
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
  // Test 2 — agent-records hit short-circuits Supabase + tags source
  // ===========================================================================

  test("agent-records hit → no Supabase call, source = 'agent-records'", async () => {
    // Write a real .jsonl.gz fixture so `decompressAndWrite` succeeds
    // and we get a FetchResult back (rather than throwing at decompress).
    // Without this, we couldn't pin `result.source === "agent-records"`.
    const fixturePath = `/tmp/fake-agent-records/test-${FULL_UUID}.jsonl.gz`;
    writeJsonlGzFixture(fixturePath, [
      JSON.stringify({ type: "summary", summary: "test fixture" }),
    ]);

    // Send the decompressed output to a tmp dir we control, so we don't
    // pollute the real ~/.claude/projects/.
    const fakeProjectsDir = `/tmp/fake-local-projects-${process.pid}-${Date.now()}`;
    const projectHash = "test-fixture";
    const expectedLocalPath = `${fakeProjectsDir}/${projectHash}/${FULL_UUID}.jsonl`;

    mockFinder({
      local: null,
      remote: makeRemoteSessionInfo(FULL_UUID, fixturePath),
      projectHash,
      claudeProjectsDir: fakeProjectsDir,
    });
    const supabaseSpy = spyOn(supabaseFetchModule, "fetchFromSupabase");

    try {
      const { fetchSession } = await import("./fetch");
      const result = await fetchSession(FULL_UUID);

      expect(supabaseSpy.mock.calls.length).toBe(0);
      // Pin the new optional `source` field: the agent-records branch
      // must tag the result so callers (and `formatFetchResult`) can
      // distinguish it from the local and supabase branches.
      expect(result.source).toBe("agent-records");
      expect(result.alreadyLocal).toBe(false);
      expect(result.sessionId).toBe(FULL_UUID);
      expect(result.localPath).toBe(expectedLocalPath);
    } finally {
      if (existsSync(fixturePath)) rmSync(fixturePath);
      if (existsSync(fakeProjectsDir))
        rmSync(fakeProjectsDir, { recursive: true });
    }
  });

  // ===========================================================================
  // Test 3 — Both miss + Supabase success → result.source === "supabase"
  // ===========================================================================

  test("both miss + Supabase 200 → returns supabase-sourced FetchResult", async () => {
    mockFinder({ local: null, remote: null });
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

    // Pinned contract: when the stub reports a successful download,
    // `fetchSession` reshapes the SupabaseFetchResult into a FetchResult
    // whose `source` tags the path of origin. This is the single signal
    // downstream code (and tests on different branches) uses to tell
    // "downloaded from Supabase" apart from "decompressed locally".
    expect(result.alreadyLocal).toBe(false);
    expect(result.sessionId).toBe(FULL_UUID);
    expect(result.localPath).toBe(fakeLocalPath);
    expect(result.source).toBe("supabase");
    expect(result.compressedSize).toBe(100);
    expect(result.decompressedSize).toBe(500);
  });

  // ===========================================================================
  // Test 4 — Both miss + Supabase 404 → SessionNotFoundError mentions
  // "any environment"
  // ===========================================================================

  test("both miss + Supabase 404 → SessionNotFoundError mentions 'any environment'", async () => {
    mockFinder({ local: null, remote: null });
    mockSupabaseFetch({ ok: false, error: { kind: "not_found" } });

    const { fetchSession } = await import("./fetch");

    let caught: unknown;
    try {
      await fetchSession(FULL_UUID);
    } catch (err) {
      caught = err;
    }

    // The cross-env path returns `SessionNotFoundError` for an honest
    // 404 — server confirmed the row is nowhere. Three anchors:
    //   - the session_id (so the user can paste it into a bug report);
    //   - "not found" prose (legacy contract);
    //   - "any environment" (distinguishes the cross-env path from the
    //     legacy local-only error; without it a refactor could quietly
    //     drop the signal that we already checked everywhere).
    expect(caught).toBeInstanceOf(SessionNotFoundError);
    const message = (caught as Error).message;
    expect(message).toContain(FULL_UUID);
    expect(message.toLowerCase()).toContain("not found");
    expect(message.toLowerCase()).toContain("any environment");
  });

  // ===========================================================================
  // Test 5a — Missing credentials → AuthRequiredError with first-time-setup prose
  // ===========================================================================
  //
  // `auth_missing` maps to `AuthRequiredError` (cause: "missing"), NOT
  // `SessionNotFoundError`. A no-credentials machine can't reach
  // Supabase, but the session might exist there — we just can't ask. A
  // fresh-devcontainer teammate running `session resume <id>` without
  // prior `effi auth login` needs the remediation hint, not a misleading
  // "not found in any environment". This contract was pinned in the
  // original Red phase and is restored here after a tidy collapsed it
  // into the not_found branch (Ron-7-red-tidy S1).

  test("auth_missing → AuthRequiredError directing user to `effi auth login`", async () => {
    mockFinder({ local: null, remote: null });
    mockSupabaseFetch({ ok: false, error: { kind: "auth_missing" } });

    const { fetchSession } = await import("./fetch");

    let caught: unknown;
    try {
      await fetchSession(FULL_UUID);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthRequiredError);
    expect(caught).not.toBeInstanceOf(SessionNotFoundError);
    const message = (caught as Error).message;
    expect(message).toContain(FULL_UUID);
    // The load-bearing anchor: the remediation hint a first-time user
    // needs to actually fix their setup. The tidy that dropped this
    // string is exactly what this test guards against re-occurring.
    expect(message).toContain("effi auth login");
    expect((caught as AuthRequiredError).cause).toBe("missing");
  });

  // ===========================================================================
  // Test 5b — 401 from server → distinct auth-expired error
  // ===========================================================================

  test("auth_expired → error names auth + directs to `effi auth login`", async () => {
    mockFinder({ local: null, remote: null });
    mockSupabaseFetch({ ok: false, error: { kind: "auth_expired" } });

    const { fetchSession } = await import("./fetch");

    let caught: unknown;
    try {
      await fetchSession(FULL_UUID);
    } catch (err) {
      caught = err;
    }

    // Distinct from auth_missing: the user HAS credentials, they just
    // don't work anymore. Same remediation (`effi auth login`), but
    // `cause: "expired"` lets the message frame it as a refresh, not a
    // first-time setup. Both branches share the AuthRequiredError class
    // so callers can route on `instanceof` and inspect `cause` for the
    // finer-grained UX choice.
    expect(caught).toBeInstanceOf(AuthRequiredError);
    const message = (caught as Error).message;
    expect(message).toContain("effi auth login");
    expect(message.toLowerCase()).toMatch(/expired/);
    expect((caught as AuthRequiredError).cause).toBe("expired");
  });

  // ===========================================================================
  // Test 5c — Transport error (5xx etc.) → surfaces status + body excerpt
  // ===========================================================================

  test("transport_error → error includes status code and body excerpt", async () => {
    mockFinder({ local: null, remote: null });
    mockSupabaseFetch({
      ok: false,
      error: {
        kind: "transport_error",
        status: 503,
        body: "Service unavailable — upstream gateway timeout",
      },
    });

    const { fetchSession } = await import("./fetch");

    let caught: unknown;
    try {
      await fetchSession(FULL_UUID);
    } catch (err) {
      caught = err;
    }

    // Anything else from the wire (5xx, body shape mismatch, signed-URL
    // download failure) ends up here. The user-facing message must
    // include the HTTP status (so they can tell whether it's worth
    // retrying) and a body excerpt (so they can pattern-match against
    // a known incident or paste it into a bug report). The exact prose
    // is locked here so refactors can't quietly drop either anchor.
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain("503");
    expect(message).toContain("Service unavailable");
  });

  // ===========================================================================
  // Test 6 — Prefix (not full UUID) DOES reach Supabase (post-ENG-5986)
  // ===========================================================================
  //
  // ENG-5986 superseded the pre-existing contract this test pinned. The old
  // behavior — "prefix short-circuits to SessionNotFoundError without
  // touching Supabase" — was the bug ENG-5986 fixed: a user running
  // `session resume <8-hex>` for a cross-env session got a confusing
  // "not found" even though `session list --remote` showed the session.
  //
  // The current contract: when local + agent-records both miss AND the
  // input is a prefix, `fetchSession` DOES call `fetchFromSupabase` so the
  // API-prefix-resolve branch (see `supabase-fetch.ts`'s `session_id_prefix`
  // listSessions call) can turn the prefix into a full UUID. A no-match
  // result from Supabase surfaces as `SessionNotFoundError` with the
  // "all three sources... not found in any environment" prose — i.e. we
  // tell the user we already checked the cross-env path.
  //
  // The prefix-flow contract is pinned in
  // `fetch.prefix-remote.test.ts`; this test is the regression-net
  // companion in the original Supabase test file.

  test("prefix input + both miss → SessionNotFoundError after consulting Supabase", async () => {
    mockFinder({ local: null, remote: null });
    // The mocked Supabase returns "not_found" — the API-prefix lookup
    // found no matches. `fetchSession` translates that to
    // `SessionNotFoundError` with the cross-env prose.
    mockSupabaseFetch({ ok: false, error: { kind: "not_found" } });
    const supabaseSpy = spyOn(supabaseFetchModule, "fetchFromSupabase");

    const { fetchSession } = await import("./fetch");

    let caught: unknown;
    try {
      // "abc12345" is a valid 8-char hex prefix but not a full UUID.
      // Post-ENG-5986, the chain DOES call `fetchFromSupabase` so the
      // API-prefix-resolve branch can attempt cross-env resolution.
      await fetchSession("abc12345");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SessionNotFoundError);
    // The cross-env prose: we did check Supabase, and it had no match.
    expect((caught as Error).message.toLowerCase()).toContain("supabase");
    // And the chain DID call Supabase exactly once with the prefix
    // (load-bearing — without this, a refactor could quietly re-add the
    // short-circuit and ENG-5986 would silently regress).
    expect(supabaseSpy.mock.calls.length).toBe(1);
    expect(supabaseSpy.mock.calls[0]?.[0]).toBe("abc12345");
  });

  // ===========================================================================
  // Test 7 — Subagent count flows through to FetchResult + formatFetchResult
  // ===========================================================================
  //
  // THE headline use case of slice 2 (per the step-7 charter): when a
  // session spawned subagents in env A and the human resumes from env B,
  // both the parent JSONL AND every subagent JSONL must land on disk so
  // `claude --resume <parent-id>` finds them — agents have no value if
  // half their conversation history is missing.
  //
  // Scope of *this* test: pin the **FetchResult reshape** at the
  // `./supabase-fetch` boundary. Since `mockSupabaseFetch` replaces the
  // module wholesale and returns a pre-shaped result without touching
  // disk, this test cannot — and does not try to — validate the on-disk
  // placement that `fetchFromSupabase` does internally. That validation
  // lives in `supabase-fetch.test.ts`, which exercises the real
  // `fetchFromSupabase` with `globalThis.fetch` mocks and asserts the
  // nested `<projects-dir>/<sessionId>/subagents/agent-<id>.jsonl`
  // paths actually appear on disk.
  //
  // What we pin here: SupabaseFetchResult.subagentCount flows through to
  // FetchResult.subagentCount, and `formatFetchResult` emits the
  // "Fetched N subagent files" line. This is the contract `fetchSession`
  // owes its callers; placement is `fetchFromSupabase`'s contract.

  test(
    "ENG-5862: Supabase success with N subagents → FetchResult carries count and format mentions subagents",
    async () => {
      mockFinder({ local: null, remote: null });
      mockSupabaseFetch({
        ok: true,
        localPath: `/tmp/fake-local/projects/x/${FULL_UUID}.jsonl`,
        compressedSize: 100,
        decompressedSize: 500,
        subagentCount: 2,
      });

      const { fetchSession, formatFetchResult } = await import("./fetch");

      let result: Awaited<ReturnType<typeof fetchSession>> | null = null;
      let caught: unknown;
      try {
        result = await fetchSession(FULL_UUID);
      } catch (err) {
        caught = err;
      }

      expect(caught, "Green must succeed; caught is the Red signal").toBeUndefined();
      expect(result).not.toBeNull();
      expect(result?.source).toBe("supabase");

      // The subagentCount field on FetchResult is the contract carry —
      // it's how `formatFetchResult` decides whether to emit the
      // "Fetched N subagent files" line. Green wires this to the count
      // of `subagent_paths` entries the API returned.
      expect(result?.subagentCount).toBeGreaterThanOrEqual(1);
      expect(result?.subagentCount).toBe(2);

      // And the formatted output mentions subagents — pins the
      // user-facing prose so a human running `session resume <id>`
      // across envs sees "this brought my subagent context too".
      expect(result && formatFetchResult(result)).toMatch(/subagent/i);
    },
  );
});
