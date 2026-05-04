/**
 * `dx slack react <channel> <ts> <emoji>` — reactions.add.
 *
 * Part of: ENG-5760
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { ChannelResolutionError } from "../channel";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";
import {
	addReaction,
	formatReactHuman,
	formatReactJson,
	type SlackReactClient,
} from "../react";

export function buildSlackReactCommand(): Command {
	return new Command("react")
		.description("Add a reaction emoji to a message.")
		.argument("<channel>", "channel (#name or Cxxx)")
		.argument("<ts>", "message timestamp (e.g. 1700000000.000100)")
		.argument("<emoji>", "emoji name with or without colons (e.g. tada or :tada:)")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, ts, emoji, opts) => {
			let handle;
			try {
				handle = buildSlackClient();
			} catch (err) {
				if (err instanceof SlackConfigError) {
					process.stderr.write(`dx slack react: ${err.message}\n`);
					process.exit(2);
				}
				throw err;
			}

			let result;
			try {
				result = await addReaction(
					handle.client as unknown as SlackReactClient,
					channel,
					ts,
					emoji,
					handle.config,
				);
			} catch (err) {
				if (err instanceof ChannelResolutionError) {
					process.stderr.write(
						`dx slack react: ${err.message} (token: ${err.tokenMask})\n`,
					);
					process.exit(1);
				}
				const msg = err instanceof Error ? err.message : String(err);
				process.stderr.write(`dx slack react: ${msg}\n`);
				process.exit(1);
			}

			const useJson = dxShouldOutputJson(opts);
			if (useJson) {
				process.stdout.write(formatReactJson(result) + "\n");
			} else {
				process.stderr.write(formatReactHuman(result) + "\n");
			}
			if (!result.ok) process.exit(1);
		});
}
