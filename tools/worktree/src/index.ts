#!/usr/bin/env bun
import { Command } from "commander";
import { createCreateCommand } from "./commands/create";
import { createDestroyCommand } from "./commands/destroy";
import { createListCommand } from "./commands/list";
import { createLaunchCommand } from "./commands/launch";

const program = new Command()
  .name("worktree")
  .description("Git worktree lifecycle management")
  .version("0.1.0");

program.addCommand(createCreateCommand());
program.addCommand(createDestroyCommand());
program.addCommand(createListCommand());
program.addCommand(createLaunchCommand());

program.parse();
