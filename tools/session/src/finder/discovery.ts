/**
 * Session discovery - finding and filtering Claude sessions.
 *
 * This module handles discovering session files in Claude's projects directory,
 * with support for filtering by project, date, and other criteria.
 */

import { Glob } from "bun";
import { stat, lstat } from "fs/promises";
import { homedir } from "os";
import { basename, dirname } from "path";
import { debugLog } from "../debug";
import type { SessionInfo, DiscoverOptions } from "./types";

// =============================================================================
// PROJECT DIRECTORY UTILITIES
// =============================================================================

/**
 * Get the Claude projects directory path.
 */
export function getClaudeProjectsDir(): string {
  return `${homedir()}/.claude/projects`;
}

/**
 * Check if the Claude projects directory exists.
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
 * Get project hash from cwd (how Claude names project directories).
 */
export function getCurrentProjectHash(): string | null {
  const cwd = process.cwd();
  // Claude uses path with slashes replaced by dashes, e.g. /workspaces/test-mvp -> -workspaces-test-mvp
  const hash = cwd.replace(/\//g, "-");
  return hash || null;
}

// =============================================================================
// DATE FILTERING
// =============================================================================

/**
 * Parse a since filter string into a Date.
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

// =============================================================================
// FILE SYSTEM UTILITIES
// =============================================================================

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
 * Quick check if a session file has any user messages.
 * More efficient than full extractSessionMeta - just looks for first user type.
 */
export async function hasUserMessages(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  const content = await file.text();

  // Quick regex check - much faster than parsing every line
  return /"type"\s*:\s*"user"/.test(content);
}

// =============================================================================
// SESSION DISCOVERY
// =============================================================================

/**
 * Discover all session files in Claude's projects directory.
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
