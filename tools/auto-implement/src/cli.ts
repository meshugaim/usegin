#!/usr/bin/env bun
/**
 * auto-implement — Run implementing-specs across multiple fresh sessions.
 *
 * Usage:
 *   auto-implement run ENG-123              # Run up to 10 sessions
 *   auto-implement run ENG-123 --pause      # Confirm between sessions
 *   auto-implement run ENG-123 --max 5      # Limit to 5 sessions
 *   auto-implement list                     # List previous runs
 *   auto-implement show <run-id>            # Show run manifest
 *   auto-implement watch <run-id>           # Live dashboard for a running run
 */

import { Command } from "commander";
import { createInterface } from "readline";
import { autoImplement, type SpawnContext } from "./run";
import { readManifest, getRunsDir } from "./manifest";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { generateSessionId } from "../../crun/src/run";
import { ProgressMonitor } from "./progress";
import { runWatch } from "./watch";
import { buildHandoffWriterPrompt } from "./prompt";
import {
  installHooks,
  removeHooks,
  updatePid,
  readRotationSignal,
  readAgentSignal,
  type RotationSignal,
} from "../hooks/lifecycle";
import { ActivityWriter } from "./activity";

/**
 * Spawn a headless Claude session with stream-json output.
 *
 * Uses `--output-format stream-json` to get real-time JSONL events from
 * Claude CLI. When an ActivityWriter is provided, it parses events and
 * prints compact summaries to stderr (like running interactively).
 *
 * Returns exit code and captured stdout. Updates the lifecycle context
 * with the real PID.
 */
async function spawnClaudePiped(
  prompt: string,
  sessionId: string,
  activityWriter?: ActivityWriter
): Promise<{ exitCode: number; stdout: string }> {
  // Remove API key env vars to force OAuth (same as crun)
  // Remove CLAUDECODE to allow spawning from within an existing Claude session
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_API_KEY;
  delete env.CLAUDECODE;

  const args = [
    "claude-canonical",
    "-p",
    "--session-id",
    sessionId,
  ];

  // Use stream-json for real-time observability (requires --verbose with -p)
  if (activityWriter) {
    args.push("--verbose", "--output-format", "stream-json");
  }

  const proc = Bun.spawn(args, {
    stdin: new TextEncoder().encode(prompt),
    stdout: "pipe",
    stderr: "pipe",
    cwd: "/workspaces/test-mvp",
    env,
  });

  // Update lifecycle context with real PID (for post-commit hook to kill on rotation)
  updatePid(proc.pid);

  // Capture stdout; when activityWriter is present, parse events and
  // print summaries to stderr instead of dumping raw JSON to stdout.
  const stdoutChunks: string[] = [];

  const streamOut = (async () => {
    for await (const chunk of proc.stdout) {
      const text = new TextDecoder().decode(chunk);
      stdoutChunks.push(text);

      if (activityWriter) {
        const summaries = await activityWriter.processChunk(text);
        for (const line of summaries) {
          process.stderr.write(line + "\n");
        }
      } else {
        process.stdout.write(text);
      }
    }
  })();

  const streamErr = (async () => {
    for await (const chunk of proc.stderr) {
      const text = new TextDecoder().decode(chunk);
      process.stderr.write(text);
    }
  })();

  await Promise.all([streamOut, streamErr]);

  // Flush remaining buffered data
  if (activityWriter) {
    const final = await activityWriter.flush();
    for (const line of final) {
      process.stderr.write(line + "\n");
    }
  }

  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
  };
}

/**
 * Spawn a Claude session with lifecycle hooks and progress monitoring.
 * Installs hook guards before the session and removes them after.
 */
async function spawnClaude(
  prompt: string,
  context: SpawnContext
): Promise<{ sessionId: string; exitCode: number; stdout: string; rotation: RotationSignal | null }> {
  const sessionId = await generateSessionId();

  // Install lifecycle hooks (PID=0 placeholder, updated after spawn in spawnClaudePiped)
  installHooks({
    sessionId,
    specId: context.specId,
    claudePid: "0",
  });

  // Start progress monitor
  const monitor = new ProgressMonitor({
    sessionNumber: context.sessionNumber,
    maxSessions: context.maxSessions,
  });
  await monitor.start(sessionId);

  // Create activity writer for real-time observability
  const writer = new ActivityWriter(context.runDir);

  let result: { exitCode: number; stdout: string } | null = null;
  let rotation: RotationSignal | null = null;
  let agentSignal: ReturnType<typeof readAgentSignal> = null;

  try {
    result = await spawnClaudePiped(prompt, sessionId, writer);
  } finally {
    // Read signals BEFORE lifecycle cleanup (removeHooks deletes signal files)
    rotation = readRotationSignal();
    agentSignal = readAgentSignal();

    // Detect signal for the progress monitor's end message
    let signal = "error";
    if (rotation) {
      signal = "rotation";
    } else if (result) {
      signal = agentSignal?.signal ?? "none";
    }
    monitor.stop(result?.exitCode ?? 1, signal);

    // Remove lifecycle hooks (git hooks, PreToolUse guard, context file, signal files)
    removeHooks();
  }

  return {
    sessionId,
    exitCode: result!.exitCode,
    stdout: result!.stdout,
    rotation,
    agentSignal,
  };
}

/**
 * Spawn a handoff writer agent after context rotation.
 * This is a lightweight Claude session that reads the killed session's
 * transcript, cross-references git log and Linear, and writes a handoff note.
 */
async function spawnHandoffWriter(
  killedSessionId: string,
  specId: string
): Promise<{ exitCode: number }> {
  const prompt = buildHandoffWriterPrompt({ killedSessionId, specId });
  const sessionId = await generateSessionId();

  log(`  Handoff writer session: ${sessionId.slice(0, 8)}`);

  const { exitCode } = await spawnClaudePiped(prompt, sessionId);
  return { exitCode };
}

/**
 * Ask user for confirmation via stdin
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * Check if a spec's implementation is complete by inspecting Linear.
 * Returns true if the parent issue has children and ALL children are Done.
 * Returns false if no children, or any child is not Done, or on error.
 */
async function checkSpecComplete(specId: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["plan", "show", specId, "--tree", "--json"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return false;

    const data = JSON.parse(stdout);
    const children: Array<{ status?: string }> = data.children || [];
    if (children.length === 0) return false;

    return children.every((child) => {
      const status = (child.status || "").toLowerCase();
      return status === "done" || status === "closed" || status === "completed";
    });
  } catch {
    return false;
  }
}

function log(message: string): void {
  console.log(message);
}

// --- CLI ---

const program = new Command()
  .name("auto-implement")
  .description(
    "Run implementing-specs across multiple fresh Claude sessions"
  )
  .version("1.0.0");

// Main command: run
program
  .command("run <spec-id>")
  .description("Run auto-implement on a spec (e.g., auto-implement run ENG-123)")
  .option("--max <n>", "Maximum sessions to run", "10")
  .option("--pause", "Confirm between sessions", false)
  .option("--test", "Test mode — minimal prompt to validate multi-session loop", false)
  .action(async (specId: string, options: { max: string; pause: boolean; test: boolean }) => {
    const maxSessions = parseInt(options.max, 10);
    if (isNaN(maxSessions) || maxSessions < 1) {
      console.error("--max must be a positive integer");
      process.exit(1);
    }

    // Normalize spec ID (add ENG- prefix if just a number)
    const normalizedSpecId = /^\d+$/.test(specId) ? `ENG-${specId}` : specId;

    const result = await autoImplement(
      {
        specId: normalizedSpecId,
        maxSessions,
        pause: options.pause,
        test: options.test,
      },
      { spawnClaude, spawnHandoffWriter, confirm, checkSpecComplete, log }
    );

    log("");
    log("=== Run Summary ===");
    log(`Run ID: ${result.runId}`);
    log(`Run directory: ${result.runDir}`);
    log(`Sessions: ${result.totalSessions}`);
    log(`Outcome: ${result.outcome}`);
    log("");
    log(`View manifest: auto-implement show ${result.runId}`);
    log(`View sessions: check manifest for session IDs, then: session <id>`);

    process.exit(result.outcome === "complete" ? 0 : 1);
  });

// List runs
program
  .command("list")
  .description("List previous auto-implement runs")
  .action(async () => {
    const runsDir = getRunsDir();
    let entries: string[];
    try {
      entries = await readdir(runsDir);
    } catch {
      console.log("No runs found.");
      return;
    }

    // Sort by name (which is timestamp-based)
    entries.sort().reverse();

    for (const entry of entries.slice(0, 20)) {
      const runDir = join(runsDir, entry);
      const stats = await stat(runDir).catch(() => null);
      if (!stats?.isDirectory()) continue;

      const events = await readManifest(runDir);
      const startEvent = events.find((e) => e.event === "run_started");
      const endEvent = events.find(
        (e) => e.event === "run_completed" || e.event === "run_stopped"
      );

      const spec = startEvent?.specId ?? "?";
      const sessions = endEvent?.totalSessions ?? events.filter((e) => e.event === "session_completed").length;
      const outcome = endEvent?.details?.replace("outcome=", "") ?? "in_progress";

      console.log(`${entry}  spec=${spec}  sessions=${sessions}  outcome=${outcome}`);
    }
  });

// Show run manifest
program
  .command("show <run-id>")
  .description("Show manifest for a specific run")
  .action(async (runId: string) => {
    // Support partial match
    const runsDir = getRunsDir();
    let targetDir: string;

    try {
      const entries = await readdir(runsDir);
      const match = entries.find((e) => e === runId || e.startsWith(runId));
      if (!match) {
        console.error(`No run found matching: ${runId}`);
        process.exit(1);
      }
      targetDir = join(runsDir, match);
    } catch {
      console.error(`No runs directory found.`);
      process.exit(1);
    }

    const events = await readManifest(targetDir);
    if (events.length === 0) {
      console.log("Empty manifest.");
      return;
    }

    // Pretty-print events
    for (const event of events) {
      const time = event.timestamp.replace("T", " ").replace(/\.\d+Z/, "Z");
      const parts = [`[${time}] ${event.event}`];

      if (event.sessionNumber) parts.push(`session=${event.sessionNumber}`);
      if (event.sessionId) parts.push(`sid=${event.sessionId.slice(0, 8)}`);
      if (event.durationSeconds) parts.push(`${event.durationSeconds}s`);
      if (event.exitCode !== undefined) parts.push(`exit=${event.exitCode}`);
      if (event.handoffFile) parts.push(`handoff=${event.handoffFile.split("/").pop()}`);
      if (event.totalSessions) parts.push(`total=${event.totalSessions}`);
      if (event.details) parts.push(event.details);

      console.log(parts.join("  "));
    }
  });

// Watch command: live dashboard
program
  .command("watch <run-id>")
  .description("Live dashboard for monitoring a running auto-implement run")
  .option("--interval <seconds>", "Refresh interval in seconds", "10")
  .action(async (runId: string, options: { interval: string }) => {
    const intervalMs = parseInt(options.interval, 10) * 1000;
    if (isNaN(intervalMs) || intervalMs < 1000) {
      console.error("--interval must be a positive number (seconds)");
      process.exit(1);
    }
    await runWatch({ runId, intervalMs });
  });

// Stream command: full narrative view via session --stream
program
  .command("stream [run-id]")
  .description("Stream full session transcript (defaults to latest/running run)")
  .action(async (runId?: string) => {
    const runsDir = getRunsDir();
    let targetDir: string;

    try {
      const entries = await readdir(runsDir);
      if (entries.length === 0) {
        console.error("No runs found.");
        process.exit(1);
      }

      if (runId) {
        const match = entries.find((e) => e === runId || e.startsWith(runId));
        if (!match) {
          console.error(`No run found matching: ${runId}`);
          process.exit(1);
        }
        targetDir = join(runsDir, match);
      } else {
        // Pick the latest run (entries are timestamp-based)
        entries.sort();
        targetDir = join(runsDir, entries[entries.length - 1]);
      }
    } catch {
      console.error("No runs directory found.");
      process.exit(1);
    }

    const streamPath = join(targetDir, "stream.jsonl");
    const file = Bun.file(streamPath);
    if (!(await file.exists())) {
      console.error(`No stream file found at ${streamPath}`);
      console.error("The run may have started before streaming was enabled.");
      process.exit(1);
    }

    // Spawn: tail -f stream.jsonl | session --stream --tool-output
    const tail = Bun.spawn(["tail", "-f", streamPath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const session = Bun.spawn(["session", "--stream", "--tool-output"], {
      stdin: tail.stdout,
      stdout: "inherit",
      stderr: "inherit",
    });

    // Forward signals to children for clean exit
    const cleanup = () => {
      tail.kill();
      session.kill();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    await session.exited;
  });

program.parse();
