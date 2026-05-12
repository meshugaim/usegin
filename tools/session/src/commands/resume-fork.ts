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
 *   (e) Take a fresh lock.
 *
 * Subagent-fork is **deferred** to a follow-up (spec line 537 / line 139's
 * "fork in v1 supports parent-only sessions"). The Red contract here is
 * explicit-refuse on a parent that has subagent files: surface a clear
 * "subagent-fork not supported in v1" message rather than silently dropping
 * the subagents. The standalone `session fork` command's silent-copy
 * behavior is unchanged — that path predates the spec carve-out and is
 * not covered by AC 36.
 *
 * Step 8's contribution over `session fork`:
 *
 *   - The fork plan above is mostly already implemented in
 *     `tools/session/src/commands/fork.ts` (steps a-c). What `session fork`
 *     does NOT do is step (d): the forked JSONL is left on local disk and
 *     never pushed to Supabase. The daemon would eventually notice it and
 *     upload it, but the `parent_session_id` / `forked_at_turn` linkage
 *     would be lost — the daemon's sync metadata builder doesn't carry
 *     those fields (see `tools/session-sync/src/sync-metadata.ts`).
 *
 *   - Step 8 closes that gap by performing an **explicit initial sync**
 *     immediately after the fork: POST the new JSONL to
 *     `/api/v1/dev-sessions/{new_id}/sync` with metadata containing the
 *     parent-lineage fields. This both writes the row with the lineage
 *     visible to subsequent list/get queries AND implicitly takes the
 *     fresh lock (the sync route's lock-acquire happens before the
 *     storage upload — step 4 wire).
 *
 * Red-phase stub: `performForkAndInitialSync` throws "Not implemented
 * (ENG-5862 step 8 Red)". The test file installs a `mock.module(…)` per
 * scenario; the assertions inspect the call shape (the metadata passed to
 * the sync POST, the new id, the subagent-refusal path) directly.
 *
 * Green will:
 *   - Reuse the rewrite logic from `fork.ts` (consider extracting a shared
 *     helper).
 *   - Add `parent_session_id` + `forked_at_turn` to `SyncMetadata` in
 *     `tools/session-sync/src/sync-metadata.ts` AND to the validator in
 *     `nextjs-app/lib/services/dev-sessions.ts:validateSyncMetadata` —
 *     these fields are write-only at the route level (no read surface
 *     change since the GET endpoints already return them, per AC 1).
 *   - Call `postSync` from `tools/session-sync/src/sync-client.ts` with
 *     the assembled metadata.
 *
 * Linear: ENG-5862
 */

import type {
  EnvironmentKind,
  SyncMetadata,
} from "../../../session-sync/src/sync-metadata.ts";

/**
 * Initial-sync metadata for a forked session. Same field set as
 * `SyncMetadata` PLUS the parent-lineage fields the spec pins on
 * `--fork`'s initial sync (AC 36 (d)). Green will extend the daemon's
 * `SyncMetadata` to include these as optional fields; in the meantime
 * the Red test asserts on the metadata as a `Record<string, unknown>`
 * so it survives that schema extension without rewriting the test.
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
 * Discriminated failure modes the fork flow can surface back to
 * `runResume`. Kept narrow on purpose — the orchestrator either succeeds
 * (and runResume spawns claude on the new id), or it surfaces one of
 * these for runResume to translate into a user-facing error.
 *
 *   - `subagent_fork_not_supported`: source session has subagent
 *     JSONL siblings or a nested `subagents/` directory; v1's fork
 *     contract is parent-only.
 *
 *   - `sync_failed`: the initial-sync POST failed (network, 5xx, the
 *     daemon's content-hash race, etc.). Carries the server's status
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
 * taken implicitly by the sync route.
 */
export interface PerformForkParams {
  apiUrl: string;
  token: string;
  originalSessionId: string;
  originalLocalPath: string;
  environmentKind: EnvironmentKind;
  environmentId: string;
  username: string;
}

/**
 * Red-phase stub.
 *
 * The test file installs `mock.module("./resume-fork", …)` to drive both
 * the success branch (which inspects the metadata passed to the sync
 * call) and the subagent-refusal branch.
 *
 * Green will:
 *   1. Detect subagent files (siblings + nested) — refuse with
 *      `subagent_fork_not_supported` on any match.
 *   2. Mint a new UUIDv4 (`crypto.randomUUID()`).
 *   3. Stream-rewrite the JSONL, replacing only the top-level
 *      `sessionId` field on each line.
 *   4. Write to the new id's local path.
 *   5. POST the gzipped bytes + `ForkInitialSyncMetadata` (with parent
 *      lineage) to `/api/v1/dev-sessions/{new_id}/sync`.
 *   6. Return `{ ok: true, result: { newSessionId, newLocalPath,
 *      syncedAt } }`.
 */
export async function performForkAndInitialSync(
  _params: PerformForkParams,
): Promise<ForkOutcome> {
  throw new Error("Not implemented (ENG-5862 step 8 Red)");
}
