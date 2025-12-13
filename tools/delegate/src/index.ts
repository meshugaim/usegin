#!/usr/bin/env bun
import { Command } from "commander";
import { createPromptCommand } from "./commands/prompt";
import { createWorktreeCommand } from "./commands/worktree";

const program = new Command()
  .name("delegate")
  .description("Agent delegation patterns CLI")
  .version("0.1.0");

// Commands
program.addCommand(createPromptCommand());
program.addCommand(createWorktreeCommand());

// Placeholder - will be implemented in subsequent issue
program
  .command("status")
  .description("Show active delegations")
  .action(() => {
    console.log("TODO: Show active delegations");
  });

program.parse();
