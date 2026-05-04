/**
 * `dx slack` — UseGin-Slack CLI surface.
 *
 * Slice 1 (ENG-5408): `whoami`. Slice 2 (ENG-5412): `send`, `read`. All
 * three reuse `config.ts` + `client.ts` against the same bot token.
 * Follow-on slices: `inbox`, `react`, `thread`, `search`, `channels`,
 * `docs` — see usegin/research/slack-integration/usegin-slack-team/whiteboard.md.
 *
 * Auth: bot token (`xoxb-…`) in `USEGIN_SLACK_BOT_TOKEN` (Doppler).
 * Identity: shared bot, attribution in payload (`*[via <human>]*`).
 * Mirrors `plan`'s shape, NOT `effi`'s — Slack workspace IS the team
 * surface, not per-person identity.
 */

import { Command } from "commander";
import { buildSlackChannelCommand } from "./commands/channel";
import { buildSlackDmCommand } from "./commands/dm";
import { buildSlackFilesCommand } from "./commands/files";
import { buildSlackInboxCommand } from "./commands/inbox";
import { buildSlackPostCommand } from "./commands/post";
import { buildSlackReadCommand } from "./commands/read";
import { buildSlackSendCommand } from "./commands/send";
import { buildSlackUserCommand } from "./commands/user";
import { buildSlackWhoamiCommand } from "./commands/whoami";

export function buildSlackCommand(): Command {
  const cmd = new Command("slack").description(
    "UseGin-Slack CLI — Gin-mediated team Slack R/W (whoami, send, post, read, inbox, channel, user, dm).",
  );
  cmd.addCommand(buildSlackWhoamiCommand());
  cmd.addCommand(buildSlackSendCommand());
  cmd.addCommand(buildSlackPostCommand());
  cmd.addCommand(buildSlackReadCommand());
  cmd.addCommand(buildSlackInboxCommand());
  cmd.addCommand(buildSlackChannelCommand());
  cmd.addCommand(buildSlackUserCommand());
  cmd.addCommand(buildSlackDmCommand());
  cmd.addCommand(buildSlackFilesCommand());
  return cmd;
}
