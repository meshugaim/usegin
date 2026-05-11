/**
 * Tests for `runSearch` — the `--remote` API path AND the default-mode
 * dispatch-to-semantic invariant (Step 5b of ENG-5861, AC 35).
 *
 * All external dependencies (API finder, console output, the semantic
 * shim itself) are injected. The tests never shell out to Python, never
 * touch the filesystem, never open sockets.
 *
 * Covers:
 *
 *   - `--remote "<q>"` calls `findRemoteSessionsViaApi` with `q` set in
 *     the filters envelope.
 *   - `--user`, `--since`, `--until`, `--status`, `--limit` all forward
 *     into `ApiListOptions`.
 *   - `--output id` / `--output json` paths render correctly; default
 *     `--output path` calls `formatListLine` and renders display_title
 *     (NOT first_user_message). De-tautologized fixture pattern.
 *   - Bare `session search "<q>"` (no `--remote`) does NOT invoke
 *     `findRemoteSessionsViaApi` and DOES invoke the semantic shim.
 *
 * AC 35 (ENG-5861).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  ApiFinderDeps,
  ApiFinderOptions,
  ApiListOptions,
  ApiSessionItem,
} from "../finder";
import type { SearchArgs } from "../cli-args";
import { runSearch } from "./search";

// ---------------------------------------------------------------------------
// Fixtures — same shape as list.test.ts so the two tests stay aligned.
// ---------------------------------------------------------------------------

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
// `process.exit` capture — runSearch calls it on empty result, which
// would otherwise terminate the test process. Stub for each test.
// ---------------------------------------------------------------------------

let exitCalls: number[] = [];
const realExit = process.exit;
beforeEach(() => {
  exitCalls = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.exit = ((code?: number) => {
    exitCalls.push(code ?? 0);
    throw new Error(`__test_exit_${code ?? 0}__`);
  }) as never;
});
afterEach(() => {
  process.exit = realExit;
});

// ---------------------------------------------------------------------------
// `--remote` path — calls the API with the right filters
// ---------------------------------------------------------------------------

describe("runSearch — --remote path (AC 35)", () => {
  test("forwards `q` (positional) into ApiListOptions", async () => {
    const calls: ApiListOptions[] = [];
    await runSearch(["--remote", "hello effi"], {
      findRemoteSessionsViaApiFn: async (_options, filters) => {
        calls.push(filters);
        return [apiItem()];
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(calls.length).toBe(1);
    expect(calls[0]?.q).toBe("hello effi");
  });

  test("forwards --limit / --user / --status into ApiListOptions", async () => {
    const calls: ApiListOptions[] = [];
    await runSearch(
      [
        "--remote",
        "needle",
        "--limit",
        "50",
        "--user",
        "00000000-0000-0000-0000-000000000abc",
        "--status",
        "completed",
      ],
      {
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          calls.push(filters);
          return [apiItem()];
        },
        log: () => {},
        errorLog: () => {},
      },
    );
    expect(calls.length).toBe(1);
    expect(calls[0]?.limit).toBe(50);
    expect(calls[0]?.user_id).toBe("00000000-0000-0000-0000-000000000abc");
    expect(calls[0]?.status).toBe("completed");
  });

  test("forwards --since / --until as ISO timestamps", async () => {
    const calls: ApiListOptions[] = [];
    await runSearch(
      ["--remote", "x", "--since", "7d", "--until", "1d"],
      {
        findRemoteSessionsViaApiFn: async (_options, filters) => {
          calls.push(filters);
          return [apiItem()];
        },
        log: () => {},
        errorLog: () => {},
      },
    );
    expect(calls.length).toBe(1);
    const got = calls[0]!;
    // Both should be ISO strings in the recent past.
    const sinceMs = new Date(got.since!).getTime();
    const untilMs = new Date(got.until!).getTime();
    expect(Number.isFinite(sinceMs)).toBe(true);
    expect(Number.isFinite(untilMs)).toBe(true);
    expect(sinceMs).toBeLessThan(untilMs); // 7d ago < 1d ago
    expect(untilMs).toBeLessThan(Date.now());
  });

  test("--remote does NOT invoke the semantic shim", async () => {
    let semanticCalls = 0;
    await runSearch(["--remote", "q"], {
      findRemoteSessionsViaApiFn: async () => [apiItem()],
      runSemanticFn: async () => {
        semanticCalls++;
        return 0;
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(semanticCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// `--remote` rendering — output format dispatches
// ---------------------------------------------------------------------------

describe("runSearch — --remote rendering", () => {
  test("--output path renders display_title (NOT first_user_message)", async () => {
    // De-tautologized fixture: the rendered line MUST come from
    // display_title (server-coalesced summary), not the raw first user
    // message. A regression that reads the wrong field can't sneak past
    // because the two strings are distinct.
    const lines: string[] = [];
    await runSearch(["--remote", "anything"], {
      findRemoteSessionsViaApiFn: async () => [
        apiItem({
          display_title: "summary text from server",
          first_user_message: "raw first user message",
        }),
      ],
      log: (line) => lines.push(line),
      errorLog: () => {},
    });
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("summary text from server");
    expect(lines[0]).not.toContain("raw first user message");
    // [R] prefix marks remote rows (formatListLine convention).
    expect(lines[0]?.startsWith("[R] ")).toBe(true);
  });

  test("--output id renders the session_id one-per-line", async () => {
    const lines: string[] = [];
    await runSearch(["--remote", "anything", "--output", "id"], {
      findRemoteSessionsViaApiFn: async () => [
        apiItem({ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
        apiItem({ session_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
      ],
      log: (line) => lines.push(line),
      errorLog: () => {},
    });
    expect(lines).toEqual([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    ]);
  });

  test("--output json renders JSON envelopes with source=remote", async () => {
    const lines: string[] = [];
    await runSearch(["--remote", "anything", "--output", "json"], {
      findRemoteSessionsViaApiFn: async () => [apiItem()],
      log: (line) => lines.push(line),
      errorLog: () => {},
    });
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.source).toBe("remote");
    expect(parsed.id).toBe("22222222-2222-2222-2222-222222222222");
  });

  test("--output path with API rows does NOT call extractSessionMeta", async () => {
    // API rows carry pre-extracted meta — the renderer must not fall
    // through to the filesystem extractor (path is ""; reading would
    // throw).
    let extractCalls = 0;
    await runSearch(["--remote", "x"], {
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

  test("--remote with empty result exits 1 with a clear stderr message", async () => {
    const errors: string[] = [];
    await expect(
      runSearch(["--remote", "no-such-query"], {
        findRemoteSessionsViaApiFn: async () => [],
        log: () => {},
        errorLog: (line) => errors.push(line),
      }),
    ).rejects.toThrow(/__test_exit_1__/);
    expect(exitCalls).toEqual([1]);
    expect(errors.some((e) => e.includes("no-such-query"))).toBe(true);
  });

  test("--remote with no query argument exits 1", async () => {
    const errors: string[] = [];
    let apiCalls = 0;
    await expect(
      runSearch(["--remote"], {
        findRemoteSessionsViaApiFn: async () => {
          apiCalls++;
          return [apiItem()];
        },
        log: () => {},
        errorLog: (line) => errors.push(line),
      }),
    ).rejects.toThrow(/__test_exit_1__/);
    expect(exitCalls).toEqual([1]);
    // Must not have hit the API — query validation is local.
    expect(apiCalls).toBe(0);
    expect(errors.some((e) => e.toLowerCase().includes("query"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Default (no --remote) path — semantic-shim dispatch invariant
// ---------------------------------------------------------------------------

describe("runSearch — default path preserves semantic-shim dispatch", () => {
  test("bare `session search '<q>'` does NOT call the API finder", async () => {
    let apiCalls = 0;
    let semanticArgs: SearchArgs | undefined;
    await runSearch(["rls policy supabase"], {
      findRemoteSessionsViaApiFn: async () => {
        apiCalls++;
        return [apiItem()];
      },
      runSemanticFn: async (args) => {
        semanticArgs = args;
        return 0;
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(apiCalls).toBe(0);
    expect(semanticArgs).toBeDefined();
    expect(semanticArgs?.query).toBe("rls policy supabase");
    expect(semanticArgs?.remote).toBe(false);
  });

  test("`-k 5` (semantic shim's own flag) lands in semanticRest, untouched", async () => {
    let semanticArgs: SearchArgs | undefined;
    await runSearch(["my query", "-k", "5"], {
      runSemanticFn: async (args) => {
        semanticArgs = args;
        return 0;
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(semanticArgs?.query).toBe("my query");
    expect(semanticArgs?.semanticRest).toEqual(["-k", "5"]);
  });

  test("`--index` lands in semanticRest (no positional needed)", async () => {
    // The legacy semantic CLI accepts `session search --index` with no
    // query. `parseSearchArgs` doesn't recognize `--index` as a known
    // flag, so it falls into `semanticRest` and the shim's argparse
    // handles it. `runSemanticSearch` (production) reads `--index` from
    // `semanticRest[0]` to switch scripts.
    let semanticArgs: SearchArgs | undefined;
    await runSearch(["--index"], {
      runSemanticFn: async (args) => {
        semanticArgs = args;
        return 0;
      },
      log: () => {},
      errorLog: () => {},
    });
    expect(semanticArgs?.remote).toBe(false);
    expect(semanticArgs?.query).toBe("");
    expect(semanticArgs?.semanticRest).toEqual(["--index"]);
  });

  test("default path returns without calling process.exit when shim is stubbed", async () => {
    // Real production path calls process.exit with the shim's exit code;
    // the test override should suppress that so the test process
    // survives. Asserting exit was NOT called is the inverse of
    // depending on the throw-stub above.
    await runSearch(["q"], {
      runSemanticFn: async () => 0,
      log: () => {},
      errorLog: () => {},
    });
    expect(exitCalls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// `parseSearchArgs` edge — invalid --status surfaces at CLI parse time,
// not API call time. Asserted by an integration-flavored test through
// runSearch (the parser throws; runSearch propagates).
// ---------------------------------------------------------------------------

describe("runSearch — argv validation", () => {
  test("invalid --status throws before any API call", async () => {
    let apiCalls = 0;
    await expect(
      runSearch(["--remote", "q", "--status", "bogus"], {
        findRemoteSessionsViaApiFn: async () => {
          apiCalls++;
          return [];
        },
        log: () => {},
        errorLog: () => {},
      }),
    ).rejects.toThrow(/Invalid --status/);
    expect(apiCalls).toBe(0);
  });
});
