/**
 * crun wrapper for spawning team agents
 */

import { $ } from "bun";
import { join } from "path";

export interface SpawnAgentOptions {
  /** The prompt to send to the agent */
  prompt: string;
  /** Working directory for the agent */
  cwd: string;
  /** Note to self for when work completes */
  noteToSelf: string;
  /** Resume existing session */
  resume?: string;
  /** Model override */
  model?: string;
  /** Additional system prompt content */
  appendSystemPrompt?: string;
}

export interface SpawnAgentResult {
  /** Exit code from crun */
  exitCode: number;
  /** Session ID of the spawned agent */
  sessionId?: string;
  /** Invocation ID */
  invocationId?: string;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

/**
 * Spawn an agent using crun
 */
export async function spawnAgent(
  options: SpawnAgentOptions
): Promise<SpawnAgentResult> {
  const args: string[] = [];

  // Add options
  if (options.cwd) {
    args.push("-C", options.cwd);
  }

  if (options.noteToSelf) {
    args.push("-n", options.noteToSelf);
  }

  if (options.resume) {
    args.push("-r", options.resume);
  }

  if (options.model) {
    args.push("-m", options.model);
  }

  // Add the prompt
  args.push(options.prompt);

  // Add append system prompt if provided (after --)
  if (options.appendSystemPrompt) {
    args.push("--", "--append-system-prompt", options.appendSystemPrompt);
  }

  // Run crun
  const result = await $`crun ${args}`.nothrow().quiet();

  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();

  // Try to extract session ID from output
  // crun typically outputs session info at the end
  const sessionMatch = stdout.match(/Session: ([a-f0-9-]+)/i);
  const invocationMatch = stdout.match(/Invocation: ([a-f0-9-]+)/i);

  return {
    exitCode: result.exitCode,
    sessionId: sessionMatch?.[1],
    invocationId: invocationMatch?.[1],
    stdout,
    stderr,
  };
}

/**
 * Build the prompt for the planning team reviewer
 */
export function buildPlanningReviewerPrompt(issueId: string): string {
  return `You are the Reviewer for a Planning Team in the teamwork system.

Your task is to orchestrate the creation of vertical slices for spec issue ${issueId}.

## Your Role

You are the team lead. You will:
1. Spawn a worker to analyze the spec and propose slices
2. Review the worker's slice proposals for quality
3. Provide feedback and iterate until slices are approved
4. Create Linear sub-issues for each approved slice

## Instructions

Read your full behavior from: .claude/skills/teamwork/reviewer.md
Read planning team workflow from: .claude/skills/teamwork/planning-team.md

## Start

1. First, read the spec: \`plan show ${issueId}\`
2. Spawn a worker to analyze it and propose slices
3. Review proposals against the quality criteria in planning-team.md
4. Verify COMPLETE coverage - all spec requirements must map to exactly one slice
5. When approved, create Linear sub-issues for each slice

Begin by reading the spec and understanding what needs to be sliced.`;
}

/**
 * Build the note-to-self for reviewer completion
 */
export function buildReviewerNoteToSelf(issueId: string): string {
  return `Planning team completed for ${issueId}. Check Linear for created sub-issues.`;
}
