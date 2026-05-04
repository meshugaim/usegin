/**
 * Unit tests for `dx slack smoke`.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	formatSmokeHuman,
	formatSmokeJson,
	getSmokeChannel,
	runSmoke,
	type SlackSmokeClient,
} from "./smoke";
import { EXPECTED_REAL_TEAM_ID } from "./registry";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

interface FakeOpts {
	authResult?: {
		ok?: boolean;
		error?: string;
		team?: string;
		team_id?: string;
		user?: string;
		user_id?: string;
	};
	channels?: Array<{ id: string; name: string }>;
	channelMembers?: Record<string, string[]>;
	postResult?: { ok?: boolean; error?: string; ts?: string };
	historyMessages?: string[];
	emailMap?: Record<string, string>;
}

function makeClient(opts: FakeOpts): SlackSmokeClient {
	return {
		auth: {
			async test() {
				return (
					opts.authResult ?? {
						ok: true,
						team: "AskEffi",
						team_id: EXPECTED_REAL_TEAM_ID,
						user: "usegin",
						user_id: "U_BOT",
					}
				);
			},
		},
		conversations: {
			async list() {
				return {
					ok: true,
					channels: opts.channels ?? [],
					response_metadata: {},
				};
			},
			async members({ channel }) {
				return {
					ok: true,
					members: opts.channelMembers?.[channel] ?? [],
				};
			},
			async history() {
				return {
					ok: true,
					messages: (opts.historyMessages ?? []).map((ts) => ({ ts })),
				};
			},
		},
		chat: {
			async postMessage() {
				return (
					opts.postResult ?? {
						ok: true,
						ts: "1700000000.000100",
					}
				);
			},
		},
		users: {
			async lookupByEmail({ email }) {
				const id = opts.emailMap?.[email];
				if (id) return { ok: true, user: { id } };
				return { ok: false, error: "users_not_found" };
			},
		},
	};
}

describe("getSmokeChannel", () => {
	it("uses opts.smokeChannel when set", () => {
		expect(getSmokeChannel({ smokeChannel: "#engineering" }, {})).toBe(
			"#engineering",
		);
	});
	it("falls back to env DX_SLACK_SMOKE_CHANNEL", () => {
		expect(
			getSmokeChannel({}, { DX_SLACK_SMOKE_CHANNEL: "#zisser-out" }),
		).toBe("#zisser-out");
	});
	it("defaults to #dev", () => {
		expect(getSmokeChannel({}, {})).toBe("#dev");
	});
});

describe("runSmoke (skipLive=true)", () => {
	it("passes connection-shape checks even on a tiny tenant", async () => {
		const client = makeClient({
			authResult: {
				ok: true,
				team: "test",
				team_id: "TWRONGTENANT",
				user: "usegin",
				user_id: "U_BOT",
			},
			channels: [{ id: "C1", name: "general" }],
		});
		const r = await runSmoke(client, config, { skipLive: true });
		// auth.test passes
		expect(r.rows.find((x) => x.name === "auth.test")?.status).toBe("pass");
		// team_id mismatch downgraded to warn
		expect(r.rows.find((x) => x.name === "team_id")?.status).toBe("warn");
		// channel count low → warn
		expect(
			r.rows.find((x) => x.name === "channels.count")?.status,
		).toBe("warn");
		// presence + round-trip skipped
		expect(
			r.rows.find((x) => x.name === "smoke_channel.presence")?.status,
		).toBe("skip");
		expect(
			r.rows.find((x) => x.name === "smoke_channel.round_trip")?.status,
		).toBe("skip");
		// missing email lookup → warn under skipLive
		expect(
			r.rows.find((x) => x.name === "users.lookupByEmail")?.status,
		).toBe("warn");
		// overall ok=true (no fails)
		expect(r.ok).toBe(true);
	});

	it("ok=false when auth.test fails — even under skipLive", async () => {
		const client = makeClient({
			authResult: { ok: false, error: "invalid_auth" },
		});
		const r = await runSmoke(client, config, { skipLive: true });
		expect(r.ok).toBe(false);
		expect(r.rows.find((x) => x.name === "auth.test")?.status).toBe("fail");
	});
});

describe("runSmoke (live)", () => {
	it("passes everything when in real workspace + bot in channel + lihu present", async () => {
		const client = makeClient({
			channels: [
				{ id: "C_DEV", name: "dev" },
				{ id: "C_RND", name: "random" },
				{ id: "C_GEN", name: "general" },
				{ id: "C_AUX", name: "aux" },
			],
			channelMembers: { C_DEV: ["U_BOT", "U_LIHU"] },
			historyMessages: ["1700000000.000100"],
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
		});
		const r = await runSmoke(client, config, { smokeChannel: "#dev" });
		expect(r.ok).toBe(true);
		expect(r.rows.every((row) => row.status === "pass")).toBe(true);
	});

	it("fails when team_id mismatches in live mode", async () => {
		const client = makeClient({
			authResult: {
				ok: true,
				team: "wrong",
				team_id: "TFAKEY1234",
				user: "usegin",
				user_id: "U_BOT",
			},
			channels: [
				{ id: "C_DEV", name: "dev" },
				{ id: "C2", name: "x" },
				{ id: "C3", name: "y" },
				{ id: "C4", name: "z" },
			],
			channelMembers: { C_DEV: ["U_BOT"] },
			historyMessages: ["1700000000.000100"],
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
		});
		const r = await runSmoke(client, config, { smokeChannel: "#dev" });
		expect(r.ok).toBe(false);
		expect(r.rows.find((x) => x.name === "team_id")?.status).toBe("fail");
	});

	it("fails when bot is not in the smoke channel", async () => {
		const client = makeClient({
			channels: [
				{ id: "C_DEV", name: "dev" },
				{ id: "C2", name: "x" },
				{ id: "C3", name: "y" },
				{ id: "C4", name: "z" },
			],
			channelMembers: { C_DEV: ["U_OTHER"] },
			historyMessages: [],
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
		});
		const r = await runSmoke(client, config, { smokeChannel: "#dev" });
		expect(r.ok).toBe(false);
		expect(
			r.rows.find((x) => x.name === "smoke_channel.presence")?.status,
		).toBe("fail");
	});

	it("fails when post is OK but history doesn't echo the ts", async () => {
		const client = makeClient({
			channels: [
				{ id: "C_DEV", name: "dev" },
				{ id: "C2", name: "x" },
				{ id: "C3", name: "y" },
				{ id: "C4", name: "z" },
			],
			channelMembers: { C_DEV: ["U_BOT"] },
			postResult: { ok: true, ts: "1700000000.000100" },
			historyMessages: ["1700000000.000099"],
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
		});
		const r = await runSmoke(client, config, { smokeChannel: "#dev" });
		expect(r.ok).toBe(false);
		expect(
			r.rows.find((x) => x.name === "smoke_channel.round_trip")?.status,
		).toBe("fail");
	});
});

describe("formatSmokeHuman / formatSmokeJson", () => {
	it("renders a one-page report", async () => {
		const client = makeClient({
			channels: [{ id: "C1", name: "general" }],
		});
		const r = await runSmoke(client, config, { skipLive: true });
		const out = formatSmokeHuman(r);
		expect(out).toContain("UseGin-Slack smoke");
		expect(out).toContain("auth.test");
		expect(out).not.toContain("1234-5678");
	});

	it("JSON has rows and snake_case top level", async () => {
		const client = makeClient({
			channels: [{ id: "C1", name: "general" }],
		});
		const r = await runSmoke(client, config, { skipLive: true });
		const j = JSON.parse(formatSmokeJson(r));
		expect(j.skip_live).toBe(true);
		expect(j.smoke_channel).toBe("#dev");
		expect(Array.isArray(j.rows)).toBe(true);
	});
});
