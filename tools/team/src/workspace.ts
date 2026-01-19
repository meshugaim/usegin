import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
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
  createdAt: string;
  updatedAt: string;
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
  const now = new Date().toISOString();
  const baseState = {
    type,
    issueId,
    createdAt: now,
    updatedAt: now,
  };

  if (type === "plan") {
    return {
      ...baseState,
      phase: "analysis",
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
  const progressContent = type === "plan"
    ? `# Planning Team Progress

Issue: ${issueId}
Started: ${state.createdAt}

## Log

`
    : `# Implementation Team Progress

Issue: ${issueId}
Started: ${state.createdAt}

## Log

`;
  await writeFile(join(workspacePath, "progress.md"), progressContent);

  // Create slice.md for planning teams
  if (type === "plan") {
    const sliceContent = `# Spec Issue: ${issueId}

The spec content will be loaded from Linear by the planning team.

## Instructions

The planning team worker should:
1. Read the spec from Linear: \`plan show ${issueId}\`
2. Analyze the spec and propose vertical slices
3. For each slice, define acceptance criteria and test approach
4. Return proposal to reviewer for feedback

The reviewer will verify coverage and coherence before creating Linear sub-issues.
`;
    await writeFile(join(workspacePath, "slice.md"), sliceContent);
  }

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

/**
 * Read team state from workspace
 */
export async function readTeamState(
  issueId: string,
  deps: TeamWorkspaceDeps
): Promise<TeamState> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);
  const statePath = join(workspacePath, "state.json");
  const content = await readFile(statePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Update team state
 */
export async function updateTeamState(
  issueId: string,
  updates: Partial<TeamState>,
  deps: TeamWorkspaceDeps
): Promise<TeamState> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);
  const statePath = join(workspacePath, "state.json");

  const currentState = await readTeamState(issueId, deps);
  const newState: TeamState = {
    ...currentState,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(statePath, JSON.stringify(newState, null, 2));
  return newState;
}

/**
 * Append event to events.jsonl
 */
export async function appendTeamEvent(
  issueId: string,
  event: string,
  data: Record<string, unknown>,
  deps: TeamWorkspaceDeps
): Promise<void> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);
  const eventsPath = join(workspacePath, "events.jsonl");

  const eventEntry: TeamEvent = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  await Bun.write(eventsPath, JSON.stringify(eventEntry) + "\n", {
    // @ts-ignore - Bun's append mode
    flags: "a",
  });
}

/**
 * Append to progress.md log
 */
export async function appendProgress(
  issueId: string,
  message: string,
  deps: TeamWorkspaceDeps
): Promise<void> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);
  const progressPath = join(workspacePath, "progress.md");

  const timestamp = new Date().toISOString();
  const entry = `- [${timestamp}] ${message}\n`;

  await Bun.write(progressPath, entry, {
    // @ts-ignore - Bun's append mode
    flags: "a",
  });
}

/**
 * Check if a team workspace exists
 */
export async function teamExists(
  issueId: string,
  deps: TeamWorkspaceDeps
): Promise<boolean> {
  const workspacePath = getTeamWorkspacePath(issueId, deps);
  const statePath = join(workspacePath, "state.json");
  return Bun.file(statePath).exists();
}

/**
 * List all team workspaces
 */
export async function listTeams(
  deps: TeamWorkspaceDeps
): Promise<TeamState[]> {
  const teamsDir = deps.teamsDir;

  // Check if teams directory exists
  let dirStat;
  try {
    dirStat = await stat(teamsDir);
  } catch {
    return [];
  }

  if (!dirStat.isDirectory()) {
    return [];
  }

  // Read all subdirectories
  let entries: string[];
  try {
    entries = await readdir(teamsDir);
  } catch {
    return [];
  }

  // Read state from each team workspace
  const teams: TeamState[] = [];
  for (const entry of entries) {
    // Skip hidden files and non-ENG directories
    if (entry.startsWith(".") || !entry.startsWith("ENG-")) {
      continue;
    }

    try {
      const state = await readTeamState(entry, deps);
      teams.push(state);
    } catch {
      // Skip directories without valid state.json
      continue;
    }
  }

  // Sort by updatedAt (most recent first)
  teams.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });

  return teams;
}
