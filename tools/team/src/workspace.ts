import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Dependency injection for team workspace operations
 */
export interface TeamWorkspaceDeps {
  teamsDir: string;
}

/**
 * Team type - either planning or implementation
 */
export type TeamType = "plan" | "impl";

/**
 * Team state stored in state.json
 */
export interface TeamState {
  type: TeamType;
  issueId: string;
  phase: string;
  testsApproved?: boolean;
  subtasksTotal?: number;
  subtasksComplete?: number;
  currentWorkerSession?: string;
  reviewerSession?: string;
  blockers?: string[];
  lastUpdated: string;
}

/**
 * Event log entry for events.jsonl
 */
export interface TeamEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * Get the workspace path for a team
 */
export function getTeamWorkspacePath(
  issueId: string,
  deps: TeamWorkspaceDeps
): string {
  return join(deps.teamsDir, issueId);
}

/**
 * Create initial team state based on team type
 */
function createInitialState(issueId: string, type: TeamType): TeamState {
  const baseState = {
    type,
    issueId,
    lastUpdated: new Date().toISOString(),
  };

  if (type === "plan") {
    return {
      ...baseState,
      phase: "planning",
    };
  } else {
    return {
      ...baseState,
      phase: "writing_tests",
      testsApproved: false,
      subtasksTotal: 0,
      subtasksComplete: 0,
      blockers: [],
    };
  }
}

/**
 * Create a team workspace with all necessary files and directories
 */
export async function createTeamWorkspace(
  issueId: string,
  type: TeamType,
  deps: TeamWorkspaceDeps
): Promise<void> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);

  // Create main workspace directory
  await mkdir(workspacePath, { recursive: true });

  // Create subdirectories
  await mkdir(join(workspacePath, "sessions"), { recursive: true });
  await mkdir(join(workspacePath, "checkpoints"), { recursive: true });

  // Create state.json
  const state = createInitialState(issueId, type);
  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  // Create progress.md
  const progressContent = `# Team Progress: ${issueId}

Type: ${type}
Started: ${state.lastUpdated}

## Log

`;
  await writeFile(join(workspacePath, "progress.md"), progressContent);

  // Create events.jsonl with team_spawn event
  const spawnEvent: TeamEvent = {
    timestamp: new Date().toISOString(),
    event: "team_spawn",
    data: {
      teamId: issueId,
      type,
      issueId,
    },
  };
  await writeFile(
    join(workspacePath, "events.jsonl"),
    JSON.stringify(spawnEvent) + "\n"
  );
}
