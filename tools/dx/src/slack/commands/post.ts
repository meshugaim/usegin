/**
 * `dx slack post "<msg>" [--thread <ts>] [--channel <ch>]` — outbox shortcut.
 *
 * Same as `dx slack send` but the channel defaults to `#usegin` (or
 * `USEGIN_OUTBOX_CHANNEL` if set). Used for proactive Gin breadcrumbs
 * that don't belong to any specific channel.
 *
 * Part of: ENG-5408 / D4
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { buildSlackClient } from "../client";
import { ChannelResolutionError } from "../channel";
import { SlackConfigError } from "../config";
import { postToOutbox } from "../post";
import {
	formatSendHuman,
	formatSendJson,
	type SlackSendClient,
} from "../send";

export function buildSlackPostCommand(): Command {
	return new Command("post")
		.description(
			"Post a message to UseGin's outbox channel (#usegin by default).",
		)
		.argument("<message>", "message text")
		.option(
			"--channel <ch>",
			"override outbox channel (default: USEGIN_OUTBOX_CHANNEL or #usegin)",
		)
		.option(
			"--thread <ts>",
			"post as a thread reply to the given parent ts",
		)
		.option("--json", "Output as JSON to stdout")
		.action(actionPost);
}

async function actionPost(
	message: string,
	opts: { channel?: string; thread?: string; json?: boolean },
) {
	let handle;
	try {
		handle = buildSlackClient();
	} catch (err) {
		if (err instanceof SlackConfigError) {
			process.stderr.write(`dx slack post: ${err.message}\n`);
			process.exit(2);
		}
		throw err;
	}

	let result;
	try {
		result = await postToOutbox(
			handle.client as unknown as SlackSendClient,
			message,
			handle.config,
			{ channel: opts.channel, threadTs: opts.thread },
		);
	} catch (err) {
		if (err instanceof ChannelResolutionError) {
			process.stderr.write(
				`dx slack post: ${err.message} (token: ${err.tokenMask})\n`,
			);
			process.exit(1);
		}
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`dx slack post: ${msg}\n`);
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
