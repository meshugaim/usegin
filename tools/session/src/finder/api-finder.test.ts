/**
 * Tests for the high-level API-driven finder (Step 5a of ENG-5861).
 *
 * Wraps `api-client.ts` with credential resolution from the Effi CLI's
 * profile-aware store. Both fetch and the credentials reader are
 * dependency-injected — the unit test never touches `~/.effi/`.
 */

import { describe, expect, test } from "bun:test";
import type { FetchLike } from "./api-client";
import {
  findRemoteSessionsViaApi,
  resolveRemoteSessionViaApi,
} from "./api-finder";

const SAMPLE_ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  session_id: "22222222-2222-2222-2222-222222222222",
  user_id: "33333333-3333-3333-3333-333333333333",
  username: "lihu",
  environment_kind: "local-devcontainer",
  environment_id: "env-1",
  project_path: "/workspaces/test-mvp",
  git_branch: "main",
  git_sha: "abc1234",
  claude_model: "claude-opus-4-7",
  status: "active",
  started_at: null,
  last_synced_at: "2026-05-08T12:00:00.000Z",
  turn_count: 12,
  line_count: 42,
  file_size_bytes: 1024,
  gzipped_size_bytes: 512,
  content_hash: "a".repeat(64),
  preview_first: ["hi"],
  preview_last: ["bye"],
  summary: null,
  summary_generated_at: null,
  first_user_message: "hi",
  storage_path: "u/2026-05-08/sess.jsonl.gz",
  parent_session_id: null,
  forked_at_turn: null,
  display_title: "hi",
  created_at: "2026-05-08T11:59:00.000Z",
  updated_at: "2026-05-08T12:00:00.000Z",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const credsOk = {
  access_token: "fake-jwt",
  refresh_token: "r",
  email: "x@y.z",
  api_url: "http://localhost:63000",
};

describe("findRemoteSessionsViaApi", () => {
  test("threads profile through credentials reader and returns first page items", async () => {
    const seen: { profileNames: (string | undefined)[]; url?: string } = {
      profileNames: [],
    };
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [SAMPLE_ITEM],
        next_cursor: "next",
        has_more: true,
      });
    };
    const out = await findRemoteSessionsViaApi(
      { profileName: "agent-dev" },
      { status: "active" },
      {
        fetchImpl,
        readCredentialsFn: async (name) => {
          seen.profileNames.push(name);
          return credsOk;
        },
        getApiUrlFn: async (name) => {
          seen.profileNames.push(name);
          return "http://localhost:63000";
        },
      },
    );
    expect(out).toEqual([SAMPLE_ITEM]);
    expect(seen.profileNames).toEqual(["agent-dev", "agent-dev"]);
    expect(new URL(seen.url ?? "").searchParams.get("status")).toBe("active");
  });

  test("forwards limit and q filters", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await findRemoteSessionsViaApi(
      {},
      { limit: 50, q: "search-term" },
      {
        fetchImpl,
        readCredentialsFn: async () => credsOk,
        getApiUrlFn: async () => "http://localhost:63000",
      },
    );
    const url = new URL(seen.url ?? "");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("q")).toBe("search-term");
  });

  test("throws clear error when credentials are missing", async () => {
    await expect(
      findRemoteSessionsViaApi(
        {},
        {},
        {
          fetchImpl: async () => new Response("", { status: 200 }),
          readCredentialsFn: async () => null,
          getApiUrlFn: async () => "http://localhost:63000",
        },
      ),
    ).rejects.toThrow(/no credentials/i);
  });
});

describe("resolveRemoteSessionViaApi", () => {
  test("returns { session, signed_url } on 200", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: SAMPLE_ITEM,
        signed_url: "https://signed.example/abc",
      });
    const out = await resolveRemoteSessionViaApi(
      {},
      "22222222-2222-2222-2222-222222222222",
      {
        fetchImpl,
        readCredentialsFn: async () => credsOk,
        getApiUrlFn: async () => "http://localhost:63000",
      },
    );
    expect(out?.session).toEqual(SAMPLE_ITEM);
    expect(out?.signed_url).toBe("https://signed.example/abc");
  });

  test("returns null on 404", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(404, { error: "not_found" });
    const out = await resolveRemoteSessionViaApi({}, "missing-id", {
      fetchImpl,
      readCredentialsFn: async () => credsOk,
      getApiUrlFn: async () => "http://localhost:63000",
    });
    expect(out).toBeNull();
  });

  test("propagates auth_failed error from underlying client", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(401, { error: "Unauthorized" });
    await expect(
      resolveRemoteSessionViaApi({}, "id", {
        fetchImpl,
        readCredentialsFn: async () => credsOk,
        getApiUrlFn: async () => "http://localhost:63000",
      }),
    ).rejects.toThrow();
  });

  test("threads profileName through both readers", async () => {
    const seen: (string | undefined)[] = [];
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: SAMPLE_ITEM,
        signed_url: "https://signed.example/abc",
      });
    await resolveRemoteSessionViaApi(
      { profileName: "staging" },
      "id",
      {
        fetchImpl,
        readCredentialsFn: async (name) => {
          seen.push(name);
          return credsOk;
        },
        getApiUrlFn: async (name) => {
          seen.push(name);
          return "http://localhost:63000";
        },
      },
    );
    expect(seen).toEqual(["staging", "staging"]);
  });
});
