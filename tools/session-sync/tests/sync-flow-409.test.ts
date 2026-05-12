/**
 * AC 15 / ENG-5862 step 5 (Red).
 *
 * Daemon-side handling of 409 lock_held responses:
 *   1. The warning logged on 409 names holder.{kind, env_id, username,
 *      expires_at} so an operator can tell which environment is winning.
 *   2. State row's `nextRetryAt` is set to
 *      `holder.expires_at + LOCK_BACKOFF_BUFFER_MS`. We reuse the same
 *      `nextRetryAt` field the 503 kill-switch path (AC 16) already uses;
 *      one mechanism, two triggers.
 *   3. A subsequent sync attempt while `now < nextRetryAt` skips the
 *      POST — the existing `isInBackoff` filter handles this once
 *      `nextRetryAt` is set. We exercise the integrated sequence
 *      (first sync seeds `nextRetryAt`, second sync skips) to keep the
 *      test from accidentally passing on the existing kill-switch wiring.
 *
 * Each assertion is `test.failing` per `.claude/skills/tdd-ci/SKILL.md` —
 * production stubs throw "Not implemented" so the tests fail in Red and
 * Green removes the marker.
 */

import { describe, expect, spyOn, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import type { StateFile } from "../src/state.ts";
import type { FetchLike } from "../src/sync-client.ts";
import { LOCK_BACKOFF_BUFFER_MS, syncFile } from "../src/sync-flow.ts";

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
	test.failing(
		"ENG-5862: 409 → daemon logs warning naming holder fields",
		async () => {
			const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
			try {
				await syncFile({
					...baseInput(),
					fetchImpl: makeLockHeldFetch(),
				});
				// Concatenate every warn-call's args into one string so the test
				// is robust to the exact log format Green chooses (single line
				// vs structured fields, etc.).
				const allWarnings = warnSpy.mock.calls
					.flat()
					.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
					.join(" | ");
				expect(allWarnings).toContain(HOLDER.environment_kind);
				expect(allWarnings).toContain(HOLDER.environment_id);
				expect(allWarnings).toContain(HOLDER.username);
				expect(allWarnings).toContain(HOLDER.expires_at);
			} finally {
				warnSpy.mockRestore();
			}
		},
	);

	test.failing(
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

	test.failing(
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
