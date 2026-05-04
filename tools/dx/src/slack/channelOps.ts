/**
 * Pure functions for `dx slack channel <verb>` admin ops.
 *
 * Each verb is one Slack API call wrapped in a uniform `OpResult` so the
 * command layer can render human/JSON the same way regardless of which
 * verb ran.
 *
 * Token-mask in every error path. `missing_scope` errors surface verbatim
 * so the caller can tell Lihu which scope to add to UseGin-Slack.
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";
import {
	resolveChannel,
	type SlackResolverClient,
} from "./channel";
import {
	resolveUser,
	type SlackUserClient,
} from "./user";

/**
 * Common shape for every channel op. `verb` is set by the calling op so
 * the human/JSON formatters know which line to render.
 */
export interface OpResult {
	ok: boolean;
	verb: string;
	/** Resolved channel id where applicable. */
	channel?: string;
	/** Original input for the human line. */
	channelInput?: string;
	/** Slack error code (`missing_scope`, `name_taken`, …). */
	error?: string;
	/** Verb-specific extras (members invited, topic text, etc.). */
	details?: Record<string, unknown>;
	tokenMask: string;
}

export interface ChannelAdminClient extends SlackResolverClient, SlackUserClient {
	conversations: SlackResolverClient["conversations"] & {
		create(args: {
			name: string;
			is_private?: boolean;
		}): Promise<{
			ok?: boolean;
			error?: string;
			channel?: { id?: string; name?: string; is_private?: boolean };
		}>;
		invite(args: {
			channel: string;
			users: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			channel?: { id?: string };
			errors?: Array<{ user?: string; error?: string }>;
		}>;
		join(args: {
			channel: string;
		}): Promise<{
			ok?: boolean;
			error?: string;
			channel?: { id?: string };
			warning?: string;
		}>;
		archive(args: {
			channel: string;
		}): Promise<{ ok?: boolean; error?: string }>;
		setTopic(args: {
			channel: string;
			topic: string;
		}): Promise<{ ok?: boolean; error?: string; topic?: string }>;
		setPurpose(args: {
			channel: string;
			purpose: string;
		}): Promise<{ ok?: boolean; error?: string; purpose?: string }>;
		members(args: {
			channel: string;
			cursor?: string;
			limit?: number;
		}): Promise<{
			ok?: boolean;
			error?: string;
			members?: string[];
			response_metadata?: { next_cursor?: string };
		}>;
	};
}

/**
 * Slack channel naming rules — lowercase, ≤80 chars, only `a-z 0-9 _ -`.
 * We don't enforce here (Slack will return `invalid_name`); we strip a
 * leading `#` so callers can pass either shape.
 */
function normalizeChannelName(name: string): string {
	return name.startsWith("#") ? name.slice(1) : name;
}

/**
 * `conversations.create` — public or private (per `is_private`).
 *
 * After creation, optionally set the topic in the same call. Slack
 * doesn't take topic on create; we round-trip a setTopic if the caller
 * passed one, and we stop reporting ok if either step fails.
 */
export async function createChannel(
	client: ChannelAdminClient,
	name: string,
	config: SlackConfig,
	opts: { isPrivate?: boolean; topic?: string } = {},
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	const cleanName = normalizeChannelName(name).trim();
	if (!cleanName) {
		return {
			ok: false,
			verb: "create",
			error: "empty_name",
			tokenMask,
		};
	}

	const resp = await client.conversations.create({
		name: cleanName,
		is_private: opts.isPrivate,
	});
	if (!resp.ok || !resp.channel?.id) {
		return {
			ok: false,
			verb: "create",
			channelInput: cleanName,
			error: resp.error ?? "unknown_error",
			tokenMask,
		};
	}
	const channelId = resp.channel.id;

	let topicSet: string | undefined;
	if (opts.topic) {
		const t = await client.conversations.setTopic({
			channel: channelId,
			topic: opts.topic,
		});
		if (!t.ok) {
			return {
				ok: false,
				verb: "create",
				channel: channelId,
				channelInput: cleanName,
				error: `created_but_topic_failed: ${t.error ?? "unknown"}`,
				tokenMask,
				details: { topic_attempted: opts.topic },
			};
		}
		topicSet = opts.topic;
	}

	return {
		ok: true,
		verb: "create",
		channel: channelId,
		channelInput: cleanName,
		tokenMask,
		details: {
			is_private: resp.channel.is_private ?? opts.isPrivate ?? false,
			topic: topicSet,
		},
	};
}

/**
 * `conversations.invite` — invite one or more users (resolved from
 * email/handle/id) to a channel.
 */
export async function inviteToChannel(
	client: ChannelAdminClient,
	channelInput: string,
	users: string[],
	config: SlackConfig,
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	if (users.length === 0) {
		return {
			ok: false,
			verb: "invite",
			channelInput,
			error: "no_users",
			tokenMask,
		};
	}

	const channel = await resolveChannel(client, channelInput, config);
	const resolved: string[] = [];
	const failures: Array<{ input: string; error: string }> = [];
	for (const u of users) {
		try {
			resolved.push(await resolveUser(client, u, config));
		} catch (err) {
			const e = err as { slackError?: string; message: string };
			failures.push({ input: u, error: e.slackError ?? e.message });
		}
	}
	if (resolved.length === 0) {
		return {
			ok: false,
			verb: "invite",
			channel,
			channelInput,
			error: "no_users_resolved",
			tokenMask,
			details: { failures },
		};
	}

	const resp = await client.conversations.invite({
		channel,
		users: resolved.join(","),
	});
	const partial = resp.errors ?? [];

	return {
		ok: resp.ok === true,
		verb: "invite",
		channel,
		channelInput,
		error: resp.error,
		tokenMask,
		details: {
			invited: resolved,
			resolution_failures: failures,
			partial_errors: partial,
		},
	};
}

/** `conversations.join` — bot self-joins a channel so it can read history. */
export async function joinChannel(
	client: ChannelAdminClient,
	channelInput: string,
	config: SlackConfig,
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.conversations.join({ channel });
	return {
		ok: resp.ok === true,
		verb: "join",
		channel: resp.channel?.id ?? channel,
		channelInput,
		error: resp.error,
		tokenMask,
		details: resp.warning ? { warning: resp.warning } : undefined,
	};
}

/** `conversations.archive` — soft-delete a channel. */
export async function archiveChannel(
	client: ChannelAdminClient,
	channelInput: string,
	config: SlackConfig,
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.conversations.archive({ channel });
	return {
		ok: resp.ok === true,
		verb: "archive",
		channel,
		channelInput,
		error: resp.error,
		tokenMask,
	};
}

/** `conversations.setTopic`. */
export async function setChannelTopic(
	client: ChannelAdminClient,
	channelInput: string,
	topic: string,
	config: SlackConfig,
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.conversations.setTopic({ channel, topic });
	return {
		ok: resp.ok === true,
		verb: "topic",
		channel,
		channelInput,
		error: resp.error,
		tokenMask,
		details: { topic: resp.topic ?? topic },
	};
}

/** `conversations.setPurpose`. */
export async function setChannelPurpose(
	client: ChannelAdminClient,
	channelInput: string,
	purpose: string,
	config: SlackConfig,
): Promise<OpResult> {
	const tokenMask = maskToken(config.botToken);
	const channel = await resolveChannel(client, channelInput, config);
	const resp = await client.conversations.setPurpose({ channel, purpose });
	return {
		ok: resp.ok === true,
		verb: "purpose",
		channel,
		channelInput,
		error: resp.error,
		tokenMask,
		details: { purpose: resp.purpose ?? purpose },
	};
}

export interface MemberRow {
	id: string;
	name?: string;
	real_name?: string;
	email?: string;
	is_bot?: boolean;
}

/**
 * `conversations.members` paginated → array of member ids; then
 * `users.info` per id to enrich with name/email.
 *
 * Email enrichment is best-effort — when `users:read.email` isn't
 * granted, Slack returns the user record without `profile.email` and
 * we render `null` rather than failing the whole op.
 */
export async function listChannelMembers(
	client: ChannelAdminClient,
	channelInput: string,
	config: SlackConfig,
): Promise<OpResult & { members?: MemberRow[] }> {
	const tokenMask = maskToken(config.botToken);
	const channel = await resolveChannel(client, channelInput, config);

	const ids: string[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < 50; page += 1) {
		const resp = await client.conversations.members({
			channel,
			cursor,
			limit: 1000,
		});
		if (!resp.ok) {
			return {
				ok: false,
				verb: "members",
				channel,
				channelInput,
				error: resp.error ?? "unknown_error",
				tokenMask,
			};
		}
		for (const id of resp.members ?? []) ids.push(id);
		cursor = resp.response_metadata?.next_cursor;
		if (!cursor) break;
	}

	const rows: MemberRow[] = [];
	for (const id of ids) {
		try {
			const info = await client.users.info({ user: id });
			if (info.ok && info.user) {
				rows.push({
					id,
					name: info.user.name,
					real_name:
						info.user.real_name ?? info.user.profile?.real_name,
					email: info.user.profile?.email,
					is_bot: info.user.is_bot,
				});
			} else {
				rows.push({ id });
			}
		} catch {
			rows.push({ id });
		}
	}

	return {
		ok: true,
		verb: "members",
		channel,
		channelInput,
		tokenMask,
		members: rows,
		details: { count: rows.length },
	};
}

/** Format the human-readable line(s) for any OpResult. */
export function formatOpHuman(result: OpResult): string {
	const head = result.ok
		? `UseGin-Slack channel ${result.verb} OK`
		: `UseGin-Slack channel ${result.verb} FAILED — ${result.error ?? "unknown"}`;
	const lines = [head];
	if (result.channelInput) {
		lines.push(
			`  channel: ${result.channelInput}${result.channel ? ` (${result.channel})` : ""}`,
		);
	}
	if (result.details) {
		for (const [k, v] of Object.entries(result.details)) {
			if (v === undefined || v === null) continue;
			const rendered =
				typeof v === "string" ? v : JSON.stringify(v);
			lines.push(`  ${k}: ${rendered}`);
		}
	}
	lines.push(`  token:   ${result.tokenMask}`);
	if (!result.ok && result.error === "missing_scope") {
		lines.push(
			`  hint:    bot lacks a scope — see tools/dx/src/slack/README.md "Lihu-please-add-these".`,
		);
	}
	return lines.join("\n");
}

/** Format pipe-safe JSON output for any OpResult. */
export function formatOpJson(result: OpResult & { members?: MemberRow[] }): string {
	return JSON.stringify(
		{
			ok: result.ok,
			verb: result.verb,
			channel: result.channel ?? null,
			channel_input: result.channelInput ?? null,
			error: result.error ?? null,
			details: result.details ?? null,
			members: result.members ?? null,
			token: result.tokenMask,
		},
		null,
		2,
	);
}
