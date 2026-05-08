/**
 * Detect session completion via `type:"result"` in JSONL content (AC 18).
 *
 * Claude Code emits a `{type:"result", ...}` line as the final entry of
 * a completed session. The daemon flips `dev_sessions.status` to
 * `completed` on the next sync after this is observed, then releases
 * the lock (slice 2).
 *
 * Malformed lines (non-JSON) are skipped — partial-write tolerance.
 */

export function isSessionComplete(jsonlContent: string): boolean {
	if (!jsonlContent) return false;
	for (const line of jsonlContent.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed = JSON.parse(trimmed) as { type?: unknown };
			if (parsed && parsed.type === "result") {
				return true;
			}
		} catch {
			// Skip malformed lines.
		}
	}
	return false;
}
