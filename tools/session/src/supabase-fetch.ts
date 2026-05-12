/**
 * Cross-environment session fetch via Supabase (ENG-5862 step 7, AC 34).
 *
 * The third fallback in `fetchSession`'s resolution chain. After local
 * (`~/.claude/projects/`) and agent-records (`~/agent-records/`) both
 * miss, `fetchFromSupabase` reaches the Next.js API to download a
 * session that lives only in another environment.
 *
 * THE HEADLINE USE CASE: a developer starts a Claude session in env A,
 * spawns subagents, then walks over to env B and types
 * `session resume <id>`. This function downloads the parent JSONL PLUS
 * every subagent JSONL in one round-trip and writes them to the canonical
 * local paths so `claude --resume <parent-id>` finds the whole
 * conversation history. Half a history is no history — agents have no
 * value if their subagent context is missing.
 *
 * Wire:
 *   1. `readCredentials()` from `tools/lib/auth/credentials` → Bearer + api_url.
 *   2. `GET {api_url}/api/v1/dev-sessions/{sessionId}` → `{ session,
 *      signed_url, subagent_paths }`.
 *   3. `GET <signed_url>` → gzipped JSONL bytes → `Bun.gunzipSync` → write
 *      to `~/.claude/projects/<project-hash>/<sessionId>.jsonl`.
 *   4. For each `subagent_paths[i]`: download, decompress, write to
 *      `~/.claude/projects/<project-hash>/<sessionId>/subagents/agent-<agent_id>.jsonl`
 *      — NESTED under a per-parent subdir, matching the agent-records
 *      branch (`fetch.ts`'s `localSubagentDir = join(localDir, remote.id,
 *      "subagents")`) and the empirical layout Claude itself writes when
 *      spawning subagents (every subagent JSONL Claude has written in this
 *      env lives at `<projects-dir>/<parent-session>/subagents/agent-*.jsonl`).
 *      The two cross-env paths (agent-records, supabase) must agree or
 *      `claude --resume <parent-id>` finds the parent in one shape and
 *      misses the subagents.
 *
 * Failure modes:
 *
 *   - `readCredentials` returns null → `auth_missing`. `fetchSession`
 *     maps to `AuthRequiredError(cause: "missing")` so a
 *     fresh-devcontainer teammate sees the `effi auth login` hint.
 *   - 401 → `auth_expired`. `fetchSession` maps to
 *     `AuthRequiredError(cause: "expired")` — same remediation, different
 *     framing (token refresh vs first-time auth).
 *   - 404 → `not_found`. Confirms the row is in no environment.
 *   - 5xx / shape errors / signed-URL download failures → `transport_error`
 *     carrying `status` + truncated `body` for diagnostics.
 *   - Partial subagent download (some subagents fetched, one fails) →
 *     propagates as `transport_error`. No rollback: per spec line 489's
 *     "orphan blobs tolerated" philosophy applied client-side, the parent
 *     and already-written subagents stay on disk. The next `session resume`
 *     re-derives everything cleanly.
 *
 * Linear: ENG-5862
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getApiUrl,
  readCredentials,
} from "../../lib/auth/credentials";
import { getSession } from "./finder/api-client";
import {
  getClaudeProjectsDir,
  getCurrentProjectHash,
} from "./finder";

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
 *   unexpected 4xx, body shape mismatch, signed-URL download failure,
 *   subagent download failure mid-loop). Carries `status` and a truncated
 *   `body` for diagnostics.
 */
export type SupabaseFetchError =
  | { kind: "not_found" }
  | { kind: "auth_missing" }
  | { kind: "auth_expired" }
  | {
      kind: "transport_error";
      status: number;
      body: string;
      /**
       * Present when the failure occurred mid-subagent-loop: the parent
       * JSONL and zero or more subagent JSONLs already landed on disk
       * before the failing subagent. `fetchSession`'s translator names
       * these in the user-facing message so the user knows what landed
       * (spec line 489 — orphan blobs tolerated, but visibly so).
       */
      partialSuccess?: {
        parentPath: string;
        subagentPaths: string[];
      };
    };

/**
 * Result of a Supabase fetch attempt.
 *
 * Success carries the local path the parent JSONL was written to plus
 * byte sizes and the subagent count for the eventual `formatFetchResult`
 * line. `subagentCount` is always defined (0 when no subagents) — the
 * downstream `FetchResult` shape and `formatFetchResult` both rely on
 * this contract.
 *
 * Failure carries a structured `SupabaseFetchError` so the caller can
 * route the message without re-parsing strings.
 */
export type SupabaseFetchResult =
  | {
      ok: true;
      localPath: string;
      compressedSize: number;
      decompressedSize: number;
      subagentCount: number;
    }
  | { ok: false; error: SupabaseFetchError };

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Truncate a response body for the `transport_error` diagnostics field.
 *
 * 2KB is enough for a server stack-trace or a JSON `{ "error": "...",
 * "details": "..." }` shape; the user-facing string further truncates to
 * 200 chars. Don't ship the entire body — error pages and HTML error
 * responses can be megabytes.
 */
async function readBodyPreview(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 2048);
  } catch {
    return "";
  }
}

/**
 * Download a signed URL, decompress its gzipped bytes, and write the
 * decompressed JSONL to `destPath`. Creates parent directories as needed.
 *
 * Throws on non-2xx, transport failure, or corrupt gzip — callers
 * (`fetchFromSupabase`) translate to `transport_error` once for the
 * whole flow.
 */
async function downloadAndWrite(
  signedUrl: string,
  destPath: string,
): Promise<{ compressedSize: number; decompressedSize: number }> {
  const res = await fetch(signedUrl);
  if (!res.ok) {
    const body = await readBodyPreview(res);
    throw new Error(
      `signed URL download failed: HTTP ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const compressed = new Uint8Array(await res.arrayBuffer());
  const decompressed = Bun.gunzipSync(compressed);
  mkdirSync(dirname(destPath), { recursive: true });
  await Bun.write(destPath, decompressed);
  return {
    compressedSize: compressed.byteLength,
    decompressedSize: decompressed.byteLength,
  };
}

// =============================================================================
// FETCH
// =============================================================================

/**
 * Fetch a session from Supabase storage via the Next.js API.
 *
 * See the file docstring for the four-step wire and failure-mode contract.
 * `auth_missing` and `auth_expired` are surfaced to the caller as
 * discriminated `kind`s; `fetchSession` maps both to `AuthRequiredError`
 * so the user sees `effi auth login` remediation, distinct from the
 * "not found in any environment" prose for an honest 404.
 *
 * **Placement is cwd-relative.** The parent JSONL + subagents land under
 * the project hash derived from `process.cwd()` at the moment of the
 * call (via `getCurrentProjectHash()`), NOT under the project hash of
 * the original env where the session was created. This is deliberate:
 * `claude --resume <id>` looks in the project dir for the cwd it's
 * launched from, so writing under env B's project hash is what makes
 * the cross-env resume actually work.
 *
 * Practical consequence for worktrees: if you run `session resume <id>`
 * from a feature worktree, the file lands in the worktree's project hash,
 * not the main worktree's. If you want it in the main project dir, run
 * `session resume <id>` from the main worktree (or `cd` to a path whose
 * project hash matches before resuming). The hash function maps each
 * distinct cwd to a distinct projects-dir directory.
 */
export async function fetchFromSupabase(
  sessionId: string,
): Promise<SupabaseFetchResult> {
  // 1. Auth — no credentials means we can't reach Supabase. The caller
  // (`fetchSession`) maps `auth_missing` to `AuthRequiredError` so a
  // fresh-devcontainer teammate sees the `effi auth login` hint instead
  // of "not found in any environment".
  const creds = await readCredentials();
  if (!creds) {
    return { ok: false, error: { kind: "auth_missing" } };
  }
  const apiUrl = await getApiUrl();

  // 2. Single-session GET. `getSession` returns null for 404 (which maps
  // to `not_found`), or throws `ApiClientError` for 401/403/5xx/other.
  // We translate each into the discriminated `SupabaseFetchError` shape
  // so the caller can switch on `kind` rather than parse strings.
  let payload:
    | Awaited<ReturnType<typeof getSession>>
    | null = null;
  try {
    payload = await getSession(
      { token: creds.access_token, apiUrl },
      sessionId,
    );
  } catch (err) {
    const e = err as Error & { kind?: string; status?: number };
    if (e.kind === "auth_failed") {
      return { ok: false, error: { kind: "auth_expired" } };
    }
    return {
      ok: false,
      error: {
        kind: "transport_error",
        status: e.status ?? 0,
        body: e.message ?? "unknown",
      },
    };
  }
  if (!payload) {
    return { ok: false, error: { kind: "not_found" } };
  }

  // 3. Placement. Project hash is derived from the CURRENT working
  // directory (cross-env: env B's cwd is what claude --resume will look
  // under, not the parent's original env-A path). `getCurrentProjectHash`
  // is the canonical helper — same one the agent-records branch uses.
  const projectHash = getCurrentProjectHash();
  if (!projectHash) {
    return {
      ok: false,
      error: {
        kind: "transport_error",
        status: 0,
        body: "cannot determine local project directory",
      },
    };
  }
  const localDir = join(getClaudeProjectsDir(), projectHash);
  const parentLocalPath = join(localDir, `${sessionId}.jsonl`);

  // 4. Parent download. Failure here means the row exists in the API but
  // we can't materialize bytes — `transport_error` with a body excerpt
  // gives the user something to grep for.
  let parentSizes: { compressedSize: number; decompressedSize: number };
  try {
    parentSizes = await downloadAndWrite(payload.signed_url, parentLocalPath);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "transport_error",
        status: 0,
        body: (err as Error).message,
      },
    };
  }

  // 5. Subagent loop. NESTED placement — each subagent lives at
  //   <projects-dir>/<projectHash>/<sessionId>/subagents/agent-<agent_id>.jsonl
  // matching the agent-records branch (`fetch.ts`'s `localSubagentDir =
  // join(localDir, remote.id, "subagents")`) and the empirical layout
  // Claude itself writes when spawning subagents. The two cross-env paths
  // must agree, otherwise `claude --resume <parent-id>` finds the parent
  // in one shape and misses the subagents in the other.
  //
  // A mid-loop failure propagates as `transport_error` carrying the list
  // of paths already on disk in `partialSuccess` so the user-facing
  // message can name what landed (spec line 489 — orphan blobs tolerated,
  // but visibly tolerated, not silently).
  //
  // We don't roll back the parent: a user who sees a parent on disk plus
  // a partial-subagent error can retry, and the parent path is idempotent
  // (next call overwrites with the same bytes).
  const subagentDir = join(localDir, sessionId, "subagents");
  const placedSubagentPaths: string[] = [];
  for (const sub of payload.subagent_paths) {
    const subPath = join(subagentDir, `agent-${sub.agent_id}.jsonl`);
    try {
      await downloadAndWrite(sub.signed_url, subPath);
      placedSubagentPaths.push(subPath);
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "transport_error",
          status: 0,
          body: `subagent ${sub.agent_id}: ${(err as Error).message}`,
          partialSuccess: {
            parentPath: parentLocalPath,
            subagentPaths: placedSubagentPaths,
          },
        },
      };
    }
  }
  const subagentCount = placedSubagentPaths.length;

  return {
    ok: true,
    localPath: parentLocalPath,
    compressedSize: parentSizes.compressedSize,
    decompressedSize: parentSizes.decompressedSize,
    subagentCount,
  };
}
