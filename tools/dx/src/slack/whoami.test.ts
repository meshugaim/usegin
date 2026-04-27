/**
 * Unit tests for `dx slack whoami` pure functions.
 *
 * Tests the parsing of `auth.test` response + scopes-from-headers, and
 * the human/JSON formatters. The actual Slack call is mocked via a
 * fetch stub.
 *
 * Part of: ENG-5408
 */

import { describe, expect, it } from "bun:test";
import {
  fetchWhoami,
  formatWhoamiHuman,
  formatWhoamiJson,
  type WhoamiResult,
} from "./whoami";

const FAKE_TOKEN = "xoxb-1234-5678-AbCdEf";
const config = { botToken: FAKE_TOKEN };

function fakeFetchOk(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        url: "https://askeffi.slack.com/",
        team: "AskEffi",
        user: "usegin",
        team_id: "T12345",
        user_id: "U98765",
        app_id: "A55555",
      }),
      {
        status: 200,
        headers: {
          "x-oauth-scopes":
            "chat:write, channels:read, channels:history, app_mentions:read",
        },
      },
    )) as unknown as typeof fetch;
}

function fakeFetchInvalidAuth(): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), {
      status: 200,
      headers: { "x-oauth-scopes": "" },
    })) as unknown as typeof fetch;
}

describe("fetchWhoami", () => {
  it("parses auth.test body + scopes header on success", async () => {
    const result = await fetchWhoami(config, fakeFetchOk());
    expect(result.ok).toBe(true);
    expect(result.team).toBe("AskEffi");
    expect(result.teamId).toBe("T12345");
    expect(result.botUser).toBe("usegin");
    expect(result.botUserId).toBe("U98765");
    expect(result.appId).toBe("A55555");
    expect(result.url).toBe("https://askeffi.slack.com/");
    expect(result.scopes).toEqual([
      "chat:write",
      "channels:read",
      "channels:history",
      "app_mentions:read",
    ]);
    expect(result.error).toBeUndefined();
    // tokenMask never includes the secret middle.
    expect(result.tokenMask).not.toContain("1234-5678");
    expect(result.tokenMask).toContain("xoxb");
  });

  it("returns ok=false with error on invalid_auth", async () => {
    const result = await fetchWhoami(config, fakeFetchInvalidAuth());
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_auth");
    expect(result.scopes).toEqual([]);
  });

  it("throws on non-2xx HTTP", async () => {
    const fetchImpl = (async () =>
      new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" })) as unknown as typeof fetch;
    await expect(fetchWhoami(config, fetchImpl)).rejects.toThrow(/502/);
  });

  it("sends Authorization: Bearer with the token", async () => {
    let captured: { url?: string; auth?: string } = {};
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      captured = {
        url,
        auth: (init?.headers as Record<string, string>)?.Authorization,
      };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {},
      });
    }) as unknown as typeof fetch;
    await fetchWhoami(config, fetchImpl);
    expect(captured.url).toBe("https://slack.com/api/auth.test");
    expect(captured.auth).toBe(`Bearer ${FAKE_TOKEN}`);
  });
});

describe("formatWhoamiHuman", () => {
  const ok: WhoamiResult = {
    ok: true,
    team: "AskEffi",
    teamId: "T12345",
    botUser: "usegin",
    botUserId: "U98765",
    appId: "A55555",
    url: "https://askeffi.slack.com/",
    scopes: ["chat:write", "channels:read"],
    tokenMask: "xoxb…CdEf",
  };

  it("includes workspace, bot, app id, scopes", () => {
    const out = formatWhoamiHuman(ok);
    expect(out).toContain("UseGin-Slack OK");
    expect(out).toContain("AskEffi");
    expect(out).toContain("T12345");
    expect(out).toContain("usegin");
    expect(out).toContain("U98765");
    expect(out).toContain("A55555");
    expect(out).toContain("chat:write, channels:read");
  });

  it("never leaks the raw token", () => {
    const out = formatWhoamiHuman(ok);
    expect(out).not.toContain("1234-5678");
    expect(out).toContain("xoxb…CdEf");
  });

  it("flags failure clearly when ok=false", () => {
    const fail: WhoamiResult = {
      ok: false,
      scopes: [],
      error: "invalid_auth",
      tokenMask: "xoxb…CdEf",
    };
    const out = formatWhoamiHuman(fail);
    expect(out).toContain("FAILED");
    expect(out).toContain("invalid_auth");
    expect(out).toContain("USEGIN_SLACK_BOT_TOKEN");
  });

  it("notes when scopes header was empty", () => {
    const noScopes: WhoamiResult = { ...ok, scopes: [] };
    const out = formatWhoamiHuman(noScopes);
    expect(out).toContain("(none reported");
  });
});

describe("formatWhoamiJson", () => {
  it("shapes JSON with workspace, bot, app_id, scopes, token mask", () => {
    const result: WhoamiResult = {
      ok: true,
      team: "AskEffi",
      teamId: "T12345",
      botUser: "usegin",
      botUserId: "U98765",
      appId: "A55555",
      url: "https://askeffi.slack.com/",
      scopes: ["chat:write"],
      tokenMask: "xoxb…CdEf",
    };
    const out = JSON.parse(formatWhoamiJson(result));
    expect(out.ok).toBe(true);
    expect(out.workspace).toEqual({
      name: "AskEffi",
      id: "T12345",
      url: "https://askeffi.slack.com/",
    });
    expect(out.bot).toEqual({ user: "usegin", user_id: "U98765" });
    expect(out.app_id).toBe("A55555");
    expect(out.scopes).toEqual(["chat:write"]);
    expect(out.error).toBeNull();
    expect(out.token).toBe("xoxb…CdEf");
  });
});
