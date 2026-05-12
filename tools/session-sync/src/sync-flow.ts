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
import { computeNextRetryAt, isInBackoff } from "./backoff.ts";
import { computeContentHash } from "./content-hash.ts";
import { extractMetadata } from "./extractor.ts";
import { gzipDeterministic } from "./gzip.ts";
import type { PerFileState, StateFile } from "./state.ts";
import { type FetchLike, postSync } from "./sync-client.ts";
import type { EnvironmentKind, SyncMetadata } from "./sync-metadata.ts";

const KILL_SWITCH_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Clock-skew buffer added to `holder.expires_at` when scheduling a retry
 * after a 409 lock_held (AC 15). 5s is large enough to swallow modest
 * skew between this daemon's clock and the server's lock_expires_at
 * timestamp, small enough that the loser environment picks up the work
 * promptly once the holder really has expired.
 */
export const LOCK_BACKOFF_BUFFER_MS = 5_000;

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
	| { kind: "fatal_error"; error: Error };

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

	// 6. Branch on response.
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
		return { kind: "uploaded", updatedState, sessionRow: session };
	}

	if ("kind" in response && response.kind === "lock-held") {
		// AC 15: another environment holds the lock. Green implements:
		//   - log a warning naming holder.{kind, env_id, username, expires_at}
		//   - set state.nextRetryAt = holder.expires_at + LOCK_BACKOFF_BUFFER_MS
		//   - preserve prior contentHash / storagePath when present
		// Red: throw so the caller (and tests) see a clean
		// behavior-missing failure rather than a silent fallthrough.
		throw new Error(
			"Not implemented (ENG-5862 step 5 Red): 409 lock-held handling",
		);
	}

	// At this point only the legacy {ok:false, status, body, syncDisabled}
	// variant remains in the union; narrow explicitly for tsgo.
	const errResp = response as Exclude<
		typeof response,
		{ kind: "lock-held" } | { ok: true }
	>;

	if (errResp.syncDisabled) {
		// AC 45: set nextRetryAt = now + 5min, preserve prior fields where we
		// have them, otherwise emit a usable placeholder so caller can persist
		// the row uniformly.
		const updatedState: PerFileState = {
			contentHash: prior?.contentHash ?? "",
			lastUploadedSize: prior?.lastUploadedSize ?? 0,
			sessionId,
			storagePath: prior?.storagePath ?? "",
			// No upload happened — leave lastUploadedAt empty when we have no
			// prior; preserve when we do (later uploads will overwrite this row).
			lastUploadedAt: prior?.lastUploadedAt ?? "",
			nextRetryAt: computeNextRetryAt(now, KILL_SWITCH_BACKOFF_MS),
		};
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
