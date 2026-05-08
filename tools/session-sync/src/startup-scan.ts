/**
 * Startup scan to catch sessions that grew, are new, or have an
 * expired retry deadline while the daemon was offline (AC 13, AC 45).
 *
 * Pure: file system access goes through `listFiles` + `fileSizeFn`
 * injectable functions. The walker is the caller's choice; the rule
 * here just classifies each candidate file against current state +
 * size on disk.
 *
 * Subagent files (`agent-*.jsonl`) are deliberately excluded — they
 * sync via their parent's `sync-session.ts` flow once the parent
 * advances. The scan only emits the parent JSONLs (UUID basename).
 *
 * `lastUploadedAt = ""` sentinel: never parsed as a Date. Staleness
 * decisions use `lastUploadedSize` and `nextRetryAt` only.
 */

import { basename } from "node:path";
import type { StateFile } from "./state.ts";

const PARENT_JSONL_REGEX =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

export type ScanReason = "new" | "grew" | "retry-due";

export interface ScanItem {
	path: string;
	sessionId: string;
	reason: ScanReason;
}

export interface StartupScanInput {
	projectsDir: string;
	/** Returns absolute file paths of every JSONL beneath `projectsDir`. */
	listFiles: (dir: string) => Promise<string[]>;
	fileSizeFn: (path: string) => Promise<number>;
	state: StateFile;
	now: Date;
}

function parseParentSessionId(filePath: string): string | null {
	const m = PARENT_JSONL_REGEX.exec(basename(filePath));
	return m ? (m[1] ?? null) : null;
}

export async function startupScan(
	input: StartupScanInput,
): Promise<ScanItem[]> {
	const { projectsDir, listFiles, fileSizeFn, state, now } = input;
	const files = await listFiles(projectsDir);
	const out: ScanItem[] = [];
	const nowMs = now.getTime();

	for (const path of files) {
		const sessionId = parseParentSessionId(path);
		if (!sessionId) continue;

		const prior = state[path];
		const size = await fileSizeFn(path);

		if (!prior) {
			// Brand-new file — but skip if it's empty (no-op).
			if (size > 0) {
				out.push({ path, sessionId, reason: "new" });
			}
			continue;
		}

		// retry-due wins over size comparisons: a kill-switch state row
		// may have lastUploadedSize=0 with a future-dated nextRetryAt
		// that's now expired; we want to retry it.
		if (prior.nextRetryAt) {
			const retryAtMs = new Date(prior.nextRetryAt).getTime();
			if (retryAtMs <= nowMs) {
				out.push({ path, sessionId, reason: "retry-due" });
				continue;
			}
			// Future retry: skip even if file grew (we'll catch it after deadline).
			continue;
		}

		// No retry pending — has the file grown since the last successful
		// upload? Note we use `lastUploadedSize`, NOT a parsed
		// `lastUploadedAt` (which can be the `""` sentinel for kill-switch
		// rows that never uploaded).
		if (size > prior.lastUploadedSize) {
			out.push({ path, sessionId, reason: "grew" });
		}
		// Equal size, no retry, no growth → skip.
	}

	return out;
}
