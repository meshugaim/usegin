/**
 * Lock-state probe for `session resume <id>` (ENG-5862 step 8, AC 36).
 *
 * `session resume` needs to know — BEFORE spawning `claude --resume` — whether
 * another live environment currently holds the dev-session lock for this id.
 * If yes, the CLI surfaces the holder identity and offers `--fork` instead of
 * silently letting two envs race against the same JSONL bytes.
 *
 * The probe itself is dual-mode:
 *
 *   1. **Server probe.** Speak the same wire format the sync endpoint already
 *      emits — `{ acquired: bool, holding_environment_kind, holding_environment_id,
 *      username, expires_at }`. The exact server surface (a dedicated
 *      `GET /api/v1/dev-sessions/{id}/lock` endpoint vs a no-op heartbeat
 *      probe vs piggybacking on the existing `GET /api/v1/dev-sessions/{id}`)
 *      is a Green-phase decision — see notes below.
 *
 *   2. **No-server / not-found.** When the session isn't in Supabase at all
 *      (cross-env resume targeting a session that only existed locally on this
 *      env), the lock query returns `{ held: false }` so the resume flow
 *      proceeds without a server round-trip blocking it.
 *
 * Red-phase stub: `queryLockState` throws "Not implemented (ENG-5862 step 8
 * Red)". The test file installs a `mock.module("./lock-state", …)` to drive
 * the held / not-held branches directly — the stub is what makes a mocked
 * call distinguishable from an un-mocked one. (Green will replace the throw
 * with the actual HTTP probe.)
 *
 * Note on server surface choice (Green homework):
 *
 *   The sync endpoint's 409 path already returns the canonical holder shape
 *   via `tryAcquireDevSessionLock` (see
 *   `nextjs-app/lib/services/dev-sessions.ts`), but uploading bytes just to
 *   probe lock state would be wrong — it would invalidate the lock-held
 *   contract by taking the lock as a side-effect of asking who has it. The
 *   two clean options are:
 *
 *     (a) Add a new `GET /api/v1/dev-sessions/{id}/lock` endpoint that
 *         SELECTs from `dev_session_locks` without touching it. Side-effect-
 *         free; no schema change. Single round-trip.
 *
 *     (b) Reuse the heartbeat endpoint with a `probe: true` query param that
 *         skips the lease-refresh. More wire reuse, but the heartbeat surface
 *         already has different semantics (it can refresh the lease) and
 *         overloading it for probe is read-vs-write smell.
 *
 *   Green will pick (a) — additive, semantically clean, mirrors the
 *   `lock/release` shape introduced in step 4. The Red tests pin the CLI
 *   contract, not the server route, so the route choice doesn't affect them.
 *
 * Linear: ENG-5862
 */

import type { EnvironmentKind } from "../../../session-sync/src/sync-metadata.ts";

/**
 * Holder identity surfaced to the user on lock-held resume. Mirrors the
 * `LockHolder` shape in `tools/session-sync/src/sync-client.ts` — same wire
 * fields, same nullability semantics (the server can report nulls when its
 * own row read raced with a concurrent release).
 */
export interface LockStateHolder {
  environment_kind: string | null;
  environment_id: string | null;
  username: string | null;
  expires_at: string | null;
}

/**
 * Result of `queryLockState`.
 *
 *   - `{ held: false }`              — lock is free (or session doesn't exist).
 *   - `{ held: true, holder, ours }` — lock is held; `ours` is true when the
 *     holder matches the caller's (kind, id) — that case is treated as
 *     "free" by the CLI (we own it; just resume).
 */
export type LockState =
  | { held: false }
  | {
      held: true;
      holder: LockStateHolder;
      /**
       * True when the holder matches the calling environment's (kind, id).
       * Resume in that case is a no-op refresh — we're returning to our own
       * session, not racing a peer. The CLI does NOT prompt `--fork` in
       * this branch.
       */
      ours: boolean;
    };

/**
 * Parameters for the probe. The `apiUrl` + `token` mirror `ApiAuthContext`
 * from `finder/api-client.ts`; the env identity comes from
 * `tools/session-sync/src/env-detect.ts` so the daemon and the CLI agree on
 * "who is this env" without two competing detection rules.
 */
export interface QueryLockStateParams {
  apiUrl: string;
  token: string;
  sessionId: string;
  environmentKind: EnvironmentKind;
  environmentId: string;
}

/**
 * Red-phase stub. Throws so accidental wire-up surfaces loudly; the test
 * file installs a `mock.module("./lock-state", …)` per scenario.
 *
 * Green will:
 *   - Read credentials via `tools/lib/auth/credentials` (same path as
 *     `supabase-fetch.ts`).
 *   - GET `/api/v1/dev-sessions/{id}/lock` (route added in the Green phase).
 *   - Translate the response into a `LockState`. 404 → `{ held: false }`
 *     (no session, no lock).
 */
export async function queryLockState(
  _params: QueryLockStateParams,
): Promise<LockState> {
  throw new Error("Not implemented (ENG-5862 step 8 Red)");
}
