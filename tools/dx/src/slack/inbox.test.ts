/**
 * Unit tests for `dx slack inbox` pure functions — bot-id resolution,
 * multi-channel aggregation, mention filtering, --unread cursor behavior,
 * no-channels case, and rate-limit handler reuse.
 *
 * Part of: ENG-5415
 */

import { describe, expect, it } from "bun:test";
import {
  fetchInbox,
  formatInboxHuman,
  formatInboxJson,
  messageMentionsBot,
  type InboxResult,
  type SlackInboxClient,
} from "./inbox";

const FAKE_TOKEN = "xoxb-1234-5678-AbCdEf";
const config = { botToken: FAKE_TOKEN };
const FIXED_NOW = new Date("2026-04-27T12:00:00Z");

interface ChannelFixture {
  id: string;
  name?: string;
  is_member?: boolean;
}

interface HistoryFixture {
  messages: Array<{
    ts: string;
    user?: string;
    text?: string;
    thread_ts?: string;
    reply_count?: number;
  }>;
  has_more?: boolean;
  next?: string;
  ok?: boolean;
  error?: string;
}

interface FakeOpts {
  authResp?: { ok?: boolean; user_id?: string; error?: string };
  authThrow?: unknown;
  channels?: ChannelFixture[];
  channelsListResp?: { ok: boolean; error?: string };
  channelsListThrow?: unknown;
  /** Map channel-id → ordered list of pages returned by `history()`. */
  history?: Record<string, HistoryFixture[]>;
  historyThrow?: unknown;
}

interface HistoryCall {
  channel: string;
  cursor?: string;
  limit?: number;
  oldest?: string;
}

function fakeClient(opts: FakeOpts): {
  client: SlackInboxClient;
  historyCalls: HistoryCall[];
} {
  const historyCalls: HistoryCall[] = [];
  const cursors: Record<string, number> = {};
  const client: SlackInboxClient = {
    auth: {
      async test() {
        if (opts.authThrow) throw opts.authThrow;
        return (
          opts.authResp ?? {
            ok: true,
            user_id: "UBOT",
            user: "usegin",
          }
        );
      },
    },
    conversations: {
      async list() {
        if (opts.channelsListThrow) throw opts.channelsListThrow;
        if (opts.channelsListResp) {
          return {
            ...opts.channelsListResp,
            channels: opts.channels ?? [],
          };
        }
        return {
          ok: true,
          channels: opts.channels ?? [],
          response_metadata: {},
        };
      },
      async history(args) {
        historyCalls.push({
          channel: args.channel,
          cursor: args.cursor,
          limit: args.limit,
          oldest: args.oldest,
        });
        if (opts.historyThrow) throw opts.historyThrow;
        const pages = opts.history?.[args.channel] ?? [];
        const i = cursors[args.channel] ?? 0;
        cursors[args.channel] = i + 1;
        const page = pages[i] ?? { messages: [] };
        if (page.ok === false) {
          return { ok: false, error: page.error ?? "history_failed" };
        }
        return {
          ok: true,
          messages: page.messages,
          has_more: page.has_more ?? false,
          response_metadata: page.next ? { next_cursor: page.next } : {},
        };
      },
    },
  };
  return { client, historyCalls };
}

describe("messageMentionsBot", () => {
  it("matches the literal <@UID> mention token", () => {
    expect(messageMentionsBot("hi <@UBOT> can you", "UBOT")).toBe(true);
  });
  it("rejects non-mention text even when the id appears as a substring", () => {
    expect(messageMentionsBot("UBOT was here", "UBOT")).toBe(false);
  });
  it("does not match a different bot's mention", () => {
    expect(messageMentionsBot("hi <@UOTHER> hello", "UBOT")).toBe(false);
  });
});

describe("fetchInbox — bot-id resolution", () => {
  it("resolves the bot user id via auth.test", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [],
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(true);
    expect(r.botUserId).toBe("UBOT");
  });

  it("returns ok=false when auth.test reports failure", async () => {
    const { client } = fakeClient({
      authResp: { ok: false, error: "invalid_auth" },
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_auth");
    expect(r.tokenMask).toContain("xoxb");
    expect(r.tokenMask).not.toContain("1234-5678");
  });

  it("surfaces rate-limit on auth.test as ok=false ratelimited", async () => {
    const rlErr = Object.assign(new Error("rl"), {
      code: "slack_webapi_rate_limited_error",
      retryAfter: 17,
    });
    const { client } = fakeClient({ authThrow: rlErr });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ratelimited");
    expect(r.retryAfter).toBe(17);
  });
});

describe("fetchInbox — multi-channel aggregation + mention filter", () => {
  it("aggregates @usegin mentions across joined channels and sorts newest-first", async () => {
    const { client, historyCalls } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [
        { id: "C1", name: "engineering", is_member: true },
        { id: "C2", name: "design", is_member: true },
      ],
      history: {
        C1: [
          {
            messages: [
              { ts: "1700000300.000000", user: "U1", text: "hey <@UBOT> ping" },
              { ts: "1700000200.000000", user: "U2", text: "no mention here" },
              { ts: "1700000100.000000", user: "U1", text: "<@UBOT> earlier" },
            ],
          },
        ],
        C2: [
          {
            messages: [
              { ts: "1700000250.000000", user: "U3", text: "<@UBOT> from design" },
              { ts: "1700000050.000000", user: "U3", text: "<@UOTHER> not us" },
            ],
          },
        ],
      },
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(true);
    expect(r.channelsSearched).toBe(2);
    expect(r.mentions.map((m) => m.ts)).toEqual([
      "1700000300.000000",
      "1700000250.000000",
      "1700000100.000000",
    ]);
    expect(r.mentions[0]?.channelName).toBe("engineering");
    expect(r.mentions[1]?.channelName).toBe("design");
    // history was called once per channel.
    expect(historyCalls.length).toBe(2);
    expect(historyCalls.map((c) => c.channel).sort()).toEqual(["C1", "C2"]);
  });

  it("skips channels where the bot is not a member", async () => {
    const { client, historyCalls } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [
        { id: "C1", name: "in", is_member: true },
        { id: "C2", name: "out", is_member: false },
      ],
      history: {
        C1: [{ messages: [{ ts: "1.0", text: "<@UBOT>" }] }],
        C2: [{ messages: [{ ts: "2.0", text: "<@UBOT>" }] }],
      },
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.channelsSearched).toBe(1);
    expect(r.mentions.length).toBe(1);
    expect(historyCalls.length).toBe(1);
    expect(historyCalls[0]?.channel).toBe("C1");
  });

  it("forwards the parsed --since as oldest unix-seconds", async () => {
    const { client, historyCalls } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "c", is_member: true }],
      history: { C1: [{ messages: [] }] },
    });
    await fetchInbox(client, config, { since: "2d" }, undefined, FIXED_NOW);
    const expected = String(
      Math.floor(FIXED_NOW.getTime() / 1000) - 2 * 86_400,
    );
    expect(historyCalls[0]?.oldest).toBe(expected);
  });

  it("uses the default 1d window when --since is absent", async () => {
    const { client, historyCalls } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "c", is_member: true }],
      history: { C1: [{ messages: [] }] },
    });
    await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    const expected = String(Math.floor(FIXED_NOW.getTime() / 1000) - 86_400);
    expect(historyCalls[0]?.oldest).toBe(expected);
  });

  it("skips per-channel not_in_channel without failing the whole inbox", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [
        { id: "C1", name: "ok", is_member: true },
        { id: "C2", name: "stale", is_member: true },
      ],
      history: {
        C1: [{ messages: [{ ts: "1.0", user: "U1", text: "<@UBOT> hi" }] }],
        C2: [{ messages: [], ok: false, error: "not_in_channel" }],
      },
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(true);
    expect(r.mentions.length).toBe(1);
    expect(r.mentions[0]?.channelId).toBe("C1");
  });
});

describe("fetchInbox — --unread cursor", () => {
  it("filters to mentions strictly newer than the cursor", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "x", is_member: true }],
      history: {
        C1: [
          {
            messages: [
              { ts: "1700000300.000000", text: "<@UBOT> new" },
              { ts: "1700000200.000000", text: "<@UBOT> seen" },
              { ts: "1700000100.000000", text: "<@UBOT> older" },
            ],
          },
        ],
      },
    });
    const r = await fetchInbox(
      client,
      config,
      { unread: true },
      { lastSeenTs: "1700000200.000000" },
      FIXED_NOW,
    );
    expect(r.mentions.map((m) => m.ts)).toEqual(["1700000300.000000"]);
    expect(r.cursorTs).toBe("1700000300.000000");
  });

  it("retains the prior cursor when no new mentions are found", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "x", is_member: true }],
      history: { C1: [{ messages: [] }] },
    });
    const r = await fetchInbox(
      client,
      config,
      { unread: true },
      { lastSeenTs: "1700000200.000000" },
      FIXED_NOW,
    );
    expect(r.mentions.length).toBe(0);
    expect(r.cursorTs).toBe("1700000200.000000");
  });

  it("ignores the cursor when --unread is not set", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "x", is_member: true }],
      history: {
        C1: [
          {
            messages: [
              { ts: "1700000300.000000", text: "<@UBOT> new" },
              { ts: "1700000100.000000", text: "<@UBOT> old" },
            ],
          },
        ],
      },
    });
    const r = await fetchInbox(
      client,
      config,
      {},
      { lastSeenTs: "1700000200.000000" },
      FIXED_NOW,
    );
    expect(r.mentions.length).toBe(2);
  });
});

describe("fetchInbox — edge cases", () => {
  it("returns ok=true with empty mentions when bot is in zero channels", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [],
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(true);
    expect(r.channelsSearched).toBe(0);
    expect(r.mentions).toEqual([]);
  });

  it("propagates rate-limit from conversations.history with retryAfter", async () => {
    const rlErr = Object.assign(new Error("rl"), {
      code: "slack_webapi_rate_limited_error",
      retryAfter: 23,
    });
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [{ id: "C1", name: "x", is_member: true }],
      historyThrow: rlErr,
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ratelimited");
    expect(r.retryAfter).toBe(23);
  });

  it("returns ok=false with parsed range error when --since is garbage", async () => {
    const { client } = fakeClient({
      authResp: { ok: true, user_id: "UBOT" },
      channels: [],
    });
    const r = await fetchInbox(
      client,
      config,
      { since: "yesterday" },
      undefined,
      FIXED_NOW,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/--since/);
  });

  it("masks the bot token in every error path", async () => {
    const { client } = fakeClient({
      authResp: { ok: false, error: "invalid_auth" },
    });
    const r = await fetchInbox(client, config, {}, undefined, FIXED_NOW);
    expect(r.tokenMask).toContain("xoxb");
    expect(r.tokenMask).not.toContain("1234-5678");
  });
});

describe("formatInboxHuman", () => {
  it("renders header + per-mention lines", () => {
    const r: InboxResult = {
      ok: true,
      botUserId: "UBOT",
      mentions: [
        {
          channelId: "C1",
          channelName: "engineering",
          ts: "1700000300.000000",
          user: "U1",
          text: "hey <@UBOT> ping",
        },
      ],
      channelsSearched: 1,
      truncated: false,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatInboxHuman(r);
    expect(out).toContain("UseGin-Slack inbox OK");
    expect(out).toContain("1 mention");
    expect(out).toContain("#engineering");
    expect(out).toContain("hey <@UBOT> ping");
  });

  it("renders the empty-inbox case as the header alone", () => {
    const r: InboxResult = {
      ok: true,
      botUserId: "UBOT",
      mentions: [],
      channelsSearched: 3,
      truncated: false,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatInboxHuman(r);
    expect(out).toContain("0 mentions");
    expect(out).toContain("channels searched: 3");
  });

  it("flags rate-limited results with retryAfter", () => {
    const r: InboxResult = {
      ok: false,
      mentions: [],
      channelsSearched: 0,
      truncated: false,
      error: "ratelimited",
      retryAfter: 42,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatInboxHuman(r);
    expect(out).toContain("RATE-LIMITED");
    expect(out).toContain("42");
  });

  it("never leaks the raw token", () => {
    const r: InboxResult = {
      ok: false,
      mentions: [],
      channelsSearched: 0,
      truncated: false,
      error: "invalid_auth",
      tokenMask: "xoxb…CdEf",
    };
    expect(formatInboxHuman(r)).not.toContain("1234-5678");
  });
});

describe("formatInboxJson", () => {
  it("shapes the JSON with mentions, cursor, channels_searched", () => {
    const r: InboxResult = {
      ok: true,
      botUserId: "UBOT",
      mentions: [
        {
          channelId: "C1",
          channelName: "engineering",
          ts: "1700000300.000000",
          user: "U1",
          text: "<@UBOT> ping",
          threadTs: "1700000299.111000",
          replyCount: 1,
        },
      ],
      channelsSearched: 1,
      truncated: false,
      cursorTs: "1700000300.000000",
      tokenMask: "xoxb…CdEf",
    };
    const j = JSON.parse(formatInboxJson(r));
    expect(j.ok).toBe(true);
    expect(j.bot_user_id).toBe("UBOT");
    expect(j.mentions).toEqual([
      {
        channel_id: "C1",
        channel_name: "engineering",
        ts: "1700000300.000000",
        user: "U1",
        text: "<@UBOT> ping",
        thread_ts: "1700000299.111000",
        reply_count: 1,
      },
    ]);
    expect(j.channels_searched).toBe(1);
    expect(j.cursor_ts).toBe("1700000300.000000");
    expect(j.token).toBe("xoxb…CdEf");
  });
});
