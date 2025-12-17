#!/usr/bin/env bun
import { Command } from "commander";
import { createPromptCommand } from "./commands/prompt";
import { createWorktreeCommand } from "./commands/worktree";
import { createRunCommand } from "./commands/run";
import { createStatusCommand } from "./commands/status";
import { createWatchCommand } from "./commands/watch";
import { createPeekCommand } from "./commands/peek";

const program = new Command()
  .name("delegate")
  .description("Agent delegation patterns CLI")
  .version("0.1.0");

// Commands
program.addCommand(createPromptCommand());
program.addCommand(createWorktreeCommand());
program.addCommand(createRunCommand());
program.addCommand(createStatusCommand());
program.addCommand(createWatchCommand());
program.addCommand(createPeekCommand());

program.parse();
