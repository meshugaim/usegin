/**
 * AC 18 extension / ENG-5862 step 6 (Red).
 *
 * Daemon-side final-sync + lock-release on session completion.
 *
 * Trigger condition (per spec): the upload returns 200 AND
 * `metadata.status === "completed"` (extractor flips that when the
 * JSONL contains a `{type:"result"}` line — see `completion.ts` +
 * `extractor.ts:138`). Only then does the daemon issue
 * `DELETE /api/v1/dev-sessions/{session_id}/lock?environment_kind=…&environment_id=…`
 * to release immediately rather than wait for the 2-minute lease to
 * lapse.
 *
 * Layering / contract pinned here:
 *
 *   1. **Trigger condition.** `deleteLockFn` is called exactly once,
 *      AFTER the upload succeeds, AND only when the request metadata's
 *      `status` is `"completed"`. Non-200 outcomes (503 / 5xx / 4xx /
 *      409 lock_held) do NOT release — the daemon never held the lock
 *      successfully in those paths.
 *
 *   2. **204 → `completed_and_released`.** Clean done state; caller may
 *      remove the entry from the state file. The state row still
 *      advances (same shape as `uploaded`) so the final content hash
 *      doesn't get re-uploaded on a startup-scan replay.
 *
 *   3. **403 → `completed_release_denied`.** A different env stole the
 *      lock between our successful sync and our DELETE (rare). Best-
 *      effort logging, no escalation; the daemon leaves the state-file
 *      entry alone so the 5-min safety-net scan can re-issue the
 *      release if conditions allow.
 *
 *   4. **transport_error → `completed_release_transport_error`.** Any
 *      non-204, non-403 response (5xx, malformed body, network throw).
 *      Sync outcome is still clean — the lease lapses at `expires_at`
 *      regardless; we just log so the friction is visible.
 *
 * The render of warning lines (who holds the lock, what the transport
 * error was) lives at the cli.ts boundary — same layering rule as the
 * 409 lock_held outcome (see `sync-flow-409.test.ts:14-20`).
 *
 * Green (step 6): sync-flow.ts now branches on `metadata.status` after
 * a 200 and routes through `deleteLockFn` (default = `postDeleteLock`,
 * injected as a spy here). The `test.failing` markers flipped to plain
 * `test()` once each outcome assertion passed.
 */

import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import type { StateFile } from "../src/state.ts";
import type {
	DeleteLockRequest,
	DeleteLockResponse,
	FetchLike,
} from "../src/sync-client.ts";
import { syncFile } from "../src/sync-flow.ts";

const NOW = new Date("2026-05-12T12:00:00.000Z");
const PARENT_PATH = "/home/u/.claude/projects/-x/sess-1.jsonl";

const auth: AuthContext = {
	token: "jwt",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid",
};

const envIdentity = { kind: "local-devcontainer", id: "env-id-mine" };

/**
 * JSONL that includes a `{type:"result"}` line so `extractMetadata`
 * sets `status: "completed"` (via `isSessionComplete`). This is the
 * load-bearing fixture: without the result-line, the extractor reports
 * `status: "active"` and the post-upload completion branch should not
 * fire at all — which is what test 1 pins on the negative side too,
 * via the non-completed-metadata assertion in the call-count check.
 */
const COMPLETED_FILE_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({
			type: "user",
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
		JSON.stringify({
			type: "result",
			subtype: "success",
		}),
	].join("\n")}\n`,
);

/**
 * Companion fixture WITHOUT a `{type:"result"}` line. Extractor reports
 * `status: "active"`. The post-upload completion branch must not fire
 * for an active session — heartbeats keep the lock alive in that case.
 */
const ACTIVE_FILE_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({
			type: "user",
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

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function makeOkSyncFetch(): FetchLike {
	return async () =>
		jsonResponse(200, {
			session: {
				id: "row-1",
				storage_path: "uid/2026-05-12/sess-1.jsonl.gz",
			},
		});
}

interface DeleteLockSpy {
	calls: Array<{
		req: DeleteLockRequest;
		fetchImpl: FetchLike | undefined;
	}>;
	fn: (
		req: DeleteLockRequest,
		fetchImpl?: FetchLike,
	) => Promise<DeleteLockResponse>;
}

function makeDeleteLockSpy(
	response: DeleteLockResponse | Error,
): DeleteLockSpy {
	const calls: DeleteLockSpy["calls"] = [];
	const fn = async (req: DeleteLockRequest, fetchImpl?: FetchLike) => {
		calls.push({ req, fetchImpl });
		if (response instanceof Error) {
			throw response;
		}
		return response;
	};
	return { calls, fn };
}

function baseInput(state: StateFile = {}, fileBytes = COMPLETED_FILE_BYTES) {
	return {
		localFilePath: PARENT_PATH,
		sessionId: "sess-1",
		state,
		auth,
		envIdentity,
		username: "lihu",
		projectPath: "/workspaces/test-mvp",
		now: NOW,
		readFileFn: async () => fileBytes,
	};
}

describe("syncFile — release on completion (AC 18 ext, step 6)", () => {
	test("ENG-5862: 200 + metadata.status=completed → deleteLockFn called once with env identity, AFTER upload", async () => {
		// The spy records call shape; the upload's 200 response is what
		// drives the trigger. Asserting calls.length === 1 pins both
		// "the call fires" and "it fires exactly once per syncFile run"
		// (no double-release). The request shape pin guards against a
		// future regression that drops env identity or session id.
		//
		// Right-reason failure in Red: current sync-flow has no
		// post-upload completion branch — `calls.length` is 0, not 1.
		const spy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spy.fn,
		});
		expect(spy.calls.length).toBe(1);
		const req = spy.calls[0]?.req;
		expect(req?.sessionId).toBe("sess-1");
		expect(req?.environmentKind).toBe(envIdentity.kind);
		expect(req?.environmentId).toBe(envIdentity.id);
		expect(req?.apiUrl).toBe(auth.apiUrl);
		expect(req?.token).toBe(auth.token);

		// Companion-negative: an ACTIVE session must NOT trigger release.
		// Heartbeats keep the lock alive while bytes are still being
		// written; release only fires when status === "completed".
		const activeSpy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		await syncFile({
			...baseInput({}, ACTIVE_FILE_BYTES),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: activeSpy.fn,
		});
		expect(activeSpy.calls.length).toBe(0);

		// Companion-negative: a 503 kill-switch must NOT trigger release.
		// We never confirmed the upload landed; releasing the lock here
		// would risk dropping a session a peer env could pick up.
		const killSpy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		await syncFile({
			...baseInput(),
			fetchImpl: async () => jsonResponse(503, { error: "sync_disabled" }),
			deleteLockFn: killSpy.fn,
		});
		expect(killSpy.calls.length).toBe(0);
	});

	test("ENG-5862: deleteLock 204 → outcome.kind = completed_and_released, state row advances", async () => {
		// Clean done state. The outcome carries an advanced `updatedState`
		// (same shape as `uploaded`) so the caller persists the final
		// hash — a startup-scan replay must not re-upload the same bytes
		// just because the entry is gone. The caller decides whether to
		// remove the entry from the state file; the outcome doesn't
		// dictate that.
		const spy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		const out = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spy.fn,
		});
		expect(out.kind).toBe("completed_and_released");
		if (out.kind !== "completed_and_released") throw new Error();
		expect(out.updatedState.sessionId).toBe("sess-1");
		expect(out.updatedState.storagePath).toBe("uid/2026-05-12/sess-1.jsonl.gz");
		expect(out.updatedState.lastUploadedAt).toBe(NOW.toISOString());
		expect(out.updatedState.contentHash).toMatch(/^[0-9a-f]{64}$/);
		expect(out.sessionRow.id).toBe("row-1");
	});

	test("ENG-5862: deleteLock 403 → outcome.kind = completed_release_denied (rare race; safety-net retries)", async () => {
		// The lock was stolen between our successful sync and our DELETE.
		// Server's 403 body deliberately omits holder fields (release is
		// an identity assertion, not a discovery surface — see step 4
		// route.ts:130-134). The daemon logs the denial at the cli.ts
		// boundary and leaves the state row alone so the 5-min safety-
		// net scan can re-issue the release if the lock comes free.
		//
		// `updatedState` still advances (sync DID succeed) — only the
		// outcome discriminator tells the caller "release was denied".
		const spy = makeDeleteLockSpy({
			ok: false,
			status: 403,
			kind: "not_holder",
			body: { error: "not_holder" },
		});
		const out = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spy.fn,
		});
		expect(spy.calls.length).toBe(1);
		expect(out.kind).toBe("completed_release_denied");
		if (out.kind !== "completed_release_denied") throw new Error();
		expect(out.updatedState.sessionId).toBe("sess-1");
		expect(out.updatedState.lastUploadedAt).toBe(NOW.toISOString());
	});

	test("ENG-5862: deleteLock transport_error / throw → outcome.kind = completed_release_transport_error (best-effort, structured carrier)", async () => {
		// Two flavors land in the same outcome: an explicit
		// `transport_error` DeleteLockResponse (5xx, malformed body) AND
		// a thrown network error. Both mean the release didn't land but
		// the sync DID — the lease lapses at `expires_at` regardless, so
		// failing the whole sync would be the wrong tradeoff (we'd then
		// re-upload bytes the server already has).
		//
		// Step 6 refactor: `error` is a structured `{status, body, message}`
		// carrier (lifted from a stringified `Error.message` hack) so
		// cli.ts can log status + body symmetric with the 403 branch and
		// so tests inspect fields directly. The thrown-network-error
		// flavor uses `status: 0`, `body: null` sentinels to distinguish
		// from a real HTTP transport_error response.
		//
		// Flavor 1: explicit transport_error response (e.g. 500).
		const spyTransport = makeDeleteLockSpy({
			ok: false,
			kind: "transport_error",
			status: 500,
			body: { error: "internal_server_error" },
		});
		const outTransport = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spyTransport.fn,
		});
		expect(spyTransport.calls.length).toBe(1);
		expect(outTransport.kind).toBe("completed_release_transport_error");
		if (outTransport.kind !== "completed_release_transport_error")
			throw new Error();
		expect(outTransport.updatedState.sessionId).toBe("sess-1");
		expect(outTransport.updatedState.lastUploadedAt).toBe(NOW.toISOString());
		expect(outTransport.error.status).toBe(500);
		expect(outTransport.error.body).toEqual({ error: "internal_server_error" });
		expect(outTransport.error.message).toContain("500");
		expect(outTransport.error.message).toContain("internal_server_error");

		// Flavor 2: deleteLockFn throws (network error). Same outcome;
		// the daemon must catch internally rather than propagate. Sentinel
		// `status: 0` + `body: null` lets cli.ts tell apart "couldn't
		// reach the server" from "real HTTP transport_error".
		const spyThrow = makeDeleteLockSpy(new Error("ECONNREFUSED"));
		const outThrow = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spyThrow.fn,
		});
		expect(spyThrow.calls.length).toBe(1);
		expect(outThrow.kind).toBe("completed_release_transport_error");
		if (outThrow.kind !== "completed_release_transport_error")
			throw new Error();
		expect(outThrow.error.status).toBe(0);
		expect(outThrow.error.body).toBeNull();
		expect(outThrow.error.message).toContain("ECONNREFUSED");
	});

	test("ENG-5862 step 6 follow-up: 204 release stamps updatedState.releasedAt AND shouldHeartbeat returns false on the next tick (no-hot-loop integration)", async () => {
		// End-to-end pin: a completion-sync that releases the lock must
		// leave the per-file state in a shape that `shouldHeartbeat` skips
		// on the very next heartbeat tick.
		//
		// Without this seam, the daemon would heartbeat a released-lock
		// session, hit `refresh_dev_session_lock` (UPDATE-only — migration
		// 20260512150635), get 0 rows, the endpoint would return 409 with
		// all-null holder fields, and the daemon's null-holder handler
		// would set `nextRetryAt = now + 60s` and re-attempt every minute
		// for the lifetime of the daemon.
		//
		// The integration crosses two files (sync-flow's release branch
		// stamps `releasedAt`; heartbeat's `releasedAt` short-circuit
		// reads it); per-file unit pins in either alone would let the
		// chain break without a test failing.
		//
		// Companion-negative: explicitly assert the sibling outcomes
		// (`completed_release_denied`, `completed_release_transport_error`)
		// do NOT stamp `releasedAt` — a regression that always stamps
		// would break the 403/transport-error retry path (the safety-net
		// would think the lock was released and stop trying).
		const { shouldHeartbeat } = await import("../src/heartbeat.ts");

		const spy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		const out = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spy.fn,
		});

		expect(out.kind).toBe("completed_and_released");
		if (out.kind !== "completed_and_released") throw new Error();
		expect(out.updatedState.releasedAt).toBe(NOW.toISOString());

		// And `shouldHeartbeat` must short-circuit even though every other
		// "yes, heartbeat" condition is satisfied (unflushed bytes, last
		// upload > 60s ago — exactly the shape that would trigger the
		// hot loop without this guard).
		const futureNow = new Date(NOW.getTime() + 90_000); // 90s later
		const mtimeMs = futureNow.getTime() - 1_000; // unflushed bytes
		expect(shouldHeartbeat(out.updatedState, mtimeMs, futureNow)).toBe(false);

		// Companion-negatives: 403 and transport_error must NOT stamp
		// `releasedAt`. We didn't actually release the lock in those
		// cases — the safety-net retries release on the next scan, and
		// `shouldHeartbeat` keeps heartbeating until either the retry
		// succeeds or the lease lapses naturally.
		const denySpy = makeDeleteLockSpy({
			ok: false,
			status: 403,
			kind: "not_holder",
			body: { error: "not_holder" },
		});
		const outDeny = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: denySpy.fn,
		});
		if (outDeny.kind !== "completed_release_denied") throw new Error();
		expect(outDeny.updatedState.releasedAt ?? null).toBeNull();

		const transportSpy = makeDeleteLockSpy({
			ok: false,
			kind: "transport_error",
			status: 500,
			body: { error: "internal_server_error" },
		});
		const outTransport = await syncFile({
			...baseInput(),
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: transportSpy.fn,
		});
		if (outTransport.kind !== "completed_release_transport_error")
			throw new Error();
		expect(outTransport.updatedState.releasedAt ?? null).toBeNull();
	});

	test("ENG-5862: subagent sync with metadata.status=completed does NOT fire deleteLock (parent-only gate)", async () => {
		// S1 — gate the post-completion DELETE on `agentId === undefined`.
		// Subagents inherit the parent's lock per spec; the dev-session
		// lock is keyed off `session_id` alone, never the agent id. A
		// subagent JSONL that happens to carry a `{type:"result"}` line
		// must NOT trigger a DELETE against the parent's lock — that
		// would over-release on every subagent sync.
		//
		// Empirically holds today (0/545 subagent files contain a result
		// line as of 2026-05-12), but the gate is the right shape
		// regardless: a future extractor change or a hand-edited
		// transcript shouldn't be able to over-release.
		//
		// Fixture passes `agentId: "a2789d14b1dfa1ebb"` (real Claude Code
		// shape per ENG-5962) into syncFile with a COMPLETED parent JSONL.
		// Spy must record zero calls.
		const spy = makeDeleteLockSpy({
			ok: true,
			status: 204,
			kind: "released",
		});
		const out = await syncFile({
			...baseInput(),
			agentId: "a2789d14b1dfa1ebb",
			fetchImpl: makeOkSyncFetch(),
			deleteLockFn: spy.fn,
		});
		expect(spy.calls.length).toBe(0);
		// Subagent upload itself still succeeds — only the release-branch
		// is gated out. The outcome is plain `uploaded`, not any of the
		// completion variants.
		expect(out.kind).toBe("uploaded");
	});
});
