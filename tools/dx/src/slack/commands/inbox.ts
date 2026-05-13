/**
 * `dx slack inbox [--unread] [--since 1d]` — list `@usegin` mentions waiting
 * across joined channels (poll-on-invoke; no Events API receiver).
 *
 * Part of: ENG-5415
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";
import {
  fetchInbox,
  formatInboxHuman,
  formatInboxJson,
  type SlackInboxClient,
} from "../inbox";
import {
  readInboxCursor,
  writeInboxCursor,
} from "../inboxCursor";

export function buildSlackInboxCommand(): Command {
  return new Command("inbox")
    .description(
      "List @usegin mentions across joined Slack channels (poll-on-invoke).",
    )
    .option(
      "--since <window>",
      "only mentions newer than (e.g. 1h, 1d, 7d, 2w); default 1d",
    )
    .option(
      "--unread",
      "only mentions newer than the last cursor; updates cursor on success",
    )
    .option("--json", "Output as JSON to stdout")
    .action(actionInbox);
}

async function actionInbox(opts: {
  since?: string;
  unread?: boolean;
  json?: boolean;
}) {
  let handle;
  try {
    handle = await buildSlackClient();
  } catch (err) {
    if (err instanceof SlackConfigError) {
      process.stderr.write(`dx slack inbox: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  const cursor = opts.unread ? readInboxCursor() : undefined;

  let result;
  try {
    result = await fetchInbox(
      handle.client as unknown as SlackInboxClient,
      handle.config,
      { since: opts.since, unread: opts.unread },
      cursor,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`dx slack inbox: ${msg}\n`);
    process.exit(1);
  }

  // Persist cursor on a successful --unread run, even when 0 new mentions.
  // We store the highest ts seen; if nothing new, keep prior. This is
  // best-effort, never a hard fail.
  if (opts.unread && result.ok && result.cursorTs) {
    try {
      writeInboxCursor({ lastSeenTs: result.cursorTs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`dx slack inbox: cursor write failed (${msg})\n`);
    }
  }

  const useJson = dxShouldOutputJson(opts);
  if (useJson) {
    process.stdout.write(formatInboxJson(result) + "\n");
  } else {
    process.stderr.write(formatInboxHuman(result) + "\n");
  }

  if (!result.ok) {
    process.exit(1);
  }
}
