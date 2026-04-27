/**
 * Unit tests for `postToOutbox` and the outbox-channel resolver.
 *
 * Covers:
 *   - Default channel resolution (`#usegin` when env unset).
 *   - Env override via `USEGIN_OUTBOX_CHANNEL`.
 *   - Whitespace-only env value falls back to default.
 *   - postToOutbox routes through sendMessage with the resolved channel.
 *   - Per-call `--channel` option wins over env + default.
 *   - ENG-id link enrichment (D4 cross-surface) is applied by the
 *     underlying sendMessage.
 *
 * Part of: ENG-5408 / D4
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";

import { getOutboxChannel, postToOutbox } from "./post";
import type { SlackConfig } from "./config";
import type { SlackSendClient } from "./send";

const FAKE_CONFIG: SlackConfig = {
	botToken: "xoxb-test-fake-token",
};

interface PostMessageCall {
	channel: string;
	text: string;
	thread_ts?: string;
}

function makeFakeClient(): {
	client: SlackSendClient;
	postMessageCalls: PostMessageCall[];
} {
	const postMessageCalls: PostMessageCall[] = [];
	const client: SlackSendClient = {
		conversations: {
			list: async () => ({
				ok: true,
				channels: [
					{ id: "C-USEGIN", name: "usegin" },
					{ id: "C-OTHER", name: "other" },
					{ id: "C-CUSTOM", name: "custom-outbox" },
				],
			}),
		},
		chat: {
			postMessage: async (args) => {
				postMessageCalls.push({ ...args });
				return {
					ok: true,
					channel: args.channel,
					ts: "1700000000.000100",
					message: {
						text: args.text,
						ts: "1700000000.000100",
					},
				};
			},
		},
	};
	return { client, postMessageCalls };
}

describe("getOutboxChannel", () => {
	const ORIGINAL = process.env.USEGIN_OUTBOX_CHANNEL;
	afterEach(() => {
		if (ORIGINAL === undefined) {
			delete process.env.USEGIN_OUTBOX_CHANNEL;
		} else {
			process.env.USEGIN_OUTBOX_CHANNEL = ORIGINAL;
		}
	});

	test("defaults to #usegin when env unset", () => {
		expect(getOutboxChannel({})).toBe("#usegin");
	});

	test("uses USEGIN_OUTBOX_CHANNEL when set", () => {
		expect(getOutboxChannel({ USEGIN_OUTBOX_CHANNEL: "#gin-outbox" })).toBe(
			"#gin-outbox",
		);
	});

	test("falls back to default for whitespace-only value", () => {
		expect(getOutboxChannel({ USEGIN_OUTBOX_CHANNEL: "   " })).toBe(
			"#usegin",
		);
	});
});

describe("postToOutbox", () => {
	const ORIGINAL_OUTBOX = process.env.USEGIN_OUTBOX_CHANNEL;
	const ORIGINAL_LINEAR_URL = process.env.LINEAR_ORG_URL;

	beforeEach(() => {
		delete process.env.USEGIN_OUTBOX_CHANNEL;
		delete process.env.LINEAR_ORG_URL;
	});

	afterEach(() => {
		if (ORIGINAL_OUTBOX === undefined) {
			delete process.env.USEGIN_OUTBOX_CHANNEL;
		} else {
			process.env.USEGIN_OUTBOX_CHANNEL = ORIGINAL_OUTBOX;
		}
		if (ORIGINAL_LINEAR_URL === undefined) {
			delete process.env.LINEAR_ORG_URL;
		} else {
			process.env.LINEAR_ORG_URL = ORIGINAL_LINEAR_URL;
		}
	});

	test("routes to #usegin by default", async () => {
		const { client, postMessageCalls } = makeFakeClient();
		const result = await postToOutbox(client, "hello world", FAKE_CONFIG);
		expect(result.ok).toBe(true);
		expect(postMessageCalls.length).toBe(1);
		expect(postMessageCalls[0]?.channel).toBe("C-USEGIN");
	});

	test("env USEGIN_OUTBOX_CHANNEL overrides default", async () => {
		process.env.USEGIN_OUTBOX_CHANNEL = "#custom-outbox";
		const { client, postMessageCalls } = makeFakeClient();
		const result = await postToOutbox(client, "hi", FAKE_CONFIG);
		expect(result.ok).toBe(true);
		expect(postMessageCalls[0]?.channel).toBe("C-CUSTOM");
	});

	test("per-call channel option wins over env + default", async () => {
		process.env.USEGIN_OUTBOX_CHANNEL = "#custom-outbox";
		const { client, postMessageCalls } = makeFakeClient();
		const result = await postToOutbox(client, "hi", FAKE_CONFIG, {
			channel: "#other",
		});
		expect(result.ok).toBe(true);
		expect(postMessageCalls[0]?.channel).toBe("C-OTHER");
	});

	test("auto-links ENG-ids in the body via underlying sendMessage", async () => {
		const { client, postMessageCalls } = makeFakeClient();
		const result = await postToOutbox(
			client,
			"see ENG-1234 for the click",
			FAKE_CONFIG,
		);
		expect(result.ok).toBe(true);
		expect(postMessageCalls[0]?.text).toBe(
			"see <https://linear.app/askeffi/issue/ENG-1234|ENG-1234> for the click",
		);
	});

	test("threads via threadTs option", async () => {
		const { client, postMessageCalls } = makeFakeClient();
		const result = await postToOutbox(client, "reply", FAKE_CONFIG, {
			threadTs: "1700000000.000050",
		});
		expect(result.ok).toBe(true);
		expect(postMessageCalls[0]?.thread_ts).toBe("1700000000.000050");
	});
});
