import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import {
  type WorkspaceDeps,
  type PlanningPhase,
  type PlanningState,
  createPlanningWorkspace,
  getWorkspacePath,
  readPlanningState as readState,
  updatePlanningState,
} from "./workspace";
import { transitionTo } from "./state-machine";
import {
  emitPhaseTransition,
  emitEscalation,
  emitIssueCreated,
  readEvents as readEventsFromLog,
  type PlanningEvent,
} from "./events";

// Re-export for tests
export { readPlanningState } from "./workspace";
export { readEvents } from "./events";

/**
 * Slice definition as proposed by the worker.
 */
export interface SliceDefinition {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  testApproach: string;
  dependencies: string[];
  isIndependent: boolean;
}

/**
 * Created issue record.
 */
export interface CreatedIssue {
  issueId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  testApproach: string;
  dependencies: string[];
  isIndependent: boolean;
  sliceIndex: number;
}

/**
 * Configuration for the planning workflow.
 */
export interface PlanningWorkflowConfig {
  specId: string;
  timeoutMinutes: number;
  maxRevisions: number;
}

/**
 * Options for running the planning workflow (primarily for testing).
 */
export interface PlanningWorkflowOptions {
  dryRun?: boolean;
  stopAfter?: PlanningPhase | "creating_issues";
  mockSlices?: SliceDefinition[];
  mockReviewResult?: "approved" | "revise";
  mockReviewFeedback?: string;
  mockReviewSequence?: ("approved" | "revise")[];
  mockStartedAt?: string;
  mockCreatedIssueIds?: string[];
}

/**
 * Result of running the planning workflow.
 */
export interface WorkflowResult {
  specId: string;
  phase: PlanningPhase;
  escalated?: boolean;
  createdIssues?: string[];
}

/**
 * Read slice proposals from workspace.
 */
export async function readSliceProposals(
  specId: string,
  deps: WorkspaceDeps
): Promise<SliceDefinition[]> {
  const workspacePath = getWorkspacePath(specId, deps);
  const slicesPath = join(workspacePath, "slices.json");

  try {
    const content = await readFile(slicesPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Write slice proposals to workspace.
 */
async function writeSliceProposals(
  specId: string,
  slices: SliceDefinition[],
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = getWorkspacePath(specId, deps);
  const slicesPath = join(workspacePath, "slices.json");
  await writeFile(slicesPath, JSON.stringify(slices, null, 2));
}

/**
 * Read created issues from workspace.
 */
export async function readCreatedIssues(
  specId: string,
  deps: WorkspaceDeps
): Promise<CreatedIssue[]> {
  const workspacePath = getWorkspacePath(specId, deps);
  const issuesPath = join(workspacePath, "created-issues.json");

  try {
    const content = await readFile(issuesPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Write created issues to workspace.
 */
async function writeCreatedIssues(
  specId: string,
  issues: CreatedIssue[],
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = getWorkspacePath(specId, deps);
  const issuesPath = join(workspacePath, "created-issues.json");
  await writeFile(issuesPath, JSON.stringify(issues, null, 2));
}

/**
 * Check if the workflow has timed out.
 */
function hasTimedOut(startedAt: string, timeoutMinutes: number): boolean {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsed = (now - start) / 1000 / 60;
  return elapsed >= timeoutMinutes;
}

/**
 * Transition to a new phase and emit the phase_transition event.
 */
async function transitionAndEmit(
  specId: string,
  fromPhase: PlanningPhase,
  toPhase: PlanningPhase,
  deps: WorkspaceDeps
): Promise<void> {
  await transitionTo(specId, toPhase, deps);
  await emitPhaseTransition(specId, fromPhase, toPhase, deps);
}

/**
 * Escalate the workflow due to timeout or max revisions.
 */
async function escalate(
  specId: string,
  reason: string,
  deps: WorkspaceDeps
): Promise<void> {
  const state = await readState(specId, deps);

  // Calculate elapsed time if startedAt is set
  let elapsedMinutes = 0;
  if (state.startedAt) {
    const start = new Date(state.startedAt).getTime();
    const now = Date.now();
    elapsedMinutes = Math.round((now - start) / 1000 / 60);
  }

  await updatePlanningState(
    specId,
    {
      escalated: true,
      escalatedAt: new Date().toISOString(),
    },
    deps
  );

  await emitEscalation(
    specId,
    {
      reason,
      elapsedMinutes,
      currentPhase: state.phase,
    },
    deps
  );
}

/**
 * Run the planning workflow.
 *
 * This is the main orchestration function that:
 * 1. Creates workspace (setup phase)
 * 2. Transitions to analyzing
 * 3. Spawns worker to analyze spec and propose slices
 * 4. Transitions to proposing when slices proposed
 * 5. Transitions to reviewing
 * 6. Review loop: approve or request revision
 * 7. Transitions to approved
 * 8. Creates Linear sub-issues
 * 9. Transitions to complete
 */
export async function runPlanningWorkflow(
  config: PlanningWorkflowConfig,
  deps: WorkspaceDeps,
  options: PlanningWorkflowOptions = {}
): Promise<WorkflowResult> {
  const { specId, timeoutMinutes, maxRevisions } = config;
  const {
    dryRun = false,
    stopAfter,
    mockSlices,
    mockReviewResult,
    mockReviewFeedback,
    mockReviewSequence,
    mockStartedAt,
    mockCreatedIssueIds,
  } = options;

  // Step 1: Create workspace
  await createPlanningWorkspace(specId, deps);

  // Get initial state
  let state = await readState(specId, deps);

  // If mockStartedAt is provided, check for timeout immediately
  if (mockStartedAt) {
    await updatePlanningState(specId, { startedAt: mockStartedAt }, deps);
    state = await readState(specId, deps);

    if (hasTimedOut(mockStartedAt, timeoutMinutes)) {
      await escalate(specId, "Workflow timeout exceeded", deps);
      return {
        specId,
        phase: state.phase,
        escalated: true,
      };
    }
  }

  // Step 2: Transition from setup to analyzing
  await transitionAndEmit(specId, "setup", "analyzing", deps);
  state = await readState(specId, deps);

  if (stopAfter === "setup" || stopAfter === "analyzing") {
    return {
      specId,
      phase: state.phase,
    };
  }

  // Step 3: In dry run mode with mock slices, use those directly
  // Step 4: Transition to proposing when slices proposed
  if (mockSlices) {
    await writeSliceProposals(specId, mockSlices, deps);
  }

  await transitionAndEmit(specId, "analyzing", "proposing", deps);
  state = await readState(specId, deps);

  if (stopAfter === "proposing") {
    return {
      specId,
      phase: state.phase,
    };
  }

  // Step 5 & 6: Review loop
  let reviewIndex = 0;
  let approved = false;

  while (!approved) {
    // Transition to reviewing
    await transitionAndEmit(specId, "proposing", "reviewing", deps);
    state = await readState(specId, deps);

    // Determine review result
    let reviewResult: "approved" | "revise";
    if (mockReviewSequence) {
      reviewResult = mockReviewSequence[reviewIndex] || "approved";
    } else {
      reviewResult = mockReviewResult || "approved";
    }

    if (reviewResult === "approved") {
      approved = true;
      // Step 7: Transition to approved
      await transitionAndEmit(specId, "reviewing", "approved", deps);
      state = await readState(specId, deps);

      if (stopAfter === "approved") {
        return {
          specId,
          phase: state.phase,
        };
      }
    } else {
      // Check if we've exceeded max revisions
      if (state.revisionCount >= maxRevisions) {
        await escalate(specId, `Exceeded max revisions (${maxRevisions})`, deps);
        return {
          specId,
          phase: state.phase,
          escalated: true,
        };
      }

      // Go back to proposing for revision
      await transitionAndEmit(specId, "reviewing", "proposing", deps);
      state = await readState(specId, deps);
      reviewIndex++;

      // If stopAfter is "reviewing", we stop after completing the review action
      // which means transitioning back to proposing for revision
      if (stopAfter === "reviewing") {
        return {
          specId,
          phase: state.phase,
        };
      }
    }
  }

  // Step 8: Create Linear sub-issues
  await transitionAndEmit(specId, "approved", "creating_issues", deps);
  state = await readState(specId, deps);

  // Read slices and create issues
  const slices = await readSliceProposals(specId, deps);
  const createdIssues: CreatedIssue[] = [];

  // Build a map from slice title to created issue ID for dependency resolution
  const titleToIssueId: Map<string, string> = new Map();

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const issueId = mockCreatedIssueIds?.[i] || `${specId}-${i + 1}`;

    // Map the slice title to its issue ID
    titleToIssueId.set(slice.title, issueId);

    // Resolve dependencies: convert slice titles to issue IDs
    const resolvedDependencies = slice.dependencies.map((depTitle) => {
      return titleToIssueId.get(depTitle) || depTitle;
    });

    const createdIssue: CreatedIssue = {
      issueId,
      title: slice.title,
      description: slice.description,
      acceptanceCriteria: slice.acceptanceCriteria,
      testApproach: slice.testApproach,
      dependencies: resolvedDependencies,
      isIndependent: slice.isIndependent,
      sliceIndex: i,
    };

    createdIssues.push(createdIssue);

    // Emit issue_created event
    await emitIssueCreated(
      specId,
      {
        issueId,
        title: slice.title,
        sliceIndex: i,
      },
      deps
    );
  }

  await writeCreatedIssues(specId, createdIssues, deps);

  if (stopAfter === "creating_issues") {
    return {
      specId,
      phase: state.phase,
      createdIssues: createdIssues.map((i) => i.issueId),
    };
  }

  // Step 9: Transition to complete
  await transitionAndEmit(specId, "creating_issues", "complete", deps);
  state = await readState(specId, deps);

  return {
    specId,
    phase: state.phase,
    createdIssues: createdIssues.map((i) => i.issueId),
  };
}
