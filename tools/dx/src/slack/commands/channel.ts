/**
 * `dx slack channel <verb>` — admin ops on Slack channels.
 *
 * Verbs: create, invite, join, archive, topic, purpose, members.
 * Each calls a pure function in `../channelOps.ts` and renders via the
 * shared `formatOpHuman` / `formatOpJson` formatters.
 *
 * Part of: ENG-5760
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../../output";
import {
	addBookmark,
	formatBookmarkHuman,
	formatBookmarkJson,
	type SlackBookmarkClient,
} from "../bookmark";
import { ChannelResolutionError } from "../channel";
import {
	archiveChannel,
	createChannel,
	formatOpHuman,
	formatOpJson,
	inviteToChannel,
	joinChannel,
	listChannelMembers,
	setChannelPurpose,
	setChannelTopic,
	type ChannelAdminClient,
	type OpResult,
	type MemberRow,
} from "../channelOps";
import { buildSlackClient } from "../client";
import { SlackConfigError } from "../config";

export function buildSlackChannelCommand(): Command {
	const cmd = new Command("channel").description(
		"Admin ops on Slack channels (create / invite / join / archive / topic / purpose / members / bookmark).",
	);
	cmd.addCommand(buildCreate());
	cmd.addCommand(buildInvite());
	cmd.addCommand(buildJoin());
	cmd.addCommand(buildArchive());
	cmd.addCommand(buildTopic());
	cmd.addCommand(buildPurpose());
	cmd.addCommand(buildMembers());
	cmd.addCommand(buildBookmark());
	return cmd;
}

function buildBookmark(): Command {
	const cmd = new Command("bookmark").description(
		"Channel bookmarks — pinned links in the channel header.",
	);
	cmd.addCommand(
		new Command("add")
			.description("Add a link bookmark to a channel.")
			.argument("<channel>", "channel (#name or Cxxx)")
			.argument("<url>", "URL to bookmark")
			.option("--title <text>", "bookmark title (default: the URL)")
			.option("--emoji <emoji>", "leading emoji (e.g. :pin:)")
			.option("--json", "Output as JSON to stdout")
			.action(async (channel, url, opts) => {
				let handle;
				try {
					handle = buildSlackClient();
				} catch (err) {
					if (err instanceof SlackConfigError) {
						process.stderr.write(
							`dx slack channel bookmark add: ${err.message}\n`,
						);
						process.exit(2);
					}
					throw err;
				}

				let result;
				try {
					result = await addBookmark(
						handle.client as unknown as SlackBookmarkClient,
						channel,
						url,
						opts.title ?? url,
						handle.config,
						{ emoji: opts.emoji },
					);
				} catch (err) {
					if (err instanceof ChannelResolutionError) {
						process.stderr.write(
							`dx slack channel bookmark add: ${err.message} (token: ${err.tokenMask})\n`,
						);
						process.exit(1);
					}
					const msg = err instanceof Error ? err.message : String(err);
					process.stderr.write(`dx slack channel bookmark add: ${msg}\n`);
					process.exit(1);
				}

				const useJson = dxShouldOutputJson(opts);
				if (useJson) {
					process.stdout.write(formatBookmarkJson(result) + "\n");
				} else {
					process.stderr.write(formatBookmarkHuman(result) + "\n");
				}
				if (!result.ok) process.exit(1);
			}),
	);
	return cmd;
}

function buildCreate(): Command {
	return new Command("create")
		.description("Create a public or private channel.")
		.argument("<name>", "channel name (with or without leading #)")
		.option("--private", "create as private (groups:write needed)")
		.option("--topic <text>", "set the channel topic after creation")
		.option("--json", "Output as JSON to stdout")
		.action(async (name, opts) => {
			await runOp("create", opts, async (client, config) =>
				createChannel(client, name, config, {
					isPrivate: opts.private,
					topic: opts.topic,
				}),
			);
		});
}

function buildInvite(): Command {
	return new Command("invite")
		.description("Invite users to a channel (Uxxx, @handle, or email).")
		.argument("<channel>", "channel (#name or Cxxx)")
		.argument("<users...>", "one or more users — Uxxx, @handle, or email")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, users, opts) => {
			await runOp("invite", opts, async (client, config) =>
				inviteToChannel(client, channel, users, config),
			);
		});
}

function buildJoin(): Command {
	return new Command("join")
		.description("Bot joins a channel (so it can read history).")
		.argument("<channel>", "channel (#name or Cxxx)")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, opts) => {
			await runOp("join", opts, async (client, config) =>
				joinChannel(client, channel, config),
			);
		});
}

function buildArchive(): Command {
	return new Command("archive")
		.description("Archive (soft-delete) a channel.")
		.argument("<channel>", "channel (#name or Cxxx)")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, opts) => {
			await runOp("archive", opts, async (client, config) =>
				archiveChannel(client, channel, config),
			);
		});
}

function buildTopic(): Command {
	return new Command("topic")
		.description("Set a channel's topic.")
		.argument("<channel>", "channel (#name or Cxxx)")
		.argument("<text>", "new topic text")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, text, opts) => {
			await runOp("topic", opts, async (client, config) =>
				setChannelTopic(client, channel, text, config),
			);
		});
}

function buildPurpose(): Command {
	return new Command("purpose")
		.description("Set a channel's purpose.")
		.argument("<channel>", "channel (#name or Cxxx)")
		.argument("<text>", "new purpose text")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, text, opts) => {
			await runOp("purpose", opts, async (client, config) =>
				setChannelPurpose(client, channel, text, config),
			);
		});
}

function buildMembers(): Command {
	return new Command("members")
		.description("List a channel's members (id + name + email when in scope).")
		.argument("<channel>", "channel (#name or Cxxx)")
		.option("--json", "Output as JSON to stdout")
		.action(async (channel, opts) => {
			await runOp("members", opts, async (client, config) =>
				listChannelMembers(client, channel, config),
			);
		});
}

/**
 * Shared command-layer scaffolding: build client, run op, render output,
 * handle exit codes uniformly.
 */
async function runOp(
	verb: string,
	opts: { json?: boolean },
	run: (
		client: ChannelAdminClient,
		config: ReturnType<typeof buildSlackClient>["config"],
	) => Promise<OpResult & { members?: MemberRow[] }>,
) {
	let handle;
	try {
		handle = buildSlackClient();
	} catch (err) {
		if (err instanceof SlackConfigError) {
			process.stderr.write(`dx slack channel ${verb}: ${err.message}\n`);
			process.exit(2);
		}
		throw err;
	}

	let result: OpResult & { members?: MemberRow[] };
	try {
		result = await run(
			handle.client as unknown as ChannelAdminClient,
			handle.config,
		);
	} catch (err) {
		if (err instanceof ChannelResolutionError) {
			process.stderr.write(
				`dx slack channel ${verb}: ${err.message} (token: ${err.tokenMask})\n`,
			);
			process.exit(1);
		}
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`dx slack channel ${verb}: ${msg}\n`);
		process.exit(1);
	}

	const useJson = dxShouldOutputJson(opts);
	if (useJson) {
		process.stdout.write(formatOpJson(result) + "\n");
	} else {
		const human = formatOpHuman(result);
		process.stderr.write(human + "\n");
		// `members` table — render after the standard line so JSON consumers
		// still get it via formatOpJson.
		if (verb === "members" && result.members) {
			for (const m of result.members) {
				const email = m.email ?? "(no email)";
				const name = m.name ?? "(no name)";
				const tag = m.is_bot ? " [bot]" : "";
				process.stderr.write(
					`  - ${m.id}  ${name}${tag}  ${email}\n`,
				);
			}
		}
	}

	if (!result.ok) {
		process.exit(1);
	}
}
