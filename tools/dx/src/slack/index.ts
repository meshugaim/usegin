/**
 * `dx slack` — UseGin-Slack CLI surface.
 *
 * Slice 1: `whoami` only. Proves the spine (Slack app exists, bot token
 * in Doppler, CLI convention) end-to-end. Follow-on slices add `send`,
 * `read`, `inbox`, `react`, `thread`, `search`, `channels`, `docs` —
 * see usegin/research/slack-integration/usegin-slack-team/whiteboard.md.
 *
 * Auth: bot token (`xoxb-…`) in `USEGIN_SLACK_BOT_TOKEN` (Doppler).
 * Identity: shared bot, attribution in payload (`*[via <human>]*`).
 * Mirrors `plan`'s shape, NOT `effi`'s — Slack workspace IS the team
 * surface, not per-person identity.
 *
 * Part of: ENG-5408
 */

import { Command } from "commander";
import { buildSlackWhoamiCommand } from "./commands/whoami";

export function buildSlackCommand(): Command {
  const cmd = new Command("slack")
    .description(
      "UseGin-Slack CLI — Gin-mediated team Slack R/W (slice 1: whoami).",
    );
  cmd.addCommand(buildSlackWhoamiCommand());
  return cmd;
}
