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
}

interface JsonlEntry {
	type?: string;
	gitBranch?: string;
	gitSha?: string;
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
	};
}
