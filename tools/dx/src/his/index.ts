import { Command } from "commander";
import { buildHisRateCommand } from "./commands/rate";
import { buildHisNoteCommand } from "./commands/note";
import { buildHisEndCommand } from "./commands/end";
import { buildHisShowCommand } from "./commands/show";
import { buildHisSessionsCommand } from "./commands/sessions";
import { buildHisAspectsCommand } from "./commands/aspects";
import { buildHisHookStopCommand } from "./commands/hook-stop";
import { buildHisHookSessionEndCommand } from "./commands/hook-session-end";

export function buildHisCommand(): Command {
  const cmd = new Command("his")
    .description("How-Is-Session — vibe-rated session telemetry. Both human and Claude rate; ratings accumulate per turn.");
  cmd.addCommand(buildHisRateCommand());
  cmd.addCommand(buildHisNoteCommand());
  cmd.addCommand(buildHisEndCommand());
  cmd.addCommand(buildHisShowCommand());
  cmd.addCommand(buildHisSessionsCommand());
  cmd.addCommand(buildHisAspectsCommand());
  cmd.addCommand(buildHisHookStopCommand());
  cmd.addCommand(buildHisHookSessionEndCommand());
  return cmd;
}
