/**
 * `dx slack whoami` — print UseGin bot identity, workspace, scopes.
 *
 * The smallest unit that proves the entire UseGin-Slack spine
 * end-to-end (Slack app exists, bot token in Doppler, slack_sdk wired,
 * CLI convention). Per ENG-5408 acceptance criteria.
 *
 * Part of: ENG-5408
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { loadSlackConfig, SlackConfigError } from "../config";
import {
  fetchWhoami,
  formatWhoamiHuman,
  formatWhoamiJson,
} from "../whoami";

export function buildSlackWhoamiCommand(): Command {
  return new Command("whoami")
    .description(
      "Show UseGin bot identity (workspace, bot user, app id, scopes).",
    )
    .option("--json", "Output as JSON to stdout")
    .action(actionWhoami);
}

async function actionWhoami(opts: { json?: boolean }) {
  let config;
  try {
    config = loadSlackConfig();
  } catch (err) {
    if (err instanceof SlackConfigError) {
      process.stderr.write(`dx slack whoami: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  let result;
  try {
    result = await fetchWhoami(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`dx slack whoami: ${msg}\n`);
    process.exit(1);
  }

  const useJson = dxShouldOutputJson(opts);
  if (useJson) {
    process.stdout.write(formatWhoamiJson(result) + "\n");
  } else {
    process.stderr.write(formatWhoamiHuman(result) + "\n");
  }

  // Non-zero exit on Slack-reported failure so callers can detect it.
  if (!result.ok) {
    process.exit(1);
  }
}
