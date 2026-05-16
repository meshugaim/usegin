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

const SAMPLE_AUTH: AuthContext = {
	token: "fake.jwt.token",
	apiUrl: "http://localhost:63000",
	userId: "user-uuid-1",
};

const T_SINCE = "2026-05-14T09:42:38.598Z";
const T_NOW = "2026-05-14T09:51:02.103Z";

// Lazy import — module doesn't exist yet (Red phase).
async function getDecideBootAuthState() {
	const mod = await import("../src/boot-auth.ts");
	return mod.decideBootAuthState;
}

describe("decideBootAuthState — flag present + loadAuth succeeds (ENG-6032)", () => {
	test.failing(
		"ENG-6032: boot probes loadAuth when needs-auth.flag exists; success → state ok + flag deleted",
		async () => {
			const decide = await getDecideBootAuthState();
			const result = decide({
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
			const kinds = result.effects.map((e) => e.kind);
			expect(kinds).toContain("delete-flag");
			const assignIdx = kinds.indexOf("assign-auth");
			const deleteIdx = kinds.indexOf("delete-flag");
			expect(assignIdx).toBeGreaterThanOrEqual(0);
			expect(assignIdx).toBeLessThan(deleteIdx);
		},
	);
});
