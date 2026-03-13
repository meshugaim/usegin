/**
 * auto-implement watch — dashboard for monitoring a running auto-implement run.
 *
 * Reads manifest, git state, activity log, and Linear to show a compact
 * auto-refreshing summary of what's happening.
 */

import { readdir, stat } from "fs/promises";
import { join } from "path";
import { readManifest, getRunsDir, type ManifestEvent } from "./manifest";
import { readLatestContext, readRecentActivity } from "./activity";

const REPO_DIR = "/workspaces/test-mvp";

interface WatchOptions {
  runId: string;
  /** Refresh interval in ms (default: 3000) */
  intervalMs?: number;
}

interface SessionInfo {
  sessionNumber: number;
  sessionId?: string;
  startedAt: string;
  durationSeconds?: number;
  exitCode?: number;
  signal?: string;
}

interface DashboardData {
  runId: string;
  specId: string;
  currentSession: SessionInfo | null;
  totalSessionsCompleted: number;
  maxSessions: number;
  elapsedSinceRunStart: number;
  currentSlice: string | null;
  lastCommit: { message: string; timeAgo: string } | null;
  unpushedCount: number;
  contextPercent: string | null;
  recentActivity: Array<{ time: string; type: string; detail: string }>;
  runOutcome: string | null;
}

/**
 * Run the watch dashboard loop.
 */
export async function runWatch(options: WatchOptions): Promise<void> {
  const { runId, intervalMs = 3_000 } = options;

  // Resolve run directory
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

  // Initial render
  await renderDashboard(targetDir, runId);

  // Auto-refresh loop
  const timer = setInterval(async () => {
    await renderDashboard(targetDir, runId);
  }, intervalMs);

  // Handle graceful exit
  const cleanup = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

/**
 * Render a single frame of the dashboard.
 */
async function renderDashboard(runDir: string, runId: string): Promise<void> {
  const data = await gatherData(runDir, runId);
  const output = formatDashboard(data);

  // Clear screen and move cursor to top
  process.stdout.write("\x1B[2J\x1B[H");
  process.stdout.write(output);
}

/**
 * Gather all data sources for the dashboard.
 */
async function gatherData(runDir: string, runId: string): Promise<DashboardData> {
  const events = await readManifest(runDir);

  // Extract run metadata
  const startEvent = events.find((e) => e.event === "run_started");
  const endEvent = events.find(
    (e) => e.event === "run_completed" || e.event === "run_stopped"
  );
  const specId = startEvent?.specId ?? "unknown";
  const maxSessions = startEvent?.maxSessions ?? 10;

  // Find current/latest session
  const sessionStarts = events.filter((e) => e.event === "session_started");
  const sessionEnds = events.filter(
    (e) => e.event === "session_completed" || e.event === "session_failed"
  );
  const completedCount = sessionEnds.length;

  let currentSession: SessionInfo | null = null;
  if (sessionStarts.length > 0) {
    const latest = sessionStarts[sessionStarts.length - 1];
    const matchingEnd = sessionEnds.find(
      (e) => e.sessionNumber === latest.sessionNumber
    );

    currentSession = {
      sessionNumber: latest.sessionNumber!,
      sessionId: latest.sessionId ?? matchingEnd?.sessionId,
      startedAt: latest.timestamp,
      durationSeconds: matchingEnd?.durationSeconds,
      exitCode: matchingEnd?.exitCode,
      signal: matchingEnd?.details?.replace("signal=", ""),
    };
  }

  // Elapsed since run start
  const runStartTime = startEvent
    ? new Date(startEvent.timestamp).getTime()
    : Date.now();
  const elapsedSinceRunStart = Date.now() - runStartTime;

  // Git data (best effort)
  const [lastCommit, unpushedCount] = await Promise.all([
    getLastCommit(),
    getUnpushedCount(),
  ]);

  // Current slice from Linear (best effort)
  const currentSlice = await getCurrentSlice(specId);

  // Context % and recent activity from activity log
  const contextPercent = await readLatestContext(runDir);
  const recentActivity = await readRecentActivity(runDir);

  // Run outcome
  const runOutcome = endEvent?.details?.replace("outcome=", "") ?? null;

  return {
    runId,
    specId,
    currentSession,
    totalSessionsCompleted: completedCount,
    maxSessions,
    elapsedSinceRunStart,
    currentSlice,
    lastCommit,
    unpushedCount,
    contextPercent,
    recentActivity,
    runOutcome,
  };
}

/**
 * Format the dashboard as a string.
 */
function formatDashboard(data: DashboardData): string {
  const lines: string[] = [];

  const status = data.runOutcome
    ? `FINISHED (${data.runOutcome})`
    : "RUNNING";

  lines.push(`=== Auto-Implement: ${data.specId} === [${status}]`);
  lines.push("");

  // Session info
  if (data.currentSession) {
    const s = data.currentSession;
    const sessionElapsed = s.durationSeconds
      ? formatElapsed(s.durationSeconds * 1000)
      : formatElapsed(Date.now() - new Date(s.startedAt).getTime());

    const sessionStatus = s.exitCode !== undefined ? `done (exit=${s.exitCode})` : "running";

    lines.push(
      `Session ${s.sessionNumber}/${data.maxSessions} | ${sessionElapsed} elapsed | ${sessionStatus}`
    );
  } else {
    lines.push("No sessions started yet");
  }

  // Total run elapsed
  lines.push(
    `Run elapsed: ${formatElapsed(data.elapsedSinceRunStart)} | ${data.totalSessionsCompleted} sessions completed`
  );
  lines.push("");

  // Slice
  if (data.currentSlice) {
    lines.push(`Slice: ${data.currentSlice}`);
  }

  // Context
  lines.push(`Context: ${data.contextPercent ?? "unknown"}`);

  // Git
  if (data.lastCommit) {
    lines.push(
      `Last commit: ${data.lastCommit.timeAgo} — "${data.lastCommit.message}"`
    );
  } else {
    lines.push("Last commit: none detected");
  }
  lines.push(`Unpushed: ${data.unpushedCount} commits`);

  lines.push("");

  // Recent activity
  if (data.recentActivity.length > 0) {
    lines.push("Recent activity:");
    for (const a of data.recentActivity.slice(0, 8)) {
      lines.push(`  ${a.time}  ${a.type.padEnd(8)} ${a.detail}`);
    }
  } else {
    lines.push("Recent activity: (none available)");
  }

  lines.push("");
  lines.push(`Updated: ${new Date().toTimeString().slice(0, 8)} | Ctrl+C to exit`);
  lines.push(`Full view: tail -f ${data.runId ? `~/.auto-implement/runs/${data.runId}/stream.jsonl` : "stream.jsonl"} | session --stream`);

  return lines.join("\n") + "\n";
}

// --- Data source helpers ---

async function getLastCommit(): Promise<{ message: string; timeAgo: string } | null> {
  try {
    const proc = Bun.spawn(
      ["git", "log", "-1", "--format=%s|%cr"],
      {
        cwd: REPO_DIR,
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    const parts = out.trim().split("|");
    if (parts.length >= 2) {
      return { message: parts[0], timeAgo: parts.slice(1).join("|") };
    }
    return null;
  } catch {
    return null;
  }
}

async function getUnpushedCount(): Promise<number> {
  try {
    const proc = Bun.spawn(
      ["git", "rev-list", "--count", "@{u}..HEAD"],
      {
        cwd: REPO_DIR,
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function getCurrentSlice(specId: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["plan", "show", specId, "--tree", "--json"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return null;

    const data = JSON.parse(stdout);
    const children: Array<{ identifier?: string; title?: string; status?: string }> =
      data.children || [];

    // Find the In Progress child
    const inProgress = children.find((c) => {
      const status = (c.status || "").toLowerCase();
      return status === "in progress" || status === "started" || status === "in_progress";
    });

    if (inProgress) {
      return `${inProgress.identifier ?? "?"} — ${inProgress.title ?? "?"}`;
    }

    // Count done vs total
    const done = children.filter((c) => {
      const status = (c.status || "").toLowerCase();
      return status === "done" || status === "closed" || status === "completed";
    }).length;

    return `${done}/${children.length} slices done`;
  } catch {
    return null;
  }
}

// Context % and recent activity are now read from the activity log
// via readLatestContext() and readRecentActivity() from ./activity.ts.
// The raw stream-json is also saved to <runDir>/stream.jsonl for
// full narrative view via: tail -f stream.jsonl | session --stream

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h${remainingMin}min`;
}

