import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Wire-up integration test for cli.ts ↔ lifecycle pidfile helpers
 * (ENG-5862, spec line 488).
 *
 * Pins the contract that the daemon's wire layer (`cli.ts`) actually
 * calls `writePidFile` on startup and `removePidFile` on SIGTERM. Unit
 * tests for the helpers alone aren't enough — Ron's S3 review on the
 * Red phase explicitly called out the wire-up gap.
 *
 * Mechanism: spawn the daemon as a subprocess with a tmp state dir, a
 * tmp empty projects dir, and a minimal `EFFI_CONFIG_DIR` containing a
 * valid (unsigned) JWT that satisfies `loadAuth`'s `exp` + `sub` checks.
 * Poll for the pidfile, then SIGTERM and confirm it's gone after exit.
 *
 * Fixture cost: a stub JWT and ~20 lines of env setup. No real Supabase,
 * no real HTTP — the daemon never reaches the upload path because the
 * tmp projects dir is empty and we kill it before the first safety tick.
 */

let stateDir: string;
let projectsDir: string;
let configDir: string;

function makeStubJwt(): string {
	// Unsigned JWT — signature isn't verified by the daemon (the server is).
	// We just need `exp` (far in the future) and `sub` to be present.
	const header = Buffer.from(
		JSON.stringify({ alg: "none", typ: "JWT" }),
	).toString("base64url");
	const payload = Buffer.from(
		JSON.stringify({
			sub: "00000000-0000-0000-0000-000000000000",
			exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
		}),
	).toString("base64url");
	return `${header}.${payload}.stub-signature`;
}

beforeEach(async () => {
	stateDir = await mkdtemp(join(tmpdir(), "wireup-state-"));
	projectsDir = await mkdtemp(join(tmpdir(), "wireup-projects-"));
	configDir = await mkdtemp(join(tmpdir(), "wireup-effi-"));
	const profileDir = join(configDir, "profiles", "default");
	await mkdir(profileDir, { recursive: true, mode: 0o700 });
	await writeFile(
		join(profileDir, "credentials.json"),
		`${JSON.stringify({
			access_token: makeStubJwt(),
			refresh_token: "stub_refresh",
			email: "wireup@test.example",
			api_url: "http://localhost:63000",
		})}\n`,
		{ mode: 0o600 },
	);
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

describe("cli.ts pidfile wire-up", () => {
	test("ENG-5862: daemon startup writes <stateDir>/daemon.pid; SIGTERM removes it", async () => {
		const pidfilePath = join(stateDir, "daemon.pid");
		expect(existsSync(pidfilePath)).toBe(false);

		const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
		const proc = Bun.spawn(["bun", "run", cliPath, "--no-recursive-watch"], {
			env: {
				...process.env,
				EFFI_CONFIG_DIR: configDir,
				SESSION_SYNC_STATE_DIR: stateDir,
				SESSION_SYNC_PROJECTS_DIR: projectsDir,
				// Keep the daemon's safety-net interval long so it doesn't
				// fire during the test window.
				SESSION_SYNC_SAFETY_MS: "300000",
			},
			stdout: "pipe",
			stderr: "pipe",
		});

		try {
			const appeared = await waitForFile(pidfilePath, 10_000);
			if (!appeared) {
				// Drain stdio for diagnostics if the daemon failed to start.
				const stdout = await new Response(proc.stdout).text();
				const stderr = await new Response(proc.stderr).text();
				throw new Error(
					`pidfile never appeared at ${pidfilePath}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
				);
			}

			const body = await readFile(pidfilePath, "utf-8");
			expect(body.trim()).toBe(String(proc.pid));

			proc.kill("SIGTERM");
			await proc.exited;

			expect(existsSync(pidfilePath)).toBe(false);
		} finally {
			if (!proc.killed) {
				proc.kill("SIGKILL");
				await proc.exited;
			}
		}
	}, 20_000);
});
