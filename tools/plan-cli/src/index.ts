#!/usr/bin/env bun
import { Command } from "commander";
import { createListCommand } from "./commands/list";
import { createCreateCommand } from "./commands/create";
import { createUpdateCommand } from "./commands/update";
import { createShowCommand } from "./commands/show";
import { createBrowseCommand } from "./commands/browse";

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

// Parse arguments
program.parse();
