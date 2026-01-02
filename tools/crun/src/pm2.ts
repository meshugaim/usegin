/**
 * pm2 wrapper for crun
 */

import pm2 from "pm2";
import type { ProcessDescription } from "pm2";
import type { CrunProcess, ProcessStatus, SpawnOptions, SpawnResult } from "./types";

const CRUN_PREFIX = "crun-";

/**
 * Execute an operation with a pm2 connection, ensuring proper connect/disconnect
 */
export async function withPm2Connection<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      operation()
        .then((result) => {
          pm2.disconnect();
          resolve(result);
        })
        .catch((error) => {
          pm2.disconnect();
          reject(error);
        });
    });
  });
}

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

  // Start via pm2 using SDK
  await withPm2Connection(async () => {
    return new Promise<void>((resolve, reject) => {
      pm2.start(
        {
          script: scriptFile,
          name: pm2Name,
          autorestart: false,
          cwd: process.cwd(),
          env: {
            ...process.env,
            CRUN_ISSUE_ID: options.issueId || "",
            CRUN_SESSION_ID: sessionId,
          },
        },
        (err) => {
          if (err) {
            reject(new Error(`pm2 start failed: ${err.message}`));
            return;
          }
          resolve();
        }
      );
    });
  });

  return { sessionId, pm2Name };
}

/**
 * List all crun processes from pm2
 */
export async function listProcesses(): Promise<CrunProcess[]> {
  try {
    return await withPm2Connection(async () => {
      return new Promise<CrunProcess[]>((resolve, reject) => {
        pm2.list((err, processes) => {
          if (err) {
            reject(err);
            return;
          }

          const results: CrunProcess[] = [];

          for (const p of processes) {
            if (!p.name?.startsWith(CRUN_PREFIX)) continue;

            const parsed = parsePm2Name(p.name);
            if (!parsed) continue;

            // pm2 SDK types are incomplete - cast to access runtime properties
            const pm2Env = p.pm2_env as ProcessDescription["pm2_env"] & {
              exit_code?: number;
              env?: Record<string, string>;
            };

            results.push({
              sessionId: parsed.sessionId,
              pm2Name: p.name,
              status: mapPm2Status(pm2Env?.status || "", pm2Env?.exit_code),
              pid: p.pid,
              issueId: parsed.issueId || pm2Env?.env?.CRUN_ISSUE_ID,
              startedAt: pm2Env?.pm_uptime ? new Date(pm2Env.pm_uptime) : undefined,
              exitCode: pm2Env?.exit_code,
            });
          }

          resolve(results);
        });
      });
    });
  } catch {
    // pm2 might not be running
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
  const crunProcess = await getProcess(sessionId);
  if (!crunProcess) {
    return false;
  }

  try {
    await withPm2Connection(async () => {
      return new Promise<void>((resolve, reject) => {
        pm2.delete(crunProcess.pm2Name, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all crun processes from pm2
 */
export async function deleteAllProcesses(): Promise<number> {
  const processes = await listProcesses();
  if (processes.length === 0) {
    return 0;
  }

  let deleted = 0;

  try {
    await withPm2Connection(async () => {
      for (const crunProcess of processes) {
        try {
          await new Promise<void>((resolve, reject) => {
            pm2.delete(crunProcess.pm2Name, (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          });
          deleted++;
        } catch {
          // Continue deleting other processes even if one fails
        }
      }
    });
  } catch {
    // Connection failed
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
 * Stream logs and wait for process to complete using pm2's event bus
 *
 * Note: This function maintains a long-running pm2 connection to listen for
 * process exit events, so it cannot use withPm2Connection which disconnects
 * after each operation.
 */
export async function followProcess(sessionId: string): Promise<void> {
  const pm2Name = `${CRUN_PREFIX}${sessionId}`;

  // Start log streaming
  const logProc = Bun.spawn(["pm2", "logs", pm2Name], {
    stdout: "inherit",
    stderr: "inherit",
  });

  // Use pm2's launchBus to listen for process exit events
  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      logProc.kill();
      pm2.disconnect();
    };

    pm2.connect((err) => {
      if (err) {
        logProc.kill();
        reject(err);
        return;
      }

      pm2.launchBus((err, bus) => {
        if (err) {
          pm2.disconnect();
          logProc.kill();
          reject(err);
          return;
        }

        bus.on("process:event", (event: { event: string; process: { name: string } }) => {
          if (event.event === "exit" && event.process.name === pm2Name) {
            // Process exited - clean up
            cleanup();
            resolve();
          }
        });

        // Check if process already finished before we connected
        // IMPORTANT: Use pm2.list directly to avoid nested connect/disconnect
        // which would break the bus connection
        pm2.list((err, processes) => {
          if (err) {
            // Ignore list errors, rely on bus events
            return;
          }
          const proc = processes.find((p) => p.name === pm2Name);
          const status = proc?.pm2_env?.status;
          if (!proc || status === "stopped" || status === "errored") {
            cleanup();
            resolve();
          }
        });
      });
    });
  });
}
