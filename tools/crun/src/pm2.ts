/**
 * pm2 wrapper for crun
 */

import type { CrunProcess, Pm2ProcessInfo, ProcessStatus, SpawnOptions, SpawnResult } from "./types";

const CRUN_PREFIX = "crun-";

/**
 * Generate a new UUID session ID
 */
export async function generateSessionId(): Promise<string> {
  const file = Bun.file("/proc/sys/kernel/random/uuid");
  const uuid = await file.text();
  return uuid.trim();
}

/**
 * Build pm2 process name from session ID and optional issue ID
 */
export function buildPm2Name(sessionId: string, issueId?: string): string {
  if (issueId) {
    return `${CRUN_PREFIX}${sessionId}-${issueId}`;
  }
  return `${CRUN_PREFIX}${sessionId}`;
}

/**
 * Parse pm2 process name to extract session ID and issue ID
 */
export function parsePm2Name(name: string): { sessionId: string; issueId?: string } | null {
  if (!name.startsWith(CRUN_PREFIX)) {
    return null;
  }

  const suffix = name.slice(CRUN_PREFIX.length);
  // Format: sessionId or sessionId-ISSUEPREFIX-NUMBER
  // UUID is 36 chars (8-4-4-4-12)
  const uuidLength = 36;

  if (suffix.length === uuidLength) {
    return { sessionId: suffix };
  }

  if (suffix.length > uuidLength && suffix[uuidLength] === "-") {
    const sessionId = suffix.slice(0, uuidLength);
    const issueId = suffix.slice(uuidLength + 1);
    return { sessionId, issueId };
  }

  // Fallback for non-UUID session IDs
  const dashIndex = suffix.indexOf("-", 1);
  if (dashIndex === -1) {
    return { sessionId: suffix };
  }

  // Check if what follows looks like an issue ID (e.g., ENG-123)
  const potentialIssue = suffix.slice(dashIndex + 1);
  if (/^[A-Z]+-\d+$/.test(potentialIssue)) {
    return {
      sessionId: suffix.slice(0, dashIndex),
      issueId: potentialIssue,
    };
  }

  return { sessionId: suffix };
}

/**
 * Map pm2 status to crun status
 */
export function mapPm2Status(pm2Status: string, exitCode?: number): ProcessStatus {
  switch (pm2Status) {
    case "online":
      return "running";
    case "stopped":
      return exitCode === 0 ? "done" : "errored";
    case "stopping":
      return "running";
    case "errored":
      return "errored";
    default:
      return "stopped";
  }
}

/**
 * Start a new Claude process via pm2
 */
export async function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const sessionId = options.resumeSessionId || await generateSessionId();
  const pm2Name = buildPm2Name(sessionId, options.issueId);

  // Write prompt to temp file to avoid shell quoting issues
  const promptFile = `/tmp/crun-prompt-${sessionId}`;
  await Bun.write(promptFile, options.prompt);

  // Build claude command
  // -p for print mode (non-interactive)
  const claudeArgs = ["-p"];

  if (options.resumeSessionId) {
    // Resume an existing session
    claudeArgs.push("-r", options.resumeSessionId);
  } else {
    // New session with explicit ID
    claudeArgs.push("--session-id", sessionId);
  }

  if (options.model) {
    claudeArgs.push("--model", options.model);
  }

  // Write a shell script to run the command
  // This avoids shell quoting issues and works better with pm2
  const scriptFile = `/tmp/crun-script-${sessionId}.sh`;
  const scriptContent = `#!/usr/bin/env bash
cd "${process.cwd()}"
cat "${promptFile}" | bun run c ${claudeArgs.join(" ")}
`;
  await Bun.write(scriptFile, scriptContent);

  // Make script executable
  const chmodProc = Bun.spawn(["chmod", "+x", scriptFile]);
  await chmodProc.exited;

  // Start via pm2
  const proc = Bun.spawn(
    ["pm2", "start", scriptFile, "--name", pm2Name, "--no-autorestart"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CRUN_ISSUE_ID: options.issueId || "",
        CRUN_SESSION_ID: sessionId,
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`pm2 start failed: ${stderr}`);
  }

  return { sessionId, pm2Name };
}

/**
 * List all crun processes from pm2
 */
export async function listProcesses(): Promise<CrunProcess[]> {
  const proc = Bun.spawn(["pm2", "jlist"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    // pm2 might not be running
    return [];
  }

  try {
    const processes: Pm2ProcessInfo[] = JSON.parse(stdout);
    const results: CrunProcess[] = [];

    for (const p of processes) {
      if (!p.name.startsWith(CRUN_PREFIX)) continue;

      const parsed = parsePm2Name(p.name);
      if (!parsed) continue;

      results.push({
        sessionId: parsed.sessionId,
        pm2Name: p.name,
        status: mapPm2Status(p.pm2_env.status, p.pm2_env.exit_code),
        pid: p.pid,
        issueId: parsed.issueId || p.pm2_env.env?.CRUN_ISSUE_ID,
        startedAt: p.pm2_env.pm_uptime ? new Date(p.pm2_env.pm_uptime) : undefined,
        exitCode: p.pm2_env.exit_code,
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Get a specific process by session ID
 */
export async function getProcess(sessionId: string): Promise<CrunProcess | null> {
  const processes = await listProcesses();
  return processes.find((p) => p.sessionId === sessionId) || null;
}

/**
 * Delete a process from pm2
 */
export async function deleteProcess(sessionId: string): Promise<boolean> {
  const process = await getProcess(sessionId);
  if (!process) {
    return false;
  }

  const proc = Bun.spawn(["pm2", "delete", process.pm2Name], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

/**
 * Delete all crun processes from pm2
 */
export async function deleteAllProcesses(): Promise<number> {
  const processes = await listProcesses();
  let deleted = 0;

  for (const process of processes) {
    const proc = Bun.spawn(["pm2", "delete", process.pm2Name], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if ((await proc.exited) === 0) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Stream logs from a pm2 process
 */
export function streamLogs(sessionId: string, raw: boolean = false): Bun.Subprocess {
  // Get pm2Name - construct directly since we can't await
  const pm2Name = `${CRUN_PREFIX}${sessionId}`;

  const args = ["pm2", "logs", pm2Name];
  if (raw) {
    args.push("--raw");
  }

  return Bun.spawn(args, {
    stdout: "inherit",
    stderr: "inherit",
  });
}

/**
 * Stream logs and wait for process to complete
 * Polls every second for process status and kills the log stream when done
 */
export async function followProcess(sessionId: string): Promise<void> {
  const pm2Name = `${CRUN_PREFIX}${sessionId}`;

  // Start log streaming
  const logProc = Bun.spawn(["pm2", "logs", pm2Name], {
    stdout: "inherit",
    stderr: "inherit",
  });

  // Poll for process completion
  const pollInterval = 1000; // 1 second
  while (true) {
    await Bun.sleep(pollInterval);

    const proc = await getProcess(sessionId);
    if (!proc || proc.status !== "running") {
      // Process finished - kill the log stream
      logProc.kill();
      break;
    }
  }
}
