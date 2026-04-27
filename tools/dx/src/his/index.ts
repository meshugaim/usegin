import { Command } from "commander";
import { buildHisRateCommand } from "./commands/rate";
import { buildHisNoteCommand } from "./commands/note";
import { buildHisEndCommand } from "./commands/end";
import { buildHisShowCommand } from "./commands/show";
import { buildHisSessionsCommand } from "./commands/sessions";
import { buildHisAspectsCommand } from "./commands/aspects";
import { buildHisHookStopCommand } from "./commands/hook-stop";
import { buildHisHookSessionEndCommand } from "./commands/hook-session-end";
import { buildHisStatsCommand } from "./commands/stats";
import { buildHisLastCommand } from "./commands/last";
import { buildHisSearchCommand } from "./commands/search";
import { buildHisTrendCommand } from "./commands/trend";
import { buildHisExportCommand } from "./commands/export";
import { buildHisDigestCommand } from "./commands/digest";
import { buildHisPruneCommand } from "./commands/prune";
import { buildHisSelfTestCommand } from "./commands/self-test";

export function buildHisCommand(): Command {
  const cmd = new Command("his")
    .description("How-Is-Session — vibe-rated session telemetry. Both human and Claude rate; ratings accumulate per turn.");
  cmd.addCommand(buildHisRateCommand());
  cmd.addCommand(buildHisNoteCommand());
  cmd.addCommand(buildHisEndCommand());
  cmd.addCommand(buildHisShowCommand());
  cmd.addCommand(buildHisSessionsCommand());
  cmd.addCommand(buildHisAspectsCommand());
  cmd.addCommand(buildHisStatsCommand());
  cmd.addCommand(buildHisLastCommand());
  cmd.addCommand(buildHisSearchCommand());
  cmd.addCommand(buildHisTrendCommand());
  cmd.addCommand(buildHisExportCommand());
  cmd.addCommand(buildHisDigestCommand());
  cmd.addCommand(buildHisPruneCommand());
  cmd.addCommand(buildHisSelfTestCommand());
  cmd.addCommand(buildHisHookStopCommand());
  cmd.addCommand(buildHisHookSessionEndCommand());
  return cmd;
}
