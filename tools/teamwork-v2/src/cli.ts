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
import {
  createImplWorkspace,
  readImplState,
} from "./impl-workflow";
import {
  getImplWorkspacePath,
  type ImplState,
} from "./impl-state-machine";

/**
 * Validate spec ID format.
 * Valid formats: ENG-XXX, SPEC-XXX (case insensitive, any number of digits)
 */
function isValidSpecId(specId: string): boolean {
  return /^(ENG|SPEC)-\d+$/i.test(specId);
}

/**
 * Validate slice ID format.
 * Valid formats: ENG-XXX-N, SPEC-XXX-N (case insensitive, any number of digits)
 */
function isValidSliceId(sliceId: string): boolean {
  return /^(ENG|SPEC)-\d+-\d+$/i.test(sliceId);
}

/**
 * Extract spec ID from slice ID (e.g., ENG-123-1 -> ENG-123)
 */
function extractSpecIdFromSliceId(sliceId: string): string {
  const match = sliceId.match(/^((?:ENG|SPEC)-\d+)-\d+$/i);
  return match ? match[1] : "";
}

/**
 * Default timeout for implementation in minutes
 */
const DEFAULT_IMPL_TIMEOUT_MINUTES = 30;

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
 * Check if an impl workspace exists
 */
async function implWorkspaceExists(
  sliceId: string,
  deps: WorkspaceDeps
): Promise<boolean> {
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const statePath = join(workspacePath, "state.json");
  try {
    await access(statePath);
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
  .argument("[spec-id]", "Specific spec ID or slice ID to show status for")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .action(async (specId: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    if (specId) {
      // Show status for specific workspace (could be plan or impl)
      // We check both locations but we need to read the actual state to determine the type
      const planWorkspaceExists = await workspaceExists(specId, deps);
      const implWorkspaceExistsResult = await implWorkspaceExists(specId, deps);

      if (!planWorkspaceExists && !implWorkspaceExistsResult) {
        console.error(`Error: Workspace for ${specId} not found`);
        process.exit(1);
      }

      try {
        // Read state.json to determine the type
        const workspacePath = join(workspacesDir, specId, "state.json");
        const content = await readFile(workspacePath, "utf-8");
        const rawState = JSON.parse(content);

        if (rawState.type === "impl") {
          // Read impl state
          const state = await readImplState(specId, deps);
          console.log(`Status for ${specId}:`);
          console.log(`  Phase: ${state.phase}`);
          console.log(`  Type: ${state.type}`);
          console.log(`  Spec ID: ${state.specId}`);
          console.log(`  Tests: ${state.tests.length}`);
          console.log(`  Current Test Index: ${state.currentTestIndex}`);
          console.log(`  Commits: ${state.commits.length}`);
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
        } else {
          // Read planning state
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
          // Try to read the state.json and check its type
          const workspacePath = join(workspacesDir, ws, "state.json");
          const content = await readFile(workspacePath, "utf-8");
          const state = JSON.parse(content);

          if (state.type === "impl") {
            console.log(`  ${ws}: ${state.type} - ${state.phase}`);
          } else {
            console.log(`  ${ws}: ${state.type} - ${state.phase}`);
          }
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

// Impl command
program
  .command("impl")
  .description("Start implementation workflow for a slice")
  .argument("[slice-id]", "The slice ID to implement (e.g., ENG-123-1)")
  .option(
    "--workspaces-dir <dir>",
    "Directory to store workspaces",
    getDefaultWorkspacesDir()
  )
  .option("--dry-run", "Create workspace only, do not start workflow")
  .option(
    "--timeout <minutes>",
    "Timeout in minutes for the implementation workflow",
    String(DEFAULT_IMPL_TIMEOUT_MINUTES)
  )
  .option("--spec-id <id>", "Associate with parent spec")
  .option("--all <spec-id>", "Implement all slices for a spec sequentially")
  .action(async (sliceId: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const timeoutMinutes = parseInt(options.timeout, 10);
    const deps: WorkspaceDeps = { workspacesDir };

    // Handle --all mode
    if (options.all) {
      const specId = options.all;

      // Check if spec-id is actually provided (not another option)
      if (!specId || specId.startsWith("-")) {
        console.error("Error: Missing required argument: spec-id for --all option");
        console.error("Usage: teamwork-v2 impl --all <spec-id> [options]");
        process.exit(1);
      }

      // Validate spec ID format
      if (!isValidSpecId(specId)) {
        console.error(`Error: Planning workspace for ${specId} not found`);
        process.exit(1);
      }

      // Check if planning workspace exists
      if (!(await workspaceExists(specId, deps))) {
        console.error(`Error: Planning workspace for ${specId} not found`);
        process.exit(1);
      }

      // Read slices from planning workspace
      const planWorkspacePath = getWorkspacePath(specId, deps);
      const slicesPath = join(planWorkspacePath, "slices.json");

      let slices: Array<{
        title: string;
        description: string;
        acceptanceCriteria: string[];
        testApproach: string;
        dependencies: string[];
        isIndependent: boolean;
      }>;

      try {
        const slicesContent = await readFile(slicesPath, "utf-8");
        slices = JSON.parse(slicesContent);
      } catch {
        console.error(`Error: No slices found in planning workspace for ${specId}`);
        process.exit(1);
      }

      if (!slices || slices.length === 0) {
        console.error(`Error: No slices found in planning workspace for ${specId}`);
        process.exit(1);
      }

      console.log(`Starting implementation for ${slices.length} slices`);

      // Implement slices sequentially
      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i];
        const currentSliceId = `${specId}-${i + 1}`;

        console.log(`Implementing slice ${i + 1} of ${slices.length}: ${slice.title}`);

        // Check if workspaces directory is writable
        if (!(await isWritable(workspacesDir))) {
          console.error(`Error: Cannot write to workspaces directory: ${workspacesDir}`);
          process.exit(1);
        }

        // Check if workspace already exists
        if (await implWorkspaceExists(currentSliceId, deps)) {
          console.log(`Workspace for ${currentSliceId} already exists, skipping`);
          continue;
        }

        try {
          // Create the workspace
          await createImplWorkspace(currentSliceId, specId, deps, timeoutMinutes);

          const workspacePath = getImplWorkspacePath(currentSliceId, deps);

          console.log(`Implementation workspace created for ${currentSliceId}`);
          console.log(`Location: ${workspacePath}`);

          if (options.dryRun) {
            console.log("Dry run: workspace created, workflow not started");
          } else {
            // TODO: Start the actual workflow
            console.log("Workflow started...");
          }
        } catch (error) {
          console.error(
            `Error creating workspace for ${currentSliceId}: ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
      }

      console.log("Implementation complete");
      return;
    }

    // Single slice mode
    if (!sliceId) {
      console.error("Error: Missing required argument: slice-id");
      console.error("Usage: teamwork-v2 impl <slice-id> [options]");
      console.error("Or use: teamwork-v2 impl --all <spec-id> [options]");
      process.exit(1);
    }

    // Validate slice ID format
    if (!isValidSliceId(sliceId)) {
      console.error(`Error: Invalid slice ID format: ${sliceId}`);
      console.error("Expected format: ENG-XXX-N or SPEC-XXX-N (e.g., ENG-123-1, SPEC-456-2)");
      process.exit(1);
    }

    // Get spec ID from option or extract from slice ID
    const specId = options.specId || extractSpecIdFromSliceId(sliceId);

    // Check if workspaces directory is writable
    if (!(await isWritable(workspacesDir))) {
      console.error(`Error: Cannot write to workspaces directory: ${workspacesDir}`);
      process.exit(1);
    }

    // Check if workspace already exists
    if (await implWorkspaceExists(sliceId, deps)) {
      console.error(`Error: Workspace for ${sliceId} already exists`);
      process.exit(1);
    }

    try {
      // Create the workspace
      await createImplWorkspace(sliceId, specId, deps, timeoutMinutes);

      const workspacePath = getImplWorkspacePath(sliceId, deps);

      console.log(`Implementation workspace created for ${sliceId}`);
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

// Parse and run
program.parse();
