import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
import { type WorkspaceDeps } from "./workspace";
import { emitEvent } from "./events";

/**
 * Checkpoint information saved during handoffs
 */
export interface CheckpointInfo {
  workspaceId: string;
  phase: string;
  testIndex?: number;
  pendingWork: string[];
  timestamp: string;
}

/**
 * Context for continuing work after a handoff
 */
export interface HandoffContext {
  workspaceId: string;
  agentRole: string;
  phase: string;
  testIndex?: number;
  pendingWork: string[];
  contextSnapshot: string;
  timestamp: string;
}

/**
 * Health status levels
 */
export type HealthStatus = "healthy" | "warning" | "critical";

/**
 * Health info for a workspace
 */
export interface HealthInfo {
  id: string;
  type: "plan" | "impl";
  phase: string;
  contextUtilization: number;
  lastHealthCheck?: string;
  handoffCount: number;
  lastHandoffAt?: string;
  agentRole: string;
  status: HealthStatus;
}

/**
 * Check if context utilization is in warning zone (>= 75%)
 */
export function checkContextWarning(utilization: number): boolean {
  return utilization >= 75;
}

/**
 * Check if context utilization should trigger handoff (>= 80%)
 */
export function shouldTriggerHandoff(utilization: number): boolean {
  return utilization >= 80;
}

/**
 * Get health status based on context utilization
 */
export function getHealthStatus(utilization: number): HealthStatus {
  if (utilization >= 80) {
    return "critical";
  }
  if (utilization >= 75) {
    return "warning";
  }
  return "healthy";
}

/**
 * Get agent role based on workspace type
 */
export function getAgentRole(type: "plan" | "impl"): string {
  return type === "plan" ? "planner" : "worker";
}

/**
 * Update context utilization for a workspace
 */
export async function updateContextUtilization(
  workspaceId: string,
  utilization: number,
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  const previousUtilization = state.contextUtilization || 0;
  const now = new Date().toISOString();

  // Update state with new utilization
  state.contextUtilization = utilization;
  state.lastHealthCheck = now;
  state.updatedAt = now;

  await writeFile(statePath, JSON.stringify(state, null, 2));

  // Emit health_check event
  await emitEvent(
    workspaceId,
    "health_check",
    {
      contextUtilization: utilization,
      previousUtilization,
    },
    deps
  );

  // Check for warning threshold (only if crossing from below)
  if (utilization >= 75 && previousUtilization < 75) {
    const agentRole = getAgentRole(state.type);
    await emitEvent(
      workspaceId,
      "context_warning",
      {
        workspaceId,
        utilization,
        threshold: 75,
        agentRole,
      },
      deps
    );
  }

  // Check for auto-handoff threshold
  if (utilization >= 80) {
    // Trigger auto-handoff
    await triggerAutoHandoff(workspaceId, utilization, deps);
  }
}

/**
 * Trigger automatic handoff due to high context utilization
 */
async function triggerAutoHandoff(
  workspaceId: string,
  utilization: number,
  deps: WorkspaceDeps
): Promise<void> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  const agentRole = getAgentRole(state.type);

  // Create and write checkpoint
  const checkpoint = await createCheckpoint(workspaceId, deps);
  await writeCheckpoint(workspaceId, checkpoint, deps);

  // Emit handoff_triggered event
  await emitEvent(
    workspaceId,
    "handoff_triggered",
    {
      workspaceId,
      trigger: "auto",
      utilization,
      agentRole,
    },
    deps
  );

  // Update handoff count
  await incrementHandoffCount(workspaceId, deps);
}

/**
 * Create a checkpoint for the workspace
 */
export async function createCheckpoint(
  workspaceId: string,
  deps: WorkspaceDeps
): Promise<CheckpointInfo> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  // Calculate pending work
  const pendingWork: string[] = [];

  if (state.type === "impl" && state.tests) {
    // For impl workspaces, pending work is remaining tests
    for (let i = state.currentTestIndex || 0; i < state.tests.length; i++) {
      const test = state.tests[i];
      if (test.status !== "passing") {
        pendingWork.push(`Test: ${test.name} (${test.status})`);
      }
    }
  }

  const checkpoint: CheckpointInfo = {
    workspaceId,
    phase: state.phase,
    testIndex: state.type === "impl" ? state.currentTestIndex : undefined,
    pendingWork,
    timestamp: new Date().toISOString(),
  };

  return checkpoint;
}

/**
 * Write checkpoint to disk
 */
export async function writeCheckpoint(
  workspaceId: string,
  checkpoint: CheckpointInfo,
  deps: WorkspaceDeps
): Promise<string> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const checkpointsDir = join(workspacePath, "checkpoints");

  // Ensure checkpoints directory exists
  await mkdir(checkpointsDir, { recursive: true });

  const checkpointPath = join(checkpointsDir, "latest.json");
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

  return checkpointPath;
}

/**
 * Create handoff context for a workspace
 */
export async function createHandoffContext(
  workspaceId: string,
  agentRole: string,
  deps: WorkspaceDeps
): Promise<HandoffContext> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  // Calculate pending work
  const pendingWork: string[] = [];

  if (state.type === "impl" && state.tests) {
    // For impl workspaces, pending work is remaining tests
    for (let i = state.currentTestIndex || 0; i < state.tests.length; i++) {
      const test = state.tests[i];
      if (test.status !== "passing") {
        pendingWork.push(`Test: ${test.name} (${test.status})`);
      }
    }
  }

  const context: HandoffContext = {
    workspaceId,
    agentRole,
    phase: state.phase,
    testIndex: state.type === "impl" ? state.currentTestIndex : undefined,
    pendingWork,
    contextSnapshot: `Phase: ${state.phase}, Tests: ${state.tests?.length || 0}`,
    timestamp: new Date().toISOString(),
  };

  return context;
}

/**
 * Write handoff context to disk
 */
export async function writeHandoffContext(
  workspaceId: string,
  context: HandoffContext,
  deps: WorkspaceDeps
): Promise<string> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const contextPath = join(workspacePath, "handoff_context.json");

  await writeFile(contextPath, JSON.stringify(context, null, 2));

  return contextPath;
}

/**
 * Export session transcript
 */
export async function exportSession(
  workspaceId: string,
  sessionContent: string,
  deps: WorkspaceDeps
): Promise<string> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const sessionsDir = join(workspacePath, "sessions");

  // Ensure sessions directory exists
  await mkdir(sessionsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionPath = join(sessionsDir, `session-${timestamp}.md`);

  await writeFile(sessionPath, sessionContent);

  return sessionPath;
}

/**
 * Increment handoff count for a workspace
 */
export async function incrementHandoffCount(
  workspaceId: string,
  deps: WorkspaceDeps
): Promise<number> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  // Increment handoff count
  const newCount = (state.handoffCount || 0) + 1;
  const now = new Date().toISOString();

  state.handoffCount = newCount;
  state.lastHandoffAt = now;
  state.updatedAt = now;

  await writeFile(statePath, JSON.stringify(state, null, 2));

  return newCount;
}

/**
 * Get health information for a workspace
 */
export async function getWorkspaceHealth(
  workspaceId: string,
  deps: WorkspaceDeps
): Promise<HealthInfo> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  const utilization = state.contextUtilization || 0;

  return {
    id: workspaceId,
    type: state.type,
    phase: state.phase,
    contextUtilization: utilization,
    lastHealthCheck: state.lastHealthCheck,
    handoffCount: state.handoffCount || 0,
    lastHandoffAt: state.lastHandoffAt,
    agentRole: getAgentRole(state.type),
    status: getHealthStatus(utilization),
  };
}

/**
 * Perform a manual handoff for a workspace
 */
export async function performHandoff(
  workspaceId: string,
  agentRole: string,
  deps: WorkspaceDeps
): Promise<{
  checkpointPath: string;
  contextPath: string;
  sessionPath: string;
}> {
  const workspacePath = join(deps.workspacesDir, workspaceId);
  const statePath = join(workspacePath, "state.json");

  // Read current state
  const content = await readFile(statePath, "utf-8");
  const state = JSON.parse(content);

  // Check if workspace is completed
  if (state.completedAt || state.phase === "complete") {
    throw new Error(`Workspace ${workspaceId} is already complete`);
  }

  // Create checkpoint
  const checkpoint = await createCheckpoint(workspaceId, deps);
  const checkpointPath = await writeCheckpoint(workspaceId, checkpoint, deps);

  // Create handoff context
  const context = await createHandoffContext(workspaceId, agentRole, deps);
  const contextPath = await writeHandoffContext(workspaceId, context, deps);

  // Export session
  const sessionContent = generateSessionTranscript(workspaceId, state, checkpoint);
  const sessionPath = await exportSession(workspaceId, sessionContent, deps);

  // Emit handoff_triggered event
  await emitEvent(
    workspaceId,
    "handoff_triggered",
    {
      workspaceId,
      trigger: "manual",
      agentRole,
    },
    deps
  );

  // Increment handoff count
  await incrementHandoffCount(workspaceId, deps);

  return {
    checkpointPath,
    contextPath,
    sessionPath,
  };
}

/**
 * Generate session transcript content
 */
function generateSessionTranscript(
  workspaceId: string,
  state: any,
  checkpoint: CheckpointInfo
): string {
  let content = `# Session Transcript\n\n`;
  content += `Workspace: ${workspaceId}\n`;
  content += `Phase: ${state.phase}\n`;
  content += `Type: ${state.type}\n`;
  content += `Timestamp: ${checkpoint.timestamp}\n\n`;

  if (state.type === "impl") {
    content += `## Implementation Progress\n\n`;
    content += `Current Test Index: ${state.currentTestIndex || 0}\n`;
    content += `Total Tests: ${state.tests?.length || 0}\n`;
    content += `Commits: ${state.commits?.length || 0}\n\n`;

    if (state.tests && state.tests.length > 0) {
      content += `### Tests\n\n`;
      for (let i = 0; i < state.tests.length; i++) {
        const test = state.tests[i];
        const marker = i < (state.currentTestIndex || 0) ? "[x]" : "[ ]";
        content += `- ${marker} ${test.name} (${test.status})\n`;
      }
      content += `\n`;
    }
  }

  if (checkpoint.pendingWork.length > 0) {
    content += `## Pending Work\n\n`;
    for (const work of checkpoint.pendingWork) {
      content += `- ${work}\n`;
    }
  }

  return content;
}
