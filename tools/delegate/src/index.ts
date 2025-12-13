#!/usr/bin/env bun
import { Command } from "commander";
import { createPromptCommand } from "./commands/prompt";
import { createWorktreeCommand } from "./commands/worktree";
import { createStatusCommand } from "./commands/status";

const program = new Command()
  .name("delegate")
  .description("Agent delegation patterns CLI")
  .version("0.1.0");

// Commands
program.addCommand(createPromptCommand());
program.addCommand(createWorktreeCommand());
program.addCommand(createStatusCommand());

program.parse();
