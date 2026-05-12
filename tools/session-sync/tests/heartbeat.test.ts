/**
 * AC 40 / AC 41 / ENG-5862 step 5 (Red).
 *
 * `shouldHeartbeat(state, mtimeMs, now)` is the pure predicate the
 * daemon's heartbeat loop calls every tick. We test the four corners
 * of the truth table:
 *
 *   - Unflushed bytes present AND lastUpload > 60s ago → heartbeat.
 *   - Last upload < 60s ago                            → don't heartbeat
 *     (the recent upload already refreshed lock_expires_at).
 *   - No unflushed bytes (file mtime <= lastUploadedAt) → don't
 *     heartbeat (nothing for the server to know about).
 *   - mtimeMs is null (file deleted between watch event and this tick)
 *     → don't heartbeat (no file to talk about).
 *
 * Pure function — no I/O, no timers. Caller (cli.ts heartbeat loop)
 * supplies `mtimeMs` from a `statSync` it already does (or null when the
 * file no longer exists), and `now` from the wall clock.
 */

import { describe, expect, test } from "bun:test";
import { shouldHeartbeat } from "../src/heartbeat.ts";
import type { PerFileState } from "../src/state.ts";

const NOW = new Date("2026-05-12T12:00:00.000Z");
const NOW_MS = NOW.getTime();

function baseState(overrides: Partial<PerFileState> = {}): PerFileState {
	return {
		contentHash: "h".repeat(64),
		lastUploadedSize: 100,
		sessionId: "sess-1",
		storagePath: "uid/2026-05-12/sess-1.jsonl.gz",
		lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
		...overrides,
	};
}

describe("shouldHeartbeat (AC 40, AC 41)", () => {
	test("ENG-5862: unflushed bytes AND last upload > 60s ago → true", () => {
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
		});
		// File last modified 10s ago — AFTER lastUploadedAt
		// (NOW - 90s). Unflushed bytes present.
		const mtimeMs = NOW_MS - 10_000;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(true);
	});

	test("ENG-5862: last upload < 60s ago → false (recent upload already refreshed lock)", () => {
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 30_000).toISOString(),
		});
		// Unflushed bytes are present (mtime newer than lastUploadedAt),
		// but we uploaded recently — no need to heartbeat yet.
		const mtimeMs = NOW_MS - 10_000;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
	});

	test("ENG-5862: no unflushed bytes (mtime <= lastUploadedAt) → false", () => {
		const lastUploadedAtIso = new Date(NOW_MS - 90_000).toISOString();
		const state = baseState({ lastUploadedAt: lastUploadedAtIso });
		// File was last modified BEFORE the last upload — server already
		// has everything.
		const mtimeMs = new Date(lastUploadedAtIso).getTime() - 100;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
	});

	test("ENG-5862: shouldHeartbeat returns false when mtimeMs is null (file deleted)", () => {
		// Race: fs.watch fired, but by the time the heartbeat tick reads
		// mtime the file has been deleted (claude session ended, log
		// rotated, etc.). Caller passes null; predicate must short-circuit
		// to false rather than throw on a null arithmetic op.
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
		});
		expect(shouldHeartbeat(state, null, NOW)).toBe(false);
	});

	test("ENG-5862: lastHeartbeatAt is recent → false even when lastUploadedAt is stale", () => {
		// Pins the `lastHeartbeatAt` arm of `max(lastUploadedAt,
		// lastHeartbeatAt)`. The previous 4 tests only flexed the
		// `lastUploadedAt` arm — a regression that dropped the max() and
		// just read `lastUploadedAt` would still pass all of them.
		//
		// Scenario: the daemon last UPLOADED 5 minutes ago (lease would
		// have lapsed without intervention), but it HEARTBEATED 30s ago
		// (lease was renewed inside the 60s window). Unflushed bytes
		// exist (mtime > lastUploadedAt), but no new heartbeat is owed —
		// the recent heartbeat already refreshed the lock.
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 5 * 60_000).toISOString(), // 5min ago
			lastHeartbeatAt: new Date(NOW_MS - 30_000).toISOString(), // 30s ago
		});
		const mtimeMs = NOW_MS - 1_000; // 1s ago, AFTER lastUploadedAt
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
	});

	/**
	 * Boundary triplet pinning the 60_000ms strict-less-than threshold in
	 * `now.getTime() - lastActivityMs < HEARTBEAT_INTERVAL_MS`. Three tests
	 * straddle the edge: 1ms below (still recent → skip), exact threshold
	 * (no longer recent → heartbeat — load-bearing for the loop catching
	 * the t=60s tick), and 1ms above (definitely not recent → heartbeat).
	 *
	 * A future regression that flips `<` to `<=` would fail the exact-
	 * threshold case and stop heartbeating at the exact 60s tick the loop
	 * is designed to land on.
	 */
	test("ENG-5862: shouldHeartbeat returns false at sinceLastUploadMs = 59_999", () => {
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 59_999).toISOString(),
		});
		// Unflushed bytes: mtime newer than lastUploadedAt.
		const mtimeMs = NOW_MS - 100;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
	});

	test("ENG-5862: shouldHeartbeat returns true at sinceLastUploadMs = 60_000", () => {
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 60_000).toISOString(),
		});
		const mtimeMs = NOW_MS - 100;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(true);
	});

	test("ENG-5862: shouldHeartbeat returns true at sinceLastUploadMs = 60_001", () => {
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 60_001).toISOString(),
		});
		const mtimeMs = NOW_MS - 100;
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(true);
	});

	test("ENG-5862 step 6 follow-up: shouldHeartbeat returns false when state.releasedAt is set (no-hot-loop guard)", () => {
		// AC 18 ext: after the daemon successfully releases the
		// dev-session lock on a completion-sync (DELETE 204), the
		// per-file state row carries `releasedAt`. The heartbeat loop
		// must skip released sessions — otherwise it would hit
		// `refresh_dev_session_lock` (UPDATE-only, migration
		// 20260512150635), get 0 rows, the endpoint would surface a
		// 409 with all-null holder fields, and the daemon's existing
		// null-holder handler would set `nextRetryAt = now + 60s` and
		// re-attempt forever in a 60s hot loop. This pin is the
		// no-hot-loop guarantee.
		//
		// Every OTHER predicate condition for "yes, heartbeat" holds
		// here — unflushed bytes (mtime > lastUploadedAt), last upload
		// > 60s ago. Only `releasedAt` short-circuits to false; a
		// regression that drops the guard would fail this test alone
		// while every other heartbeat test still passes.
		const state = baseState({
			lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
			releasedAt: new Date(NOW_MS - 5_000).toISOString(),
		});
		const mtimeMs = NOW_MS - 1_000; // unflushed bytes present
		expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
	});
});
