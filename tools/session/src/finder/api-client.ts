/**
 * HTTP client for `/api/v1/dev-sessions` (Step 5a of ENG-5861).
 *
 * Pure HTTP — no business logic, no filesystem, no auth-secret reads. Both
 * functions take an injected `fetchImpl` so unit tests don't open sockets.
 *
 * Endpoints (slice 1, closed at SHA `9c2ec533b`):
 *
 *   - `GET /api/v1/dev-sessions`           — list, returns
 *     `{ items, next_cursor, has_more }`. Default limit 20, max 100.
 *   - `GET /api/v1/dev-sessions/{id}`      — single, returns
 *     `{ session, signed_url }`. 404 → null.
 *
 * Response classification:
 *
 *   - 200             → return parsed body.
 *   - 404 (single)    → return null.
 *   - 401 / 403       → throw `ApiClientError` with `kind: "auth_failed"`.
 *   - 503 sync_disabled → throw `kind: "kill_switch"` (defensive — spec line
 *     153 says reads stay open regardless of the kill-switch, but the error
 *     classifier is the right place to surface this if it ever changes).
 *   - 5xx other       → throw `kind: "transient"`.
 *   - Other 4xx       → throw `kind: "other"`.
 *
 * Mirrors the shape of `tools/session-sync/src/sync-client.ts` (POST side).
 * Each is short enough that a separate file is cheaper than a shared
 * abstraction; the daemon's POST flow and the CLI's GET flow have different
 * error semantics (POST has `syncDisabled` as part of the success/failure
 * union; GET is more conventional throw-on-non-2xx).
 *
 * Linear: ENG-5861
 */

/**
 * Just the call signature of `fetch` — Bun's `typeof fetch` includes
 * `preconnect` and similar statics that test shims don't implement, so
 * narrow to the callable shape for dependency-injected fetchers.
 */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ApiAuthContext {
  /** The dev-login JWT — sent as `Authorization: Bearer <token>`. */
  token: string;
  /** Next.js base URL, e.g. `http://localhost:63000`. */
  apiUrl: string;
}

/**
 * The dev_sessions row shape exposed by the GET endpoints.
 *
 * Mirrors `nextjs-app/lib/services/dev-sessions.ts:DevSessionRow` — keep these
 * in lockstep when the server-side row gains/loses fields. `searchable_content`
 * (tsvector) is excluded server-side; we don't list it here either.
 */
export interface ApiSessionItem {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  environment_kind: string;
  environment_id: string;
  project_path: string;
  git_branch: string | null;
  git_sha: string | null;
  claude_model: string | null;
  status: string;
  started_at: string | null;
  last_synced_at: string;
  turn_count: number;
  line_count: number;
  file_size_bytes: number;
  gzipped_size_bytes: number;
  content_hash: string | null;
  preview_first: string[] | null;
  preview_last: string[] | null;
  summary: string | null;
  summary_generated_at: string | null;
  first_user_message: string | null;
  storage_path: string;
  parent_session_id: string | null;
  forked_at_turn: number | null;
  /** Server-coalesced (Postgres GENERATED column). Show this, not raw title. */
  display_title: string;
  created_at: string;
  updated_at: string;
}

export interface ApiListOptions {
  /** Page size; server clamps to [1, 100]. Default server-side: 20. */
  limit?: number;
  /** Opaque base64url cursor returned as `next_cursor` from a prior page. */
  cursor?: string;
  /** Filter by owning user_id (UUID). */
  user_id?: string;
  /** Filter by lifecycle status. */
  status?: "active" | "completed";
  /** ISO timestamp lower bound on last_synced_at (inclusive). */
  since?: string;
  /** ISO timestamp upper bound on last_synced_at (inclusive). */
  until?: string;
  /** Full-text query against `searchable_content`. */
  q?: string;
}

export interface ApiListResponse {
  items: ApiSessionItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export type ApiErrorKind =
  | "auth_failed"
  | "not_found"
  | "kill_switch"
  | "transient"
  | "other";

export interface ApiClientError extends Error {
  kind: ApiErrorKind;
  status?: number;
}

function makeError(
  message: string,
  kind: ApiErrorKind,
  status?: number,
): ApiClientError {
  const err = new Error(message) as ApiClientError;
  err.name = "ApiClientError";
  err.kind = kind;
  if (status !== undefined) {
    err.status = status;
  }
  return err;
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

async function parseBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isSyncDisabledBody(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    (body as { error?: unknown }).error === "sync_disabled"
  );
}

/**
 * Map an HTTP status to an `ApiClientError`. Caller passes the parsed body
 * so we can pick out the kill-switch shape on 503.
 */
function classifyError(status: number, body: unknown): ApiClientError {
  if (status === 401 || status === 403) {
    return makeError(`auth failed (HTTP ${status})`, "auth_failed", status);
  }
  if (status === 503 && isSyncDisabledBody(body)) {
    return makeError("sync disabled (kill switch)", "kill_switch", status);
  }
  if (status >= 500) {
    return makeError(`transient server error (HTTP ${status})`, "transient", status);
  }
  return makeError(`request failed (HTTP ${status})`, "other", status);
}

function buildListUrl(apiUrl: string, opts: ApiListOptions): string {
  const base = normalizeApiUrl(apiUrl);
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.cursor !== undefined) params.set("cursor", opts.cursor);
  if (opts.user_id !== undefined) params.set("user_id", opts.user_id);
  if (opts.status !== undefined) params.set("status", opts.status);
  if (opts.since !== undefined) params.set("since", opts.since);
  if (opts.until !== undefined) params.set("until", opts.until);
  if (opts.q !== undefined) params.set("q", opts.q);
  const qs = params.toString();
  return qs
    ? `${base}/api/v1/dev-sessions?${qs}`
    : `${base}/api/v1/dev-sessions`;
}

function buildGetUrl(apiUrl: string, sessionId: string): string {
  const base = normalizeApiUrl(apiUrl);
  return `${base}/api/v1/dev-sessions/${encodeURIComponent(sessionId)}`;
}

/**
 * GET `/api/v1/dev-sessions` with optional filters and cursor.
 *
 * Returns the parsed envelope on 200. Throws `ApiClientError` on any non-2xx.
 */
export async function listSessions(
  auth: ApiAuthContext,
  opts: ApiListOptions,
  fetchImpl: FetchLike = fetch,
): Promise<ApiListResponse> {
  const url = buildListUrl(auth.apiUrl, opts);
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${auth.token}` },
  });

  const body = await parseBody(res);

  if (res.status === 200) {
    return body as ApiListResponse;
  }
  throw classifyError(res.status, body);
}

/**
 * GET `/api/v1/dev-sessions/{id}` for a single row + signed URL.
 *
 * - 200 → returns `{ session, signed_url }`.
 * - 404 → returns `null` (caller surfaces "not found"; matches the
 *   route's 404 path which is shared by genuinely-missing AND RLS-hidden
 *   rows so callers can't probe existence by status code).
 * - Anything else → throws `ApiClientError`.
 */
export async function getSession(
  auth: ApiAuthContext,
  sessionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ session: ApiSessionItem; signed_url: string } | null> {
  const url = buildGetUrl(auth.apiUrl, sessionId);
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${auth.token}` },
  });

  const body = await parseBody(res);

  if (res.status === 200) {
    return body as { session: ApiSessionItem; signed_url: string };
  }
  if (res.status === 404) {
    return null;
  }
  throw classifyError(res.status, body);
}
