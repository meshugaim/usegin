/**
 * Per-event sync flow (AC 14, 16, 18, 45 daemon side).
 *
 * Composes the Step 3a primitives (state / hash / gzip / extractor /
 * completion / backoff) and the Step 3b HTTP layer (`postSync`) into a
 * single pure function: given a file path + state + auth, decide whether
 * to skip, upload, or back-off, and return the updated state shape so
 * the caller can persist it.
 *
 * Branch matrix:
 *   - in backoff (nextRetryAt > now) → skipped_backoff
 *   - hash matches state             → skipped_hash
 *   - 200                            → uploaded (state advances)
 *   - 503 sync_disabled              → kill_switch (nextRetryAt set 5min ahead;
 *                                       prior state preserved otherwise)
 *   - 503 other / 5xx / network      → transient_error (state unchanged)
 *   - 4xx                            → fatal_error (state unchanged)
 *
 * Pure-ish: I/O is dependency-injected via `readFileFn` + `fetchImpl` so
 * unit tests don't hit the real fs or network.
 */

import type { AuthContext } from "./auth.ts";
import {
	applyBackoff,
	computeLockBackoffAt,
	computeNextRetryAt,
	isInBackoff,
	KILL_SWITCH_BACKOFF_MS,
} from "./backoff.ts";
import { computeContentHash } from "./content-hash.ts";
import { extractMetadata } from "./extractor.ts";
import { gzipDeterministic } from "./gzip.ts";
import type { PerFileState, StateFile } from "./state.ts";
import {
	type DeleteLockRequest,
	type DeleteLockResponse,
	type FetchLike,
	postDeleteLock,
	postSync,
} from "./sync-client.ts";
import type { EnvironmentKind, SyncMetadata } from "./sync-metadata.ts";

export interface EnvIdentity {
	kind: string;
	id: string;
}

export interface SyncFileInput {
	localFilePath: string;
	sessionId: string;
	/** When set, this is a subagent file under a parent session. */
	agentId?: string;
	state: StateFile;
	auth: AuthContext;
	envIdentity: EnvIdentity;
	username: string;
	projectPath: string;
	now: Date;
	fetchImpl?: FetchLike;
	readFileFn?: (path: string) => Promise<Uint8Array>;
	/**
	 * DI seam for the post-upload DELETE-lock call (AC 18 ext, slice 2,
	 * step 6). Defaults to `postDeleteLock` from sync-client. Tests pass
	 * a spy so they can assert call shape AND control the response
	 * variant (204 / 403 / transport_error) without touching the network.
	 *
	 * Only consulted when the upload returns 200 AND `metadata.status`
	 * is `"completed"` — the trigger condition for the final release.
	 * Heartbeats keep the lock alive while a session is `active`; the
	 * DELETE only fires when the session is truly done.
	 */
	deleteLockFn?: (
		req: DeleteLockRequest,
		fetchImpl?: FetchLike,
	) => Promise<DeleteLockResponse>;
}

export type SyncFileOutcome =
	| {
			kind: "uploaded";
			updatedState: PerFileState;
			sessionRow: Record<string, unknown>;
	  }
	| { kind: "skipped_hash" }
	| { kind: "skipped_backoff"; nextRetryAt: string }
	| { kind: "kill_switch"; updatedState: PerFileState }
	/**
	 * AC 15: another environment holds the dev-session lock. State row is
	 * updated with `nextRetryAt = holder.expires_at + LOCK_BACKOFF_BUFFER_MS`
	 * so the safety-net picks the file up once the lock should have
	 * expired. `holder` is surfaced so cli.ts can log who is winning.
	 */
	| {
			kind: "lock_held";
			updatedState: PerFileState;
			holder: import("./sync-client.ts").LockHolder;
	  }
	| { kind: "transient_error"; error: Error }
	| { kind: "fatal_error"; error: Error }
	/**
	 * AC 18 ext (slice 2, step 6): the upload succeeded AND the session
	 * is `completed` AND the post-upload DELETE-lock returned 204. The
	 * lock row is gone server-side; the daemon can stop watching this
	 * session (caller may remove the state-file entry — Green decides
	 * whether to actually delete the entry or leave it for naturally
	 * lapse cleanup).
	 *
	 * Carries the same `updatedState` shape as `uploaded` so the caller
	 * can persist the final hash without a special branch — only the
	 * outcome discriminator differs, not the state payload.
	 */
	| {
			kind: "completed_and_released";
			updatedState: PerFileState;
			sessionRow: Record<string, unknown>;
	  }
	/**
	 * AC 18 ext: upload succeeded, session is `completed`, but the
	 * DELETE-lock returned 403 (a different env now holds the lock —
	 * rare race where the lock was stolen between our successful sync
	 * and our release call). The daemon logs and keeps the state-file
	 * entry around so the safety-net can retry the release; the new
	 * holder will eventually take over regardless.
	 */
	| {
			kind: "completed_release_denied";
			updatedState: PerFileState;
			sessionRow: Record<string, unknown>;
	  }
	/**
	 * AC 18 ext: upload succeeded, session is `completed`, but the
	 * DELETE-lock failed with a non-204, non-403 status OR threw
	 * (network failure, 5xx, malformed response). Best-effort contract:
	 * sync does NOT fail because release failed. The 60s heartbeat and
	 * 5-min safety-net re-issue the release; worst case the lease lapses
	 * naturally at `expires_at`.
	 */
	| {
			kind: "completed_release_transport_error";
			updatedState: PerFileState;
			sessionRow: Record<string, unknown>;
			error: Error;
	  };

async function defaultReadFile(path: string): Promise<Uint8Array> {
	const arr = await Bun.file(path).bytes();
	return arr;
}

function asEnvironmentKind(raw: string): EnvironmentKind {
	// AC 19's detection produces one of the four kinds; fall back to
	// local-devcontainer if upstream ever drifts. Validation on the server
	// side will surface the issue; we don't drop the upload here.
	if (
		raw === "local-devcontainer" ||
		raw === "gitpod" ||
		raw === "codespaces" ||
		raw === "ona"
	) {
		return raw;
	}
	return "local-devcontainer";
}

export async function syncFile(input: SyncFileInput): Promise<SyncFileOutcome> {
	const {
		localFilePath,
		sessionId,
		agentId,
		state,
		auth,
		envIdentity,
		username,
		projectPath,
		now,
		fetchImpl = fetch,
		readFileFn = defaultReadFile,
		deleteLockFn = postDeleteLock,
	} = input;

	// 1. Skip-if-in-backoff (AC 45).
	const prior = state[localFilePath];
	if (prior && isInBackoff(prior, now)) {
		return {
			kind: "skipped_backoff",
			nextRetryAt: prior.nextRetryAt as string,
		};
	}

	// 2. Read + hash. If reads fail, that's a transient error — don't drop
	// the file from the watch loop, just don't advance state.
	let bytes: Uint8Array;
	try {
		bytes = await readFileFn(localFilePath);
	} catch (err) {
		return { kind: "transient_error", error: err as Error };
	}

	const contentHash = await computeContentHash(bytes);

	// 3. Skip-if-hash-match (AC 14, no-op short-circuit).
	if (prior && prior.contentHash === contentHash) {
		return { kind: "skipped_hash" };
	}

	// 4. Gzip + metadata extraction.
	const gzipped = gzipDeterministic(bytes);
	const text = new TextDecoder().decode(bytes);
	const extracted = extractMetadata(text);

	const metadata: SyncMetadata = {
		turn_count: extracted.turn_count,
		line_count: extracted.line_count,
		project_path: projectPath,
		git_branch: extracted.git_branch,
		git_sha: extracted.git_sha,
		claude_model: extracted.claude_model,
		environment_kind: asEnvironmentKind(envIdentity.kind),
		environment_id: envIdentity.id,
		username,
		status: extracted.status,
		preview_first: extracted.preview_first,
		preview_last: extracted.preview_last,
		first_user_message: extracted.first_user_message,
		file_size_bytes: bytes.byteLength,
		gzipped_size_bytes: gzipped.byteLength,
	};

	// 5. POST.
	let response: Awaited<ReturnType<typeof postSync>>;
	try {
		response = await postSync(
			{
				apiUrl: auth.apiUrl,
				token: auth.token,
				sessionId,
				agentId,
				contentHash,
				fileBytes: gzipped,
				metadata,
			},
			fetchImpl,
		);
	} catch (err) {
		return { kind: "transient_error", error: err as Error };
	}

	// 6. Branch on response. The `SyncResponse` union has three explicit
	// discriminators: `ok:true` for 200, `kind:"lock_held"` for a 409
	// with a contract-conforming holder, and `kind:"transport_error"`
	// for everything else (4xx, non-sync-disabled 5xx, the kill-switch
	// 503, and 409s where the server's body violated the holder contract).
	if (response.ok) {
		const session = response.body.session;
		const storagePath =
			typeof session.storage_path === "string" ? session.storage_path : "";
		const updatedState: PerFileState = {
			contentHash,
			lastUploadedSize: bytes.byteLength,
			sessionId,
			storagePath,
			lastUploadedAt: now.toISOString(),
		};

		// AC 18 ext (slice 2, step 6): post-upload completion branch.
		// The lock release fires only when the upload landed (response.ok)
		// AND the JSONL is finalized (`metadata.status === "completed"` —
		// extractor flips that on `{type:"result"}`). Active sessions still
		// rely on the 60s heartbeat; non-200 outcomes never held the lock
		// successfully so there's nothing to release.
		//
		// Best-effort: a failed release does NOT downgrade the sync. The
		// `updatedState` payload is identical across all three completion
		// variants AND the `uploaded` variant — only the discriminator and
		// the `error` field on transport_error differ. The lease lapses at
		// `expires_at` regardless; the 5-min safety-net re-issues the
		// release on the next tick. cli.ts decides whether to log or clean
		// up state based on the discriminator (the pure function stays
		// log-free, matching the lock_held layering rule).
		if (metadata.status === "completed") {
			let releaseResponse: DeleteLockResponse;
			try {
				releaseResponse = await deleteLockFn(
					{
						apiUrl: auth.apiUrl,
						token: auth.token,
						sessionId,
						environmentKind: envIdentity.kind,
						environmentId: envIdentity.id,
					},
					fetchImpl,
				);
			} catch (err) {
				return {
					kind: "completed_release_transport_error",
					updatedState,
					sessionRow: session,
					error: err as Error,
				};
			}
			if (releaseResponse.kind === "released") {
				return {
					kind: "completed_and_released",
					updatedState,
					sessionRow: session,
				};
			}
			if (releaseResponse.kind === "not_holder") {
				return {
					kind: "completed_release_denied",
					updatedState,
					sessionRow: session,
				};
			}
			// `releaseResponse.kind === "transport_error"`. Synthesize an
			// Error from the response so cli.ts can log a single string;
			// keeps the outcome's `error` field shape uniform with the
			// network-throw branch above.
			return {
				kind: "completed_release_transport_error",
				updatedState,
				sessionRow: session,
				error: new Error(
					`session-sync: DELETE lock returned HTTP ${releaseResponse.status}: ${
						JSON.stringify(releaseResponse.body) ?? "<no body>"
					}`,
				),
			};
		}

		return { kind: "uploaded", updatedState, sessionRow: session };
	}

	if (response.kind === "lock_held") {
		// AC 15: another environment holds the lock. The upload did NOT
		// happen — preserve every prior field (contentHash, lastUploadedSize,
		// storagePath, lastUploadedAt, lastHeartbeatAt) so the next
		// successful sync sees the same hash-match short-circuit it would
		// have without the 409. We only mutate `nextRetryAt`.
		//
		// The holder warning line is emitted at the cli.ts boundary (where
		// the outcome is consumed), not here — keeps `syncFile` a pure
		// returns-an-outcome function and lets cli.ts deduplicate noisy
		// warnings if a backoff'd file keeps cycling through the watch loop.
		const { holder } = response;
		const updatedState = applyBackoff(
			prior,
			sessionId,
			computeLockBackoffAt(holder, now),
		);
		return { kind: "lock_held", updatedState, holder };
	}

	// `response.kind === "transport_error"`: 4xx (including a
	// 409-with-malformed-holder per sync-client's contract guard),
	// non-sync-disabled 5xx, and the 503 sync_disabled kill-switch.
	// The `lock_held` branch above carved off the only other `ok:false`
	// variant — `response` narrows to the transport_error shape and the
	// rest of the function can read `.syncDisabled` / `.status` / `.body`
	// directly. No cast needed.
	const errResp = response;

	if (errResp.syncDisabled) {
		// AC 45: set nextRetryAt = now + 5min, preserve prior fields where we
		// have them (contentHash, lastUploadedSize, storagePath,
		// lastUploadedAt, lastHeartbeatAt). `applyBackoff` materializes a
		// usable placeholder PerFileState row when there's no prior so the
		// caller can persist uniformly.
		const updatedState = applyBackoff(
			prior,
			sessionId,
			computeNextRetryAt(now, KILL_SWITCH_BACKOFF_MS),
		);
		return { kind: "kill_switch", updatedState };
	}

	if (errResp.status >= 500) {
		return {
			kind: "transient_error",
			error: new Error(
				`session-sync: HTTP ${errResp.status} from sync endpoint`,
			),
		};
	}

	return {
		kind: "fatal_error",
		error: new Error(
			`session-sync: HTTP ${errResp.status} from sync endpoint: ${
				JSON.stringify(errResp.body) ?? "<no body>"
			}`,
		),
	};
}
