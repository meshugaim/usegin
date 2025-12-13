#!/usr/bin/env bun
import { Command } from "commander";
import { createPromptCommand } from "./commands/prompt";

const program = new Command()
  .name("delegate")
  .description("Agent delegation patterns CLI")
  .version("0.1.0");

// Commands
program.addCommand(createPromptCommand());

// Placeholder commands - will be implemented in subsequent issues
program
  .command("worktree <issue-id>")
  .description("Delegate issue to agent in worktree (blocks until done)")
  .option("--dry-run", "Show what would happen, don't execute")
  .option("--keep-worktree", "Don't cleanup worktree on completion")
  .action((issueId: string, options: { dryRun?: boolean; keepWorktree?: boolean }) => {
    console.log(`TODO: Delegate ${issueId} to worktree agent`);
    if (options.dryRun) console.log("  (dry-run mode)");
    if (options.keepWorktree) console.log("  (keeping worktree)");
  });

program
  .command("status")
  .description("Show active delegations")
  .action(() => {
    console.log("TODO: Show active delegations");
  });

program.parse();
