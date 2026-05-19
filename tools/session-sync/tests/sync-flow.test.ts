import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import type { PerFileState, StateFile } from "../src/state.ts";
import type { FetchLike } from "../src/sync-client.ts";
import { syncFile } from "../src/sync-flow.ts";

const NOW = new Date("2026-05-08T12:00:00.000Z");
const PARENT_PATH = "/home/u/.claude/projects/-x/sess-1.jsonl";

const auth: AuthContext = {
	token: "jwt",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid",
};

const envIdentity = { kind: "local-devcontainer", id: "env-id-1" };

const FILE_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({
			type: "user",
			gitBranch: "main",
			gitSha: "abc1234",
			message: { role: "user", content: "hi" },
		}),
		JSON.stringify({
			type: "assistant",
			message: {
				role: "assistant",
				model: "claude-opus-4-7",
				content: "hello",
			},
		}),
	].join("\n")}\n`,
);

interface Captured {
	url?: string;
	body?: FormData;
	authHeader?: string;
}

function makeFetch(resp: Response, captured: Captured): FetchLike {
	return async (input, init) => {
		captured.url = String(input);
		captured.body = init?.body as FormData;
		captured.authHeader = new Headers(init?.headers).get("authorization") ?? "";
		return resp;
	};
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function baseInput(state: StateFile = {}, agentId?: string) {
	return {
		localFilePath: PARENT_PATH,
		sessionId: "sess-1",
		agentId,
		state,
		auth,
		envIdentity,
		username: "lihu",
		projectPath: "/workspaces/test-mvp",
		now: NOW,
		readFileFn: async () => FILE_BYTES,
	};
}

describe("syncFile — happy path (uploaded)", () => {
	test("200 → outcome.uploaded with new state row", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, {
				session: {
					id: "row-1",
					storage_path: "uid/2026-05-08/sess-1.jsonl.gz",
				},
			}),
			captured,
		);
		const out = await syncFile({
			...baseInput(),
			fetchImpl,
		});
		expect(out.kind).toBe("uploaded");
		if (out.kind !== "uploaded") throw new Error();
		expect(out.updatedState.sessionId).toBe("sess-1");
		expect(out.updatedState.storagePath).toBe("uid/2026-05-08/sess-1.jsonl.gz");
		expect(out.updatedState.lastUploadedAt).toBe(NOW.toISOString());
		expect(out.updatedState.nextRetryAt ?? null).toBeNull();
		expect(out.updatedState.contentHash).toMatch(/^[0-9a-f]{64}$/);
		expect(out.updatedState.lastUploadedSize).toBe(FILE_BYTES.length);
		expect(captured.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/sync",
		);
		expect(captured.authHeader).toBe("Bearer jwt");
	});

	test("metadata POSTed includes extracted + injected fields", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		await syncFile({
			...baseInput(),
			fetchImpl,
		});
		const metaRaw = captured.body?.get("metadata");
		const meta = JSON.parse(metaRaw as string);
		expect(meta.turn_count).toBe(2);
		expect(meta.git_branch).toBe("main");
		expect(meta.git_sha).toBe("abc1234");
		expect(meta.claude_model).toBe("claude-opus-4-7");
		expect(meta.environment_kind).toBe("local-devcontainer");
		expect(meta.environment_id).toBe("env-id-1");
		expect(meta.username).toBe("lihu");
		expect(meta.project_path).toBe("/workspaces/test-mvp");
		expect(meta.status).toBe("active");
		expect(meta.first_user_message).toBe("hi");
		expect(meta.file_size_bytes).toBe(FILE_BYTES.length);
		expect(typeof meta.gzipped_size_bytes).toBe("number");
		expect(meta.gzipped_size_bytes).toBeGreaterThan(0);
	});

	// ENG-6068 Phase B.2 wire test — the extractor surfaces
	// `started_at` from the earliest JSONL timestamp; this pins the
	// composition layer's promise that it actually lands in the POST body.
	// The extractor test (`extractor.test.ts`) covers walking semantics in
	// isolation; this one closes Ron's carry-forward #2 (wire-gap coverage)
	// so a refactor that drops the extractor → metadata thread can't pass
	// CI silently.
	test("metadata.started_at threaded from extractor when JSONL carries a timestamp — ENG-6068", async () => {
		const bytesWithTimestamps = new TextEncoder().encode(
			`${[
				JSON.stringify({ type: "isSnapshotUpdate", payload: { foo: 1 } }),
				JSON.stringify({
					type: "assistant",
					timestamp: "2026-03-11T12:24:05.000Z",
					message: { role: "assistant", content: "later" },
				}),
				JSON.stringify({
					type: "user",
					timestamp: "2026-03-11T12:24:00.000Z",
					message: { role: "user", content: "earlier" },
				}),
			].join("\n")}\n`,
		);
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		await syncFile({
			...baseInput(),
			readFileFn: async () => bytesWithTimestamps,
			fetchImpl,
		});
		const meta = JSON.parse(captured.body?.get("metadata") as string);
		// The earliest timestamp is 12:24:00, not 12:24:05 — proves the
		// walker is run AND its result lands in the POST body.
		expect(meta.started_at).toBe("2026-03-11T12:24:00.000Z");
	});

	// Daemon-meta-only files (no parseable timestamp anywhere) must OMIT
	// the field entirely — neither `null` nor empty string — so the
	// server's `if (m.started_at != null)` validator branch stays inert.
	// Pins the wire-shape promise the daemon's SyncMetadata docstring makes.
	test("metadata.started_at omitted when extractor returns null — ENG-6068", async () => {
		const bytesNoTimestamps = new TextEncoder().encode(
			`${[
				JSON.stringify({ type: "isSnapshotUpdate", payload: { foo: 1 } }),
				JSON.stringify({ type: "user", timestamp: 1_741_692_240_000 }),
			].join("\n")}\n`,
		);
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		await syncFile({
			...baseInput(),
			readFileFn: async () => bytesNoTimestamps,
			fetchImpl,
		});
		const meta = JSON.parse(captured.body?.get("metadata") as string);
		// `in` is the strict check — `started_at: null` would still have
		// the key on the object. We want the key absent.
		expect("started_at" in meta).toBe(false);
	});

	test("status=completed when JSONL contains type:'result'", async () => {
		const completedBytes = new TextEncoder().encode(
			`${[
				JSON.stringify({
					type: "user",
					message: { role: "user", content: "hi" },
				}),
				JSON.stringify({ type: "result" }),
			].join("\n")}\n`,
		);
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		// `metadata.status === "completed"` now fires the post-upload
		// DELETE-lock branch (AC 18 ext, step 6). Inject a no-op
		// deleteLockFn so this test stays focused on the metadata payload
		// — without it, the default `postDeleteLock` would call fetch a
		// second time and overwrite the captured FormData. The release
		// outcome is covered exhaustively in release-on-completion.test.ts.
		await syncFile({
			...baseInput(),
			readFileFn: async () => completedBytes,
			fetchImpl,
			deleteLockFn: async () => ({
				ok: true,
				status: 204,
				kind: "released",
			}),
		});
		const meta = JSON.parse(captured.body?.get("metadata") as string);
		expect(meta.status).toBe("completed");
	});

	test("subagent → routes to subagent endpoint", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		await syncFile({
			...baseInput({}, "agent-uuid-1"),
			fetchImpl,
		});
		expect(captured.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/subagents/agent-uuid-1/sync",
		);
	});
});

describe("syncFile — skipped_hash", () => {
	test("hash matches state → skipped, no fetch call", async () => {
		// Compute the canonical hash of FILE_BYTES via the same primitive.
		const { computeContentHash } = await import("../src/content-hash.ts");
		const hash = await computeContentHash(FILE_BYTES);
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: hash,
				lastUploadedSize: FILE_BYTES.length,
				sessionId: "sess-1",
				storagePath: "uid/2026-05-08/sess-1.jsonl.gz",
				lastUploadedAt: "2026-05-08T11:59:00.000Z",
			},
		};
		let called = false;
		const fetchImpl: FetchLike = async () => {
			called = true;
			return jsonResponse(500, {});
		};
		const out = await syncFile({
			...baseInput(state),
			fetchImpl,
		});
		expect(out.kind).toBe("skipped_hash");
		expect(called).toBe(false);
	});
});

describe("syncFile — skipped_backoff", () => {
	test("nextRetryAt > now → skipped, no fetch call", async () => {
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: "x".repeat(64),
				lastUploadedSize: 0,
				sessionId: "sess-1",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
				nextRetryAt: "2026-05-08T12:05:00.000Z", // 5min in the future
			},
		};
		let called = false;
		const fetchImpl: FetchLike = async () => {
			called = true;
			return jsonResponse(200, { session: {} });
		};
		const out = await syncFile({
			...baseInput(state),
			fetchImpl,
		});
		expect(out.kind).toBe("skipped_backoff");
		if (out.kind !== "skipped_backoff") throw new Error();
		expect(out.nextRetryAt).toBe("2026-05-08T12:05:00.000Z");
		expect(called).toBe(false);
	});

	test("nextRetryAt past → does NOT skip; performs sync", async () => {
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: "x".repeat(64),
				lastUploadedSize: 0,
				sessionId: "sess-1",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
				nextRetryAt: "2026-05-08T11:55:00.000Z", // past
			},
		};
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(200, { session: { storage_path: "p" } }),
			captured,
		);
		const out = await syncFile({
			...baseInput(state),
			fetchImpl,
		});
		expect(out.kind).toBe("uploaded");
	});
});

describe("syncFile — kill_switch (503 sync_disabled)", () => {
	test("503 sync_disabled → outcome.kill_switch with nextRetryAt set 5min ahead", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(503, { error: "sync_disabled" }),
			captured,
		);
		const out = await syncFile({
			...baseInput(),
			fetchImpl,
		});
		expect(out.kind).toBe("kill_switch");
		if (out.kind !== "kill_switch") throw new Error();
		expect(out.updatedState.nextRetryAt).toBe("2026-05-08T12:05:00.000Z");
		// Did not advance lastUploadedAt — the upload didn't happen.
		expect(out.updatedState.lastUploadedAt).not.toBe(NOW.toISOString());
	});

	test("kill_switch preserves prior contentHash/storagePath when present", async () => {
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: "deadbeef".padEnd(64, "0"),
				lastUploadedSize: 99,
				sessionId: "sess-1",
				storagePath: "old/path.jsonl.gz",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(503, { error: "sync_disabled" }),
			captured,
		);
		const out = await syncFile({
			...baseInput(state),
			fetchImpl,
		});
		expect(out.kind).toBe("kill_switch");
		if (out.kind !== "kill_switch") throw new Error();
		expect(out.updatedState.contentHash).toBe("deadbeef".padEnd(64, "0"));
		expect(out.updatedState.storagePath).toBe("old/path.jsonl.gz");
		expect(out.updatedState.lastUploadedSize).toBe(99);
		expect(out.updatedState.lastUploadedAt).toBe("2026-05-08T11:00:00.000Z");
		expect(out.updatedState.nextRetryAt).toBe("2026-05-08T12:05:00.000Z");
	});

	test("kill_switch with no prior state still produces a usable PerFileState", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(503, { error: "sync_disabled" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("kill_switch");
		if (out.kind !== "kill_switch") throw new Error();
		// Required PerFileState fields all populated, even if placeholder.
		const s: PerFileState = out.updatedState;
		expect(s.sessionId).toBe("sess-1");
		expect(s.nextRetryAt).toBe("2026-05-08T12:05:00.000Z");
	});

	test("kill_switch preserves prior lastHeartbeatAt (regression pin for ENG-5862 step 5)", async () => {
		// REGRESSION: step 5 Green's 503 branch hand-rolled the
		// updatedState spread field-by-field and forgot `lastHeartbeatAt`.
		// A session that had been heartbeating (heartbeat 200 → state row
		// gained `lastHeartbeatAt`) would lose that timestamp the moment
		// the kill-switch flipped, even though no upload ever happened. On
		// kill-switch flip-back the next `shouldHeartbeat` call would
		// think the lease was fresh-from-upload and skip the heartbeat
		// that should have refreshed it. Now both backoff triggers route
		// through `applyBackoff`, which carries every prior field.
		const heartbeatIso = "2026-05-08T11:59:30.000Z";
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: "h".repeat(64),
				lastUploadedSize: 99,
				sessionId: "sess-1",
				storagePath: "old/path.jsonl.gz",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
				lastHeartbeatAt: heartbeatIso,
			},
		};
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(503, { error: "sync_disabled" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(state), fetchImpl });
		expect(out.kind).toBe("kill_switch");
		if (out.kind !== "kill_switch") throw new Error();
		expect(out.updatedState.lastHeartbeatAt).toBe(heartbeatIso);
		expect(out.updatedState.nextRetryAt).toBe("2026-05-08T12:05:00.000Z");
	});
});

describe("syncFile — transient_error (5xx other / network)", () => {
	test("503 without sync_disabled body → transient_error", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(503, { error: "service_unavailable" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("transient_error");
	});

	test("500 → transient_error", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(jsonResponse(500, { error: "boom" }), captured);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("transient_error");
	});

	test("network throw → transient_error", async () => {
		const fetchImpl: FetchLike = async () => {
			throw new Error("ECONNREFUSED");
		};
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("transient_error");
		if (out.kind !== "transient_error") throw new Error();
		expect(out.error.message).toBe("ECONNREFUSED");
	});
});

describe("syncFile — fatal_error (4xx)", () => {
	test("401 → fatal_error", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(401, { error: "Unauthorized" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("fatal_error");
	});

	test("403 → fatal_error", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(403, { error: "Not a dev team member" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("fatal_error");
	});

	test("400 → fatal_error", async () => {
		const captured: Captured = {};
		const fetchImpl = makeFetch(
			jsonResponse(400, { error: "invalid_metadata", field: "turn_count" }),
			captured,
		);
		const out = await syncFile({ ...baseInput(), fetchImpl });
		expect(out.kind).toBe("fatal_error");
	});
});
