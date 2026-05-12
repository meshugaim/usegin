/**
 * Heartbeat loop for the session-sync daemon (AC 40, AC 41).
 *
 * A claude session can sit "active" for minutes between JSONL writes —
 * the user is reading, thinking, or the model is generating without
 * appending new turns. We don't want those sessions to look stale on
 * the dashboard, and we don't want to lose the dev-session lock to a
 * peer environment just because no fs.watch event fired. The heartbeat
 * pings the server on a fixed interval whenever there are unflushed
 * bytes for a session, which both renews `lock_expires_at` and keeps
 * the row's `last_activity_at` honest.
 *
 * Trigger predicate is split off as `shouldHeartbeat(state, mtimeMs, now)`
 * — a pure function with no I/O — so we can unit-test the decision
 * without spinning up timers or touching the file system. The
 * `heartbeatLoop` factory wraps it in a `setInterval` (60s) and is the
 * shape cli.ts wires into the daemon alongside the safety-net tick.
 *
 * "Unflushed bytes" is derived from the file's mtime vs the per-file
 * state's `lastUploadedAt`: if the JSONL has been written to since the
 * last successful upload, there are bytes the server hasn't seen yet.
 * No hash recomputation, no extra syscalls beyond the stat the caller
 * already does.
 */

import type { PerFileState } from "./state.ts";

/**
 * Heartbeat interval — 60s. Aligns with AC 41's "heartbeat every 60s
 * while bytes are unflushed" wording from the spec.
 */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Pure predicate: should this session be heartbeated right now?
 *
 * Returns true when both:
 *   - the JSONL has unflushed bytes (`mtimeMs > parseIso(lastUploadedAt)`)
 *   - the last upload is at least `HEARTBEAT_INTERVAL_MS` old
 *
 * Returns false when:
 *   - there's nothing to heartbeat (no unflushed bytes), or
 *   - we already uploaded within the interval window (a real upload
 *     obviates the heartbeat), or
 *   - `mtimeMs` is null (the file was deleted between the watch event
 *     and this tick — nothing to heartbeat for a deleted file).
 *
 * @param state    Per-file state row for this session.
 * @param mtimeMs  Current `mtimeMs` of the session's JSONL on disk, or
 *                 null when the file no longer exists (deleted between
 *                 watch event and heartbeat tick).
 * @param now      Wall-clock "now"; injected for deterministic tests.
 */
export function shouldHeartbeat(
	state: PerFileState,
	mtimeMs: number | null,
	now: Date,
): boolean {
	// File deleted between watch event and this tick — nothing to ping.
	if (mtimeMs === null) return false;

	// `lastUploadedAt = ""` is the per-file-state sentinel for "never
	// uploaded" (kill_switch creates a fresh state row with no prior
	// upload). `Date.parse("")` is NaN, which would taint every
	// comparison downstream. Treat as 0 (epoch) — anything-since-epoch
	// is "unflushed".
	const lastUploadedAtParsed = state.lastUploadedAt
		? Date.parse(state.lastUploadedAt)
		: Number.NaN;
	const lastUploadedMs = Number.isFinite(lastUploadedAtParsed)
		? lastUploadedAtParsed
		: 0;
	const lastHeartbeatMs = state.lastHeartbeatAt
		? Date.parse(state.lastHeartbeatAt)
		: 0;
	// Most-recent lease-refreshing activity: either an upload (which
	// renews lock_expires_at server-side, AC 14) or a successful
	// heartbeat (AC 40). Either obviates the next heartbeat tick.
	const lastActivityMs = Math.max(lastUploadedMs, lastHeartbeatMs);

	// Unflushed bytes are derived from mtime > lastUploadedAt
	// specifically — a heartbeat at T+30s doesn't change what bytes the
	// server has, only the lease. So we still want to heartbeat as long
	// as the file has unsent bytes.
	const hasUnflushedBytes = mtimeMs > lastUploadedMs;
	if (!hasUnflushedBytes) return false;

	const recentActivity =
		now.getTime() - lastActivityMs < HEARTBEAT_INTERVAL_MS;
	return !recentActivity;
}

export interface HeartbeatLoopDeps {
	/** Returns the current per-file state snapshot. */
	getState: () => Record<string, PerFileState>;
	/** Returns `mtimeMs` for a session file, or null if it no longer exists. */
	getMtimeMs: (path: string) => Promise<number | null>;
	/** Fires the actual heartbeat POST for one session. */
	sendHeartbeat: (
		path: string,
		state: PerFileState,
	) => Promise<void>;
	/** Wall-clock source; injected for tests. */
	now?: () => Date;
	/** Interval override for tests; defaults to `HEARTBEAT_INTERVAL_MS`. */
	intervalMs?: number;
}

export interface HeartbeatLoopHandle {
	stop: () => void;
}

/**
 * Factory: start the heartbeat loop. Returns a handle whose `stop()`
 * clears the interval — caller (cli.ts) calls it from shutdown().
 */
export function heartbeatLoop(deps: HeartbeatLoopDeps): HeartbeatLoopHandle {
	const now = deps.now ?? (() => new Date());
	const intervalMs = deps.intervalMs ?? HEARTBEAT_INTERVAL_MS;

	const tick = async (): Promise<void> => {
		const state = deps.getState();
		// Snapshot the keys first — `state` is the live map the daemon
		// mutates inside `sendHeartbeat` callbacks, so iterating directly
		// can surface mid-tick insertions. Object.entries() is a snapshot,
		// but make the intent explicit.
		const entries = Object.entries(state);
		for (const [path, perFile] of entries) {
			const mtimeMs = await deps.getMtimeMs(path);
			if (!shouldHeartbeat(perFile, mtimeMs, now())) continue;
			try {
				await deps.sendHeartbeat(path, perFile);
			} catch (err) {
				// One sick session must not poison the rest of the tick.
				// Caller's `sendHeartbeat` is expected to log; we swallow
				// here so the loop keeps moving.
				console.warn(
					"[session-sync] heartbeat tick: sendHeartbeat threw for",
					path,
					"-",
					(err as Error).message,
				);
			}
		}
	};

	const handle = setInterval(() => {
		void tick();
	}, intervalMs);
	// Allow process exit even with the interval still scheduled — the
	// daemon's shutdown sequence calls `stop()` explicitly, but if
	// something else forces an unclean exit, we don't want a hung event
	// loop blocking it.
	if (typeof handle === "object" && handle !== null && "unref" in handle) {
		(handle as { unref: () => void }).unref();
	}
	return {
		stop: () => clearInterval(handle),
	};
}
