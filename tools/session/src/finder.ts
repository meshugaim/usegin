/**
 * Session finder - discover and browse Claude sessions
 */

import { Glob } from "bun";
import { stat, lstat } from "fs/promises";
import { homedir } from "os";
import { basename, dirname } from "path";
import { isEntry } from "./validation";
import { debugLog } from "./debug";
import {
  SessionNotFoundError,
  TmuxNotAvailableError,
  NoPickerMethodError,
} from "./errors";

// Re-export error classes for consumers
export {
  SessionError,
  SessionNotFoundError,
  NoSessionsFoundError,
  TmuxNotAvailableError,
  ParsingTimeoutError,
  NoPickerMethodError,
  FzfNotFoundError,
} from "./errors";

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
  debug?: boolean; // Log debug info to stderr
}

export type OutputFormat = "path" | "id" | "json";

/**
 * Custom error for ambiguous session ID prefixes
 */
export class AmbiguousSessionError extends Error {
  public readonly prefix: string;
  public readonly matches: SessionInfo[];

  constructor(prefix: string, matches: SessionInfo[]) {
    const matchList = matches
      .map((m) => `  ${m.id.slice(0, 8)}`)
      .join("\n");
    super(
      `Ambiguous session ID '${prefix}'. Did you mean:\n${matchList}`
    );
    this.name = "AmbiguousSessionError";
    this.prefix = prefix;
    this.matches = matches;
  }
}

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
 * Get the Claude projects directory path
 */
export function getClaudeProjectsDir(): string {
  return `${homedir()}/.claude/projects`;
}

/**
 * Check if the Claude projects directory exists
 */
export async function claudeProjectsDirExists(): Promise<boolean> {
  try {
    const stats = await stat(getClaudeProjectsDir());
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a broken symlink (symlink pointing to non-existent target).
 *
 * @returns true if the path is a symlink that points to a non-existent target
 */
export async function isBrokenSymlink(filePath: string): Promise<boolean> {
  try {
    // lstat doesn't follow symlinks - it tells us about the link itself
    const lstats = await lstat(filePath);

    if (!lstats.isSymbolicLink()) {
      // Not a symlink, can't be a broken symlink
      return false;
    }

    // It's a symlink - check if the target exists by using stat (which follows symlinks)
    try {
      await stat(filePath);
      // If stat succeeds, the symlink target exists
      return false;
    } catch {
      // stat failed, meaning the symlink target doesn't exist
      return true;
    }
  } catch {
    // lstat failed - file doesn't exist at all (not even as a symlink)
    return false;
  }
}

/**
 * Discover all session files in Claude's projects directory
 */
export async function discoverSessions(
  options: DiscoverOptions = {}
): Promise<SessionInfo[]> {
  const debug = options.debug ?? false;
  const claudeDir = getClaudeProjectsDir();

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
  let skippedCount = 0;

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
    } catch (error) {
      skippedCount++;
      // Check if this is a broken symlink for better debug message
      const broken = await isBrokenSymlink(file);
      if (broken) {
        debugLog(debug, `Skipping broken symlink: ${file}`);
      } else {
        debugLog(debug, `Could not stat ${file}: ${(error as Error).message}`);
      }
    }
  }

  if (skippedCount > 0) {
    debugLog(debug, `Skipped ${skippedCount} file(s) due to stat errors`);
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
      const parsed = JSON.parse(line);
      if (!isEntry(parsed)) {
        continue; // Skip invalid entries
      }

      // Check for summary line
      if (parsed.type === "summary" && parsed.summary) {
        summary = parsed.summary;
        continue;
      }

      if (parsed.type === "user" && parsed.message?.content) {
        hasUserMessages = true;
        // Extract text from message content
        const msgContent = parsed.message.content;
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

  // Check if this is a live session (recently modified)
  const liveIndicator = isLiveSession(session.mtime) ? " [LIVE]" : "";

  const lines: string[] = [];
  // Line 1: date + line count + live indicator
  lines.push(`${date} ${time}  [${lineCount}]${liveIndicator}`);

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
 * Check if a string looks like a session ID (UUID format)
 * Returns false for file paths or other strings
 */
export function isSessionId(input: string): boolean {
  if (!input) return false;

  // If it contains a slash, it's a path
  if (input.includes("/")) return false;

  // If it has a file extension, it's a filename
  if (input.includes(".")) return false;

  // UUID v4 with hyphens: 8-4-4-4-12 hex chars (36 total)
  const uuidWithHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // UUID v4 without hyphens: 32 hex chars
  const uuidWithoutHyphens = /^[0-9a-f]{32}$/i;

  return uuidWithHyphens.test(input) || uuidWithoutHyphens.test(input);
}

/**
 * Check if a string looks like a session ID or a valid prefix of one
 * Accepts full UUIDs or hex prefixes (minimum 4 characters)
 * Returns false for file paths or other strings
 */
export function isSessionIdOrPrefix(input: string): boolean {
  if (!input) return false;

  // If it contains a slash, it's a path
  if (input.includes("/")) return false;

  // If it has a file extension, it's a filename
  if (input.includes(".")) return false;

  // Minimum 4 characters for a prefix (to avoid too many ambiguous matches)
  if (input.length < 4) return false;

  // Full UUID with hyphens: 8-4-4-4-12 hex chars (36 total)
  const uuidWithHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Full UUID without hyphens: 32 hex chars
  const uuidWithoutHyphens = /^[0-9a-f]{32}$/i;

  // Check for full UUID first
  if (uuidWithHyphens.test(input) || uuidWithoutHyphens.test(input)) {
    return true;
  }

  // Check for valid prefix: hex chars and hyphens only, in valid UUID prefix pattern
  // Valid patterns: "abc12345", "abc12345-", "abc12345-1234", etc.
  const validPrefix = /^[0-9a-f]+(-[0-9a-f]*)*$/i;

  return validPrefix.test(input);
}

/**
 * Find sessions matching a prefix
 * Searches current project first, then all projects
 * Returns all matching sessions (may be multiple for ambiguous prefix)
 */
export async function findSessionsByPrefix(prefix: string): Promise<SessionInfo[]> {
  const currentProject = getCurrentProjectHash();

  // First, search in current project (if we have one)
  if (currentProject) {
    const currentProjectSessions = await discoverSessions({
      project: currentProject,
    });

    const matches = currentProjectSessions.filter((s) => s.id.startsWith(prefix));
    if (matches.length > 0) {
      return matches;
    }
  }

  // Fall back to searching all projects
  const allSessions = await discoverSessions({ allProjects: true });
  return allSessions.filter((s) => s.id.startsWith(prefix));
}

/**
 * Find a session by its ID
 * Searches current project first, then all projects
 * Returns null if not found
 */
export async function findSessionById(sessionId: string): Promise<SessionInfo | null> {
  const currentProject = getCurrentProjectHash();

  // First, search in current project (if we have one)
  if (currentProject) {
    const currentProjectSessions = await discoverSessions({
      project: currentProject,
    });

    const match = currentProjectSessions.find((s) => s.id === sessionId);
    if (match) {
      return match;
    }
  }

  // Fall back to searching all projects
  const allSessions = await discoverSessions({ allProjects: true });
  const match = allSessions.find((s) => s.id === sessionId);

  return match ?? null;
}

/**
 * Resolve a session path or ID to a full file path
 * - If input looks like a path (contains /), returns it unchanged
 * - If input is a full session ID (UUID), resolves it to full path
 * - If input is a short ID prefix, resolves it if unique, throws AmbiguousSessionError if multiple matches
 * - Throws if session ID is not found
 */
export async function resolveSessionPath(input: string): Promise<string> {
  // If it doesn't look like an ID or prefix, treat as path and return unchanged
  if (!isSessionIdOrPrefix(input)) {
    return input;
  }

  // Check if it's a full UUID - use exact match
  if (isSessionId(input)) {
    const session = await findSessionById(input);
    if (!session) {
      const currentProject = getCurrentProjectHash();
      throw new SessionNotFoundError(input, {
        searchedLocation: currentProject
          ? `~/.claude/projects/${currentProject}/`
          : "~/.claude/projects/",
      });
    }
    return session.path;
  }

  // It's a prefix - find matching sessions
  const matches = await findSessionsByPrefix(input);

  if (matches.length === 0) {
    const currentProject = getCurrentProjectHash();
    throw new SessionNotFoundError(input, {
      searchedLocation: currentProject
        ? `~/.claude/projects/${currentProject}/`
        : "~/.claude/projects/",
    });
  }

  if (matches.length === 1) {
    return matches[0].path;
  }

  // Multiple matches - throw ambiguous error
  throw new AmbiguousSessionError(input, matches);
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

export interface ConflictingFlagsOptions {
  project?: string;
  allProjects?: boolean;
}

/**
 * Check for conflicting command line flags and return a warning message if found.
 *
 * @returns Warning message string, or null if no conflict
 */
export function warnIfConflictingFlags(options: ConflictingFlagsOptions): string | null {
  if (options.project && options.allProjects) {
    return "Ignoring --project because --all-projects specified";
  }
  return null;
}

/**
 * Check if we're running inside tmux
 */
export async function isTmuxAvailable(): Promise<boolean> {
  // Check TMUX env var - set when running inside tmux
  return !!process.env.TMUX;
}

/**
 * Check if fzf is available on the system
 * Returns true if fzf is installed and executable
 */
export async function checkFzfAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "fzf"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
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
      throw new NoPickerMethodError();
    }
    resolvedMethod = detected;
  } else if (method === "tmux") {
    if (!(await isTmuxAvailable())) {
      throw new TmuxNotAvailableError();
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
