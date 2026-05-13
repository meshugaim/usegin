/**
 * `dx slack smoke` — post-install verification gate.
 *
 * Runs five checks against the live workspace and prints a one-page
 * report. Exit code: 0 if all checks pass (or pass+skip+warn under
 * --skip-live), 1 otherwise.
 *
 * Part of: ENG-5760
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";
import {
	formatSmokeHuman,
	formatSmokeJson,
	runSmoke,
	type SlackSmokeClient,
} from "../smoke";

export function buildSlackSmokeCommand(): Command {
	return new Command("smoke")
		.description(
			"Verify UseGin-Slack is operational in the workspace. --skip-live for pre-swap dry-run.",
		)
		.option(
			"--skip-live",
			"Skip checks that require Lihu's real-workspace setup (post + email lookup)",
		)
		.option(
			"--channel <name>",
			"Override smoke channel (default: env DX_SLACK_SMOKE_CHANNEL or #dev)",
		)
		.option("--json", "Output as JSON to stdout")
		.action(async (opts) => {
			let handle;
			try {
				handle = await buildSlackClient();
			} catch (err) {
				if (err instanceof SlackConfigError) {
					process.stderr.write(`dx slack smoke: ${err.message}\n`);
					process.exit(2);
				}
				throw err;
			}

			const report = await runSmoke(
				handle.client as unknown as SlackSmokeClient,
				handle.config,
				{
					skipLive: opts.skipLive,
					smokeChannel: opts.channel,
				},
			);

			const useJson = dxShouldOutputJson(opts);
			if (useJson) {
				process.stdout.write(formatSmokeJson(report) + "\n");
			} else {
				process.stderr.write(formatSmokeHuman(report) + "\n");
			}
			if (!report.ok) process.exit(1);
		});
}
