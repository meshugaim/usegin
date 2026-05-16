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
import type { NeedsAuthErrorClass, NeedsAuthFlag } from "./needs-auth-flag.ts";
import {
	type Effect,
	initialNeedsAuth,
	initialOk,
	type MachineSnapshot,
} from "./state-machine.ts";

export interface BootAuthDecisionInput {
	/** The on-disk `needs-auth.flag`, or null if none. */
	flag: NeedsAuthFlag | null;
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
 * Four cases — full matrix over (flag presence, loadAuth outcome):
 *
 *   1. no flag + loadAuth ok       → state ok, no effects.
 *   2. no flag + loadAuth fails    → write flag, enter needs-auth.
 *   3. flag present + loadAuth ok  → DELETE flag, enter ok.
 *   4. flag present + loadAuth fails → keep flag, bump lastCheckedAt,
 *                                       preserve original `since`.
 *
 * Case 3 is the load-bearing one: it makes the `effi auth refresh &&
 * pm2 restart session-sync` recovery sequence actually recover. The
 * effect order (assign-auth before delete-flag) mirrors
 * state-machine.ts's recovery sequence so banner correctness holds
 * even if the daemon crashes mid-apply.
 */
export function decideBootAuthState(
	input: BootAuthDecisionInput,
): BootAuthDecision {
	if (input.flag === null) {
		if (input.loadAuthResult.ok) {
			// Case 1: clean boot.
			return {
				snapshot: initialOk(),
				auth: input.loadAuthResult.auth,
				effects: [],
			};
		}
		// Case 2: first-time auth failure.
		return {
			snapshot: initialNeedsAuth(input.now),
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
	if (input.loadAuthResult.ok) {
		// Case 3: credentials valid despite a stale flag — recover into ok.
		return {
			snapshot: initialOk(),
			auth: input.loadAuthResult.auth,
			effects: [
				{ kind: "assign-auth", auth: input.loadAuthResult.auth },
				{ kind: "delete-flag" },
			],
		};
	}
	// Case 4: still broken. Preserve `since` from the flag so the banner's
	// "waiting for login since 12m ago" age stays accurate across restarts.
	return {
		snapshot: initialNeedsAuth(input.flag.since),
		auth: null,
		effects: [
			{
				kind: "update-flag",
				lastCheckedAt: input.now,
				errorClass: input.loadAuthResult.errorClass,
				errorMessage: input.loadAuthResult.errorMessage,
			},
		],
	};
}
