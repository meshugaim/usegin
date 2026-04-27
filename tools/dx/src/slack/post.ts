/**
 * Pure functions for `dx slack post` — the outbox shortcut.
 *
 * Slack is a chat surface with no native "where do half-formed thoughts
 * go" channel. Per D's whiteboard, we adopt a convention: `#usegin` is
 * UseGin's outbox — proactive Gin posts (session breadcrumbs, decision
 * notes, friction surfacing, /end ratings) land there by default.
 *
 * `dx slack post "<msg>"` is the no-channel-arg shortcut. The channel is
 * read from `USEGIN_OUTBOX_CHANNEL` or defaults to `"#usegin"`. Everything
 * else (token, link enrichment, thread support, formatting) reuses
 * `sendMessage` so the two commands stay symmetric.
 *
 * Part of: ENG-5408 / D4
 */

import type { SlackConfig } from "./config";
import { sendMessage, type SendOptions, type SendResult, type SlackSendClient } from "./send";

const DEFAULT_OUTBOX_CHANNEL = "#usegin";

/** Resolve the outbox channel from env at call time. Pure read. */
export function getOutboxChannel(
	env: NodeJS.ProcessEnv = process.env,
): string {
	const v = env.USEGIN_OUTBOX_CHANNEL?.trim();
	return v && v.length > 0 ? v : DEFAULT_OUTBOX_CHANNEL;
}

/**
 * Post to the outbox. Wraps `sendMessage` with a defaulted channel, all
 * other behavior (link enrichment, error shape, token mask) is identical
 * to `dx slack send`.
 */
export async function postToOutbox(
	client: SlackSendClient,
	text: string,
	config: SlackConfig,
	opts: SendOptions & { channel?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<SendResult> {
	const channel = opts.channel ?? getOutboxChannel(opts.env);
	const { channel: _ignored, env: _ignoredEnv, ...sendOpts } = opts;
	return sendMessage(client, channel, text, config, sendOpts);
}
