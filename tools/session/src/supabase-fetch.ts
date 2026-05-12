/**
 * Cross-environment session fetch via Supabase (ENG-5862 step 7, AC 34).
 *
 * The third fallback in `fetchSession`'s resolution chain. After local
 * (`~/.claude/projects/`) and agent-records (`~/agent-records/`) both
 * miss, `fetchFromSupabase` reaches the Next.js API to download a
 * session that lives only in another environment.
 *
 * Wire (Green will implement):
 *   1. `readCredentials()` from `tools/lib/auth/credentials` → Bearer + api_url.
 *   2. `GET {api_url}/api/v1/dev-sessions/{sessionId}` → `{ session, signed_url }`.
 *   3. `GET <signed_url>` → gzipped JSONL bytes.
 *   4. Decompress + write to `~/.claude/projects/<project-hash>/<sessionId>.jsonl`
 *      so a subsequent `claude --resume <sessionId>` finds it.
 *
 * This file is the **test seam**. The Red phase exports the function
 * signature, the discriminated `SupabaseFetchError` union, and the
 * `SupabaseFetchResult` shape. The stub throws so the right-reason
 * failure fires at `fetchSession`'s expectation sites — not at import.
 *
 * Linear: ENG-5862
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Discriminated union of failure modes the Supabase fallback can surface.
 *
 * - `not_found`: server returned 404 — the session isn't in any environment.
 *   `fetchSession` translates this into a `SessionNotFoundError` with a
 *   message naming the session_id.
 *
 * - `auth_missing`: no credentials file present (or unreadable). The user
 *   has never run `effi auth login` on this machine. `fetchSession`
 *   surfaces an `AuthRequiredError` (cause: "missing") that directs them
 *   to run it.
 *
 * - `auth_expired`: credentials present but the server returned 401.
 *   Token has aged out (or been revoked). Same remediation — re-login —
 *   but `AuthRequiredError` carries cause: "expired" so the user knows
 *   it isn't a first-time setup problem.
 *
 * - `transport_error`: anything else from the network/server (5xx,
 *   unexpected 4xx, body shape mismatch, signed-URL download failure).
 *   Carries `status` and a truncated `body` for diagnostics.
 */
export type SupabaseFetchError =
  | { kind: "not_found" }
  | { kind: "auth_missing" }
  | { kind: "auth_expired" }
  | { kind: "transport_error"; status: number; body: string };

/**
 * Result of a Supabase fetch attempt.
 *
 * Success carries the local path the JSONL was written to plus byte
 * sizes for the eventual `formatFetchResult` line. Failure carries a
 * structured `SupabaseFetchError` so the caller can route the message
 * without re-parsing strings.
 */
export type SupabaseFetchResult =
  | {
      ok: true;
      localPath: string;
      compressedSize: number;
      decompressedSize: number;
    }
  | { ok: false; error: SupabaseFetchError };

// =============================================================================
// FETCH (stub — ENG-5862 step 7 Red)
// =============================================================================

/**
 * Fetch a session from Supabase storage via the Next.js API.
 *
 * RED PHASE: not implemented. Returns `{ ok: false, error: {
 * kind: "auth_missing" } }` so `fetchSession`'s tests for the cross-env
 * fallback fail at their disk-side assertions (the expected behavior
 * isn't yet wired). The translation in `fetchSession` maps
 * `auth_missing` to `AuthRequiredError` (cause: "missing"), which
 * carries the `effi auth login` remediation hint a no-credentials
 * machine actually needs — distinct from the legacy "session not found"
 * shape, which would mislead a fresh-devcontainer teammate into thinking
 * the session is gone rather than that they haven't authed yet.
 *
 * GREEN PHASE will replace this body with the four-step wire described
 * in the file docstring. The return contract — `SupabaseFetchResult` —
 * is locked here so callers can be tested independently.
 */
export async function fetchFromSupabase(
  // biome-ignore lint/correctness/noUnusedFunctionParameters: stub for ENG-5862 step 7 Red
  sessionId: string,
): Promise<SupabaseFetchResult> {
  return { ok: false, error: { kind: "auth_missing" } };
}
