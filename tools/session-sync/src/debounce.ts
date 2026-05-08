/**
 * Pure timer state-machine for the daemon's idle debounce (AC 13).
 *
 * `notify(key, now)` records the most-recent activity timestamp for a
 * key. `isIdle(key, now, idleThresholdMs)` returns true when no
 * activity has happened within the window — i.e. `now - lastActivity
 * >= idleThresholdMs`, or the key was never notified.
 *
 * The `setTimeout` glue that turns isIdle into "fire a callback" lives
 * in Step 3c. This module is pure so we can test it without fake timers.
 */

export class IdleDebouncer<K> {
	private readonly lastActivity = new Map<K, number>();

	notify(key: K, now: number): void {
		const prev = this.lastActivity.get(key);
		if (prev === undefined || now > prev) {
			this.lastActivity.set(key, now);
		}
	}

	isIdle(key: K, now: number, idleThresholdMs: number): boolean {
		const last = this.lastActivity.get(key);
		if (last === undefined) return true;
		return now - last >= idleThresholdMs;
	}

	forget(key: K): void {
		this.lastActivity.delete(key);
	}
}
