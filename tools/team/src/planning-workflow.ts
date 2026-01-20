import {
  appendTeamEvent,
  readTeamState,
  updateTeamState,
  TeamWorkspaceDeps,
  TeamState,
} from "./workspace";

/**
 * Planning-specific state that extends TeamState
 */
export interface PlanningState extends TeamState {
  startedAt?: string;
  completedAt?: string;
  revisionCount?: number;
  escalated?: boolean;
  escalatedAt?: string;
}

/**
 * Dependencies for planning workflow operations
 */
export interface PlanningWorkflowDeps extends TeamWorkspaceDeps {
  timeoutMinutes?: number;
}

/**
 * Phase event types for planning workflow
 */
export type PhaseEventType =
  | "analysis_start"
  | "slices_proposed"
  | "review_start"
  | "review_feedback"
  | "review_approved"
  | "creating_issues"
  | "planning_complete";

/**
 * Read planning state from workspace
 */
export async function readPlanningState(
  issueId: string,
  deps: TeamWorkspaceDeps
): Promise<PlanningState> {
  return readTeamState(issueId, deps) as Promise<PlanningState>;
}

/**
 * Initialize planning state with startedAt timestamp
 */
export async function initializePlanningState(
  issueId: string,
  deps: TeamWorkspaceDeps
): Promise<PlanningState> {
  const now = new Date().toISOString();
  return updateTeamState(issueId, { startedAt: now } as Partial<TeamState>, deps) as Promise<PlanningState>;
}

/**
 * Emit a phase event and update state accordingly
 */
export async function emitPhaseEvent(
  issueId: string,
  eventType: PhaseEventType,
  data: Record<string, unknown>,
  deps: TeamWorkspaceDeps
): Promise<void> {
  // Emit the event first
  await appendTeamEvent(issueId, eventType, data, deps);

  // Update state based on event type
  const now = new Date().toISOString();
  const currentState = await readPlanningState(issueId, deps);

  switch (eventType) {
    case "analysis_start":
      // Set startedAt only if not already set
      if (!currentState.startedAt) {
        await updateTeamState(issueId, { startedAt: now } as Partial<TeamState>, deps);
      }
      break;

    case "slices_proposed":
      await updateTeamState(issueId, { phase: "proposed" }, deps);
      break;

    case "review_start":
      await updateTeamState(issueId, { phase: "reviewing" }, deps);
      break;

    case "review_feedback":
      if (data.feedbackType === "revision_requested") {
        const revisionCount = (currentState.revisionCount ?? 0) + 1;
        await updateTeamState(
          issueId,
          { phase: "revising", revisionCount } as Partial<TeamState>,
          deps
        );
      }
      break;

    case "review_approved":
      await updateTeamState(issueId, { phase: "approved" }, deps);
      break;

    case "creating_issues":
      await updateTeamState(issueId, { phase: "creating_issues" }, deps);
      break;

    case "planning_complete":
      await updateTeamState(
        issueId,
        { phase: "complete", completedAt: now } as Partial<TeamState>,
        deps
      );
      break;
  }
}

/**
 * Check if planning has timed out
 */
export async function isPlanningTimedOut(
  issueId: string,
  deps: PlanningWorkflowDeps
): Promise<boolean> {
  const state = await readPlanningState(issueId, deps);

  // Completed planning is never timed out
  if (state.phase === "complete") {
    return false;
  }

  // If no startedAt, cannot be timed out
  if (!state.startedAt) {
    return false;
  }

  const timeoutMinutes = deps.timeoutMinutes ?? 60;
  const startedAt = new Date(state.startedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - startedAt) / (1000 * 60);

  return elapsedMinutes > timeoutMinutes;
}

/**
 * Escalation data for timeout events
 */
export interface EscalationData {
  reason: string;
  currentPhase: string;
  elapsedMinutes: number;
}

/**
 * Emit an escalation event for timed out planning
 */
export async function emitEscalation(
  issueId: string,
  data: EscalationData,
  deps: TeamWorkspaceDeps
): Promise<void> {
  const state = await readPlanningState(issueId, deps);

  // Cannot escalate already escalated planning
  if (state.escalated) {
    throw new Error("already escalated");
  }

  // Cannot escalate completed planning
  if (state.phase === "complete") {
    throw new Error("cannot escalate completed");
  }

  const now = new Date().toISOString();

  // Emit the escalation event
  await appendTeamEvent(issueId, "timeout_escalation", data as unknown as Record<string, unknown>, deps);

  // Update state with escalation info
  await updateTeamState(
    issueId,
    { escalated: true, escalatedAt: now } as Partial<TeamState>,
    deps
  );
}
