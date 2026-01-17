/**
 * Session discovery and resolution for context checking
 *
 * Reuses patterns from tools/session but focused on context use cases
 */

import { Glob } from "bun";
import { stat } from "fs/promises";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import type { SubagentInfo } from "./types";
import { parseSessionContext } from "./context";

/**
 * Get the Claude projects directory
 */
export function getClaudeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

/**
 * Get the project hash for the current working directory
 * Claude uses path with slashes and colons replaced by dashes
 * e.g., C:\Users\User\Projects -> C--Users-User-Projects
 */
export function getCurrentProjectHash(): string {
  const cwd = process.cwd();
  // Replace colons, slashes, and backslashes with dashes
  // This matches Claude's actual naming convention
  return cwd.replace(/[:/\\]/g, "-");
}

/**
 * Find the most recent session in the current project
 */
export async function findMostRecentSession(): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir();
  const projectHash = getCurrentProjectHash();
  const projectDir = join(projectsDir, projectHash);

  const glob = new Glob("*.jsonl");
  let mostRecent: { path: string; mtime: Date } | null = null;

  try {
    for await (const file of glob.scan({ cwd: projectDir, absolute: true })) {
      const filename = basename(file);

      // Skip subagent files
      if (filename.startsWith("agent-")) {
        continue;
      }

      // Skip non-UUID files (like sessions-index.json)
      if (!filename.match(/^[0-9a-f-]+\.jsonl$/i)) {
        continue;
      }

      try {
        const stats = await stat(file);
        if (!mostRecent || stats.mtime > mostRecent.mtime) {
          mostRecent = { path: file, mtime: stats.mtime };
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Project directory doesn't exist
    return null;
  }

  return mostRecent?.path ?? null;
}

/**
 * Find a session by ID or prefix
 * Searches current project first, then all projects
 */
export async function findSessionById(
  sessionIdOrPrefix: string
): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir();
  const projectHash = getCurrentProjectHash();

  // Try current project first
  const currentProjectDir = join(projectsDir, projectHash);
  const match = await findInDirectory(currentProjectDir, sessionIdOrPrefix);
  if (match) return match;

  // Fall back to all projects
  const projectGlob = new Glob("*");
  for await (const projectDir of projectGlob.scan({
    cwd: projectsDir,
    absolute: true,
    onlyFiles: false,
  })) {
    if (projectDir === currentProjectDir) continue;

    const found = await findInDirectory(projectDir, sessionIdOrPrefix);
    if (found) return found;
  }

  return null;
}

async function findInDirectory(
  dir: string,
  sessionIdOrPrefix: string
): Promise<string | null> {
  const glob = new Glob("*.jsonl");

  try {
    for await (const file of glob.scan({ cwd: dir, absolute: true })) {
      const filename = basename(file);
      const sessionId = filename.replace(/\.jsonl$/, "");

      // Exact match or prefix match
      if (sessionId === sessionIdOrPrefix || sessionId.startsWith(sessionIdOrPrefix)) {
        return file;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return null;
}

/**
 * Resolve a session identifier to a file path
 *
 * Accepts:
 * - Full file path (returned as-is)
 * - Session ID (UUID)
 * - Session ID prefix (at least 4 chars)
 * - "current" or empty (finds most recent in current project)
 */
export async function resolveSession(input?: string): Promise<string | null> {
  // No input or "current" -> find most recent
  if (!input || input === "current") {
    return findMostRecentSession();
  }

  // If it looks like a path (contains / or \), use as-is
  if (input.includes("/") || input.includes("\\")) {
    return input;
  }

  // Otherwise treat as session ID or prefix
  return findSessionById(input);
}

/**
 * Find all subagent files for a session
 */
export async function findSubagents(sessionPath: string): Promise<SubagentInfo[]> {
  const sessionDir = dirname(sessionPath);
  const glob = new Glob("agent-*.jsonl");

  const subagents: SubagentInfo[] = [];

  try {
    for await (const file of glob.scan({ cwd: sessionDir, absolute: true })) {
      const filename = basename(file);
      // Extract agent ID: agent-abc1234.jsonl -> abc1234
      const agentId = filename.replace(/^agent-/, "").replace(/\.jsonl$/, "");

      // Parse context for this subagent
      const context = await parseSessionContext(file);

      subagents.push({
        agentId,
        path: file,
        context,
      });
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by agent ID for consistent output
  subagents.sort((a, b) => a.agentId.localeCompare(b.agentId));

  return subagents;
}

/**
 * Get session ID from environment variable (if running inside Claude)
 */
export function getSessionIdFromEnv(): string | null {
  // Claude Code doesn't currently expose session ID via env,
  // but we check in case it's added in the future
  return process.env.CLAUDE_SESSION_ID ?? null;
}
