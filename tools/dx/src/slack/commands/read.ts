/**
 * `dx slack read <channel> [--since 1d] [--limit N]` — read recent messages
 * via conversations.history.
 *
 * Part of: ENG-5412
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { ChannelResolutionError } from "../channel";
import { SlackConfigError } from "../config";
import {
  formatReadHuman,
  formatReadJson,
  readMessages,
  type SlackReadClient,
} from "../read";

export function buildSlackReadCommand(): Command {
  return new Command("read")
    .description(
      'Read recent messages from a Slack channel (#name or Cxxx) via UseGin bot.',
    )
    .argument("<channel>", "channel name (#engineering) or id (C0123…)")
    .option("--since <window>", "only messages newer than (e.g. 1h, 1d, 7d, 2w)")
    .option(
      "--limit <n>",
      "max messages to return (default 50, max 1000)",
      (v) => Number.parseInt(v, 10),
    )
    .option("--json", "Output as JSON to stdout")
    .action(actionRead);
}

async function actionRead(
  channel: string,
  opts: { since?: string; limit?: number; json?: boolean },
) {
  let handle;
  try {
    handle = await buildSlackClient();
  } catch (err) {
    if (err instanceof SlackConfigError) {
      process.stderr.write(`dx slack read: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  let result;
  try {
    result = await readMessages(
      handle.client as unknown as SlackReadClient,
      channel,
      handle.config,
      { since: opts.since, limit: opts.limit },
    );
  } catch (err) {
    if (err instanceof ChannelResolutionError) {
      process.stderr.write(
        `dx slack read: ${err.message} (token: ${err.tokenMask})\n`,
      );
      process.exit(1);
    }
    if (err instanceof RangeError) {
      // parseSince errors — bad --since input.
      process.stderr.write(`dx slack read: ${err.message}\n`);
      process.exit(2);
    }
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`dx slack read: ${msg}\n`);
    process.exit(1);
  }

  const useJson = dxShouldOutputJson(opts);
  if (useJson) {
    process.stdout.write(formatReadJson(result) + "\n");
  } else {
    process.stderr.write(formatReadHuman(result) + "\n");
  }

  if (!result.ok) {
    process.exit(1);
  }
}
