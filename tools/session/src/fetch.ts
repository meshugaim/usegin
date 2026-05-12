/**
 * Fetch archived sessions from ~/agent-records/ to local storage.
 *
 * Handles decompressing .jsonl.gz files and placing them in the correct
 * local directory (~/.claude/projects/{project-hash}/{session-id}.jsonl)
 * so they can be viewed with `session <id>` and resumed with `claude --resume`.
 *
 * Part of: ENG-1822
 */

import { Glob } from "bun";
import { mkdirSync } from "fs";
import { basename, dirname, join } from "path";
import { SessionNotFoundError } from "./errors";
import {
  findSessionById,
  findSessionsByPrefix,
  findRemoteSessionById,
  findRemoteSessionsByPrefix,
  getCurrentProjectHash,
  getClaudeProjectsDir,
  isSessionId,
  isSessionIdOrPrefix,
} from "./finder";
import type { SessionInfo } from "./finder/types";
import { fetchFromSupabase } from "./supabase-fetch";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a fetch operation.
 */
export interface FetchResult {
  /** The session ID (full UUID) */
  sessionId: string;
  /** Short prefix for display */
  shortId: string;
  /** Absolute path to the fetched local .jsonl file */
  localPath: string;
  /** Whether the session was already available locally (no fetch needed) */
  alreadyLocal: boolean;
  /**
   * Where the session was resolved from.
   *
   * - `"local"`: already in `~/.claude/projects/` (alreadyLocal=true).
   * - `"agent-records"`: decompressed from `~/agent-records/`.
   * - `"supabase"`: downloaded from the cross-env Supabase fallback
   *   (ENG-5862 step 7, AC 34). Only produced when local + agent-records
   *   both miss.
   *
   * Optional for now — the agent-records path was written before the
   * field existed and callers don't rely on it. Green for step 7 will
   * keep this optional so existing callers compile unchanged; a follow-up
   * cleanup can promote it to required once all writers populate it.
   */
  source?: "local" | "agent-records" | "supabase";
  /** Compressed size in bytes (only set when fetched from remote) */
  compressedSize?: number;
  /** Decompressed size in bytes (only set when fetched from remote) */
  decompressedSize?: number;
  /** Number of subagent files fetched */
  subagentCount: number;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resolve a session identifier (full UUID, short prefix, or path) to a
 * local SessionInfo if one exists, or null if it's not available locally.
 */
async function resolveLocal(
  input: string
): Promise<SessionInfo | null> {
  if (!isSessionIdOrPrefix(input)) {
    return null;
  }

  if (isSessionId(input)) {
    return findSessionById(input);
  }

  // Prefix search - return unique match, null if ambiguous or not found
  const matches = await findSessionsByPrefix(input);
  if (matches.length === 1 && matches[0]) {
    return matches[0];
  }
  return null;
}

/**
 * Resolve a session identifier to a remote SessionInfo, or null.
 *
 * When the input is a prefix, returns a unique match or throws
 * AmbiguousSessionError if multiple matches exist.
 */
async function resolveRemote(
  input: string
): Promise<SessionInfo | null> {
  if (!isSessionIdOrPrefix(input)) {
    return null;
  }

  if (isSessionId(input)) {
    return findRemoteSessionById(input);
  }

  // Prefix search
  const matches = await findRemoteSessionsByPrefix(input);
  if (matches.length === 1 && matches[0]) {
    return matches[0];
  }
  if (matches.length > 1) {
    // Import AmbiguousSessionError inline to keep the import list clean
    const { AmbiguousSessionError } = await import("./finder/types");
    throw new AmbiguousSessionError(input, matches);
  }
  return null;
}

/**
 * Discover subagent .jsonl.gz files that belong to a remote session.
 *
 * The archive structure is:
 *   {session-dir}/{session-filename-without-ext}/subagents/agent-*.jsonl.gz
 *
 * For example, if the session file is:
 *   ~/agent-records/user/2026-02/2026-02-16/084518-conversation-abc123.jsonl.gz
 *
 * Subagents live at:
 *   ~/agent-records/user/2026-02/2026-02-16/084518-conversation-abc123/subagents/agent-*.jsonl.gz
 */
async function discoverRemoteSubagents(
  remoteSessionPath: string
): Promise<string[]> {
  // Strip .jsonl.gz to get the directory name
  const sessionDir = remoteSessionPath.replace(/\.jsonl\.gz$/, "");
  const subagentDir = join(sessionDir, "subagents");

  const subagentPaths: string[] = [];
  const glob = new Glob("agent-*.jsonl.gz");

  try {
    for await (const file of glob.scan({
      cwd: subagentDir,
      absolute: true,
    })) {
      subagentPaths.push(file);
    }
  } catch {
    // Directory doesn't exist - no subagents, that's fine
  }

  return subagentPaths;
}

/**
 * Decompress a .jsonl.gz file and write the contents to a local .jsonl path.
 * Creates parent directories as needed.
 *
 * @returns An object with compressedSize and decompressedSize in bytes.
 */
async function decompressAndWrite(
  sourcePath: string,
  destPath: string
): Promise<{ compressedSize: number; decompressedSize: number }> {
  const file = Bun.file(sourcePath);
  const compressed = new Uint8Array(await file.arrayBuffer());
  const decompressed = Bun.gunzipSync(compressed);

  // Ensure the target directory exists
  mkdirSync(dirname(destPath), { recursive: true });

  await Bun.write(destPath, decompressed);

  return {
    compressedSize: compressed.byteLength,
    decompressedSize: decompressed.byteLength,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetch a session from remote archive to local storage.
 *
 * Resolution order:
 * 1. Check if the session exists locally - if so, return immediately (no-op)
 * 2. Search remote archives (~/agent-records/)
 * 3. If found remotely, decompress and copy to local storage
 * 4. Also discover and fetch any associated subagent files
 *
 * @throws {SessionNotFoundError} if the session is not found locally or remotely
 * @throws {AmbiguousSessionError} if a prefix matches multiple sessions
 */
export async function fetchSession(input: string): Promise<FetchResult> {
  // 1. Try local first
  const local = await resolveLocal(input);
  if (local) {
    return {
      sessionId: local.id,
      shortId: local.id.slice(0, 8),
      localPath: local.path,
      alreadyLocal: true,
      source: "local",
      subagentCount: 0,
    };
  }

  // 2. Try remote (~/agent-records/)
  const remote = await resolveRemote(input);
  if (!remote) {
    // 2a. Both local and agent-records missed. Fall back to Supabase —
    // the cross-environment path for `session resume <id>` when the
    // session was created in a different env (ENG-5862 step 7, AC 34).
    //
    // Only a full UUID makes sense here: prefix resolution requires
    // listing all sessions in the index, which the cross-env path
    // doesn't model. If the caller passed a prefix that didn't resolve
    // locally or in agent-records, we surface the same not-found error
    // as before — Green can revisit prefix-vs-Supabase if the product
    // wants it.
    if (!isSessionId(input)) {
      const currentProject = getCurrentProjectHash();
      throw new SessionNotFoundError(input, {
        searchedLocation: currentProject
          ? `~/.claude/projects/${currentProject}/ and ~/agent-records/`
          : "~/.claude/projects/ and ~/agent-records/",
      });
    }

    // RED PHASE: `fetchFromSupabase` is a stub that returns
    // `{ ok: false, error: { kind: "auth_missing" } }`. Green will
    // implement the four-step wire (auth → JSON GET → signed-URL
    // download → decompress + place).
    //
    // The Red contract is the **call site shape**: chain reaches the
    // stub on local+remote miss with a full UUID exactly once, and an
    // `auth_missing` result maps back to `SessionNotFoundError` so
    // the pre-step-7 contract ("session not anywhere → SessionNotFoundError")
    // is preserved for callers without credentials.
    const supa = await fetchFromSupabase(input);
    if (supa.ok) {
      return {
        sessionId: input,
        shortId: input.slice(0, 8),
        localPath: supa.localPath,
        alreadyLocal: false,
        source: "supabase",
        compressedSize: supa.compressedSize,
        decompressedSize: supa.decompressedSize,
        subagentCount: 0,
      };
    }
    // Discriminated error → user-facing error. `not_found` and
    // `auth_missing` both surface as `SessionNotFoundError`:
    //   - `not_found`: server confirmed the row is nowhere.
    //   - `auth_missing`: no credentials means cross-env is unreachable,
    //     so from the caller's POV the session simply isn't available.
    //     Mapping this to a brand-new "Cannot fetch from Supabase: not
    //     authenticated" error would change the failure shape for every
    //     unauthed `session resume <missing-id>` call site that exists
    //     today.
    // `auth_expired` and `transport_error` are reserved for Green — they
    // need distinct user-facing strings because the remedy is different
    // (re-login / retry / file a ticket).
    switch (supa.error.kind) {
      case "not_found":
      case "auth_missing": {
        const currentProject = getCurrentProjectHash();
        throw new SessionNotFoundError(input, {
          searchedLocation: currentProject
            ? `~/.claude/projects/${currentProject}/, ~/agent-records/, and Supabase`
            : "~/.claude/projects/, ~/agent-records/, and Supabase",
        });
      }
      case "auth_expired":
        throw new Error(
          `Cannot fetch session ${input} from Supabase: authentication failed (token expired or revoked). Run \`effi auth login\` to refresh.`,
        );
      case "transport_error": {
        const bodyPreview = supa.error.body.length > 200
          ? `${supa.error.body.slice(0, 200)}…`
          : supa.error.body;
        throw new Error(
          `Cannot fetch session ${input} from Supabase: server returned ${supa.error.status}.\n\n${bodyPreview}`,
        );
      }
    }
  }

  // 3. Decompress and write to local storage
  const projectHash = getCurrentProjectHash();
  if (!projectHash) {
    throw new Error(
      "Cannot determine local project directory. Are you in a project?"
    );
  }

  const localDir = join(getClaudeProjectsDir(), projectHash);
  const localPath = join(localDir, `${remote.id}.jsonl`);

  const { compressedSize, decompressedSize } = await decompressAndWrite(
    remote.path,
    localPath
  );

  // 4. Fetch subagent files
  const remoteSubagents = await discoverRemoteSubagents(remote.path);
  let subagentCount = 0;

  if (remoteSubagents.length > 0) {
    // Local subagents live in: {project-dir}/{session-id}/subagents/agent-*.jsonl
    const localSubagentDir = join(localDir, remote.id, "subagents");

    for (const remoteSub of remoteSubagents) {
      const subFilename = basename(remoteSub).replace(/\.gz$/, ""); // agent-xxx.jsonl
      const localSubPath = join(localSubagentDir, subFilename);

      await decompressAndWrite(remoteSub, localSubPath);
      subagentCount++;
    }
  }

  return {
    sessionId: remote.id,
    shortId: remote.id.slice(0, 8),
    localPath,
    alreadyLocal: false,
    source: "agent-records",
    compressedSize,
    decompressedSize,
    subagentCount,
  };
}


/**
 * Format a FetchResult for display to the user.
 */
export function formatFetchResult(result: FetchResult): string {
  if (result.alreadyLocal) {
    return `Session already available locally at ${result.localPath}`;
  }

  const lines: string[] = [];

  const sizeInfo =
    result.compressedSize !== undefined && result.decompressedSize !== undefined
      ? ` (${formatBytes(result.compressedSize)} -> ${formatBytes(result.decompressedSize)})`
      : "";

  lines.push(`Fetched session ${result.shortId}${sizeInfo} to ${result.localPath}`);

  if (result.subagentCount > 0) {
    const plural = result.subagentCount === 1 ? "file" : "files";
    lines.push(`Fetched ${result.subagentCount} subagent ${plural}`);
  }

  return lines.join("\n");
}
