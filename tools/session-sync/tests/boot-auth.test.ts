/**
 * Tests for `boot-auth.ts` (ENG-6032).
 *
 * Pure decision function for the daemon's boot-time auth path. The
 * one-shot equivalent of `state-machine.ts::dispatch`, called once at
 * daemon start with the on-disk `needs-auth.flag` (if any) and the
 * result of a `loadAuth` probe. Returns the boot snapshot plus the
 * ordered effects the wire layer must apply.
 *
 * The load-bearing case (ENG-6032 root): a stale `needs-auth.flag`
 * left over from a prior session must NOT trap the daemon in
 * `needs-auth` when valid credentials are present. Boot probes
 * `loadAuth`; on success → delete flag, enter `ok`.
 */

import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import { decideBootAuthState } from "../src/boot-auth.ts";

const SAMPLE_AUTH: AuthContext = {
	token: "fake.jwt.token",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid-1",
};

// T_NOW is after T_SINCE — proves `since` is preserved across boot, not bumped to now.
const T_SINCE = "2026-05-14T09:42:38.598Z";
const T_NOW = "2026-05-14T09:51:02.103Z";

describe("decideBootAuthState — flag present + loadAuth succeeds", () => {
	test("ENG-6032: boot probes loadAuth when needs-auth.flag exists; success → state ok + flag deleted", () => {
		const result = decideBootAuthState({
			flag: {
				since: T_SINCE,
				lastCheckedAt: T_SINCE,
				errorClass: "expired_refresh_token",
				errorMessage: "prior boot's complaint",
			},
			loadAuthResult: { ok: true, auth: SAMPLE_AUTH },
			now: T_NOW,
		});
		expect(result.snapshot.state).toBe("ok");
		expect(result.snapshot.since).toBeNull();
		expect(result.auth).toEqual(SAMPLE_AUTH);
		// Effect order matches the state-machine's recovery sequence —
		// assign-auth before delete-flag is the load-bearing invariant.
		expect(result.effects).toEqual([
			{ kind: "assign-auth", auth: SAMPLE_AUTH },
			{ kind: "delete-flag" },
		]);
	});
});

describe("decideBootAuthState — flag present + loadAuth fails", () => {
	test("preserves original `since`, bumps lastCheckedAt, emits update-flag only", () => {
		const result = decideBootAuthState({
			flag: {
				since: T_SINCE,
				lastCheckedAt: T_SINCE,
				// Prior flag's errorClass differs from the new failure's class — proves
				// update-flag overwrites errorClass rather than preserving the prior value.
				errorClass: "missing_credentials",
				errorMessage: "prior",
			},
			loadAuthResult: {
				ok: false,
				errorClass: "expired_refresh_token",
				errorMessage: "still expired",
			},
			now: T_NOW,
		});
		expect(result.snapshot.state).toBe("needs-auth");
		expect(result.snapshot.since).toBe(T_SINCE);
		expect(result.auth).toBeNull();
		expect(result.effects.length).toBe(1);
		const effect = result.effects[0];
		if (effect === undefined || effect.kind !== "update-flag") {
			throw new Error(`expected update-flag, got ${effect?.kind ?? "undefined"}`);
		}
		expect(effect.lastCheckedAt).toBe(T_NOW);
		expect(effect.errorClass).toBe("expired_refresh_token");
		expect(effect.errorMessage).toBe("still expired");
	});
});

describe("decideBootAuthState — no flag, clean boot", () => {
	test("loadAuth ok → state ok, no effects", () => {
		const result = decideBootAuthState({
			flag: null,
			loadAuthResult: { ok: true, auth: SAMPLE_AUTH },
			now: T_NOW,
		});
		expect(result.snapshot.state).toBe("ok");
		expect(result.auth).toEqual(SAMPLE_AUTH);
		expect(result.effects).toEqual([]);
	});
});

describe("decideBootAuthState — no flag, first-time auth failure", () => {
	test("loadAuth fails → enter needs-auth with `since` = now, write fresh flag", () => {
		const result = decideBootAuthState({
			flag: null,
			loadAuthResult: {
				ok: false,
				errorClass: "missing_credentials",
				errorMessage: "no creds",
			},
			now: T_NOW,
		});
		expect(result.snapshot.state).toBe("needs-auth");
		expect(result.snapshot.since).toBe(T_NOW);
		expect(result.auth).toBeNull();
		expect(result.effects.length).toBe(1);
		const effect = result.effects[0];
		if (effect === undefined || effect.kind !== "write-flag") {
			throw new Error(`expected write-flag, got ${effect?.kind ?? "undefined"}`);
		}
		expect(effect.since).toBe(T_NOW);
		expect(effect.errorClass).toBe("missing_credentials");
	});
});
