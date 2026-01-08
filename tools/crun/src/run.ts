/**
 * Core crun logic - synchronous wrapper for claude -p
 */

import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { loadPresets, getDefaultPresetsDir, getRepoPresetsDir, type PresetDeps } from "./presets";
import { getDefaultStorageDir } from "../../workflow/src/workflow";
import {
  recordInvocation,
  updateInvocation,
  generateInvocationId as defaultGenerateInvocationId,
  getInvocationsPath,
  getResumeCountForSession,
  type InvocationStatus,
} from "./invocations";

export interface RunOptions {
  prompt?: string;
  promptFile?: string;
  resume?: string;
  model?: string;
  cwd?: string;
  claudeFlags?: string[];
  noteToSelf?: string;
  remind?: string[];
}

export interface SpawnClaudeOptions {
  command: string[];
  prompt: string;
  sessionId: string;
  resume?: string;
  model?: string;
  cwd?: string;
  extraFlags?: string[];
}

export interface SpawnClaudeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunDeps {
  generateSessionId: () => Promise<string>;
  generateInvocationId: () => string;
  spawnClaude: (options: SpawnClaudeOptions) => Promise<SpawnClaudeResult>;
  logDir: string;
  claudeCommand: string[];
  workflowsDir: string;
  /** User presets directory (~/.claude/workflow-presets/) */
  userPresetsDir: string;
  /** Repo presets directory (.claude/workflow-presets/) - optional */
  repoPresetsDir?: string;
  /** Path to invocations JSONL file */
  invocationsPath: string;
}

export interface RunResult {
  sessionId: string;
  invocationId: string;
  logPath: string;
  exitCode: number;
  noteToSelf?: string;
}

/**
 * Generate a UUID session ID
 */
export async function generateSessionId(): Promise<string> {
  const file = Bun.file("/proc/sys/kernel/random/uuid");
  const uuid = await file.text();
  return uuid.trim();
}

/**
 * Default log directory
 */
export function getDefaultLogDir(): string {
  return join(homedir(), ".crun", "logs");
}

/**
 * Create default dependencies for production use
 */
export function createDefaultDeps(): RunDeps {
  return {
    generateSessionId,
    generateInvocationId: defaultGenerateInvocationId,
    spawnClaude: spawnClaudeProcess,
    logDir: getDefaultLogDir(),
    claudeCommand: ["bun", "run", "--bun", "claude", "-p", "--dangerously-skip-permissions"],
    workflowsDir: getDefaultStorageDir(),
    userPresetsDir: getDefaultPresetsDir(),
    repoPresetsDir: getRepoPresetsDir(),
    invocationsPath: getInvocationsPath(),
  };
}

/**
 * Spawn claude process and stream output
 */
async function spawnClaudeProcess(
  options: SpawnClaudeOptions
): Promise<SpawnClaudeResult> {
  const args: string[] = [];

  if (options.resume) {
    args.push("--resume", options.resume);
  } else {
    args.push("--session-id", options.sessionId);
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.extraFlags) {
    args.push(...options.extraFlags);
  }

  const proc = Bun.spawn([...options.command, ...args], {
    stdin: new TextEncoder().encode(options.prompt),
    stdout: "pipe",
    stderr: "pipe",
    cwd: options.cwd,
  });

  // Stream and capture output concurrently
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const streamOut = (async () => {
    for await (const chunk of proc.stdout) {
      const text = new TextDecoder().decode(chunk);
      process.stdout.write(text);
      stdoutChunks.push(text);
    }
  })();

  const streamErr = (async () => {
    for await (const chunk of proc.stderr) {
      const text = new TextDecoder().decode(chunk);
      process.stderr.write(text);
      stderrChunks.push(text);
    }
  })();

  await Promise.all([streamOut, streamErr]);
  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
  };
}

/**
 * Write reminders to workflow file
 */
async function writeWorkflowReminders(
  sessionId: string,
  reminders: Array<{ text: string; frequency: number; created: string }>,
  workflowsDir: string
): Promise<void> {
  await mkdir(workflowsDir, { recursive: true });
  const workflowPath = join(workflowsDir, `${sessionId}.json`);
  await Bun.write(workflowPath, JSON.stringify({ reminders }, null, 2));
}

/**
 * Main run function
 */
export async function run(
  options: RunOptions,
  deps: RunDeps = createDefaultDeps()
): Promise<RunResult> {
  // Resolve prompt
  let prompt: string;

  if (options.promptFile) {
    prompt = await Bun.file(options.promptFile).text();
  } else if (options.prompt) {
    prompt = options.prompt;
  } else {
    throw new Error("No prompt provided");
  }

  // Resolve session ID and invocation ID
  const sessionId = options.resume || (await deps.generateSessionId());
  const invocationId = deps.generateInvocationId();

  // Ensure log directory exists
  await mkdir(deps.logDir, { recursive: true });
  const logPath = join(deps.logDir, `${sessionId}.log`);

  // Calculate resume count (how many times this session has been invoked before)
  const resumeCount = options.resume
    ? await getResumeCountForSession(sessionId, deps.invocationsPath)
    : 0;

  // Record invocation at start
  await recordInvocation(
    {
      id: invocationId,
      sessionId,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      prompt,
      cwd: options.cwd || process.cwd(),
      status: "running",
      noteToSelf: options.noteToSelf,
      resumeCount,
    },
    deps.invocationsPath
  );

  // Write workflow reminders if --remind was provided
  if (options.remind && options.remind.length > 0) {
    const presets = await loadPresets(options.remind, {
      userPresetsDir: deps.userPresetsDir,
      repoPresetsDir: deps.repoPresetsDir,
    });
    const reminders = presets
      .filter((p) => p.reminder)
      .map((p) => ({
        text: p.reminder!,
        frequency: 1,
        created: new Date().toISOString(),
      }));

    if (reminders.length > 0) {
      await writeWorkflowReminders(sessionId, reminders, deps.workflowsDir);
    }
  }

  // Spawn claude (streams to console during execution)
  const result = await deps.spawnClaude({
    command: deps.claudeCommand,
    prompt,
    sessionId,
    resume: options.resume,
    model: options.model,
    cwd: options.cwd,
    extraFlags: options.claudeFlags,
  });

  // Update invocation on completion
  const status: InvocationStatus = result.exitCode === 0 ? "completed" : "failed";
  await updateInvocation(
    invocationId,
    {
      completedAt: new Date().toISOString(),
      exitCode: result.exitCode,
      status,
    },
    deps.invocationsPath
  );

  // Build log content
  const logParts = [result.stdout, result.stderr].filter(Boolean);
  if (options.noteToSelf) {
    logParts.push(`\nNOTE TO SELF: ${options.noteToSelf}`);
  }
  const logContent = logParts.join("\n");
  await Bun.write(logPath, logContent);

  return {
    sessionId,
    invocationId,
    logPath,
    exitCode: result.exitCode,
    noteToSelf: options.noteToSelf,
  };
}
