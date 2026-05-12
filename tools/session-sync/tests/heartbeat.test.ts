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
	test.failing(
		"ENG-5862: unflushed bytes AND last upload > 60s ago → true",
		() => {
			const state = baseState({
				lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
			});
			// File last modified 10s ago — AFTER lastUploadedAt
			// (NOW - 90s). Unflushed bytes present.
			const mtimeMs = NOW_MS - 10_000;
			expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(true);
		},
	);

	test.failing(
		"ENG-5862: last upload < 60s ago → false (recent upload already refreshed lock)",
		() => {
			const state = baseState({
				lastUploadedAt: new Date(NOW_MS - 30_000).toISOString(),
			});
			// Unflushed bytes are present (mtime newer than lastUploadedAt),
			// but we uploaded recently — no need to heartbeat yet.
			const mtimeMs = NOW_MS - 10_000;
			expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
		},
	);

	test.failing(
		"ENG-5862: no unflushed bytes (mtime <= lastUploadedAt) → false",
		() => {
			const lastUploadedAtIso = new Date(NOW_MS - 90_000).toISOString();
			const state = baseState({ lastUploadedAt: lastUploadedAtIso });
			// File was last modified BEFORE the last upload — server already
			// has everything.
			const mtimeMs = new Date(lastUploadedAtIso).getTime() - 100;
			expect(shouldHeartbeat(state, mtimeMs, NOW)).toBe(false);
		},
	);

	test.failing(
		"ENG-5862: shouldHeartbeat returns false when mtimeMs is null (file deleted)",
		() => {
			// Race: fs.watch fired, but by the time the heartbeat tick reads
			// mtime the file has been deleted (claude session ended, log
			// rotated, etc.). Caller passes null; predicate must short-circuit
			// to false rather than throw on a null arithmetic op.
			const state = baseState({
				lastUploadedAt: new Date(NOW_MS - 90_000).toISOString(),
			});
			expect(shouldHeartbeat(state, null, NOW)).toBe(false);
		},
	);
});
