/**
 * Per-file sync state for the session-sync daemon (AC 16).
 *
 * Persisted at `~/.local/state/session-sync/state.json` as
 * `{ [absoluteJsonlPath]: PerFileState }`.
 *
 * Atomic writes: tmp file + rename so a partial write doesn't corrupt
 * readers. Malformed JSON throws — silently overwriting state would
 * mean we sync everything from scratch and lose `nextRetryAt` backoff
 * markers without warning. Lost state is safe (server upserts on
 * `session_id`); silently-truncated state is not.
 */

import { existsSync, renameSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export const PerFileStateSchema = z
	.object({
		contentHash: z.string(),
		lastUploadedSize: z.number(),
		sessionId: z.string(),
		storagePath: z.string(),
		// `""` (empty string) is the sentinel for "never uploaded" — emitted
		// by the sync-flow when a kill_switch outcome creates a fresh state
		// entry with no prior upload. Consumers reading this field for time
		// math must guard against empty-string before parsing as a date.
		lastUploadedAt: z.string(),
		// Optional ISO timestamp; set when an upload returns 503 per AC 45
		// OR when sync/heartbeat returns 409 lock_held per AC 15. One field,
		// two triggers — `isInBackoff` and the safety-net "retry-due" branch
		// both fire on either marker, no special-casing needed downstream.
		nextRetryAt: z.string().optional(),
		// Optional ISO timestamp; set by the heartbeat loop (AC 40, 41) on
		// each successful 200 response, mirroring what `lastUploadedAt`
		// does for the sync path. `shouldHeartbeat` reads
		// `max(lastUploadedAt, lastHeartbeatAt ?? epoch)` to decide whether
		// the lease has already been refreshed inside the 60s window.
		//
		// Declared optional so daemons whose state.json predates step 5
		// keep parsing on next boot — Zod's `.strict()` would otherwise
		// reject the legacy shape.
		lastHeartbeatAt: z.string().optional(),
		// Optional ISO timestamp; set when the daemon successfully releases
		// the dev-session lock after a completion-sync (AC 18 ext, step 6).
		// Once set, `shouldHeartbeat` short-circuits to false so the
		// heartbeat loop stops pinging a session whose lock is already gone
		// server-side.
		//
		// Without this guard, the heartbeat would land on a released-lock
		// endpoint, the server's `refresh_dev_session_lock` (UPDATE-only —
		// migration 20260512150635) would return 0 rows, the heartbeat
		// endpoint would surface a 409 with all-null holder fields, and the
		// daemon's existing null-holder handler would set
		// `nextRetryAt = now + LOCK_BACKOFF_NULL_EXPIRES_FALLBACK_MS = 60s`
		// and re-attempt every minute for the lifetime of the daemon.
		//
		// State-file persistence (not just in-memory) means the next-boot
		// safety-net scan also skips released sessions — a daemon restart
		// doesn't re-process a finished one.
		//
		// Declared optional so state.json files predating this commit
		// parse cleanly on next boot under Zod's `.strict()`.
		releasedAt: z.string().optional(),
	})
	.strict();

export const StateFileSchema = z.record(z.string(), PerFileStateSchema);

export type PerFileState = z.infer<typeof PerFileStateSchema>;
export type StateFile = z.infer<typeof StateFileSchema>;

export async function readState(path: string): Promise<StateFile> {
	if (!existsSync(path)) {
		return {};
	}
	const raw = await readFile(path, "utf8");
	const parsed = JSON.parse(raw) as unknown;
	return StateFileSchema.parse(parsed);
}

export async function writeState(
	path: string,
	state: StateFile,
): Promise<void> {
	StateFileSchema.parse(state); // fail-loud on bad input
	const tmpPath = join(
		dirname(path),
		`.${Date.now()}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`,
	);
	try {
		await writeFile(tmpPath, JSON.stringify(state, null, 2), {
			encoding: "utf8",
			mode: 0o600,
		});
		renameSync(tmpPath, path);
	} catch (err) {
		// Best-effort cleanup of the tmp on failure.
		try {
			await unlink(tmpPath);
		} catch {
			// ignore
		}
		throw err;
	}
}
