#!/usr/bin/env bun
import { Command } from "commander";
import { createCreateCommand } from "./commands/create";
import { createDestroyCommand } from "./commands/destroy";
import { createLaunchCommand } from "./commands/launch";
import { createListCommand } from "./commands/list";
import { createPathCommand } from "./commands/path";

const program = new Command()
  .name("clone")
  .description("Git reference clone lifecycle management")
  .version("0.1.0");

program.addCommand(createCreateCommand());
program.addCommand(createDestroyCommand());
program.addCommand(createLaunchCommand());
program.addCommand(createListCommand());
program.addCommand(createPathCommand());

program.parse();
