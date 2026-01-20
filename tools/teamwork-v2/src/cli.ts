#!/usr/bin/env bun

import { program } from "commander";
import { join } from "path";
import { readdir, readFile, mkdir, access } from "fs/promises";
import {
  createPlanningWorkspace,
  readPlanningState,
  workspaceExists,
  getWorkspacePath,
  DEFAULT_TIMEOUT_MINUTES,
  type WorkspaceDeps,
} from "./workspace";
import { readEvents } from "./events";

/**
 * Validate spec ID format.
 * Valid formats: ENG-XXX, SPEC-XXX (case insensitive, any number of digits)
 */
function isValidSpecId(specId: string): boolean {
  return /^(ENG|SPEC)-\d+$/i.test(specId);
}

/**
 * Get the default workspaces directory
 */
function getDefaultWorkspacesDir(): string {
  return join(process.cwd(), ".claude", "teamwork-v2");
}

/**
 * Ensure the workspaces directory exists
 */
async function ensureWorkspacesDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(`Cannot create workspaces directory: ${dir}`);
  }
}

/**
 * Check if a directory is writable
 */
async function isWritable(dir: string): Promise<boolean> {
  try {
    // Try to create the directory if it doesn't exist
    await mkdir(dir, { recursive: true });
    // Check if we can access it
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all workspace spec IDs in a directory
 */
async function listWorkspaces(workspacesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(workspacesDir, { withFileTypes: true });
    const workspaces: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if it has a state.json
        try {
          await access(join(workspacesDir, entry.name, "state.json"));
          workspaces.push(entry.name);
        } catch {
          // Not a valid workspace, skip
        }
      }
    }
    return workspaces;
  } catch {
    return [];
  }
}

// Setup the program
program
  .name("teamwork-v2")
  .description("Planning team orchestration CLI for autonomous multi-agent workflows")
  .version("0.1.0");

// Plan command
program
  .command("plan")
  .description("Start a planning workflow for a spec")
  .argument("<spec-id>", "The spec ID to plan (e.g., ENG-123, SPEC-456)")
  .option(
    "--workspaces-dir <dir>",
    "Directory to store workspaces",
    getDefaultWorkspacesDir()
  )
  .option("--dry-run", "Create workspace only, do not start workflow")
  .option(
    "--timeout <minutes>",
    "Timeout in minutes for the planning workflow",
    String(DEFAULT_TIMEOUT_MINUTES)
  )
  .action(async (specId: string, options) => {
    // Validate spec ID format
    if (!isValidSpecId(specId)) {
      console.error(`Error: Invalid spec ID format: ${specId}`);
      console.error("Expected format: ENG-XXX or SPEC-XXX (e.g., ENG-123, SPEC-456)");
      process.exit(1);
    }

    const workspacesDir = options.workspacesDir;
    const timeoutMinutes = parseInt(options.timeout, 10);

    // Check if workspaces directory is writable
    if (!(await isWritable(workspacesDir))) {
      console.error(`Error: Cannot write to workspaces directory: ${workspacesDir}`);
      process.exit(1);
    }

    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace already exists
    if (await workspaceExists(specId, deps)) {
      console.error(`Error: Workspace for ${specId} already exists`);
      process.exit(1);
    }

    try {
      // Create the workspace
      await createPlanningWorkspace(specId, deps, { timeoutMinutes });

      const workspacePath = getWorkspacePath(specId, deps);

      console.log(`Planning workspace created for ${specId}`);
      console.log(`Location: ${workspacePath}`);

      if (options.dryRun) {
        console.log("Dry run: workspace created, workflow not started");
      } else {
        // TODO: Start the actual workflow
        console.log("Workflow started...");
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Show status of workspaces")
  .argument("[spec-id]", "Specific spec ID to show status for")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .action(async (specId: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    if (specId) {
      // Show status for specific workspace
      if (!(await workspaceExists(specId, deps))) {
        console.error(`Error: Workspace for ${specId} not found`);
        process.exit(1);
      }

      try {
        const state = await readPlanningState(specId, deps);
        console.log(`Status for ${specId}:`);
        console.log(`  Phase: ${state.phase}`);
        console.log(`  Type: ${state.type}`);
        console.log(`  Revision count: ${state.revisionCount}`);
        console.log(`  Timeout: ${state.timeoutMinutes} minutes`);
        console.log(`  Created: ${state.createdAt}`);
        console.log(`  Updated: ${state.updatedAt}`);
        if (state.startedAt) {
          console.log(`  Started: ${state.startedAt}`);
        }
        if (state.completedAt) {
          console.log(`  Completed: ${state.completedAt}`);
        }
        if (state.escalated) {
          console.log(`  Escalated: ${state.escalatedAt}`);
        }
      } catch (error) {
        console.error(
          `Error reading workspace: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    } else {
      // List all workspaces
      const workspaces = await listWorkspaces(workspacesDir);

      if (workspaces.length === 0) {
        console.log("No active workspaces found.");
        return;
      }

      console.log("Active workspaces:");
      for (const ws of workspaces) {
        try {
          const state = await readPlanningState(ws, deps);
          console.log(`  ${ws}: ${state.phase}`);
        } catch {
          console.log(`  ${ws}: (error reading state)`);
        }
      }
    }
  });

// Events command
program
  .command("events")
  .description("Query events from a workspace")
  .argument("<spec-id>", "The spec ID to query events for")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--json", "Output as JSON array")
  .option("--type <type>", "Filter events by type")
  .action(async (specId: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    if (!(await workspaceExists(specId, deps))) {
      console.error(`Error: Workspace for ${specId} not found`);
      process.exit(1);
    }

    try {
      let events = await readEvents(specId, deps);

      // Filter by type if specified
      if (options.type) {
        events = events.filter((e) => e.event === options.type);
      }

      if (options.json) {
        console.log(JSON.stringify(events, null, 2));
      } else {
        if (events.length === 0) {
          console.log("No events found.");
          return;
        }

        console.log(`Events for ${specId}:`);
        for (const event of events) {
          console.log(
            `  [${event.timestamp}] ${event.event}: ${JSON.stringify(event.data)}`
          );
        }
      }
    } catch (error) {
      console.error(
        `Error reading events: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Parse and run
program.parse();
