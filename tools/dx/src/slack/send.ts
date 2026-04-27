/**
 * Pure functions for `dx slack send`.
 *
 * Posts via Slack's `chat.postMessage`. Channel input accepts `#name` or
 * raw `Cxxxxx` id (resolved by `./channel`). Optional `--thread <ts>` for
 * thread replies.
 *
 * Token-mask in every error path. Output convention matches D1: human →
 * stderr, JSON → stdout, exit codes 0/1/2 (handled by the command builder).
 *
 * Part of: ENG-5412
 */

import { maskToken, type SlackConfig } from "./config";
import {
  resolveChannel,
  type SlackResolverClient,
} from "./channel";
import { autoLinkEngIdsFromEnv } from "./links";

/**
 * Structural subset of `WebClient` we depend on. Lets tests pass a hand-rolled
 * mock without dragging the whole Slack SDK type surface in.
 */
export interface SlackSendClient extends SlackResolverClient {
  chat: {
    postMessage(args: {
      channel: string;
      text: string;
      thread_ts?: string;
    }): Promise<{
      ok?: boolean;
      error?: string;
      channel?: string;
      ts?: string;
      message?: { text?: string; ts?: string; thread_ts?: string };
    }>;
  };
}

export interface SendResult {
  ok: boolean;
  /** Resolved channel id (`Cxxxxx`). */
  channel?: string;
  /** Original input (e.g. `#engineering`) for the human line. */
  channelInput: string;
  /** Posted message timestamp. */
  ts?: string;
  /** Thread parent if this was a thread reply. */
  threadTs?: string;
  /** Posted text (echo of what we sent). */
  text?: string;
  /** Slack error code if `ok=false` (`channel_not_found`, `not_in_channel`, …). */
  error?: string;
  /** Token mask for human display + error paths. Never the raw secret. */
  tokenMask: string;
}

export interface SendOptions {
  threadTs?: string;
  /**
   * Cross-surface link enrichment (ENG-id → Slack mrkdwn link, etc.).
   * Default `true` — set to `false` for tests that want to assert raw text
   * round-trips without transformation.
   */
  enrichLinks?: boolean;
}

/**
 * Resolve the channel and post the message.
 *
 * Returns `ok=false` with a Slack error code on Slack-reported failure
 * (`channel_not_found`, `not_in_channel`, `invalid_auth`, …). Throws on
 * transport / unexpected errors — let the command layer turn those into
 * exit-code 1 with `tokenMask` in the message.
 */
export async function sendMessage(
  client: SlackSendClient,
  channelInput: string,
  text: string,
  config: SlackConfig,
  opts: SendOptions = {},
): Promise<SendResult> {
  const tokenMask = maskToken(config.botToken);

  if (!text || text.trim().length === 0) {
    return {
      ok: false,
      channelInput,
      error: "empty_message",
      tokenMask,
    };
  }

  // Cross-surface enrichment: ENG-ids → Slack mrkdwn links (D4). Idempotent;
  // off by `enrichLinks=false` for tests asserting raw round-trips.
  const enriched =
    opts.enrichLinks === false ? text : autoLinkEngIdsFromEnv(text);

  // Channel resolution. Errors here are transport/lookup-shaped, not
  // Slack-reported message-post failures, so they propagate.
  const channel = await resolveChannel(client, channelInput, config);

  const resp = await client.chat.postMessage({
    channel,
    text: enriched,
    thread_ts: opts.threadTs,
  });

  return {
    ok: resp.ok === true,
    channel: resp.channel ?? channel,
    channelInput,
    ts: resp.ts ?? resp.message?.ts,
    threadTs: resp.message?.thread_ts ?? opts.threadTs,
    text: resp.message?.text ?? enriched,
    error: resp.error,
    tokenMask,
  };
}

/** Format the human-readable output (stderr). */
export function formatSendHuman(result: SendResult): string {
  if (!result.ok) {
    return [
      `UseGin-Slack send FAILED — ${result.error ?? "unknown error"}`,
      `  channel: ${result.channelInput}`,
      `  token:   ${result.tokenMask}`,
      `  hint:    invite the bot (\`/invite @usegin\`), check the channel name, or check scopes.`,
    ].join("\n");
  }
  const lines = [
    `UseGin-Slack send OK`,
    `  channel: ${result.channelInput} (${result.channel ?? "?"})`,
    `  ts:      ${result.ts ?? "?"}`,
  ];
  if (result.threadTs && result.threadTs !== result.ts) {
    lines.push(`  thread:  ${result.threadTs}`);
  }
  return lines.join("\n");
}

/** Format the JSON output (stdout, pipe-safe). */
export function formatSendJson(result: SendResult): string {
  return JSON.stringify(
    {
      ok: result.ok,
      channel: result.channel ?? null,
      channel_input: result.channelInput,
      ts: result.ts ?? null,
      thread_ts: result.threadTs ?? null,
      text: result.text ?? null,
      error: result.error ?? null,
      token: result.tokenMask,
    },
    null,
    2,
  );
}
