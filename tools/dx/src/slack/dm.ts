/**
 * Pure functions for `dx slack dm <user> <message>`.
 *
 * Sugar over `conversations.open` + `chat.postMessage`. Resolves the user
 * by id/handle/email, opens a DM channel, posts there.
 *
 * Needs `im:write` + `chat:write` (im:write NOT in current scopes; surfaces
 * missing_scope verbatim).
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import { resolveUser, type SlackUserClient } from "./user";
import { autoLinkEngIdsFromEnv } from "./links";

export interface SlackDmClient extends SlackUserClient {
	conversations: {
		open(args: {
			users: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			channel?: { id?: string };
		}>;
	};
	chat: {
		postMessage(args: {
			channel: string;
			text: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			ts?: string;
			channel?: string;
			message?: { text?: string; ts?: string };
		}>;
	};
}

export interface DmResult {
	ok: boolean;
	userInput: string;
	userId?: string;
	channel?: string;
	ts?: string;
	text?: string;
	error?: string;
	tokenMask: string;
}

export interface DmOptions {
	enrichLinks?: boolean;
}

export async function sendDm(
	client: SlackDmClient,
	userInput: string,
	text: string,
	config: SlackConfig,
	opts: DmOptions = {},
): Promise<DmResult> {
	const tokenMask = maskToken(config.botToken);

	if (!text || text.trim().length === 0) {
		return {
			ok: false,
			userInput,
			error: "empty_message",
			tokenMask,
		};
	}

	const userId = await resolveUser(client, userInput, config);

	const open = await client.conversations.open({ users: userId });
	if (!open.ok || !open.channel?.id) {
		return {
			ok: false,
			userInput,
			userId,
			error: open.error ?? "conversations_open_failed",
			tokenMask,
		};
	}
	const channel = open.channel.id;

	const enriched =
		opts.enrichLinks === false ? text : autoLinkEngIdsFromEnv(text);
	const post = await client.chat.postMessage({
		channel,
		text: enriched,
	});

	return {
		ok: post.ok === true,
		userInput,
		userId,
		channel: post.channel ?? channel,
		ts: post.ts ?? post.message?.ts,
		text: post.message?.text ?? enriched,
		error: post.error,
		tokenMask,
	};
}

export function formatDmHuman(r: DmResult): string {
	if (!r.ok) {
		const lines = [
			`UseGin-Slack DM FAILED — ${r.error ?? "unknown"}`,
			`  user:    ${r.userInput}${r.userId ? ` (${r.userId})` : ""}`,
			`  token:   ${r.tokenMask}`,
		];
		if (r.error === "missing_scope") {
			lines.push(
				`  hint:    bot needs im:write — see tools/dx/src/slack/README.md.`,
			);
		}
		return lines.join("\n");
	}
	return [
		`UseGin-Slack DM OK`,
		`  user:    ${r.userInput} (${r.userId ?? "?"})`,
		`  channel: ${r.channel ?? "?"}`,
		`  ts:      ${r.ts ?? "?"}`,
	].join("\n");
}

export function formatDmJson(r: DmResult): string {
	return JSON.stringify(
		{
			ok: r.ok,
			user_input: r.userInput,
			user_id: r.userId ?? null,
			channel: r.channel ?? null,
			ts: r.ts ?? null,
			text: r.text ?? null,
			error: r.error ?? null,
			token: r.tokenMask,
		},
		null,
		2,
	);
}
