/**
 * Channel resolution for `dx slack` — accept `#name` or raw `Cxxxxx`/`Gxxxxx`
 * ID and return the canonical Slack channel id.
 *
 * Pulled out so `send` and `read` share the same resolution surface and the
 * same mock shape in tests.
 *
 * Part of: ENG-5412
 */

import { maskToken, type SlackConfig } from "./config";

/**
 * The bits of `WebClient.conversations` we need for resolution. Structural
 * subset so tests can pass a hand-rolled object instead of mocking the full
 * Slack SDK.
 */
export interface ConversationsListSlice {
  list(args: {
    cursor?: string;
    limit?: number;
    types?: string;
    exclude_archived?: boolean;
  }): Promise<{
    ok?: boolean;
    error?: string;
    channels?: Array<{ id?: string; name?: string }>;
    response_metadata?: { next_cursor?: string };
  }>;
}

export interface SlackResolverClient {
  conversations: ConversationsListSlice;
}

/** Token-aware error so callers can reach for the mask in their messages. */
export class ChannelResolutionError extends Error {
  readonly tokenMask: string;
  constructor(message: string, config: SlackConfig) {
    super(message);
    this.tokenMask = maskToken(config.botToken);
  }
}

/**
 * Resolve a channel input to a Slack channel id.
 *
 * Accepts:
 *   - `Cxxxxxxxx` / `Gxxxxxxxx`  — passed through (no API call)
 *   - `#name` / `name`            — looked up via `conversations.list`
 *
 * Slack's SDK paginates `conversations.list` via cursor. We walk all pages
 * up to a generous safety cap (10 pages × 1000 channels = 10k) before
 * giving up — that's well past any realistic team workspace.
 */
export async function resolveChannel(
  client: SlackResolverClient,
  input: string,
  config: SlackConfig,
): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ChannelResolutionError("channel name is empty", config);
  }

  // Raw IDs pass through. Slack channel ids: C = public, G = private (legacy),
  // D = DM. We allow any of those so callers can target threads in DMs too.
  if (/^[CGD][A-Z0-9]{8,}$/.test(trimmed)) {
    return trimmed;
  }

  const wanted = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!wanted) {
    throw new ChannelResolutionError("channel name is empty", config);
  }

  let cursor: string | undefined;
  const MAX_PAGES = 10;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const resp = await client.conversations.list({
      cursor,
      limit: 1000,
      types: "public_channel,private_channel",
      exclude_archived: true,
    });
    if (resp.ok === false) {
      throw new ChannelResolutionError(
        `conversations.list failed: ${resp.error ?? "unknown error"}`,
        config,
      );
    }
    for (const ch of resp.channels ?? []) {
      if (ch.name === wanted && ch.id) return ch.id;
    }
    cursor = resp.response_metadata?.next_cursor;
    if (!cursor) break;
  }

  throw new ChannelResolutionError(
    `channel not found: #${wanted} (bot may not be invited, or name is wrong)`,
    config,
  );
}
