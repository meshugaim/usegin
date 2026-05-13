/**
 * Tests for the dev-sessions HTTP client (Step 5a of ENG-5861).
 *
 * Pure HTTP client over `/api/v1/dev-sessions` (list) and
 * `/api/v1/dev-sessions/{id}` (single). All tests inject a `fetchImpl` so no
 * sockets open. Mirrors the `tools/session-sync/tests/sync-client.test.ts`
 * shape — same FetchLike signature, same response-classification idiom.
 */

import { describe, expect, test } from "bun:test";
import {
  type ApiAuthContext,
  type ApiClientError,
  type FetchLike,
  getSession,
  listSessions,
} from "./api-client";

const auth: ApiAuthContext = {
  apiUrl: "http://localhost:63000",
  token: "fake-jwt",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sampleItem = {
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
  is_subagent: false,
  display_title: "hi",
  created_at: "2026-05-08T11:59:00.000Z",
  updated_at: "2026-05-08T12:00:00.000Z",
};

// =============================================================================
// listSessions
// =============================================================================

describe("listSessions — URL + query string", () => {
  test("GETs /api/v1/dev-sessions with no params", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl: FetchLike = async (input, init) => {
      seen.url = String(input);
      seen.init = init;
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(auth, {}, fetchImpl);
    expect(seen.url).toBe("http://localhost:63000/api/v1/dev-sessions");
    expect(seen.init?.method).toBe("GET");
  });

  test("composes all filter params into the query string", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(
      auth,
      {
        limit: 25,
        cursor: "opaque-cursor",
        user_id: "33333333-3333-3333-3333-333333333333",
        status: "active",
        since: "2026-05-01T00:00:00.000Z",
        until: "2026-05-08T00:00:00.000Z",
        q: "memento",
      },
      fetchImpl,
    );
    // Just verify the URL has all the fields; order is not load-bearing.
    const url = new URL(seen.url ?? "");
    expect(url.pathname).toBe("/api/v1/dev-sessions");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("opaque-cursor");
    expect(url.searchParams.get("user_id")).toBe(
      "33333333-3333-3333-3333-333333333333",
    );
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.get("since")).toBe("2026-05-01T00:00:00.000Z");
    expect(url.searchParams.get("until")).toBe("2026-05-08T00:00:00.000Z");
    expect(url.searchParams.get("q")).toBe("memento");
  });

  test("trailing slash on apiUrl is normalized", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(
      { apiUrl: "http://localhost:63000///", token: "t" },
      {},
      fetchImpl,
    );
    expect(seen.url).toBe("http://localhost:63000/api/v1/dev-sessions");
  });

  test("URL-encodes q with spaces and special characters", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(auth, { q: "hello world & more" }, fetchImpl);
    const url = new URL(seen.url ?? "");
    expect(url.searchParams.get("q")).toBe("hello world & more");
  });
});

describe("listSessions — headers", () => {
  test("Authorization Bearer header is set", async () => {
    const seen: { init?: RequestInit } = {};
    const fetchImpl: FetchLike = async (_input, init) => {
      seen.init = init;
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(
      { apiUrl: "http://localhost:63000", token: "the-jwt" },
      {},
      fetchImpl,
    );
    const headers = new Headers(seen.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer the-jwt");
  });
});

describe("listSessions — response classification", () => {
  test("200 → returns parsed envelope", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        items: [sampleItem],
        next_cursor: "cursor-2",
        has_more: true,
      });
    const out = await listSessions(auth, {}, fetchImpl);
    expect(out.items).toEqual([sampleItem]);
    expect(out.next_cursor).toBe("cursor-2");
    expect(out.has_more).toBe(true);
  });

  test("401 → throws ApiClientError kind=auth_failed", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(401, { error: "Unauthorized" });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.kind).toBe("auth_failed");
    expect(caught?.status).toBe(401);
  });

  test("403 → throws ApiClientError kind=auth_failed", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(403, { error: "Forbidden" });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("auth_failed");
    expect(caught?.status).toBe(403);
  });

  test("503 sync_disabled → throws kind=kill_switch (defensive)", async () => {
    // Spec line 153 says GETs stay open; this is defensive.
    const fetchImpl: FetchLike = async () =>
      jsonResponse(503, { error: "sync_disabled" });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("kill_switch");
    expect(caught?.status).toBe(503);
  });

  test("500 → throws kind=transient", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(500, { error: "Something went wrong" });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("transient");
    expect(caught?.status).toBe(500);
  });

  test("400 → throws kind=other", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(400, { error: "Invalid cursor." });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("other");
    expect(caught?.status).toBe(400);
  });

  test("network throw propagates", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(listSessions(auth, {}, fetchImpl)).rejects.toThrow(
      "ECONNREFUSED",
    );
  });

  test("200 with malformed JSON body → throws kind=other status=200", async () => {
    // Proxy mangling, content-type mismatch, or stream cut can land a 200 with
    // non-JSON text. Without the structural guard the cast lies and downstream
    // crashes; assert we throw at the boundary instead.
    const fetchImpl: FetchLike = async () =>
      new Response("not-valid-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    let caught: ApiClientError | null = null;
    try {
      await listSessions(auth, {}, fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("other");
    expect(caught?.status).toBe(200);
  });

  test("cursor passthrough on second page", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        items: [],
        next_cursor: null,
        has_more: false,
      });
    };
    await listSessions(auth, { cursor: "page-2-cursor" }, fetchImpl);
    const url = new URL(seen.url ?? "");
    expect(url.searchParams.get("cursor")).toBe("page-2-cursor");
  });
});

// =============================================================================
// getSession
// =============================================================================

describe("getSession — URL + headers", () => {
  test("GETs /api/v1/dev-sessions/{id}", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl: FetchLike = async (input, init) => {
      seen.url = String(input);
      seen.init = init;
      return jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
      });
    };
    await getSession(auth, "22222222-2222-2222-2222-222222222222", fetchImpl);
    expect(seen.url).toBe(
      "http://localhost:63000/api/v1/dev-sessions/22222222-2222-2222-2222-222222222222",
    );
    expect(seen.init?.method).toBe("GET");
  });

  test("URL-encodes the session_id path segment", async () => {
    const seen: { url?: string } = {};
    const fetchImpl: FetchLike = async (input) => {
      seen.url = String(input);
      return jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
      });
    };
    // Synthetic test fixture id with a slash character — must be encoded so
    // it doesn't escape the path segment.
    await getSession(auth, "weird/id with space", fetchImpl);
    expect(seen.url).toContain("weird%2Fid%20with%20space");
  });

  test("Authorization Bearer header is set", async () => {
    const seen: { init?: RequestInit } = {};
    const fetchImpl: FetchLike = async (_input, init) => {
      seen.init = init;
      return jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
      });
    };
    await getSession(
      { apiUrl: "http://localhost:63000", token: "the-jwt" },
      "id",
      fetchImpl,
    );
    const headers = new Headers(seen.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer the-jwt");
  });
});

describe("getSession — response classification", () => {
  test("200 → returns { session, signed_url }", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
      });
    const out = await getSession(auth, "id", fetchImpl);
    expect(out).not.toBeNull();
    expect(out?.session).toEqual(sampleItem);
    expect(out?.signed_url).toBe("https://signed.example/abc");
  });

  test("404 not_found → returns null", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(404, { error: "not_found" });
    const out = await getSession(auth, "missing-id", fetchImpl);
    expect(out).toBeNull();
  });

  test("401 → throws kind=auth_failed", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(401, { error: "Unauthorized" });
    let caught: ApiClientError | null = null;
    try {
      await getSession(auth, "id", fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("auth_failed");
    expect(caught?.status).toBe(401);
  });

  test("500 → throws kind=transient", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(500, { error: "storage_object_missing" });
    let caught: ApiClientError | null = null;
    try {
      await getSession(auth, "id", fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("transient");
    expect(caught?.status).toBe(500);
  });

  test("400 → throws kind=other", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(400, { error: "invalid_session_id" });
    let caught: ApiClientError | null = null;
    try {
      await getSession(auth, "id", fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("other");
    expect(caught?.status).toBe(400);
  });

  test("network throw propagates", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(getSession(auth, "id", fetchImpl)).rejects.toThrow(
      "ECONNREFUSED",
    );
  });

  test("200 with malformed JSON body → throws kind=other status=200", async () => {
    // Same guard as listSessions: a 200 with unparseable body must throw at
    // the boundary rather than letting a `null` cast escape into Step 5b.
    const fetchImpl: FetchLike = async () =>
      new Response("not-valid-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    let caught: ApiClientError | null = null;
    try {
      await getSession(auth, "id", fetchImpl);
    } catch (e) {
      caught = e as ApiClientError;
    }
    expect(caught?.kind).toBe("other");
    expect(caught?.status).toBe(200);
  });

  // ===========================================================================
  // subagent_paths defensive coercion
  // ===========================================================================
  //
  // The server contract guarantees `subagent_paths` is always present as
  // an array (empty when no subagents). `getSession` defensively coerces
  // a missing or non-array field to `[]` so a downlevel server or future
  // spec drift doesn't crash the CLI's subagent-loop iteration. These
  // tests pin that coercion — without them a refactor that drops the
  // `Array.isArray` guard would silently let `undefined` or `null`
  // propagate to `for (const sub of payload.subagent_paths)` and throw
  // an unhelpful TypeError at the point of iteration.

  test("200 without subagent_paths field → returns []", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
        // subagent_paths omitted entirely
      });
    const out = await getSession(auth, "id", fetchImpl);
    expect(out).not.toBeNull();
    expect(out?.subagent_paths).toEqual([]);
  });

  test("200 with subagent_paths: null → returns []", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
        subagent_paths: null,
      });
    const out = await getSession(auth, "id", fetchImpl);
    expect(out).not.toBeNull();
    expect(out?.subagent_paths).toEqual([]);
  });

  test("200 with subagent_paths array → returns the array", async () => {
    const sub = {
      agent_id: "55555555-5555-5555-5555-555555555555",
      signed_url: "https://signed.example/sub",
    };
    const fetchImpl: FetchLike = async () =>
      jsonResponse(200, {
        session: sampleItem,
        signed_url: "https://signed.example/abc",
        subagent_paths: [sub],
      });
    const out = await getSession(auth, "id", fetchImpl);
    expect(out?.subagent_paths).toEqual([sub]);
  });
});
