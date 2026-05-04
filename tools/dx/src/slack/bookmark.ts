/**
 * Pure functions for `dx slack channel bookmark add`.
 *
 * Slack's `bookmarks.add` adds a "link" bookmark to a channel header.
 * Used by Zisser to pin durable links — Brown relays, Linear sub-issues,
 * synthesis docs — somewhere always-visible without tagging anyone.
 *
 * Needs `bookmarks:write` (NOT in current scope; surfaces missing_scope).
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import {
	resolveChannel,
	type SlackResolverClient,
} from "./channel";

export interface SlackBookmarkClient extends SlackResolverClient {
	bookmarks: {
		add(args: {
			channel_id: string;
			title: string;
			type: "link";
			link: string;
			emoji?: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			bookmark?: { id?: string; title?: string; link?: string };
		}>;
	};
}

export interface BookmarkResult {
	ok: boolean;
	channel?: string;
	channelInput: string;
	bookmarkId?: string;
	title: string;
	link: string;
	error?: string;
	tokenMask: string;
}

export interface BookmarkOptions {
	emoji?: string;
}

export async function addBookmark(
	client: SlackBookmarkClient,
	channelInput: string,
	link: string,
	title: string,
	config: SlackConfig,
	opts: BookmarkOptions = {},
): Promise<BookmarkResult> {
	const tokenMask = maskToken(config.botToken);
	if (!link.trim()) {
		return {
			ok: false,
			channelInput,
			title,
			link,
			error: "empty_link",
			tokenMask,
		};
	}
	if (!title.trim()) {
		return {
			ok: false,
			channelInput,
			title,
			link,
			error: "empty_title",
			tokenMask,
		};
	}

	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.bookmarks.add({
		channel_id: channel,
		title,
		type: "link",
		link,
		emoji: opts.emoji,
	});

	return {
		ok: resp.ok === true,
		channel,
		channelInput,
		bookmarkId: resp.bookmark?.id,
		title: resp.bookmark?.title ?? title,
		link: resp.bookmark?.link ?? link,
		error: resp.error,
		tokenMask,
	};
}

export function formatBookmarkHuman(r: BookmarkResult): string {
	if (!r.ok) {
		const lines = [
			`UseGin-Slack bookmark FAILED — ${r.error ?? "unknown"}`,
			`  channel: ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
			`  title:   ${r.title}`,
			`  link:    ${r.link}`,
			`  token:   ${r.tokenMask}`,
		];
		if (r.error === "missing_scope") {
			lines.push(
				`  hint:    bot needs bookmarks:write — see tools/dx/src/slack/README.md.`,
			);
		}
		return lines.join("\n");
	}
	return [
		`UseGin-Slack bookmark OK`,
		`  channel: ${r.channelInput}${r.channel ? ` (${r.channel})` : ""}`,
		`  id:      ${r.bookmarkId ?? "?"}`,
		`  title:   ${r.title}`,
		`  link:    ${r.link}`,
	].join("\n");
}

export function formatBookmarkJson(r: BookmarkResult): string {
	return JSON.stringify(
		{
			ok: r.ok,
			channel: r.channel ?? null,
			channel_input: r.channelInput,
			bookmark_id: r.bookmarkId ?? null,
			title: r.title,
			link: r.link,
			error: r.error ?? null,
			token: r.tokenMask,
		},
		null,
		2,
	);
}
