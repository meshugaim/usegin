import { join } from "path";
import { readFile, appendFile } from "fs/promises";
import { getWorkspacePath, type WorkspaceDeps } from "./workspace";

/**
 * Event log entry for events.jsonl
 */
export interface PlanningEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * Emit a generic event to the workspace event log.
 */
export async function emitEvent(
  specId: string,
  eventType: string,
  data: object,
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = getWorkspacePath(specId, deps);
  const eventsPath = join(workspacePath, "events.jsonl");

  const event = {
    timestamp: new Date().toISOString(),
    event: eventType,
    data: data as Record<string, unknown>,
  };

  await appendFile(eventsPath, JSON.stringify(event) + "\n");
}

/**
 * Read all events from the workspace event log.
 */
export async function readEvents(
  specId: string,
  deps: WorkspaceDeps
): Promise<PlanningEvent[]> {
  const workspacePath = getWorkspacePath(specId, deps);
  const eventsPath = join(workspacePath, "events.jsonl");

  try {
    const content = await readFile(eventsPath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Get events filtered by type.
 */
export async function getEventsByType(
  specId: string,
  eventType: string,
  deps: WorkspaceDeps
): Promise<PlanningEvent[]> {
  const events = await readEvents(specId, deps);
  return events.filter((e) => e.event === eventType);
}

// --- Phase transition events ---

/**
 * Emit a phase transition event.
 */
export async function emitPhaseTransition(
  specId: string,
  fromPhase: string,
  toPhase: string,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(
    specId,
    "phase_transition",
    {
      specId,
      from: fromPhase,
      to: toPhase,
    },
    deps
  );
}

// --- Worker events ---

export interface WorkerSpawnedData {
  workerId: string;
  role: string;
  sessionId: string;
}

/**
 * Emit a worker spawned event.
 */
export async function emitWorkerSpawned(
  specId: string,
  data: WorkerSpawnedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "worker_spawned", data, deps);
}

export interface WorkerCompletedData {
  workerId: string;
  exitCode: number;
  duration: number;
}

/**
 * Emit a worker completed event.
 */
export async function emitWorkerCompleted(
  specId: string,
  data: WorkerCompletedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "worker_completed", data, deps);
}

export interface WorkerFailedData {
  workerId: string;
  error: string;
  exitCode: number;
}

/**
 * Emit a worker failed event.
 */
export async function emitWorkerFailed(
  specId: string,
  data: WorkerFailedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "worker_failed", data, deps);
}

// --- Slice events ---

export interface SlicesProposedData {
  slices: Array<{ title: string; description: string }>;
  totalCount: number;
}

/**
 * Emit a slices proposed event.
 */
export async function emitSlicesProposed(
  specId: string,
  data: SlicesProposedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "slices_proposed", data, deps);
}

export interface SlicesApprovedData {
  approvedCount: number;
  reviewerId: string;
}

/**
 * Emit a slices approved event.
 */
export async function emitSlicesApproved(
  specId: string,
  data: SlicesApprovedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "slices_approved", data, deps);
}

export interface RevisionRequestedData {
  feedback: string;
  reviewerId: string;
  revisionNumber: number;
}

/**
 * Emit a revision requested event.
 */
export async function emitRevisionRequested(
  specId: string,
  data: RevisionRequestedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "revision_requested", data, deps);
}

// --- Linear issue events ---

export interface IssueCreationStartedData {
  totalSlices: number;
}

/**
 * Emit an issue creation started event.
 */
export async function emitIssueCreationStarted(
  specId: string,
  data: IssueCreationStartedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "issue_creation_started", data, deps);
}

export interface IssueCreatedData {
  issueId: string;
  title: string;
  sliceIndex: number;
}

/**
 * Emit an issue created event.
 */
export async function emitIssueCreated(
  specId: string,
  data: IssueCreatedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "issue_created", data, deps);
}

export interface IssueCreationCompletedData {
  createdIssues: string[];
  totalCount: number;
}

/**
 * Emit an issue creation completed event.
 */
export async function emitIssueCreationCompleted(
  specId: string,
  data: IssueCreationCompletedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "issue_creation_completed", data, deps);
}

// --- Timeout and escalation events ---

export interface TimeoutWarningData {
  elapsedMinutes: number;
  timeoutMinutes: number;
  currentPhase: string;
}

/**
 * Emit a timeout warning event.
 */
export async function emitTimeoutWarning(
  specId: string,
  data: TimeoutWarningData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "timeout_warning", data, deps);
}

export interface EscalationData {
  reason: string;
  elapsedMinutes: number;
  currentPhase: string;
}

/**
 * Emit an escalation event.
 */
export async function emitEscalation(
  specId: string,
  data: EscalationData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "escalation", data, deps);
}

// --- Planning completion events ---

export interface PlanningCompletedData {
  createdIssues: string[];
  totalSlices: number;
  revisionCount: number;
  durationMinutes: number;
}

/**
 * Emit a planning completed event.
 */
export async function emitPlanningCompleted(
  specId: string,
  data: PlanningCompletedData,
  deps: WorkspaceDeps
): Promise<void> {
  await emitEvent(specId, "planning_completed", data, deps);
}
