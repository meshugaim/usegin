#!/usr/bin/env bun
import { Command } from "commander";
import { createListCommand } from "./commands/list";
import { createCreateCommand } from "./commands/create";
import { createUpdateCommand } from "./commands/update";
import { createShowCommand } from "./commands/show";
import { createBrowseCommand } from "./commands/browse";
import { createCaptureCommand } from "./commands/capture";
import { createInboxCommand } from "./commands/inbox";
import { createReorderCommand } from "./commands/reorder";
import { createCacheCommand } from "./commands/cache";
import { createLabelsCommand } from "./commands/labels";

const program = new Command()
  .name("plan")
  .description("Linear-backed task management CLI")
  .version("0.1.0");

// Add commands
program.addCommand(createListCommand());
program.addCommand(createCreateCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createShowCommand());
program.addCommand(createBrowseCommand());
program.addCommand(createCaptureCommand());
program.addCommand(createInboxCommand());
program.addCommand(createReorderCommand());
program.addCommand(createCacheCommand());
program.addCommand(createLabelsCommand());

// Parse arguments
program.parse();
