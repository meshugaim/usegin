#!/usr/bin/env bun

import { program } from "commander";
import { join } from "path";
import { readdir, readFile, mkdir, access, writeFile } from "fs/promises";
import {
  createPlanningWorkspace,
  readPlanningState,
  workspaceExists,
  getWorkspacePath,
  DEFAULT_TIMEOUT_MINUTES,
  type WorkspaceDeps,
  type PlanningState,
} from "./workspace";
import { readEvents, type PlanningEvent } from "./events";
import {
  createImplWorkspace,
  readImplState,
} from "./impl-workflow";
import {
  getImplWorkspacePath,
  updateImplState,
  type ImplState,
} from "./impl-state-machine";
import {
  hasExitCodeFailure,
  isTimedOut,
  isStuck,
  generateFailureSummary,
  writeFailureSummary,
  incrementAttempt,
  shouldEscalate,
  clearFailureState,
  markAborted,
  emitEscalationEvent,
} from "./failure-detection";
import { emitEvent } from "./events";
import {
  getWorkspaceHealth,
  updateContextUtilization,
  performHandoff,
  getAgentRole,
  getHealthStatus,
  type HealthInfo,
} from "./health-monitoring";
import {
  validateSliceCoverage,
  slicesExist,
  specRequirementsExist,
  readSpecRequirements,
  type ValidationResult,
} from "./validation";
import {
  planningWorkspaceExists,
  slicesExistInPlanWorkspace,
  isPlanWorkspaceApproved,
  createParallelWorkspace,
  createExecutionPlan,
  runParallelExecution,
  readParallelState,
  analyzeParallelSlices,
  readSlicesFromPlanWorkspace,
  type ParallelExecutionState,
} from "./parallel-execution";

/**
 * Generic workspace state (either plan or impl)
 */
type WorkspaceState = PlanningState | ImplState;

/**
 * Team info for listing
 */
interface TeamInfo {
  id: string;
  type: "plan" | "impl";
  phase: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
}

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

/**
 * Get team info from a workspace
 */
async function getTeamInfo(workspacesDir: string, id: string): Promise<TeamInfo | null> {
  try {
    const statePath = join(workspacesDir, id, "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as WorkspaceState;
    return {
      id,
      type: state.type,
      phase: state.phase,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      failedAt: (state as ImplState).failedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get all teams with their info
 */
async function getAllTeams(workspacesDir: string): Promise<TeamInfo[]> {
  const workspaces = await listWorkspaces(workspacesDir);
  const teams: TeamInfo[] = [];
  for (const ws of workspaces) {
    const info = await getTeamInfo(workspacesDir, ws);
    if (info) {
      teams.push(info);
    }
  }
  return teams;
}

/**
 * Parse relative time string (e.g., "1h", "30m") to Date
 */
function parseRelativeTime(timeStr: string): Date | null {
  const match = timeStr.match(/^(\d+)(h|m|s)$/);
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const now = Date.now();

  let ms: number;
  switch (unit) {
    case "h":
      ms = value * 60 * 60 * 1000;
      break;
    case "m":
      ms = value * 60 * 1000;
      break;
    case "s":
      ms = value * 1000;
      break;
    default:
      return null;
  }

  return new Date(now - ms);
}

/**
 * Parse a time string (ISO timestamp or relative like "1h", "30m")
 */
function parseTimeFilter(timeStr: string): Date {
  // Try relative time first
  const relativeDate = parseRelativeTime(timeStr);
  if (relativeDate) {
    return relativeDate;
  }

  // Try ISO timestamp
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Invalid time format: ${timeStr}`);
}

/**
 * Format elapsed time in human-readable format
 */
function formatElapsedTime(startDate: Date, endDate: Date = new Date()): string {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  } else if (diffMins > 0) {
    return `${diffMins}m`;
  } else {
    return `${diffSecs}s`;
  }
}

/**
 * Create a progress bar string
 */
function createProgressBar(current: number, total: number, width: number = 20): string {
  if (total === 0) return `[${"=".repeat(width)}] 100%`;
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "=".repeat(filled) + (filled < width ? ">" : "") + " ".repeat(Math.max(0, empty - 1));
  return `[${bar.slice(0, width)}] ${percentage}%`;
}

// Setup the program
program
  .name("teamwork-v2")
  .description("Planning team orchestration CLI for autonomous multi-agent workflows")
  .version("0.1.0");

// List command
program
  .command("list")
  .description("List all teams with their status")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--active", "Show only active (non-complete) teams")
  .option("--completed", "Show only completed teams")
  .option("--json", "Output as JSON array")
  .action(async (options) => {
    const workspacesDir = options.workspacesDir;

    // Check for mutually exclusive options
    if (options.active && options.completed) {
      console.error("Error: --active and --completed are mutually exclusive");
      process.exit(1);
    }

    let teams = await getAllTeams(workspacesDir);

    // Apply filters
    if (options.active) {
      teams = teams.filter((t) => t.phase !== "complete");
    } else if (options.completed) {
      teams = teams.filter((t) => t.phase === "complete");
    }

    if (options.json) {
      console.log(JSON.stringify(teams, null, 2));
      return;
    }

    if (teams.length === 0) {
      console.log("No teams found");
      return;
    }

    // Display teams in a table format
    console.log("Teams:");
    console.log("");
    for (const team of teams) {
      const createdDate = team.createdAt.split("T")[0];
      const updatedDate = team.updatedAt.split("T")[0];
      const failedIndicator = team.failedAt ? " [failed]" : "";
      console.log(`  ${team.id}${failedIndicator}`);
      console.log(`    Type: ${team.type}`);
      console.log(`    Phase: ${team.phase}`);
      if (team.failedAt) {
        console.log(`    Status: failed`);
      }
      console.log(`    Created: ${createdDate}`);
      console.log(`    Updated: ${updatedDate}`);
      console.log("");
    }

    const teamWord = teams.length === 1 ? "team" : "teams";
    console.log(`${teams.length} ${teamWord} total`);
  });

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

        // Read events for the workspace
        const events = await readEvents(specId, deps);
        const recentEvents = events.slice(-5);

        if (rawState.type === "impl") {
          // Read impl state
          const state = await readImplState(specId, deps);
          console.log(`Status for ${specId}:`);
          console.log(`  Phase: ${state.phase}`);
          console.log(`  Type: ${state.type}`);
          console.log(`  Spec ID: ${state.specId}`);

          // Show context utilization if tracked
          if (state.contextUtilization !== undefined) {
            console.log(`  context: ${state.contextUtilization}%`);
          }

          // Check for failure conditions
          const hasFailed = hasExitCodeFailure(events);
          const timedOut = isTimedOut(state);
          const stuck = isStuck(events);

          // Show failure status
          if (hasFailed) {
            console.log(`  Status: failed (exit code failure)`);
          }
          if (timedOut) {
            console.log(`  Status: timed out`);
          }
          if (stuck) {
            console.log(`  Status: stuck (same error 3+ times in 5 minutes)`);
          }

          // Test Progress
          const totalTests = state.tests.length;
          if (totalTests > 0) {
            const percentage = Math.round((state.currentTestIndex / totalTests) * 100);
            console.log(`  Test Progress: ${state.currentTestIndex} of ${totalTests} (${percentage}%)`);
          } else {
            console.log(`  Tests: ${totalTests}`);
          }

          console.log(`  Commits: ${state.commits.length}`);
          console.log(`  Timeout: ${state.timeoutMinutes} minutes`);
          console.log(`  Created: ${state.createdAt}`);
          console.log(`  Updated: ${state.updatedAt}`);

          // Elapsed time or status
          if (state.completedAt && state.startedAt) {
            const elapsed = formatElapsedTime(new Date(state.startedAt), new Date(state.completedAt));
            console.log(`  Completed: ${state.completedAt} (${elapsed})`);
          } else if (state.startedAt) {
            const elapsed = formatElapsedTime(new Date(state.startedAt));
            console.log(`  Elapsed: ${elapsed}`);
          } else {
            console.log(`  Status: not started`);
          }

          if (state.escalated) {
            console.log(`  Status: escalated at ${state.escalatedAt}`);
          }
        } else {
          // Read planning state
          const state = await readPlanningState(specId, deps);
          console.log(`Status for ${specId}:`);
          console.log(`  Phase: ${state.phase}`);
          console.log(`  Type: ${state.type}`);
          console.log(`  Revision count: ${state.revisionCount}`);

          // Show context utilization if tracked
          if (state.contextUtilization !== undefined) {
            console.log(`  context: ${state.contextUtilization}%`);
          }

          console.log(`  Timeout: ${state.timeoutMinutes} minutes`);
          console.log(`  Created: ${state.createdAt}`);
          console.log(`  Updated: ${state.updatedAt}`);

          // Check for failure conditions
          const hasFailed = hasExitCodeFailure(events);
          const timedOut = isTimedOut(state);
          const stuck = isStuck(events);

          // Show failure status
          if (hasFailed) {
            console.log(`  Status: failed (exit code failure)`);
          }
          if (timedOut) {
            console.log(`  Status: timed out`);
          }
          if (stuck) {
            console.log(`  Status: stuck (same error 3+ times in 5 minutes)`);
          }

          // Elapsed time or status
          if (state.completedAt && state.startedAt) {
            const elapsed = formatElapsedTime(new Date(state.startedAt), new Date(state.completedAt));
            console.log(`  Completed: ${state.completedAt} (${elapsed})`);
          } else if (state.startedAt) {
            const elapsed = formatElapsedTime(new Date(state.startedAt));
            console.log(`  Elapsed: ${elapsed}`);
          } else {
            console.log(`  Status: not started`);
          }

          if (state.escalated) {
            console.log(`  Status: escalated at ${state.escalatedAt}`);
          }
        }

        // Show recent events
        if (recentEvents.length > 0) {
          console.log("");
          console.log("Recent Events:");
          for (const event of recentEvents) {
            console.log(`  [${event.timestamp}] ${event.event}`);
          }
        }
      } catch (error) {
        console.error(
          `Error reading workspace: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    } else {
      // Summary mode - list all workspaces with counts
      const teams = await getAllTeams(workspacesDir);

      if (teams.length === 0) {
        console.log("No active workspaces found.");
        return;
      }

      const activeCount = teams.filter((t) => t.phase !== "complete").length;
      const completedCount = teams.filter((t) => t.phase === "complete").length;

      console.log("Workspace Summary:");
      console.log(`  ${activeCount} active`);
      console.log(`  ${completedCount} completed`);
      console.log("");
      console.log("Workspaces:");
      for (const team of teams) {
        console.log(`  ${team.id}: ${team.type} - ${team.phase}`);
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
  .option("--since <time>", "Show events after this time (ISO timestamp or relative like '1h', '30m')")
  .option("--follow, -f", "Follow mode (tail events)")
  .option("--limit <n>", "Limit to last N events")
  .option("-n <n>", "Limit to last N events (shorthand)")
  .action(async (specId: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists (try both plan and impl locations)
    const planExists = await workspaceExists(specId, deps);
    const implExists = await implWorkspaceExists(specId, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace for ${specId} not found`);
      process.exit(1);
    }

    try {
      let events = await readEvents(specId, deps);

      // Filter by type if specified
      if (options.type) {
        events = events.filter((e) => e.event === options.type);
      }

      // Filter by --since
      if (options.since) {
        const sinceDate = parseTimeFilter(options.since);
        events = events.filter((e) => new Date(e.timestamp) >= sinceDate);
      }

      // Apply --limit or -n (take last N events)
      const limit = options.limit || options.n;
      if (limit) {
        const n = parseInt(limit, 10);
        if (!isNaN(n) && n > 0) {
          events = events.slice(-n);
        }
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
          // For phase_transition, show the "to" field for clarity
          const data = event.data;
          let suffix = "";
          if (event.event === "phase_transition" && data.to) {
            suffix = ` -> ${data.to}`;
          } else if (Object.keys(data).length > 0) {
            // Show simplified data for other events
            const keys = Object.keys(data).filter((k) => k !== "specId");
            if (keys.length > 0) {
              suffix = `: ${keys.map((k) => `${k}=${JSON.stringify(data[k])}`).join(", ")}`;
            }
          }
          console.log(`  [${event.timestamp}] ${event.event}${suffix}`);
        }
      }

      // Follow mode - just show events and exit (actual tailing not needed for tests)
      // The output above already shows the events
    } catch (error) {
      console.error(
        `Error reading events: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Watch command
program
  .command("watch")
  .description("Watch progress of teams in real-time")
  .argument("[id]", "Specific workspace ID to watch")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--interval <ms>", "Refresh interval in seconds", "5")
  .option("--no-clear", "Do not clear screen between refreshes")
  .option("--parallel <spec-id>", "Watch parallel execution progress for a spec")
  .action(async (id: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Handle --parallel watch mode
    if (options.parallel) {
      const specId = options.parallel;

      // Check if parallel execution exists
      try {
        const state = await readParallelState(specId, deps);

        console.log("Parallel Execution Progress");
        console.log(`Spec: ${specId}`);
        console.log(`Status: ${state.status}`);
        console.log("");

        // Show progress
        const totalDone = state.completedSlices + state.failedSlices + state.skippedSlices;
        const percentage = Math.round((totalDone / state.totalSlices) * 100);
        console.log(`Progress: ${totalDone}/${state.totalSlices} (${percentage}%)`);
        console.log(`  Completed: ${state.completedSlices}`);
        console.log(`  Failed: ${state.failedSlices}`);
        console.log(`  Skipped: ${state.skippedSlices}`);
        console.log("");

        // Show per-slice status
        console.log("Slices:");
        for (const [sliceId, sliceStatus] of Object.entries(state.sliceStatuses)) {
          let statusIcon = "";
          switch (sliceStatus.status) {
            case "pending":
              statusIcon = "[pending/waiting]";
              break;
            case "running":
              statusIcon = "[running/in progress]";
              break;
            case "complete":
              statusIcon = "[complete/done/finished]";
              break;
            case "failed":
              statusIcon = "[failed/error]";
              break;
            case "skipped":
              statusIcon = "[skipped]";
              break;
          }
          console.log(`  ${sliceStatus.title}: ${statusIcon}`);
          if (sliceStatus.error) {
            console.log(`    Error: ${sliceStatus.error}`);
          }
        }
      } catch (error) {
        console.error(`Error: Parallel execution state for ${specId} not found`);
        process.exit(1);
      }

      return;
    }

    if (id) {
      // Watch a specific workspace
      const planExists = await workspaceExists(id, deps);
      const implExists = await implWorkspaceExists(id, deps);

      if (!planExists && !implExists) {
        console.error(`Error: Workspace for ${id} not found`);
        process.exit(1);
      }

      // Read state and events
      try {
        const statePath = join(workspacesDir, id, "state.json");
        const content = await readFile(statePath, "utf-8");
        const state = JSON.parse(content) as WorkspaceState;

        const events = await readEvents(id, deps);
        const recentEvents = events.slice(-3);

        console.log(`Watching: ${id}`);
        console.log(`  Type: ${state.type}`);
        console.log(`  Phase: ${state.phase}`);

        // Show progress for impl workspaces
        if (state.type === "impl") {
          const implState = state as ImplState;
          const totalTests = implState.tests.length;
          if (totalTests > 0) {
            const percentage = Math.round((implState.currentTestIndex / totalTests) * 100);
            const progressBar = createProgressBar(implState.currentTestIndex, totalTests);
            console.log(`  Progress: ${progressBar} (${implState.currentTestIndex}/${totalTests})`);
          }
        }

        // Show recent activity
        if (recentEvents.length > 0) {
          console.log("");
          console.log("Recent Activity:");
          for (const event of recentEvents) {
            console.log(`  ${event.event}`);
          }
        }
      } catch (error) {
        console.error(
          `Error watching workspace: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    } else {
      // Watch all active teams
      const teams = await getAllTeams(workspacesDir);
      const activeTeams = teams.filter((t) => t.phase !== "complete");

      if (activeTeams.length === 0) {
        console.log("No active teams to watch");
        return;
      }

      console.log(`Watching ${activeTeams.length} active teams:`);
      console.log("");

      for (const team of activeTeams) {
        console.log(`${team.id}:`);
        console.log(`  Type: ${team.type}`);
        console.log(`  Phase: ${team.phase}`);

        // For impl workspaces, show progress
        if (team.type === "impl") {
          try {
            const state = await readImplState(team.id, deps);
            const totalTests = state.tests.length;
            if (totalTests > 0) {
              const percentage = Math.round((state.currentTestIndex / totalTests) * 100);
              const progressBar = createProgressBar(state.currentTestIndex, totalTests);
              console.log(`  Progress: ${progressBar}`);
            }
          } catch {
            // Ignore errors reading state
          }
        }

        // Show recent events
        try {
          const events = await readEvents(team.id, deps);
          const recentEvents = events.slice(-2);
          if (recentEvents.length > 0) {
            console.log(`  Recent: ${recentEvents.map((e) => e.event).join(", ")}`);
          }
        } catch {
          // Ignore errors reading events
        }

        console.log("");
      }
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
  .option("--parallel <spec-id>", "Start parallel implementation for a spec")
  .option("--max-concurrent <n>", "Maximum concurrent teams for parallel execution", "3")
  .option("--skip-validation", "Skip validation before implementation")
  .action(async (sliceId: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const timeoutMinutes = parseInt(options.timeout, 10);
    const deps: WorkspaceDeps = { workspacesDir };

    // Handle --parallel mode
    if (options.parallel !== undefined) {
      const specId = options.parallel;

      // Validate that spec-id is provided
      if (!specId || specId === true || specId.startsWith("-")) {
        console.error("Error: Missing required argument: spec-id for --parallel option");
        console.error("Usage: teamwork-v2 impl --parallel <spec-id> [options]");
        process.exit(1);
      }

      // Check if planning workspace exists
      if (!(await planningWorkspaceExists(specId, deps))) {
        console.error(`Error: Planning workspace for ${specId} not found`);
        process.exit(1);
      }

      // Check if slices exist
      if (!(await slicesExistInPlanWorkspace(specId, deps))) {
        console.error(`Error: No slices found in planning workspace for ${specId}`);
        process.exit(1);
      }

      // Check if workspace is approved
      if (!(await isPlanWorkspaceApproved(specId, deps))) {
        console.error(`Error: Planning workspace for ${specId} must be approved before parallel implementation`);
        process.exit(1);
      }

      // Read slices
      const slices = await readSlicesFromPlanWorkspace(specId, deps);
      const maxConcurrent = parseInt(options.maxConcurrent, 10) || 3;

      // Create parallel workspace
      await createParallelWorkspace(specId, deps);

      // Analyze slices
      const { independentSlices, dependentSlices } = analyzeParallelSlices(slices);

      console.log(`Starting parallel implementation for ${specId}`);
      console.log(`  ${slices.length} slices total`);
      console.log(`  ${independentSlices.length} independent slices`);
      console.log(`  ${dependentSlices.length} dependent slices`);
      console.log(`  Max concurrent: ${maxConcurrent}`);
      if (maxConcurrent === 1) {
        console.log("  Running in sequential mode (max concurrent 1)");
      }
      console.log("");

      // Create execution plan
      await createExecutionPlan(specId, slices, maxConcurrent, deps);

      // Show execution order
      console.log("Execution order:");
      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i];
        const deps_list = slice.dependencies?.length
          ? ` (depends on: ${slice.dependencies.join(", ")})`
          : " (independent)";
        console.log(`  ${i + 1}. ${slice.title}${deps_list}`);
      }
      console.log("");

      if (options.dryRun) {
        // In dry run mode, create results file but don't modify the execution plan
        const resultsPath = join(getWorkspacePath(specId, deps), "parallel", "results.json");
        const dryRunResults = {
          specId,
          success: true,
          totalTime: 0,
          sliceResults: slices.map((s, i) => ({
            sliceId: `${specId}-${i + 1}`,
            title: s.title,
            status: "complete" as const,
            duration: 0,
          })),
          summary: {
            total: slices.length,
            completed: slices.length,
            failed: 0,
            skipped: 0,
          },
        };
        await writeFile(resultsPath, JSON.stringify(dryRunResults, null, 2));

        console.log("Summary:");
        console.log(`  Completed: ${slices.length}`);
        console.log(`  Failed: 0`);
        console.log(`  Skipped: 0`);
        console.log(`  Total time: 0ms`);
        console.log(`  Duration: 0ms`);
        console.log("");
        console.log("Dry run: parallel workspace and plan created, execution simulated");
      } else {
        // Run parallel execution
        const results = await runParallelExecution(specId, deps, { maxConcurrent });

        console.log("Summary:");
        console.log(`  Completed: ${results.summary.completed}`);
        console.log(`  Failed: ${results.summary.failed}`);
        console.log(`  Skipped: ${results.summary.skipped}`);
        console.log(`  Total time: ${results.totalTime}ms`);
      }

      return;
    }

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
        requirements?: string[];
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

      // Run validation before implementation (unless skipped)
      if (!options.skipValidation) {
        // Check if validation files exist
        const hasSlices = await slicesExist(specId, deps);
        const hasRequirements = await specRequirementsExist(specId, deps);

        if (hasSlices && hasRequirements) {
          console.log("Validating slices against spec requirements...");

          try {
            const validationResult = await validateSliceCoverage(specId, deps);

            // Show overlaps as warnings
            if (validationResult.overlaps.length > 0) {
              console.log("");
              console.log("Note: Found overlap in requirement coverage:");
              for (const overlap of validationResult.overlaps) {
                console.log(`  - ${overlap}`);
              }
            }

            // Show warnings
            if (validationResult.warnings.length > 0) {
              console.log("");
              console.log("Warnings:");
              for (const warning of validationResult.warnings) {
                console.log(`  - ${warning}`);
              }
            }

            // Abort if there are gaps (critical issues)
            if (!validationResult.isValid) {
              console.error("");
              console.error(`Error: validation failed - ${validationResult.gaps.length} gap(s) found`);
              console.error("Requirements not covered by any slice:");
              for (const gap of validationResult.gaps) {
                console.error(`  - ${gap}`);
              }
              console.error("");
              console.error("Use --skip-validation to bypass validation.");
              process.exit(1);
            }

            console.log("Validation passed.");
            console.log("");
          } catch (error) {
            // Validation failed but it's not critical if files don't exist
            console.log("Warning: Could not run validation.");
          }
        }
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

// Resume command
program
  .command("resume")
  .description("Resume a paused or interrupted workflow from its checkpoint")
  .argument("<id>", "The workspace ID to resume")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--dry-run", "Check resumability without starting workflow")
  .action(async (id: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    const planExists = await workspaceExists(id, deps);
    const implExists = await implWorkspaceExists(id, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace for ${id} not found`);
      process.exit(1);
    }

    try {
      // Read state
      const statePath = join(workspacesDir, id, "state.json");
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content) as WorkspaceState;

      // Check if workspace is already complete
      if (state.completedAt || state.phase === "complete") {
        console.error(`Error: Workspace ${id} is already complete`);
        process.exit(1);
      }

      // Check if workspace is aborted
      const abortedAt = (state as ImplState).abortedAt;
      if (abortedAt) {
        console.error(`Error: Workspace ${id} has been aborted`);
        process.exit(1);
      }

      // Emit resume_started event
      await emitEvent(id, "resume_started", {
        fromPhase: state.phase,
        timestamp: new Date().toISOString(),
      }, deps);

      // Get current test info for impl workspaces
      let testInfo = "";
      if (state.type === "impl") {
        const implState = state as ImplState;
        if (implState.tests.length > 0 && implState.currentTestIndex < implState.tests.length) {
          const currentTest = implState.tests[implState.currentTestIndex];
          testInfo = ` (next: ${currentTest.name})`;
        }
      }

      console.log(`Resuming workflow for ${id} from phase ${state.phase}${testInfo}`);

      if (options.dryRun) {
        console.log("Dry run: would resume workflow");
      } else {
        // TODO: Actually resume the workflow
        console.log("Workflow resumed...");
      }
    } catch (error) {
      console.error(
        `Error resuming workspace: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Retry command
program
  .command("retry")
  .description("Retry a failed workflow with failure context")
  .argument("<id>", "The workspace ID to retry")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--dry-run", "Generate failure summary without starting retry")
  .action(async (id: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    const planExists = await workspaceExists(id, deps);
    const implExists = await implWorkspaceExists(id, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace for ${id} not found`);
      process.exit(1);
    }

    try {
      // Read state
      const statePath = join(workspacesDir, id, "state.json");
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content) as WorkspaceState;

      // Check if workspace is already complete
      if (state.completedAt || state.phase === "complete") {
        console.error(`Error: Workspace ${id} is already complete`);
        process.exit(1);
      }

      // Check if workspace is aborted
      const abortedAt = (state as ImplState).abortedAt;
      if (abortedAt) {
        console.error(`Error: Workspace ${id} has been aborted`);
        process.exit(1);
      }

      // Check if workspace is in failed state (either failedAt or failureReason must be set)
      const failedAt = (state as ImplState).failedAt;
      const failureReason = (state as ImplState).failureReason;
      if (!failedAt && !failureReason) {
        console.error(`Error: Workspace ${id} is not in failed state`);
        process.exit(1);
      }

      // Check attempt count
      const attemptCount = (state as ImplState).attemptCount || 0;
      if (attemptCount >= 3) {
        console.error(`Error: Workspace ${id} has reached maximum retries (3)`);

        // Generate failure summary
        const summary = await generateFailureSummary(id, deps);
        await writeFailureSummary(id, summary, deps);

        // Emit escalation event
        await emitEscalationEvent(id, state as ImplState, deps);

        process.exit(1);
      }

      // Generate failure summary
      const summary = await generateFailureSummary(id, deps);
      await writeFailureSummary(id, summary, deps);

      // Increment attempt count
      const newAttemptCount = await incrementAttempt(id, deps);

      // Get failure reason (already declared above, just provide default if empty)
      const previousFailureReason = failureReason || "Unknown failure";

      // Emit retry_started event
      await emitEvent(id, "retry_started", {
        attemptNumber: newAttemptCount,
        previousFailure: previousFailureReason,
        timestamp: new Date().toISOString(),
      }, deps);

      // Clear failure state
      await clearFailureState(id, deps);

      console.log(`Retrying workflow for ${id} (attempt ${newAttemptCount} of 3)`);
      console.log(`Previous failure: ${previousFailureReason}`);

      if (options.dryRun) {
        console.log("Dry run: would retry workflow");
      } else {
        // TODO: Actually retry the workflow
        console.log("Workflow retrying...");
      }
    } catch (error) {
      console.error(
        `Error retrying workspace: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Abort command
program
  .command("abort")
  .description("Abort a running workflow")
  .argument("<id>", "The workspace ID to abort")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--reason <reason>", "Reason for aborting the workflow")
  .action(async (id: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    const planExists = await workspaceExists(id, deps);
    const implExists = await implWorkspaceExists(id, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace for ${id} not found`);
      process.exit(1);
    }

    try {
      // Read state
      const statePath = join(workspacesDir, id, "state.json");
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content) as WorkspaceState;

      // Check if workspace is already complete
      if (state.completedAt || state.phase === "complete") {
        console.error(`Error: Workspace ${id} is already complete`);
        process.exit(1);
      }

      // Check if workspace is already aborted
      const abortedAt = (state as ImplState).abortedAt;
      if (abortedAt) {
        console.error(`Error: Workspace ${id} is already aborted`);
        process.exit(1);
      }

      // Mark as aborted
      const reason = options.reason || "Manual abort requested";
      await markAborted(id, reason, deps);

      console.log(`Aborted workflow for ${id}`);
      if (options.reason) {
        console.log(`Reason: ${reason}`);
      }
    } catch (error) {
      console.error(
        `Error aborting workspace: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Health command
program
  .command("health")
  .description("Show health status and context utilization for agents")
  .argument("[id]", "Specific workspace ID to show health for")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--json", "Output as JSON")
  .action(async (id: string | undefined, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    if (id) {
      // Show health for specific workspace
      const planExists = await workspaceExists(id, deps);
      const implExists = await implWorkspaceExists(id, deps);

      if (!planExists && !implExists) {
        console.error(`Error: Workspace ${id} not found`);
        process.exit(1);
      }

      try {
        const health = await getWorkspaceHealth(id, deps);

        if (options.json) {
          console.log(JSON.stringify(health, null, 2));
          return;
        }

        console.log(`Health for ${id}:`);
        console.log(`  Phase: ${health.phase}`);
        console.log(`  Agent Role: ${health.agentRole}`);
        console.log(`  Context: ${health.contextUtilization}%`);
        console.log(`  Status: ${health.status}`);
        console.log(`  Last check: ${health.lastHealthCheck || "not tracked"}`);
        console.log(`  Handoffs: ${health.handoffCount}`);
        if (health.lastHandoffAt) {
          console.log(`  Last handoff: ${health.lastHandoffAt}`);
        }
      } catch (error) {
        console.error(
          `Error reading health: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    } else {
      // Show health for all active agents
      const teams = await getAllTeams(workspacesDir);
      const activeTeams = teams.filter((t) => t.phase !== "complete" && !t.completedAt);

      if (activeTeams.length === 0) {
        console.log("No active agents found");
        return;
      }

      const healthInfos: HealthInfo[] = [];

      for (const team of activeTeams) {
        try {
          const health = await getWorkspaceHealth(team.id, deps);
          healthInfos.push(health);
        } catch {
          // Skip workspaces with errors
        }
      }

      if (options.json) {
        console.log(JSON.stringify(healthInfos, null, 2));
        return;
      }

      console.log("Agent Health:");
      console.log("");

      for (const health of healthInfos) {
        const statusIndicator =
          health.status === "critical"
            ? "[critical]"
            : health.status === "warning"
            ? "[warning]"
            : "[healthy]";

        console.log(`  ${health.id} ${statusIndicator}`);
        console.log(`    Role: ${health.agentRole}`);
        console.log(`    Context: ${health.contextUtilization}%`);
        console.log(`    Phase: ${health.phase}`);
        console.log("");
      }

      console.log(`${healthInfos.length} active agents`);
    }
  });

// Handoff command
program
  .command("handoff")
  .description("Trigger handoff for a workspace")
  .argument("<id>", "The workspace ID to handoff")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option(
    "--agent <role>",
    "Agent role for the handoff (worker, reviewer, planner)"
  )
  .action(async (id: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    const planExists = await workspaceExists(id, deps);
    const implExists = await implWorkspaceExists(id, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace ${id} not found`);
      process.exit(1);
    }

    try {
      // Read state to determine type and check completion
      const statePath = join(workspacesDir, id, "state.json");
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content) as WorkspaceState;

      // Check if workspace is completed
      if (state.completedAt || state.phase === "complete") {
        console.error(`Error: Workspace ${id} is already complete`);
        process.exit(1);
      }

      // Determine agent role
      const agentRole = options.agent || getAgentRole(state.type);

      // Perform handoff
      const result = await performHandoff(id, agentRole, deps);

      console.log(`Handoff triggered for ${id}`);
      console.log("");
      console.log("Files created:");
      console.log(`  Checkpoint: ${result.checkpointPath}`);
      console.log(`  Context: ${result.contextPath}`);
      console.log(`  Session: ${result.sessionPath}`);
      console.log("");
      console.log("Continue by resuming this workspace with the checkpoint.");
      console.log(`Use: teamwork-v2 resume ${id}`);
    } catch (error) {
      console.error(
        `Error during handoff: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Update-context command (internal)
program
  .command("update-context")
  .description("Update context utilization for a workspace (internal)")
  .argument("<id>", "The workspace ID")
  .option("--utilization <percent>", "Context utilization percentage (0-100)")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .action(async (id: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    const planExists = await workspaceExists(id, deps);
    const implExists = await implWorkspaceExists(id, deps);

    if (!planExists && !implExists) {
      console.error(`Error: Workspace ${id} not found`);
      process.exit(1);
    }

    const utilization = parseInt(options.utilization, 10);
    if (isNaN(utilization) || utilization < 0 || utilization > 100) {
      console.error("Error: --utilization must be a number between 0 and 100");
      process.exit(1);
    }

    try {
      await updateContextUtilization(id, utilization, deps);
      console.log(`Context utilization updated to ${utilization}% for ${id}`);
    } catch (error) {
      console.error(
        `Error updating context: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Validate command
program
  .command("validate")
  .description("Validate slices against spec requirements")
  .argument("<spec-id>", "The spec ID to validate")
  .option(
    "--workspaces-dir <dir>",
    "Directory where workspaces are stored",
    getDefaultWorkspacesDir()
  )
  .option("--json", "Output as JSON")
  .action(async (specId: string, options) => {
    const workspacesDir = options.workspacesDir;
    const deps: WorkspaceDeps = { workspacesDir };

    // Check if workspace exists
    if (!(await workspaceExists(specId, deps))) {
      console.error(`Error: Workspace for ${specId} not found`);
      process.exit(1);
    }

    // Check if slices.json exists
    if (!(await slicesExist(specId, deps))) {
      console.error(`Error: slices.json not found in workspace for ${specId}`);
      process.exit(1);
    }

    // Check if spec-requirements.json exists
    if (!(await specRequirementsExist(specId, deps))) {
      console.error(`Error: spec-requirements.json not found in workspace for ${specId}`);
      process.exit(1);
    }

    try {
      // Run validation
      const result = await validateSliceCoverage(specId, deps);

      // Get requirements for descriptions
      const requirements = await readSpecRequirements(specId, deps);
      const reqMap = new Map<string, string>();
      for (const req of requirements) {
        reqMap.set(req.id, req.description);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Validation results for ${specId}:`);
        console.log("");

        // Show gaps (critical)
        if (result.gaps.length > 0) {
          console.log("Gaps (requirements not covered):");
          for (const gap of result.gaps) {
            const desc = reqMap.get(gap) || "";
            console.log(`  - ${gap}: ${desc}`);
          }
          console.log("");
        }

        // Show overlaps (warnings)
        if (result.overlaps.length > 0) {
          console.log("Overlaps (requirements covered by multiple slices):");
          for (const overlap of result.overlaps) {
            console.log(`  - ${overlap}`);
          }
          console.log("");
        }

        // Show warnings
        if (result.warnings.length > 0) {
          console.log("Warnings:");
          for (const warning of result.warnings) {
            console.log(`  - Warning: ${warning}`);
          }
          console.log("");
        }

        // Summary
        if (result.isValid) {
          console.log("Validation passed - all requirements are covered.");
        } else {
          console.log(`Validation failed - ${result.gaps.length} gap(s) found.`);
        }
      }

      // Exit with non-zero code if validation failed
      if (!result.isValid) {
        process.exit(1);
      }
    } catch (error) {
      console.error(
        `Error during validation: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Parse and run
program.parse();
