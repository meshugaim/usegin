/**
 * `dx slack files <verb>` — file ops.
 *
 * Verbs:
 *   upload — upload a local file to a channel via files.uploadV2.
 *
 * Part of: ENG-5760
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import { ChannelResolutionError } from "../channel";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";
import {
	formatUploadHuman,
	formatUploadJson,
	uploadFile,
	type SlackFilesClient,
} from "../files";

export function buildSlackFilesCommand(): Command {
	const cmd = new Command("files").description(
		"File ops on Slack channels (upload via files.uploadV2).",
	);
	cmd.addCommand(buildUpload());
	return cmd;
}

function buildUpload(): Command {
	return new Command("upload")
		.description("Upload a local file to a channel.")
		.argument("<channel>", "channel (#name or Cxxx)")
		.argument("<path>", "local file path to upload")
		.option("--title <text>", "file title (default: filename)")
		.option("--comment <text>", "initial comment posted with the file")
		.option("--name <name>", "override the filename Slack stores")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, path, opts) => {
			let handle;
			try {
				handle = buildSlackClient();
			} catch (err) {
				if (err instanceof SlackConfigError) {
					process.stderr.write(`dx slack files upload: ${err.message}\n`);
					process.exit(2);
				}
				throw err;
			}

			let bytes: Buffer;
			try {
				bytes = readFileSync(path);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				process.stderr.write(`dx slack files upload: ${msg}\n`);
				process.exit(1);
			}

			const filename = opts.name ?? basename(path);

			let result;
			try {
				result = await uploadFile(
					handle.client as unknown as SlackFilesClient,
					channel,
					bytes,
					filename,
					handle.config,
					{
						title: opts.title,
						initialComment: opts.comment,
					},
				);
			} catch (err) {
				if (err instanceof ChannelResolutionError) {
					process.stderr.write(
						`dx slack files upload: ${err.message} (token: ${err.tokenMask})\n`,
					);
					process.exit(1);
				}
				const msg = err instanceof Error ? err.message : String(err);
				process.stderr.write(`dx slack files upload: ${msg}\n`);
				process.exit(1);
			}

			const useJson = dxShouldOutputJson(opts);
			if (useJson) {
				process.stdout.write(formatUploadJson(result) + "\n");
			} else {
				process.stderr.write(formatUploadHuman(result) + "\n");
			}
			if (!result.ok) process.exit(1);
		});
}
