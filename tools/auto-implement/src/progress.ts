/**
 * CLI progress monitor — prints periodic updates to the operator's terminal
 * while a headless Claude session runs.
 *
 * Polls git log, handoff files, and process liveness on a configurable interval.
 */

import { stat } from "fs/promises";
import { join } from "path";

const HANDOFF_DIR = "/workspaces/test-mvp/.claude/handoffs";
const REPO_DIR = "/workspaces/test-mvp";

interface ProgressMonitorOptions {
  sessionNumber: number;
  maxSessions: number;
  /** Polling interval in ms (default: 30000) */
  intervalMs?: number;
}

/**
 * Format a timestamp for log output: [HH:MM:SS]
 */
function ts(): string {
  const now = new Date();
  return `[${now.toTimeString().slice(0, 8)}]`;
}

/**
 * Format elapsed time as human-readable string
 */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h${remainingMin}min`;
}

export class ProgressMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private lastGitHash: string | null = null;
  private lastHandoffMtime: number | null = null;
  private sessionNumber: number;
  private maxSessions: number;
  private intervalMs: number;
  private sessionId: string | null = null;

  constructor(options: ProgressMonitorOptions) {
    this.sessionNumber = options.sessionNumber;
    this.maxSessions = options.maxSessions;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.startTime = Date.now();
  }

  /**
   * Start the progress monitor. Call this when the session begins.
   */
  async start(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.startTime = Date.now();

    // Snapshot current state
    this.lastGitHash = await this.getLatestGitHash();
    this.lastHandoffMtime = await this.getHandoffMtime();

    this.print(
      `Session ${this.sessionNumber}/${this.maxSessions} started (sid: ${sessionId.slice(0, 8)})`
    );

    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  /**
   * Stop the progress monitor. Call this when the session ends.
   */
  stop(exitCode: number, signal: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const elapsed = formatElapsed(Date.now() - this.startTime);
    this.print(
      `Session ${this.sessionNumber} ended (${elapsed}, exit=${exitCode}, signal=${signal})`
    );
  }

  /**
   * Single poll tick — check for changes and print updates.
   */
  private async tick(): Promise<void> {
    const elapsed = formatElapsed(Date.now() - this.startTime);

    // Check for new git commits
    await this.checkGitActivity();

    // Check for new handoff files
    await this.checkHandoffActivity();

    // Heartbeat
    this.print(
      `Session ${this.sessionNumber} running... ${elapsed} elapsed`
    );
  }

  /**
   * Check for new git commits since monitor started.
   */
  private async checkGitActivity(): Promise<void> {
    try {
      const currentHash = await this.getLatestGitHash();
      if (currentHash && currentHash !== this.lastGitHash) {
        // New commit(s) detected — get the message
        const message = await this.getCommitMessage(currentHash);
        const pushStatus = await this.getUnpushedCount();
        const pushNote =
          pushStatus > 0 ? ` (${pushStatus} unpushed)` : " (pushed)";
        this.print(`Commit detected: ${message}${pushNote}`);
        this.lastGitHash = currentHash;
      }
    } catch {
      // Git not available or errored — skip silently
    }
  }

  /**
   * Check for new handoff files.
   */
  private async checkHandoffActivity(): Promise<void> {
    try {
      const currentMtime = await this.getHandoffMtime();
      if (
        currentMtime !== null &&
        (this.lastHandoffMtime === null ||
          currentMtime > this.lastHandoffMtime)
      ) {
        // Find the newest handoff filename
        const filename = await this.getNewestHandoffFilename();
        this.print(`New handoff detected: ${filename ?? "latest.md"}`);
        this.lastHandoffMtime = currentMtime;
      }
    } catch {
      // Skip silently
    }
  }

  /**
   * Get the latest git commit hash on HEAD.
   */
  private async getLatestGitHash(): Promise<string | null> {
    try {
      const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
        cwd: REPO_DIR,
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      return out.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the commit message for a given hash.
   */
  private async getCommitMessage(hash: string): Promise<string> {
    try {
      const proc = Bun.spawn(
        ["git", "log", "-1", "--format=%s", hash],
        {
          cwd: REPO_DIR,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      return out.trim() || "(no message)";
    } catch {
      return "(unknown)";
    }
  }

  /**
   * Get count of unpushed commits.
   */
  private async getUnpushedCount(): Promise<number> {
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

  /**
   * Get the mtime of the latest handoff symlink target.
   */
  private async getHandoffMtime(): Promise<number | null> {
    try {
      const latestPath = join(HANDOFF_DIR, "latest.md");
      const stats = await stat(latestPath);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Get the filename of the newest handoff_*.md file.
   */
  private async getNewestHandoffFilename(): Promise<string | null> {
    try {
      const glob = new Bun.Glob("handoff_*.md");
      let newest: { name: string; mtimeMs: number } | null = null;

      for await (const path of glob.scan({ cwd: HANDOFF_DIR })) {
        const fullPath = join(HANDOFF_DIR, path);
        const stats = await stat(fullPath);
        if (!newest || stats.mtimeMs > newest.mtimeMs) {
          newest = { name: path, mtimeMs: stats.mtimeMs };
        }
      }

      return newest?.name ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Print a timestamped progress message to stderr (so it doesn't
   * mix with session stdout which is used for signal detection).
   */
  private print(message: string): void {
    process.stderr.write(`${ts()} ${message}\n`);
  }
}
