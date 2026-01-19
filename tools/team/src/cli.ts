#!/usr/bin/env bun

import { Command } from "commander";
import { join } from "path";
import {
  createTeamWorkspace,
  updateTeamState,
  appendTeamEvent,
  appendProgress,
} from "./workspace";
import {
  spawnAgent,
  buildPlanningReviewerPrompt,
  buildReviewerNoteToSelf,
} from "./crun";

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
  .option("--dry-run", "Create workspace but don't spawn agents")
  .action(
    async (
      issueId: string,
      options: { teamsDir: string; dryRun?: boolean }
    ) => {
      const deps = { teamsDir: options.teamsDir };

      try {
        // Create workspace
        await createTeamWorkspace(issueId, "plan", deps);
        console.log(`✓ Planning team workspace created for ${issueId}`);
        console.log(`  Location: ${join(options.teamsDir, issueId)}`);

        if (options.dryRun) {
          console.log(`\n⏸ Dry run - not spawning agents`);
          return;
        }

        // Spawn the reviewer agent
        console.log(`\n→ Spawning planning team reviewer...`);

        const prompt = buildPlanningReviewerPrompt(issueId);
        const noteToSelf = buildReviewerNoteToSelf(issueId);
        const workspacePath = join(options.teamsDir, issueId);

        // Log the spawn event
        await appendTeamEvent(
          issueId,
          "reviewer_spawn",
          { prompt: prompt.substring(0, 200) + "..." },
          deps
        );
        await appendProgress(issueId, "Spawning planning team reviewer", deps);

        // Spawn the reviewer
        const result = await spawnAgent({
          prompt,
          cwd: process.cwd(),
          noteToSelf,
          appendSystemPrompt: `Team workspace: ${workspacePath}`,
        });

        // Update state with reviewer session
        await updateTeamState(
          issueId,
          {
            reviewerSession: result.sessionId,
            phase: "reviewing",
          },
          deps
        );

        // Log completion
        await appendTeamEvent(
          issueId,
          "reviewer_complete",
          {
            exitCode: result.exitCode,
            sessionId: result.sessionId,
          },
          deps
        );
        await appendProgress(
          issueId,
          `Reviewer completed with exit code ${result.exitCode}`,
          deps
        );

        if (result.exitCode === 0) {
          console.log(`✓ Planning team reviewer completed successfully`);
          if (result.sessionId) {
            console.log(`  Session: ${result.sessionId}`);
          }
        } else {
          console.log(`✗ Planning team reviewer exited with code ${result.exitCode}`);
          console.log(`\nStderr:\n${result.stderr}`);
        }
      } catch (error) {
        console.error(`✗ Failed to run planning team:`, error);
        process.exit(1);
      }
    }
  );

program.parse();
