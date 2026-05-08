#!/usr/bin/env bun
/**
 * Manual smoke for the session-sync daemon (slice-1 / Step 3c).
 *
 * Walks the daemon through a full lifecycle against a tmpdir-mounted
 * "Claude projects" directory and a Bun.serve mock for the
 * `/api/v1/dev-sessions/*` endpoint. Verifies:
 *
 *   - auth load from a fake EFFI_CONFIG_DIR
 *   - env-detect (forces local-devcontainer) + install-id creation
 *   - state.json load + persist
 *   - startup scan picks up an existing JSONL
 *   - fs.watch event fires the coalescer + tick loop
 *   - POST lands on the mock with multipart body shape
 *   - SIGTERM completes gracefully (state persisted, pid removed)
 *
 * Run: `bun run scripts/smoke.ts` from `tools/session-sync/`. Logs to
 * `daemon.log` in the cwd; the trailing tail is printed for the commit
 * body.
 *
 * NOT a unit test — wires real fs, real subprocess, real socket. Use
 * sparingly and treat its output as a load-bearing artifact.
 */

import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function makeFakeJwt(sub: string, expSecondsFromNow = 3600): string {
	const header = { alg: "HS256", typ: "JWT" };
	const payload = {
		sub,
		exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
	};
	const b64 = (o: object) =>
		Buffer.from(JSON.stringify(o))
			.toString("base64")
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
	return `${b64(header)}.${b64(payload)}.signature`;
}

async function sleep(ms: number): Promise<void> {
	await new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────

const root = mkdtempSync(join(tmpdir(), "session-sync-smoke-"));
const projectsDir = join(root, "claude-projects");
const stateDir = join(root, "state");
const effiDir = join(root, "effi");
const projectSubdir = join(projectsDir, "test-project");
mkdirSync(projectSubdir, { recursive: true });
mkdirSync(stateDir, { recursive: true });
mkdirSync(effiDir, { recursive: true });

const profileDir = join(effiDir, "profiles", "smoke@local:dev");
mkdirSync(profileDir, { recursive: true });
writeFileSync(join(effiDir, "current_profile"), "smoke@local:dev");
const apiUrlPlaceholder = "http://localhost:0"; // overwritten before spawn
writeFileSync(
	join(profileDir, "credentials.json"),
	JSON.stringify(
		{
			access_token: makeFakeJwt("user-uuid-smoke"),
			refresh_token: "rt",
			email: "smoke@local",
			api_url: apiUrlPlaceholder,
		},
		null,
		2,
	),
);

const jsonlPath = join(projectSubdir, `${SESSION_ID}.jsonl`);
writeFileSync(
	jsonlPath,
	`${[
		JSON.stringify({
			type: "user",
			gitBranch: "main",
			gitSha: "abc1234",
			message: { role: "user", content: "hello" },
		}),
		JSON.stringify({
			type: "assistant",
			message: {
				role: "assistant",
				model: "claude-opus-4-7",
				content: "hi",
			},
		}),
	].join("\n")}\n`,
);

// ─────────────────────────────────────────────────────────────────────
// Mock server
// ─────────────────────────────────────────────────────────────────────

interface CapturedRequest {
	url: string;
	method: string;
	auth: string;
	hasFile: boolean;
	hasMetadata: boolean;
	hasContentHash: boolean;
}

const captured: CapturedRequest[] = [];
const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const url = new URL(req.url);
		if (url.pathname.includes("/sync") && req.method === "POST") {
			let hasFile = false;
			let hasMetadata = false;
			let hasContentHash = false;
			try {
				const fd = await req.formData();
				hasFile = fd.has("file");
				hasMetadata = fd.has("metadata");
				hasContentHash = fd.has("content_hash");
			} catch {
				/* tolerate */
			}
			captured.push({
				url: url.pathname,
				method: req.method,
				auth: req.headers.get("authorization") ?? "",
				hasFile,
				hasMetadata,
				hasContentHash,
			});
			return new Response(
				JSON.stringify({
					session: {
						session_id: SESSION_ID,
						storage_path: `users/user-uuid-smoke/2026-05-08/${SESSION_ID}/parent.jsonl.gz`,
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}
		return new Response("nope", { status: 404 });
	},
});

const baseUrl = `http://localhost:${server.port}`;
// Update credentials with the actual baseUrl now that the server is listening.
writeFileSync(
	join(profileDir, "credentials.json"),
	JSON.stringify(
		{
			access_token: makeFakeJwt("user-uuid-smoke"),
			refresh_token: "rt",
			email: "smoke@local",
			api_url: baseUrl,
		},
		null,
		2,
	),
);

// ─────────────────────────────────────────────────────────────────────
// Spawn daemon
// ─────────────────────────────────────────────────────────────────────

const logPath = join(root, "daemon.log");

const env: NodeJS.ProcessEnv = {
	...process.env,
	EFFI_CONFIG_DIR: effiDir,
	SESSION_SYNC_STATE_DIR: stateDir,
	SESSION_SYNC_PROJECTS_DIR: projectsDir,
	SESSION_SYNC_IDLE_MS: "1500",
	SESSION_SYNC_SAFETY_MS: "10000",
	SESSION_SYNC_PREFLIGHT_MS: "300",
	USER: "smoke",
	// Force local-devcontainer detection.
	CODESPACES: undefined,
	GITPOD_WORKSPACE_ID: undefined,
	GITPOD_API_URL: undefined,
};
delete (env as Record<string, unknown>).CODESPACES;
delete (env as Record<string, unknown>).GITPOD_WORKSPACE_ID;
delete (env as Record<string, unknown>).GITPOD_API_URL;

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const child = spawn("bun", ["run", cliPath], {
	env,
	stdio: ["ignore", "pipe", "pipe"],
});

const logChunks: string[] = [];
child.stdout?.on("data", (chunk: Buffer) => {
	logChunks.push(chunk.toString());
});
child.stderr?.on("data", (chunk: Buffer) => {
	logChunks.push(chunk.toString());
});

// Wait for the daemon to come ready.
await sleep(1500);

// Append more lines to the JSONL → debounce → expect a POST.
writeFileSync(
	jsonlPath,
	`${readFileSync(jsonlPath, "utf8")}${JSON.stringify({
		type: "result",
		message: { role: "assistant", content: "done" },
	})}\n`,
);

// Wait for debounce + tick (idle 1.5s + tick interval ~375ms).
await sleep(3500);

// SIGTERM the daemon.
child.kill("SIGTERM");
await sleep(1500);
if (!child.killed) {
	child.kill("SIGKILL");
}

server.stop(true);

// ─────────────────────────────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────────────────────────────

const fullLog = logChunks.join("");
writeFileSync(logPath, fullLog, "utf8");

const expectations: Array<[string, boolean]> = [
	["startup line", fullLog.includes("[session-sync] starting; projectsDir =")],
	["auth ok line", fullLog.includes("[session-sync] auth ok")],
	[
		"env detect (local-devcontainer)",
		fullLog.includes(`"kind": "local-devcontainer"`) ||
			fullLog.includes('kind: "local-devcontainer"') ||
			fullLog.includes("local-devcontainer"),
	],
	["state load line", fullLog.includes("[session-sync] state loaded with")],
	["startup scan ran", fullLog.includes("[session-sync] startup scan:")],
	[
		"preflight result",
		fullLog.includes("[session-sync] fs.watch recursive preflight:"),
	],
	["watcher attached", fullLog.includes("[session-sync] watching")],
	["daemon ready line", fullLog.includes("[session-sync] daemon ready")],
	[
		"shutdown line",
		fullLog.includes("[session-sync] shutdown complete") ||
			fullLog.includes("[session-sync] received SIGTERM"),
	],
	["at least one POST captured", captured.length > 0],
	[
		"POST shape (file + metadata + content_hash)",
		captured.length > 0 &&
			!!captured[0]?.hasFile &&
			!!captured[0]?.hasMetadata &&
			!!captured[0]?.hasContentHash,
	],
	[
		"POST has Authorization Bearer header",
		captured.length > 0 && captured[0]?.auth.startsWith("Bearer ") === true,
	],
	[
		"POST went to /api/v1/dev-sessions/{id}/sync",
		captured.length > 0 &&
			captured[0]?.url === `/api/v1/dev-sessions/${SESSION_ID}/sync`,
	],
];

const stateAfter = existsSync(join(stateDir, "state.json"))
	? JSON.parse(readFileSync(join(stateDir, "state.json"), "utf8"))
	: null;
expectations.push([
	"state.json has parent entry post-shutdown",
	stateAfter !== null && Object.keys(stateAfter).includes(jsonlPath),
]);
expectations.push([
	"install-id file written",
	existsSync(join(stateDir, "install-id")),
]);
expectations.push([
	"pid file removed on shutdown",
	!existsSync(join(stateDir, "daemon.pid")),
]);

const failed = expectations.filter(([_, ok]) => !ok);
console.log("\n--- Smoke results ---");
for (const [name, ok] of expectations) {
	console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
}

console.log("\n--- daemon.log (last 12 lines) ---");
const lines = fullLog.split("\n").filter((l) => l.length > 0);
console.log(lines.slice(-12).join("\n"));

console.log(`\nlogPath: ${logPath}`);
console.log(`tmproot: ${root}`);

if (failed.length === 0) {
	console.log("\nSMOKE PASSED");
} else {
	console.log(`\nSMOKE FAILED (${failed.length}/${expectations.length})`);
}

// Cleanup tmproot unless KEEP=1.
if (!process.env.KEEP) {
	try {
		rmSync(root, { recursive: true, force: true });
	} catch {
		/* ignore */
	}
}

process.exit(failed.length === 0 ? 0 : 1);
