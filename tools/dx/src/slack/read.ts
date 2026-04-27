/**
 * Pure functions for `dx slack read`.
 *
 * Reads via Slack's `conversations.history`. Accepts `--since 1h|1d|7d` and
 * `--limit N` (default 50). Paginates the API until `--limit` is reached
 * or `has_more=false`. Surfaces Slack rate-limit (429) errors with a clear
 * retry hint — Slack puts the wait time in `Retry-After`.
 *
 * Per CF1/Synthesis: this method is hard-throttled to 1 req/min × 15
 * msgs/page for non-Marketplace apps from 2026-03-03 onward. UseGin-Slack
 * is internal so this doesn't bite us today, but the rate-limit handling
 * lives here because we WILL hit it the moment the customer surface (C)
 * shares this code path. Build the safety in once.
 *
 * Part of: ENG-5412
 */

import { maskToken, type SlackConfig } from "./config";
import {
  resolveChannel,
  type SlackResolverClient,
} from "./channel";
import { extractEngIds } from "./links";

export interface ReadMessage {
  ts: string;
  user?: string;
  text: string;
  threadTs?: string;
  replyCount?: number;
  subtype?: string;
}

export interface SlackReadClient extends SlackResolverClient {
  conversations: SlackResolverClient["conversations"] & {
    history(args: {
      channel: string;
      cursor?: string;
      limit?: number;
      oldest?: string;
    }): Promise<{
      ok?: boolean;
      error?: string;
      messages?: Array<{
        ts?: string;
        user?: string;
        text?: string;
        thread_ts?: string;
        reply_count?: number;
        subtype?: string;
      }>;
      has_more?: boolean;
      response_metadata?: { next_cursor?: string };
    }>;
  };
}

export interface ReadResult {
  ok: boolean;
  channel?: string;
  channelInput: string;
  messages: ReadMessage[];
  /** True when Slack returned has_more=true and we stopped at --limit. */
  truncated: boolean;
  error?: string;
  /** Retry-after seconds when Slack returned a rate-limit error. */
  retryAfter?: number;
  tokenMask: string;
}

export interface ReadOptions {
  since?: string;
  limit?: number;
}

/**
 * Parse a `--since` window into a unix-seconds `oldest` timestamp.
 *
 * Accepts: `Nh`, `Nd`, `Nw` (e.g. `1h`, `1d`, `7d`, `2w`). Returns the
 * computed oldest in seconds-since-epoch (Slack's API uses string seconds
 * with optional fractional, but oldest accepts integer seconds fine).
 *
 * Throws `RangeError` on unparseable input — caller should catch and
 * surface with a friendly hint.
 */
export function parseSince(since: string, now: Date = new Date()): string {
  const m = /^(\d+)([hdw])$/i.exec(since.trim());
  if (!m) {
    throw new RangeError(
      `--since must look like '1h', '1d', '7d', or '2w' (got: '${since}')`,
    );
  }
  const n = Number.parseInt(m[1] as string, 10);
  const unit = (m[2] as string).toLowerCase();
  const SECONDS_PER: Record<string, number> = {
    h: 3600,
    d: 86_400,
    w: 604_800,
  };
  const delta = n * (SECONDS_PER[unit] ?? 0);
  if (delta <= 0) {
    throw new RangeError(`--since must be positive (got: '${since}')`);
  }
  const oldest = Math.floor(now.getTime() / 1000) - delta;
  return String(oldest);
}

/**
 * Slack rate-limit detector.
 *
 * `@slack/web-api` raises an error for HTTP 429 with `code === 'slack_webapi_rate_limited_error'`
 * and `retryAfter` (seconds) on the error object. Older releases use
 * `code === 'rate_limited'`. We accept either shape and surface the wait.
 */
function readRetryAfter(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as {
    code?: string;
    retryAfter?: number;
    data?: { error?: string; retry_after?: number };
  };
  if (
    e.code === "slack_webapi_rate_limited_error" ||
    e.code === "slack_webapi_platform_error" ||
    e.code === "rate_limited" ||
    e.data?.error === "ratelimited"
  ) {
    return e.retryAfter ?? e.data?.retry_after ?? 60;
  }
  return undefined;
}

/**
 * Read messages from a channel.
 *
 * Paginates `conversations.history` until `--limit` is reached or there
 * are no more pages. Returns the flat list newest-first (as Slack does).
 */
export async function readMessages(
  client: SlackReadClient,
  channelInput: string,
  config: SlackConfig,
  opts: ReadOptions = {},
  now: Date = new Date(),
): Promise<ReadResult> {
  const tokenMask = maskToken(config.botToken);
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 1000));
  const oldest = opts.since ? parseSince(opts.since, now) : undefined;

  const channel = await resolveChannel(client, channelInput, config);

  const collected: ReadMessage[] = [];
  let cursor: string | undefined;
  let hadMore = false;
  const PAGE_SIZE = Math.min(limit, 200);

  for (let page = 0; page < 50; page += 1) {
    let resp;
    try {
      resp = await client.conversations.history({
        channel,
        cursor,
        limit: PAGE_SIZE,
        oldest,
      });
    } catch (err) {
      const retryAfter = readRetryAfter(err);
      if (retryAfter !== undefined) {
        return {
          ok: false,
          channel,
          channelInput,
          messages: collected,
          truncated: false,
          error: "ratelimited",
          retryAfter,
          tokenMask,
        };
      }
      throw err;
    }

    if (resp.ok === false) {
      return {
        ok: false,
        channel,
        channelInput,
        messages: collected,
        truncated: false,
        error: resp.error ?? "unknown_error",
        tokenMask,
      };
    }

    for (const m of resp.messages ?? []) {
      if (!m.ts) continue;
      collected.push({
        ts: m.ts,
        user: m.user,
        text: m.text ?? "",
        threadTs: m.thread_ts,
        replyCount: m.reply_count,
        subtype: m.subtype,
      });
      if (collected.length >= limit) break;
    }

    if (collected.length >= limit) {
      hadMore = (resp.has_more ?? false) || Boolean(resp.response_metadata?.next_cursor);
      break;
    }

    cursor = resp.response_metadata?.next_cursor;
    if (!cursor || !resp.has_more) break;
  }

  return {
    ok: true,
    channel,
    channelInput,
    messages: collected,
    truncated: hadMore,
    tokenMask,
  };
}

/** Format the human-readable output (stderr). */
export function formatReadHuman(result: ReadResult): string {
  if (!result.ok) {
    if (result.error === "ratelimited") {
      return [
        `UseGin-Slack read RATE-LIMITED — retry in ~${result.retryAfter ?? "?"}s`,
        `  channel: ${result.channelInput}`,
        `  token:   ${result.tokenMask}`,
        `  hint:    Slack throttles non-Marketplace apps to 1 req/min on conversations.history.`,
      ].join("\n");
    }
    return [
      `UseGin-Slack read FAILED — ${result.error ?? "unknown error"}`,
      `  channel: ${result.channelInput}`,
      `  token:   ${result.tokenMask}`,
      `  hint:    invite the bot, check the channel id, or check scopes (channels:history).`,
    ].join("\n");
  }
  const header = [
    `UseGin-Slack read OK — ${result.messages.length} message${result.messages.length === 1 ? "" : "s"}`,
    `  channel: ${result.channelInput} (${result.channel ?? "?"})`,
    result.truncated ? `  (truncated — more messages exist past --limit)` : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  const body = result.messages
    .map((m) => {
      const refs = extractEngIds(m.text);
      const refsStr = refs.length > 0 ? ` (refs: ${refs.join(", ")})` : "";
      const head = `[${m.ts}]${m.user ? ` <${m.user}>` : ""}${m.threadTs && m.threadTs !== m.ts ? ` (thread ${m.threadTs})` : ""}${m.replyCount && m.replyCount > 0 ? ` (${m.replyCount} replies)` : ""}${refsStr}`;
      const text = m.text.replace(/\r?\n/g, "\n    ");
      return `${head}\n    ${text}`;
    })
    .join("\n");

  return body.length > 0 ? `${header}\n${body}` : header;
}

/** Format the JSON output (stdout, pipe-safe). */
export function formatReadJson(result: ReadResult): string {
  return JSON.stringify(
    {
      ok: result.ok,
      channel: result.channel ?? null,
      channel_input: result.channelInput,
      messages: result.messages.map((m) => ({
        ts: m.ts,
        user: m.user ?? null,
        text: m.text,
        thread_ts: m.threadTs ?? null,
        reply_count: m.replyCount ?? null,
        subtype: m.subtype ?? null,
      })),
      truncated: result.truncated,
      error: result.error ?? null,
      retry_after: result.retryAfter ?? null,
      token: result.tokenMask,
    },
    null,
    2,
  );
}
