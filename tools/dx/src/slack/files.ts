/**
 * Pure functions for `dx slack files upload`.
 *
 * Uses `@slack/web-api`'s high-level `client.files.uploadV2()` helper
 * (v6.11+) which wraps the three-step `files.getUploadURLExternal` →
 * PUT → `files.completeUploadExternal` v2 dance. The deprecated
 * `files.upload` is NOT used.
 *
 * Pure module takes a Buffer + filename so unit tests don't touch the
 * filesystem. The command layer reads the file via `node:fs` and hands
 * the buffer in.
 *
 * Needs `files:write` (NOT in current scopes; surfaces missing_scope).
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import {
	resolveChannel,
	type SlackResolverClient,
} from "./channel";

/** Slack's uploadV2 response is loosely typed; this is the subset we read. */
export interface SlackUploadV2Response {
	ok?: boolean;
	error?: string;
	files?: Array<{
		id?: string;
		name?: string;
		permalink?: string;
		url_private?: string;
	}>;
	/** Some versions wrap a single file in `file`. */
	file?: {
		id?: string;
		name?: string;
		permalink?: string;
		url_private?: string;
	};
}

export interface SlackFilesClient extends SlackResolverClient {
	files: {
		uploadV2(args: {
			channel_id?: string;
			file: Buffer | Uint8Array;
			filename: string;
			title?: string;
			initial_comment?: string;
		}): Promise<SlackUploadV2Response>;
	};
}

export interface UploadResult {
	ok: boolean;
	channel?: string;
	channelInput: string;
	fileId?: string;
	filename: string;
	permalink?: string;
	error?: string;
	tokenMask: string;
}

export interface UploadOptions {
	title?: string;
	initialComment?: string;
}

/** Upload bytes to a channel via files.uploadV2. */
export async function uploadFile(
	client: SlackFilesClient,
	channelInput: string,
	content: Buffer | Uint8Array,
	filename: string,
	config: SlackConfig,
	opts: UploadOptions = {},
): Promise<UploadResult> {
	const tokenMask = maskToken(config.botToken);

	if (!filename || !filename.trim()) {
		return {
			ok: false,
			channelInput,
			filename,
			error: "empty_filename",
			tokenMask,
		};
	}
	if (content.byteLength === 0) {
		return {
			ok: false,
			channelInput,
			filename,
			error: "empty_file",
			tokenMask,
		};
	}

	const channel = await resolveChannel(client, channelInput, config);

	const resp = await client.files.uploadV2({
		channel_id: channel,
		file: content,
		filename,
		title: opts.title,
		initial_comment: opts.initialComment,
	});

	const f = resp.file ?? resp.files?.[0];

	return {
		ok: resp.ok === true && Boolean(f?.id),
		channel,
		channelInput,
		fileId: f?.id,
		filename: f?.name ?? filename,
		permalink: f?.permalink ?? f?.url_private,
		error: resp.error,
		tokenMask,
	};
}

export function formatUploadHuman(r: UploadResult): string {
	if (!r.ok) {
		const lines = [
			`UseGin-Slack files upload FAILED — ${r.error ?? "unknown"}`,
			`  channel:  ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
			`  filename: ${r.filename}`,
			`  token:    ${r.tokenMask}`,
		];
		if (r.error === "missing_scope") {
			lines.push(
				`  hint:     bot needs files:write — see tools/dx/src/slack/README.md.`,
			);
		}
		return lines.join("\n");
	}
	return [
		`UseGin-Slack files upload OK`,
		`  channel:  ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
		`  file_id:  ${r.fileId ?? "?"}`,
		`  filename: ${r.filename}`,
		`  link:     ${r.permalink ?? "(no permalink)"}`,
	].join("\n");
}

export function formatUploadJson(r: UploadResult): string {
	return JSON.stringify(
		{
			ok: r.ok,
			channel: r.channel ?? null,
			channel_input: r.channelInput,
			file_id: r.fileId ?? null,
			filename: r.filename,
			permalink: r.permalink ?? null,
			error: r.error ?? null,
			token: r.tokenMask,
		},
		null,
		2,
	);
}
