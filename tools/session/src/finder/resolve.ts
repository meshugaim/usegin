/**
 * Session resolution - finding sessions by ID or prefix.
 *
 * This module handles resolving session IDs and prefixes to full file paths,
 * with support for short ID prefixes (e.g., "abc12345" instead of full UUID).
 */

import { basename, join } from "path";
import { readdir } from "node:fs/promises";
import { SessionNotFoundError } from "../errors";
import { AmbiguousSessionError } from "./types";
import type { SessionInfo } from "./types";
import { discoverSessions, getCurrentProjectHash, getClaudeProjectsDir, claudeProjectsDirExists } from "./discovery";

// =============================================================================
// SESSION ID UTILITIES
// =============================================================================

/**
 * Extract session ID from a session file path.
 */
export function extractSessionIdFromPath(path: string): string {
  const filename = basename(path);
  return filename.replace(/\.jsonl$/, "");
}

/**
 * Check if a string looks like a session ID (UUID format).
 * Returns false for file paths or other strings.
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
 * Check if a string looks like a session ID or a valid prefix of one.
 * Accepts full UUIDs or hex prefixes (minimum 4 characters).
 * Returns false for file paths or other strings.
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

// =============================================================================
// SESSION LOOKUP
// =============================================================================

/**
 * Find sessions matching a prefix.
 * Searches current project first, then all projects.
 * Returns all matching sessions (may be multiple for ambiguous prefix).
 */
export async function findSessionsByPrefix(prefix: string): Promise<SessionInfo[]> {
  const currentProject = getCurrentProjectHash();

  // First, search in current project (if we have one)
  if (currentProject) {
    const currentProjectSessions = await discoverSessions({
      project: currentProject,
    });

    const matches = currentProjectSessions.filter((session) => session.id.startsWith(prefix));
    if (matches.length > 0) {
      return matches;
    }
  }

  // Fall back to searching all projects
  const allSessions = await discoverSessions({ allProjects: true });
  return allSessions.filter((session) => session.id.startsWith(prefix));
}

/**
 * Find a session by its ID.
 * Searches current project first, then all projects.
 * Returns null if not found.
 */
export async function findSessionById(sessionId: string): Promise<SessionInfo | null> {
  const currentProject = getCurrentProjectHash();

  // First, search in current project (if we have one)
  if (currentProject) {
    const currentProjectSessions = await discoverSessions({
      project: currentProject,
    });

    const match = currentProjectSessions.find((session) => session.id === sessionId);
    if (match) {
      return match;
    }
  }

  // Fall back to searching all projects
  const allSessions = await discoverSessions({ allProjects: true });
  const match = allSessions.find((session) => session.id === sessionId);

  return match ?? null;
}

// =============================================================================
// SUBAGENT FILE LOOKUP
// =============================================================================

/**
 * Find agent files whose agentId starts with the given prefix.
 *
 * Searches the specified directories for `agent-<prefix>*.jsonl` files.
 * If no directories are provided, searches all Claude project directories.
 *
 * Returns full paths to matching agent files.
 */
export async function findAgentFilesByPrefix(
  prefix: string,
  searchDirs?: string[]
): Promise<string[]> {
  const dirs = searchDirs ?? (await getProjectDirs());
  const results: string[] = [];

  for (const dir of dirs) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (
          file.startsWith(`agent-${prefix}`) &&
          file.endsWith(".jsonl")
        ) {
          results.push(join(dir, file));
        }
      }
    } catch {
      // Directory doesn't exist or isn't readable — skip
    }
  }

  return results;
}

/**
 * Get all project directories under ~/.claude/projects/.
 */
async function getProjectDirs(): Promise<string[]> {
  if (!(await claudeProjectsDirExists())) return [];

  const claudeDir = getClaudeProjectsDir();
  const dirs: string[] = [];

  // Prefer current project first
  const currentProject = getCurrentProjectHash();
  if (currentProject) {
    dirs.push(join(claudeDir, currentProject));
  }

  // Then add all other project directories
  try {
    const entries = await readdir(claudeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== currentProject) {
        dirs.push(join(claudeDir, entry.name));
      }
    }
  } catch {
    // Can't read projects dir
  }

  return dirs;
}

// =============================================================================
// SESSION PATH RESOLUTION
// =============================================================================

/**
 * Resolve a session path or ID to a full file path.
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
    if (session) {
      return session.path;
    }

    // Fall back: check if it matches an agent file
    const agentMatches = await findAgentFilesByPrefix(input);
    if (agentMatches.length === 1 && agentMatches[0]) {
      return agentMatches[0];
    }
    if (agentMatches.length > 1) {
      // Multiple agent files match — ambiguous
      const agentInfos = agentMatches.map((path) => ({
        path,
        id: basename(path, ".jsonl").replace(/^agent-/, ""),
        mtime: new Date(),
        project: "",
      }));
      throw new AmbiguousSessionError(input, agentInfos);
    }

    const currentProject = getCurrentProjectHash();
    throw new SessionNotFoundError(input, {
      searchedLocation: currentProject
        ? `~/.claude/projects/${currentProject}/`
        : "~/.claude/projects/",
    });
  }

  // It's a prefix - find matching sessions
  const matches = await findSessionsByPrefix(input);

  if (matches.length === 1) {
    const match = matches[0];
    if (match) return match.path;
  }

  if (matches.length > 1) {
    // Multiple matches - throw ambiguous error
    throw new AmbiguousSessionError(input, matches);
  }

  // No session matches — fall back to agent file search
  const agentMatches = await findAgentFilesByPrefix(input);
  if (agentMatches.length === 1 && agentMatches[0]) {
    return agentMatches[0];
  }
  if (agentMatches.length > 1) {
    const agentInfos = agentMatches.map((path) => ({
      path,
      id: basename(path, ".jsonl").replace(/^agent-/, ""),
      mtime: new Date(),
      project: "",
    }));
    throw new AmbiguousSessionError(input, agentInfos);
  }

  const currentProject = getCurrentProjectHash();
  throw new SessionNotFoundError(input, {
    searchedLocation: currentProject
      ? `~/.claude/projects/${currentProject}/`
      : "~/.claude/projects/",
  });
}
