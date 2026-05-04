/**
 * Pure functions for `dx slack react <channel> <ts> <emoji>`.
 *
 * Adds a reaction to a message via `reactions.add`. Already in scope
 * (`reactions:write`), so this is the lowest-friction admin verb.
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import {
	resolveChannel,
	type SlackResolverClient,
} from "./channel";

export interface SlackReactClient extends SlackResolverClient {
	reactions: {
		add(args: {
			channel: string;
			timestamp: string;
			name: string;
		}): Promise<{ ok?: boolean; error?: string }>;
	};
}

export interface ReactResult {
	ok: boolean;
	channel?: string;
	channelInput: string;
	ts: string;
	emoji: string;
	error?: string;
	tokenMask: string;
}

/** Strip wrapping colons so callers can pass `:tada:` or `tada`. */
export function normalizeEmoji(name: string): string {
	const t = name.trim().replace(/^:|:$/g, "");
	return t;
}

export async function addReaction(
	client: SlackReactClient,
	channelInput: string,
	ts: string,
	emoji: string,
	config: SlackConfig,
): Promise<ReactResult> {
	const tokenMask = maskToken(config.botToken);
	const name = normalizeEmoji(emoji);
	if (!name) {
		return {
			ok: false,
			channelInput,
			ts,
			emoji,
			error: "empty_emoji",
			tokenMask,
		};
	}
	if (!ts.trim()) {
		return {
			ok: false,
			channelInput,
			ts,
			emoji,
			error: "empty_ts",
			tokenMask,
		};
	}

	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.reactions.add({ channel, timestamp: ts, name });

	return {
		ok: resp.ok === true,
		channel,
		channelInput,
		ts,
		emoji: name,
		error: resp.error,
		tokenMask,
	};
}

export function formatReactHuman(r: ReactResult): string {
	if (!r.ok) {
		const lines = [
			`UseGin-Slack react FAILED — ${r.error ?? "unknown"}`,
			`  channel: ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
			`  ts:      ${r.ts}`,
			`  emoji:   :${r.emoji}:`,
			`  token:   ${r.tokenMask}`,
		];
		if (r.error === "already_reacted") {
			lines.push(`  hint:    bot already reacted with this emoji.`);
		}
		return lines.join("\n");
	}
	return [
		`UseGin-Slack react OK`,
		`  channel: ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
		`  ts:      ${r.ts}`,
		`  emoji:   :${r.emoji}:`,
	].join("\n");
}

export function formatReactJson(r: ReactResult): string {
	return JSON.stringify(
		{
			ok: r.ok,
			channel: r.channel ?? null,
			channel_input: r.channelInput,
			ts: r.ts,
			emoji: r.emoji,
			error: r.error ?? null,
			token: r.tokenMask,
		},
		null,
		2,
	);
}
