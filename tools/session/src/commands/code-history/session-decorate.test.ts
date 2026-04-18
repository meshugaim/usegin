/**
 * In-process tests for `decorateCommitWithSession` (slice 4 — ENG-5043).
 *
 * These tests stub the `DecorateSessionDeps` so they can pin:
 *   - Happy path: `fetchSession` resolves, `parseSession` returns turns,
 *     extractors run, `commit.session` fully populated.
 *   - No trailer: commit body without `Claude-Session:` → `commit.session`
 *     absent (no decoration).
 *   - Multi-trailer (amend): last trailer wins.
 *   - `SessionNotFoundError` → `commit.session = { id, sinceTimestampCmd }`
 *     only (AC 13 graceful degradation), NO throw.
 *   - Other error → propagates (spec: "don't swallow real errors").
 *
 * The subprocess-level integration tests in `../code-history.test.ts`
 * exercise the same pipeline end-to-end through the CLI for the happy
 * / no-trailer / multi-trailer cases. This file focuses on the
 * error-classification edges that are hard to reproduce via a
 * subprocess without elaborate archive-seeding.
 */

import { describe, test, expect } from "bun:test";

import {
  decorateCommitWithSession,
  SessionNotFoundError,
  type DecorateSessionDeps,
} from "./session-decorate";
import type { DecoratedCommit } from "./types";
import type { ParsedSession } from "../../types";
import type { FetchResult } from "../../fetch";
import {
  makeUserTurn,
  makeBashTurn,
  makeAssistantTurn,
} from "./__fixtures__/turns";
import {
  SESSION_FIXTURE_ID,
  SESSION_FIXTURE_SHORT_ID,
  EXPECTED_HINT_CMD,
} from "./__fixtures__/session";

// Local aliases keep the assertion text terse and make the intent of
// each fixture obvious at the call site.
const FIXTURE_UUID = SESSION_FIXTURE_ID;
const FIXTURE_SHORT = SESSION_FIXTURE_SHORT_ID;
const FIXTURE_COMMIT_SHA = "4fff467fb48a632519c742358505e9a0a739d525";

/**
 * Minimal `ParsedSession` wrapper — only the `turns` field is read by
 * the extractors. Other fields are stubbed with plausible empty values
 * so TypeScript is happy without dragging in a full session factory.
 *
 * TODO(schema-drift): reuse src/testing/sessions.ts when it gains a
 * ParsedSession helper that accepts a caller-supplied `sessionId`.
 * `makeSession` there defaults to TEST_SESSION_ID, but these tests pin
 * a specific FIXTURE_UUID to assert on — so a direct swap would break
 * the `.session!.id === FIXTURE_UUID` assertions until `makeSession`
 * cleanly threads an override (it already does via `Partial<ParsedSession>`,
 * but the cast-to-branded-SessionId dance would still live here).
 * Revisit when another caller needs the same shape.
 */
function makeStubSession(turns: ParsedSession["turns"]): ParsedSession {
  return {
    sessionId: FIXTURE_UUID as unknown as ParsedSession["sessionId"],
    cwd: "/tmp/stub",
    model: "claude-opus-4-7",
    tools: [],
    turns,
    subagents: [],
    rewinds: [],
    triggeredSkills: [],
    commits: [],
    compactions: [],
  };
}

function makeFetchResult(): FetchResult {
  return {
    sessionId: FIXTURE_UUID,
    shortId: FIXTURE_SHORT,
    localPath: `/tmp/stub/${FIXTURE_UUID}.jsonl`,
    alreadyLocal: true,
    subagentCount: 0,
  };
}

function makeCommit(overrides: Partial<DecoratedCommit> = {}): DecoratedCommit {
  return {
    sha: FIXTURE_COMMIT_SHA,
    date: "2026-04-18",
    committedAt: "2026-04-18T08:43:00+00:00",
    subject: "feat: thing",
    body: `Part of: ENG-5043\nClaude-Session: ${FIXTURE_UUID}`,
    ...overrides,
  };
}

/**
 * Build a stub `DecorateSessionDeps` composing the three callbacks. Each
 * callback defaults to a safe no-op / success path; tests override
 * individual hooks to exercise failure cases.
 */
function makeDeps(overrides: Partial<DecorateSessionDeps> = {}): DecorateSessionDeps {
  // Realistic turn shape: every turn carries a timestamp (what real
  // Claude Code JSONL emits). Lets later slices tighten expectations
  // on timestamp presence without retrofitting every fixture here.
  const defaultTurns = (() => {
    const [assistantBash, userResult] = makeBashTurn(
      `git commit -m "feat: thing"`,
      `[main ${FIXTURE_COMMIT_SHA.slice(0, 7)}] feat: thing`,
      {
        assistantTimestamp: "2026-04-18T08:14:00.000Z",
        userTimestamp: "2026-04-18T08:14:30.000Z",
      },
    );
    return [
      makeUserTurn("Wire the session extractors.", {
        timestamp: "2026-04-18T08:13:00.000Z",
      }),
      assistantBash,
      userResult,
      makeAssistantTurn({
        text: "Committed. Running the tests now.",
        timestamp: "2026-04-18T08:15:00.000Z",
      }),
    ];
  })();
  return {
    fetchSession: overrides.fetchSession ?? (async () => makeFetchResult()),
    parseSession:
      overrides.parseSession ?? (async () => makeStubSession(defaultTurns)),
  };
}

describe("decorateCommitWithSession (ENG-5043)", () => {
  test(
    "ENG-5043: happy path — Claude-Session trailer + resolvable session → full commit.session populated",
    async () => {
      const commit = makeCommit();
      const decorated = await decorateCommitWithSession(commit, makeDeps());

      expect(decorated.session).toBeDefined();
      expect(decorated.session!.id).toBe(FIXTURE_UUID);
      // `sinceTimestampCmd` composes the 8-char short UUID + t-30m hint.
      expect(decorated.session!.sinceTimestampCmd).toBe(
        EXPECTED_HINT_CMD,
      );
      // Extractors populated from the stubbed turns.
      expect(decorated.session!.intent).toBe("Wire the session extractors.");
      expect(decorated.session!.trigger).toBe("Wire the session extractors.");
      expect(decorated.session!.outcome).toBe(
        "Committed. Running the tests now.",
      );
    },
  );

  test(
    "ENG-5043: no Claude-Session trailer → commit.session stays absent",
    async () => {
      const commit = makeCommit({
        body: "Part of: ENG-5043\nCo-Authored-By: Claude <noreply@anthropic.com>",
      });
      const decorated = await decorateCommitWithSession(commit, makeDeps());
      expect(decorated.session).toBeUndefined();
    },
  );

  test(
    "ENG-5043: multiple Claude-Session trailers (amend case) → last match wins",
    async () => {
      const UUID_A = "00000000-0000-4000-8000-000000000001";
      const UUID_B = "00000000-0000-4000-8000-000000000002";
      const commit = makeCommit({
        body: [
          `Claude-Session: ${UUID_A}`,
          `Claude-Session: ${UUID_B}`,
        ].join("\n"),
      });
      // Spy on fetchSession to confirm it's called with the LAST UUID.
      let fetchedWith: string | null = null;
      const deps = makeDeps({
        fetchSession: async (input) => {
          fetchedWith = input;
          return makeFetchResult();
        },
      });
      const decorated = await decorateCommitWithSession(commit, deps);
      expect(fetchedWith).toBe(UUID_B);
      expect(decorated.session!.id).toBe(UUID_B);
    },
  );

  test(
    "ENG-5043 (AC 13): SessionNotFoundError → degrades to { id, sinceTimestampCmd }, no throw, no extractors",
    async () => {
      const commit = makeCommit();
      const deps = makeDeps({
        fetchSession: async () => {
          throw new SessionNotFoundError(FIXTURE_UUID, {
            searchedLocation: "~/.claude/projects/ and ~/agent-records/",
          });
        },
      });

      // Must NOT throw — AC 13 graceful degradation.
      const decorated = await decorateCommitWithSession(commit, deps);

      expect(decorated.session).toBeDefined();
      expect(decorated.session!.id).toBe(FIXTURE_UUID);
      expect(decorated.session!.sinceTimestampCmd).toBe(
        EXPECTED_HINT_CMD,
      );
      // Missing-layer invariant: no extractor values when fetch failed.
      expect(decorated.session!.intent).toBeUndefined();
      expect(decorated.session!.trigger).toBeUndefined();
      expect(decorated.session!.outcome).toBeUndefined();
    },
  );

  test(
    "ENG-5043: non-SessionNotFound error from fetchSession → propagates (don't swallow real errors)",
    async () => {
      const commit = makeCommit();
      const deps = makeDeps({
        fetchSession: async () => {
          throw new Error("permission denied: /home/user/.claude/projects/");
        },
      });
      await expect(decorateCommitWithSession(commit, deps)).rejects.toThrow(
        /permission denied/,
      );
    },
  );

  test(
    "ENG-5043: non-SessionNotFound error from parseSession → propagates (corrupt JSONL surfaces)",
    async () => {
      // parseSession throwing (e.g. malformed JSONL) is a real error, not
      // a "session not locally available" signal — it must reach the user.
      const commit = makeCommit();
      const deps = makeDeps({
        parseSession: async () => {
          throw new Error("JSONL parse error at line 42");
        },
      });
      await expect(decorateCommitWithSession(commit, deps)).rejects.toThrow(
        /JSONL parse error/,
      );
    },
  );
});
