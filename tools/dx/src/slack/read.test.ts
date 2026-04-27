/**
 * Unit tests for `dx slack read` pure functions — pagination, --since
 * parsing, and 429 rate-limit handling.
 *
 * Part of: ENG-5412
 */

import { describe, expect, it } from "bun:test";
import {
  formatReadHuman,
  formatReadJson,
  parseSince,
  readMessages,
  type ReadResult,
  type SlackReadClient,
} from "./read";

const FAKE_TOKEN = "xoxb-1234-5678-AbCdEf";
const config = { botToken: FAKE_TOKEN };

interface HistoryCall {
  channel: string;
  cursor?: string;
  limit?: number;
  oldest?: string;
}

function fakeClient(opts: {
  channels?: Array<{ id: string; name: string }>;
  pages?: Array<{
    messages: Array<{
      ts: string;
      user?: string;
      text?: string;
      thread_ts?: string;
      reply_count?: number;
    }>;
    has_more?: boolean;
    next?: string;
  }>;
  historyError?: unknown;
  historyResp?: { ok: boolean; error?: string };
}): { client: SlackReadClient; calls: HistoryCall[] } {
  const calls: HistoryCall[] = [];
  let i = 0;
  const client: SlackReadClient = {
    conversations: {
      async list() {
        return {
          ok: true,
          channels: opts.channels ?? [],
          response_metadata: {},
        };
      },
      async history(args) {
        calls.push({
          channel: args.channel,
          cursor: args.cursor,
          limit: args.limit,
          oldest: args.oldest,
        });
        if (opts.historyError) throw opts.historyError;
        if (opts.historyResp) return opts.historyResp;
        const page = opts.pages?.[i] ?? { messages: [] };
        i += 1;
        return {
          ok: true,
          messages: page.messages,
          has_more: page.has_more ?? false,
          response_metadata: page.next ? { next_cursor: page.next } : {},
        };
      },
    },
  };
  return { client, calls };
}

describe("parseSince", () => {
  const now = new Date("2026-04-27T12:00:00Z");

  it("parses 1h", () => {
    const oldest = parseSince("1h", now);
    expect(Number.parseInt(oldest, 10)).toBe(
      Math.floor(now.getTime() / 1000) - 3600,
    );
  });

  it("parses 1d", () => {
    const oldest = parseSince("1d", now);
    expect(Number.parseInt(oldest, 10)).toBe(
      Math.floor(now.getTime() / 1000) - 86_400,
    );
  });

  it("parses 7d", () => {
    const oldest = parseSince("7d", now);
    expect(Number.parseInt(oldest, 10)).toBe(
      Math.floor(now.getTime() / 1000) - 7 * 86_400,
    );
  });

  it("parses 2w", () => {
    const oldest = parseSince("2w", now);
    expect(Number.parseInt(oldest, 10)).toBe(
      Math.floor(now.getTime() / 1000) - 14 * 86_400,
    );
  });

  it("rejects garbage with a clear message", () => {
    expect(() => parseSince("yesterday")).toThrow(/--since/);
    expect(() => parseSince("0d")).toThrow(/positive/);
    expect(() => parseSince("1y")).toThrow(/--since/);
  });
});

describe("readMessages", () => {
  it("reads a single page when limit is satisfied", async () => {
    const { client, calls } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      pages: [
        {
          messages: [
            { ts: "1700000003.000000", user: "U1", text: "third" },
            { ts: "1700000002.000000", user: "U2", text: "second" },
            { ts: "1700000001.000000", user: "U1", text: "first" },
          ],
        },
      ],
    });
    const r = await readMessages(client, "#general", config, { limit: 50 });
    expect(r.ok).toBe(true);
    expect(r.channel).toBe("C111");
    expect(r.messages.length).toBe(3);
    expect(r.messages.map((m) => m.text)).toEqual(["third", "second", "first"]);
    expect(r.truncated).toBe(false);
    expect(calls.length).toBe(1);
  });

  it("paginates until --limit is reached and reports truncated=true when more remain", async () => {
    const { client, calls } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      pages: [
        {
          messages: Array.from({ length: 3 }, (_, i) => ({
            ts: `1700000${i}.000000`,
            user: "U1",
            text: `msg-a-${i}`,
          })),
          has_more: true,
          next: "cur1",
        },
        {
          messages: Array.from({ length: 3 }, (_, i) => ({
            ts: `1700001${i}.000000`,
            user: "U1",
            text: `msg-b-${i}`,
          })),
          has_more: true,
          next: "cur2",
        },
      ],
    });
    const r = await readMessages(client, "#general", config, { limit: 5 });
    expect(r.ok).toBe(true);
    expect(r.messages.length).toBe(5);
    expect(r.truncated).toBe(true);
    // Two history calls — first returned 3, second returned 3 (we kept 2).
    expect(calls.length).toBe(2);
    expect(calls[1]?.cursor).toBe("cur1");
  });

  it("forwards --since as oldest unix-seconds", async () => {
    const fixedNow = new Date("2026-04-27T12:00:00Z");
    const { client, calls } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      pages: [{ messages: [] }],
    });
    await readMessages(
      client,
      "#general",
      config,
      { since: "1d" },
      fixedNow,
    );
    expect(calls[0]?.oldest).toBe(
      String(Math.floor(fixedNow.getTime() / 1000) - 86_400),
    );
  });

  it("returns ok=false with retry-after on Slack rate-limit error", async () => {
    const rlErr = Object.assign(new Error("rate limited"), {
      code: "slack_webapi_rate_limited_error",
      retryAfter: 30,
    });
    const { client } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      historyError: rlErr,
    });
    const r = await readMessages(client, "#general", config, { limit: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ratelimited");
    expect(r.retryAfter).toBe(30);
    expect(r.tokenMask).toContain("xoxb");
    expect(r.tokenMask).not.toContain("1234-5678");
  });

  it("returns ok=false with platform error code on Slack-reported failure", async () => {
    const { client } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      historyResp: { ok: false, error: "channel_not_found" },
    });
    const r = await readMessages(client, "#general", config, { limit: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("channel_not_found");
  });

  it("clamps absurd --limit values to a sane ceiling", async () => {
    const { client, calls } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
      pages: [{ messages: [] }],
    });
    await readMessages(client, "#general", config, { limit: 999_999 });
    // 1000 is the ceiling we clamp to; PAGE_SIZE is min(limit, 200) → 200.
    expect((calls[0]?.limit ?? 0)).toBeLessThanOrEqual(200);
  });
});

describe("formatReadHuman", () => {
  it("renders a header + per-message lines", () => {
    const r: ReadResult = {
      ok: true,
      channel: "C111",
      channelInput: "#general",
      messages: [
        {
          ts: "1700000002.000000",
          user: "U1",
          text: "second message",
        },
        {
          ts: "1700000001.000000",
          user: "U2",
          text: "first message\nwith a newline",
        },
      ],
      truncated: false,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatReadHuman(r);
    expect(out).toContain("UseGin-Slack read OK");
    expect(out).toContain("2 messages");
    expect(out).toContain("#general");
    expect(out).toContain("U1");
    expect(out).toContain("second message");
    expect(out).toContain("first message");
  });

  it("flags rate-limited results with retryAfter", () => {
    const r: ReadResult = {
      ok: false,
      channelInput: "#general",
      messages: [],
      truncated: false,
      error: "ratelimited",
      retryAfter: 42,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatReadHuman(r);
    expect(out).toContain("RATE-LIMITED");
    expect(out).toContain("42");
  });

  it("notes truncation when more messages remained", () => {
    const r: ReadResult = {
      ok: true,
      channel: "C111",
      channelInput: "#general",
      messages: [{ ts: "1.0", text: "x" }],
      truncated: true,
      tokenMask: "xoxb…CdEf",
    };
    expect(formatReadHuman(r)).toContain("truncated");
  });

  it("never leaks the raw token", () => {
    const r: ReadResult = {
      ok: false,
      channelInput: "#x",
      messages: [],
      truncated: false,
      error: "channel_not_found",
      tokenMask: "xoxb…CdEf",
    };
    const out = formatReadHuman(r);
    expect(out).not.toContain("1234-5678");
  });

  it("annotates messages with referenced ENG-ids on the header line (D5)", () => {
    const r: ReadResult = {
      ok: true,
      channel: "C111",
      channelInput: "#engineering",
      messages: [
        {
          ts: "1700000001.000000",
          user: "U1",
          text: "see ENG-5399 + ENG-5413 for context",
        },
        {
          ts: "1700000002.000000",
          user: "U2",
          text: "no refs here",
        },
      ],
      truncated: false,
      tokenMask: "xoxb…CdEf",
    };
    const out = formatReadHuman(r);
    expect(out).toContain("(refs: ENG-5399, ENG-5413)");
    // Second message has no refs annotation
    const lines = out.split("\n");
    const line2 = lines.find((l) => l.includes("1700000002.000000")) ?? "";
    expect(line2).not.toContain("(refs:");
  });
});

describe("formatReadJson", () => {
  it("shapes the JSON with messages, truncated, retry_after, token", () => {
    const r: ReadResult = {
      ok: true,
      channel: "C111",
      channelInput: "#general",
      messages: [
        {
          ts: "1700000001.000000",
          user: "U1",
          text: "hello",
          threadTs: "1699999999.111000",
          replyCount: 2,
        },
      ],
      truncated: true,
      tokenMask: "xoxb…CdEf",
    };
    const j = JSON.parse(formatReadJson(r));
    expect(j.ok).toBe(true);
    expect(j.channel).toBe("C111");
    expect(j.messages).toEqual([
      {
        ts: "1700000001.000000",
        user: "U1",
        text: "hello",
        thread_ts: "1699999999.111000",
        reply_count: 2,
        subtype: null,
      },
    ]);
    expect(j.truncated).toBe(true);
    expect(j.token).toBe("xoxb…CdEf");
  });
});
