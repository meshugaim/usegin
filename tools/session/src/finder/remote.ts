/**
 * Remote session discovery from ~/agent-records/.
 *
 * The agent-records repo archives Claude sessions as compressed JSONL files
 * organized by username and date:
 *
 *   ~/agent-records/
 *     {username}/
 *       YYYY-MM/
 *         YYYY-MM-DD/
 *           HHMMSS-conversation-{session-uuid}.jsonl.gz
 *           HHMMSS-conversation-{session-uuid}/
 *             subagents/
 *               agent-{uuid}.jsonl.gz
 *
 * This module discovers those archived sessions and returns them as SessionInfo
 * objects with `source: "remote"`, making them interoperable with local sessions.
 */

import { Glob } from "bun";
import { stat } from "fs/promises";
import { homedir } from "os";
import { join, relative } from "path";
import { debugLog } from "../debug";
import { parseSinceFilter } from "./discovery";
import type { DiscoverOptions, SessionInfo } from "./types";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Root directory for archived agent sessions.
 */
export const AGENT_RECORDS_DIR = join(homedir(), "agent-records");

/**
 * Regex to extract the session UUID from an archived session filename.
 *
 * Matches: `HHMMSS-conversation-{uuid}.jsonl.gz`
 * Captures: the UUID portion (group 1)
 */
const SESSION_FILENAME_RE =
  /^\d{6}-conversation-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl\.gz$/;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Check if the agent-records directory exists.
 */
async function agentRecordsDirExists(): Promise<boolean> {
  try {
    const stats = await stat(AGENT_RECORDS_DIR);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Extract the session UUID from an archived session filename.
 *
 * @example
 *   extractSessionUuid("084518-conversation-159b7095-3f96-4de5-a8a5-7cf445849bd6.jsonl.gz")
 *   // => "159b7095-3f96-4de5-a8a5-7cf445849bd6"
 *
 * @returns The UUID string, or null if the filename doesn't match the expected pattern.
 */
function extractSessionUuid(filename: string): string | null {
  const match = filename.match(SESSION_FILENAME_RE);
  return match?.[1] ?? null;
}

/**
 * Extract the username from a path relative to AGENT_RECORDS_DIR.
 *
 * The relative path has the form: `{username}/YYYY-MM/YYYY-MM-DD/filename`
 * The username is the first path segment.
 */
function extractUsername(relativePath: string): string {
  const firstSlash = relativePath.indexOf("/");
  return firstSlash === -1 ? relativePath : relativePath.slice(0, firstSlash);
}

/**
 * Parse a glob match into a SessionInfo, or return null if parsing fails.
 *
 * This is the core transform: one archived file path becomes one SessionInfo.
 * Returning null (instead of throwing) keeps the discovery loop clean --
 * malformed filenames are silently skipped rather than aborting the scan.
 */
async function parseArchivedSession(
  absolutePath: string,
  relativePath: string,
  sinceDate: Date | null,
  debug: boolean
): Promise<SessionInfo | null> {
  // Extract the filename (last segment of the relative path)
  const lastSlash = relativePath.lastIndexOf("/");
  const filename = lastSlash === -1 ? relativePath : relativePath.slice(lastSlash + 1);

  const sessionId = extractSessionUuid(filename);
  if (!sessionId) {
    debugLog(debug, `Skipping non-session file: ${relativePath}`);
    return null;
  }

  const username = extractUsername(relativePath);

  try {
    const stats = await stat(absolutePath);

    if (sinceDate && stats.mtime < sinceDate) {
      return null;
    }

    return {
      path: absolutePath,
      id: sessionId,
      mtime: stats.mtime,
      project: "",
      source: "remote",
      username,
    };
  } catch (error) {
    debugLog(
      debug,
      `Could not stat ${absolutePath}: ${(error as Error).message}`
    );
    return null;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover all archived sessions from ~/agent-records/.
 *
 * Scans for `*.jsonl.gz` files matching the conversation filename pattern,
 * excluding subagent files. Returns them as SessionInfo objects sorted by
 * mtime descending (most recent first).
 *
 * Gracefully returns an empty array if ~/agent-records/ doesn't exist.
 */
export async function discoverRemoteSessions(
  options: DiscoverOptions = {}
): Promise<SessionInfo[]> {
  const debug = options.debug ?? false;

  if (!(await agentRecordsDirExists())) {
    debugLog(debug, `agent-records directory not found: ${AGENT_RECORDS_DIR}`);
    return [];
  }

  const sinceDate = options.since ? parseSinceFilter(options.since) : null;

  // Glob for conversation files, excluding subagents.
  // The glob pattern matches `{username}/{YYYY-MM}/{YYYY-MM-DD}/HHMMSS-conversation-*.jsonl.gz`.
  // We use a broad glob and then filter, because Bun's Glob doesn't support
  // negative patterns. The subagent exclusion happens by checking the path.
  const glob = new Glob("**/*-conversation-*.jsonl.gz");

  const sessions: SessionInfo[] = [];
  let skippedCount = 0;

  for await (const file of glob.scan({
    cwd: AGENT_RECORDS_DIR,
    absolute: false,
  })) {
    // Skip subagent files (they live under .../subagents/)
    if (file.includes("/subagents/")) {
      continue;
    }

    const absolutePath = join(AGENT_RECORDS_DIR, file);
    const session = await parseArchivedSession(
      absolutePath,
      file,
      sinceDate,
      debug
    );

    if (session) {
      sessions.push(session);
    } else {
      skippedCount++;
    }
  }

  if (skippedCount > 0) {
    debugLog(
      debug,
      `Skipped ${skippedCount} file(s) during remote discovery`
    );
  }

  // Sort by mtime descending (most recent first)
  sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  debugLog(debug, `Discovered ${sessions.length} remote session(s)`);
  return sessions;
}

/**
 * Merge local and remote session arrays with deduplication.
 *
 * When the same session exists both locally and remotely, the local version
 * is kept because it has higher fidelity (uncompressed, includes subagent
 * files alongside). The merged result is sorted by mtime descending.
 *
 * @param local  Sessions discovered from ~/.claude/projects/
 * @param remote Sessions discovered from ~/agent-records/
 * @returns Deduplicated, sorted array with local versions preferred
 */
export function mergeSessionLists(
  local: SessionInfo[],
  remote: SessionInfo[]
): SessionInfo[] {
  const localIds = new Set(local.map((s) => s.id));
  const uniqueRemote = remote.filter((s) => !localIds.has(s.id));
  const merged = [...local, ...uniqueRemote];
  merged.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return merged;
}

/**
 * Find a specific remote session by its full UUID.
 *
 * Scans agent-records for an exact match. Returns the SessionInfo or null.
 * This is more targeted than discoverRemoteSessions() but still requires
 * a glob scan since the UUID is embedded in the filename, not the directory
 * structure.
 */
export async function findRemoteSessionById(
  sessionId: string
): Promise<SessionInfo | null> {
  if (!(await agentRecordsDirExists())) {
    return null;
  }

  // Use a targeted glob that includes the session ID in the pattern.
  // This narrows the scan significantly compared to a full wildcard.
  const glob = new Glob(`**/*-conversation-${sessionId}.jsonl.gz`);

  for await (const file of glob.scan({
    cwd: AGENT_RECORDS_DIR,
    absolute: false,
  })) {
    if (file.includes("/subagents/")) {
      continue;
    }

    const absolutePath = join(AGENT_RECORDS_DIR, file);
    const session = await parseArchivedSession(absolutePath, file, null, false);
    if (session) {
      return session;
    }
  }

  return null;
}

/**
 * Find remote sessions whose UUID starts with a given prefix.
 *
 * Useful for short-ID resolution (e.g., `session 159b7095` matching
 * `159b7095-3f96-4de5-a8a5-7cf445849bd6`).
 *
 * Returns all matches sorted by mtime descending.
 */
export async function findRemoteSessionsByPrefix(
  prefix: string
): Promise<SessionInfo[]> {
  if (!(await agentRecordsDirExists())) {
    return [];
  }

  // We can't embed a partial UUID in the glob pattern reliably (the glob
  // would need to match *-conversation-{prefix}*.jsonl.gz, but the prefix
  // might span the UUID's hyphen-delimited segments). Instead, discover
  // all remote sessions and filter by prefix. This is fine for the expected
  // volume of archived sessions (hundreds, not millions).
  const allSessions = await discoverRemoteSessions();
  const matches = allSessions.filter((s) => s.id.startsWith(prefix));

  return matches;
}
