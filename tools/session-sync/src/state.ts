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
		lastUploadedAt: z.string(),
		// Optional ISO timestamp; set when an upload returns 503 per AC 45,
		// cleared once the daemon has retried past it.
		nextRetryAt: z.string().optional(),
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
