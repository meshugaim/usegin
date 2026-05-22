import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFile } from "../../lib/auth/fs-utils.ts";

/**
 * Regression test for ENG-6172: the session-sync daemon's profile and
 * credentials watchers (`cli.ts:armProfileWatcher`, `armCredWatcher`) filter
 * fs.watch events with `filename === baseName`. On Linux, an `atomicWriteFile`
 * (tmp + rename) emits ONE event whose `filename` is the tmp basename
 * (`current_profile.tmp.<pid>`), NOT `current_profile`. The strict equality
 * filter discards every real signal from `effi auth login`, which uses
 * `atomicWriteFile` to write both `current_profile` (via `setCurrentProfile`,
 * `tools/lib/auth/profiles.ts:336`) and `credentials.json`. The daemon stays
 * in `needs-auth` forever until a manual restart — exactly the symptom that
 * masqueraded as ENG-6157 / ENG-6119.
 *
 * Sister test to `profile-rearm.test.ts` (ENG-6157). That test uses plain
 * `writeFile`, which emits an in-place mtime change that the strict-equality
 * filter happens to catch — masking this bug. THIS test uses `atomicWriteFile`,
 * the same primitive `effi auth login` actually uses in production, so the
 * watcher's filename mismatch surfaces.
 *
 * Seam: same subprocess-spawn harness as `profile-rearm.test.ts`. The bug is
 * a real-filesystem signal-loss problem; only a real daemon with real
 * `fs.watch` against a real tmp+rename can prove it.
 */

// Same NAMED profile as the ENG-6157 test — keeps the two tests' shapes
// directly comparable and reinforces that `default` is not the cached profile.
const TEST_PROFILE = "test-user@example.com:agent-dev";

let stateDir: string;
let projectsDir: string;
let configDir: string;

/**
 * Build a fake JWT with a future `exp` and a `sub` claim. Header/signature are
 * unused — `loadAuth` only decodes the payload for `exp` (not expired) and
 * `sub` (present). Mirrors `profile-rearm.test.ts` / `auth.test.ts`.
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
	stateDir = await mkdtemp(join(tmpdir(), "rearm-atomic-state-"));
	projectsDir = await mkdtemp(join(tmpdir(), "rearm-atomic-projects-"));
	// Fresh-devcontainer shape: empty config dir → daemon boots, finds nothing,
	// falls back to "default", enters needs-auth.
	configDir = await mkdtemp(join(tmpdir(), "rearm-atomic-effi-"));
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

describe("cli.ts profile re-arm after first login via atomicWriteFile", () => {
	test(
		"ENG-6172: daemon recovers from needs-auth when login uses atomicWriteFile (tmp+rename) for current_profile + credentials.json",
		async () => {
			const flagPath = join(stateDir, "needs-auth.flag");

			const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
			const proc = Bun.spawn(["bun", "run", cliPath, "--no-recursive-watch"], {
				env: {
					...process.env,
					EFFI_CONFIG_DIR: configDir,
					SESSION_SYNC_STATE_DIR: stateDir,
					SESSION_SYNC_PROJECTS_DIR: projectsDir,
					// Safety-net doesn't retry auth (see `safety-net.ts` — only
					// session paths get re-emitted; `fireSync` returns early in
					// needs-auth), so it can't rescue the daemon from this bug
					// even at its default cadence. Set it long anyway to keep the
					// subprocess quiet during the recovery window. The walk-subdirs
					// path (taken under `--no-recursive-watch`) clamps this to 60s,
					// which is still harmless for the same reason.
					SESSION_SYNC_SAFETY_MS: "300000",
					SESSION_SYNC_PROFILE: undefined,
				},
				// stdout/stderr ignored, not piped — same rationale as
				// `profile-rearm.test.ts`: an undrained pipe to a chatty
				// heartbeat-loop child will fill and deadlock teardown.
				stdout: "ignore",
				stderr: "ignore",
			});

			try {
				// Daemon must enter needs-auth on a cred-less boot.
				const enteredNeedsAuth = await waitForFile(flagPath, 15_000);
				if (!enteredNeedsAuth) {
					throw new Error(
						`needs-auth.flag never appeared at ${flagPath} within 15s — daemon failed to enter needs-auth (setup problem, not the bug under test)`,
					);
				}

				// Simulate first `effi auth login` USING THE REAL PRIMITIVE that
				// production uses — `atomicWriteFile` (tmp + rename). Order matches
				// `tools/lib/auth/profiles.ts::setCurrentProfile` and the credential
				// writers: drop creds into the named profile dir first, then flip
				// `current_profile` last so the daemon's recovery read sees them.
				const namedProfileDir = join(configDir, "profiles", TEST_PROFILE);
				await mkdir(namedProfileDir, { recursive: true, mode: 0o700 });
				await atomicWriteFile(
					join(namedProfileDir, "credentials.json"),
					validCredentials(),
					0o600,
				);
				await atomicWriteFile(
					join(configDir, "current_profile"),
					`${TEST_PROFILE}\n`,
					0o600,
				);

				// Without a restart, the daemon must recover. Same generous 20s
				// window as the ENG-6157 sister test — warm recovery is ~200-300ms;
				// this budget absorbs fs.watch latency and the cold-subprocess
				// transpile cost while leaving slack inside the harness budget so
				// a real failure surfaces this right-reason error.
				const recovered = await waitForFileGone(flagPath, 20_000);
				if (!recovered) {
					throw new Error(
						`needs-auth.flag still present after 20s — daemon did not recover from atomicWriteFile of current_profile + credentials.json. The fs.watch event on Linux carries the .tmp.<pid> basename, but armProfileWatcher / armCredWatcher filter on \`filename === baseName\` and discard it. (ENG-6172)`,
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
		},
		45_000,
	);
});
