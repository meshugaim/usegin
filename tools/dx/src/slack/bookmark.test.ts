/**
 * Unit tests for `dx slack channel bookmark add`.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	addBookmark,
	formatBookmarkHuman,
	formatBookmarkJson,
	type SlackBookmarkClient,
} from "./bookmark";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

function fakeClient(opts: {
	channelsByName?: Record<string, string>;
	addResult?: {
		ok?: boolean;
		error?: string;
		bookmark?: { id?: string; title?: string; link?: string };
	};
	addCalls?: Array<{
		channel_id: string;
		title: string;
		link: string;
		emoji?: string;
	}>;
}): SlackBookmarkClient {
	return {
		conversations: {
			async list() {
				return {
					ok: true,
					channels: Object.entries(opts.channelsByName ?? {}).map(
						([name, id]) => ({ id, name }),
					),
					response_metadata: {},
				};
			},
		},
		bookmarks: {
			async add(args) {
				opts.addCalls?.push({
					channel_id: args.channel_id,
					title: args.title,
					link: args.link,
					emoji: args.emoji,
				});
				return (
					opts.addResult ?? {
						ok: true,
						bookmark: {
							id: "B_NEW",
							title: args.title,
							link: args.link,
						},
					}
				);
			},
		},
	};
}

describe("addBookmark", () => {
	it("adds a bookmark to a resolved channel", async () => {
		const addCalls: Array<{
			channel_id: string;
			title: string;
			link: string;
		}> = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls,
		});
		const r = await addBookmark(
			client,
			"#dev",
			"https://linear.app/askeffi/issue/ENG-5760",
			"ENG-5760",
			config,
		);
		expect(r.ok).toBe(true);
		expect(r.bookmarkId).toBe("B_NEW");
		expect(addCalls[0]?.channel_id).toBe("C_DEV");
		expect(addCalls[0]?.title).toBe("ENG-5760");
	});

	it("passes emoji through when provided", async () => {
		const addCalls: Array<{
			channel_id: string;
			title: string;
			link: string;
			emoji?: string;
		}> = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls,
		});
		await addBookmark(client, "#dev", "https://x", "X", config, {
			emoji: ":pin:",
		});
		expect(addCalls[0]?.emoji).toBe(":pin:");
	});

	it("rejects empty link without an API call", async () => {
		const addCalls: Array<{ channel_id: string; title: string; link: string }> = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls,
		});
		const r = await addBookmark(client, "#dev", "  ", "T", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_link");
		expect(addCalls.length).toBe(0);
	});

	it("rejects empty title without an API call", async () => {
		const addCalls: Array<{ channel_id: string; title: string; link: string }> = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls,
		});
		const r = await addBookmark(client, "#dev", "https://x", "", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_title");
		expect(addCalls.length).toBe(0);
	});

	it("surfaces missing_scope when bookmarks:write isn't granted", async () => {
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addResult: { ok: false, error: "missing_scope" },
		});
		const r = await addBookmark(client, "#dev", "https://x", "X", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("missing_scope");
	});
});

describe("formatBookmarkHuman", () => {
	it("renders OK with id, title, link", () => {
		const out = formatBookmarkHuman({
			ok: true,
			channel: "C_DEV",
			channelInput: "#dev",
			bookmarkId: "B_NEW",
			title: "ENG-5760",
			link: "https://linear.app/...",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("OK");
		expect(out).toContain("ENG-5760");
		expect(out).toContain("B_NEW");
	});

	it("includes hint on missing_scope", () => {
		const out = formatBookmarkHuman({
			ok: false,
			channelInput: "#dev",
			title: "x",
			link: "https://x",
			error: "missing_scope",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("bookmarks:write");
	});
});

describe("formatBookmarkJson", () => {
	it("renders JSON with snake_case", () => {
		const j = JSON.parse(
			formatBookmarkJson({
				ok: true,
				channel: "C_DEV",
				channelInput: "#dev",
				bookmarkId: "B_NEW",
				title: "x",
				link: "https://x",
				tokenMask: "xoxb…CdEf",
			}),
		);
		expect(j.bookmark_id).toBe("B_NEW");
		expect(j.channel_input).toBe("#dev");
	});
});
