#!/usr/bin/env bun
/**
 * Backfill archived `.jsonl.gz` sessions from `~/agent-records/<dev>/...` into
 * Supabase `dev_sessions` + the `dev-sessions` storage bucket (ENG-5863 AC 27).
 *
 * Walks `<source-dir>/<YYYY-MM>/<YYYY-MM-DD>/HHMMSS-conversation-<uuid>.jsonl.gz`
 * (or any deeper subtree — glob is recursive), skips the two stale
 * `message-*-401/` dirs the spec calls out, and POSTs each file through
 * `/api/v1/dev-sessions/{id}/sync` reusing the daemon's primitives.
 *
 * Idempotency: server short-circuits when the row's `content_hash` matches
 * the incoming hash — re-running the script is safe and produces a no-op
 * for already-migrated sessions.
 *
 * Subagent files (`agent-*.jsonl`) are intentionally NOT processed here.
 * ENG-5964 owns subagent backfill; the live daemon flow uploads them via
 * a separate `/subagents/{agent_id}/sync` endpoint, and the parent-vs-
 * subagent fan-out logic in `sync-session.ts` requires the parent's row
 * to advance first. Doing it right in one script is a separate slice.
 *
 * Usage:
 *   bun run scripts/backfill.ts --source-dir ~/agent-records/lihub \
 *     [--env-id-suffix lihub] [--username lihu] \
 *     [--project-path /agent-records/lihub] [--dry-run] \
 *     [--max-concurrency 4]
 *
 * Linear: ENG-5863
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { Glob } from "bun";

import { loadAuth, type AuthContext } from "../src/auth.ts";
import { computeContentHash } from "../src/content-hash.ts";
import { extractMetadata } from "../src/extractor.ts";
import { postSync, type SyncResponse } from "../src/sync-client.ts";
import type { SyncMetadata } from "../src/sync-metadata.ts";

/**
 * Matches the archive convention written by `conversation-watcher`:
 * `HHMMSS-conversation-<session-uuid>.jsonl.gz`.
 *
 * Anchored UUID (8-4-4-4-12 lowercase hex) rejects truncated forms or
 * path-traversal-style filenames.
 */
const PARENT_FILE_REGEX =
	/^(\d{6})-conversation-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl\.gz$/i;

/**
 * Two stale subdirs the spec explicitly tells us to skip with a warning.
 * They were created by a broken upload path that mistook a 401 error
 * response body for a session-id and committed it to git.
 */
const STALE_DIRS = new Set([
	"message-bad-credentials-documentation-url-https-docs-github-com-rest-status-401",
	"message-requires-authentication-documentation-url-https-docs-github-com-rest-status-401",
]);

export interface BackfillOptions {
	sourceDir: string;
	envIdSuffix: string;
	username: string;
	projectPath: string;
	dryRun: boolean;
	maxConcurrency: number;
	/**
	 * When false (default), `processFile` skips a session if a row with the
	 * same `session_id` already exists in dev_sessions — protecting any
	 * fidelity already captured by the live daemon (e.g., the original env_id).
	 * When true, the script re-POSTs unconditionally; the server's
	 * content-hash short-circuit still skips the storage upload on
	 * byte-identical JSONL, but metadata fields like `environment_id` may
	 * be overwritten on a hash mismatch.
	 */
	force: boolean;
}

export type FileOutcomeKind =
	| "uploaded"
	| "skipped_subagent"
	| "skipped_unmatched"
	| "skipped_stale_dir"
	| "skipped_existing"
	| "dry_run"
	| "error";

export interface FileOutcome {
	filename: string;
	sessionId?: string;
	kind: FileOutcomeKind;
	detail?: string;
}

export interface OutcomeCounts {
	uploaded: number;
	skipped_subagent: number;
	skipped_unmatched: number;
	skipped_stale_dir: number;
	skipped_existing: number;
	dry_run: number;
	error: number;
}

/**
 * Probe whether a `dev_sessions` row already exists for `sessionId`.
 *
 * Used by the backfill to avoid overwriting rows the live daemon already
 * captured. Returns `true` on 200, `false` on 404, throws on any other
 * non-2xx so transport problems surface instead of silently uploading.
 *
 * `fetchImpl` is dependency-injected for tests.
 */
export async function existsRemote(
	auth: AuthContext,
	sessionId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	const url = `${auth.apiUrl.replace(/\/+$/, "")}/api/v1/dev-sessions/${sessionId}`;
	const res = await fetchImpl(url, {
		method: "GET",
		headers: { Authorization: `Bearer ${auth.token}` },
	});
	if (res.status === 200) return true;
	if (res.status === 404) return false;
	throw new Error(
		`existsRemote(${sessionId}) HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
	);
}

/** Pure: parse archive filename. Exported for unit tests. */
export function parseArchiveFilename(
	filename: string,
): { sessionId: string } | null {
	const m = PARENT_FILE_REGEX.exec(filename);
	if (!m) return null;
	const sessionId = m[2];
	if (!sessionId) return null;
	return { sessionId };
}

/** Pure: should this path be skipped because it's inside a stale dir? */
export function isInsideStaleDir(path: string): boolean {
	for (const dir of STALE_DIRS) {
		if (path.includes(`/${dir}/`)) return true;
	}
	return false;
}

/** Pure: subagent files (`agent-*.jsonl[.gz]`) are out of scope here. */
export function isSubagentPath(path: string): boolean {
	const name = basename(path);
	return path.includes("/subagents/") || name.startsWith("agent-");
}

/**
 * Process a single .jsonl.gz file: decompress, extract metadata, POST sync.
 *
 * `postSyncFn` is dependency-injected for tests so they can assert call
 * shape and control the response without touching the network.
 */
export async function processFile(
	absPath: string,
	auth: AuthContext,
	opts: BackfillOptions,
	postSyncFn: typeof postSync = postSync,
	existsRemoteFn: typeof existsRemote = existsRemote,
): Promise<FileOutcome> {
	const filename = basename(absPath);

	if (isInsideStaleDir(absPath)) {
		return { filename, kind: "skipped_stale_dir" };
	}
	if (isSubagentPath(absPath)) {
		return { filename, kind: "skipped_subagent" };
	}

	const parsed = parseArchiveFilename(filename);
	if (!parsed) {
		return {
			filename,
			kind: "skipped_unmatched",
			detail: "filename doesn't match HHMMSS-conversation-<uuid>.jsonl.gz",
		};
	}
	const { sessionId } = parsed;

	if (!opts.force && !opts.dryRun) {
		try {
			if (await existsRemoteFn(auth, sessionId)) {
				return { filename, sessionId, kind: "skipped_existing" };
			}
		} catch (err) {
			return {
				filename,
				sessionId,
				kind: "error",
				detail: `existsRemote: ${(err as Error).message}`,
			};
		}
	}

	const gzBytes = await readFile(absPath);
	let jsonlBytes: Uint8Array;
	try {
		jsonlBytes = gunzipSync(gzBytes);
	} catch (err) {
		return {
			filename,
			sessionId,
			kind: "error",
			detail: `gunzip failed: ${(err as Error).message}`,
		};
	}
	const jsonlContent = new TextDecoder().decode(jsonlBytes);
	const extracted = extractMetadata(jsonlContent);
	const contentHash = await computeContentHash(jsonlBytes);

	const metadata: SyncMetadata = {
		turn_count: extracted.turn_count,
		line_count: extracted.line_count,
		project_path: opts.projectPath,
		git_branch: extracted.git_branch,
		git_sha: extracted.git_sha,
		claude_model: extracted.claude_model,
		environment_kind: "ona",
		environment_id: `backfill-${opts.envIdSuffix}`,
		username: opts.username,
		status: extracted.status,
		preview_first: extracted.preview_first,
		preview_last: extracted.preview_last,
		first_user_message: extracted.first_user_message,
		file_size_bytes: jsonlBytes.length,
		gzipped_size_bytes: gzBytes.length,
	};

	if (opts.dryRun) {
		return {
			filename,
			sessionId,
			kind: "dry_run",
			detail: `turns=${extracted.turn_count} lines=${extracted.line_count} status=${extracted.status}`,
		};
	}

	let response: SyncResponse;
	try {
		response = await postSyncFn({
			apiUrl: auth.apiUrl,
			token: auth.token,
			sessionId,
			contentHash,
			fileBytes: gzBytes,
			metadata,
		});
	} catch (err) {
		return {
			filename,
			sessionId,
			kind: "error",
			detail: `transport: ${(err as Error).message}`,
		};
	}

	if (response.ok) {
		return { filename, sessionId, kind: "uploaded" };
	}
	if (response.kind === "lock_held") {
		return {
			filename,
			sessionId,
			kind: "error",
			detail: `lock_held by ${response.holder.environment_kind ?? "?"}:${response.holder.environment_id ?? "?"}`,
		};
	}
	return {
		filename,
		sessionId,
		kind: "error",
		detail: `status=${response.status} body=${JSON.stringify(response.body).slice(0, 200)}`,
	};
}

/** Walk the source dir for archive files. Public for tests. */
export async function walkArchive(sourceDir: string): Promise<string[]> {
	const glob = new Glob("**/*.jsonl.gz");
	const files: string[] = [];
	for await (const path of glob.scan({
		cwd: sourceDir,
		absolute: true,
		onlyFiles: true,
	})) {
		files.push(path);
	}
	return files;
}

/**
 * Concurrency-limited iteration. Preserves input order in the returned array.
 * Public so unit tests can exercise it directly.
 */
export async function runWithConcurrency<T, U>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
	const results: U[] = new Array(items.length);
	let cursor = 0;
	const worker = async (): Promise<void> => {
		while (true) {
			const i = cursor;
			cursor += 1;
			if (i >= items.length) return;
			results[i] = await fn(items[i] as T, i);
		}
	};
	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
	return results;
}

export function parseArgs(argv: string[]): BackfillOptions | { help: true } {
	const opts: BackfillOptions = {
		sourceDir: "",
		envIdSuffix: "",
		username: "",
		projectPath: "",
		dryRun: false,
		maxConcurrency: 4,
		force: false,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === "--source-dir") {
			i += 1;
			opts.sourceDir = argv[i] ?? "";
			continue;
		}
		if (a === "--env-id-suffix") {
			i += 1;
			opts.envIdSuffix = argv[i] ?? "";
			continue;
		}
		if (a === "--username") {
			i += 1;
			opts.username = argv[i] ?? "";
			continue;
		}
		if (a === "--project-path") {
			i += 1;
			opts.projectPath = argv[i] ?? "";
			continue;
		}
		if (a === "--dry-run") {
			opts.dryRun = true;
			continue;
		}
		if (a === "--force") {
			opts.force = true;
			continue;
		}
		if (a === "--max-concurrency") {
			i += 1;
			const n = parseInt(argv[i] ?? "", 10);
			if (Number.isNaN(n) || n < 1) {
				throw new Error("--max-concurrency must be a positive integer");
			}
			opts.maxConcurrency = n;
			continue;
		}
		if (a === "--help" || a === "-h") {
			return { help: true };
		}
		throw new Error(`Unknown arg: ${a}`);
	}

	if (!opts.sourceDir) {
		throw new Error("--source-dir is required");
	}
	if (!opts.envIdSuffix) opts.envIdSuffix = basename(opts.sourceDir);
	if (!opts.username) opts.username = opts.envIdSuffix;
	if (!opts.projectPath) opts.projectPath = `/agent-records/${opts.envIdSuffix}`;

	return opts;
}

function printHelp(): void {
	console.log(`backfill.ts — migrate ~/agent-records/*.jsonl.gz into dev_sessions

USAGE:
  bun run scripts/backfill.ts --source-dir <path> [options]

REQUIRED:
  --source-dir <path>      Path to walk (e.g., ~/agent-records/lihub).

OPTIONAL:
  --env-id-suffix <name>   Suffix for the synthetic environment_id;
                           full id is "backfill-<suffix>". Default: basename(--source-dir).
  --username <name>        username field on the row. Default: --env-id-suffix.
  --project-path <path>    project_path field on the row. Default: /agent-records/<env-id-suffix>.
  --dry-run                Walk + parse but do not POST.
  --max-concurrency <n>    Parallel uploads. Default: 4.
  --force                  Re-POST even if a row with the session_id already
                           exists. Default: skip pre-existing rows so the live
                           daemon's original env_id / metadata aren't
                           clobbered.

IDEMPOTENCY:
  By default, the script GETs /api/v1/dev-sessions/<id> before uploading and
  skips when 200. The server's content-hash short-circuit still skips storage
  uploads on byte-identical JSONL; --force keeps that protection but bypasses
  the pre-check so a hash mismatch updates metadata.

NOT PROCESSED:
  - Subagent files (agent-*.jsonl[.gz] or /subagents/) — out of scope (ENG-5964).
  - Files inside message-*-401 dirs — known stale, spec says skip.
  - Filenames that don't match HHMMSS-conversation-<uuid>.jsonl.gz.
`);
}

async function main(): Promise<void> {
	let opts: BackfillOptions;
	try {
		const parsed = parseArgs(process.argv.slice(2));
		if ("help" in parsed) {
			printHelp();
			return;
		}
		opts = parsed;
	} catch (err) {
		console.error(`[backfill] ${(err as Error).message}`);
		printHelp();
		process.exit(2);
	}

	console.log(`[backfill] source-dir: ${opts.sourceDir}`);
	console.log(`[backfill] env-id: backfill-${opts.envIdSuffix}`);
	console.log(`[backfill] username: ${opts.username}`);
	console.log(`[backfill] project-path: ${opts.projectPath}`);
	console.log(`[backfill] dry-run: ${opts.dryRun}`);
	console.log(`[backfill] max-concurrency: ${opts.maxConcurrency}`);

	const auth = await loadAuth();
	console.log(
		`[backfill] auth ok (user ${auth.userId.slice(0, 8)}…) api ${auth.apiUrl}`,
	);

	console.log(`[backfill] walking ${opts.sourceDir}…`);
	const files = await walkArchive(opts.sourceDir);
	console.log(`[backfill] found ${files.length} candidate files`);
	if (files.length === 0) {
		console.log("[backfill] nothing to do");
		return;
	}

	const counts: OutcomeCounts = {
		uploaded: 0,
		skipped_subagent: 0,
		skipped_unmatched: 0,
		skipped_stale_dir: 0,
		skipped_existing: 0,
		dry_run: 0,
		error: 0,
	};
	let processed = 0;
	const startTime = Date.now();

	const outcomes = await runWithConcurrency(
		files,
		opts.maxConcurrency,
		async (file) => {
			const outcome = await processFile(file, auth, opts);
			processed += 1;
			counts[outcome.kind] += 1;
			if (outcome.kind === "error") {
				console.error(
					`[backfill] error ${outcome.filename}: ${outcome.detail ?? ""}`,
				);
			} else if (outcome.kind === "skipped_unmatched" && counts.skipped_unmatched <= 5) {
				console.warn(
					`[backfill] skipped (unmatched): ${outcome.filename}`,
				);
			}
			if (processed % 25 === 0 || processed === files.length) {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				console.log(
					`[backfill] ${processed}/${files.length} (${elapsed}s) ${JSON.stringify(counts)}`,
				);
			}
			return outcome;
		},
	);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`[backfill] done in ${elapsed}s — ${JSON.stringify(counts)}`);
	if (counts.error > 0) {
		console.error(`[backfill] exit 1: ${counts.error} error(s)`);
		process.exit(1);
	}
	// Touch unused variable to satisfy linters
	void outcomes;
}

if (import.meta.main) {
	await main();
}
