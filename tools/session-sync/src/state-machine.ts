/**
 * Pure auth-state machine for the session-sync daemon (ENG-5990).
 *
 * Two states: `ok` (normal operation) and `needs-auth` (idle until creds
 * arrive). Transitions are driven by triggers (auth-failure events,
 * credentials-mtime events, recovery successes). `dispatch` returns the
 * new state plus an ordered list of side-effects the wire layer must
 * execute — no I/O, no clock, no closures over external state.
 *
 * The wire layer (cli.ts) translates each effect into the actual file
 * write / watcher arm / heartbeat stop / etc.
 *
 * Effect ordering on recovery (`needs-auth → ok`): assign-auth → delete-flag
 * → drain-backlog → start-heartbeat → close-watcher. Banner correctness
 * (delete-before-drain) is the load-bearing invariant — a crash between
 * drain-POST and delete-flag would leave a stale ⚠ on the next boot.
 */

import type { AuthContext } from "./auth.ts";
import type { NeedsAuthErrorClass } from "./needs-auth-flag.ts";

export type AuthState = "ok" | "needs-auth";

export interface AuthFailureContext {
	errorClass: NeedsAuthErrorClass;
	errorMessage: string;
}

/** Triggers — events that may cause a transition. */
export type Trigger =
	| {
			kind: "auth-failure";
			ctx: AuthFailureContext;
			/** When ISO timestamp; injected so dispatch stays pure. */
			now: string;
	  }
	| {
			kind: "credentials-changed";
			/** A loadAuth attempt result. */
			loadResult:
				| { ok: true; auth: AuthContext }
				| { ok: false; ctx: AuthFailureContext };
			now: string;
	  };

/** Side-effects emitted by `dispatch`. */
export type Effect =
	| { kind: "write-flag"; since: string; lastCheckedAt: string; errorClass: NeedsAuthErrorClass; errorMessage: string }
	| { kind: "update-flag"; lastCheckedAt: string; errorClass: NeedsAuthErrorClass; errorMessage: string }
	| { kind: "delete-flag" }
	| { kind: "assign-auth"; auth: AuthContext }
	| { kind: "clear-auth" }
	| { kind: "arm-watcher" }
	| { kind: "close-watcher" }
	| { kind: "stop-heartbeat" }
	| { kind: "start-heartbeat" }
	| { kind: "drain-backlog" };

export interface MachineSnapshot {
	state: AuthState;
	/** When `state === 'needs-auth'`, the original entry timestamp. */
	since: string | null;
}

export interface DispatchResult {
	next: MachineSnapshot;
	effects: Effect[];
}

/**
 * Pure dispatcher. `current` is the current machine snapshot;
 * `trigger` is the event. Returns the new snapshot plus the ordered
 * effect list.
 *
 * Defensive: triggers that don't apply to the current state (e.g.
 * a stale `credentials-changed` arriving after the watcher closed)
 * are no-ops — no transition, no effects.
 */
export function dispatch(
	current: MachineSnapshot,
	trigger: Trigger,
): DispatchResult {
	if (trigger.kind === "auth-failure") {
		if (current.state === "ok") {
			// ok → needs-auth: write flag, clear auth, stop heartbeat, arm watcher.
			return {
				next: { state: "needs-auth", since: trigger.now },
				effects: [
					{
						kind: "write-flag",
						since: trigger.now,
						lastCheckedAt: trigger.now,
						errorClass: trigger.ctx.errorClass,
						errorMessage: trigger.ctx.errorMessage,
					},
					{ kind: "clear-auth" },
					{ kind: "stop-heartbeat" },
					{ kind: "arm-watcher" },
				],
			};
		}
		// already needs-auth: idempotent stay — but DON'T update lastCheckedAt
		// here. lastCheckedAt only advances when we actually re-tried loadAuth
		// (credentials-changed trigger with ok:false). A duplicate auth-failure
		// from a different call site is a no-op.
		return { next: current, effects: [] };
	}

	if (trigger.kind === "credentials-changed") {
		if (current.state !== "needs-auth") {
			// Stale trigger after watcher tear-down or during ok state.
			// Defensive no-op (T15).
			return { next: current, effects: [] };
		}
		if (trigger.loadResult.ok) {
			// needs-auth → ok: recovery sequence.
			//   1. assign refreshed auth (so subsequent POSTs use it).
			//   2. delete flag (banner-correctness over re-upload-avoid).
			//   3. drain backlog (one-shot safety-net pass).
			//   4. start heartbeat (against the new d.auth, not the stale one).
			//   5. close watcher (last — self-write feedback-loop guard).
			return {
				next: { state: "ok", since: null },
				effects: [
					{ kind: "assign-auth", auth: trigger.loadResult.auth },
					{ kind: "delete-flag" },
					{ kind: "drain-backlog" },
					{ kind: "start-heartbeat" },
					{ kind: "close-watcher" },
				],
			};
		}
		// needs-auth → needs-auth: preserve `since`, bump lastCheckedAt.
		return {
			next: current,
			effects: [
				{
					kind: "update-flag",
					lastCheckedAt: trigger.now,
					errorClass: trigger.loadResult.ctx.errorClass,
					errorMessage: trigger.loadResult.ctx.errorMessage,
				},
			],
		};
	}

	// Exhaustive — TypeScript catches unhandled trigger kinds, but defensive
	// return keeps the function total.
	return { next: current, effects: [] };
}

/** Initial snapshot for a fresh boot with no pre-existing flag. */
export function initialOk(): MachineSnapshot {
	return { state: "ok", since: null };
}

/**
 * Initial snapshot for a boot that found a pre-existing `needs-auth.flag`
 * — i.e. restart persistence. `since` is preserved from the flag so the
 * banner's "waiting for login since 12m ago" age stays accurate across
 * restarts.
 */
export function initialNeedsAuth(since: string): MachineSnapshot {
	return { state: "needs-auth", since };
}
