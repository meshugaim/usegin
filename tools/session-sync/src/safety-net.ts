/**
 * 5-minute safety-net tick (AC 13, AC 45).
 *
 * fs.watch on Linux can miss events under load and `nextRetryAt` markers
 * need to be cleared as their wall-clock deadline passes. The safety net
 * runs on a fixed interval (default 5 min) and re-emits sessions that
 * fall into either bucket. Emission order: each path produces at most
 * one item; `retry-due` takes precedence over `stale-since-last-tick`
 * (since the retry path is what *actually* unsticks a session in
 * backoff, and we don't want to emit the same path twice).
 *
 * Pure: file system access is dependency-injected via `fileSizeFn`.
 *
 * `lastUploadedAt = ""` sentinel handling: never parsed as a Date —
 * we look at `lastUploadedSize` and `nextRetryAt` only.
 */

import type { StateFile } from "./state.ts";

export type SafetyReason = "retry-due" | "stale-since-last-tick";

export interface SafetyItem {
	path: string;
	sessionId: string;
	reason: SafetyReason;
}

export interface SafetyNetInput {
	state: StateFile;
	/** Paths actively under fs.watch — only these are eligible. */
	watchedPaths: string[];
	fileSizeFn: (path: string) => Promise<number>;
	now: Date;
	/** Reserved for future "stale since X" comparisons; not currently consumed. */
	lastTickAt?: Date;
}

export async function safetyNetTick(
	input: SafetyNetInput,
): Promise<SafetyItem[]> {
	const { state, watchedPaths, fileSizeFn, now } = input;
	const out: SafetyItem[] = [];
	const nowMs = now.getTime();

	for (const path of watchedPaths) {
		const prior = state[path];
		if (!prior) continue;

		// retry-due first (precedence over stale).
		if (prior.nextRetryAt) {
			const retryAtMs = new Date(prior.nextRetryAt).getTime();
			if (retryAtMs <= nowMs) {
				out.push({ path, sessionId: prior.sessionId, reason: "retry-due" });
				continue;
			}
			// Future retry deadline: skip this path entirely until it passes.
			continue;
		}

		// stale-since-last-tick: file grew but no fs.watch event fired.
		const size = await fileSizeFn(path);
		if (size > prior.lastUploadedSize) {
			out.push({
				path,
				sessionId: prior.sessionId,
				reason: "stale-since-last-tick",
			});
		}
	}

	return out;
}
