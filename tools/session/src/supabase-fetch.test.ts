/**
 * Real-wire tests for `fetchFromSupabase` (ENG-5862 step 7, refactor).
 *
 * These tests pin the **on-disk placement contract** that the
 * mock-at-boundary tests in `fetch.supabase.test.ts` cannot reach. There,
 * `mock.module("./supabase-fetch", …)` swaps the function wholesale for a
 * pre-shaped result, so the body of `fetchFromSupabase` (auth →
 * `getSession` → signed-URL GET → decompress + place) is never exercised
 * and the disk layout is unverified.
 *
 * Here we exercise the real function with two seams mocked:
 *
 *   - `../../lib/auth/credentials` — so a CI/dev machine without
 *     `~/.effi/.../credentials.json` doesn't fail at the first hurdle, and
 *     so the test stays hermetic to the live profile.
 *   - `globalThis.fetch` — intercepts both the JSON GET (via
 *     `finder/api-client`'s `getSession`, which defaults `fetchImpl =
 *     fetch`) and the signed-URL bytes GET that `downloadAndWrite` makes.
 *
 * The load-bearing assertion is the nested subagent layout:
 *   `<projects-dir>/<projectHash>/<sessionId>/subagents/agent-<id>.jsonl`
 * which must match the agent-records branch (`fetch.ts`'s
 * `localSubagentDir = join(localDir, remote.id, "subagents")`) and the
 * empirical layout Claude itself writes. If the two cross-env paths
 * disagree, `claude --resume <parent-id>` finds the parent under one
 * shape and misses the subagents in the other — exactly the
 * half-history-is-no-history failure the step-7 charter exists to prevent.
 *
 * Linear: ENG-5862
 */

import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as RealCredentials from "../../lib/auth/credentials";
import * as RealFinder from "./finder";

// Snapshot real exports so `afterAll` can re-install them — `mock.module`
// is process-global and the rest of the suite (`bash.test.ts`,
// `fetch.test.ts`, etc.) would otherwise see our skeletons.
const REAL_CREDENTIALS_EXPORTS = { ...RealCredentials };
const REAL_FINDER_EXPORTS = { ...RealFinder };

afterAll(() => {
  mock.module("../../lib/auth/credentials", () => REAL_CREDENTIALS_EXPORTS);
  mock.module("./finder", () => REAL_FINDER_EXPORTS);
});

const FULL_UUID = "abcdef01-2345-6789-abcd-ef0123456789";

/**
 * Install a hermetic credentials + finder fixture pointing at a fresh
 * tmp projects-dir. Returns the tmp dir for cleanup. Each test should
 * call this in its own setup; per-test `rmSync` in `afterEach` keeps
 * disk state clean.
 */
function setupFixture(projectHash: string): { projectsDir: string } {
  const projectsDir = mkdtempSync(join(tmpdir(), "supabase-fetch-test-"));

  mock.module("../../lib/auth/credentials", () => ({
    readCredentials: mock(async () => ({
      access_token: "fake-jwt",
      refresh_token: "fake-refresh",
      email: "test@example.com",
      api_url: "http://localhost:63000",
    })),
    getApiUrl: mock(async () => "http://localhost:63000"),
  }));

  mock.module("./finder", () => ({
    ...REAL_FINDER_EXPORTS,
    getCurrentProjectHash: () => projectHash,
    getClaudeProjectsDir: () => projectsDir,
  }));

  return { projectsDir };
}

/**
 * Build a gzipped JSONL byte blob for a signed-URL response. Body shape
 * doesn't matter to placement — `downloadAndWrite` just gunzips and
 * writes the bytes — but we use a recognisable summary line so a
 * post-write `readFileSync` can confirm the right URL landed at the
 * right path.
 */
function gzipBytes(text: string): Uint8Array {
  return Bun.gzipSync(new TextEncoder().encode(text));
}

const createdDirs: string[] = [];

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

describe("fetchFromSupabase — nested subagent placement (ENG-5862)", () => {
  test(
    "parent + N subagents land at <projects-dir>/<sessionId>/subagents/agent-<id>.jsonl",
    async () => {
      const projectHash = "test-project-hash";
      const { projectsDir } = setupFixture(projectHash);
      createdDirs.push(projectsDir);

      const parentGz = gzipBytes('{"type":"summary","summary":"parent"}');
      const subA = "11111111-aaaa-1111-aaaa-111111111111";
      const subB = "22222222-bbbb-2222-bbbb-222222222222";
      const subAGz = gzipBytes(`{"type":"summary","summary":"sub-${subA}"}`);
      const subBGz = gzipBytes(`{"type":"summary","summary":"sub-${subB}"}`);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (mock(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(`/api/v1/dev-sessions/${FULL_UUID}`)) {
          return new Response(
            JSON.stringify({
              session: { id: FULL_UUID, session_id: FULL_UUID },
              signed_url: "https://signed.example/parent",
              subagent_paths: [
                { agent_id: subA, signed_url: "https://signed.example/sub-a" },
                { agent_id: subB, signed_url: "https://signed.example/sub-b" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url === "https://signed.example/parent") {
          return new Response(parentGz, { status: 200 });
        }
        if (url === "https://signed.example/sub-a") {
          return new Response(subAGz, { status: 200 });
        }
        if (url === "https://signed.example/sub-b") {
          return new Response(subBGz, { status: 200 });
        }
        return new Response("unexpected url: " + url, { status: 500 });
      }) as unknown) as typeof fetch;

      try {
        // Lazy import after mocks installed so the module captures our
        // mocked credentials + finder exports.
        const { fetchFromSupabase } = await import("./supabase-fetch");

        const result = await fetchFromSupabase(FULL_UUID);

        expect(result.ok).toBe(true);
        if (!result.ok) return; // narrowing — already failed above
        expect(result.subagentCount).toBe(2);

        // Load-bearing: NESTED placement. The parent under
        // `<projects-dir>/<projectHash>/<sessionId>.jsonl` and each
        // subagent under `<projects-dir>/<projectHash>/<sessionId>/
        // subagents/agent-<id>.jsonl` — matching the agent-records
        // branch + empirical Claude layout. Without this assertion, a
        // refactor could flip back to FLAT placement (the original
        // step-7 Green shape) and `claude --resume` would silently lose
        // the subagent context.
        const expectedParent = join(
          projectsDir,
          projectHash,
          `${FULL_UUID}.jsonl`,
        );
        const expectedSubADir = join(
          projectsDir,
          projectHash,
          FULL_UUID,
          "subagents",
        );
        const expectedSubA = join(expectedSubADir, `agent-${subA}.jsonl`);
        const expectedSubB = join(expectedSubADir, `agent-${subB}.jsonl`);

        expect(result.localPath).toBe(expectedParent);
        expect(existsSync(expectedParent)).toBe(true);
        expect(existsSync(expectedSubA)).toBe(true);
        expect(existsSync(expectedSubB)).toBe(true);

        // And not FLAT — anti-regression on the old layout. If both the
        // nested AND the flat path existed we'd silently double-write.
        const flatSubA = join(
          projectsDir,
          projectHash,
          `agent-${subA}.jsonl`,
        );
        expect(existsSync(flatSubA)).toBe(false);

        // And the right bytes landed at each path (paranoia: confirm we
        // didn't accidentally write the parent body to the subagent
        // path or vice versa).
        const parentText = readFileSync(expectedParent, "utf-8");
        const subAText = readFileSync(expectedSubA, "utf-8");
        expect(parentText).toContain("parent");
        expect(subAText).toContain(`sub-${subA}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );

  test(
    "ENG-5986: uppercase prefix input is lowercased before hitting the API",
    async () => {
      // Strict gateway + forgiving CLI (ENG-5986 follow-up). The
      // `/api/v1/dev-sessions` route's `session_id_prefix` regex rejects
      // uppercase with a 400 because `dev_sessions.session_id` stores
      // canonical-lowercase UUIDs and the service-layer `LIKE` filter is
      // case-sensitive. The CLI compensates by lowercasing user input
      // before sending — so a copy-paste of `7C99A7ED` from a SHA-style
      // short id still resolves end-to-end against an actual session.
      //
      // We pin this at the wire so a refactor that drops the
      // normalization would surface here, not in a confusing 400 from
      // the route the next time a user types uppercase.
      const projectHash = "test-project-hash-lowercase";
      const { projectsDir } = setupFixture(projectHash);
      createdDirs.push(projectsDir);

      const upperPrefix = "ABCDEF01";
      const lowerPrefix = "abcdef01";
      const parentGz = gzipBytes('{"type":"summary","summary":"parent"}');

      // Capture every URL the CLI fetches so we can assert the API call
      // carried the lowercased prefix — the load-bearing observable.
      const seenUrls: string[] = [];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (mock(async (input: RequestInfo | URL) => {
        const url = String(input);
        seenUrls.push(url);
        if (url.includes("/api/v1/dev-sessions?")) {
          // Prefix-resolve list call. Return one match keyed on FULL_UUID.
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "row-id",
                  session_id: FULL_UUID,
                  last_synced_at: "2026-05-13T00:00:00Z",
                },
              ],
              next_cursor: null,
              has_more: false,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.endsWith(`/api/v1/dev-sessions/${FULL_UUID}`)) {
          // Single-session GET after the prefix resolved.
          return new Response(
            JSON.stringify({
              session: { id: FULL_UUID, session_id: FULL_UUID },
              signed_url: "https://signed.example/parent",
              subagent_paths: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url === "https://signed.example/parent") {
          return new Response(parentGz, { status: 200 });
        }
        return new Response("unexpected url: " + url, { status: 500 });
      }) as unknown) as typeof fetch;

      try {
        const { fetchFromSupabase } = await import("./supabase-fetch");

        const result = await fetchFromSupabase(upperPrefix);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.sessionId).toBe(FULL_UUID);

        // Find the list-call URL and assert it carried the LOWERCASED
        // prefix on the wire, NOT the uppercase the user typed.
        const listUrl = seenUrls.find((u) => u.includes("session_id_prefix="));
        expect(listUrl).toBeDefined();
        expect(listUrl).toContain(`session_id_prefix=${lowerPrefix}`);
        expect(listUrl).not.toContain(`session_id_prefix=${upperPrefix}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );

  test("subagent failure mid-loop → transport_error carries partialSuccess paths", async () => {
    const projectHash = "test-project-hash-partial";
    const { projectsDir } = setupFixture(projectHash);
    createdDirs.push(projectsDir);

    const parentGz = gzipBytes('{"type":"summary","summary":"parent"}');
    const subA = "33333333-aaaa-3333-aaaa-333333333333";
    const subB = "44444444-bbbb-4444-bbbb-444444444444";
    const subAGz = gzipBytes(`{"type":"summary","summary":"sub-${subA}"}`);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/dev-sessions/${FULL_UUID}`)) {
        return new Response(
          JSON.stringify({
            session: { id: FULL_UUID, session_id: FULL_UUID },
            signed_url: "https://signed.example/parent",
            subagent_paths: [
              { agent_id: subA, signed_url: "https://signed.example/sub-a" },
              {
                agent_id: subB,
                signed_url: "https://signed.example/sub-b-broken",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url === "https://signed.example/parent") {
        return new Response(parentGz, { status: 200 });
      }
      if (url === "https://signed.example/sub-a") {
        return new Response(subAGz, { status: 200 });
      }
      if (url === "https://signed.example/sub-b-broken") {
        return new Response("storage object missing", { status: 500 });
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown) as typeof fetch;

    try {
      const { fetchFromSupabase } = await import("./supabase-fetch");

      const result = await fetchFromSupabase(FULL_UUID);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe("transport_error");
      if (result.error.kind !== "transport_error") return;
      expect(result.error.body).toContain(subB);

      // partialSuccess names everything that DID land before the failure,
      // so `fetchSession`'s translator can tell the user "parent + 1 of
      // 2 subagents already on disk". Without this signal the user sees
      // a bare 500 and doesn't know retrying is cheap (idempotent
      // overwrite).
      const partial = result.error.partialSuccess;
      expect(partial).toBeDefined();
      expect(partial?.parentPath).toBe(
        join(projectsDir, projectHash, `${FULL_UUID}.jsonl`),
      );
      expect(partial?.subagentPaths).toEqual([
        join(
          projectsDir,
          projectHash,
          FULL_UUID,
          "subagents",
          `agent-${subA}.jsonl`,
        ),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
