/**
 * HTTP layer for the dev-session-sync daemon (AC 14).
 *
 * Wraps `fetch` against the slice-1 endpoints
 * (`/api/v1/dev-sessions/{session_id}/sync` for parents,
 * `/api/v1/dev-sessions/{session_id}/subagents/{agent_id}/sync` for subagents).
 *
 * `fetch` is dependency-injected so unit tests don't open sockets and can
 * inspect the multipart body the daemon builds. Multipart shape mirrors
 * `nextjs-app/tests/integration/dev-sessions/endpoints.test.ts` exactly:
 *
 *   - `file`         — `Blob` with `type: application/gzip`
 *   - `metadata`     — JSON string
 *   - `content_hash` — lowercase-hex SHA-256 of uncompressed JSONL
 *
 * Response classification distinguishes the kill-switch 503 (body =
 * `{ error: "sync_disabled" }` → AC 45 backoff path) from other 5xx
 * (transient retry path) — the caller in `sync-flow.ts` branches on
 * `syncDisabled`.
 */

import type { SyncMetadata } from "./sync-metadata.ts";

/**
 * Just the call signature of `fetch` — Bun's `typeof fetch` includes
 * `preconnect` and similar statics that test shims don't implement, so
 * narrow to the callable shape for dependency-injected fetchers.
 */
export type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export interface SyncRequest {
	apiUrl: string;
	token: string;
	sessionId: string;
	/** When set, routes to the subagent endpoint variant. */
	agentId?: string;
	contentHash: string;
	/** Gzipped JSONL bytes. */
	fileBytes: Uint8Array;
	metadata: SyncMetadata;
}

/**
 * Identifying fields about the current lock holder when the server rejects a
 * sync attempt with HTTP 409 (AC 15). Mirrors the `holder` payload the
 * Next.js sync endpoint emits when another environment owns the dev-session
 * lock. The daemon uses these to log a useful warning and to schedule the
 * 409 backoff (`holder.expires_at + LOCK_BACKOFF_BUFFER_MS`).
 *
 * All four fields are nullable: step 4's HTTP 409 returns null for any of
 * them when the server's `lockRow` lookup is stale (READ COMMITTED window
 * between the conflict-detect SELECT and the holder-fetch SELECT). The
 * daemon surfaces nulls as-is — production code must NOT substitute `""`
 * placeholders, because `new Date(null).getTime() + buffer` would resolve
 * to `5_000` epoch milliseconds and trigger a retry storm.
 */
export interface LockHolder {
	environment_kind: string | null;
	environment_id: string | null;
	username: string | null;
	expires_at: string | null;
}

export type SyncResponse =
	| {
			ok: true;
			status: 200;
			body: { session: Record<string, unknown> };
	  }
	| {
			/** AC 15: another environment owns the dev-session lock. */
			ok: false;
			status: 409;
			kind: "lock_held";
			holder: LockHolder;
	  }
	| {
			/**
			 * Everything that isn't a 200 or a contract-conforming 409:
			 *  - non-sync-disabled 5xx and network-level failures,
			 *  - the 503 sync_disabled kill-switch (AC 45) — distinguished
			 *    by `syncDisabled: true`,
			 *  - 4xx (including a 409 whose body violated the holder
			 *    contract — see `postSync` for the guard).
			 *
			 * Carries an explicit `kind: "transport_error"` discriminator so
			 * callers can `switch` on the union without the awkward
			 * `"kind" in response` / `Exclude<...>` cast dance.
			 */
			ok: false;
			kind: "transport_error";
			status: number;
			body: unknown;
			/** True iff the response is the kill-switch 503 (AC 45). */
			syncDisabled: boolean;
	  };

function buildUrl(apiUrl: string, sessionId: string, agentId?: string): string {
	const base = apiUrl.replace(/\/+$/, "");
	if (agentId) {
		return `${base}/api/v1/dev-sessions/${sessionId}/subagents/${agentId}/sync`;
	}
	return `${base}/api/v1/dev-sessions/${sessionId}/sync`;
}

function buildBody(req: SyncRequest): FormData {
	const fd = new FormData();
	// Copy into a fresh ArrayBuffer-backed view: BlobPart accepts Uint8Array
	// across runtimes regardless of underlying ArrayBufferLike kind.
	const copy = new Uint8Array(req.fileBytes.byteLength);
	copy.set(req.fileBytes);
	const file = new Blob([copy], { type: "application/gzip" });
	const filename = req.agentId
		? `agent-${req.agentId}.jsonl.gz`
		: `${req.sessionId}.jsonl.gz`;
	fd.set("file", file, filename);
	fd.set("metadata", JSON.stringify(req.metadata));
	fd.set("content_hash", req.contentHash);
	return fd;
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

export async function postSync(
	req: SyncRequest,
	fetchImpl: FetchLike = fetch,
): Promise<SyncResponse> {
	const url = buildUrl(req.apiUrl, req.sessionId, req.agentId);
	const body = buildBody(req);

	const res = await fetchImpl(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${req.token}`,
		},
		body,
	});

	const parsed = await parseBody(res);

	if (res.status === 200) {
		return {
			ok: true,
			status: 200,
			body: parsed as { session: Record<string, unknown> },
		};
	}

	if (res.status === 409) {
		// AC 15: lock_held. Parse `holder` from the body so the caller can
		// log holder details and schedule backoff via `holder.expires_at`.
		// Body shape: `{ error: "lock_held", holder: LockHolder }`.
		//
		// Two valid 409 shapes the daemon distinguishes:
		//
		//   1. `holder` is an object (possibly with null fields) — the
		//      contract is honored, even when `lockRow` was stale and the
		//      server filled holder.* with nulls. Surface nulls as-is so
		//      sync-flow can fall back to a `now + 60s` retry instead of
		//      doing `new Date(null).getTime() + buffer` (which lands at
		//      epoch+5s and triggers a retry storm).
		//   2. `holder` is absent or not an object — the server is
		//      violating the contract. Don't synthesize an all-null holder
		//      here: that would mask a server bug as a routine lock_held
		//      response. Return the transport_error variant so sync-flow
		//      can route it to `fatal_error` with the parsed body attached
		//      for diagnostics.
		const holderRaw =
			parsed && typeof parsed === "object"
				? (parsed as { holder?: unknown }).holder
				: undefined;
		if (holderRaw && typeof holderRaw === "object") {
			return {
				ok: false,
				status: 409,
				kind: "lock_held",
				holder: holderRaw as LockHolder,
			};
		}
		return {
			ok: false,
			kind: "transport_error",
			status: 409,
			body: parsed,
			syncDisabled: false,
		};
	}

	const syncDisabled = res.status === 503 && isSyncDisabledBody(parsed);
	return {
		ok: false,
		kind: "transport_error",
		status: res.status,
		body: parsed,
		syncDisabled,
	};
}

/**
 * POST `/api/v1/dev-sessions/{session_id}/lock/heartbeat` (AC 40).
 *
 * Called by the daemon's heartbeat loop on a 60s cadence while session
 * bytes are unflushed but otherwise idle, so the server-side lease
 * (default 2min) doesn't lapse and let a peer environment steal the
 * dev-session lock.
 *
 * Body shape is `{ environment_kind, environment_id }` — JSON, NOT
 * multipart (no JSONL bytes flow through heartbeat).
 *
 * Response classification mirrors `postSync` so the daemon can branch
 * with the same shape:
 *   - 200 → `{kind:"ok", expiresAt}` — the lease was refreshed.
 *   - 409 → `{kind:"lock_held", holder}` — peer holds the lock; daemon
 *     applies AC-15 backoff (sets `nextRetryAt`) the same way sync's
 *     409 path does. Malformed 409 bodies (missing holder) downgrade to
 *     the legacy error variant so callers route to `fatal_error`,
 *     matching `postSync`.
 *   - 503 with `error:"sync_disabled"` → kill-switch on the
 *     heartbeat endpoint surface. We don't normally hit this — the daemon
 *     stops uploading first — but propagate `syncDisabled:true` for
 *     symmetry with the sync path.
 *   - Other 4xx/5xx → legacy `{ok:false, status, body, syncDisabled:false}`.
 */
export interface HeartbeatRequest {
	apiUrl: string;
	token: string;
	sessionId: string;
	environmentKind: string;
	environmentId: string;
}

export type HeartbeatResponse =
	| { ok: true; status: 200; kind: "ok"; expiresAt: string | null }
	| {
			ok: false;
			status: 409;
			kind: "lock_held";
			holder: LockHolder;
	  }
	| {
			/**
			 * Symmetric with `SyncResponse`: 4xx, non-sync-disabled 5xx, the
			 * kill-switch 503, and 409s where the body violated the holder
			 * contract all land here. The `kind:"transport_error"`
			 * discriminator means call sites can `switch (res.kind)` without
			 * an `"in"` check.
			 */
			ok: false;
			kind: "transport_error";
			status: number;
			body: unknown;
			syncDisabled: boolean;
	  };

export async function postHeartbeat(
	req: HeartbeatRequest,
	fetchImpl: FetchLike = fetch,
): Promise<HeartbeatResponse> {
	const base = req.apiUrl.replace(/\/+$/, "");
	const url = `${base}/api/v1/dev-sessions/${req.sessionId}/lock/heartbeat`;
	const res = await fetchImpl(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${req.token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			environment_kind: req.environmentKind,
			environment_id: req.environmentId,
		}),
	});

	const parsed = await parseBody(res);

	if (res.status === 200) {
		const expiresAt =
			parsed && typeof parsed === "object"
				? (parsed as { expires_at?: unknown }).expires_at
				: undefined;
		return {
			ok: true,
			status: 200,
			kind: "ok",
			expiresAt: typeof expiresAt === "string" ? expiresAt : null,
		};
	}

	if (res.status === 409) {
		// Same contract guard as `postSync`: holder must be an object (the
		// stale-holder case ships explicit nulls inside the object, which
		// is still a well-formed contract).
		const holderRaw =
			parsed && typeof parsed === "object"
				? (parsed as { holder?: unknown }).holder
				: undefined;
		if (holderRaw && typeof holderRaw === "object") {
			return {
				ok: false,
				status: 409,
				kind: "lock_held",
				holder: holderRaw as LockHolder,
			};
		}
		return {
			ok: false,
			kind: "transport_error",
			status: 409,
			body: parsed,
			syncDisabled: false,
		};
	}

	const syncDisabled = res.status === 503 && isSyncDisabledBody(parsed);
	return {
		ok: false,
		kind: "transport_error",
		status: res.status,
		body: parsed,
		syncDisabled,
	};
}
