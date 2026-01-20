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
 * Read implementation state from workspace
 */
export async function readImplState(
  sliceId: string,
  deps: WorkspaceDeps
): Promise<ImplState> {
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const statePath = join(workspacePath, "state.json");
  const content = await readFile(statePath, "utf-8");
  return JSON.parse(content);
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
