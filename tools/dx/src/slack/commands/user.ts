/**
 * `dx slack user <verb>` — user-namespace ops.
 *
 * Verbs:
 *   find — resolve `<email-or-handle-or-id>` to a user record (id, name,
 *          real_name, email when in scope).
 *
 * Part of: ENG-5760
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { maskToken, SlackConfigError } from "../config";
import {
	fetchUserInfo,
	resolveUser,
	UserResolutionError,
	type SlackUserClient,
} from "../user";

export function buildSlackUserCommand(): Command {
	const cmd = new Command("user").description(
		"User-namespace ops (find — resolve email/handle/id).",
	);
	cmd.addCommand(buildFind());
	return cmd;
}

function buildFind(): Command {
	return new Command("find")
		.description(
			"Resolve a Slack user by email, @handle, or raw Uxxx id; print the record.",
		)
		.argument("<who>", "email, @handle, or Uxxx id")
		.option("--json", "Output as JSON to stdout")
		.action(async (who, opts) => {
			let handle;
			try {
				handle = buildSlackClient();
			} catch (err) {
				if (err instanceof SlackConfigError) {
					process.stderr.write(`dx slack user find: ${err.message}\n`);
					process.exit(2);
				}
				throw err;
			}

			const useJson = dxShouldOutputJson(opts);
			const tokenMask = maskToken(handle.config.botToken);

			try {
				const userId = await resolveUser(
					handle.client as unknown as SlackUserClient,
					who,
					handle.config,
				);
				const info = await fetchUserInfo(
					handle.client as unknown as SlackUserClient,
					userId,
					handle.config,
				);
				if (useJson) {
					process.stdout.write(
						JSON.stringify(
							{
								ok: true,
								id: info.id,
								name: info.name ?? null,
								real_name:
									info.real_name ?? info.profile?.real_name ?? null,
								email: info.profile?.email ?? null,
								is_bot: info.is_bot ?? false,
								token: tokenMask,
							},
							null,
							2,
						) + "\n",
					);
				} else {
					process.stderr.write(
						[
							`UseGin-Slack user find OK`,
							`  id:        ${info.id ?? "?"}`,
							`  name:      ${info.name ?? "(none)"}`,
							`  real_name: ${info.real_name ?? info.profile?.real_name ?? "(none)"}`,
							`  email:     ${info.profile?.email ?? "(no email — needs users:read.email scope)"}`,
							`  is_bot:    ${info.is_bot ?? false}`,
							`  token:     ${tokenMask}`,
						].join("\n") + "\n",
					);
				}
			} catch (err) {
				if (err instanceof UserResolutionError) {
					if (useJson) {
						process.stdout.write(
							JSON.stringify(
								{
									ok: false,
									error: err.slackError ?? err.message,
									token: err.tokenMask,
								},
								null,
								2,
							) + "\n",
						);
					} else {
						const lines = [
							`UseGin-Slack user find FAILED — ${err.slackError ?? err.message}`,
							`  input: ${who}`,
							`  token: ${err.tokenMask}`,
						];
						if (err.slackError === "missing_scope") {
							lines.push(
								`  hint:  bot needs users:read.email — see tools/dx/src/slack/README.md.`,
							);
						}
						process.stderr.write(lines.join("\n") + "\n");
					}
					process.exit(1);
				}
				const msg = err instanceof Error ? err.message : String(err);
				process.stderr.write(`dx slack user find: ${msg}\n`);
				process.exit(1);
			}
		});
}
