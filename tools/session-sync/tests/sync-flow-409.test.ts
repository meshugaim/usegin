/**
 * AC 15 / ENG-5862 step 5 (Red).
 *
 * Daemon-side handling of 409 lock_held responses:
 *   1. The outcome surfaced from `syncFile` is `kind: "lock_held"` and
 *      carries all four holder fields as named properties. cli.ts will
 *      render those into a warning line — that rendering is a separate
 *      concern, tested at the cli.ts boundary (out of step 5 Red scope).
 *      Here we pin only the DATA contract.
 *   2. State row's `nextRetryAt` is set to
 *      `holder.expires_at + LOCK_BACKOFF_BUFFER_MS`. We reuse the same
 *      `nextRetryAt` field the 503 kill-switch path (AC 16) already uses;
 *      one mechanism, two triggers. When `holder.expires_at` is null
 *      (stale-holder edge case — see sync-client.LockHolder), the daemon
 *      falls back to `now + 60_000ms` instead of doing epoch arithmetic
 *      on null.
 *   3. A subsequent sync attempt while `now < nextRetryAt` skips the
 *      POST — the existing `isInBackoff` filter handles this once
 *      `nextRetryAt` is set. We exercise the integrated sequence
 *      (first sync seeds `nextRetryAt`, second sync skips) to keep the
 *      test from accidentally passing on the existing kill-switch wiring.
 *
 * Step 5 Green flipped these from `test.failing` (production stubs threw
 * "Not implemented (ENG-5862 step 5 Red)") to real `test` assertions
 * after `syncFile` started returning the `lock_held` outcome shape and
 * `state.nextRetryAt` got the holder-derived backoff.
 */

import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import type { StateFile } from "../src/state.ts";
import type { FetchLike, LockHolder } from "../src/sync-client.ts";
import { LOCK_BACKOFF_BUFFER_MS, syncFile } from "../src/sync-flow.ts";

/**
 * Fallback retry delay when `holder.expires_at` is null. Matches the
 * 60s default used elsewhere as a safe "try again soon" backoff;
 * Green should export a named constant from sync-flow.ts mirroring
 * this value so the test can import it instead of duplicating the
 * literal. For now we keep the literal here in Red.
 */
const NULL_EXPIRES_FALLBACK_MS = 60_000;

const NOW = new Date("2026-05-12T12:00:00.000Z");
const PARENT_PATH = "/home/u/.claude/projects/-x/sess-1.jsonl";

const auth: AuthContext = {
	token: "jwt",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid",
};

const envIdentity = { kind: "local-devcontainer", id: "env-id-loser" };

const FILE_BYTES = new TextEncoder().encode(
	`${[
		JSON.stringify({
			type: "user",
			message: { role: "user", content: "hi" },
		}),
	].join("\n")}\n`,
);

const HOLDER_EXPIRES_AT = "2026-05-12T12:00:30.000Z"; // 30s in the future
const HOLDER = {
	environment_kind: "gitpod",
	environment_id: "env-A-winner",
	username: "lihu",
	expires_at: HOLDER_EXPIRES_AT,
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function makeLockHeldFetch(): FetchLike {
	return async () =>
		jsonResponse(409, { error: "lock_held", holder: HOLDER });
}

function baseInput(state: StateFile = {}) {
	return {
		localFilePath: PARENT_PATH,
		sessionId: "sess-1",
		state,
		auth,
		envIdentity,
		username: "lihu",
		projectPath: "/workspaces/test-mvp",
		now: NOW,
		readFileFn: async () => FILE_BYTES,
	};
}

describe("syncFile — 409 lock_held (AC 15)", () => {
	test(
		"ENG-5862: 409 → outcome.kind = lock_held with all four holder fields",
		async () => {
			// DATA contract: syncFile surfaces a `lock_held` outcome whose
			// `holder` carries the four identifying fields. The rendering of
			// those fields into a warning line lives at the cli.ts boundary
			// (separate test, separate phase). Asserting on console.warn here
			// would only catch warnings emitted from inside syncFile's call
			// stack; the layering pushes that emission up to cli.ts.
			const out = await syncFile({
				...baseInput(),
				fetchImpl: makeLockHeldFetch(),
			});
			expect(out.kind).toBe("lock_held");
			if (out.kind !== "lock_held") throw new Error();
			expect(out.holder.environment_kind).toBe(HOLDER.environment_kind);
			expect(out.holder.environment_id).toBe(HOLDER.environment_id);
			expect(out.holder.username).toBe(HOLDER.username);
			expect(out.holder.expires_at).toBe(HOLDER.expires_at);
		},
	);

	test(
		"ENG-5862: 409 → outcome.lock_held with nextRetryAt = holder.expires_at + 5s",
		async () => {
			const out = await syncFile({
				...baseInput(),
				fetchImpl: makeLockHeldFetch(),
			});
			expect(out.kind).toBe("lock_held");
			if (out.kind !== "lock_held") throw new Error();
			const expectedRetry = new Date(
				new Date(HOLDER_EXPIRES_AT).getTime() + LOCK_BACKOFF_BUFFER_MS,
			).toISOString();
			expect(out.updatedState.nextRetryAt).toBe(expectedRetry);
			expect(out.updatedState.sessionId).toBe("sess-1");
			// Did NOT advance lastUploadedAt — the upload didn't happen.
			expect(out.updatedState.lastUploadedAt).not.toBe(NOW.toISOString());
			expect(out.holder).toEqual(HOLDER);
		},
	);

	test(
		"ENG-5862: 409 with null holder.expires_at → nextRetryAt = now + 60_000ms",
		async () => {
			// Step 4's HTTP 409 returns null fields when `lockRow` is null
			// (READ COMMITTED stale-holder edge case). If the daemon does
			// `new Date(null).getTime() + 5_000`, nextRetryAt becomes
			// 1970-01-01T00:00:05Z → instant retry storm. Daemon must fall
			// back to `now + 60_000ms` instead.
			const nullHolder: LockHolder = {
				environment_kind: null,
				environment_id: null,
				username: null,
				expires_at: null,
			};
			const fetchImpl: FetchLike = async () =>
				jsonResponse(409, { error: "lock_held", holder: nullHolder });
			const out = await syncFile({
				...baseInput(),
				fetchImpl,
			});
			expect(out.kind).toBe("lock_held");
			if (out.kind !== "lock_held") throw new Error();
			const expectedRetry = new Date(
				NOW.getTime() + NULL_EXPIRES_FALLBACK_MS,
			).toISOString();
			expect(out.updatedState.nextRetryAt).toBe(expectedRetry);
			expect(out.holder.expires_at).toBeNull();
		},
	);

	test(
		"ENG-5862: subsequent sync while now < nextRetryAt → daemon skips POST",
		async () => {
			// Integrated sequence: first sync seeds nextRetryAt via 409,
			// second sync should hit the `isInBackoff` filter and never call
			// fetch. Counter on the spy proves it.
			let calls = 0;
			const fetchImpl: FetchLike = async () => {
				calls += 1;
				return jsonResponse(409, { error: "lock_held", holder: HOLDER });
			};

			// Mutable state shared across both syncs.
			const state: StateFile = {};
			const firstOut = await syncFile({
				...baseInput(state),
				fetchImpl,
			});
			expect(firstOut.kind).toBe("lock_held");
			if (firstOut.kind !== "lock_held") throw new Error();
			// Caller would persist this row; mimic that here.
			state[PARENT_PATH] = firstOut.updatedState;

			const secondOut = await syncFile({
				...baseInput(state),
				fetchImpl,
			});
			expect(secondOut.kind).toBe("skipped_backoff");
			expect(calls).toBe(1);
		},
	);
});
