/**
 * 503 sync-disabled backoff math (AC 45 daemon side).
 *
 * When the sync endpoint returns 503 ("sync_disabled"), the daemon sets
 * `state.nextRetryAt = now + 5min` for that session and skips it in
 * the watch loop until `now >= nextRetryAt`. The safety-net interval
 * picks it up again past the deadline and clears the marker on the
 * next 2xx upload.
 */

import type { PerFileState } from "./state.ts";

export function computeNextRetryAt(now: Date, intervalMs: number): string {
	return new Date(now.getTime() + intervalMs).toISOString();
}

export function isInBackoff(state: PerFileState, now: Date): boolean {
	if (!state.nextRetryAt) return false;
	return new Date(state.nextRetryAt).getTime() > now.getTime();
}
