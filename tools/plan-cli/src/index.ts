#!/usr/bin/env bun
import { Command } from "commander";
import { createListCommand } from "./commands/list";
import { createCreateCommand } from "./commands/create";

const program = new Command()
  .name("plan")
  .description("Linear-backed task management CLI")
  .version("0.1.0");

// Add commands
program.addCommand(createListCommand());
program.addCommand(createCreateCommand());

// Parse arguments
program.parse();
