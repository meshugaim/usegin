import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join } from "path";

/**
 * Dependency injection for workspace operations
 */
export interface WorkspaceDeps {
  workspacesDir: string;
}

/**
 * Planning phases for the workflow
 */
export type PlanningPhase =
  | "setup"
  | "analyzing"
  | "proposing"
  | "reviewing"
  | "approved"
  | "creating_issues"
  | "complete";

/**
 * Planning state stored in state.json
 */
export interface PlanningState {
  type: "plan";
  specId: string;
  phase: PlanningPhase;
  startedAt?: string;
  completedAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  revisionCount: number;
  timeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
  // Retry & recovery fields
  attemptCount: number;
  failedAt?: string;
  failureReason?: string;
  abortedAt?: string;
  abortReason?: string;
}

/**
 * Options for creating a planning workspace
 */
export interface CreatePlanningWorkspaceOptions {
  timeoutMinutes?: number;
}

/**
 * Event log entry for events.jsonl
 */
export interface WorkspaceEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * Get the workspace path for a spec ID
 */
export function getWorkspacePath(specId: string, deps: WorkspaceDeps): string {
  return join(deps.workspacesDir, specId);
}

/**
 * Default timeout in minutes
 */
export const DEFAULT_TIMEOUT_MINUTES = 60;

/**
 * Create initial planning state
 */
function createInitialState(
  specId: string,
  options: CreatePlanningWorkspaceOptions = {}
): PlanningState {
  const now = new Date().toISOString();
  return {
    type: "plan",
    specId,
    phase: "setup",
    revisionCount: 0,
    timeoutMinutes: options.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
  };
}

/**
 * Generate progress.md content with phase checklist
 */
function generateProgressContent(specId: string): string {
  return `# Planning Progress

Spec: ${specId}

## Phases

- [ ] Setup
- [ ] Analyzing
- [ ] Proposing
- [ ] Reviewing
- [ ] Approved
- [ ] Creating Issues
- [ ] Complete

## Log

`;
}

/**
 * Check if a workspace exists
 */
export async function workspaceExists(
  specId: string,
  deps: WorkspaceDeps
): Promise<boolean> {
  const workspacePath = getWorkspacePath(specId, deps);
  const statePath = join(workspacePath, "state.json");
  try {
    await access(statePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a planning workspace with all necessary files and directories
 */
export async function createPlanningWorkspace(
  specId: string,
  deps: WorkspaceDeps,
  options: CreatePlanningWorkspaceOptions = {}
): Promise<void> {
  const workspacePath = getWorkspacePath(specId, deps);

  // Check if workspace already exists
  if (await workspaceExists(specId, deps)) {
    throw new Error(`Workspace for ${specId} already exists`);
  }

  // Create main workspace directory
  await mkdir(workspacePath, { recursive: true });

  // Create sessions subdirectory
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  // Create state.json
  const state = createInitialState(specId, options);
  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  // Create progress.md
  const progressContent = generateProgressContent(specId);
  await writeFile(join(workspacePath, "progress.md"), progressContent);

  // Create events.jsonl with workspace_created event
  const createdEvent: WorkspaceEvent = {
    timestamp: new Date().toISOString(),
    event: "workspace_created",
    data: {
      specId,
    },
  };
  await writeFile(
    join(workspacePath, "events.jsonl"),
    JSON.stringify(createdEvent) + "\n"
  );
}

/**
 * Read planning state from workspace
 */
export async function readPlanningState(
  specId: string,
  deps: WorkspaceDeps
): Promise<PlanningState> {
  const workspacePath = getWorkspacePath(specId, deps);
  const statePath = join(workspacePath, "state.json");
  const content = await readFile(statePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Update planning state
 */
export async function updatePlanningState(
  specId: string,
  updates: Partial<PlanningState>,
  deps: WorkspaceDeps
): Promise<PlanningState> {
  const workspacePath = getWorkspacePath(specId, deps);
  const statePath = join(workspacePath, "state.json");

  const currentState = await readPlanningState(specId, deps);
  const newState: PlanningState = {
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
export async function appendWorkspaceEvent(
  specId: string,
  event: string,
  data: Record<string, unknown>,
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = getWorkspacePath(specId, deps);
  const eventsPath = join(workspacePath, "events.jsonl");

  const eventEntry: WorkspaceEvent = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  // Read existing content and append
  let existingContent = "";
  try {
    existingContent = await readFile(eventsPath, "utf-8");
  } catch {
    // File doesn't exist yet, that's fine
  }

  await writeFile(eventsPath, existingContent + JSON.stringify(eventEntry) + "\n");
}
