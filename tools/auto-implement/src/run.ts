/**
 * Core auto-implement loop.
 *
 * Runs sequential claude -p sessions, each following the implementing-specs skill.
 * Sessions communicate via handoff files. The loop stops when:
 * - Agent outputs AUTO_IMPLEMENT_COMPLETE
 * - Agent fails to produce a handoff or completion signal
 * - Max sessions reached
 * - User cancels (--pause mode)
 *
 * When the post-commit hook detects high context utilization, it kills the
 * Claude process and writes a rotation signal. This loop detects the signal,
 * spawns a handoff writer agent to capture the killed session's state, then
 * continues with the next session.
 */

import { stat } from "fs/promises";
import { join } from "path";
import { buildPrompt } from "./prompt";
import {
  appendEvent,
  generateRunId,
  getRunDir,
  type ManifestEvent,
} from "./manifest";
import type { RotationSignal } from "../hooks/lifecycle";

const HANDOFF_DIR = "/workspaces/test-mvp/.claude/handoffs";
const HANDOFF_LATEST = join(HANDOFF_DIR, "latest.md");

const SIGNAL_HANDOFF = "AUTO_IMPLEMENT_HANDOFF";
const SIGNAL_COMPLETE = "AUTO_IMPLEMENT_COMPLETE";

export interface AutoImplementOptions {
  specId: string;
  maxSessions: number;
  pause: boolean;
}

export interface SessionResult {
  sessionId: string;
  exitCode: number;
  stdout: string;
  durationSeconds: number;
  handoffFile: string | null;
  signal: "handoff" | "complete" | "none";
}

export interface RunResult {
  runId: string;
  runDir: string;
  totalSessions: number;
  outcome: "complete" | "max_sessions" | "no_signal" | "error" | "user_cancelled";
}

export interface SpawnContext {
  sessionNumber: number;
  maxSessions: number;
  runDir: string;
  runId: string;
  specId: string;
}

export interface RunDeps {
  spawnClaude: (prompt: string, context: SpawnContext) => Promise<{
    sessionId: string;
    exitCode: number;
    stdout: string;
    rotation: RotationSignal | null;
  }>;
  spawnHandoffWriter: (killedSessionId: string, specId: string) => Promise<{ exitCode: number }>;
  confirm: (message: string) => Promise<boolean>;
  checkSpecComplete: (specId: string) => Promise<boolean>;
  log: (message: string) => void;
}

/**
 * Get the latest handoff symlink's mtime (follows symlink to real file).
 * Returns null if no handoff exists.
 */
async function getHandoffState(): Promise<{ mtimeMs: number } | null> {
  try {
    const exists = await Bun.file(HANDOFF_LATEST).exists();
    if (!exists) return null;

    // stat follows symlinks, so this gives us the real file's mtime
    const stats = await stat(HANDOFF_LATEST);
    return { mtimeMs: stats.mtimeMs };
  } catch {
    return null;
  }
}

/**
 * Detect which signal the agent output
 */
function detectSignal(stdout: string): "handoff" | "complete" | "none" {
  if (stdout.includes(SIGNAL_COMPLETE)) return "complete";
  if (stdout.includes(SIGNAL_HANDOFF)) return "handoff";
  return "none";
}

/**
 * Find the newest handoff file (not the symlink, the actual timestamped file)
 */
async function findNewestHandoff(): Promise<string | null> {
  const glob = new Bun.Glob("handoff_*.md");
  let newest: { path: string; mtimeMs: number } | null = null;

  for await (const path of glob.scan({ cwd: HANDOFF_DIR })) {
    const fullPath = join(HANDOFF_DIR, path);
    const stats = await stat(fullPath);
    if (!newest || stats.mtimeMs > newest.mtimeMs) {
      newest = { path: fullPath, mtimeMs: stats.mtimeMs };
    }
  }

  return newest?.path ?? null;
}

/**
 * Run the auto-implement loop
 */
export async function autoImplement(
  options: AutoImplementOptions,
  deps: RunDeps
): Promise<RunResult> {
  const { specId, maxSessions, pause } = options;
  const runId = generateRunId(specId);
  const runDir = getRunDir(runId);

  deps.log(`Auto-implement run: ${runId}`);
  deps.log(`Spec: ${specId}`);
  deps.log(`Max sessions: ${maxSessions}`);
  deps.log(`Pause between sessions: ${pause}`);
  deps.log(`Run directory: ${runDir}`);
  deps.log("");
  deps.log(`Dashboard:  auto-implement watch ${runId}`);
  deps.log(`Full view:  tail -f ${runDir}/stream.jsonl | session --stream`);
  deps.log("");

  // Record run start
  await appendEvent(runDir, {
    timestamp: new Date().toISOString(),
    event: "run_started",
    runId,
    specId,
    maxSessions,
  });

  let totalSessions = 0;

  for (let i = 1; i <= maxSessions; i++) {
    // Snapshot handoff state before session
    const handoffBefore = await getHandoffState();

    deps.log(`--- Session ${i}/${maxSessions} ---`);

    const prompt = buildPrompt({
      specId,
      sessionNumber: i,
      maxSessions,
      runId,
      runDir,
    });

    // Record session start
    await appendEvent(runDir, {
      timestamp: new Date().toISOString(),
      event: "session_started",
      runId,
      specId,
      sessionNumber: i,
    });

    const startTime = Date.now();
    let result: { sessionId: string; exitCode: number; stdout: string; rotation: RotationSignal | null };

    try {
      result = await deps.spawnClaude(prompt, {
        sessionNumber: i,
        maxSessions,
        runDir,
        runId,
        specId,
      });
    } catch (err) {
      deps.log(`Session ${i} failed to spawn: ${err}`);
      await appendEvent(runDir, {
        timestamp: new Date().toISOString(),
        event: "session_failed",
        runId,
        specId,
        sessionNumber: i,
        details: String(err),
      });
      await recordRunEnd(runDir, runId, specId, totalSessions, maxSessions, "error");
      return { runId, runDir, totalSessions, outcome: "error" };
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    totalSessions++;

    // Detect signal from output
    const signal = detectSignal(result.stdout);

    // Check for rotation signal (post-commit hook killed Claude due to high context)
    const rotation = result.rotation;

    // Check if handoff file was updated
    const handoffAfter = await getHandoffState();
    const handoffUpdated =
      handoffAfter &&
      (!handoffBefore || handoffAfter.mtimeMs > handoffBefore.mtimeMs);
    const handoffFile = handoffUpdated
      ? await findNewestHandoff()
      : null;

    // Record session completion
    await appendEvent(runDir, {
      timestamp: new Date().toISOString(),
      event: result.exitCode === 0 ? "session_completed" : "session_failed",
      runId,
      specId,
      sessionNumber: i,
      sessionId: result.sessionId,
      durationSeconds,
      exitCode: result.exitCode,
      handoffFile,
      totalSessions,
      details: rotation
        ? `signal=rotation context=${rotation.context_percent}%`
        : `signal=${signal}`,
    });

    deps.log("");
    deps.log(`Session ${i} finished (${durationSeconds}s, exit=${result.exitCode}, signal=${signal})`);

    if (handoffFile) {
      deps.log(`Handoff written: ${handoffFile}`);
      await appendEvent(runDir, {
        timestamp: new Date().toISOString(),
        event: "handoff_detected",
        runId,
        specId,
        sessionNumber: i,
        handoffFile,
      });
    }

    // Handle rotation: post-commit hook killed Claude due to context pressure.
    // Spawn a handoff writer to capture state, then continue to next session.
    if (rotation) {
      deps.log(`Context rotation detected: ${rotation.context_percent}% (killed session ${rotation.killed_session_id})`);
      await appendEvent(runDir, {
        timestamp: new Date().toISOString(),
        event: "rotation_detected",
        runId,
        specId,
        sessionNumber: i,
        sessionId: rotation.killed_session_id,
        details: `context=${rotation.context_percent}%`,
      });

      // Spawn handoff writer if no handoff was already written
      if (!handoffUpdated) {
        deps.log("Spawning handoff writer...");
        await appendEvent(runDir, {
          timestamp: new Date().toISOString(),
          event: "handoff_writer_started",
          runId,
          specId,
          sessionNumber: i,
          sessionId: rotation.killed_session_id,
        });

        try {
          const writerResult = await deps.spawnHandoffWriter(
            rotation.killed_session_id,
            specId,
          );
          await appendEvent(runDir, {
            timestamp: new Date().toISOString(),
            event: writerResult.exitCode === 0 ? "handoff_writer_completed" : "handoff_writer_failed",
            runId,
            specId,
            sessionNumber: i,
            exitCode: writerResult.exitCode,
          });
          if (writerResult.exitCode === 0) {
            deps.log("Handoff writer completed.");
          } else {
            deps.log(`Handoff writer exited with code ${writerResult.exitCode} — continuing anyway.`);
          }
        } catch (err) {
          deps.log(`Handoff writer failed: ${err} — continuing anyway.`);
          await appendEvent(runDir, {
            timestamp: new Date().toISOString(),
            event: "handoff_writer_failed",
            runId,
            specId,
            sessionNumber: i,
            details: String(err),
          });
        }
      }

      // Rotation is treated as a handoff — continue to next session
      // (skip completion/no-signal checks below)
    } else {
      // Handle signals (non-rotation path)
      //
      // Detection priority:
      // 1. Explicit COMPLETE signal in stdout → done
      // 2. No signal but all Linear slices closed → done (agent forgot the signal)
      // 3. Handoff signal or handoff file updated → next session
      // 4. Nothing → stop (something broke)

      const isComplete = signal === "complete" || (
        signal !== "handoff" && await deps.checkSpecComplete(specId)
      );

      if (isComplete) {
        const via = signal === "complete" ? "signal" : "linear-check";
        deps.log("");
        deps.log(`All slices complete! (detected via ${via})`);
        await appendEvent(runDir, {
          timestamp: new Date().toISOString(),
          event: "completion_detected",
          runId,
          specId,
          sessionNumber: i,
          totalSessions,
          details: `detected_via=${via}`,
        });
        await recordRunEnd(runDir, runId, specId, totalSessions, maxSessions, "complete");
        return { runId, runDir, totalSessions, outcome: "complete" };
      }

      if (signal === "none" && !handoffUpdated) {
        // No signal, no handoff, not complete in Linear — something went wrong
        deps.log("");
        deps.log("No handoff or completion signal detected. Stopping.");
        deps.log("Check the session log for details.");
        await recordRunEnd(runDir, runId, specId, totalSessions, maxSessions, "no_signal");
        return { runId, runDir, totalSessions, outcome: "no_signal" };
      }
    }

    // If we have more sessions to go, optionally pause
    if (i < maxSessions && pause) {
      await appendEvent(runDir, {
        timestamp: new Date().toISOString(),
        event: "pause_waiting",
        runId,
        specId,
        sessionNumber: i,
      });

      deps.log("");
      const shouldContinue = await deps.confirm(
        `Session ${i} complete. Continue to session ${i + 1}?`
      );

      if (!shouldContinue) {
        deps.log("User cancelled.");
        await recordRunEnd(runDir, runId, specId, totalSessions, maxSessions, "user_cancelled");
        return { runId, runDir, totalSessions, outcome: "user_cancelled" };
      }

      await appendEvent(runDir, {
        timestamp: new Date().toISOString(),
        event: "pause_resumed",
        runId,
        specId,
        sessionNumber: i,
      });
    }
  }

  deps.log("");
  deps.log(`Max sessions (${maxSessions}) reached.`);
  await recordRunEnd(runDir, runId, specId, totalSessions, maxSessions, "max_sessions");
  return { runId, runDir, totalSessions, outcome: "max_sessions" };
}

async function recordRunEnd(
  runDir: string,
  runId: string,
  specId: string,
  totalSessions: number,
  maxSessions: number,
  outcome: string
): Promise<void> {
  await appendEvent(runDir, {
    timestamp: new Date().toISOString(),
    event: outcome === "complete" ? "run_completed" : "run_stopped",
    runId,
    specId,
    totalSessions,
    maxSessions,
    details: `outcome=${outcome}`,
  });
}
