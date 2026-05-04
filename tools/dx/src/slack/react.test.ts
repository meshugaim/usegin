/**
 * Unit tests for `dx slack react`.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	addReaction,
	formatReactHuman,
	formatReactJson,
	normalizeEmoji,
	type SlackReactClient,
} from "./react";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

interface AddCall {
	channel: string;
	timestamp: string;
	name: string;
}

function fakeClient(opts: {
	channelsByName?: Record<string, string>;
	addResult?: { ok?: boolean; error?: string };
	addCalls?: AddCall[];
}): SlackReactClient {
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
		reactions: {
			async add(args) {
				opts.addCalls?.push({
					channel: args.channel,
					timestamp: args.timestamp,
					name: args.name,
				});
				return opts.addResult ?? { ok: true };
			},
		},
	};
}

describe("normalizeEmoji", () => {
	it("strips wrapping colons", () => {
		expect(normalizeEmoji(":tada:")).toBe("tada");
		expect(normalizeEmoji("tada")).toBe("tada");
		expect(normalizeEmoji(":tada")).toBe("tada");
	});
});

describe("addReaction", () => {
	it("posts a reaction on a resolved channel", async () => {
		const calls: AddCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls: calls,
		});
		const r = await addReaction(
			client,
			"#dev",
			"1700000000.000100",
			":tada:",
			config,
		);
		expect(r.ok).toBe(true);
		expect(r.emoji).toBe("tada");
		expect(calls[0]).toEqual({
			channel: "C_DEV",
			timestamp: "1700000000.000100",
			name: "tada",
		});
	});

	it("rejects empty emoji without an API call", async () => {
		const calls: AddCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls: calls,
		});
		const r = await addReaction(client, "#dev", "1700.0", "::", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_emoji");
		expect(calls.length).toBe(0);
	});

	it("rejects empty ts without an API call", async () => {
		const calls: AddCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addCalls: calls,
		});
		const r = await addReaction(client, "#dev", "  ", ":x:", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_ts");
		expect(calls.length).toBe(0);
	});

	it("surfaces already_reacted with hint in human output", async () => {
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			addResult: { ok: false, error: "already_reacted" },
		});
		const r = await addReaction(client, "#dev", "1700.0", ":x:", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("already_reacted");
		expect(formatReactHuman(r)).toContain("already reacted");
	});
});

describe("formatReactJson", () => {
	it("renders snake_case JSON", () => {
		const j = JSON.parse(
			formatReactJson({
				ok: true,
				channel: "C_DEV",
				channelInput: "#dev",
				ts: "1700.0",
				emoji: "tada",
				tokenMask: "xoxb…CdEf",
			}),
		);
		expect(j.channel_input).toBe("#dev");
		expect(j.emoji).toBe("tada");
	});
});
