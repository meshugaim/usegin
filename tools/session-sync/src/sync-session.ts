/**
 * Orchestrate a parent + subagents sync sequence (AC 17).
 *
 * Per spec line 299: on parent 200, find subagent files for this session
 * and run them through the same flow. Conversely, if the parent did NOT
 * advance (skipped, in backoff, or kill-switched), DO NOT touch the
 * subagents — the row of record didn't move and the bucket layout for
 * subagents is keyed off the parent's `(user_id, date, session_id)`.
 *
 * `discoverSubagentFiles` is sibling-imported (see `tools/lib/`) and
 * dependency-injected so unit tests don't touch the real fs.
 */

import { basename } from "node:path";
import { discoverSubagentFiles } from "../../lib/jsonl-discovery.ts";
import type { AuthContext } from "./auth.ts";
import type { StateFile } from "./state.ts";
import type { FetchLike } from "./sync-client.ts";
import type { EnvIdentity, SyncFileOutcome } from "./sync-flow.ts";
import { syncFile } from "./sync-flow.ts";

export interface SyncSessionInput {
	parentPath: string;
	sessionId: string;
	state: StateFile;
	auth: AuthContext;
	envIdentity: EnvIdentity;
	username: string;
	projectPath: string;
	now: Date;
	fetchImpl?: FetchLike;
	readFileFn?: (path: string) => Promise<Uint8Array>;
	discoverFn?: (parentPath: string) => Promise<string[]>;
}

export type SyncSessionOutcome =
	| {
			kind: "ok";
			outcomes: Array<{ filePath: string; outcome: SyncFileOutcome }>;
	  }
	| { kind: "parent_failed"; error: Error };

const AGENT_FILE_REGEX = /^agent-(.+)\.jsonl$/;

/**
 * Extract the agentId from a filename like `agent-{uuid}.jsonl`. Returns
 * null if the filename doesn't match the convention — caller should skip.
 */
function extractAgentId(filePath: string): string | null {
	const name = basename(filePath);
	const m = AGENT_FILE_REGEX.exec(name);
	return m ? (m[1] ?? null) : null;
}

function parentDidAdvance(outcome: SyncFileOutcome): boolean {
	return outcome.kind === "uploaded";
}

export async function syncSession(
	input: SyncSessionInput,
): Promise<SyncSessionOutcome> {
	const {
		parentPath,
		sessionId,
		state,
		auth,
		envIdentity,
		username,
		projectPath,
		now,
		fetchImpl,
		readFileFn,
		discoverFn = discoverSubagentFiles,
	} = input;

	// 1. Sync parent.
	const parentOutcome = await syncFile({
		localFilePath: parentPath,
		sessionId,
		state,
		auth,
		envIdentity,
		username,
		projectPath,
		now,
		fetchImpl,
		readFileFn,
	});

	const outcomes: Array<{ filePath: string; outcome: SyncFileOutcome }> = [
		{ filePath: parentPath, outcome: parentOutcome },
	];

	if (parentOutcome.kind === "fatal_error") {
		return { kind: "parent_failed", error: parentOutcome.error };
	}
	if (parentOutcome.kind === "transient_error") {
		return { kind: "parent_failed", error: parentOutcome.error };
	}

	// 2. Subagents only flow when the parent uploaded fresh bytes. If
	// parent was skipped (hash match) or kill-switched, leave subagents
	// alone — the parent row of record didn't move.
	if (!parentDidAdvance(parentOutcome)) {
		return { kind: "ok", outcomes };
	}

	const subagentPaths = await discoverFn(parentPath);
	for (const subPath of subagentPaths) {
		const agentId = extractAgentId(subPath);
		if (!agentId) continue;
		const subOutcome = await syncFile({
			localFilePath: subPath,
			sessionId,
			agentId,
			state,
			auth,
			envIdentity,
			username,
			projectPath,
			now,
			fetchImpl,
			readFileFn,
		});
		outcomes.push({ filePath: subPath, outcome: subOutcome });
	}

	return { kind: "ok", outcomes };
}
