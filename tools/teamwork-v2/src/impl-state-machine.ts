import { mkdir, writeFile, readFile, appendFile } from "fs/promises";
import { join } from "path";

/**
 * Dependency injection for workspace operations
 */
export interface WorkspaceDeps {
  workspacesDir: string;
}

/**
 * Implementation phases for the TDD workflow
 */
export type ImplPhase =
  | "setup"
  | "writing_tests"
  | "reviewing_tests"
  | "tests_approved"
  | "implementing"
  | "reviewing_impl"
  | "verifying"
  | "complete";

/**
 * Test status for individual tests in the slice
 */
export interface TestStatus {
  name: string;
  status: "pending" | "failing" | "passing";
  commitHash?: string;
}

/**
 * Implementation state stored in state.json
 */
export interface ImplState {
  type: "impl";
  sliceId: string;
  specId: string;
  linearIssueId?: string; // The actual Linear issue ID (e.g., ENG-1258) for this slice
  phase: ImplPhase;
  startedAt?: string;
  completedAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  tests: TestStatus[];
  currentTestIndex: number;
  commits: string[];
  timeoutMinutes: number;
  phaseStartedAt?: string;
  linearIssueStatus?: string;
  createdAt: string;
  updatedAt: string;
  // Retry & recovery fields
  attemptCount: number;
  failedAt?: string;
  failureReason?: string;
  abortedAt?: string;
  abortReason?: string;
  // Health monitoring fields (ENG-1272)
  contextUtilization?: number;
  lastHealthCheck?: string;
  handoffCount?: number;
  lastHandoffAt?: string;
}

/**
 * Valid state transitions for the implementation workflow.
 *
 * The workflow follows TDD principles:
 * setup -> writing_tests -> reviewing_tests -> tests_approved -> implementing -> reviewing_impl -> verifying -> complete
 *
 * With revision loops:
 * - reviewing_tests -> writing_tests (for feedback/revisions)
 * - reviewing_impl -> implementing (for feedback/revisions)
 * - verifying -> implementing (for regression fixes)
 */
const VALID_IMPL_TRANSITIONS: Record<ImplPhase, ImplPhase[]> = {
  setup: ["writing_tests"],
  writing_tests: ["reviewing_tests"],
  reviewing_tests: ["tests_approved", "writing_tests"], // Can go back for revisions
  tests_approved: ["implementing"],
  implementing: ["reviewing_impl"],
  reviewing_impl: ["verifying", "implementing"], // Can go back for revisions
  verifying: ["complete", "implementing"], // Can go back to fix regressions
  complete: [], // Terminal state
};

/**
 * Check if a transition from one phase to another is valid.
 */
export function isValidImplTransition(
  from: ImplPhase,
  to: ImplPhase
): boolean {
  return VALID_IMPL_TRANSITIONS[from].includes(to);
}

/**
 * Get the valid next phases from a given phase.
 */
export function getNextValidImplPhases(phase: ImplPhase): ImplPhase[] {
  return VALID_IMPL_TRANSITIONS[phase];
}

/**
 * Check if a phase is a terminal state (no further transitions possible).
 */
export function isImplTerminalPhase(phase: ImplPhase): boolean {
  return VALID_IMPL_TRANSITIONS[phase].length === 0;
}

/**
 * Get the workspace path for a slice ID
 */
export function getImplWorkspacePath(sliceId: string, deps: WorkspaceDeps): string {
  return join(deps.workspacesDir, sliceId);
}

/**
 * Validate that a state object has the required ImplState schema.
 * Throws descriptive errors if validation fails.
 */
export function validateImplState(state: unknown, sliceId: string): ImplState {
  if (!state || typeof state !== "object") {
    throw new Error(
      `Invalid state.json for ${sliceId}: not an object. ` +
      `Use 'team impl' to create workspaces properly.`
    );
  }

  const obj = state as Record<string, unknown>;

  // Check required fields
  const requiredFields = ["type", "sliceId", "phase", "tests", "commits"];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new Error(
        `Invalid state.json for ${sliceId}: missing '${field}'. ` +
        `This file should only be modified via CLI commands (team phase, team commit). ` +
        `Did an agent write this directly?`
      );
    }
  }

  // Check type field
  if (obj.type !== "impl") {
    throw new Error(
      `Invalid state.json for ${sliceId}: type must be 'impl', got '${obj.type}'. ` +
      `Use 'team impl' to create implementation workspaces.`
    );
  }

  // Check phase is valid
  const validPhases: ImplPhase[] = [
    "setup", "writing_tests", "reviewing_tests", "tests_approved",
    "implementing", "reviewing_impl", "verifying", "complete"
  ];
  if (!validPhases.includes(obj.phase as ImplPhase)) {
    throw new Error(
      `Invalid state.json for ${sliceId}: invalid phase '${obj.phase}'. ` +
      `Valid phases: ${validPhases.join(", ")}`
    );
  }

  // Check tests is array
  if (!Array.isArray(obj.tests)) {
    throw new Error(
      `Invalid state.json for ${sliceId}: 'tests' must be an array.`
    );
  }

  // Check commits is array
  if (!Array.isArray(obj.commits)) {
    throw new Error(
      `Invalid state.json for ${sliceId}: 'commits' must be an array.`
    );
  }

  return state as ImplState;
}

/**
 * Read implementation state from workspace with schema validation
 */
export async function readImplState(
  sliceId: string,
  deps: WorkspaceDeps
): Promise<ImplState> {
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const statePath = join(workspacePath, "state.json");
  const content = await readFile(statePath, "utf-8");
  const parsed = JSON.parse(content);
  return validateImplState(parsed, sliceId);
}

/**
 * Update implementation state
 */
export async function updateImplState(
  sliceId: string,
  updates: Partial<ImplState>,
  deps: WorkspaceDeps
): Promise<ImplState> {
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const statePath = join(workspacePath, "state.json");

  const currentState = await readImplState(sliceId, deps);
  const newState: ImplState = {
    ...currentState,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(statePath, JSON.stringify(newState, null, 2));
  return newState;
}

/**
 * Transition a workspace to a new phase.
 *
 * Validates the transition and updates state with:
 * - phase: the new phase
 * - updatedAt: current timestamp
 * - phaseStartedAt: current timestamp (resets for each phase)
 * - startedAt: set when transitioning from setup
 * - completedAt: set when transitioning to complete
 *
 * Throws:
 * - "Cannot transition from terminal state" if already in complete
 * - "Invalid transition from X to Y" if the transition is not allowed
 */
export async function transitionImplTo(
  sliceId: string,
  newPhase: ImplPhase,
  deps: WorkspaceDeps
): Promise<void> {
  const state = await readImplState(sliceId, deps);
  const currentPhase = state.phase;

  // Check for terminal state
  if (isImplTerminalPhase(currentPhase)) {
    throw new Error(
      `Cannot transition from terminal state '${currentPhase}'`
    );
  }

  // Validate the transition
  if (!isValidImplTransition(currentPhase, newPhase)) {
    throw new Error(
      `Invalid transition from '${currentPhase}' to '${newPhase}'`
    );
  }

  // Build the update object
  const now = new Date().toISOString();
  const updates: Partial<ImplState> = {
    phase: newPhase,
    phaseStartedAt: now,
  };

  // Set startedAt when transitioning from setup
  if (currentPhase === "setup") {
    updates.startedAt = now;
  }

  // Set completedAt when transitioning to complete
  if (newPhase === "complete") {
    updates.completedAt = now;
  }

  await updateImplState(sliceId, updates, deps);
}

/**
 * Record a commit hash for the slice.
 * Appends the hash to the commits array and emits an event.
 */
export async function recordCommit(
  sliceId: string,
  commitHash: string,
  deps: WorkspaceDeps
): Promise<void> {
  const state = await readImplState(sliceId, deps);

  // Check if commit already recorded (idempotent)
  if (state.commits.includes(commitHash)) {
    return;
  }

  // Append commit to array
  const updatedCommits = [...state.commits, commitHash];
  await updateImplState(sliceId, { commits: updatedCommits }, deps);

  // Emit event
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const eventsPath = join(workspacePath, "events.jsonl");
  const event = {
    timestamp: new Date().toISOString(),
    event: "commit_recorded",
    data: {
      sliceId,
      commitHash,
      commitIndex: updatedCommits.length,
    },
  };
  await appendFile(eventsPath, JSON.stringify(event) + "\n");
}
