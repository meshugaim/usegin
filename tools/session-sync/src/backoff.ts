/**
 * Backoff math for the session-sync daemon.
 *
 * Two backoff triggers share a single `nextRetryAt` mechanism on
 * `PerFileState`:
 *
 *   - AC 45 / kill-switch: 503 with `{error:"sync_disabled"}` →
 *     `nextRetryAt = now + KILL_SWITCH_BACKOFF_MS` (5 minutes).
 *   - AC 15 / lock-held: 409 from sync or heartbeat → `nextRetryAt =
 *     holder.expires_at + LOCK_BACKOFF_BUFFER_MS`, falling back to
 *     `now + LOCK_BACKOFF_NULL_EXPIRES_FALLBACK_MS` when the server's
 *     `lockRow` lookup was stale and returned a null `expires_at`.
 *
 * `isInBackoff` is the single check both paths read against; the
 * safety-net interval picks files up again past the deadline and the
 * next 2xx upload clears the marker.
 */

import type { PerFileState } from "./state.ts";

/**
 * 503 sync-disabled backoff window (AC 45). 5 minutes balances "long
 * enough that we don't hammer the kill-switch while it's still flipped"
 * with "short enough that we recover promptly once it's flipped back".
 */
export const KILL_SWITCH_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Clock-skew buffer added to `holder.expires_at` when scheduling a retry
 * after a 409 lock_held (AC 15). 5s is large enough to swallow modest
 * skew between this daemon's clock and the server's lock_expires_at
 * timestamp, small enough that the loser environment picks up the work
 * promptly once the holder really has expired.
 */
export const LOCK_BACKOFF_BUFFER_MS = 5_000;

/**
 * Fallback backoff used when a 409 lock_held arrives with
 * `holder.expires_at = null` (READ COMMITTED stale-holder edge case in
 * step 4). Doing `new Date(null).getTime() + LOCK_BACKOFF_BUFFER_MS`
 * resolves to 1970-01-01T00:00:05Z and would trigger an instant retry
 * storm; 60s is "soon enough that the loser env catches up, slow enough
 * that we don't hammer the server".
 */
export const LOCK_BACKOFF_NULL_EXPIRES_FALLBACK_MS = 60_000;

export function computeNextRetryAt(now: Date, intervalMs: number): string {
	return new Date(now.getTime() + intervalMs).toISOString();
}

export function isInBackoff(state: PerFileState, now: Date): boolean {
	if (!state.nextRetryAt) return false;
	return new Date(state.nextRetryAt).getTime() > now.getTime();
}
