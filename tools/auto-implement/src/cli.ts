#!/usr/bin/env bun
/**
 * auto-implement — Run implementing-specs across multiple fresh sessions.
 *
 * Usage:
 *   auto-implement ENG-123              # Run up to 10 sessions
 *   auto-implement ENG-123 --pause      # Confirm between sessions
 *   auto-implement ENG-123 --max 5      # Limit to 5 sessions
 *   auto-implement list                 # List previous runs
 *   auto-implement show <run-id>        # Show run manifest
 */

import { Command } from "commander";
import { createInterface } from "readline";
import { autoImplement } from "./run";
import { readManifest, getRunsDir, getRunDir } from "./manifest";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { generateSessionId } from "../../crun/src/run";

/**
 * Spawn a headless Claude session with the given prompt.
 * Returns session ID, exit code, and captured stdout.
 */
async function spawnClaude(
  prompt: string
): Promise<{ sessionId: string; exitCode: number; stdout: string }> {
  const sessionId = await generateSessionId();

  // Remove API key env vars to force OAuth (same as crun)
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_API_KEY;

  const proc = Bun.spawn(
    [
      "bun",
      "run",
      "--bun",
      "claude",
      "-p",
      "--dangerously-skip-permissions",
      "--session-id",
      sessionId,
    ],
    {
      stdin: new TextEncoder().encode(prompt),
      stdout: "pipe",
      stderr: "pipe",
      cwd: "/workspaces/test-mvp",
      env,
    }
  );

  // Stream stderr to console, capture stdout
  const stdoutChunks: string[] = [];

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
    }
  })();

  await Promise.all([streamOut, streamErr]);
  const exitCode = await proc.exited;

  return {
    sessionId,
    exitCode,
    stdout: stdoutChunks.join(""),
  };
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
  .argument("<spec-id>", "Linear issue ID for the spec (e.g., ENG-123)")
  .option("--max <n>", "Maximum sessions to run", "10")
  .option("--pause", "Confirm between sessions", false)
  .action(async (specId: string, options: { max: string; pause: boolean }) => {
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
      },
      { spawnClaude, confirm, checkSpecComplete, log }
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

program.parse();
