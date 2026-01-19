#!/usr/bin/env bun

import { Command } from "commander";
import { join } from "path";
import { createTeamWorkspace } from "./workspace";

const program = new Command();

/**
 * Get default teams directory
 */
function getDefaultTeamsDir(): string {
  return join(process.cwd(), ".claude", "teams");
}

program
  .name("team")
  .description("Team orchestration CLI for autonomous multi-agent workflows")
  .version("0.1.0");

program
  .command("plan")
  .description("Start planning team for a spec issue")
  .argument("<issue-id>", "Linear issue ID (e.g., ENG-123)")
  .option(
    "--teams-dir <path>",
    "Directory for team workspaces",
    getDefaultTeamsDir()
  )
  .action(async (issueId: string, options: { teamsDir: string }) => {
    try {
      await createTeamWorkspace(issueId, "plan", {
        teamsDir: options.teamsDir,
      });

      console.log(`✓ Planning team workspace created for ${issueId}`);
      console.log(`  Location: ${join(options.teamsDir, issueId)}`);
    } catch (error) {
      console.error(`✗ Failed to create planning team workspace:`, error);
      process.exit(1);
    }
  });

program.parse();
