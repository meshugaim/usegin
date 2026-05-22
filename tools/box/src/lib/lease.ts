/**
 * Lease + hard-cap decision logic — pure. No IO.
 *
 * The cost-safety core of `box watch` (slice 7): given a box's last-observed
 * activity, when it came up, the idle/TTL policy, and the current time, decide
 * whether to keep the box or down it. The watchdog reads activity over the
 * tailnet and calls `box down`; ALL of that IO lives elsewhere. This module is
 * just the timeline math, so it can be exhaustively unit-tested with synthetic
 * activity timelines (no clock, no network, no processes).
 *
 * Two independent deadlines drive the decision:
 *   - the **hard cap** (`upSince + hardCapMs`): the backstop that downs a box no
 *     matter what, even one that looks active — it catches a stuck/looping box and
 *     a lease detector that's been fooled.
 *   - the **idle deadline** (`lastActivity + idleMs`): downs a box once activity
 *     has been quiet for `idleMs`.
 *
 * **Bias against false-down.** Killing live work is the worst failure for a dev
 * box. So when `lastActivity` is `null` (we couldn't read activity — agent
 * unreachable, signal ambiguous), we treat the box as possibly-working and
 * NEVER idle-down it; only the hard cap may down it. We lean on the hard cap +
 * alerts for the forgotten-box case rather than risk tearing down a running agent.
 */

export interface LeaseState {
  /**
   * ISO time of the box's last observed activity (claude/test/agent process or
   * heartbeat). `null` = activity unknown/unreadable — treated as possibly-working
   * (never idle-downed; see the false-down bias above).
   */
  lastActivity: string | null;
  /** ISO time the box came up — the anchor for the hard cap. */
  upSince: string;
}

export interface LeasePolicy {
  /** Down the box after this many ms with no activity. */
  idleMs: number;
  /**
   * Hard cap: down the box after this many ms of uptime regardless of activity.
   * `null` = no hard cap (only the idle rule can down it).
   */
  hardCapMs: number | null;
}

export type LeaseAction =
  | {
      action: "keep";
      reason: string;
      /**
       * ms until the NEAREST upcoming deadline (the min of the idle and hard-cap
       * deadlines that exist), or `null` if neither deadline applies — i.e. no
       * hard cap and activity is unknown, so nothing will ever down this box.
       */
      downInMs: number | null;
    }
  | { action: "down"; reason: "idle" | "hard-cap" };

/**
 * Decide whether to keep a box up or down it, given its lease state, the policy,
 * and the current time. Pure: every input (including `now`) is an argument; no
 * `Date.now()`, no IO, no side effects.
 *
 * Precedence (the hard cap is the backstop, so it wins):
 *   1. `now >= hardDeadline`            → down "hard-cap" (even if active).
 *   2. activity known & `now >= idleDeadline` → down "idle".
 *   3. otherwise                        → keep, with `downInMs` to the nearest
 *      upcoming deadline (or `null` if neither deadline exists).
 *
 * Boundaries are inclusive: reaching a deadline exactly (`now === deadline`) downs
 * the box — the deadline is the moment it's allowed to die.
 */
export function decideLeaseAction(
  state: LeaseState,
  policy: LeasePolicy,
  now: Date,
): LeaseAction {
  const nowMs = now.getTime();

  // Hard-cap deadline (only when a cap is configured).
  const hardDeadline =
    policy.hardCapMs != null
      ? new Date(state.upSince).getTime() + policy.hardCapMs
      : null;

  // Idle deadline (only when activity is known — null activity is never idle-downed).
  const idleDeadline =
    state.lastActivity != null
      ? new Date(state.lastActivity).getTime() + policy.idleMs
      : null;

  // 1. Hard cap is the backstop: it downs the box even if it looks active.
  if (hardDeadline != null && nowMs >= hardDeadline) {
    return { action: "down", reason: "hard-cap" };
  }

  // 2. Idle: only when we actually observed activity (bias against false-down).
  if (idleDeadline != null && nowMs >= idleDeadline) {
    return { action: "down", reason: "idle" };
  }

  // 3. Keep. downInMs = ms to the nearest upcoming deadline (min of those that
  //    exist), or null when neither deadline applies (no cap + unknown activity).
  const deadlines: number[] = [];
  if (hardDeadline != null) deadlines.push(hardDeadline);
  if (idleDeadline != null) deadlines.push(idleDeadline);

  const downInMs =
    deadlines.length > 0 ? Math.min(...deadlines) - nowMs : null;

  const reason =
    state.lastActivity == null
      ? "activity unknown — only the hard cap can down this box"
      : "active within the idle window";

  return { action: "keep", reason, downInMs };
}
