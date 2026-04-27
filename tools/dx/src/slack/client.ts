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

import { WebClient } from "@slack/web-api";
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
 */
export function buildSlackClient(config?: SlackConfig): SlackClientHandle {
  const cfg = config ?? loadSlackConfig();
  const client = new WebClient(cfg.botToken);
  return { client, config: cfg };
}
