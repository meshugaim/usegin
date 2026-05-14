/**
 * `needs-auth.flag` atomic I/O (ENG-5990).
 *
 * Cross-process signal: written by the daemon when it transitions into
 * the `needs-auth` state; deleted when it recovers; read by the daemon
 * on startup (restart persistence) and by the banner hook (ENG-5993
 * follow-up).
 *
 * On-disk path: `<stateDir>/needs-auth.flag` (sibling of `state.json` and
 * `daemon.pid`).
 *
 * Shape:
 *   {
 *     "since":         ISO 8601 timestamp,
 *     "lastCheckedAt": ISO 8601 timestamp,
 *     "errorClass":    one of NeedsAuthErrorClass,
 *     "errorMessage":  string (diagnostic).
 *   }
 *
 * Atomicity: tmp + rename, mirroring `state.ts::writeState`. Update is a
 * read-merge-write but the writer is the daemon (single writer per
 * stateDir) so this is safe — there's no concurrent `updateFlag` racing
 * with another `writeFlag` on the same file.
 */

import { existsSync, renameSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type NeedsAuthErrorClass =
	| "expired_refresh_token"
	| "missing_credentials"
	| "401_from_api"
	| "403_from_api"
	| "unknown";

export interface NeedsAuthFlag {
	since: string;
	lastCheckedAt: string;
	errorClass: NeedsAuthErrorClass;
	errorMessage: string;
}

function flagPath(stateDir: string): string {
	return join(stateDir, "needs-auth.flag");
}

export async function writeFlag(
	stateDir: string,
	flag: NeedsAuthFlag,
): Promise<void> {
	const path = flagPath(stateDir);
	const tmp = join(
		dirname(path),
		`.needs-auth.${Date.now()}.${process.pid}.${Math.random()
			.toString(36)
			.slice(2, 10)}.tmp`,
	);
	try {
		await writeFile(tmp, JSON.stringify(flag, null, 2), {
			encoding: "utf8",
			mode: 0o600,
		});
		renameSync(tmp, path);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* ignore */
		}
		throw err;
	}
}

export async function readFlag(stateDir: string): Promise<NeedsAuthFlag | null> {
	const path = flagPath(stateDir);
	if (!existsSync(path)) return null;
	try {
		const raw = await readFile(path, "utf8");
		const parsed = JSON.parse(raw) as Partial<NeedsAuthFlag>;
		if (
			typeof parsed.since === "string" &&
			typeof parsed.lastCheckedAt === "string" &&
			typeof parsed.errorClass === "string" &&
			typeof parsed.errorMessage === "string"
		) {
			return parsed as NeedsAuthFlag;
		}
		return null;
	} catch {
		return null;
	}
}

export async function deleteFlag(stateDir: string): Promise<void> {
	const path = flagPath(stateDir);
	try {
		await unlink(path);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			throw err;
		}
	}
}

/**
 * Update an existing flag's `lastCheckedAt` (and optionally error fields),
 * preserving `since` from the original write. Read-merge-write under a
 * single writer is safe because the daemon is the only process that
 * writes this file.
 *
 * If the flag is missing or unparseable, fall back to a fresh write —
 * the caller's `update` intent implies a desired post-state of "flag
 * exists with these fields", so degenerate input shouldn't drop the
 * signal.
 */
export async function updateFlag(
	stateDir: string,
	patch: { lastCheckedAt: string; errorClass?: NeedsAuthErrorClass; errorMessage?: string },
): Promise<void> {
	const existing = await readFlag(stateDir);
	const merged: NeedsAuthFlag = existing
		? {
				since: existing.since,
				lastCheckedAt: patch.lastCheckedAt,
				errorClass: patch.errorClass ?? existing.errorClass,
				errorMessage: patch.errorMessage ?? existing.errorMessage,
			}
		: {
				since: patch.lastCheckedAt,
				lastCheckedAt: patch.lastCheckedAt,
				errorClass: patch.errorClass ?? "unknown",
				errorMessage: patch.errorMessage ?? "",
			};
	await writeFlag(stateDir, merged);
}
