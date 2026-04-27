/**
 * Unit tests for `dx slack send` pure functions.
 *
 * Mocks the `WebClient` via the structural `SlackSendClient` surface so we
 * exercise the resolution + post flow without the SDK in the loop.
 *
 * Part of: ENG-5412
 */

import { describe, expect, it } from "bun:test";
import {
  formatSendHuman,
  formatSendJson,
  sendMessage,
  type SendResult,
  type SlackSendClient,
} from "./send";

const FAKE_TOKEN = "xoxb-1234-5678-AbCdEf";
const config = { botToken: FAKE_TOKEN };

interface RecordedPost {
  channel: string;
  text: string;
  thread_ts?: string;
}

function fakeClient(opts: {
  channels?: Array<{ id: string; name: string }>;
  postResponse?: {
    ok?: boolean;
    error?: string;
    channel?: string;
    ts?: string;
    message?: { text?: string; ts?: string; thread_ts?: string };
  };
}): { client: SlackSendClient; posts: RecordedPost[] } {
  const posts: RecordedPost[] = [];
  const client: SlackSendClient = {
    conversations: {
      async list() {
        return {
          ok: true,
          channels: opts.channels ?? [],
          response_metadata: {},
        };
      },
    },
    chat: {
      async postMessage(args) {
        posts.push({
          channel: args.channel,
          text: args.text,
          thread_ts: args.thread_ts,
        });
        return (
          opts.postResponse ?? {
            ok: true,
            channel: args.channel,
            ts: "1700000000.000100",
            message: { text: args.text, ts: "1700000000.000100" },
          }
        );
      },
    },
  };
  return { client, posts };
}

describe("sendMessage", () => {
  it("posts to a resolved channel and returns ts", async () => {
    const { client, posts } = fakeClient({
      channels: [{ id: "C222", name: "engineering" }],
    });
    const r = await sendMessage(client, "#engineering", "hello team", config);
    expect(r.ok).toBe(true);
    expect(r.channel).toBe("C222");
    expect(r.ts).toBe("1700000000.000100");
    expect(r.error).toBeUndefined();
    expect(posts).toEqual([{ channel: "C222", text: "hello team" }]);
  });

  it("passes thread_ts through to chat.postMessage", async () => {
    const { client, posts } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
    });
    await sendMessage(client, "#general", "reply text", config, {
      threadTs: "1699999999.111000",
    });
    expect(posts[0]?.thread_ts).toBe("1699999999.111000");
  });

  it("accepts raw Cxxx ids without channel lookup", async () => {
    const { client, posts } = fakeClient({});
    const r = await sendMessage(client, "C0123ABCDE", "ping", config);
    expect(r.ok).toBe(true);
    expect(posts[0]?.channel).toBe("C0123ABCDE");
  });

  it("returns ok=false with channel_not_found error when channel unknown", async () => {
    const { client } = fakeClient({
      channels: [{ id: "C111", name: "general" }],
    });
    // Resolution itself throws ChannelResolutionError before post — caller
    // sees a thrown error. That's the right shape: lookup failure ≠ post
    // failure.
    await expect(
      sendMessage(client, "#nonexistent", "x", config),
    ).rejects.toThrow(/channel not found/);
  });

  it("returns ok=false with Slack error code on chat.postMessage failure", async () => {
    const { client } = fakeClient({
      postResponse: { ok: false, error: "not_in_channel" },
    });
    const r = await sendMessage(client, "C0123ABCDE", "ping", config);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_in_channel");
    expect(r.tokenMask).toContain("xoxb");
    expect(r.tokenMask).not.toContain("1234-5678");
  });

  it("rejects empty messages without calling Slack", async () => {
    const { client, posts } = fakeClient({});
    const r = await sendMessage(client, "C0123ABCDE", "   ", config);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("empty_message");
    expect(posts.length).toBe(0);
  });
});

describe("formatSendHuman", () => {
  it("shows OK with channel + ts", () => {
    const r: SendResult = {
      ok: true,
      channel: "C222",
      channelInput: "#engineering",
      ts: "1700000000.000100",
      tokenMask: "xoxb…CdEf",
    };
    const out = formatSendHuman(r);
    expect(out).toContain("UseGin-Slack send OK");
    expect(out).toContain("#engineering");
    expect(out).toContain("C222");
    expect(out).toContain("1700000000.000100");
  });

  it("includes thread when threadTs differs from ts", () => {
    const r: SendResult = {
      ok: true,
      channel: "C222",
      channelInput: "#engineering",
      ts: "1700000000.000200",
      threadTs: "1699999999.111000",
      tokenMask: "xoxb…CdEf",
    };
    expect(formatSendHuman(r)).toContain("thread");
  });

  it("never leaks the raw token on failure", () => {
    const r: SendResult = {
      ok: false,
      channelInput: "#x",
      error: "not_in_channel",
      tokenMask: "xoxb…CdEf",
    };
    const out = formatSendHuman(r);
    expect(out).toContain("FAILED");
    expect(out).toContain("not_in_channel");
    expect(out).toContain("xoxb…CdEf");
    expect(out).not.toContain("1234-5678");
  });
});

describe("formatSendJson", () => {
  it("shapes JSON with channel, ts, error, token mask", () => {
    const r: SendResult = {
      ok: true,
      channel: "C222",
      channelInput: "#engineering",
      ts: "1700000000.000100",
      text: "hi",
      tokenMask: "xoxb…CdEf",
    };
    const j = JSON.parse(formatSendJson(r));
    expect(j.ok).toBe(true);
    expect(j.channel).toBe("C222");
    expect(j.channel_input).toBe("#engineering");
    expect(j.ts).toBe("1700000000.000100");
    expect(j.error).toBeNull();
    expect(j.token).toBe("xoxb…CdEf");
  });
});
