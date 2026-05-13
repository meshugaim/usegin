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
// Phase 1 Red: these tests pin the CLI surface area for the
// subagent-default-filter feature. They fail today because:
//
//   - `parseListArgs` does not recognize `--include-subagents` (the flag is
//     silently dropped, so under the current code both calls look the same).
//   - `runList` does not thread an `include_subagents` filter to the API
//     finder (the new query field doesn't exist on `ApiListOptions` yet).
//   - `ApiSessionItem` does not carry `is_subagent`, so the renderer has no
//     way to mark a remote row as a subagent transcript.
//
// Wes-Green (phase 1 Green) wires the flag through CLI → finder → HTTP query
// string and surfaces `is_subagent` on the response shape. The migration +
// service + route changes live in the integration test (sibling file).
//
// `is_subagent` is the column name on `dev_sessions`; we keep the same name
// across CLI / API / DB to avoid the silent-mistranslation trap where a
// `is_subagent` row gets surfaced as `kind: "subagent"` on the wire and then
// has to be re-aliased back in the CLI. One name, three layers.
//
// Strategy note for the reader: today the new field doesn't exist on
// `ApiSessionItem` or `ApiListOptions`. The tests read the new field via a
// runtime cast so the FILE compiles. The behavior assertions still fail —
// because the flag isn't parsed, the filter isn't threaded, and the field
// isn't carried. That's the right-reason Red per `feedback_green_right_reason`.
// ---------------------------------------------------------------------------

/** Cast helper: stamp an `is_subagent` flag onto an `ApiSessionItem` fixture
 * without breaking `Partial<ApiSessionItem>` typing on the base factory.
 * After Green lands, the field becomes part of `ApiSessionItem` and this
 * helper collapses to `apiItem({ is_subagent: ... })`. */
function subagentApiItem(
  isSubagent: boolean,
  overrides: Partial<ApiSessionItem> = {},
): ApiSessionItem {
  const base = apiItem(overrides);
  return Object.assign(base, { is_subagent: isSubagent });
}

describe("runList — --remote subagent default-filter (ENG-5987)", () => {
  test.failing(
    "ENG-5987: default (no flag) threads include_subagents=false to the API finder",
    async () => {
      const filtersSeen: ApiListOptions[] = [];

      await runList(["--remote"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          filtersSeen.push(filters);
          return [];
        },
        log: () => {},
        errorLog: () => {},
      }).catch(() => {
        // Empty result path calls process.exit; the stub throws. The behavior
        // we care about is that the finder was called with the right
        // filter — that signal lives in `filtersSeen` regardless of how the
        // empty-list error path resolves.
      });

      expect(filtersSeen.length).toBe(1);
      const filters = filtersSeen[0]! as ApiListOptions & {
        include_subagents?: boolean;
      };
      expect(filters.include_subagents).toBe(false);
    },
  );

  test.failing(
    "ENG-5987: --include-subagents threads include_subagents=true to the API finder",
    async () => {
      const filtersSeen: ApiListOptions[] = [];

      await runList(["--remote", "--include-subagents"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          filtersSeen.push(filters);
          return [];
        },
        log: () => {},
        errorLog: () => {},
      }).catch(() => {
        // See sibling-test comment above.
      });

      expect(filtersSeen.length).toBe(1);
      const filters = filtersSeen[0]! as ApiListOptions & {
        include_subagents?: boolean;
      };
      expect(filters.include_subagents).toBe(true);
    },
  );

  test.failing(
    "ENG-5987: default-filter end-to-end — server returns only chat, renderer renders only chat",
    async () => {
      // End-to-end pin (CLI → finder filter → simulated server filter →
      // renderer). The finder stub plays the server: when
      // `include_subagents` is truthy it returns BOTH rows; when falsy it
      // returns only the chat row.
      //
      // Today this fails for the right reason: the CLI does not pass
      // `include_subagents` at all (the flag isn't parsed, the field isn't
      // a known `ApiListOptions` key), so the stub's `inc` is undefined and
      // the falsy branch DOES return [chat]. The render side then prints
      // one id. That LOOKS like a pass — but the load-bearing assertion
      // below pins the filter VALUE explicitly (`=== false`, not just
      // "falsy"), which today is undefined.
      const lines: string[] = [];
      const filtersSeen: ApiListOptions[] = [];
      const chatId = "55555555-5555-5555-5555-555555555555";

      await runList(["--remote", "--output", "id"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          filtersSeen.push(filters);
          const inc = (filters as ApiListOptions & {
            include_subagents?: boolean;
          }).include_subagents;
          const chat = subagentApiItem(false, { session_id: chatId });
          const sub = subagentApiItem(true, {
            session_id: "66666666-6666-6666-6666-666666666666",
          });
          return inc ? [chat, sub] : [chat];
        },
        log: (line) => lines.push(line),
        errorLog: () => {},
      });

      expect(lines).toEqual([chatId]);
      // Load-bearing: the CLI MUST explicitly request the filtered view by
      // sending `include_subagents=false`, not just omit the key. Omission
      // and explicit-false are equivalent on the server today, but pinning
      // the explicit value catches the regression where a future refactor
      // drops the field assuming the server default does the work.
      const filters = filtersSeen[0]! as ApiListOptions & {
        include_subagents?: boolean;
      };
      expect(filters.include_subagents).toBe(false);
    },
  );

  test.failing(
    "ENG-5987: --include-subagents renders both chat and subagent rows",
    async () => {
      const lines: string[] = [];
      const chatId = "77777777-7777-7777-7777-777777777777";
      const subId = "88888888-8888-8888-8888-888888888888";

      await runList(["--remote", "--include-subagents", "--output", "id"], {
        discoverSessionsFn: async () => [],
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          const inc = (filters as ApiListOptions & {
            include_subagents?: boolean;
          }).include_subagents;
          const chat = subagentApiItem(false, { session_id: chatId });
          const sub = subagentApiItem(true, { session_id: subId });
          return inc ? [chat, sub] : [chat];
        },
        log: (line) => lines.push(line),
        errorLog: () => {},
      });

      expect(lines.length).toBe(2);
      expect(lines).toContain(chatId);
      expect(lines).toContain(subId);
    },
  );

  test.failing(
    "ENG-5987: apiItemToSessionInfo surfaces is_subagent on SessionInfo.meta",
    () => {
      // The renderer needs a stable signal for "this row is a subagent" so a
      // future UI can mark it (e.g., "[R*]" instead of "[R]"). Today
      // `SessionInfo.meta` carries no such field; Green adds it and the
      // adapter propagates it from `ApiSessionItem.is_subagent`.
      const sub = subagentApiItem(true);
      const result = apiItemToSessionInfo(sub);
      expect(result).not.toBeNull();
      const meta = result!.meta as { is_subagent?: boolean } | undefined;
      expect(meta?.is_subagent).toBe(true);

      const chat = subagentApiItem(false);
      const chatResult = apiItemToSessionInfo(chat);
      const chatMeta = chatResult!.meta as { is_subagent?: boolean } | undefined;
      expect(chatMeta?.is_subagent).toBe(false);
    },
  );
});
