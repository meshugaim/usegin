/**
 * Tests for `state-machine.ts` (ENG-5990).
 *
 * Pure dispatcher — no I/O. Covers all ok ↔ needs-auth transitions
 * (T1a entry, T3 happy recovery, T4 failed recovery, T15 defensive
 * no-op, T19 race convergence).
 */

import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import {
	dispatch,
	initialNeedsAuth,
	initialOk,
	type MachineSnapshot,
} from "../src/state-machine.ts";

const SAMPLE_AUTH: AuthContext = {
	token: "fake.jwt.token",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid-1",
};

const T0 = "2026-05-14T09:42:38.598Z";
const T1 = "2026-05-14T09:51:02.103Z";

describe("dispatch — ok → needs-auth (entry-edge, T1a)", () => {
	test("auth-failure from ok writes flag, clears auth, stops heartbeat, arms watcher", () => {
		const result = dispatch(initialOk(), {
			kind: "auth-failure",
			ctx: { errorClass: "missing_credentials", errorMessage: "boom" },
			now: T0,
		});
		expect(result.next.state).toBe("needs-auth");
		expect(result.next.since).toBe(T0);
		const kinds = result.effects.map((e) => e.kind);
		expect(kinds).toEqual([
			"write-flag",
			"clear-auth",
			"stop-heartbeat",
			"arm-watcher",
		]);
		const writeEffect = result.effects[0] as Extract<
			(typeof result.effects)[number],
			{ kind: "write-flag" }
		>;
		expect(writeEffect.since).toBe(T0);
		expect(writeEffect.lastCheckedAt).toBe(T0);
		expect(writeEffect.errorClass).toBe("missing_credentials");
		expect(writeEffect.errorMessage).toBe("boom");
	});

	test("auth-failure while already needs-auth is idempotent no-op", () => {
		const current: MachineSnapshot = initialNeedsAuth(T0);
		const result = dispatch(current, {
			kind: "auth-failure",
			ctx: { errorClass: "401_from_api", errorMessage: "second hit" },
			now: T1,
		});
		expect(result.next).toEqual(current);
		expect(result.effects).toEqual([]);
	});
});

describe("dispatch — needs-auth → ok (recovery, T3 + T12)", () => {
	test("credentials-changed with successful loadAuth emits recovery sequence", () => {
		const result = dispatch(initialNeedsAuth(T0), {
			kind: "credentials-changed",
			loadResult: { ok: true, auth: SAMPLE_AUTH },
			now: T1,
		});
		expect(result.next.state).toBe("ok");
		expect(result.next.since).toBeNull();
		expect(result.effects.map((e) => e.kind)).toEqual([
			"assign-auth",
			"delete-flag",
			"drain-backlog",
			"start-heartbeat",
			"close-watcher",
		]);
		const assignEffect = result.effects[0] as Extract<
			(typeof result.effects)[number],
			{ kind: "assign-auth" }
		>;
		expect(assignEffect.auth).toEqual(SAMPLE_AUTH);
	});

	test("delete-flag lands BEFORE drain-backlog in the effect order (T7)", () => {
		const result = dispatch(initialNeedsAuth(T0), {
			kind: "credentials-changed",
			loadResult: { ok: true, auth: SAMPLE_AUTH },
			now: T1,
		});
		const kinds = result.effects.map((e) => e.kind);
		const deleteIdx = kinds.indexOf("delete-flag");
		const drainIdx = kinds.indexOf("drain-backlog");
		expect(deleteIdx).toBeLessThan(drainIdx);
	});
});

describe("dispatch — needs-auth → needs-auth (failed recovery, T4 + T8)", () => {
	test("credentials-changed with failing loadAuth emits update-flag only; since preserved", () => {
		const start: MachineSnapshot = initialNeedsAuth(T0);
		const result = dispatch(start, {
			kind: "credentials-changed",
			loadResult: {
				ok: false,
				ctx: {
					errorClass: "expired_refresh_token",
					errorMessage: "still expired",
				},
			},
			now: T1,
		});
		expect(result.next).toEqual(start);
		expect(result.effects.length).toBe(1);
		const updateEffect = result.effects[0] as Extract<
			(typeof result.effects)[number],
			{ kind: "update-flag" }
		>;
		expect(updateEffect.kind).toBe("update-flag");
		expect(updateEffect.lastCheckedAt).toBe(T1);
		expect(updateEffect.errorMessage).toBe("still expired");
	});
});

describe("dispatch — defensive no-ops (T15)", () => {
	test("credentials-changed while in ok state is a no-op (stale trigger after teardown)", () => {
		const result = dispatch(initialOk(), {
			kind: "credentials-changed",
			loadResult: { ok: true, auth: SAMPLE_AUTH },
			now: T1,
		});
		expect(result.next).toEqual(initialOk());
		expect(result.effects).toEqual([]);
	});
});

describe("dispatch — race convergence (T19)", () => {
	test("two credentials-changed triggers in needs-auth → at-most-once transition", () => {
		// First trigger: external login completes, loadAuth succeeds.
		const step1 = dispatch(initialNeedsAuth(T0), {
			kind: "credentials-changed",
			loadResult: { ok: true, auth: SAMPLE_AUTH },
			now: T1,
		});
		expect(step1.next.state).toBe("ok");
		// Second trigger arrives shortly after (daemon's own refresh fires
		// the watcher one more time). State is already ok → no-op.
		const step2 = dispatch(step1.next, {
			kind: "credentials-changed",
			loadResult: { ok: true, auth: SAMPLE_AUTH },
			now: T1,
		});
		expect(step2.effects).toEqual([]);
		expect(step2.next).toEqual(step1.next);
	});
});

describe("initial snapshots", () => {
	test("initialOk returns clean ok state", () => {
		expect(initialOk()).toEqual({ state: "ok", since: null });
	});

	test("initialNeedsAuth preserves since (restart-persistence, T14/T18)", () => {
		expect(initialNeedsAuth(T0)).toEqual({ state: "needs-auth", since: T0 });
	});
});
