#!/usr/bin/env bun
import { Command } from "commander";
import { createListCommand } from "./commands/list";
import { createCreateCommand } from "./commands/create";
import { createUpdateCommand } from "./commands/update";
import { createShowCommand } from "./commands/show";
import { createBrowseCommand } from "./commands/browse";
import { createReorderCommand } from "./commands/reorder";
import { createCacheCommand } from "./commands/cache";
import { createLabelsCommand } from "./commands/labels";
import { createStartCommand } from "./commands/start";
import { createCloseCommand } from "./commands/close";
import { createAlignCommand } from "./commands/align";
import { createDocsCommand, getDocsHelpText } from "./commands/docs";
import { createHistoryCommand } from "./commands/history";
import { createSearchCommand } from "./commands/search";
import { createCheckoutCommand } from "./commands/checkout";
import { createPushCommand } from "./commands/push";
import { createStatusCommand } from "./commands/status";
import { createWatchCommand } from "./commands/watch";
import { createUnwatchCommand } from "./commands/unwatch";
import { applyStandardAliases } from "../../lib/standard-aliases";
import { enablePrefixMatching } from "../../lib/commander-prefix";

// Help text explaining short ID support
function getShortIdHelpText(): string {
  const lines = [
    "",
    "Issue IDs:",
    "  Short IDs are supported: `plan show 365` expands to `plan show ENG-365`",
    "  Set PLAN_TEAM env var to change the default team prefix (default: ENG)",
  ];
  return lines.join("\n");
}

const program = new Command()
  .name("plan")
  .description("Linear-backed task management CLI")
  .version("0.1.0")
  .addHelpText("afterAll", getShortIdHelpText)
  .addHelpText("afterAll", getDocsHelpText);

// Add commands
program.addCommand(createListCommand());
program.addCommand(createCreateCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createShowCommand());
program.addCommand(createBrowseCommand());
program.addCommand(createReorderCommand());
program.addCommand(createCacheCommand());
program.addCommand(createLabelsCommand());
program.addCommand(createStartCommand());
program.addCommand(createCloseCommand());
program.addCommand(createAlignCommand());
program.addCommand(createDocsCommand());
program.addCommand(createHistoryCommand());
program.addCommand(createSearchCommand());
program.addCommand(createCheckoutCommand());
program.addCommand(createPushCommand());
program.addCommand(createStatusCommand());
program.addCommand(createWatchCommand());
program.addCommand(createUnwatchCommand());

// Apply standard aliases (list→ls, show→get, search→find, create→new)
// before parsing so aliases are available during command resolution.
applyStandardAliases(program);
enablePrefixMatching(program);

// Parse arguments
program.parse();
