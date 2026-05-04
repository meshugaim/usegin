/**
 * Pure functions for `dx slack smoke` — the post-install verification gate.
 *
 * Five checks, in order:
 *   1. auth.test — bot can authenticate.
 *   2. team_id  — auth.test's team_id matches EXPECTED_REAL_TEAM_ID.
 *   3. channels — `conversations.list` returns >3 public channels (cheap
 *                 sanity that this isn't an empty test tenant).
 *   4. presence — the smoke channel (env DX_SLACK_SMOKE_CHANNEL or #dev)
 *                 exists and the bot is a member (`conversations.members`).
 *   5. round-trip — post `:white_check_mark: Zisser online …` to the smoke
 *                  channel and read it back via `conversations.history`,
 *                  asserting the ts matches.
 *   6. lihu lookup — `users.lookupByEmail` resolves `lihu@askeffi.ai`.
 *
 * `skipLive` mode (for pre-swap dry-run):
 *   - auth.test still required (this is just "can we talk to Slack?")
 *   - team_id, channel-count, lihu lookup downgraded from FAIL to WARN.
 *   - presence + round-trip SKIPPED entirely — we don't post test traffic
 *     into channels until the real swap lands.
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import { EXPECTED_REAL_TEAM_ID } from "./registry";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export interface CheckRow {
	name: string;
	status: CheckStatus;
	detail: string;
}

export interface SmokeReport {
	ok: boolean;
	skipLive: boolean;
	rows: CheckRow[];
	teamId?: string;
	smokeChannel: string;
	tokenMask: string;
}

export interface SmokeOptions {
	skipLive?: boolean;
	smokeChannel?: string;
	now?: Date;
}

const DEFAULT_SMOKE_CHANNEL = "#dev";
const SMOKE_USER_EMAIL = "lihu@askeffi.ai";

/** Resolve smoke channel from opts > env > default. */
export function getSmokeChannel(
	opts: SmokeOptions,
	env: NodeJS.ProcessEnv = process.env,
): string {
	if (opts.smokeChannel?.trim()) return opts.smokeChannel.trim();
	const v = env.DX_SLACK_SMOKE_CHANNEL?.trim();
	return v && v.length > 0 ? v : DEFAULT_SMOKE_CHANNEL;
}

/** Structural client surface — minimal subset across all the Slack APIs we hit. */
export interface SlackSmokeClient {
	auth: {
		test(): Promise<{
			ok?: boolean;
			error?: string;
			team?: string;
			team_id?: string;
			user?: string;
			user_id?: string;
			url?: string;
		}>;
	};
	conversations: {
		list(args: {
			cursor?: string;
			limit?: number;
			types?: string;
			exclude_archived?: boolean;
		}): Promise<{
			ok?: boolean;
			error?: string;
			channels?: Array<{ id?: string; name?: string }>;
			response_metadata?: { next_cursor?: string };
		}>;
		members(args: {
			channel: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			members?: string[];
		}>;
		history(args: {
			channel: string;
			oldest?: string;
			limit?: number;
		}): Promise<{
			ok?: boolean;
			error?: string;
			messages?: Array<{ ts?: string; text?: string }>;
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
			message?: { ts?: string; text?: string };
		}>;
	};
	users: {
		lookupByEmail(args: { email: string }): Promise<{
			ok?: boolean;
			error?: string;
			user?: { id?: string; profile?: { email?: string } };
		}>;
	};
}

/** Run every check; return the report. Never throws — failures land in rows. */
export async function runSmoke(
	client: SlackSmokeClient,
	config: SlackConfig,
	opts: SmokeOptions = {},
): Promise<SmokeReport> {
	const tokenMask = maskToken(config.botToken);
	const skipLive = opts.skipLive ?? false;
	const smokeChannel = getSmokeChannel(opts);
	const rows: CheckRow[] = [];
	const now = opts.now ?? new Date();
	let teamId: string | undefined;
	let botUserId: string | undefined;

	// 1. auth.test
	let authOk = false;
	try {
		const auth = await client.auth.test();
		if (!auth.ok) {
			rows.push({
				name: "auth.test",
				status: "fail",
				detail: `Slack returned ok=false: ${auth.error ?? "unknown"}`,
			});
		} else {
			teamId = auth.team_id;
			botUserId = auth.user_id;
			authOk = true;
			rows.push({
				name: "auth.test",
				status: "pass",
				detail: `team=${auth.team ?? "?"} (${auth.team_id ?? "?"}), bot=${auth.user ?? "?"} (${auth.user_id ?? "?"})`,
			});
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		rows.push({ name: "auth.test", status: "fail", detail: msg });
	}

	// 2. team_id
	if (!teamId) {
		rows.push({
			name: "team_id",
			status: skipLive ? "skip" : "fail",
			detail: "no team_id from auth.test",
		});
	} else if (teamId === EXPECTED_REAL_TEAM_ID) {
		rows.push({
			name: "team_id",
			status: "pass",
			detail: `matches EXPECTED_REAL_TEAM_ID (${EXPECTED_REAL_TEAM_ID})`,
		});
	} else {
		rows.push({
			name: "team_id",
			status: skipLive ? "warn" : "fail",
			detail: `${teamId} ≠ EXPECTED_REAL_TEAM_ID (${EXPECTED_REAL_TEAM_ID})`,
		});
	}

	// 3. channel count
	let channelCount = 0;
	let smokeChannelId: string | undefined;
	const wantedName = smokeChannel.startsWith("#")
		? smokeChannel.slice(1)
		: smokeChannel;
	try {
		let cursor: string | undefined;
		for (let page = 0; page < 5; page += 1) {
			const list = await client.conversations.list({
				cursor,
				limit: 200,
				types: "public_channel,private_channel",
				exclude_archived: true,
			});
			if (!list.ok) {
				rows.push({
					name: "channels.list",
					status: skipLive ? "warn" : "fail",
					detail: `error=${list.error ?? "unknown"}`,
				});
				break;
			}
			for (const ch of list.channels ?? []) {
				channelCount += 1;
				if (ch.name === wantedName && ch.id) smokeChannelId = ch.id;
			}
			cursor = list.response_metadata?.next_cursor;
			if (!cursor) break;
		}
		if (channelCount > 3) {
			rows.push({
				name: "channels.count",
				status: "pass",
				detail: `${channelCount} channels visible`,
			});
		} else if (channelCount > 0) {
			rows.push({
				name: "channels.count",
				status: skipLive ? "warn" : "fail",
				detail: `only ${channelCount} channels — looks like a test tenant`,
			});
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		rows.push({
			name: "channels.list",
			status: skipLive ? "warn" : "fail",
			detail: msg,
		});
	}

	// 4. presence in smoke channel
	if (skipLive) {
		rows.push({
			name: "smoke_channel.presence",
			status: "skip",
			detail: `--skip-live: not posting to ${smokeChannel}`,
		});
	} else if (!smokeChannelId) {
		rows.push({
			name: "smoke_channel.presence",
			status: "fail",
			detail: `smoke channel ${smokeChannel} not found in workspace`,
		});
	} else if (!botUserId) {
		rows.push({
			name: "smoke_channel.presence",
			status: "fail",
			detail: "bot user_id unknown (auth.test failed earlier)",
		});
	} else {
		try {
			const m = await client.conversations.members({
				channel: smokeChannelId,
			});
			if (!m.ok) {
				rows.push({
					name: "smoke_channel.presence",
					status: "fail",
					detail: `conversations.members error=${m.error ?? "unknown"}`,
				});
			} else if ((m.members ?? []).includes(botUserId)) {
				rows.push({
					name: "smoke_channel.presence",
					status: "pass",
					detail: `bot is in ${smokeChannel} (${smokeChannelId})`,
				});
			} else {
				rows.push({
					name: "smoke_channel.presence",
					status: "fail",
					detail: `bot is NOT in ${smokeChannel} — Lihu must invite it (\`/invite @usegin\`)`,
				});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			rows.push({
				name: "smoke_channel.presence",
				status: "fail",
				detail: msg,
			});
		}
	}

	// 5. round-trip
	if (skipLive) {
		rows.push({
			name: "smoke_channel.round_trip",
			status: "skip",
			detail: "--skip-live: post + read-back deferred until real swap",
		});
	} else if (!smokeChannelId) {
		rows.push({
			name: "smoke_channel.round_trip",
			status: "fail",
			detail: "no smoke channel id (presence check failed)",
		});
	} else {
		try {
			const text = `:white_check_mark: Zisser online from devcontainer @ ${now.toISOString()}`;
			const before = Math.floor(now.getTime() / 1000) - 5;
			const post = await client.chat.postMessage({
				channel: smokeChannelId,
				text,
			});
			const ts = post.ts ?? post.message?.ts;
			if (!post.ok || !ts) {
				rows.push({
					name: "smoke_channel.round_trip",
					status: "fail",
					detail: `chat.postMessage error=${post.error ?? "no ts returned"}`,
				});
			} else {
				const hist = await client.conversations.history({
					channel: smokeChannelId,
					oldest: String(before),
					limit: 50,
				});
				if (!hist.ok) {
					rows.push({
						name: "smoke_channel.round_trip",
						status: "fail",
						detail: `posted ts=${ts} but conversations.history error=${hist.error ?? "unknown"}`,
					});
				} else if ((hist.messages ?? []).some((m) => m.ts === ts)) {
					rows.push({
						name: "smoke_channel.round_trip",
						status: "pass",
						detail: `posted+read-back ts=${ts}`,
					});
				} else {
					rows.push({
						name: "smoke_channel.round_trip",
						status: "fail",
						detail: `posted ts=${ts} but not visible in history`,
					});
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			rows.push({
				name: "smoke_channel.round_trip",
				status: "fail",
				detail: msg,
			});
		}
	}

	// 6. lihu lookup
	try {
		const lk = await client.users.lookupByEmail({ email: SMOKE_USER_EMAIL });
		if (lk.ok && lk.user?.id) {
			rows.push({
				name: "users.lookupByEmail",
				status: "pass",
				detail: `${SMOKE_USER_EMAIL} → ${lk.user.id}`,
			});
		} else {
			rows.push({
				name: "users.lookupByEmail",
				status: skipLive ? "warn" : "fail",
				detail: `${SMOKE_USER_EMAIL} → error=${lk.error ?? "unknown"}`,
			});
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		rows.push({
			name: "users.lookupByEmail",
			status: skipLive ? "warn" : "fail",
			detail: msg,
		});
	}

	// `ok` = no fails. Warns under skipLive don't break the report.
	const ok =
		authOk && rows.every((r) => r.status === "pass" || r.status === "warn" || r.status === "skip");

	return {
		ok,
		skipLive,
		rows,
		teamId,
		smokeChannel,
		tokenMask,
	};
}

const STATUS_GLYPH: Record<CheckStatus, string> = {
	pass: " OK ",
	warn: "WARN",
	fail: "FAIL",
	skip: "SKIP",
};

export function formatSmokeHuman(r: SmokeReport): string {
	const head = [
		`UseGin-Slack smoke — ${r.ok ? "OK" : "FAILED"}${r.skipLive ? " (--skip-live)" : ""}`,
		`  smoke channel: ${r.smokeChannel}`,
		`  team_id:       ${r.teamId ?? "(unknown)"}`,
		`  token:         ${r.tokenMask}`,
		``,
	].join("\n");
	const widest = Math.max(...r.rows.map((row) => row.name.length), 0);
	const body = r.rows
		.map(
			(row) =>
				`  [${STATUS_GLYPH[row.status]}] ${row.name.padEnd(widest)}  ${row.detail}`,
		)
		.join("\n");
	return head + body;
}

export function formatSmokeJson(r: SmokeReport): string {
	return JSON.stringify(
		{
			ok: r.ok,
			skip_live: r.skipLive,
			team_id: r.teamId ?? null,
			smoke_channel: r.smokeChannel,
			rows: r.rows.map((row) => ({
				name: row.name,
				status: row.status,
				detail: row.detail,
			})),
			token: r.tokenMask,
		},
		null,
		2,
	);
}
