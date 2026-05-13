/**
 * `dx slack dm <user> <message>` — open IM + post in one call.
 *
 * Part of: ENG-5760
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";
import {
	formatDmHuman,
	formatDmJson,
	sendDm,
	type SlackDmClient,
} from "../dm";
import { UserResolutionError } from "../user";

export function buildSlackDmCommand(): Command {
	return new Command("dm")
		.description(
			"DM a user (open IM + post message). User accepts Uxxx, @handle, or email.",
		)
		.argument("<user>", "Uxxx, @handle, or email")
		.argument("<message>", "message text")
		.option("--json", "Output as JSON to stdout")
		.action(async (user, message, opts) => {
			let handle;
			try {
				handle = await buildSlackClient();
			} catch (err) {
				if (err instanceof SlackConfigError) {
					process.stderr.write(`dx slack dm: ${err.message}\n`);
					process.exit(2);
				}
				throw err;
			}

			let result;
			try {
				result = await sendDm(
					handle.client as unknown as SlackDmClient,
					user,
					message,
					handle.config,
				);
			} catch (err) {
				if (err instanceof UserResolutionError) {
					process.stderr.write(
						`dx slack dm: ${err.message} (token: ${err.tokenMask})\n`,
					);
					process.exit(1);
				}
				const msg = err instanceof Error ? err.message : String(err);
				process.stderr.write(`dx slack dm: ${msg}\n`);
				process.exit(1);
			}

			const useJson = dxShouldOutputJson(opts);
			if (useJson) {
				process.stdout.write(formatDmJson(result) + "\n");
			} else {
				process.stderr.write(formatDmHuman(result) + "\n");
			}
			if (!result.ok) process.exit(1);
		});
}
