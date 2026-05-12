import { describe, expect, test } from "bun:test";
import {
	type FetchLike,
	postSync,
	type SyncRequest,
} from "../src/sync-client.ts";

const baseMetadata = {
	turn_count: 2,
	line_count: 4,
	project_path: "/workspaces/test-mvp",
	environment_kind: "local-devcontainer" as const,
	environment_id: "env-id-123",
	username: "lihu",
	status: "active" as const,
	preview_first: ["hi"],
	preview_last: ["bye"],
	first_user_message: "hi",
	file_size_bytes: 256,
	gzipped_size_bytes: 128,
	git_branch: "main",
	git_sha: "abc1234",
	claude_model: "claude-opus-4-7",
};

function baseReq(overrides: Partial<SyncRequest> = {}): SyncRequest {
	return {
		apiUrl: "http://localhost:63000",
		token: "fake-jwt",
		sessionId: "sess-1",
		contentHash: "a".repeat(64),
		fileBytes: new Uint8Array([1, 2, 3, 4, 5]),
		metadata: baseMetadata,
		...overrides,
	};
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("postSync — URL routing", () => {
	test("parent route when agentId is omitted", async () => {
		const seen: { url?: string; init?: RequestInit } = {};
		const fetchImpl: FetchLike = async (input, init) => {
			seen.url = String(input);
			seen.init = init;
			return jsonResponse(200, { session: { id: "row-1" } });
		};
		await postSync(baseReq({ sessionId: "abc" }), fetchImpl);
		expect(seen.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/abc/sync",
		);
	});

	test("subagent route when agentId is provided", async () => {
		const seen: { url?: string } = {};
		const fetchImpl: FetchLike = async (input) => {
			seen.url = String(input);
			return jsonResponse(200, { session: { id: "row-1" } });
		};
		await postSync(
			baseReq({ sessionId: "parent-1", agentId: "agent-uuid" }),
			fetchImpl,
		);
		expect(seen.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/parent-1/subagents/agent-uuid/sync",
		);
	});
});

describe("postSync — headers + body shape", () => {
	test("Authorization Bearer token header", async () => {
		const seen: { init?: RequestInit } = {};
		const fetchImpl: FetchLike = async (_input, init) => {
			seen.init = init;
			return jsonResponse(200, { session: {} });
		};
		await postSync(baseReq({ token: "the-jwt" }), fetchImpl);
		const headers = new Headers(seen.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer the-jwt");
	});

	test("body is FormData with file Blob, metadata JSON, content_hash", async () => {
		const seen: { body?: RequestInit["body"] | null } = {};
		const fetchImpl: FetchLike = async (_input, init) => {
			seen.body = init?.body;
			return jsonResponse(200, { session: {} });
		};
		await postSync(
			baseReq({
				contentHash: "b".repeat(64),
				fileBytes: new Uint8Array([9, 8, 7]),
			}),
			fetchImpl,
		);
		expect(seen.body).toBeInstanceOf(FormData);
		const fd = seen.body as FormData;
		const file = fd.get("file");
		const metaRaw = fd.get("metadata");
		const hash = fd.get("content_hash");
		expect(file).toBeInstanceOf(Blob);
		expect((file as Blob).type).toBe("application/gzip");
		expect((file as Blob).size).toBe(3);
		expect(typeof metaRaw).toBe("string");
		expect(JSON.parse(metaRaw as string)).toEqual(baseMetadata);
		expect(hash).toBe("b".repeat(64));
	});

	test("POST method", async () => {
		const seen: { method?: string } = {};
		const fetchImpl: FetchLike = async (_input, init) => {
			seen.method = init?.method;
			return jsonResponse(200, { session: {} });
		};
		await postSync(baseReq(), fetchImpl);
		expect(seen.method).toBe("POST");
	});
});

describe("postSync — response classification", () => {
	test("200 → ok:true with session body", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(200, { session: { id: "row-1", storage_path: "p" } });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out).toEqual({
			ok: true,
			status: 200,
			body: { session: { id: "row-1", storage_path: "p" } },
		});
	});

	test("503 with sync_disabled body → ok:false, syncDisabled:true", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(503, { error: "sync_disabled" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		if (out.kind !== "transport_error")
			throw new Error("expected transport_error variant, got lock_held");
		expect(out.status).toBe(503);
		expect(out.syncDisabled).toBe(true);
	});

	test("503 with other body → ok:false, syncDisabled:false", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(503, { error: "service_unavailable" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		if (out.kind !== "transport_error")
			throw new Error("expected transport_error variant, got lock_held");
		expect(out.syncDisabled).toBe(false);
		expect(out.status).toBe(503);
	});

	test("401 → ok:false, syncDisabled:false", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(401, { error: "Unauthorized" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		if (out.kind !== "transport_error")
			throw new Error("expected transport_error variant, got lock_held");
		expect(out.status).toBe(401);
		expect(out.syncDisabled).toBe(false);
	});

	test("400 → ok:false (validation error)", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(400, { error: "invalid_metadata", field: "turn_count" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		expect(out.status).toBe(400);
	});

	test("non-JSON body still parses ok:false with body=null on parse fail", async () => {
		const fetchImpl: FetchLike = async () =>
			new Response("not json", { status: 500 });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		if (out.kind !== "transport_error")
			throw new Error("expected transport_error variant, got lock_held");
		expect(out.status).toBe(500);
		expect(out.syncDisabled).toBe(false);
	});

	test("network throw propagates", async () => {
		const fetchImpl: FetchLike = async () => {
			throw new Error("ECONNREFUSED");
		};
		await expect(postSync(baseReq(), fetchImpl)).rejects.toThrow(
			"ECONNREFUSED",
		);
	});
});

describe("postSync — 409 holder contract guard (AC 15)", () => {
	// `postSync` exposes two valid 409 surfaces: an object holder (even
	// with null fields) → `kind:"lock_held"` variant; a missing or
	// non-object holder → `kind:"transport_error"` variant. The latter
	// is what `sync-flow.ts` routes to `fatal_error`. These tests pin
	// the guard so a future regression that synthesizes an all-null
	// holder from a malformed body (masking a server bug as a routine
	// lock-held) fails loud at this seam.

	test("409 with no holder field → transport_error (routes to fatal_error)", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(409, { error: "lock_held" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		if (out.kind !== "transport_error")
			throw new Error("expected transport_error, got lock_held");
		expect(out.status).toBe(409);
		expect(out.syncDisabled).toBe(false);
	});

	test("409 with non-object holder (string) → transport_error", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(409, { error: "lock_held", holder: "not-an-object" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		expect(out.kind).toBe("transport_error");
		expect(out.status).toBe(409);
	});

	test("409 with null holder → transport_error (not an all-null lock_held)", async () => {
		// A `null` value passes the JSON-object body check but fails the
		// holder shape guard. Without the guard, the daemon would happily
		// destructure holder.expires_at off `null` and crash — or worse,
		// synthesize an all-null LockHolder and silently swallow the bug.
		const fetchImpl: FetchLike = async () =>
			jsonResponse(409, { error: "lock_held", holder: null });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		expect(out.kind).toBe("transport_error");
		expect(out.status).toBe(409);
	});

	test("409 with object holder containing only null fields → lock_held variant", async () => {
		// Stale-holder edge case from step 4: the server's `lockRow` lookup
		// raced, so it returned `holder: {kind:null, id:null, user:null,
		// expires_at:null}`. The contract is honored (object holder, named
		// fields) — daemon falls back to `now + 60s` for retry, not an
		// epoch-arithmetic retry storm. This is the OTHER side of the
		// contract guard: nulls inside an object are fine.
		const fetchImpl: FetchLike = async () =>
			jsonResponse(409, {
				error: "lock_held",
				holder: {
					environment_kind: null,
					environment_id: null,
					username: null,
					expires_at: null,
				},
			});
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		expect(out.kind).toBe("lock_held");
		if (out.kind !== "lock_held") throw new Error();
		expect(out.holder.expires_at).toBeNull();
	});
});
