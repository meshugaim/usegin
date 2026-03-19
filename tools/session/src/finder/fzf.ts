/**
 * FZF integration for interactive session browsing.
 *
 * This module handles formatting sessions for fzf display and running
 * fzf with appropriate options for session selection.
 */

import { basename, dirname } from "path";
import type { SessionInfo, FzfOptions, FzfMultiLineOptions } from "./types";

// =============================================================================
// LIVE SESSION DETECTION
// =============================================================================

/**
 * Check if a session appears to be live (currently being written to).
 * A session is considered live if it was modified within the last 5 seconds.
 *
 * @param mtime The modification time of the session file
 * @returns true if the session appears to be in progress
 */
export function isLiveSession(mtime: Date): boolean {
  const LIVE_THRESHOLD_MS = 5000; // 5 seconds
  const ageMs = Date.now() - mtime.getTime();
  return ageMs <= LIVE_THRESHOLD_MS;
}

// =============================================================================
// SESSION FORMATTING
// =============================================================================

/**
 * Format a session as a line for fzf display.
 * Format: "YYYY-MM-DD HH:MM  <path>"
 */
export function formatSessionLine(session: SessionInfo): string {
  const date = session.mtime.toISOString().slice(0, 10);
  const time = session.mtime.toISOString().slice(11, 16);
  return `${date} ${time}  ${session.path}`;
}

/**
 * Format a session as a multi-line entry for fzf.
 */
export function formatMultiLineEntry(
  session: SessionInfo,
  messages: string[],
  lineCount: number,
  maxMessages = 6,
  currentProject?: string,
  summary?: string | null
): string {
  const date = session.mtime.toISOString().slice(0, 10);
  const time = session.mtime.toISOString().slice(11, 16);

  // Build short path: just filename, or project/filename if different project
  const filename = basename(session.path);
  const project = basename(dirname(session.path));
  const shortPath =
    currentProject && project === currentProject
      ? filename
      : `${project}/${filename}`;

  // Check if this is a live session (recently modified)
  const liveIndicator = isLiveSession(session.mtime) ? " [LIVE]" : "";

  // Remote indicator for sessions from ~/agent-records/
  const remoteIndicator = session.source === "remote" ? " [REMOTE]" : "";

  const lines: string[] = [];
  // Line 1: date + line count + status indicators
  lines.push(`${date} ${time}  [${lineCount}]${liveIndicator}${remoteIndicator}`);

  // Line 2: summary (if present) or short path
  if (summary) {
    lines.push(`★ ${summary}`);
    // Line 3: short path when summary present
    lines.push(shortPath);
  } else {
    // Line 2: short display path (no summary)
    lines.push(shortPath);
  }

  if (messages.length <= maxMessages) {
    for (const msg of messages) {
      lines.push(`> ${msg}`);
    }
  } else {
    // Show first few and last few with ellipsis
    const firstCount = Math.ceil(maxMessages / 2);
    const lastCount = Math.floor(maxMessages / 2);

    for (let i = 0; i < firstCount; i++) {
      lines.push(`> ${messages[i]}`);
    }
    lines.push("...");
    for (let i = messages.length - lastCount; i < messages.length; i++) {
      lines.push(`> ${messages[i]}`);
    }
  }

  // Last line: full path (for extraction, not visible in short list)
  lines.push(session.path);

  return lines.join("\n");
}

// =============================================================================
// FZF AVAILABILITY
// =============================================================================

/**
 * Check if fzf is available on the system.
 * Returns true if fzf is installed and executable.
 */
export async function checkFzfAvailable(): Promise<boolean> {
  try {
    const childProcess = Bun.spawn(["which", "fzf"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await childProcess.exited;
    return childProcess.exitCode === 0;
  } catch {
    return false;
  }
}

// =============================================================================
// FZF ARGUMENT BUILDING
// =============================================================================

/**
 * Build fzf arguments array.
 * Separated for testability.
 */
export function buildFzfArgs(options: FzfMultiLineOptions): string[] {
  const args = [
    "fzf",
    "--read0",
    "--highlight-line",
    "--gap",
  ];

  const isInteractive = !options.filter;

  // Preview pane
  if (options.preview !== false && isInteractive) {
    const cliPath = new URL("../cli.ts", import.meta.url).pathname;
    args.push(
      "--preview",
      `echo {} | tail -1 | xargs bun ${cliPath} --timeline`,
      "--preview-window",
      "right:60%:wrap"
    );
  }

  // Keybindings only in interactive mode
  if (isInteractive) {
    // Header with keybinding hints
    args.push("--header", "ctrl-r: resume │ ctrl-t: retro │ ctrl-e: export │ ctrl-x: delete │ ctrl-u/d: scroll │ enter: output path");

    // ctrl-r: resume session - print special marker so CLI can spawn claude
    args.push(
      "--bind",
      `ctrl-r:become(printf 'RESUME:'; echo {} | tail -1)`
    );

    // ctrl-t: push to retro - print special marker so CLI can run push-session
    args.push(
      "--bind",
      `ctrl-t:become(printf 'RETRO:'; echo {} | tail -1)`
    );

    // ctrl-e: export to markdown - print special marker
    args.push(
      "--bind",
      `ctrl-e:become(printf 'EXPORT:'; echo {} | tail -1)`
    );

    // ctrl-x: delete session and reload list
    if (options.deleteCommand && options.reloadCommand) {
      args.push(
        "--bind",
        `ctrl-x:execute-silent(${options.deleteCommand})+reload(${options.reloadCommand})`
      );
    }

    // ctrl-u/d: scroll preview pane
    args.push("--bind", "ctrl-u:preview-half-page-up");
    args.push("--bind", "ctrl-d:preview-half-page-down");
  }

  // Filter mode (non-interactive)
  if (options.filter) {
    args.push("--filter", options.filter);
  }

  return args;
}

// =============================================================================
// FZF EXECUTION
// =============================================================================

/**
 * Run fzf with session list and return selected path.
 */
export async function runFzf(
  sessions: SessionInfo[],
  options: FzfOptions = {}
): Promise<string | null> {
  const lines = sessions.map(formatSessionLine).join("\n");

  const args = ["fzf"];
  if (options.filter) {
    args.push("--filter", options.filter);
  }

  const childProcess = Bun.spawn(args, {
    stdin: new Response(lines),
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(childProcess.stdout).text();
  await childProcess.exited;

  const selected = output.trim();
  if (!selected) {
    return null;
  }

  // Extract path from line (last space-separated token)
  const path = selected.split(/\s{2,}/).pop()?.trim() || null;
  return path;
}

/**
 * Run fzf with multi-line entries (uses --read0 for NUL-separated input).
 */
export async function runFzfMultiLine(
  entries: string[],
  options: FzfMultiLineOptions = {}
): Promise<string | null> {
  // Join entries with NUL byte
  const input = entries.join("\0");

  const args = buildFzfArgs(options);

  const childProcess = Bun.spawn(args, {
    stdin: new Response(input),
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(childProcess.stdout).text();
  await childProcess.exited;

  const selected = output.trim();
  if (!selected) {
    return null;
  }

  // Extract path from last line (full path stored there for extraction)
  const lines = selected.split("\n");
  const path = lines[lines.length - 1]?.trim() || null;
  return path;
}
