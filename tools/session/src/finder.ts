/**
 * Session finder - discover and browse Claude sessions
 */

import { Glob } from "bun";
import { stat } from "fs/promises";
import { homedir } from "os";
import { basename, dirname } from "path";

export interface SessionInfo {
  path: string;
  id: string;
  mtime: Date;
  project: string; // Project hash (directory name)
}

export interface DiscoverOptions {
  project?: string; // Filter to specific project hash
  allProjects?: boolean; // Show sessions from all projects (overrides project)
  since?: string; // Filter to sessions after date (e.g., "1d", "1w", "2024-01-15")
}

export type OutputFormat = "path" | "id" | "json";

/**
 * Parse a since filter string into a Date
 * Supports: "1d" (days), "2w" (weeks), "2024-01-15" (absolute date)
 */
export function parseSinceFilter(since: string, now: Date = new Date()): Date | null {
  if (!since) return null;

  // Try relative format: Nd or Nw
  const relativeMatch = since.match(/^(\d+)([dw])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const result = new Date(now);

    if (unit === "d") {
      result.setDate(result.getDate() - amount);
    } else if (unit === "w") {
      result.setDate(result.getDate() - amount * 7);
    }
    return result;
  }

  // Try absolute date format: YYYY-MM-DD
  const absoluteMatch = since.match(/^\d{4}-\d{2}-\d{2}$/);
  if (absoluteMatch) {
    const date = new Date(since);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Format session output based on requested format
 */
export function formatOutput(session: SessionInfo, format: OutputFormat): string {
  switch (format) {
    case "id":
      return session.id;
    case "json":
      return JSON.stringify({
        path: session.path,
        id: session.id,
        date: session.mtime.toISOString(),
        project: session.project,
      });
    case "path":
    default:
      return session.path;
  }
}

/**
 * Get project hash from cwd (how Claude names project directories)
 */
export function getCurrentProjectHash(): string | null {
  const cwd = process.cwd();
  // Claude uses path with slashes replaced by dashes, e.g. /workspaces/test-mvp -> -workspaces-test-mvp
  const hash = cwd.replace(/\//g, "-");
  return hash || null;
}

/**
 * Quick check if a session file has any user messages
 * More efficient than full extractSessionMeta - just looks for first user type
 */
async function hasUserMessages(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  const content = await file.text();

  // Quick regex check - much faster than parsing every line
  return /"type"\s*:\s*"user"/.test(content);
}

/**
 * Discover all session files in Claude's projects directory
 */
export async function discoverSessions(
  options: DiscoverOptions = {}
): Promise<SessionInfo[]> {
  const claudeDir = `${homedir()}/.claude/projects`;

  // allProjects overrides project filter
  const globPattern = options.allProjects
    ? "*/*.jsonl"
    : options.project
      ? `${options.project}/*.jsonl`
      : "*/*.jsonl";
  const glob = new Glob(globPattern);

  // Parse since filter if provided
  const sinceDate = options.since ? parseSinceFilter(options.since) : null;

  const sessions: SessionInfo[] = [];

  for await (const file of glob.scan({ cwd: claudeDir, absolute: true })) {
    const filename = basename(file);

    // Skip subagent files
    if (filename.startsWith("agent-")) {
      continue;
    }

    // Get session ID from filename (remove .jsonl extension)
    const id = filename.replace(/\.jsonl$/, "");

    // Get project hash from parent directory
    const project = basename(dirname(file));

    try {
      const stats = await stat(file);

      // Apply since filter
      if (sinceDate && stats.mtime < sinceDate) {
        continue;
      }

      // Skip empty/snapshot-only files (no user messages)
      if (!(await hasUserMessages(file))) {
        continue;
      }

      sessions.push({
        path: file,
        id,
        mtime: stats.mtime,
        project,
      });
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort by mtime descending (most recent first)
  sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return sessions;
}

/**
 * Format a session as a line for fzf display
 * Format: "YYYY-MM-DD HH:MM  <path>"
 */
export function formatSessionLine(session: SessionInfo): string {
  const date = session.mtime.toISOString().slice(0, 10);
  const time = session.mtime.toISOString().slice(11, 16);
  return `${date} ${time}  ${session.path}`;
}

export interface FzfOptions {
  filter?: string; // Non-interactive mode for testing
}

/**
 * Run fzf with session list and return selected path
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

  const proc = Bun.spawn(args, {
    stdin: new Response(lines),
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const selected = output.trim();
  if (!selected) {
    return null;
  }

  // Extract path from line (last space-separated token)
  const path = selected.split(/\s{2,}/).pop()?.trim() || null;
  return path;
}

export interface SessionSummary {
  messages: string[];
  lineCount: number;
}

export interface SessionMeta {
  messages: string[];
  lineCount: number;
  summary: string | null;
  hasUserMessages: boolean;
}

/**
 * Extract metadata from a session file including summary, user messages, and line count
 */
export async function extractSessionMeta(sessionPath: string): Promise<SessionMeta> {
  const file = Bun.file(sessionPath);
  const content = await file.text();
  const lines = content.split("\n").filter((l) => l.trim());

  const messages: string[] = [];
  let summary: string | null = null;
  let hasUserMessages = false;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Check for summary line
      if (entry.type === "summary" && entry.summary) {
        summary = entry.summary;
        continue;
      }

      if (entry.type === "user" && entry.message?.content) {
        hasUserMessages = true;
        // Extract text from message content
        const msgContent = entry.message.content;
        if (typeof msgContent === "string") {
          const text = msgContent.trim();
          if (text && !text.startsWith("<")) {
            // Skip system reminders etc
            messages.push(truncateMessage(text));
          }
        } else if (Array.isArray(msgContent)) {
          for (const part of msgContent) {
            if (part.type === "text" && part.text) {
              const text = part.text.trim();
              if (text && !text.startsWith("<")) {
                messages.push(truncateMessage(text));
              }
            }
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return { messages, lineCount: lines.length, summary, hasUserMessages };
}

/**
 * Extract user messages and line count from a session file (lightweight, no full parse)
 */
export async function extractSessionSummary(sessionPath: string): Promise<SessionSummary> {
  const meta = await extractSessionMeta(sessionPath);
  return { messages: meta.messages, lineCount: meta.lineCount };
}

/**
 * Extract user messages from a session file (lightweight, no full parse)
 * @deprecated Use extractSessionSummary instead
 */
export async function extractUserMessages(sessionPath: string): Promise<string[]> {
  const summary = await extractSessionSummary(sessionPath);
  return summary.messages;
}

/**
 * Truncate a message to a reasonable length for display
 */
function truncateMessage(text: string, maxLen = 80): string {
  // Replace newlines with spaces
  const singleLine = text.replace(/\n+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + "...";
}

/**
 * Format a session as a multi-line entry for fzf
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

  const lines: string[] = [];
  // Line 1: date + line count
  lines.push(`${date} ${time}  [${lineCount}]`);

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

export interface FzfMultiLineOptions {
  filter?: string; // Non-interactive mode for testing
  preview?: boolean; // Enable preview pane (default: true)
}

/**
 * Extract session ID from a session file path
 */
export function extractSessionIdFromPath(path: string): string {
  const filename = basename(path);
  return filename.replace(/\.jsonl$/, "");
}

/**
 * Build fzf arguments array
 * Separated for testability
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
    const cliPath = new URL("./cli.ts", import.meta.url).pathname;
    args.push(
      "--preview",
      `echo {} | tail -1 | xargs bun ${cliPath}`,
      "--preview-window",
      "right:60%:wrap"
    );
  }

  // Keybindings only in interactive mode
  if (isInteractive) {
    // Header with keybinding hints
    args.push("--header", "ctrl-r: resume │ ctrl-t: retro │ ctrl-e: export │ enter: output path");

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
  }

  // Filter mode (non-interactive)
  if (options.filter) {
    args.push("--filter", options.filter);
  }

  return args;
}

export interface OutputFileData {
  path: string;
  id: string;
  date: string;
  project: string;
  summary: string | null;
}

/**
 * Write session info to a JSON file for external consumption (e.g., from Claude via tmux)
 */
export async function writeOutputFile(
  session: SessionInfo,
  outputPath: string,
  summary?: string | null
): Promise<void> {
  const data: OutputFileData = {
    path: session.path,
    id: session.id,
    date: session.mtime.toISOString(),
    project: session.project,
    summary: summary ?? null,
  };

  await Bun.write(outputPath, JSON.stringify(data, null, 2));
}

/**
 * Run fzf with multi-line entries (uses --read0 for NUL-separated input)
 */
export async function runFzfMultiLine(
  entries: string[],
  options: FzfMultiLineOptions = {}
): Promise<string | null> {
  // Join entries with NUL byte
  const input = entries.join("\0");

  const args = buildFzfArgs(options);

  const proc = Bun.spawn(args, {
    stdin: new Response(input),
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const selected = output.trim();
  if (!selected) {
    return null;
  }

  // Extract path from last line (full path stored there for extraction)
  const lines = selected.split("\n");
  const path = lines[lines.length - 1]?.trim() || null;
  return path;
}

export interface TmuxPopupOptions {
  width?: string;
  height?: string;
  allProjects?: boolean;
  since?: string;
}

/**
 * Build a tmux popup command to launch session finder
 * The popup will write selection to outputFile for external consumption
 */
export function buildTmuxPopupCommand(
  outputFile: string,
  options: TmuxPopupOptions = {}
): string {
  const { width = "80%", height = "80%", allProjects, since } = options;

  // Build the session-finder command
  const cliPath = new URL("./cli.ts", import.meta.url).pathname;
  const findArgs = ["find", "--output-file", outputFile];

  if (allProjects) {
    findArgs.push("--all-projects");
  }
  if (since) {
    findArgs.push("--since", since);
  }

  const findCmd = `bun ${cliPath} ${findArgs.join(" ")}`;

  // Build tmux popup command
  // -E: close popup when command exits
  // -w/-h: width/height
  return `tmux popup -E -w ${width} -h ${height} "${findCmd}"`;
}

export interface VscCommandOptions {
  allProjects?: boolean;
  since?: string;
}

/**
 * Build a vsc terminal create command to launch session finder
 * The terminal will write selection to outputFile for external consumption
 */
export function buildVscCommand(
  outputFile: string,
  options: VscCommandOptions = {}
): string {
  const { allProjects, since } = options;

  // Build the session-finder command
  const cliPath = new URL("./cli.ts", import.meta.url).pathname;
  const findArgs = ["find", "--output-file", outputFile];

  if (allProjects) {
    findArgs.push("--all-projects");
  }
  if (since) {
    findArgs.push("--since", since);
  }

  const findCmd = `bun ${cliPath} ${findArgs.join(" ")}`;

  // Build vsc terminal create command with --shellCmd for auto-close
  // Use full path to vsc since it may not be on PATH
  // Add timestamp to name to avoid reusing existing terminal
  const vscPath = new URL("../../vsc-bridge/bin/vsc", import.meta.url).pathname;
  const timestamp = Date.now();
  return `${vscPath} terminal create --shellCmd --name "Session Picker ${timestamp}" "${findCmd}"`;
}

/**
 * Check if we're running inside tmux
 */
export async function isTmuxAvailable(): Promise<boolean> {
  // Check TMUX env var - set when running inside tmux
  return !!process.env.TMUX;
}

/**
 * Check if vsc-bridge extension is available and responding
 */
export async function isVscBridgeAvailable(
  portFilePath?: string
): Promise<boolean> {
  const portFile = portFilePath ?? `${homedir()}/.vsc-bridge.port`;

  try {
    const file = Bun.file(portFile);
    if (!(await file.exists())) {
      return false;
    }

    const port = (await file.text()).trim();
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type PickerMethod = "tmux" | "vsc" | "auto";

/**
 * Detect which picker method is available
 * Priority: tmux > vsc > null
 */
export async function detectPickerMethod(
  vscPortFilePath?: string
): Promise<"tmux" | "vsc" | null> {
  // 1. Check tmux first (preferred)
  if (process.env.TMUX) {
    return "tmux";
  }

  // 2. Check vsc-bridge
  if (await isVscBridgeAvailable(vscPortFilePath)) {
    return "vsc";
  }

  return null;
}

/**
 * Generate a unique temp file path for session reference output
 */
export function generateOutputFilePath(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `/tmp/claude-session-ref-${timestamp}-${random}.json`;
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Poll for a file to exist and return its parsed JSON contents
 * Returns null if timeout reached
 */
export async function pollForFile<T = unknown>(
  filePath: string,
  options: PollOptions = {}
): Promise<T | null> {
  const { intervalMs = 100, timeoutMs = 60000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const content = await file.text();
        return JSON.parse(content) as T;
      }
    } catch {
      // File doesn't exist or couldn't be read, keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

export interface SessionPickerOptions {
  allProjects?: boolean;
  since?: string;
  timeoutMs?: number;
  method?: PickerMethod;
}

export interface SessionPickerResult {
  path: string;
  id: string;
  date: string;
  project: string;
  summary: string | null;
}

const NO_METHOD_ERROR = `No session picker method available.

To use the session picker, you need one of:

  1. tmux - Run Claude inside a tmux session
     Install: apt install tmux (or brew install tmux)
     Usage: tmux new-session -s claude

  2. VS Code Bridge - Install the vsc-bridge extension
     The extension should be auto-installed in this devcontainer.
     Check: vsc status

Run with --method to force a specific method.`;

/**
 * Open session picker and return selected session
 *
 * This is the main entry point for Claude to use when referencing previous sessions.
 * It:
 * 1. Detects available picker method (tmux or vsc)
 * 2. Opens picker UI (tmux popup or VS Code terminal)
 * 3. Polls for user selection
 * 4. Returns the selected session info
 *
 * @throws Error if no picker method available
 */
export async function openSessionPicker(
  options: SessionPickerOptions = {}
): Promise<SessionPickerResult | null> {
  const { allProjects, since, timeoutMs = 120000, method = "auto" } = options;

  // Determine which method to use
  let resolvedMethod: "tmux" | "vsc";

  if (method === "auto") {
    const detected = await detectPickerMethod();
    if (!detected) {
      throw new Error(NO_METHOD_ERROR);
    }
    resolvedMethod = detected;
  } else if (method === "tmux") {
    if (!(await isTmuxAvailable())) {
      throw new Error("tmux not available. Not running inside a tmux session.");
    }
    resolvedMethod = "tmux";
  } else if (method === "vsc") {
    if (!(await isVscBridgeAvailable())) {
      throw new Error("vsc-bridge not available. Check: vsc status");
    }
    resolvedMethod = "vsc";
  } else {
    throw new Error(`Unknown picker method: ${method}`);
  }

  // Generate unique output file
  const outputFile = generateOutputFilePath();

  // Build and run command based on method
  if (resolvedMethod === "tmux") {
    const popupCmd = buildTmuxPopupCommand(outputFile, { allProjects, since });

    // Run the popup (this returns immediately, popup runs in background)
    const proc = Bun.spawn(["sh", "-c", popupCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;
  } else {
    // vsc method - create terminal with session finder
    const vscCmd = buildVscCommand(outputFile, { allProjects, since });

    // Run vsc command to create terminal
    const proc = Bun.spawn(["sh", "-c", vscCmd], {
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;
  }

  // Poll for result file
  const result = await pollForFile<SessionPickerResult>(outputFile, {
    intervalMs: 100,
    timeoutMs,
  });

  // Clean up temp file
  try {
    const fs = await import("node:fs/promises");
    await fs.unlink(outputFile);
  } catch {
    // Ignore cleanup errors
  }

  return result;
}
