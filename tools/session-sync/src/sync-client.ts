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

export type SyncResponse =
	| {
			ok: true;
			status: 200;
			body: { session: Record<string, unknown> };
	  }
	| {
			ok: false;
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

	const syncDisabled = res.status === 503 && isSyncDisabledBody(parsed);
	return {
		ok: false,
		status: res.status,
		body: parsed,
		syncDisabled,
	};
}
