/**
 * Thin wrapper around `@slack/web-api`'s `WebClient`.
 *
 * Centralizes construction so individual commands don't repeat the
 * `new WebClient(token)` + error-handling boilerplate. Kept tiny on
 * purpose — `whoami` is the only consumer at slice 1; later slices
 * (`send`, `read`, `inbox`) will reuse this.
 *
 * Part of: ENG-5408
 */

import type { WebClient } from "@slack/web-api";
import { loadSlackConfig, type SlackConfig } from "./config";

export interface SlackClientHandle {
  client: WebClient;
  config: SlackConfig;
}

/**
 * Build a Slack `WebClient` from environment-loaded config.
 *
 * Allow injecting a `SlackConfig` for testing — production callers pass
 * nothing and rely on `loadSlackConfig()`.
 *
 * Async so the heavy `@slack/web-api` module is only loaded when a slack
 * subcommand actually runs (keeps the dx CLI startup — incl. the Stop hook
 * that calls `dx his hook-stop` — free of the SDK).
 */
export async function buildSlackClient(
  config?: SlackConfig,
): Promise<SlackClientHandle> {
  const cfg = config ?? loadSlackConfig();
  const { WebClient } = await import("@slack/web-api");
  const client = new WebClient(cfg.botToken);
  return { client, config: cfg };
}
