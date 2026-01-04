/**
 * Core crun logic - synchronous wrapper for claude -p
 */

import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export interface RunOptions {
  prompt?: string;
  promptFile?: string;
  resume?: string;
  model?: string;
  cwd?: string;
  claudeFlags?: string[];
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
  spawnClaude: (options: SpawnClaudeOptions) => Promise<SpawnClaudeResult>;
  logDir: string;
  claudeCommand: string[];
}

export interface RunResult {
  sessionId: string;
  logPath: string;
  exitCode: number;
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
    spawnClaude: spawnClaudeProcess,
    logDir: getDefaultLogDir(),
    claudeCommand: ["bun", "run", "--bun", "claude", "-p", "--dangerously-skip-permissions"],
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

  // Resolve session ID
  const sessionId = options.resume || (await deps.generateSessionId());

  // Ensure log directory exists
  await mkdir(deps.logDir, { recursive: true });
  const logPath = join(deps.logDir, `${sessionId}.log`);

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

  // Write to log file
  const logContent = [result.stdout, result.stderr].filter(Boolean).join("\n");
  await Bun.write(logPath, logContent);

  return {
    sessionId,
    logPath,
    exitCode: result.exitCode,
  };
}
