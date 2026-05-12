import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removePidFile, writePidFile } from "../src/lifecycle.ts";

/**
 * Daemon sentinel pidfile lifecycle (ENG-5862, spec line 488).
 *
 * Spec contract: the daemon owns refresh-token rotation. To let the Effi
 * CLI defer, the daemon drops a sentinel pidfile at
 * `<stateDir>/daemon.pid` on startup and removes it on graceful shutdown.
 *
 * The wire layer in `cli.ts` writes the pidfile inline today; these tests
 * pin the testable seams (`writePidFile` / `removePidFile` exported from
 * `lifecycle.ts`) the wire layer is expected to call in step 1b Green.
 *
 * Isolation: each test gets a fresh tmpdir (no XDG / $HOME mutation),
 * so the real `~/.local/state/session-sync/` is never touched.
 *
 * Atomicity: `writePidFile` must use `atomicWriteFile` from
 * `tools/lib/auth/fs-utils.ts` so a torn write can never make a CLI's
 * deference check misread a half-written PID and falsely defer.
 */

let stateDir: string;

beforeEach(async () => {
	stateDir = await mkdtemp(join(tmpdir(), "session-sync-pidfile-test-"));
});

afterEach(async () => {
	await rm(stateDir, { recursive: true, force: true });
});

describe("daemon sentinel pidfile", () => {
	test("ENG-5862: writePidFile creates <stateDir>/daemon.pid containing process.pid", async () => {
		const path = await writePidFile(stateDir);

		expect(path).toBe(join(stateDir, "daemon.pid"));
		expect(existsSync(path)).toBe(true);

		const body = await readFile(path, "utf-8");
		// Body is exactly the PID — no trailing newline, no JSON wrapper.
		// The CLI's deference check does `Number.parseInt(body.trim(), 10)`,
		// so a stray newline is tolerated, but extra structure (JSON, etc.)
		// breaks the contract.
		expect(body.trim()).toBe(String(process.pid));
	});

	test("ENG-5862: removePidFile unlinks the sentinel after writePidFile", async () => {
		await writePidFile(stateDir);
		const path = join(stateDir, "daemon.pid");
		expect(existsSync(path)).toBe(true);

		await removePidFile(stateDir);

		expect(existsSync(path)).toBe(false);
	});

	test("ENG-5862: removePidFile is a no-op when the sentinel is already absent", async () => {
		// Crashed daemon left no pidfile, or a previous shutdown cleaned up.
		// removePidFile must not throw — the daemon's shutdown sequence
		// (lifecycle.ts) calls it unconditionally.
		await expect(removePidFile(stateDir)).resolves.toBeUndefined();
	});

	test("ENG-5862: writePidFile is atomic — no `.tmp.<pid>` left behind on success", async () => {
		// Atomic-write contract from `tools/lib/auth/fs-utils.ts`:
		// write to `<path>.tmp.<pid>` then `rename` into place. On success
		// the tmp file does not exist. We assert on the post-condition
		// (no stray tmp files in stateDir) so the test pins the behavior
		// without coupling to the exact implementation.
		await writePidFile(stateDir);

		const tmpPath = join(stateDir, `daemon.pid.tmp.${process.pid}`);
		expect(existsSync(tmpPath)).toBe(false);

		// And the real pidfile exists with mode 0o600 (secret-ish: a
		// world-readable pidfile is fine, but matching the secrets-file
		// convention keeps the daemon's state dir consistent).
		const s = await stat(join(stateDir, "daemon.pid"));
		// Mask off file-type bits; only check permission bits.
		expect(s.mode & 0o777).toBe(0o600);
	});
});
