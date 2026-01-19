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
  const args: string[] = ["crun"];

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

  // Build final prompt, including any appended system context
  let finalPrompt = options.prompt;
  if (options.appendSystemPrompt) {
    finalPrompt = `${options.prompt}\n\n---\n\n${options.appendSystemPrompt}`;
  }

  // Write prompt to temp file to avoid shell escaping issues
  const tempPromptFile = join(
    options.cwd,
    `.claude/teams/.prompt-${Date.now()}.txt`
  );
  await Bun.write(tempPromptFile, finalPrompt);
  args.push("-f", tempPromptFile);

  // Use Bun.spawn for proper argument handling (no shell escaping issues)
  const proc = Bun.spawn(args, {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  // Clean up temp file
  await Bun.file(tempPromptFile).exists() &&
    (await $`rm ${tempPromptFile}`.nothrow().quiet());

  // Try to extract session ID from output
  // crun typically outputs session info at the end
  const sessionMatch = stdout.match(/Session: ([a-f0-9-]+)/i);
  const invocationMatch = stdout.match(/Invocation: ([a-f0-9-]+)/i);

  return {
    exitCode,
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
 * Build the note-to-self for planning reviewer completion
 */
export function buildReviewerNoteToSelf(issueId: string): string {
  return `Planning team completed for ${issueId}. Check Linear for created sub-issues.`;
}

/**
 * Build the prompt for the implementation team reviewer
 */
export function buildImplReviewerPrompt(issueId: string): string {
  return `You are the Reviewer for an Implementation Team in the teamwork system.

Your task is to orchestrate the TDD implementation of slice ${issueId}.

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

## Key Principles

- **TDD**: Tests before implementation, always
- **Tight feedback loops**: Review after every small step, not just at the end
- **One test at a time**: Worker implements for one test, commits, returns for review
- **Quality over speed**: Push back on "good enough", ensure exemplary code
- **Detect stuck early**: Same error 3x, spinning, going in circles → spawn expert

## Start

1. First, read the slice requirements: \`plan show ${issueId}\`
2. Spawn a worker to write failing tests covering all acceptance criteria
3. Review tests for completeness and quality
4. When tests approved, spawn worker to implement one test at a time
5. Review each commit, verify test passes before proceeding
6. When all tests pass, run full test suite and close the issue

Begin by reading the slice requirements from Linear.`;
}

/**
 * Build the note-to-self for implementation reviewer completion
 */
export function buildImplReviewerNoteToSelf(issueId: string): string {
  return `Implementation team completed for ${issueId}. Slice implemented via TDD, all tests passing.`;
}
