/**
 * Per-event coalescer for the session-sync daemon (AC 13).
 *
 * Sits one layer above raw `fs.watch` events: each notify() updates the
 * "last activity" timestamp for a session, and takeReady() extracts the
 * sessions whose last activity is at-or-past `idleThresholdMs` (i.e. the
 * file has been idle long enough for us to upload). Extracted entries
 * are removed from internal state — the caller fires `syncSession` on
 * each one and the next watch event re-seeds the entry if more bytes
 * land.
 *
 * Distinct from `debounce.ts`'s `IdleDebouncer`: that's a pure timer
 * predicate (`isIdle?`); this is the higher-level mapper from raw events
 * to a set of "sessions ready to sync this tick." Threshold semantics
 * are aligned with `IdleDebouncer.isIdle`: `now - lastEventAt >=
 * idleThresholdMs` is ready (closed at the boundary).
 *
 * Out-of-order events (older `time` arriving after a newer one) do NOT
 * regress `lastEventAt` — the most-recent activity wins. This matches
 * `IdleDebouncer.notify`'s behavior and keeps debounce honest under
 * fs.watch's loose ordering guarantees.
 */

export interface CoalescerEvent {
	path: string;
	sessionId: string;
	/** epoch milliseconds */
	time: number;
}

export interface ReadySession {
	sessionId: string;
	path: string;
	/** epoch ms — when readiness was detected (i.e. last event time) */
	lastEventAt: number;
}

interface PendingEntry {
	path: string;
	lastEventAt: number;
}

export class Coalescer {
	private readonly pending = new Map<string, PendingEntry>();

	notify(event: CoalescerEvent): void {
		const prev = this.pending.get(event.sessionId);
		if (prev === undefined || event.time > prev.lastEventAt) {
			this.pending.set(event.sessionId, {
				path: event.path,
				lastEventAt: event.time,
			});
		}
	}

	/**
	 * Returns sessions whose last event was at or beyond
	 * `idleThresholdMs` ago, removing them from internal state. Closed
	 * at the boundary: `now - lastEventAt >= idleThresholdMs` is ready,
	 * matching the convention in `debounce.ts`.
	 */
	takeReady(now: number, idleThresholdMs: number): ReadySession[] {
		const ready: ReadySession[] = [];
		for (const [sessionId, entry] of this.pending) {
			if (now - entry.lastEventAt >= idleThresholdMs) {
				ready.push({
					sessionId,
					path: entry.path,
					lastEventAt: entry.lastEventAt,
				});
			}
		}
		for (const r of ready) {
			this.pending.delete(r.sessionId);
		}
		return ready;
	}

	pendingCount(): number {
		return this.pending.size;
	}
}
