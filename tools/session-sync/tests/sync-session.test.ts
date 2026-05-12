import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import type { StateFile } from "../src/state.ts";
import type { FetchLike } from "../src/sync-client.ts";
import { syncSession } from "../src/sync-session.ts";

const NOW = new Date("2026-05-08T12:00:00.000Z");
const PARENT_PATH = "/home/u/.claude/projects/-x/sess-1.jsonl";

const auth: AuthContext = {
	token: "jwt",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid",
};

const envIdentity = { kind: "local-devcontainer", id: "env-id-1" };

const PARENT_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
		JSON.stringify({
			type: "assistant",
			message: { role: "assistant", model: "m", content: "ok" },
		}),
	].join("\n")}\n`,
);

const SUB_BYTES_A = new TextEncoder().encode(
	`${JSON.stringify({ type: "user", message: { role: "user", content: "a" } })}\n`,
);
const SUB_BYTES_B = new TextEncoder().encode(
	`${JSON.stringify({ type: "user", message: { role: "user", content: "b" } })}\n`,
);

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

interface FetchCall {
	url: string;
}

function makeFetch(responder: (url: string) => Response): {
	fetchImpl: FetchLike;
	calls: FetchCall[];
} {
	const calls: FetchCall[] = [];
	const fetchImpl: FetchLike = async (input) => {
		const url = String(input);
		calls.push({ url });
		return responder(url);
	};
	return { fetchImpl, calls };
}

function baseInput(state: StateFile = {}) {
	return {
		parentPath: PARENT_PATH,
		sessionId: "sess-1",
		state,
		auth,
		envIdentity,
		username: "lihu",
		projectPath: "/workspaces/test-mvp",
		now: NOW,
	};
}

describe("syncSession — happy path", () => {
	test("parent uploaded → both subagents synced", async () => {
		const subPathA =
			"/home/u/.claude/projects/-x/agent-aaaaaaaaaaaaaaaaa.jsonl";
		const subPathB =
			"/home/u/.claude/projects/-x/agent-abbbbbbbbbbbbbbbb.jsonl";
		const { fetchImpl, calls } = makeFetch((url) => {
			if (url.includes("/subagents/")) {
				return jsonResponse(200, { session: { storage_path: "sub.gz" } });
			}
			return jsonResponse(200, { session: { storage_path: "parent.gz" } });
		});
		const readMap: Record<string, Uint8Array> = {
			[PARENT_PATH]: PARENT_BYTES,
			[subPathA]: SUB_BYTES_A,
			[subPathB]: SUB_BYTES_B,
		};
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async (path) => {
				const bytes = readMap[path];
				if (!bytes) throw new Error(`unexpected path ${path}`);
				return bytes;
			},
			discoverFn: async () => [subPathA, subPathB],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(3);
		expect(out.outcomes[0]?.outcome.kind).toBe("uploaded");
		expect(out.outcomes[1]?.outcome.kind).toBe("uploaded");
		expect(out.outcomes[2]?.outcome.kind).toBe("uploaded");
		expect(calls.length).toBe(3);
		expect(calls[0]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/sync",
		);
		expect(calls[1]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/subagents/aaaaaaaaaaaaaaaaa/sync",
		);
		expect(calls[2]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/subagents/abbbbbbbbbbbbbbbb/sync",
		);
	});

	test("parent uploaded with no subagents", async () => {
		const { fetchImpl, calls } = makeFetch(() =>
			jsonResponse(200, { session: { storage_path: "parent.gz" } }),
		);
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(1);
		expect(calls.length).toBe(1);
	});
});

describe("syncSession — parent did not advance → subagents skipped", () => {
	test("parent skipped_hash → subagents NOT synced", async () => {
		const { computeContentHash } = await import("../src/content-hash.ts");
		const hash = await computeContentHash(PARENT_BYTES);
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: hash,
				lastUploadedSize: PARENT_BYTES.length,
				sessionId: "sess-1",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		let discoverCalled = false;
		const { fetchImpl, calls } = makeFetch(() =>
			jsonResponse(500, { error: "should not be hit" }),
		);
		const out = await syncSession({
			...baseInput(state),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => {
				discoverCalled = true;
				return ["/should/not/be/used.jsonl"];
			},
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(1);
		expect(out.outcomes[0]?.outcome.kind).toBe("skipped_hash");
		expect(discoverCalled).toBe(false);
		expect(calls.length).toBe(0);
	});

	test("parent skipped_backoff → subagents NOT synced", async () => {
		const state: StateFile = {
			[PARENT_PATH]: {
				contentHash: "x".repeat(64),
				lastUploadedSize: 0,
				sessionId: "sess-1",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
				nextRetryAt: "2026-05-08T12:05:00.000Z",
			},
		};
		const { fetchImpl } = makeFetch(() => jsonResponse(200, { session: {} }));
		const out = await syncSession({
			...baseInput(state),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => ["/x.jsonl"],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(1);
		expect(out.outcomes[0]?.outcome.kind).toBe("skipped_backoff");
	});

	test("parent kill_switch → subagents NOT synced", async () => {
		const { fetchImpl } = makeFetch(() =>
			jsonResponse(503, { error: "sync_disabled" }),
		);
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => ["/x.jsonl"],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(1);
		expect(out.outcomes[0]?.outcome.kind).toBe("kill_switch");
	});
});

describe("syncSession — parent failed", () => {
	test("parent fatal_error → parent_failed", async () => {
		const { fetchImpl } = makeFetch(() =>
			jsonResponse(403, { error: "Not a dev team member" }),
		);
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [],
		});
		expect(out.kind).toBe("parent_failed");
	});

	test("parent transient_error → parent_failed", async () => {
		const { fetchImpl } = makeFetch(() => jsonResponse(500, { error: "boom" }));
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [],
		});
		expect(out.kind).toBe("parent_failed");
	});
});

describe("syncSession — subagent error reported, parent succeeds", () => {
	test("subagent fatal_error reported in outcomes; parent already uploaded", async () => {
		const subPath = "/home/u/.claude/projects/-x/agent-acccccccccccccccc.jsonl";
		const { fetchImpl } = makeFetch((url) => {
			if (url.includes("/subagents/")) {
				return jsonResponse(403, { error: "no" });
			}
			return jsonResponse(200, { session: { storage_path: "p" } });
		});
		const readMap: Record<string, Uint8Array> = {
			[PARENT_PATH]: PARENT_BYTES,
			[subPath]: SUB_BYTES_A,
		};
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async (p) => {
				const b = readMap[p];
				if (!b) throw new Error(`unexpected path ${p}`);
				return b;
			},
			discoverFn: async () => [subPath],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes[0]?.outcome.kind).toBe("uploaded");
		expect(out.outcomes[1]?.outcome.kind).toBe("fatal_error");
	});
});

describe("syncSession — agentId extraction", () => {
	test("derives agentId from agent-a{16 hex}.jsonl filename", async () => {
		const subPath = "/some/where/nested/agent-adeadbeef12345678.jsonl";
		const { fetchImpl, calls } = makeFetch(() =>
			jsonResponse(200, { session: { storage_path: "p" } }),
		);
		await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [subPath],
		});
		// Second call is the subagent.
		expect(calls[1]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/subagents/adeadbeef12345678/sync",
		);
	});

	test("agent-foo.jsonl (not a{16 hex} shape) → skipped (no POST)", async () => {
		const subPath = "/some/where/nested/agent-foo.jsonl";
		const { fetchImpl, calls } = makeFetch(() =>
			jsonResponse(200, { session: { storage_path: "p" } }),
		);
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [subPath],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		// Only the parent POST; subagent skipped because filename isn't the
		// real Claude Code `agent-a{16 hex}.jsonl` shape (`foo` isn't hex).
		expect(out.outcomes.length).toBe(1);
		expect(calls.length).toBe(1);
		expect(calls[0]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/sync",
		);
	});

	// ENG-5962 regression pin: real `agent-<17 hex>` shape end-to-end.
	test("ENG-5962: agent-a{16 hex}.jsonl (real Claude Code shape) → subagent IS synced", async () => {
		const subPath = "/home/u/.claude/projects/-x/agent-a2789d14b1dfa1ebb.jsonl";
		const { fetchImpl, calls } = makeFetch((url) => {
			if (url.includes("/subagents/")) {
				return jsonResponse(200, { session: { storage_path: "sub.gz" } });
			}
			return jsonResponse(200, { session: { storage_path: "parent.gz" } });
		});
		const readMap: Record<string, Uint8Array> = {
			[PARENT_PATH]: PARENT_BYTES,
			[subPath]: SUB_BYTES_A,
		};
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async (path) => {
				const bytes = readMap[path];
				if (!bytes) throw new Error(`unexpected path ${path}`);
				return bytes;
			},
			discoverFn: async () => [subPath],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		// Parent + subagent both uploaded.
		expect(out.outcomes.length).toBe(2);
		expect(out.outcomes[0]?.outcome.kind).toBe("uploaded");
		expect(out.outcomes[1]?.outcome.kind).toBe("uploaded");
		// Two POSTs: parent, then subagent — agentId derived from the
		// `a{16 hex}` segment.
		expect(calls.length).toBe(2);
		expect(calls[0]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/sync",
		);
		expect(calls[1]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/subagents/a2789d14b1dfa1ebb/sync",
		);
	});

	test("path-traversal-shaped agent filename → skipped (no POST)", async () => {
		// Two guards apply: `basename` strips dirs, and the anchored hex-only
		// regex would reject `../../escape` even if a future refactor regressed
		// basename. Pin both layers.
		const subPath = "/some/where/nested/agent-../../escape.jsonl";
		const { fetchImpl, calls } = makeFetch(() =>
			jsonResponse(200, { session: { storage_path: "p" } }),
		);
		const out = await syncSession({
			...baseInput(),
			fetchImpl,
			readFileFn: async () => PARENT_BYTES,
			discoverFn: async () => [subPath],
		});
		expect(out.kind).toBe("ok");
		if (out.kind !== "ok") throw new Error();
		expect(out.outcomes.length).toBe(1);
		expect(calls.length).toBe(1);
		expect(calls[0]?.url).toBe(
			"http://localhost:63000/api/v1/dev-sessions/sess-1/sync",
		);
	});
});

/**
 * S2 — `parentDidAdvance` regression guard (step 6 refactor).
 *
 * The step-6 ext added three new "parent advanced" outcome kinds beyond
 * `uploaded`:
 *
 *   - `completed_and_released`           — 200 sync + 204 DELETE-lock
 *   - `completed_release_denied`         — 200 sync + 403 DELETE-lock
 *   - `completed_release_transport_error`— 200 sync + 5xx/throw DELETE-lock
 *
 * All four mean "the parent row of record advanced server-side" and
 * MUST therefore trigger the subagent fan-out (spec line 299). Without
 * the gate covering all four kinds, a parent-completion tick silently
 * skips subagent discovery — subagents attached to a finalized session
 * would NEVER sync. The Ron-6-red tripwire caught the original gap; this
 * test pins it so a future refactor that adds a new "advanced" kind
 * without updating `parentDidAdvance` fails loud here, not in production.
 *
 * Test seam: `discoverFn` is the observable side-effect — it's called
 * iff the parent advanced. We use a completed-status parent JSONL so
 * each fetch responder can route the DELETE-lock leg to a different
 * status (204 / 403 / 500) and exercise all three completion variants
 * via the same code path. For `uploaded`, we use an active-status JSONL
 * (no DELETE leg fires).
 */
const COMPLETED_PARENT_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
		JSON.stringify({
			type: "assistant",
			message: { role: "assistant", model: "m", content: "ok" },
		}),
		JSON.stringify({ type: "result", subtype: "success" }),
	].join("\n")}\n`,
);

interface AdvanceCase {
	label: string;
	expectedKind:
		| "uploaded"
		| "completed_and_released"
		| "completed_release_denied"
		| "completed_release_transport_error";
	parentBytes: Uint8Array;
	/** Status the DELETE /lock endpoint returns (ignored when parentBytes is active). */
	deleteLockStatus: number;
	/** Throw from the DELETE leg (overrides deleteLockStatus when set). */
	deleteLockThrows?: boolean;
}

const ADVANCE_CASES: AdvanceCase[] = [
	{
		label: "uploaded (active session, no DELETE leg)",
		expectedKind: "uploaded",
		parentBytes: PARENT_BYTES,
		deleteLockStatus: 204,
	},
	{
		label: "completed_and_released (DELETE 204)",
		expectedKind: "completed_and_released",
		parentBytes: COMPLETED_PARENT_BYTES,
		deleteLockStatus: 204,
	},
	{
		label: "completed_release_denied (DELETE 403)",
		expectedKind: "completed_release_denied",
		parentBytes: COMPLETED_PARENT_BYTES,
		deleteLockStatus: 403,
	},
	{
		label: "completed_release_transport_error (DELETE 500)",
		expectedKind: "completed_release_transport_error",
		parentBytes: COMPLETED_PARENT_BYTES,
		deleteLockStatus: 500,
	},
];

describe("syncSession — parentDidAdvance covers all four 'advanced' kinds (S2 regression guard)", () => {
	for (const c of ADVANCE_CASES) {
		test(`parent ${c.label} → discoverFn is called (subagent fan-out fires)`, async () => {
			let discoverCalled = false;
			const subPath =
				"/home/u/.claude/projects/-x/agent-a1111111111111111.jsonl";
			const { fetchImpl } = makeFetch((url) => {
				if (url.includes("/lock")) {
					if (c.deleteLockThrows) {
						throw new Error("ECONNREFUSED");
					}
					if (c.deleteLockStatus === 204) {
						return new Response(null, { status: 204 });
					}
					return jsonResponse(c.deleteLockStatus, {
						error:
							c.deleteLockStatus === 403
								? "not_holder"
								: "internal_server_error",
					});
				}
				if (url.includes("/subagents/")) {
					return jsonResponse(200, { session: { storage_path: "sub.gz" } });
				}
				return jsonResponse(200, { session: { storage_path: "parent.gz" } });
			});
			const readMap: Record<string, Uint8Array> = {
				[PARENT_PATH]: c.parentBytes,
				[subPath]: SUB_BYTES_A,
			};
			const out = await syncSession({
				...baseInput(),
				fetchImpl,
				readFileFn: async (p) => {
					const bytes = readMap[p];
					if (!bytes) throw new Error(`unexpected path ${p}`);
					return bytes;
				},
				discoverFn: async () => {
					discoverCalled = true;
					return [subPath];
				},
			});
			expect(discoverCalled).toBe(true);
			expect(out.kind).toBe("ok");
			if (out.kind !== "ok") throw new Error();
			// Parent outcome matches the case shape.
			expect(out.outcomes[0]?.outcome.kind).toBe(c.expectedKind);
			// Subagent ran (proves the fan-out fired, not just discovery).
			expect(out.outcomes.length).toBe(2);
			expect(out.outcomes[1]?.outcome.kind).toBe("uploaded");
		});
	}
});
