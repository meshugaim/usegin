/**
 * `dx slack send <channel> "<msg>" [--thread <ts>]` — post via chat.postMessage.
 *
 * Part of: ENG-5412
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { ChannelResolutionError } from "../channel";
import { SlackConfigError } from "../config";
import {
  formatSendHuman,
  formatSendJson,
  sendMessage,
  type SlackSendClient,
} from "../send";

export function buildSlackSendCommand(): Command {
  return new Command("send")
    .description(
      'Post a message to a Slack channel (#name or Cxxx) via UseGin bot.',
    )
    .argument("<channel>", "channel name (#engineering) or id (C0123…)")
    .argument("<message>", "message text")
    .option(
      "--thread <ts>",
      "post as a thread reply to the given parent ts (e.g. 1700000000.000100)",
    )
    .option("--json", "Output as JSON to stdout")
    .action(actionSend);
}

async function actionSend(
  channel: string,
  message: string,
  opts: { thread?: string; json?: boolean },
) {
  let handle;
  try {
    handle = await buildSlackClient();
  } catch (err) {
    if (err instanceof SlackConfigError) {
      process.stderr.write(`dx slack send: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  let result;
  try {
    // The `WebClient` exposes a superset of `SlackSendClient`; cast for the
    // narrower test-shaped surface our pure functions consume.
    result = await sendMessage(
      handle.client as unknown as SlackSendClient,
      channel,
      message,
      handle.config,
      { threadTs: opts.thread },
    );
  } catch (err) {
    if (err instanceof ChannelResolutionError) {
      process.stderr.write(
        `dx slack send: ${err.message} (token: ${err.tokenMask})\n`,
      );
      process.exit(1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`dx slack send: ${msg}\n`);
    process.exit(1);
  }

  const useJson = dxShouldOutputJson(opts);
  if (useJson) {
    process.stdout.write(formatSendJson(result) + "\n");
  } else {
    process.stderr.write(formatSendHuman(result) + "\n");
  }

  if (!result.ok) {
    process.exit(1);
  }
}
