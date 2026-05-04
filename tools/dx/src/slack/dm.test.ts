/**
 * Unit tests for `dx slack dm`.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
	formatDmHuman,
	formatDmJson,
	sendDm,
	type SlackDmClient,
} from "./dm";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

interface OpenCall {
	users: string;
}
interface PostCall {
	channel: string;
	text: string;
}

function fakeClient(opts: {
	emailMap?: Record<string, string>;
	openResult?: {
		ok?: boolean;
		error?: string;
		channel?: { id?: string };
	};
	postResult?: {
		ok?: boolean;
		error?: string;
		ts?: string;
		channel?: string;
		message?: { text?: string; ts?: string };
	};
	openCalls?: OpenCall[];
	postCalls?: PostCall[];
}): SlackDmClient {
	return {
		users: {
			async lookupByEmail({ email }) {
				const id = opts.emailMap?.[email];
				if (id) return { ok: true, user: { id } };
				return { ok: false, error: "users_not_found" };
			},
			async list() {
				return { ok: true, members: [] };
			},
			async info() {
				return { ok: false, error: "user_not_found" };
			},
		},
		conversations: {
			async open(args) {
				opts.openCalls?.push({ users: args.users });
				return (
					opts.openResult ?? {
						ok: true,
						channel: { id: "D_DM" },
					}
				);
			},
		},
		chat: {
			async postMessage(args) {
				opts.postCalls?.push({ channel: args.channel, text: args.text });
				return (
					opts.postResult ?? {
						ok: true,
						channel: args.channel,
						ts: "1700000000.000100",
						message: { text: args.text, ts: "1700000000.000100" },
					}
				);
			},
		},
	};
}

describe("sendDm", () => {
	const ORIGINAL_LINEAR_URL = process.env.LINEAR_ORG_URL;
	beforeEach(() => {
		delete process.env.LINEAR_ORG_URL;
	});
	afterEach(() => {
		if (ORIGINAL_LINEAR_URL === undefined) {
			delete process.env.LINEAR_ORG_URL;
		} else {
			process.env.LINEAR_ORG_URL = ORIGINAL_LINEAR_URL;
		}
	});

	it("resolves email, opens DM, posts message", async () => {
		const openCalls: OpenCall[] = [];
		const postCalls: PostCall[] = [];
		const client = fakeClient({
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
			openCalls,
			postCalls,
		});
		const r = await sendDm(client, "lihu@askeffi.ai", "hi", config);
		expect(r.ok).toBe(true);
		expect(r.userId).toBe("U_LIHU");
		expect(r.channel).toBe("D_DM");
		expect(openCalls).toEqual([{ users: "U_LIHU" }]);
		expect(postCalls[0]?.channel).toBe("D_DM");
	});

	it("passes raw Uxxx ids straight to conversations.open", async () => {
		const openCalls: OpenCall[] = [];
		const client = fakeClient({ openCalls });
		const r = await sendDm(client, "U01LIHU0001", "ping", config);
		expect(r.ok).toBe(true);
		expect(openCalls[0]?.users).toBe("U01LIHU0001");
	});

	it("rejects empty messages without API calls", async () => {
		const openCalls: OpenCall[] = [];
		const postCalls: PostCall[] = [];
		const client = fakeClient({ openCalls, postCalls });
		const r = await sendDm(client, "U01LIHU0001", "  ", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_message");
		expect(openCalls.length).toBe(0);
		expect(postCalls.length).toBe(0);
	});

	it("surfaces conversations.open failure", async () => {
		const client = fakeClient({
			openResult: { ok: false, error: "missing_scope" },
		});
		const r = await sendDm(client, "U01LIHU0001", "x", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("missing_scope");
	});

	it("surfaces chat.postMessage failure", async () => {
		const client = fakeClient({
			postResult: { ok: false, error: "channel_not_found" },
		});
		const r = await sendDm(client, "U01LIHU0001", "x", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("channel_not_found");
	});

	it("auto-links ENG-ids by default", async () => {
		const postCalls: PostCall[] = [];
		const client = fakeClient({ postCalls });
		await sendDm(client, "U01LIHU0001", "see ENG-1234", config);
		expect(postCalls[0]?.text).toContain("linear.app");
	});

	it("preserves raw text when enrichLinks=false", async () => {
		const postCalls: PostCall[] = [];
		const client = fakeClient({ postCalls });
		await sendDm(client, "U01LIHU0001", "see ENG-1234", config, {
			enrichLinks: false,
		});
		expect(postCalls[0]?.text).toBe("see ENG-1234");
	});
});

describe("formatDmHuman", () => {
	it("renders OK with channel + ts", () => {
		const out = formatDmHuman({
			ok: true,
			userInput: "lihu@askeffi.ai",
			userId: "U_LIHU",
			channel: "D_DM",
			ts: "1700000000.000100",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("OK");
		expect(out).toContain("U_LIHU");
		expect(out).toContain("D_DM");
	});

	it("hints on missing_scope failure", () => {
		const out = formatDmHuman({
			ok: false,
			userInput: "lihu",
			error: "missing_scope",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("im:write");
	});
});

describe("formatDmJson", () => {
	it("renders snake_case JSON", () => {
		const j = JSON.parse(
			formatDmJson({
				ok: true,
				userInput: "lihu",
				userId: "U_LIHU",
				channel: "D_DM",
				ts: "1700000000.000100",
				tokenMask: "xoxb…CdEf",
			}),
		);
		expect(j.user_input).toBe("lihu");
		expect(j.user_id).toBe("U_LIHU");
	});
});
