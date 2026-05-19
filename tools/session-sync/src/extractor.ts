/**
 * Extract metadata from JSONL session content for the sync POST payload
 * (AC 14 metadata side; mirrors `SyncMetadata` in
 * `nextjs-app/lib/services/dev-sessions.ts`).
 *
 * Pure-text in / typed metadata out. The wire-shape conversion (filling
 * `project_path`, `username`, `environment_kind`, `environment_id`,
 * `file_size_bytes`, `gzipped_size_bytes`) is the daemon's job in
 * Step 3b — those fields don't live in the JSONL.
 */

import { isSessionComplete } from "./completion.ts";

const PREVIEW_LIMIT = 80;
const FIRST_USER_MESSAGE_LIMIT = 200;
const PREVIEW_COUNT = 3;

export interface ExtractedMetadata {
	turn_count: number;
	line_count: number;
	preview_first: string[] | null;
	preview_last: string[] | null;
	first_user_message: string | null;
	git_branch: string | null;
	git_sha: string | null;
	claude_model: string | null;
	status: "active" | "completed";
	/**
	 * ENG-6068 — ISO-8601 UTC timestamp of the EARLIEST JSONL line carrying
	 * a string `timestamp` field. Wires through to the server's
	 * `metadata.started_at` so the upsert pins `dev_sessions.started_at` and
	 * the `storage_path` date segment to the real session day instead of the
	 * row's `created_at` (upload day).
	 *
	 * Walks every line (some JSONLs lead with daemon-meta entries like
	 * `isSnapshotUpdate` and `file-history-snapshot` that have no
	 * `timestamp`), parses each, and returns the lexicographically smallest
	 * value seen (= chronologically earliest for fixed-format ISO-8601 UTC).
	 * Mirrors the canonical `extractFirstEventTimestamp` in
	 * `nextjs-app/lib/services/dev-sessions.ts` (search by name; line
	 * numbers drift). Production JSONLs from Claude Code emit
	 * `Z`-suffixed UTC timestamps verbatim — the lex compare on raw strings
	 * is correct for that shape. Mixed-suffix inputs (`Z` and offset
	 * suffixes in the same file) would compare chronologically wrong, but
	 * Claude Code does not emit those today.
	 *
	 * `Z`-suffixed strings pass through verbatim (preserves sub-millisecond
	 * precision); non-`Z` forms are re-emitted via `new Date(...).toISOString()`
	 * so the server's UTC-date derivation never sees a tz-offset surprise.
	 *
	 * `null` when no parseable string timestamp is found (very-early sessions,
	 * daemon-meta-only files, numeric-epoch timestamps, malformed inputs).
	 * The `sync-flow` composition layer OMITS `metadata.started_at` from the
	 * POST body when this is `null` — daemon-side mirror of the server's
	 * `if (m.started_at != null)` validator branch.
	 */
	started_at: string | null;
}

interface JsonlEntry {
	type?: string;
	gitBranch?: string;
	gitSha?: string;
	timestamp?: unknown;
	message?: {
		role?: string;
		model?: string;
		content?: unknown;
	};
}

function flattenContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const item of content) {
		if (typeof item === "string") {
			parts.push(item);
		} else if (
			item &&
			typeof item === "object" &&
			(item as { type?: unknown }).type === "text"
		) {
			const text = (item as { text?: unknown }).text;
			if (typeof text === "string") parts.push(text);
		}
	}
	return parts.join("\n").trim();
}

function truncate(text: string, limit: number): string {
	return text.length > limit ? text.slice(0, limit) : text;
}

export function extractMetadata(jsonlContent: string): ExtractedMetadata {
	const lines = jsonlContent ? jsonlContent.split("\n") : [];
	let turn_count = 0;
	let line_count = 0;
	const userMessages: string[] = [];
	let first_user_message: string | null = null;
	let git_branch: string | null = null;
	let git_sha: string | null = null;
	let claude_model: string | null = null;
	// ENG-6068 — earliest JSONL event timestamp. Mirrors
	// `extractFirstEventTimestamp` in
	// `nextjs-app/lib/services/dev-sessions.ts` (search by name; line
	// numbers drift): walk every line, collect every string `timestamp`
	// that parses as a Date, return the lexicographically smallest
	// (= chronologically earliest for fixed-format ISO-8601 UTC). Must
	// walk past daemon-meta lines (`isSnapshotUpdate`,
	// `file-history-snapshot`) that lead some JSONLs, AND must compare
	// rather than take-first since events are not always in order.
	let earliest_timestamp: string | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		line_count += 1;

		let entry: JsonlEntry;
		try {
			entry = JSON.parse(trimmed) as JsonlEntry;
		} catch {
			continue;
		}

		if (entry.type === "user" || entry.type === "assistant") {
			turn_count += 1;
		}
		if (!git_branch && typeof entry.gitBranch === "string") {
			git_branch = entry.gitBranch;
		}
		if (!git_sha && typeof entry.gitSha === "string") {
			git_sha = entry.gitSha;
		}

		// ENG-6068 — only accept string timestamps that `Date.parse` finds
		// finite. Guards against numeric-epoch timestamps and malformed
		// strings that would otherwise leak into the POST payload and
		// trip the server's `^\d{4}-\d{2}-\d{2}` + `Date.parse` validator
		// in `validateSyncMetadata` (`nextjs-app/lib/services/dev-sessions.ts`).
		const ts = entry.timestamp;
		if (typeof ts === "string" && ts.length > 0) {
			const parsed = Date.parse(ts);
			if (Number.isFinite(parsed)) {
				if (earliest_timestamp === null || ts < earliest_timestamp) {
					earliest_timestamp = ts;
				}
			}
		}

		const msg = entry.message;
		if (msg && msg.role === "user") {
			const text = flattenContent(msg.content);
			if (text) {
				userMessages.push(text);
				if (first_user_message === null) {
					first_user_message = truncate(text, FIRST_USER_MESSAGE_LIMIT);
				}
			}
		}
		if (
			msg &&
			msg.role === "assistant" &&
			!claude_model &&
			typeof msg.model === "string"
		) {
			claude_model = msg.model;
		}
	}

	// Normalize the output to ISO-8601 UTC `Z`-suffixed form. JSONLs already
	// emitted that way (the daemon's actual production shape) pass through
	// verbatim — preserves sub-millisecond precision the spec mentions.
	// Anything that parsed via `Date.parse` but wasn't `Z`-suffixed gets
	// re-emitted via `toISOString()` so the server's downstream
	// `new Date(...).toISOString().slice(0, 10)` UTC-date derivation sees
	// a known shape.
	let started_at: string | null = null;
	if (earliest_timestamp !== null) {
		if (earliest_timestamp.endsWith("Z")) {
			started_at = earliest_timestamp;
		} else {
			started_at = new Date(earliest_timestamp).toISOString();
		}
	}

	const preview_first =
		userMessages.length > 0
			? userMessages
					.slice(0, PREVIEW_COUNT)
					.map((t) => truncate(t, PREVIEW_LIMIT))
			: null;
	const preview_last =
		userMessages.length > 0
			? userMessages
					.slice(-PREVIEW_COUNT)
					.map((t) => truncate(t, PREVIEW_LIMIT))
			: null;

	return {
		turn_count,
		line_count,
		preview_first,
		preview_last,
		first_user_message,
		git_branch,
		git_sha,
		claude_model,
		status: isSessionComplete(jsonlContent) ? "completed" : "active",
		started_at,
	};
}
