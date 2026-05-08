/**
 * Read or generate the local-devcontainer install-id (AC 19).
 *
 * The id is a UUIDv4 persisted at `<stateDir>/install-id`. **Invariant:**
 * the file is `fsync`'d before this function resolves on a fresh write,
 * so the daemon never POSTs with an empty `environment_id` even if the
 * box loses power immediately after the first sync attempt.
 *
 * Concurrency model: each caller writes to a per-process-unique tmp
 * path (`<filePath>.<pid>.<ts>.<rand>.tmp`), `fsync`s it, then
 * `rename`s atomically onto the final path. Only one rename "wins" in
 * the sense of being last, but any rename produces a valid file —
 * losers re-read the on-disk value after their own attempt and return
 * whatever id is canonical there, so all callers agree. `O_EXCL` on
 * the tmp open is just defense-in-depth against tmp-name collisions;
 * it is not what makes the final-path write concurrency-safe.
 */

import {
	closeSync,
	existsSync,
	constants as fsConstants,
	fsyncSync,
	openSync,
	renameSync,
	writeSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const INSTALL_ID_FILENAME = "install-id";
const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Test seam: a hook fired immediately after the install-id file is
 * `fsync`'d on first write. Tests use this to prove the fsync happens
 * *before* `getOrCreateInstallId` resolves.
 */
type FsyncSpy = () => void;
let fsyncSpy: FsyncSpy | null = null;
export function __setFsyncSpy(spy: FsyncSpy | null): void {
	fsyncSpy = spy;
}

function generateUuidV4(): string {
	const id = crypto.randomUUID();
	if (!UUID_V4_REGEX.test(id)) {
		throw new Error(`crypto.randomUUID() returned non-UUIDv4 shape: ${id}`);
	}
	return id;
}

/**
 * Atomic write + fsync of the install-id payload. We open a unique
 * temp file with `O_EXCL`, write the bytes, fsync the file descriptor,
 * close, then rename onto the destination. Concurrent callers each
 * write their own tmp file but only one rename wins on the final path
 * — losers re-read.
 */
function writeInstallIdSync(filePath: string, id: string): void {
	const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.tmp`;
	const fd = openSync(
		tmpPath,
		fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
		0o600,
	);
	try {
		writeSync(fd, `${id}\n`);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	if (fsyncSpy) {
		fsyncSpy();
	}
	// Rename onto the final path. If a peer beat us, this still
	// atomically replaces — but our caller will re-read after the call
	// to make sure we return whatever id is canonical on disk.
	renameSync(tmpPath, filePath);
}

export async function getOrCreateInstallId(stateDir: string): Promise<string> {
	const filePath = join(stateDir, INSTALL_ID_FILENAME);

	if (existsSync(filePath)) {
		const existing = (await readFile(filePath, "utf8")).trim();
		if (UUID_V4_REGEX.test(existing)) {
			return existing;
		}
		// Corrupt — fall through to regenerate.
	}

	// Generate + persist atomically with fsync.
	const id = generateUuidV4();
	try {
		writeInstallIdSync(filePath, id);
	} catch (err) {
		// If a concurrent caller created the file between our existsSync
		// check and our open, just read theirs.
		if (existsSync(filePath)) {
			const existing = (await readFile(filePath, "utf8")).trim();
			if (UUID_V4_REGEX.test(existing)) {
				return existing;
			}
		}
		throw err;
	}

	// Re-read the canonical on-disk value in case a peer's rename landed
	// after ours — whichever id is on disk is the one the next call
	// would see, and we want this call to agree.
	const onDisk = (await readFile(filePath, "utf8")).trim();
	return UUID_V4_REGEX.test(onDisk) ? onDisk : id;
}

export const __internals = { UUID_V4_REGEX };
