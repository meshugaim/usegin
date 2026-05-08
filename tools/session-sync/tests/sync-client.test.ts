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
		expect(out.status).toBe(503);
		expect(out.syncDisabled).toBe(true);
	});

	test("503 with other body → ok:false, syncDisabled:false", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(503, { error: "service_unavailable" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
		expect(out.syncDisabled).toBe(false);
		expect(out.status).toBe(503);
	});

	test("401 → ok:false, syncDisabled:false", async () => {
		const fetchImpl: FetchLike = async () =>
			jsonResponse(401, { error: "Unauthorized" });
		const out = await postSync(baseReq(), fetchImpl);
		expect(out.ok).toBe(false);
		if (out.ok) throw new Error("expected !ok");
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
