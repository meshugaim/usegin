/**
 * Pure functions for `dx slack inbox`.
 *
 * Poll-on-invoke @usegin mention queue. No Events API receiver — we resolve
 * the bot user id via `auth.test`, list joined channels via
 * `conversations.list`, then walk `conversations.history` per channel
 * filtering for messages containing `<@BOT_ID>`. Reuses `parseSince` and
 * the rate-limit / token-mask conventions from `read.ts`.
 *
 * `--unread` is best-effort: a per-machine cursor file at
 * `~/.dx/slack-inbox-cursor.json` records the latest mention `ts` Gin
 * has acknowledged. Subsequent runs filter to mentions strictly newer
 * than that ts.
 *
 * Per the whiteboard's "Discovery model" table — this is the third command
 * shape, mirroring `effi-slack`-style `@usegin` addressability while
 * staying within the `plan`-shaped pull-only-CLI envelope (no daemon, no
 * subscription, no infra).
 *
 * Part of: ENG-5415
 */

import { maskToken, type SlackConfig } from "./config";
import { parseSince } from "./read";

/** Structural subset of `WebClient.auth.test` we depend on. */
export interface AuthTestSlice {
  test(): Promise<{
    ok?: boolean;
    error?: string;
    user_id?: string;
    user?: string;
  }>;
}

/** Structural subset of `WebClient.conversations` for inbox aggregation. */
export interface InboxConversationsSlice {
  list(args: {
    cursor?: string;
    limit?: number;
    types?: string;
    exclude_archived?: boolean;
  }): Promise<{
    ok?: boolean;
    error?: string;
    channels?: Array<{ id?: string; name?: string; is_member?: boolean }>;
    response_metadata?: { next_cursor?: string };
  }>;
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
}

/**
 * Structural subset of `WebClient` we depend on. Lets tests pass a hand-rolled
 * mock without dragging the whole Slack SDK type surface in.
 */
export interface SlackInboxClient {
  auth: AuthTestSlice;
  conversations: InboxConversationsSlice;
}

export interface InboxMention {
  /** Channel id (`Cxxxxx`). */
  channelId: string;
  /** Channel name when known (e.g. `engineering`, no `#`). */
  channelName?: string;
  ts: string;
  user?: string;
  text: string;
  threadTs?: string;
  replyCount?: number;
}

export interface InboxResult {
  ok: boolean;
  /** Resolved bot user id (`U…`). */
  botUserId?: string;
  /** Mentions, newest-first across all channels. */
  mentions: InboxMention[];
  /** Channels searched (post-filter for is_member). */
  channelsSearched: number;
  /** True when at least one channel returned has_more under --since. */
  truncated: boolean;
  /** Slack error code when `ok=false`. */
  error?: string;
  /** Retry-after seconds when Slack returned a rate-limit error. */
  retryAfter?: number;
  /** When `--unread` is set, the cursor ts the run consumed (or the prior). */
  cursorTs?: string;
  /** Token mask for human display + error paths. Never the raw secret. */
  tokenMask: string;
}

export interface InboxOptions {
  since?: string;
  /** Filter to mentions newer than the cursor; update cursor on success. */
  unread?: boolean;
  /**
   * Default lookback window when neither `--since` nor `--unread` is given.
   * Slack's `conversations.history` without `oldest` walks all history; that
   * would burn rate-limit budget for the common case. Default to 1 day.
   */
  defaultSince?: string;
}

const DEFAULT_SINCE = "1d";

/**
 * Detect Slack rate-limit errors. Same shape as `read.ts` — kept inline rather
 * than importing a private symbol. `@slack/web-api` raises an error with
 * `code === 'slack_webapi_rate_limited_error'` (newer) or `code ===
 * 'rate_limited'` (older) and `retryAfter` (seconds).
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
 * Resolve the bot user id via `auth.test`.
 *
 * We could pass it in from a config file, but that drifts from the live
 * workspace state — token rotations / app re-installs can change `user_id`.
 * `auth.test` is one round-trip and bullet-proof. Slack also documented it
 * as the canonical "who am I" call.
 *
 * `users.list` was named in the AC but `auth.test` is the cleaner answer:
 * it returns OUR user id directly, no scan, no pagination, no `users:read`
 * scope dependency.
 */
async function resolveBotUserId(
  client: SlackInboxClient,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const resp = await client.auth.test();
  if (resp.ok === false) {
    return { ok: false, error: resp.error ?? "auth_test_failed" };
  }
  if (!resp.user_id) {
    return { ok: false, error: "auth_test_no_user_id" };
  }
  return { ok: true, userId: resp.user_id };
}

/**
 * Build the mention substring Slack uses in message text — `<@UXXXXX>`.
 *
 * Slack renders `@usegin` as `<@U02XYZ>` in the raw text returned by
 * `conversations.history`. Match on the literal token; the human-readable
 * display name only appears in formatted Slack views, not in API payloads.
 */
function mentionToken(botUserId: string): string {
  return `<@${botUserId}>`;
}

/** True when `text` contains the bot mention token. */
export function messageMentionsBot(text: string, botUserId: string): boolean {
  return text.includes(mentionToken(botUserId));
}

/**
 * Compare two Slack `ts` strings as numeric timestamps.
 *
 * `ts` looks like `"1700000000.000123"`. Lexicographic compare works for
 * same-length strings but Slack pads to a fixed shape so it's safe; we
 * still do numeric for clarity.
 */
function tsGreater(a: string, b: string): boolean {
  return Number.parseFloat(a) > Number.parseFloat(b);
}

/**
 * Walk all joined channels and aggregate mentions of `@usegin`.
 *
 * Pulls `conversations.list(types=public_channel,private_channel,
 * exclude_archived=true)`, filters to `is_member=true` (the bot can only
 * read history in channels it has joined), then `conversations.history`
 * with `oldest=parseSince(since|defaultSince)` per channel. Filters
 * messages to those containing `<@BOT_ID>`. Returns flat list newest-first
 * across all channels.
 */
export async function fetchInbox(
  client: SlackInboxClient,
  config: SlackConfig,
  opts: InboxOptions = {},
  cursor?: { lastSeenTs?: string },
  now: Date = new Date(),
): Promise<InboxResult> {
  const tokenMask = maskToken(config.botToken);

  // 1) Resolve bot user id.
  let botUserId: string;
  try {
    const who = await resolveBotUserId(client);
    if (!who.ok || !who.userId) {
      return {
        ok: false,
        mentions: [],
        channelsSearched: 0,
        truncated: false,
        error: who.error ?? "auth_test_failed",
        tokenMask,
      };
    }
    botUserId = who.userId;
  } catch (err) {
    const retryAfter = readRetryAfter(err);
    if (retryAfter !== undefined) {
      return {
        ok: false,
        mentions: [],
        channelsSearched: 0,
        truncated: false,
        error: "ratelimited",
        retryAfter,
        tokenMask,
      };
    }
    throw err;
  }

  // 2) Compute oldest from --since / cursor / default-window.
  //    Effective oldest is the MAX of (since-window, cursor-ts) so --unread
  //    never re-pulls already-acknowledged mentions even when the explicit
  //    --since is wider.
  const sinceArg = opts.since ?? opts.defaultSince ?? DEFAULT_SINCE;
  let oldest: string;
  try {
    oldest = parseSince(sinceArg, now);
  } catch (err) {
    if (err instanceof RangeError) {
      return {
        ok: false,
        botUserId,
        mentions: [],
        channelsSearched: 0,
        truncated: false,
        error: err.message,
        tokenMask,
      };
    }
    throw err;
  }
  const cursorTs = opts.unread ? cursor?.lastSeenTs : undefined;
  if (cursorTs && tsGreater(cursorTs, oldest)) {
    oldest = cursorTs;
  }

  // 3) List channels the bot is a member of.
  const channels: Array<{ id: string; name?: string }> = [];
  let listCursor: string | undefined;
  const MAX_LIST_PAGES = 10;
  try {
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const resp = await client.conversations.list({
        cursor: listCursor,
        limit: 1000,
        types: "public_channel,private_channel",
        exclude_archived: true,
      });
      if (resp.ok === false) {
        return {
          ok: false,
          botUserId,
          mentions: [],
          channelsSearched: 0,
          truncated: false,
          error: resp.error ?? "conversations_list_failed",
          tokenMask,
        };
      }
      for (const ch of resp.channels ?? []) {
        if (!ch.id) continue;
        // `is_member` is omitted on some legacy responses; fall back to
        // attempting the read and letting Slack reject with `not_in_channel`.
        // On modern Slack it's reliable.
        if (ch.is_member === false) continue;
        channels.push({ id: ch.id, name: ch.name });
      }
      listCursor = resp.response_metadata?.next_cursor;
      if (!listCursor) break;
    }
  } catch (err) {
    const retryAfter = readRetryAfter(err);
    if (retryAfter !== undefined) {
      return {
        ok: false,
        botUserId,
        mentions: [],
        channelsSearched: 0,
        truncated: false,
        error: "ratelimited",
        retryAfter,
        tokenMask,
      };
    }
    throw err;
  }

  if (channels.length === 0) {
    return {
      ok: true,
      botUserId,
      mentions: [],
      channelsSearched: 0,
      truncated: false,
      cursorTs,
      tokenMask,
    };
  }

  // 4) For each channel, walk history pages, filter for mentions.
  const collected: InboxMention[] = [];
  let truncated = false;
  const HISTORY_PAGE_SIZE = 200;
  const MAX_HISTORY_PAGES = 5; // safety cap per channel under --since

  for (const ch of channels) {
    let histCursor: string | undefined;
    for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
      let resp;
      try {
        resp = await client.conversations.history({
          channel: ch.id,
          cursor: histCursor,
          limit: HISTORY_PAGE_SIZE,
          oldest,
        });
      } catch (err) {
        const retryAfter = readRetryAfter(err);
        if (retryAfter !== undefined) {
          return {
            ok: false,
            botUserId,
            mentions: collected,
            channelsSearched: channels.length,
            truncated,
            error: "ratelimited",
            retryAfter,
            cursorTs,
            tokenMask,
          };
        }
        throw err;
      }

      if (resp.ok === false) {
        // Per-channel error (e.g. `not_in_channel` due to stale `is_member`):
        // skip this channel, don't fail the whole inbox.
        if (resp.error === "not_in_channel") break;
        return {
          ok: false,
          botUserId,
          mentions: collected,
          channelsSearched: channels.length,
          truncated,
          error: resp.error ?? "conversations_history_failed",
          cursorTs,
          tokenMask,
        };
      }

      for (const m of resp.messages ?? []) {
        if (!m.ts || !m.text) continue;
        if (!messageMentionsBot(m.text, botUserId)) continue;
        if (cursorTs && !tsGreater(m.ts, cursorTs)) continue;
        collected.push({
          channelId: ch.id,
          channelName: ch.name,
          ts: m.ts,
          user: m.user,
          text: m.text,
          threadTs: m.thread_ts,
          replyCount: m.reply_count,
        });
      }

      histCursor = resp.response_metadata?.next_cursor;
      if (!histCursor || !resp.has_more) break;
      if (page === MAX_HISTORY_PAGES - 1) {
        truncated = true;
      }
    }
  }

  // 5) Sort newest-first across all channels.
  collected.sort((a, b) => Number.parseFloat(b.ts) - Number.parseFloat(a.ts));

  // 6) Compute next cursor — newest mention's ts, if any.
  const nextCursorTs = collected[0]?.ts ?? cursorTs;

  return {
    ok: true,
    botUserId,
    mentions: collected,
    channelsSearched: channels.length,
    truncated,
    cursorTs: nextCursorTs,
    tokenMask,
  };
}

/** Format the human-readable output (stderr). */
export function formatInboxHuman(result: InboxResult): string {
  if (!result.ok) {
    if (result.error === "ratelimited") {
      return [
        `UseGin-Slack inbox RATE-LIMITED — retry in ~${result.retryAfter ?? "?"}s`,
        `  token: ${result.tokenMask}`,
        `  hint:  Slack throttles non-Marketplace apps; back off and retry.`,
      ].join("\n");
    }
    return [
      `UseGin-Slack inbox FAILED — ${result.error ?? "unknown error"}`,
      `  token: ${result.tokenMask}`,
      `  hint:  check scopes (channels:history, groups:history, app_mentions:read) and bot membership.`,
    ].join("\n");
  }

  const count = result.mentions.length;
  const header = [
    `UseGin-Slack inbox OK — ${count} mention${count === 1 ? "" : "s"}` +
      (result.botUserId ? ` for <@${result.botUserId}>` : ""),
    `  channels searched: ${result.channelsSearched}`,
    result.truncated ? `  (truncated — some channels had more history past the safety cap)` : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  if (count === 0) {
    return header;
  }

  const body = result.mentions
    .map((m) => {
      const where = m.channelName ? `#${m.channelName}` : m.channelId;
      const head = `[${m.ts}] ${where}${m.user ? ` <${m.user}>` : ""}${m.threadTs && m.threadTs !== m.ts ? ` (thread ${m.threadTs})` : ""}${m.replyCount && m.replyCount > 0 ? ` (${m.replyCount} replies)` : ""}`;
      const text = m.text.replace(/\r?\n/g, "\n    ");
      return `${head}\n    ${text}`;
    })
    .join("\n");

  return `${header}\n${body}`;
}

/** Format the JSON output (stdout, pipe-safe). */
export function formatInboxJson(result: InboxResult): string {
  return JSON.stringify(
    {
      ok: result.ok,
      bot_user_id: result.botUserId ?? null,
      mentions: result.mentions.map((m) => ({
        channel_id: m.channelId,
        channel_name: m.channelName ?? null,
        ts: m.ts,
        user: m.user ?? null,
        text: m.text,
        thread_ts: m.threadTs ?? null,
        reply_count: m.replyCount ?? null,
      })),
      channels_searched: result.channelsSearched,
      truncated: result.truncated,
      error: result.error ?? null,
      retry_after: result.retryAfter ?? null,
      cursor_ts: result.cursorTs ?? null,
      token: result.tokenMask,
    },
    null,
    2,
  );
}
