import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regression test for ENG-6157: the session-sync daemon resolves its Effi
 * profile ONCE at boot and caches it (`DaemonState.resolvedProfileName`,
 * `cli.ts` ~line 1102). On a fresh devcontainer the daemon boots before
 * `~/.effi/current_profile` exists → `resolveProfileName` falls back to
 * "default" → `armCredWatcher` (`cli.ts` ~408) arms the credentials watcher
 * on the parent of `getCredentialsPath("default")` = `<config>/profiles/default/`.
 *
 * When the human later runs `effi auth login`, `current_profile` is written
 * (e.g. `test-user@example.com:agent-dev`) and credentials land in the NAMED
 * profile dir — but the watcher is still on `default/`, so it never fires;
 * `onCredentialsChanged` (also keyed on the cached "default") never runs. The
 * daemon stays in `needs-auth` until a manual restart. (~20h silent outage;
 * likely root cause of ENG-6119.)
 *
 * This test exercises the REAL boot + watcher wiring (not a pure function in
 * isolation): the bug is precisely that the watcher is armed on the wrong
 * directory, so the test must prove the RUNNING daemon does/doesn't recover.
 *
 * Seam: subprocess spawn of `src/cli.ts`, the same harness as
 * `daemon-pidfile-wireup.test.ts`. The daemon has no in-process boot entry we
 * can await + poll — `main()` is the module's top-level side-effect — so a
 * subprocess with tmp `EFFI_CONFIG_DIR` / `SESSION_SYNC_STATE_DIR` /
 * `SESSION_SYNC_PROJECTS_DIR` is the only way to drive the real fs.watch wiring.
 *
 * Offline by construction: `loadAuth` (`src/auth.ts`) reads creds from disk,
 * checks local JWT `exp` + `sub`, and resolves api_url — no network. A
 * future-exp JWT with a `sub` claim in a valid credentials.json succeeds
 * locally, so recovery can happen with no Supabase / HTTP.
 */

// A named profile that is NOT "default" — this is the crux of the bug. The
// daemon caches "default" at boot, but creds land here on first login.
const TEST_PROFILE = "test-user@example.com:agent-dev";

let stateDir: string;
let projectsDir: string;
let configDir: string;

/**
 * Build a fake JWT with a future `exp` and a `sub` claim. Header/signature are
 * unused — `loadAuth` only decodes the payload for `exp` (not expired) and
 * `sub` (present). Mirrors `auth.test.ts`'s `makeJwt`.
 */
function makeJwt(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const body = btoa(JSON.stringify(payload));
	return `${header}.${body}.fake-sig`;
}

function validCredentials(): string {
	return `${JSON.stringify({
		access_token: makeJwt({
			sub: "00000000-0000-0000-0000-000000000000",
			exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
		}),
		refresh_token: "stub_refresh",
		email: "test-user@example.com",
		api_url: "http://localhost:63000",
	})}\n`;
}

beforeEach(async () => {
	stateDir = await mkdtemp(join(tmpdir(), "rearm-state-"));
	projectsDir = await mkdtemp(join(tmpdir(), "rearm-projects-"));
	// Fresh-devcontainer shape: a config dir with NO current_profile and NO
	// credentials. The daemon will boot, find nothing, fall back to "default",
	// and enter needs-auth.
	configDir = await mkdtemp(join(tmpdir(), "rearm-effi-"));
});

afterEach(async () => {
	await rm(stateDir, { recursive: true, force: true });
	await rm(projectsDir, { recursive: true, force: true });
	await rm(configDir, { recursive: true, force: true });
});

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (existsSync(path)) return true;
		await new Promise((r) => setTimeout(r, 100));
	}
	return false;
}

async function waitForFileGone(
	path: string,
	timeoutMs: number,
): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (!existsSync(path)) return true;
		await new Promise((r) => setTimeout(r, 100));
	}
	return false;
}

describe("cli.ts profile re-arm after first login", () => {
	test("ENG-6157: daemon recovers from needs-auth when first login writes a NAMED profile (no restart)", async () => {
		const flagPath = join(stateDir, "needs-auth.flag");

		const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
		const proc = Bun.spawn(["bun", "run", cliPath, "--no-recursive-watch"], {
			env: {
				...process.env,
				EFFI_CONFIG_DIR: configDir,
				SESSION_SYNC_STATE_DIR: stateDir,
				SESSION_SYNC_PROJECTS_DIR: projectsDir,
				// Keep the safety-net interval long so the only recovery path
				// under test is the credentials watcher — not a backlog-drain tick.
				SESSION_SYNC_SAFETY_MS: "300000",
				// Do NOT set SESSION_SYNC_PROFILE: a fresh devcontainer has no
				// profile override, so config.profileName is undefined and the
				// daemon resolves "default" from the (absent) current_profile.
				SESSION_SYNC_PROFILE: undefined,
			},
			// Discard the daemon's stdio. The signal under test is the flag on
			// disk, not the log; piping (without continuously draining) lets the
			// daemon's heartbeat-loop output fill the pipe buffer and deadlock the
			// child, so `proc.exited` would never resolve in teardown.
			stdout: "ignore",
			stderr: "ignore",
		});

		try {
			// 1+2. Boot with no creds → the daemon must enter needs-auth.
			// Generous window: a cold `bun run cli.ts` subprocess pays a
			// first-run transpile/module-load cost before the daemon boots.
			const enteredNeedsAuth = await waitForFile(flagPath, 15_000);
			if (!enteredNeedsAuth) {
				throw new Error(
					`needs-auth.flag never appeared at ${flagPath} within 15s — daemon failed to enter needs-auth (setup problem, not the bug under test)`,
				);
			}

			// 3. Simulate first `effi auth login`: write current_profile to a
			// NAMED profile AND drop valid (future-exp) credentials into that
			// named profile dir — exactly where auth.ts writes them, and NOT
			// the "default" dir the watcher is armed on.
			const namedProfileDir = join(configDir, "profiles", TEST_PROFILE);
			await mkdir(namedProfileDir, { recursive: true, mode: 0o700 });
			await writeFile(
				join(namedProfileDir, "credentials.json"),
				validCredentials(),
				{
					mode: 0o600,
				},
			);
			// Write current_profile last so the daemon's recovery read (if it
			// re-resolved the profile) would see the named profile.
			await writeFile(join(configDir, "current_profile"), `${TEST_PROFILE}\n`, {
				mode: 0o600,
			});

			// 4. Without a restart, the daemon must recover: the watcher should
			// fire, loadAuth should succeed offline, and needs-auth.flag should
			// be deleted. Generous timeout absorbs both fs.watch latency and the
			// cold-subprocess transpile cost (warm recovery is ~200-300ms), while
			// staying inside the harness's outer budget so a genuine failure
			// surfaces this right-reason error rather than an opaque timeout.
			const recovered = await waitForFileGone(flagPath, 20_000);
			if (!recovered) {
				throw new Error(
					`needs-auth.flag still present after 20s — daemon did not recover from first login into the NAMED profile "${TEST_PROFILE}". The watcher was armed on the cached "default" profile dir at boot, so creds landing in the named dir never fired it.`,
				);
			}
			expect(existsSync(flagPath)).toBe(false);
		} finally {
			proc.kill("SIGTERM");
			await proc.exited;
			if (!proc.killed) {
				proc.kill("SIGKILL");
				await proc.exited;
			}
		}
	}, 45_000);
});
