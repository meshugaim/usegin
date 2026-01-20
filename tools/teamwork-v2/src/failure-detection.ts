import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { type WorkspaceDeps, type PlanningState, getWorkspacePath } from "./workspace";
import { type ImplState, getImplWorkspacePath, readImplState, updateImplState } from "./impl-state-machine";
import { type PlanningEvent, readEvents, emitEvent } from "./events";

/**
 * Failure summary for a workspace
 */
export interface FailureSummary {
  attemptedWork: string;
  failureDetails: string;
  suggestions: string[];
  timestamp: string;
}

/**
 * Check if events contain an exit code failure (worker_failed with non-zero exit code)
 */
export function hasExitCodeFailure(events: PlanningEvent[]): boolean {
  return events.some(
    (e) =>
      e.event === "worker_failed" &&
      typeof e.data.exitCode === "number" &&
      e.data.exitCode !== 0
  );
}

/**
 * Get the latest failure event details
 */
export function getLatestFailure(events: PlanningEvent[]): {
  exitCode?: number;
  error?: string;
} | null {
  const failureEvents = events.filter((e) => e.event === "worker_failed");
  if (failureEvents.length === 0) return null;

  const latest = failureEvents[failureEvents.length - 1];
  return {
    exitCode: latest.data.exitCode as number | undefined,
    error: latest.data.error as string | undefined,
  };
}

/**
 * Check if a workspace has timed out based on startedAt and timeoutMinutes
 */
export function isTimedOut(state: PlanningState | ImplState): boolean {
  if (!state.startedAt) return false;

  const startTime = new Date(state.startedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - startTime) / 1000 / 60;

  return elapsedMinutes >= state.timeoutMinutes;
}

/**
 * Check if the workflow is stuck - same error occurring 3+ times in the last 5 minutes
 */
export function isStuck(events: PlanningEvent[]): boolean {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  // Get all worker_failed events in the last 5 minutes
  const recentFailures = events.filter((e) => {
    if (e.event !== "worker_failed") return false;
    const eventTime = new Date(e.timestamp).getTime();
    return eventTime >= fiveMinutesAgo;
  });

  if (recentFailures.length < 3) return false;

  // Count occurrences of each error message
  const errorCounts = new Map<string, number>();
  for (const event of recentFailures) {
    const error = String(event.data.error || "");
    errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
  }

  // Check if any error occurred 3+ times
  for (const count of errorCounts.values()) {
    if (count >= 3) return true;
  }

  return false;
}

/**
 * Generate a failure summary for a workspace
 */
export async function generateFailureSummary(
  specId: string,
  deps: WorkspaceDeps
): Promise<FailureSummary> {
  // Try to read as impl state first, then as planning state
  let state: ImplState | PlanningState;
  let events: PlanningEvent[];

  try {
    state = await readImplState(specId, deps);
    events = await readEvents(specId, deps);
  } catch {
    // If not an impl workspace, try reading as planning workspace
    const workspacePath = getWorkspacePath(specId, deps);
    const statePath = join(workspacePath, "state.json");
    const content = await readFile(statePath, "utf-8");
    state = JSON.parse(content) as PlanningState;
    events = await readEvents(specId, deps);
  }

  // Build attempted work description
  let attemptedWork = `Phase: ${state.phase}`;
  if (state.type === "impl") {
    const implState = state as ImplState;
    if (implState.tests.length > 0) {
      const currentTest = implState.tests[implState.currentTestIndex];
      if (currentTest) {
        attemptedWork += `, working on test: ${currentTest.name}`;
      }
    }
  }

  // Build failure details from state and events
  let failureDetails = state.failureReason || "";

  // Append details from events
  const failureEvents = events.filter((e) => e.event === "worker_failed");
  if (failureEvents.length > 0) {
    const latestFailure = failureEvents[failureEvents.length - 1];
    if (latestFailure.data.error) {
      failureDetails += (failureDetails ? "; " : "") + latestFailure.data.error;
    }
  }

  if (!failureDetails) {
    failureDetails = "Unknown failure";
  }

  // Generate suggestions based on failure type
  const suggestions: string[] = [];

  if (failureDetails.toLowerCase().includes("typescript")) {
    suggestions.push("Check for TypeScript compilation errors");
    suggestions.push("Run `tsc --noEmit` to see all type errors");
  }

  if (failureDetails.toLowerCase().includes("oom") || failureDetails.includes("137")) {
    suggestions.push("Increase memory allocation for the worker");
    suggestions.push("Check for memory leaks in the implementation");
  }

  if (failureDetails.toLowerCase().includes("timeout")) {
    suggestions.push("Consider breaking the task into smaller subtasks");
    suggestions.push("Increase timeout configuration");
  }

  if (failureDetails.toLowerCase().includes("test")) {
    suggestions.push("Review the failing test and implementation");
    suggestions.push("Check test assumptions and assertions");
  }

  // Default suggestions if none matched
  if (suggestions.length === 0) {
    suggestions.push("Review the error logs for more details");
    suggestions.push("Check the workspace events for failure context");
  }

  return {
    attemptedWork,
    failureDetails,
    suggestions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Write a failure summary to the workspace
 */
export async function writeFailureSummary(
  specId: string,
  summary: FailureSummary,
  deps: WorkspaceDeps
): Promise<void> {
  // Determine workspace path based on type
  let workspacePath: string;
  try {
    await readImplState(specId, deps);
    workspacePath = getImplWorkspacePath(specId, deps);
  } catch {
    workspacePath = getWorkspacePath(specId, deps);
  }

  const summaryPath = join(workspacePath, "failure-summary.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
}

/**
 * Increment attempt count for a workspace
 */
export async function incrementAttempt(
  specId: string,
  deps: WorkspaceDeps
): Promise<number> {
  // Try impl state first
  try {
    const state = await readImplState(specId, deps);
    const newCount = (state.attemptCount || 0) + 1;
    await updateImplState(specId, { attemptCount: newCount }, deps);
    return newCount;
  } catch {
    // Try planning state
    const workspacePath = getWorkspacePath(specId, deps);
    const statePath = join(workspacePath, "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as PlanningState;
    const newCount = (state.attemptCount || 0) + 1;

    const newState = {
      ...state,
      attemptCount: newCount,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(statePath, JSON.stringify(newState, null, 2));
    return newCount;
  }
}

/**
 * Check if a workspace should be escalated (attemptCount >= 3)
 */
export function shouldEscalate(state: PlanningState | ImplState): boolean {
  return (state.attemptCount || 0) >= 3;
}

/**
 * Mark a workspace as failed
 */
export async function markFailed(
  specId: string,
  reason: string,
  deps: WorkspaceDeps
): Promise<void> {
  const now = new Date().toISOString();

  // Try impl state first
  try {
    await updateImplState(
      specId,
      {
        failedAt: now,
        failureReason: reason,
      },
      deps
    );
    return;
  } catch {
    // Try planning state
    const workspacePath = getWorkspacePath(specId, deps);
    const statePath = join(workspacePath, "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as PlanningState;

    const newState = {
      ...state,
      failedAt: now,
      failureReason: reason,
      updatedAt: now,
    };
    await writeFile(statePath, JSON.stringify(newState, null, 2));
  }
}

/**
 * Clear failure state for retry
 */
export async function clearFailureState(
  specId: string,
  deps: WorkspaceDeps
): Promise<void> {
  // Try impl state first
  try {
    await updateImplState(
      specId,
      {
        failedAt: undefined,
        failureReason: undefined,
      },
      deps
    );
    return;
  } catch {
    // Try planning state
    const workspacePath = getWorkspacePath(specId, deps);
    const statePath = join(workspacePath, "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as PlanningState;

    const newState = {
      ...state,
      failedAt: undefined,
      failureReason: undefined,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(statePath, JSON.stringify(newState, null, 2));
  }
}

/**
 * Mark a workspace as aborted
 */
export async function markAborted(
  specId: string,
  reason: string,
  deps: WorkspaceDeps
): Promise<void> {
  const now = new Date().toISOString();

  // Try impl state first
  try {
    await updateImplState(
      specId,
      {
        abortedAt: now,
        abortReason: reason,
      },
      deps
    );
    await emitEvent(specId, "aborted", { reason }, deps);
    return;
  } catch {
    // Try planning state
    const workspacePath = getWorkspacePath(specId, deps);
    const statePath = join(workspacePath, "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content) as PlanningState;

    const newState = {
      ...state,
      abortedAt: now,
      abortReason: reason,
      updatedAt: now,
    };
    await writeFile(statePath, JSON.stringify(newState, null, 2));
    await emitEvent(specId, "aborted", { reason }, deps);
  }
}

/**
 * Emit escalation event with Linear update data
 */
export async function emitEscalationEvent(
  specId: string,
  state: PlanningState | ImplState,
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath =
    state.type === "impl"
      ? getImplWorkspacePath(specId, deps)
      : getWorkspacePath(specId, deps);

  const escalationData = {
    reason: "maximum retries exceeded",
    attemptCount: state.attemptCount || 0,
    phase: state.phase,
    linearUpdate: {
      issueId: specId,
      comment: `Workflow escalated after ${state.attemptCount || 0} failed attempts. Last failure: ${state.failureReason || "Unknown"}`,
    },
    failureSummaryPath: join(workspacePath, "failure-summary.json"),
  };

  await emitEvent(specId, "escalation", escalationData, deps);
}
