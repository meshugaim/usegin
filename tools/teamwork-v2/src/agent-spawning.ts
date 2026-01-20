/**
 * Agent spawning module for teamwork-v2.
 *
 * Wraps crun for spawning Claude agents to perform planning and implementation work.
 */

import { $ } from "bun";
import { join } from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { type WorkspaceDeps, getWorkspacePath } from "./workspace";
import { getImplWorkspacePath } from "./impl-state-machine";
import { emitEvent } from "./events";

/**
 * Result of spawning an agent.
 */
export interface SpawnResult {
  exitCode: number;
  sessionId?: string;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * Options for spawning a planning reviewer.
 */
export interface SpawnPlanningReviewerOptions {
  specId: string;
  projectRoot: string;
  model?: string;
  resumeSessionId?: string;
}

/**
 * Options for spawning an implementation reviewer.
 */
export interface SpawnImplReviewerOptions {
  sliceId: string;
  specId: string;
  projectRoot: string;
  model?: string;
  resumeSessionId?: string;
}

/**
 * Check if crun is available on PATH.
 */
export async function isCrunAvailable(): Promise<boolean> {
  try {
    const result = await $`which crun`.nothrow().quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Build the prompt for a planning team reviewer.
 */
export function buildPlanningReviewerPrompt(specId: string): string {
  return `You are the Reviewer for a Planning Team in the teamwork system.

Your task is to orchestrate the creation of vertical slices for spec issue ${specId}.

## Your Role

You are the team lead. You will:
1. Spawn a worker to analyze the spec and propose slices
2. Review the worker's slice proposals for quality
3. Provide feedback and iterate until slices are approved
4. Create Linear sub-issues for each approved slice

## Instructions

Read your full behavior from: .claude/skills/teamwork/reviewer.md
Read planning team workflow from: .claude/skills/teamwork/planning-team.md

## Output Requirements

When slices are approved, you MUST:
1. Write the final slices to: .claude/teamwork-v2/${specId}/slices.json
2. Create Linear sub-issues using \`plan create\`
3. Update .claude/teamwork-v2/${specId}/created-issues.json with the created issue IDs

## Start

1. First, read the spec: \`plan show ${specId}\`
2. Spawn a worker to analyze it and propose slices
3. Review proposals against the quality criteria in planning-team.md
4. Verify COMPLETE coverage - all spec requirements must map to exactly one slice
5. When approved, create Linear sub-issues for each slice

Begin by reading the spec and understanding what needs to be sliced.`;
}

/**
 * Build the prompt for an implementation team reviewer.
 * @param sliceId - The internal slice ID (e.g., ENG-1131-1)
 * @param specId - The parent spec ID (e.g., ENG-1131)
 * @param linearIssueId - The actual Linear issue ID (e.g., ENG-1258), if available
 */
export function buildImplReviewerPrompt(sliceId: string, specId: string, linearIssueId?: string): string {
  // Use linearIssueId for Linear operations if available, otherwise fall back to sliceId
  const issueIdForLinear = linearIssueId || sliceId;

  return `You are the Reviewer for an Implementation Team in the teamwork system.

Your task is to orchestrate the TDD implementation of slice ${sliceId}.
${linearIssueId ? `\n**Linear Issue:** ${linearIssueId} (use this ID for \`plan show\` and \`plan close\` commands)` : ''}

## Your Role

You are the team lead. You will:
1. Spawn a worker to write failing tests based on the acceptance criteria
2. Review the tests for completeness and quality
3. Iterate until tests are approved
4. Spawn worker to implement code, one test at a time
5. Review each commit before proceeding to next test
6. Detect stuck situations and spawn domain expert if needed
7. Verify all tests pass and close the issue

## Instructions

Read your full behavior from: .claude/skills/teamwork/reviewer.md
Read implementation team workflow from: .claude/skills/teamwork/impl-team.md

## Output Requirements

As you work, update the workspace state:
- .claude/teamwork-v2/${sliceId}/state.json - Update phase as you progress
- .claude/teamwork-v2/${sliceId}/events.jsonl - Emit events for each action

When complete:
1. Ensure all tests pass
2. Close the Linear issue: \`plan close ${issueIdForLinear}\`
3. Update state.json with completedAt timestamp

## Key Principles

- **TDD**: Tests before implementation, always
- **Tight feedback loops**: Review after every small step, not just at the end
- **One test at a time**: Worker implements for one test, commits, returns for review
- **Quality over speed**: Push back on "good enough", ensure exemplary code
- **Detect stuck early**: Same error 3x, spinning, going in circles → spawn expert

## Start

1. First, read the slice requirements: \`plan show ${issueIdForLinear}\`
2. Spawn a worker to write failing tests covering all acceptance criteria
3. Review tests for completeness and quality
4. When tests approved, spawn worker to implement one test at a time
5. Review each commit, verify test passes before proceeding
6. When all tests pass, run full test suite and close the issue

Begin by reading the slice requirements from Linear.`;
}

/**
 * Spawn a planning team reviewer.
 */
export async function spawnPlanningReviewer(
  options: SpawnPlanningReviewerOptions,
  deps: WorkspaceDeps
): Promise<SpawnResult> {
  const { specId, projectRoot, model, resumeSessionId } = options;
  const startTime = Date.now();

  // Emit spawn event
  await emitEvent(specId, "reviewer_spawned", {
    specId,
    type: "planning",
    model: model || "default",
    resumed: !!resumeSessionId,
  }, deps);

  // Build the prompt
  const prompt = buildPlanningReviewerPrompt(specId);

  // Write prompt to temp file to avoid shell escaping issues
  const workspacePath = getWorkspacePath(specId, deps);
  const promptFile = join(workspacePath, `.prompt-${Date.now()}.txt`);
  await writeFile(promptFile, prompt);

  // Build crun command
  const args = ["crun"];

  if (resumeSessionId) {
    args.push("-r", resumeSessionId);
  }

  if (model) {
    args.push("-m", model);
  }

  args.push("-C", projectRoot);
  args.push("-n", `Planning team completed for ${specId}. Check Linear for created sub-issues.`);
  args.push("-f", promptFile);

  // Spawn the agent
  const proc = Bun.spawn(args, {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const duration = Date.now() - startTime;

  // Try to extract session ID from output
  const sessionMatch = stdout.match(/Session: ([a-f0-9-]+)/i);

  // Clean up temp file
  await $`rm -f ${promptFile}`.nothrow().quiet();

  // Emit completion event
  await emitEvent(specId, "reviewer_completed", {
    specId,
    exitCode,
    duration,
    sessionId: sessionMatch?.[1],
  }, deps);

  return {
    exitCode,
    sessionId: sessionMatch?.[1],
    stdout,
    stderr,
    duration,
  };
}

/**
 * Spawn an implementation team reviewer.
 */
export async function spawnImplReviewer(
  options: SpawnImplReviewerOptions,
  deps: WorkspaceDeps
): Promise<SpawnResult> {
  const { sliceId, specId, projectRoot, model, resumeSessionId } = options;
  const startTime = Date.now();

  // Read linearIssueId from workspace state if available
  let linearIssueId: string | undefined;
  try {
    const statePath = join(getImplWorkspacePath(sliceId, deps), "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent);
    linearIssueId = state.linearIssueId;
  } catch {
    // Ignore - linearIssueId will be undefined
  }

  // Emit spawn event (use specId for event log path compatibility, but include sliceId in data)
  await emitEvent(sliceId, "reviewer_spawned", {
    sliceId,
    specId,
    linearIssueId,
    type: "implementation",
    model: model || "default",
    resumed: !!resumeSessionId,
  }, deps);

  // Build the prompt (pass linearIssueId for proper Linear integration)
  const prompt = buildImplReviewerPrompt(sliceId, specId, linearIssueId);

  // Write prompt to temp file
  const workspacePath = getImplWorkspacePath(sliceId, deps);
  const promptFile = join(workspacePath, `.prompt-${Date.now()}.txt`);
  await writeFile(promptFile, prompt);

  // Build crun command
  const args = ["crun"];

  if (resumeSessionId) {
    args.push("-r", resumeSessionId);
  }

  if (model) {
    args.push("-m", model);
  }

  args.push("-C", projectRoot);
  args.push("-n", `Implementation team completed for ${sliceId}. Slice implemented via TDD, all tests passing.`);
  args.push("-f", promptFile);

  // Spawn the agent
  const proc = Bun.spawn(args, {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const duration = Date.now() - startTime;

  // Try to extract session ID
  const sessionMatch = stdout.match(/Session: ([a-f0-9-]+)/i);

  // Clean up temp file
  await $`rm -f ${promptFile}`.nothrow().quiet();

  // Emit completion event
  await emitEvent(sliceId, "reviewer_completed", {
    sliceId,
    exitCode,
    duration,
    sessionId: sessionMatch?.[1],
  }, deps);

  return {
    exitCode,
    sessionId: sessionMatch?.[1],
    stdout,
    stderr,
    duration,
  };
}

/**
 * Check context utilization using cctx.
 */
export async function checkContextUtilization(sessionId: string): Promise<number> {
  try {
    const result = await $`cctx --session ${sessionId} --percent`.text();
    const percent = parseFloat(result.trim().replace('%', ''));
    return isNaN(percent) ? 0 : percent;
  } catch {
    return 0;
  }
}

/**
 * Monitor an agent's context and emit warning/handoff events.
 */
export async function monitorAgentContext(
  specId: string,
  sessionId: string,
  deps: WorkspaceDeps,
  options: {
    warningThreshold?: number;
    handoffThreshold?: number;
    checkInterval?: number;
  } = {}
): Promise<{ shouldHandoff: boolean; utilization: number }> {
  const {
    warningThreshold = 75,
    handoffThreshold = 80,
  } = options;

  const utilization = await checkContextUtilization(sessionId);

  if (utilization >= handoffThreshold) {
    await emitEvent(specId, "context_critical", {
      sessionId,
      utilization,
      threshold: handoffThreshold,
      action: "handoff_required",
    }, deps);
    return { shouldHandoff: true, utilization };
  }

  if (utilization >= warningThreshold) {
    await emitEvent(specId, "context_warning", {
      sessionId,
      utilization,
      threshold: warningThreshold,
    }, deps);
  }

  return { shouldHandoff: false, utilization };
}
