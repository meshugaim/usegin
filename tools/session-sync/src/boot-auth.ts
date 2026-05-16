/**
 * Pure boot-time auth decision for the session-sync daemon (ENG-6032).
 *
 * The one-shot equivalent of `state-machine.ts::dispatch`, called once
 * at daemon start. Inputs: the on-disk `needs-auth.flag` (if any) and
 * the result of a `loadAuth` probe. Output: the boot snapshot, the
 * `AuthContext` (if any), and the ordered effect list the wire layer
 * must apply.
 *
 * Why this exists (ENG-6032): the original boot path trusted the flag
 * blindly — if `needs-auth.flag` was on disk, the daemon entered
 * `needs-auth` without ever calling `loadAuth`. Valid credentials
 * (e.g. after `effi auth refresh && pm2 restart session-sync`) were
 * ignored until a post-boot mtime change fired the credentials
 * watcher — which the refresh-then-restart sequence deterministically
 * never produces. Result: an inert daemon advertising bad advice in
 * its banner.
 *
 * The fix: boot ALWAYS probes `loadAuth`. The flag's presence is now
 * a hint (preserves `since` if we end up in `needs-auth`), not a
 * verdict.
 */

import type { AuthContext } from "./auth.ts";
import type { NeedsAuthErrorClass } from "./needs-auth-flag.ts";
import {
	type Effect,
	initialNeedsAuth,
	initialOk,
	type MachineSnapshot,
} from "./state-machine.ts";

export interface BootAuthDecisionInput {
	/** The on-disk `needs-auth.flag`, or null if none. */
	flag: {
		since: string;
		lastCheckedAt: string;
		errorClass: NeedsAuthErrorClass;
		errorMessage: string;
	} | null;
	/** Result of the boot-time `loadAuth` probe. */
	loadAuthResult:
		| { ok: true; auth: AuthContext }
		| { ok: false; errorClass: NeedsAuthErrorClass; errorMessage: string };
	/** Now-clock — injected for purity. ISO 8601. */
	now: string;
}

export interface BootAuthDecision {
	snapshot: MachineSnapshot;
	/** Non-null when `snapshot.state === 'ok'`. */
	auth: AuthContext | null;
	/** Effects to apply in order — flag I/O, watcher arm, etc. */
	effects: Effect[];
}

/**
 * Decide the daemon's boot-time auth posture.
 *
 * Stub (Red phase): mirrors the OLD broken behavior — trusts the
 * flag's presence and skips the loadAuth probe. The Red test asserts
 * the CORRECT behavior, so this stub makes the test fail with the
 * right reason: the function returns the wrong answer.
 *
 * Green replaces this body with the probing logic.
 */
export function decideBootAuthState(
	input: BootAuthDecisionInput,
): BootAuthDecision {
	if (input.flag) {
		// OLD broken behavior: trust the flag, ignore loadAuthResult.
		return {
			snapshot: initialNeedsAuth(input.flag.since),
			auth: null,
			effects: [
				{
					kind: "update-flag",
					lastCheckedAt: input.now,
					errorClass: input.flag.errorClass,
					errorMessage: input.flag.errorMessage,
				},
			],
		};
	}
	if (input.loadAuthResult.ok) {
		return {
			snapshot: initialOk(),
			auth: input.loadAuthResult.auth,
			effects: [],
		};
	}
	return {
		snapshot: { state: "needs-auth", since: input.now },
		auth: null,
		effects: [
			{
				kind: "write-flag",
				since: input.now,
				lastCheckedAt: input.now,
				errorClass: input.loadAuthResult.errorClass,
				errorMessage: input.loadAuthResult.errorMessage,
			},
		],
	};
}
