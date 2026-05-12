/**
 * Fork-and-initial-sync orchestrator for `session resume <id> --fork`
 * (ENG-5862 step 8, AC 36).
 *
 * Spec line 139 pins five obligations:
 *
 *   (a) Generate a new UUIDv4 `session_id`.
 *   (b) Rewrite only the top-level `sessionId` field on each JSONL line
 *       — lines without a `sessionId` (e.g. `file-history-snapshot`) are
 *       passed through byte-identical, not rejected.
 *   (c) Place the rewritten file at the new id's local path.
 *   (d) Initial-sync to Supabase with `parent_session_id = <original>` +
 *       `forked_at_turn = <last turn in source>`.
 *   (e) Take a fresh lock (implicit: the initial sync's lock-first
 *       ordering acquires the lock as a side-effect of the upload).
 *
 * Subagent-fork is **deferred** to a follow-up (spec line 537 / line 139's
 * "fork in v1 supports parent-only sessions"). When the source on disk has
 * subagent siblings (`agent-*.jsonl`) or a nested `subagents/` directory,
 * the orchestrator refuses with `subagent_fork_not_supported`; runResume
 * translates that into a user-facing "subagent-fork not supported in v1"
 * stderr message rather than silently dropping the subagent files.
 *
 * The standalone `session fork` command's silent-copy behavior is unchanged
 * — that path predates the spec carve-out and is not covered by AC 36.
 *
 * Linear: ENG-5862
 */

import { dirname, join } from "node:path";
import { readdir } from "node:fs/promises";

import { extractMetadata } from "../../../session-sync/src/extractor.ts";
import { postSync } from "../../../session-sync/src/sync-client.ts";
import type {
  EnvironmentKind,
  SyncMetadata,
} from "../../../session-sync/src/sync-metadata.ts";
import { rewriteJsonlSessionId } from "../jsonl-rewriter.ts";

// =============================================================================
// Public types
// =============================================================================

/**
 * Initial-sync metadata for a forked session. Same field set as `SyncMetadata`
 * PLUS the parent-lineage fields the spec pins on `--fork`'s initial sync
 * (AC 36 (d)). Required, not optional, on the fork path — the server stores
 * them on the fork row and downstream lineage queries depend on them.
 */
export type ForkInitialSyncMetadata = SyncMetadata & {
  /** AC 36 (d): points at the original (source) session_id. */
  parent_session_id: string;
  /** AC 36 (d): the last turn count of the source at fork time. */
  forked_at_turn: number;
};

/**
 * Result of a successful fork + initial sync.
 *
 *   - `newSessionId`: the freshly minted UUIDv4 the rewritten JSONL was
 *     placed at (AC 36 (a)). Always a NEW UUID — never reuses the
 *     original.
 *   - `newLocalPath`: where the rewritten JSONL was written (AC 36 (c)).
 *   - `syncedAt`: ISO timestamp of the successful initial sync (AC 36
 *     (d)). Always present on the success path — Green's caller uses it
 *     for the "Forked X → Y, synced at Z" line.
 */
export interface ForkResult {
  newSessionId: string;
  newLocalPath: string;
  syncedAt: string;
}

/**
 * Discriminated failure modes the fork flow can surface back to runResume.
 *
 *   - `subagent_fork_not_supported`: source has subagent JSONL siblings
 *     or a nested `subagents/` directory; v1's fork contract is
 *     parent-only.
 *
 *   - `sync_failed`: the initial-sync POST failed (network, 5xx, lock
 *     held by a peer racing the fork, etc.). Carries the server's status
 *     so the user can distinguish "try again" from "auth needs refresh".
 */
export type ForkFailure =
  | { kind: "subagent_fork_not_supported"; subagentCount: number }
  | { kind: "sync_failed"; status: number; body: string };

export type ForkOutcome =
  | { ok: true; result: ForkResult }
  | { ok: false; error: ForkFailure };

/**
 * Parameters for the orchestrator. `apiUrl` + `token` go to the initial
 * sync POST; `originalSessionId` + `originalLocalPath` describe the
 * source to copy from; `environment*` identify the caller for the lock
 * taken implicitly by the sync route. `forkedAtTurn` is the source's
 * turn_count at fork time (derived by runResume from extractMetadata on
 * the source JSONL) — passed as a typed field rather than re-computed
 * here so the caller controls the extraction surface.
 */
export interface PerformForkParams {
  apiUrl: string;
  token: string;
  originalSessionId: string;
  originalLocalPath: string;
  /** AC 36 (d): source's turn_count at fork time. */
  forkedAtTurn: number;
  environmentKind: EnvironmentKind;
  environmentId: string;
  username: string;
  /** Project path baked into the upsert payload (AC 14 metadata). */
  projectPath: string;
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Returns the count of subagent files (siblings + nested) that would belong
 * to this session. Used to refuse the fork before any state mutation.
 *
 *   - Sibling: `agent-*.jsonl` files in the same directory whose first line
 *     references the source sessionId (matches `session fork`'s detection).
 *   - Nested: `<sourceDir>/<sourceId>/subagents/agent-*.jsonl` files.
 */
async function countSubagents(
  sourceDir: string,
  sourceId: string,
): Promise<number> {
  let count = 0;

  try {
    const dirFiles = await readdir(sourceDir);
    for (const f of dirFiles) {
      if (!f.startsWith("agent-") || !f.endsWith(".jsonl")) continue;
      const subPath = join(sourceDir, f);
      const subContent = await Bun.file(subPath).text();
      const firstLine = subContent.slice(
        0,
        subContent.indexOf("\n") || subContent.length,
      );
      if (firstLine.includes(sourceId)) count++;
    }
  } catch {
    // Source directory unreadable — treat as zero subagents and let the
    // downstream copy/sync surface the real error.
  }

  try {
    const nestedDir = join(sourceDir, sourceId, "subagents");
    const nestedFiles = await readdir(nestedDir);
    for (const f of nestedFiles) {
      if (f.startsWith("agent-") && f.endsWith(".jsonl")) count++;
    }
  } catch {
    // No nested subagents dir — fine.
  }

  return count;
}

/**
 * Compute a hex SHA-256 over the bytes we're about to upload. Mirrors the
 * daemon's content-hash computation (`tools/session-sync/src/sync-flow.ts`'s
 * `hashContent` shape). Pure — no dependency on the daemon module to keep
 * this orchestrator dependency-light.
 */
async function hashBytes(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * Fork the source JSONL at `originalLocalPath` under a fresh UUIDv4, write
 * the rewritten content to the new id's path next to the source, then POST
 * an initial sync to Supabase with parent-lineage metadata. Returns the new
 * id + sync timestamp, or a typed failure for the caller to translate into
 * user-facing stderr.
 *
 * The new path lives in the SAME directory as the source — this matches
 * `session fork`'s placement and Claude Code's `~/.claude/projects/<encoded>/`
 * project-keyed layout, so `claude --resume <newId>` finds the rewritten
 * file via the same project-discovery rules as any other local session.
 */
export async function performForkAndInitialSync(
  params: PerformForkParams,
): Promise<ForkOutcome> {
  const {
    apiUrl,
    token,
    originalSessionId,
    originalLocalPath,
    forkedAtTurn,
    environmentKind,
    environmentId,
    username,
    projectPath,
  } = params;

  const sourceDir = dirname(originalLocalPath);

  // (1) Subagent refusal — check BEFORE any mutation so a refused fork
  // leaves disk untouched. Spec line 139 carve-out.
  const subagentCount = await countSubagents(sourceDir, originalSessionId);
  if (subagentCount > 0) {
    return {
      ok: false,
      error: { kind: "subagent_fork_not_supported", subagentCount },
    };
  }

  // (2) Mint a fresh UUIDv4. crypto.randomUUID() is V4 per Web Crypto spec.
  const newSessionId = crypto.randomUUID();
  const newLocalPath = join(sourceDir, `${newSessionId}.jsonl`);

  // (3) Read source, rewrite top-level sessionId, write to new path.
  const sourceContent = await Bun.file(originalLocalPath).text();
  const rewritten = rewriteJsonlSessionId(sourceContent, newSessionId);
  await Bun.write(newLocalPath, rewritten);

  // (4) Initial sync. The route's lock-first ordering takes the lock as a
  // side-effect of a successful upload, so we don't need a separate
  // acquire call here.
  const rewrittenBytes = new TextEncoder().encode(rewritten);
  const gzipped = Bun.gzipSync(rewrittenBytes);
  const contentHash = await hashBytes(rewrittenBytes);

  // Build metadata using the same shape the daemon produces. We extract
  // turn_count / line_count / preview_* from the rewritten content
  // (identical to source modulo the sessionId rewrite, which doesn't
  // affect turn counting). environment_*, username, project_path come
  // from the caller. file_size_bytes / gzipped_size_bytes from this
  // function's compression.
  const extracted = extractMetadata(rewritten);
  const metadata: ForkInitialSyncMetadata = {
    turn_count: extracted.turn_count,
    line_count: extracted.line_count,
    project_path: projectPath,
    git_branch: extracted.git_branch,
    git_sha: extracted.git_sha,
    claude_model: extracted.claude_model,
    environment_kind: environmentKind,
    environment_id: environmentId,
    username,
    status: extracted.status,
    preview_first: extracted.preview_first,
    preview_last: extracted.preview_last,
    first_user_message: extracted.first_user_message,
    file_size_bytes: rewrittenBytes.byteLength,
    gzipped_size_bytes: gzipped.byteLength,
    parent_session_id: originalSessionId,
    forked_at_turn: forkedAtTurn,
  };

  const syncRes = await postSync({
    apiUrl,
    token,
    sessionId: newSessionId,
    contentHash,
    fileBytes: gzipped,
    metadata,
  });

  if (!syncRes.ok) {
    return {
      ok: false,
      error: {
        kind: "sync_failed",
        status: syncRes.status,
        body: JSON.stringify(syncRes),
      },
    };
  }

  return {
    ok: true,
    result: {
      newSessionId,
      newLocalPath,
      syncedAt: new Date().toISOString(),
    },
  };
}
