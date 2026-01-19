#!/usr/bin/env bun

import { Command } from "commander";
import { join } from "path";
import {
  createTeamWorkspace,
  updateTeamState,
  appendTeamEvent,
  appendProgress,
  readTeamState,
  listTeams,
  teamExists,
  type TeamState,
} from "./workspace";
import {
  spawnAgent,
  buildPlanningReviewerPrompt,
  buildReviewerNoteToSelf,
  buildImplReviewerPrompt,
  buildImplReviewerNoteToSelf,
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

program
  .command("impl")
  .description("Start implementation team for a slice issue")
  .argument("<issue-id>", "Linear issue ID for the slice (e.g., ENG-123)")
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
        await createTeamWorkspace(issueId, "impl", deps);
        console.log(`✓ Implementation team workspace created for ${issueId}`);
        console.log(`  Location: ${join(options.teamsDir, issueId)}`);

        if (options.dryRun) {
          console.log(`\n⏸ Dry run - not spawning agents`);
          return;
        }

        // Spawn the reviewer agent
        console.log(`\n→ Spawning implementation team reviewer...`);

        const prompt = buildImplReviewerPrompt(issueId);
        const noteToSelf = buildImplReviewerNoteToSelf(issueId);
        const workspacePath = join(options.teamsDir, issueId);

        // Log the spawn event
        await appendTeamEvent(
          issueId,
          "reviewer_spawn",
          { prompt: prompt.substring(0, 200) + "..." },
          deps
        );
        await appendProgress(
          issueId,
          "Spawning implementation team reviewer",
          deps
        );

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
            phase: "writing_tests",
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
          console.log(`✓ Implementation team reviewer completed successfully`);
          if (result.sessionId) {
            console.log(`  Session: ${result.sessionId}`);
          }
        } else {
          console.log(
            `✗ Implementation team reviewer exited with code ${result.exitCode}`
          );
          console.log(`\nStderr:\n${result.stderr}`);
        }
      } catch (error) {
        console.error(`✗ Failed to run implementation team:`, error);
        process.exit(1);
      }
    }
  );

/**
 * Format a team state for display
 */
function formatTeamStatus(state: TeamState): string {
  const lines: string[] = [];

  lines.push(`Issue:    ${state.issueId}`);
  lines.push(`Type:     ${state.type}`);
  lines.push(`Phase:    ${state.phase}`);

  if (state.type === "impl") {
    if (state.testsApproved !== undefined) {
      lines.push(`Tests:    ${state.testsApproved ? "approved" : "pending"}`);
    }
    if (
      state.subtasksTotal !== undefined &&
      state.subtasksComplete !== undefined
    ) {
      lines.push(`Progress: ${state.subtasksComplete}/${state.subtasksTotal}`);
    }
  }

  if (state.reviewerSession) {
    lines.push(`Reviewer: ${state.reviewerSession}`);
  }

  if (state.currentWorkerSession) {
    lines.push(`Worker:   ${state.currentWorkerSession}`);
  }

  lines.push(`Updated:  ${state.updatedAt}`);

  return lines.join("\n");
}

/**
 * Format a team state as a single line for list view
 */
function formatTeamLine(state: TeamState): string {
  const phase = state.phase.padEnd(15);
  const type = state.type.padEnd(5);

  let progress = "";
  if (
    state.type === "impl" &&
    state.subtasksTotal !== undefined &&
    state.subtasksComplete !== undefined
  ) {
    progress = ` [${state.subtasksComplete}/${state.subtasksTotal}]`;
  }

  return `${state.issueId}  ${type}  ${phase}${progress}`;
}

program
  .command("status")
  .description("Show status of teams")
  .argument("[issue-id]", "Specific team to show (optional)")
  .option(
    "--teams-dir <path>",
    "Directory for team workspaces",
    getDefaultTeamsDir()
  )
  .action(async (issueId: string | undefined, options: { teamsDir: string }) => {
    const deps = { teamsDir: options.teamsDir };

    if (issueId) {
      // Show specific team
      const exists = await teamExists(issueId, deps);
      if (!exists) {
        console.error(`Team ${issueId} not found`);
        process.exit(1);
      }

      const state = await readTeamState(issueId, deps);
      console.log(formatTeamStatus(state));
    } else {
      // Show all active teams (non-complete)
      const teams = await listTeams(deps);
      const activeTeams = teams.filter((t) => t.phase !== "complete");

      if (activeTeams.length === 0) {
        console.log("No teams found");
        return;
      }

      console.log("Active Teams:\n");
      for (const team of activeTeams) {
        console.log(formatTeamLine(team));
      }
    }
  });

program
  .command("list")
  .description("List all teams (active + completed)")
  .option(
    "--teams-dir <path>",
    "Directory for team workspaces",
    getDefaultTeamsDir()
  )
  .action(async (options: { teamsDir: string }) => {
    const deps = { teamsDir: options.teamsDir };

    const teams = await listTeams(deps);

    if (teams.length === 0) {
      console.log("No teams found");
      return;
    }

    console.log("All Teams:\n");
    for (const team of teams) {
      console.log(formatTeamLine(team));
    }
  });

program
  .command("health")
  .description("Show context health of team agents")
  .argument("[issue-id]", "Specific team to check (optional)")
  .option(
    "--teams-dir <path>",
    "Directory for team workspaces",
    getDefaultTeamsDir()
  )
  .action(async (issueId: string | undefined, options: { teamsDir: string }) => {
    // Health command requires cctx integration
    // For now, show a helpful message
    console.log("Health monitoring requires cctx integration.");
    console.log("");
    console.log("To check context manually:");
    console.log("  cctx <session-id>        # Check specific session");
    console.log("  cctx --percent           # Check current context");

    if (issueId) {
      const deps = { teamsDir: options.teamsDir };
      const exists = await teamExists(issueId, deps);
      if (exists) {
        const state = await readTeamState(issueId, deps);
        console.log("");
        console.log(`Team ${issueId} sessions:`);
        if (state.reviewerSession) {
          console.log(`  Reviewer: ${state.reviewerSession}`);
        }
        if (state.currentWorkerSession) {
          console.log(`  Worker:   ${state.currentWorkerSession}`);
        }
      }
    }
  });

program.parse();
