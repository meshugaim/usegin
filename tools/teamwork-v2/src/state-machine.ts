import {
  type PlanningPhase,
  type PlanningState,
  type WorkspaceDeps,
  readPlanningState as readState,
  updatePlanningState,
} from "./workspace";

// Re-export for tests that import from state-machine
export { readPlanningState } from "./workspace";

/**
 * Valid state transitions for the planning workflow.
 *
 * The workflow follows:
 * setup -> analyzing -> proposing -> reviewing -> approved -> creating_issues -> complete
 *
 * With a revision loop: reviewing -> proposing (for feedback/revisions)
 */
const VALID_TRANSITIONS: Record<PlanningPhase, PlanningPhase[]> = {
  setup: ["analyzing"],
  analyzing: ["proposing"],
  proposing: ["reviewing"],
  reviewing: ["approved", "proposing"], // Can go back to proposing for revisions
  approved: ["creating_issues"],
  creating_issues: ["complete"],
  complete: [], // Terminal state
};

/**
 * Check if a transition from one phase to another is valid.
 */
export function isValidTransition(
  from: PlanningPhase,
  to: PlanningPhase
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get the valid next phases from a given phase.
 */
export function getNextValidPhases(phase: PlanningPhase): PlanningPhase[] {
  return VALID_TRANSITIONS[phase];
}

/**
 * Check if a phase is a terminal state (no further transitions possible).
 */
export function isTerminalPhase(phase: PlanningPhase): boolean {
  return VALID_TRANSITIONS[phase].length === 0;
}

/**
 * Check if escalation is allowed from a given phase.
 * Cannot escalate from terminal phases or if already escalated.
 */
export function canEscalate(
  phase: PlanningPhase,
  alreadyEscalated?: boolean
): boolean {
  if (alreadyEscalated) {
    return false;
  }
  return !isTerminalPhase(phase);
}

/**
 * Get the current phase from workspace state.
 */
export async function getCurrentPhase(
  specId: string,
  deps: WorkspaceDeps
): Promise<PlanningPhase> {
  const state = await readState(specId, deps);
  return state.phase;
}

/**
 * Transition a workspace to a new phase.
 *
 * Validates the transition and updates state with:
 * - phase: the new phase
 * - updatedAt: current timestamp
 * - startedAt: set when transitioning from setup to analyzing
 * - completedAt: set when transitioning to complete
 * - revisionCount: incremented when going from reviewing -> proposing
 *
 * Throws:
 * - "Cannot transition from terminal state" if already in complete
 * - "Invalid transition from X to Y" if the transition is not allowed
 */
export async function transitionTo(
  specId: string,
  newPhase: PlanningPhase,
  deps: WorkspaceDeps
): Promise<void> {
  const state = await readState(specId, deps);
  const currentPhase = state.phase;

  // Check for terminal state
  if (isTerminalPhase(currentPhase)) {
    throw new Error(
      `Cannot transition from terminal state '${currentPhase}'`
    );
  }

  // Validate the transition
  if (!isValidTransition(currentPhase, newPhase)) {
    throw new Error(
      `Invalid transition from '${currentPhase}' to '${newPhase}'`
    );
  }

  // Build the update object
  const updates: Partial<PlanningState> = {
    phase: newPhase,
  };

  // Set startedAt when transitioning from setup to analyzing
  if (currentPhase === "setup" && newPhase === "analyzing") {
    updates.startedAt = new Date().toISOString();
  }

  // Set completedAt when transitioning to complete
  if (newPhase === "complete") {
    updates.completedAt = new Date().toISOString();
  }

  // Increment revisionCount when going from reviewing back to proposing
  if (currentPhase === "reviewing" && newPhase === "proposing") {
    updates.revisionCount = state.revisionCount + 1;
  }

  await updatePlanningState(specId, updates, deps);
}
