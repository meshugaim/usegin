/**
 * Unit tests for `dx slack` channel resolution.
 *
 * Part of: ENG-5412
 */

import { describe, expect, it } from "bun:test";
import {
  ChannelResolutionError,
  resolveChannel,
  type SlackResolverClient,
} from "./channel";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

function fakeClient(
  pages: Array<{
    channels: Array<{ id: string; name: string }>;
    next?: string;
  }>,
  onCall?: (args: { cursor?: string }) => void,
): SlackResolverClient {
  let i = 0;
  return {
    conversations: {
      async list(args) {
        onCall?.(args);
        const page = pages[i] ?? { channels: [] };
        i += 1;
        return {
          ok: true,
          channels: page.channels,
          response_metadata: page.next ? { next_cursor: page.next } : {},
        };
      },
    },
  };
}

describe("resolveChannel", () => {
  it("passes raw Cxxx ids through without an API call", async () => {
    let called = false;
    const client = fakeClient([], () => {
      called = true;
    });
    const id = await resolveChannel(client, "C0123ABCDE", config);
    expect(id).toBe("C0123ABCDE");
    expect(called).toBe(false);
  });

  it("passes raw Gxxx (private) ids through", async () => {
    const client = fakeClient([]);
    expect(await resolveChannel(client, "GPRIVATE99", config)).toBe(
      "GPRIVATE99",
    );
  });

  it("resolves #name via conversations.list", async () => {
    const client = fakeClient([
      {
        channels: [
          { id: "C111", name: "general" },
          { id: "C222", name: "engineering" },
        ],
      },
    ]);
    expect(await resolveChannel(client, "#engineering", config)).toBe("C222");
  });

  it("resolves bare name (no #) via conversations.list", async () => {
    const client = fakeClient([
      { channels: [{ id: "C333", name: "design" }] },
    ]);
    expect(await resolveChannel(client, "design", config)).toBe("C333");
  });

  it("paginates until found", async () => {
    const calls: Array<{ cursor?: string }> = [];
    const client = fakeClient(
      [
        { channels: [{ id: "C1", name: "alpha" }], next: "page2" },
        { channels: [{ id: "C2", name: "beta" }], next: "page3" },
        { channels: [{ id: "C3", name: "gamma" }] },
      ],
      (args) => calls.push({ cursor: args.cursor }),
    );
    expect(await resolveChannel(client, "#gamma", config)).toBe("C3");
    expect(calls.map((c) => c.cursor)).toEqual([undefined, "page2", "page3"]);
  });

  it("throws ChannelResolutionError when name is not found", async () => {
    const client = fakeClient([
      { channels: [{ id: "C111", name: "general" }] },
    ]);
    await expect(
      resolveChannel(client, "#nonexistent", config),
    ).rejects.toBeInstanceOf(ChannelResolutionError);
  });

  it("error includes a token mask, never the raw token", async () => {
    const client = fakeClient([{ channels: [] }]);
    try {
      await resolveChannel(client, "#nope", config);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ChannelResolutionError);
      const e = err as ChannelResolutionError;
      expect(e.tokenMask).toContain("xoxb");
      expect(e.tokenMask).not.toContain("1234-5678");
      expect(e.message).not.toContain("1234-5678");
    }
  });

  it("rejects empty input", async () => {
    const client = fakeClient([]);
    await expect(resolveChannel(client, "", config)).rejects.toBeInstanceOf(
      ChannelResolutionError,
    );
    await expect(resolveChannel(client, "#", config)).rejects.toBeInstanceOf(
      ChannelResolutionError,
    );
  });

  it("surfaces conversations.list errors", async () => {
    const client: SlackResolverClient = {
      conversations: {
        async list() {
          return { ok: false, error: "missing_scope" };
        },
      },
    };
    await expect(
      resolveChannel(client, "#general", config),
    ).rejects.toThrow(/missing_scope/);
  });
});
