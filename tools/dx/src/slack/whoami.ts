/**
 * Pure functions for `dx slack whoami`.
 *
 * Calls Slack's `auth.test` to surface bot identity (workspace, bot user
 * id, app id) plus the granted scopes (read off the `x-oauth-scopes`
 * response header — `auth.test` doesn't return scopes in the JSON body).
 *
 * Raw fetch on purpose: scopes live in headers, and the `@slack/web-api`
 * `WebClient` doesn't expose response headers per-call cleanly. Slice 1
 * only needs `auth.test` — the WebClient will earn its keep on `send`,
 * `read`, `inbox`, `react`.
 *
 * Part of: ENG-5408
 */

import { maskToken, type SlackConfig } from "./config";

const SLACK_AUTH_TEST_URL = "https://slack.com/api/auth.test";

/**
 * The bits of `auth.test` we surface in `whoami` output.
 *
 * Mirrors Slack's response shape. All fields optional because we report
 * whatever came back without inventing values.
 */
export interface WhoamiResult {
  ok: boolean;
  /** Bot user display name (e.g. "usegin"). Slack labels this `user`. */
  botUser?: string;
  /** Bot user id (`U…`). Slack labels this `user_id`. */
  botUserId?: string;
  /** Workspace / team name (e.g. "AskEffi"). */
  team?: string;
  /** Team id (`T…`). */
  teamId?: string;
  /** App id (`A…`) — useful when there are multiple apps in one workspace. */
  appId?: string;
  /** Workspace URL (`https://askeffi.slack.com/`). */
  url?: string;
  /** Granted bot-token scopes, parsed from `x-oauth-scopes`. */
  scopes: string[];
  /** Slack error code if `ok=false` (e.g. `invalid_auth`, `not_authed`). */
  error?: string;
  /** Token mask for the human-readable line. Never includes the secret. */
  tokenMask: string;
}

/**
 * Fetch `auth.test` and parse the relevant fields.
 *
 * Throws on transport errors (network / non-2xx). Returns `ok=false`
 * with an `error` string when Slack returns `{ ok: false }`.
 */
export async function fetchWhoami(
  config: SlackConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<WhoamiResult> {
  const resp = await fetchImpl(SLACK_AUTH_TEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
  });

  if (!resp.ok) {
    throw new Error(
      `Slack auth.test HTTP ${resp.status} ${resp.statusText}`,
    );
  }

  const scopesHeader =
    resp.headers.get("x-oauth-scopes") ??
    resp.headers.get("X-OAuth-Scopes") ??
    "";
  const scopes = scopesHeader
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const body = (await resp.json()) as {
    ok?: boolean;
    user?: string;
    user_id?: string;
    team?: string;
    team_id?: string;
    app_id?: string;
    url?: string;
    error?: string;
  };

  return {
    ok: body.ok === true,
    botUser: body.user,
    botUserId: body.user_id,
    team: body.team,
    teamId: body.team_id,
    appId: body.app_id,
    url: body.url,
    scopes,
    error: body.error,
    tokenMask: maskToken(config.botToken),
  };
}

/** Format the human-readable output (goes to stderr). */
export function formatWhoamiHuman(result: WhoamiResult): string {
  if (!result.ok) {
    return [
      `UseGin-Slack auth.test FAILED — ${result.error ?? "unknown error"}`,
      `  token: ${result.tokenMask}`,
      `  hint:  check USEGIN_SLACK_BOT_TOKEN in Doppler.`,
    ].join("\n");
  }

  const lines = [
    `UseGin-Slack OK`,
    `  workspace: ${result.team ?? "?"} (${result.teamId ?? "?"})`,
    `  bot user:  ${result.botUser ?? "?"} (${result.botUserId ?? "?"})`,
    `  app id:    ${result.appId ?? "?"}`,
    `  url:       ${result.url ?? "?"}`,
    `  token:     ${result.tokenMask}`,
    `  scopes:    ${result.scopes.length > 0 ? result.scopes.join(", ") : "(none reported in x-oauth-scopes header)"}`,
  ];
  return lines.join("\n");
}

/** Format the JSON output (goes to stdout, pipe-safe). */
export function formatWhoamiJson(result: WhoamiResult): string {
  return JSON.stringify(
    {
      ok: result.ok,
      workspace: { name: result.team, id: result.teamId, url: result.url },
      bot: { user: result.botUser, user_id: result.botUserId },
      app_id: result.appId,
      scopes: result.scopes,
      error: result.error ?? null,
      token: result.tokenMask,
    },
    null,
    2,
  );
}
