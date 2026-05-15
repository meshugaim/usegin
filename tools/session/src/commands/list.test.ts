/**
 * Tests for `runList` — the API-driven `--remote` path (Step 5b of ENG-5861).
 *
 * All external dependencies (local discovery, API finder, filesystem
 * metadata extraction, console output) are injected. The tests never
 * touch `~/.claude/projects/`, `~/agent-records/`, or the network.
 *
 * Covers:
 *
 *   - `--remote` calls `findRemoteSessionsViaApi` with the right filters
 *     (limit, since-as-ISO) and renders the result.
 *   - `list` (no flag) ignores the API helper entirely.
 *   - `--remote` merges local + remote, dedup by `session_id` with local
 *     winning on collisions.
 *   - Empty remote response surfaces `NoSessionsFoundError` via the
 *     existing error path.
 *
 * AC 32, 33 (ENG-5861).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  ApiFinderDeps,
  ApiFinderOptions,
  ApiListOptions,
  ApiSessionItem,
  SessionInfo,
} from "../finder";
import { apiItemToSessionInfo, runList } from "./list";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function localSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    path: "/home/dev/.claude/projects/abc/local-1.jsonl",
    id: "11111111-1111-1111-1111-111111111111",
    mtime: new Date("2026-05-10T12:00:00.000Z"),
    project: "abc",
    ...overrides,
  };
}

function apiItem(overrides: Partial<ApiSessionItem> = {}): ApiSessionItem {
  return {
    id: "row-uuid",
    session_id: "22222222-2222-2222-2222-222222222222",
    user_id: "user-uuid",
    username: "oria",
    environment_kind: "gitpod",
    environment_id: "env-1",
    project_path: "/workspaces/test-mvp",
    git_branch: "main",
    git_sha: null,
    claude_model: "claude-opus-4-7",
    status: "active",
    started_at: null,
    last_synced_at: "2026-05-11T09:00:00.000Z",
    turn_count: 42,
    line_count: 100,
    file_size_bytes: 0,
    gzipped_size_bytes: 0,
    content_hash: null,
    preview_first: null,
    preview_last: null,
    summary: null,
    summary_generated_at: null,
    first_user_message: "hello from oria",
    storage_path: "oria/2026-05-11/sess.jsonl.gz",
    parent_session_id: null,
    forked_at_turn: null,
    is_subagent: false,
    display_title: "hello from oria",
    created_at: "2026-05-11T08:59:00.000Z",
    updated_at: "2026-05-11T09:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// `process.exit` capture — runList calls it on empty-result, which would
// otherwise terminate the test process. Stub for the duration of each test.
// ---------------------------------------------------------------------------

let exitCalls: number[] = [];
const realExit = process.exit;
beforeEach(() => {
  exitCalls = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.exit = ((code?: number) => {
    exitCalls.push(code ?? 0);
    // Throw so the run aborts at the same point the real exit would —
    // tests can `await expect(...).rejects.toThrow()` to assert the path.
    throw new Error(`__test_exit_${code ?? 0}__`);
  }) as never;
});
afterEach(() => {
  process.exit = realExit;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runList — --remote path (AC 32)", () => {
  test("calls findRemoteSessionsViaApi with --limit + ISO-converted --since", async () => {
    const calls: {
      options: ApiFinderOptions | undefined;
      filters: ApiListOptions | undefined;
      deps: ApiFinderDeps | undefined;
    }[] = [];

    const lines: string[] = [];

    await runList(["--remote", "--limit", "25", "--since", "7d"], {
      discoverSessionsFn: async () => [],
      findRemoteSessionsViaApiFn: async (options, filters, deps) => {
        calls.push({ options, filters, deps });
        // Differentiate `display_title` from `first_user_message` so a
        // regression that reads the wrong field can't accidentally pass.
        // AC 42's contract is "render display_title" — the renderer must
        // pick the server-coalesced summary, not the raw first user line.
        return [
          apiItem({
            display_title: "summary text from server",
            first_user_message: "raw first user message",
          }),
        ];
      },
      log: (line) => lines.push(line),
      errorLog: () => {},
    });

    expect(calls.length).toBe(1);
    const got = calls[0]!;
    expect(got.filters?.limit).toBe(25);
    // `since: "7d"` resolves to an ISO timestamp ~7 days before now. We
    // can't pin the exact value (test wallclock), but it must be a
    // parseable ISO string and lie in the recent past.
    const sinceIso = got.filters?.since;
    expect(typeof sinceIso).toBe("string");
    const sinceMs = new Date(sinceIso!).getTime();
    expect(Number.isFinite(sinceMs)).toBe(true);
    expect(sinceMs).toBeLessThan(Date.now());

    // The rendered line should mention the short id + the API row's
    // display_title (the server-coalesced summary). Crucially, the raw
    // `first_user_message` must NOT appear — the renderer reads
    // `meta.summary` (= display_title), not the message string.
    expect(lines.some((l) => l.includes("22222222"))).toBe(true);
    expect(lines.some((l) => l.includes("summary text from server"))).toBe(true);
    expect(lines.some((l) => l.includes("raw first user message"))).toBe(false);
  });

  test("renders API rows with [R] remote prefix", async () => {
    const lines: string[] = [];
    await runList(["--remote"], {
      discoverSessionsFn: async () => [],
      findRemoteSessionsViaApiFn: async () => [apiItem()],
      log: (line) => lines.push(line),
      errorLog: () => {},
    });
    // formatListLine renders source==="remote" with a "[R] " prefix.
    expect(lines.some((l) => l.startsWith("[R] "))).toBe(true);
  });

  test("does NOT call extractSessionMeta for API rows (path is empty)", async () => {
    let extractCalls = 0;
    await runList(["--remote"], {
      discoverSessionsFn: async () => [],
      findRemoteSessionsViaApiFn: async () => [apiItem()],
      extractSessionMetaFn: async () => {
        extractCalls++;
        throw new Error("should not be called for API rows");
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(extractCalls).toBe(0);
  });

  test("--profile threads profileName into apiOptions", async () => {
    const profileNames: (string | undefined)[] = [];
    await runList(
      [
        "--remote",
        "--profile",
        "lihu-staging.owner@askeffi.ai:staging",
      ],
      {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (options) => {
          profileNames.push(options.profileName);
          return [apiItem()];
        },
        log: () => {},
        errorLog: () => {},
      },
    );
    expect(profileNames).toEqual([
      "lihu-staging.owner@askeffi.ai:staging",
    ]);
  });

  test("absent --profile leaves apiOptions.profileName undefined", async () => {
    const profileNames: (string | undefined)[] = [];
    await runList(["--remote"], {
      discoverSessionsFn: async () => [],
      findRemoteSessionsViaApiFn: async (options) => {
        profileNames.push(options.profileName);
        return [apiItem()];
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(profileNames).toEqual([undefined]);
  });
});

describe("runList — merged list (AC 33)", () => {
  test("--remote merges local + remote with local-wins dedup", async () => {
    const sharedId = "33333333-3333-3333-3333-333333333333";
    const lines: string[] = [];

    await runList(["--remote", "--output", "id"], {
      discoverSessionsFn: async () => [
        localSession({ id: sharedId, path: "/local/path/winning.jsonl" }),
      ],
      findRemoteSessionsViaApiFn: async () => [
        // Same session_id → must dedup with local kept.
        apiItem({ session_id: sharedId, first_user_message: "loser" }),
        // Different session_id → must appear.
        apiItem({ session_id: "44444444-4444-4444-4444-444444444444" }),
      ],
      log: (line) => lines.push(line),
      errorLog: () => {},
    });

    // `--output id` prints one id per line; we should see exactly two
    // distinct ids — the shared one (local wins) and the new remote-only.
    expect(lines.length).toBe(2);
    expect(lines).toContain(sharedId);
    expect(lines).toContain("44444444-4444-4444-4444-444444444444");
  });

  test("default `list` (no --remote) ignores the API finder entirely", async () => {
    let apiCalls = 0;
    await runList([], {
      discoverSessionsFn: async () => [localSession()],
      findRemoteSessionsViaApiFn: async () => {
        apiCalls++;
        return [apiItem()];
      },
      // extractSessionMeta would be called for the local row; stub it.
      extractSessionMetaFn: async () => ({
        messages: [],
        lineCount: 0,
        turnCount: 0,
        summary: null,
        hasUserMessages: false,
      }),
      log: () => {},
      errorLog: () => {},
    });
    expect(apiCalls).toBe(0);
  });
});

describe("runList — empty result", () => {
  test("--remote with no local + empty API response exits with NoSessionsFoundError message", async () => {
    const errors: string[] = [];
    await expect(
      runList(["--remote"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async () => [],
        log: () => {},
        errorLog: (line) => errors.push(line),
      }),
    ).rejects.toThrow(/__test_exit_1__/);
    expect(exitCalls).toEqual([1]);
    expect(errors.some((e) => e.startsWith("Error: "))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// `apiItemToSessionInfo` — direct adapter unit tests
//
// Today the adapter is covered transitively through the runList tests, but
// the boundary cases (empty title, empty first-user-message, malformed
// timestamp) deserve focused assertions so a regression doesn't have to
// trip a higher-level test to show up.
// ---------------------------------------------------------------------------

describe("apiItemToSessionInfo", () => {
  test("empty `display_title` → meta.summary is null", () => {
    const result = apiItemToSessionInfo(apiItem({ display_title: "" }));
    expect(result).not.toBeNull();
    expect(result!.meta?.summary).toBeNull();
  });

  test("empty `first_user_message` → hasUserMessages false, messages empty", () => {
    const result = apiItemToSessionInfo(
      apiItem({ first_user_message: null }),
    );
    expect(result).not.toBeNull();
    expect(result!.meta?.hasUserMessages).toBe(false);
    expect(result!.meta?.messages).toEqual([]);
  });

  test("populated `first_user_message` → hasUserMessages true, messages carries the line", () => {
    const result = apiItemToSessionInfo(
      apiItem({ first_user_message: "hi there" }),
    );
    expect(result).not.toBeNull();
    expect(result!.meta?.hasUserMessages).toBe(true);
    expect(result!.meta?.messages).toEqual(["hi there"]);
  });

  test("ISO `last_synced_at` parses to the expected Date", () => {
    const iso = "2026-05-11T09:00:00.000Z";
    const result = apiItemToSessionInfo(apiItem({ last_synced_at: iso }));
    expect(result).not.toBeNull();
    expect(result!.mtime).toBeInstanceOf(Date);
    expect(result!.mtime.toISOString()).toBe(iso);
  });

  test("malformed `last_synced_at` → drops the row (returns null)", () => {
    // Suppress the stderr warning the adapter emits — we only care that
    // the row is dropped, not how the warning is printed.
    const realError = console.error;
    console.error = () => {};
    try {
      const result = apiItemToSessionInfo(
        apiItem({ last_synced_at: "not-a-date" }),
      );
      expect(result).toBeNull();
    } finally {
      console.error = realError;
    }
  });

  test("returns SessionInfo shape with source=remote and path empty", () => {
    const result = apiItemToSessionInfo(apiItem());
    expect(result).not.toBeNull();
    expect(result!.source).toBe("remote");
    expect(result!.path).toBe("");
    expect(result!.project).toBe("");
    expect(result!.id).toBe("22222222-2222-2222-2222-222222222222");
  });
});

// ---------------------------------------------------------------------------
// ENG-5987 — default-filter subagent rows out of `session list --remote`.
//
// Phase 1 Red: pin the CLI behaviour contract. At runtime today:
//
//   - `parseListArgs` does not recognize `--include-subagents`, so the flag
//     is silently dropped and the finder is called without a subagent filter.
//   - `runList` does not thread an `include_subagents` filter to the API
//     finder (the field is not yet a key of `ApiListOptions`).
//
// Green wires the flag through CLI → finder → HTTP query string. The
// migration + service + route changes live in the integration test (sibling
// file). `is_subagent` is the column name on `dev_sessions`; we keep the
// same name across CLI / API / DB to avoid silent-mistranslation.
//
// `filtersSeen` is cast to `ApiListOptions & { include_subagents?: boolean }`
// at the read site so the wire-level assertion compiles without widening the
// public type's contract (the field is now on `ApiListOptions` after Green;
// the cast at the read site is belt-and-braces if/when a future refactor
// narrows the optionality away).
//
// Out of scope for these CLI tests:
//   - Visual differentiation of subagent rows in the renderer ([R*] vs [R]).
//     If/when we want that, it lands as a separate Phase. The Phase 1
//     contract is default-filter + opt-in flag, nothing more.
// ---------------------------------------------------------------------------

describe("runList — --remote subagent default-filter (ENG-5987)", () => {
  // Single-test contract: `--include-subagents` flips both the wire-value
  // (`include_subagents=true` on the finder filter) AND the rendered
  // output (subagent rows appear). This is the only new CLI behaviour
  // Phase 1 Green adds.
  //
  // We deliberately do NOT pin "default mode filters subagents out" at
  // the CLI layer: with a stub-server, today's no-filter pre-Green path
  // returns whatever the stub returns, so a passing assertion would be
  // testing the stub, not the production code. The user-visible
  // default-filter behaviour is pinned by the integration test (sibling
  // file), which exercises the real Postgres + service + route stack.

  test(
    "ENG-5987: --include-subagents threads true to the finder AND renders both rows",
    async () => {
      // Stub plays the server: returns BOTH when `include_subagents===true`,
      // otherwise only the chat row. Today the flag is silently dropped by
      // `parseListArgs`, so `inc` is undefined → stub returns [chat] →
      // renderer prints one line → both assertions below fail (the wire
      // value isn't `true`, and only one line was rendered). Right-reason
      // Red.
      const lines: string[] = [];
      const filtersSeen: ApiListOptions[] = [];
      const chatId = "55555555-5555-5555-5555-555555555555";
      const subId = "66666666-6666-6666-6666-666666666666";

      await runList(["--remote", "--include-subagents", "--output", "id"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          filtersSeen.push(filters);
          const inc = (filters as ApiListOptions & {
            include_subagents?: boolean;
          }).include_subagents;
          const chat = apiItem({ session_id: chatId, is_subagent: false });
          const sub = apiItem({ session_id: subId, is_subagent: true });
          return inc === true ? [chat, sub] : [chat];
        },
        log: (line) => lines.push(line),
        errorLog: () => {},
      });

      // Wire contract: opt-in must be EXPLICIT (`true`), not falsy/omitted.
      expect(filtersSeen.length).toBe(1);
      const filters = filtersSeen[0]! as ApiListOptions & {
        include_subagents?: boolean;
      };
      expect(filters.include_subagents).toBe(true);

      // User-visible: both rows render.
      expect(lines.length).toBe(2);
      expect(lines).toContain(chatId);
      expect(lines).toContain(subId);
    },
  );
});

// ---------------------------------------------------------------------------
// Warnings on mismatched flags (ENG-5995)
//
// `--profile` and `--include-subagents` only do work under `--remote`. Without
// the flag they're silently ignored — the user pays a typo and the CLI quietly
// runs the local-only path. Surface them.
// ---------------------------------------------------------------------------

describe("runList — warns on flags that only apply under --remote", () => {
  test("--profile without --remote emits warning to stderr", async () => {
    const errors: string[] = [];
    await runList(["--profile", "lihu-staging.owner@askeffi.ai:staging"], {
      discoverSessionsFn: async () => [localSession()],
      findRemoteSessionsViaApiFn: async () => [],
      extractSessionMetaFn: async () => ({
        messages: [],
        lineCount: 0,
        turnCount: 0,
        summary: null,
        hasUserMessages: false,
      }),
      log: () => {},
      errorLog: (line) => errors.push(line),
    });
    expect(errors.some((e) => /--profile.*--remote/i.test(e))).toBe(true);
  });

  test("--include-subagents without --remote emits warning to stderr", async () => {
    const errors: string[] = [];
    await runList(["--include-subagents"], {
      discoverSessionsFn: async () => [localSession()],
      findRemoteSessionsViaApiFn: async () => [],
      extractSessionMetaFn: async () => ({
        messages: [],
        lineCount: 0,
        turnCount: 0,
        summary: null,
        hasUserMessages: false,
      }),
      log: () => {},
      errorLog: (line) => errors.push(line),
    });
    expect(
      errors.some((e) => /--include-subagents.*--remote/i.test(e)),
    ).toBe(true);
  });

  test("flags WITH --remote emit no warning", async () => {
    const errors: string[] = [];
    await runList(
      ["--remote", "--profile", "p", "--include-subagents"],
      {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async () => [apiItem()],
        log: () => {},
        errorLog: (line) => errors.push(line),
      },
    );
    expect(
      errors.some((e) => /--remote/i.test(e)),
    ).toBe(false);
  });
});
