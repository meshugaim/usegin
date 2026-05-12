/**
 * Tests for `session resume <id>` — ENG-5862 step 8 (AC 36).
 *
 * Pins the CLI lock-aware-refusal + fork flow contract:
 *
 *   1. Lock held by another env, no `--fork` → exits non-zero, prints
 *      holder identity to stderr, suggests `--fork`.
 *   2. Lock held by another env, `--fork` → initial-sync POST carries
 *      `parent_session_id` + `forked_at_turn` metadata.
 *   3. Fork mints a new UUIDv4 (not reusing the original).
 *   4. Subagent-fork refused with a clear "not supported in v1" message
 *      (spec line 537 — fork in v1 supports parent-only sessions).
 *   5. Happy path: lock not held → claude --resume spawns with the
 *      original session id.
 *
 * Red-phase mechanism (`.claude/skills/tdd-ci`):
 *   `queryLockState` and `performForkAndInitialSync` are stubs (their
 *   bodies throw "Not implemented (ENG-5862 step 8 Red)") and
 *   `runResume`'s current body intentionally does NOT call into them
 *   yet — Green wires the lock-state probe + fork-and-initial-sync into
 *   `runResume` once these tests pin the contract. Each test installs a
 *   per-test `mock.module(…)` over `./lock-state`, `./resume-fork`,
 *   `../fetch`, and `../../../lib/auth/credentials`; that way **when
 *   Green wires the production branches**, the same mocks immediately
 *   drive them and each `test.failing` flips green.
 *
 *   Today, right-reason failures fire at:
 *     - Test 1: `expect(exitCalls[0]).not.toBe(0)` — `runResume` Red
 *       proceeds to the legacy spawn path and calls `process.exit(0)`
 *       on success. Green's lock-held branch will call
 *       `process.exit(1)` after printing the holder.
 *     - Test 2: `expect(forkCallSink.params).toBeDefined()` — the
 *       orchestrator was never called because resume.ts Red doesn't
 *       branch on --fork yet. Green calls it with the source
 *       sessionId + (per the assertion below) the
 *       `forkedAtTurn` count threaded through.
 *     - Test 3: `expect(resumedId).not.toBe(ORIGINAL_UUID)` — Red spawns
 *       claude on the original id; Green spawns on the fork's new id.
 *     - Test 4: `expect(exitCalls[0]).not.toBe(0)` — same shape as Test
 *       1: Green's subagent-refusal branch will exit non-zero with the
 *       v1-not-supported message.
 *
 *   Test 5 is plain `test()` — a regression pin of the legacy resume
 *   behavior (lock not held → spawn `just c --resume <id>`). Green's
 *   wiring must preserve this branch byte-identical; Test 5 fails
 *   right-reason only if Green regresses the no-conflict path.
 *
 * Linear: ENG-5862
 */

import {
  describe,
  test,
  expect,
  mock,
  beforeEach,
  afterEach,
  afterAll,
} from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";

import * as RealLockState from "./lock-state";
import * as RealResumeFork from "./resume-fork";
import * as RealFetch from "../fetch";
import * as RealCredentials from "../../../lib/auth/credentials";
import type {
  LockState,
  QueryLockStateParams,
} from "./lock-state";
import type {
  ForkOutcome,
  PerformForkParams,
} from "./resume-fork";

const REAL_LOCK_STATE = { ...RealLockState };
const REAL_RESUME_FORK = { ...RealResumeFork };
const REAL_FETCH = { ...RealFetch };
const REAL_CREDENTIALS = { ...RealCredentials };

afterAll(() => {
  // Same file-scope leak guard as `fetch.supabase.test.ts` — restore the
  // real modules so subsequent files in the suite see the production
  // surfaces, not the per-test stubs.
  mock.module("./lock-state", () => REAL_LOCK_STATE);
  mock.module("./resume-fork", () => REAL_RESUME_FORK);
  mock.module("../fetch", () => REAL_FETCH);
  mock.module("../../../lib/auth/credentials", () => REAL_CREDENTIALS);
});

// =============================================================================
// Fixtures
// =============================================================================

const ORIGINAL_UUID = "11111111-2222-3333-4444-555555555555";
const NEW_FORK_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const HOLDER_FIXTURE = {
  environment_kind: "gitpod",
  environment_id: "env-alpha",
  username: "alice@askeffi.ai",
  expires_at: "2026-05-12T20:00:00.000Z",
};

/**
 * Number of user/assistant turns the source-fixture JSONL contains.
 * `extractMetadata` counts each user/assistant line. resume.ts now
 * extracts metadata from this file inline (no try/catch fallback) and
 * threads the whole struct through to the fork orchestrator. Pinning
 * the expected value here lets test 2 assert the EXACT number flowing
 * through the seam — Ron-8-green N5 flagged the prior assertion
 * (`typeof === "number"`) as too weak: a regression that landed
 * `forkedAtTurn = 0` via the dead-code fallback would have passed.
 */
const FIXTURE_TURN_COUNT = 7;

function fixtureJsonl(sessionId: string): string {
  // 4 user + 3 assistant = 7 turns; trailing blank line mirrors how
  // claude code writes the file in practice.
  return [
    JSON.stringify({ sessionId, type: "user", text: "u1" }),
    JSON.stringify({ sessionId, type: "assistant" }),
    JSON.stringify({ sessionId, type: "user", text: "u2" }),
    JSON.stringify({ sessionId, type: "assistant" }),
    JSON.stringify({ sessionId, type: "user", text: "u3" }),
    JSON.stringify({ sessionId, type: "assistant" }),
    JSON.stringify({ sessionId, type: "user", text: "u4" }),
    "",
  ].join("\n");
}

function makeFetchResult(sessionId: string) {
  return {
    sessionId,
    shortId: sessionId.slice(0, 8),
    localPath: `/tmp/fake/${sessionId}.jsonl`,
    alreadyLocal: true,
    subagentCount: 0,
  };
}

/**
 * Source-fixture writer for the `--fork` branch tests. resume.ts now
 * reads + extracts from `result.localPath` directly (no dead-code
 * `forkedAtTurn = 0` fallback), so the read MUST succeed. Writing a
 * fixture once per test keeps the contract honest: a regression that
 * drops the read would fail loudly through the outer catch, not a
 * silent fallback.
 */
function writeSourceFixture(sessionId: string): string {
  const path = `/tmp/fake/${sessionId}.jsonl`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, fixtureJsonl(sessionId));
  return path;
}

function removeSourceFixture(sessionId: string) {
  const path = `/tmp/fake/${sessionId}.jsonl`;
  if (existsSync(path)) rmSync(path);
}

// =============================================================================
// `process.exit` + `Bun.spawn` capture
// =============================================================================
//
// `runResume` calls `process.exit` on both the lock-held-refusal path and
// after spawning claude. Throwing in the stub lets the run abort at the
// same point real exit would — tests catch and assert.

let exitCalls: number[] = [];
const realExit = process.exit;

let spawnCalls: Array<readonly string[]> = [];
const realSpawn = Bun.spawn;

beforeEach(() => {
  exitCalls = [];
  spawnCalls = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.exit = ((code?: number) => {
    exitCalls.push(code ?? 0);
    throw new Error(`__test_exit_${code ?? 0}__`);
  }) as never;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Bun as { spawn: unknown }).spawn = ((args: readonly string[]) => {
    spawnCalls.push(args);
    // Return a `Bun.spawn`-ish shape so `await proc.exited` and
    // `proc.exitCode` resolve without an actual child process.
    return {
      exited: Promise.resolve(0),
      exitCode: 0,
    };
  }) as never;
});

afterEach(() => {
  process.exit = realExit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Bun as { spawn: unknown }).spawn = realSpawn as never;
});

// Ron-8-red S3 belt-and-braces: if a `beforeEach` throws between capturing
// the realExit/realSpawn snapshots and installing the per-test stubs, the
// matching `afterEach` may not run — leaving `process.exit` / `Bun.spawn`
// patched for downstream test files in the same `bun test` invocation.
// This `afterAll` unconditionally restores the real surfaces, mirroring
// the `afterAll` above that restores `mock.module`.
afterAll(() => {
  process.exit = realExit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Bun as { spawn: unknown }).spawn = realSpawn as never;
});

// =============================================================================
// Module mocking helpers
// =============================================================================

interface ResumeMocks {
  lockState: LockState;
  forkOutcome?: ForkOutcome;
  /** Set when a test wants to inspect the params the fork was called with. */
  forkCallSink?: { params?: PerformForkParams };
  /** Set when a test wants to inspect the params the lock probe was called with. */
  lockCallSink?: { params?: QueryLockStateParams };
  /** Override the FetchResult `fetchSession` returns. */
  fetchResultSessionId?: string;
}

function installMocks(opts: ResumeMocks) {
  mock.module("../fetch", () => ({
    fetchSession: mock(async (id: string) =>
      makeFetchResult(opts.fetchResultSessionId ?? id),
    ),
    formatFetchResult: () => "(format-noop)",
  }));

  mock.module("../../../lib/auth/credentials", () => ({
    readCredentials: mock(async () => ({
      access_token: "test-token",
      refresh_token: "test-refresh",
      email: "tester@askeffi.ai",
      api_url: "http://localhost:63000",
    })),
    getApiUrl: mock(async () => "http://localhost:63000"),
  }));

  mock.module("./lock-state", () => ({
    queryLockState: mock(async (params: QueryLockStateParams) => {
      if (opts.lockCallSink) opts.lockCallSink.params = params;
      return opts.lockState;
    }),
  }));

  mock.module("./resume-fork", () => ({
    performForkAndInitialSync: mock(async (params: PerformForkParams) => {
      if (opts.forkCallSink) opts.forkCallSink.params = params;
      if (!opts.forkOutcome) {
        throw new Error(
          "test bug: forkOutcome required when test drives the --fork branch",
        );
      }
      return opts.forkOutcome;
    }),
  }));
}

// =============================================================================
// stderr/stdout capture — we assert on what the user sees
// =============================================================================

let stderrChunks: string[] = [];
let stdoutChunks: string[] = [];
const realConsoleError = console.error;
const realConsoleLog = console.log;

beforeEach(() => {
  stderrChunks = [];
  stdoutChunks = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = ((...args: unknown[]) => {
    stderrChunks.push(args.map(String).join(" "));
  }) as never;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log = ((...args: unknown[]) => {
    stdoutChunks.push(args.map(String).join(" "));
  }) as never;
});

afterEach(() => {
  console.error = realConsoleError;
  console.log = realConsoleLog;
});

// Helper: snapshot of all stderr lines for substring asserts.
const stderr = () => stderrChunks.join("\n");
const stdout = () => stdoutChunks.join("\n");

// =============================================================================
// Tests
// =============================================================================

describe("ENG-5862 step 8 — runResume lock-aware refusal + --fork (AC 36)", () => {
  // ===========================================================================
  // Test 1 — lock held, no --fork → exit non-zero with holder + --fork hint
  // ===========================================================================

  test(
    "lock held by another env without --fork → exits non-zero with holder identity + --fork hint",
    async () => {
      installMocks({
        lockState: { held: true, ours: false, holder: HOLDER_FIXTURE },
      });

      const { runResume } = await import("./resume");

      // runResume calls process.exit(1) which our stub turns into a throw.
      let caught: unknown;
      try {
        await runResume([ORIGINAL_UUID]);
      } catch (err) {
        caught = err;
      }

      // (a) Exit was called with non-zero — refusal is hard, not a warning.
      expect(caught).toBeInstanceOf(Error);
      expect(exitCalls.length).toBeGreaterThan(0);
      expect(exitCalls[0]).not.toBe(0);

      // (b) stderr surfaces holder identity — each field individually so a
      // single-blob "lock held" message can't accidentally pass without
      // showing the user who has it.
      const err = stderr();
      expect(err).toContain(HOLDER_FIXTURE.username);
      expect(err).toContain(HOLDER_FIXTURE.environment_kind);
      expect(err).toContain(HOLDER_FIXTURE.environment_id);
      expect(err).toContain(HOLDER_FIXTURE.expires_at);

      // (c) stderr mentions `--fork` as remediation — spec line 139
      // explicitly: "offers --fork". Without this line a user hits the
      // refusal with no path forward.
      expect(err).toContain("--fork");

      // (d) claude was NOT spawned — refusal must short-circuit before
      // any resume side-effect.
      expect(spawnCalls.length).toBe(0);
    },
  );

  // ===========================================================================
  // Test 2 — lock held, --fork → initial sync metadata carries parent linkage
  // ===========================================================================

  test(
    "lock held + --fork → initial-sync metadata includes parent_session_id + forked_at_turn",
    async () => {
      writeSourceFixture(ORIGINAL_UUID);
      try {
        const forkCallSink: { params?: PerformForkParams } = {};
        installMocks({
          lockState: { held: true, ours: false, holder: HOLDER_FIXTURE },
          forkOutcome: {
            ok: true,
            result: {
              newSessionId: NEW_FORK_UUID,
              newLocalPath: `/tmp/fake/${NEW_FORK_UUID}.jsonl`,
              syncedAt: "2026-05-12T20:00:00.000Z",
            },
          },
          forkCallSink,
        });

        const { runResume } = await import("./resume");

        try {
          await runResume([ORIGINAL_UUID, "--fork"]);
        } catch {
          // process.exit at the end of the spawn path is expected.
        }

        // The fork orchestrator was called with the original session id
        // — that's what threads through to `parent_session_id` on the
        // initial-sync metadata. Pin the parameter here.
        expect(forkCallSink.params).toBeDefined();
        expect(forkCallSink.params?.originalSessionId).toBe(ORIGINAL_UUID);

        // AC 36 (d): `forked_at_turn = <last turn in source>`.
        // resume.ts now extracts metadata from the source JSONL inline
        // (option (c) — no dead-code fallback) and threads the whole
        // ExtractedMetadata struct into the orchestrator. We pin the
        // EXACT turn_count flowing through the seam against
        // `FIXTURE_TURN_COUNT`, not just the type — Ron-8-green N5
        // flagged the prior `typeof === "number"` assertion as too
        // weak: it passed even when the dead-code catch landed
        // `forkedAtTurn = 0` on the row, silently corrupting lineage.
        // An exact-value assertion catches that regression on the spot.
        expect(forkCallSink.params?.sourceMetadata).toBeDefined();
        expect(forkCallSink.params?.sourceMetadata.turn_count).toBe(
          FIXTURE_TURN_COUNT,
        );
      } finally {
        removeSourceFixture(ORIGINAL_UUID);
      }
    },
  );

  // ===========================================================================
  // Test 3 — fork mints a new UUIDv4 distinct from the original
  // ===========================================================================

  test(
    "--fork mints a fresh UUIDv4 (not reusing the original session id)",
    async () => {
      writeSourceFixture(ORIGINAL_UUID);
      try {
        installMocks({
          lockState: { held: true, ours: false, holder: HOLDER_FIXTURE },
          forkOutcome: {
            ok: true,
            result: {
              newSessionId: NEW_FORK_UUID,
              newLocalPath: `/tmp/fake/${NEW_FORK_UUID}.jsonl`,
              syncedAt: "2026-05-12T20:00:00.000Z",
            },
          },
        });

        const { runResume } = await import("./resume");

        try {
          await runResume([ORIGINAL_UUID, "--fork"]);
        } catch {
          // expected exit
        }

        // `claude --resume` MUST be invoked with the NEW id, not the
        // original. Without this check a regression could spawn the
        // parent (re-racing the peer's lock) and the spec contract
        // collapses.
        expect(spawnCalls.length).toBe(1);
        const spawnArgs = spawnCalls[0]!;
        const resumeIdx = spawnArgs.indexOf("--resume");
        expect(resumeIdx).toBeGreaterThan(-1);
        const resumedId = spawnArgs[resumeIdx + 1]!;

        // (a) Distinct from original.
        expect(resumedId).not.toBe(ORIGINAL_UUID);

        // (b) Valid UUIDv4 shape (`crypto.randomUUID()` in the
        // orchestrator).
        const uuidV4Regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(resumedId).toMatch(uuidV4Regex);
      } finally {
        removeSourceFixture(ORIGINAL_UUID);
      }
    },
  );

  // ===========================================================================
  // Test 4 — subagent-fork refused with v1 message
  // ===========================================================================

  test(
    "--fork on a session with subagents refuses with 'subagent-fork not supported in v1'",
    async () => {
      writeSourceFixture(ORIGINAL_UUID);
      try {
        installMocks({
          lockState: { held: true, ours: false, holder: HOLDER_FIXTURE },
          forkOutcome: {
            ok: false,
            error: { kind: "subagent_fork_not_supported", subagentCount: 2 },
          },
        });

        const { runResume } = await import("./resume");

        let caught: unknown;
        try {
          await runResume([ORIGINAL_UUID, "--fork"]);
        } catch (err) {
          caught = err;
        }

        // Exit non-zero — refusal is hard.
        expect(caught).toBeInstanceOf(Error);
        expect(exitCalls.length).toBeGreaterThan(0);
        expect(exitCalls[0]).not.toBe(0);

        // Message names the v1 limitation explicitly — a user staring at
        // "fork failed" with no reason has nothing to do; pinning the
        // exact phrase per spec line 537 ("subagent-fork is deferred")
        // means the same string appears in the spec doc and in stderr.
        const err = stderr();
        expect(err.toLowerCase()).toContain("subagent");
        expect(err.toLowerCase()).toContain("not supported");
        expect(err).toContain("v1");

        // No spawn — refusal short-circuits before resume.
        expect(spawnCalls.length).toBe(0);
      } finally {
        removeSourceFixture(ORIGINAL_UUID);
      }
    },
  );

  // ===========================================================================
  // Test 5 — happy path: no lock conflict → spawn claude --resume <original>
  // ===========================================================================

  test("no lock conflict → spawns `just c --resume <original-id>`", async () => {
    installMocks({
      lockState: { held: false },
    });

    const { runResume } = await import("./resume");

    try {
      await runResume([ORIGINAL_UUID]);
    } catch {
      // expected exit after spawn
    }

    // The legacy path is preserved: one spawn, args end with
    // `--resume <ORIGINAL_UUID>`. AC 36 only kicks in on lock contention.
    expect(spawnCalls.length).toBe(1);
    const spawnArgs = spawnCalls[0]!;
    expect(spawnArgs).toContain("just");
    expect(spawnArgs).toContain("c");
    expect(spawnArgs).toContain("--resume");
    expect(spawnArgs).toContain(ORIGINAL_UUID);

    // No refusal output — the user shouldn't see lock-related noise on
    // a healthy resume.
    expect(stderr()).not.toContain("lock");
    expect(stdout()).not.toContain("Forked");
  });
});
