#!/usr/bin/env bun
/**
 * session-sync daemon entrypoint (AC 13, 16, 18, 19, 20, 21, 45 daemon side).
 *
 * Wire layer that composes the pure modules (env-detect, install-id,
 * state, coalescer, startup-scan, safety-net, lifecycle) with the
 * Step 3a/3b primitives (auth, sync-session, syncFile). NOT
 * unit-tested — the smoke procedure in `README.md` is its
 * verification.
 *
 * Slice-1 boundaries:
 *   - No 409 / lock / heartbeat handling — all slice 2.
 *   - No fork rewrite — slice 2 (AC 36).
 *   - 503 sync_disabled backoff via existing `isInBackoff` filter.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type AuthContext, loadAuth, refreshAuthIfNeeded } from "./auth.ts";
import { Coalescer } from "./coalescer.ts";
import { detectEnvironment } from "./env-detect.ts";
import { getOrCreateInstallId } from "./install-id.ts";
import {
	type PendingUpload,
	planShutdown,
	removePidFile,
	writePidFile,
} from "./lifecycle.ts";
import { safetyNetTick } from "./safety-net.ts";
import { startupScan } from "./startup-scan.ts";
import { readState, type StateFile, writeState } from "./state.ts";
import type { EnvIdentity } from "./sync-flow.ts";
import { syncSession } from "./sync-session.ts";

interface Config {
	idleThresholdMs: number;
	tickIntervalMs: number;
	safetyNetIntervalMs: number;
	preflightTimeoutMs: number;
	projectsDir: string;
	stateDir: string;
	stateFile: string;
	profileName?: string;
	username: string;
	useRecursiveWatch: boolean;
}

function parseConfig(argv: string[], env: NodeJS.ProcessEnv): Config {
	const home = homedir();
	const stateDir =
		env.SESSION_SYNC_STATE_DIR ?? join(home, ".local/state/session-sync");
	const projectsDir =
		env.SESSION_SYNC_PROJECTS_DIR ?? join(home, ".claude/projects");

	const idleMs = numericEnv(env.SESSION_SYNC_IDLE_MS, 30_000);
	const safetyMs = numericEnv(env.SESSION_SYNC_SAFETY_MS, 5 * 60_000);
	const preflightMs = numericEnv(env.SESSION_SYNC_PREFLIGHT_MS, 200);

	const noRecursive = argv.includes("--no-recursive-watch");

	return {
		idleThresholdMs: idleMs,
		tickIntervalMs: Math.max(1_000, Math.floor(idleMs / 4)),
		safetyNetIntervalMs: safetyMs,
		preflightTimeoutMs: preflightMs,
		projectsDir,
		stateDir,
		stateFile: join(stateDir, "state.json"),
		profileName: env.SESSION_SYNC_PROFILE,
		username: env.USER ?? env.USERNAME ?? "unknown",
		useRecursiveWatch: !noRecursive,
	};
}

function numericEnv(raw: string | undefined, fallback: number): number {
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const PARENT_JSONL_REGEX =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

function parseParentSessionId(filePath: string): string | null {
	const slash = filePath.lastIndexOf("/");
	const name = slash === -1 ? filePath : filePath.slice(slash + 1);
	const m = PARENT_JSONL_REGEX.exec(name);
	return m ? (m[1] ?? null) : null;
}

function projectPathFromFile(absPath: string, projectsDir: string): string {
	// Subdir of projectsDir is the URL-encoded cwd; we just pass the
	// directory name unchanged for now (server stores it verbatim).
	const rel = absPath.slice(projectsDir.length).replace(/^\/+/, "");
	const slash = rel.indexOf("/");
	return slash === -1 ? "" : rel.slice(0, slash);
}

async function listJsonlFilesRecursive(dir: string): Promise<string[]> {
	const out: string[] = [];
	if (!existsSync(dir)) return out;
	const stack: string[] = [dir];
	while (stack.length > 0) {
		const cur = stack.pop();
		if (!cur) continue;
		let entries: string[];
		try {
			entries = readdirSync(cur);
		} catch {
			continue;
		}
		for (const e of entries) {
			const p = join(cur, e);
			let s: ReturnType<typeof statSync>;
			try {
				s = statSync(p);
			} catch {
				continue;
			}
			if (s.isDirectory()) {
				stack.push(p);
			} else if (s.isFile() && p.endsWith(".jsonl")) {
				out.push(p);
			}
		}
	}
	return out;
}

async function fileSize(path: string): Promise<number> {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
}

interface DaemonState {
	state: StateFile;
	auth: AuthContext;
	envIdentity: EnvIdentity;
	config: Config;
	coalescer: Coalescer;
	pending: Map<string, PendingUpload>;
	stopping: boolean;
	watchers: Array<{ close: () => void }>;
	subdirs: Set<string>;
	// Track last persisted state hash to throttle disk writes.
	lastPersistAt: number;
}

async function persistStateMaybe(d: DaemonState, force = false): Promise<void> {
	const now = Date.now();
	if (!force && now - d.lastPersistAt < 5_000) return;
	d.lastPersistAt = now;
	try {
		await writeState(d.config.stateFile, d.state);
	} catch (err) {
		console.error("[session-sync] persistState failed:", err);
	}
}

async function preflightRecursiveWatch(
	projectsDir: string,
	timeoutMs: number,
): Promise<boolean> {
	// Write a probe file under a fresh subdir, watch the parent
	// recursively, see if the event lands within the timeout.
	const probeDir = join(projectsDir, `.session-sync-probe-${process.pid}`);
	const probeFile = join(probeDir, "probe.txt");
	try {
		mkdirSync(probeDir, { recursive: true });
	} catch {
		return false;
	}
	let observed = false;
	const fs = await import("node:fs");
	let watcher: ReturnType<typeof fs.watch> | null = null;
	try {
		watcher = fs.watch(projectsDir, { recursive: true }, () => {
			observed = true;
		});
	} catch {
		// Recursive watch not supported on this kernel.
		try {
			await unlink(probeFile);
		} catch {
			/* ignore */
		}
		try {
			const { rmSync } = await import("node:fs");
			rmSync(probeDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
		return false;
	}
	try {
		await writeFile(probeFile, "x");
		const start = Date.now();
		while (!observed && Date.now() - start < timeoutMs) {
			await new Promise((r) => setTimeout(r, 20));
		}
	} finally {
		try {
			watcher?.close();
		} catch {
			/* ignore */
		}
		try {
			await unlink(probeFile);
		} catch {
			/* ignore */
		}
		try {
			const { rmSync } = await import("node:fs");
			rmSync(probeDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
	return observed;
}

async function startWatchers(
	d: DaemonState,
	useRecursive: boolean,
): Promise<void> {
	const fs = await import("node:fs");

	const handle = (filename: string | null, dir: string): void => {
		if (!filename || d.stopping) return;
		const abs = filename.startsWith("/") ? filename : join(dir, filename);
		// Skip subagent files — they're synced via the parent's flow.
		const slash = abs.lastIndexOf("/");
		const base = slash === -1 ? abs : abs.slice(slash + 1);
		if (base.startsWith("agent-")) return;
		const sessionId = parseParentSessionId(abs);
		if (!sessionId) return;
		d.coalescer.notify({ path: abs, sessionId, time: Date.now() });
	};

	if (useRecursive) {
		try {
			const watcher = fs.watch(
				d.config.projectsDir,
				{ recursive: true },
				(_event, filename) => handle(filename, d.config.projectsDir),
			);
			d.watchers.push(watcher);
			console.log(
				"[session-sync] watching",
				d.config.projectsDir,
				"(recursive)",
			);
			return;
		} catch (err) {
			console.warn(
				"[session-sync] recursive fs.watch failed, falling back to per-subdir watchers:",
				err,
			);
		}
	}

	// Walk + watch each subdir individually. Tighten safety-net to 60s.
	d.config.safetyNetIntervalMs = Math.min(d.config.safetyNetIntervalMs, 60_000);
	if (!existsSync(d.config.projectsDir)) {
		console.warn(
			"[session-sync] projectsDir missing, no watchers attached:",
			d.config.projectsDir,
		);
		return;
	}
	for (const entry of readdirSync(d.config.projectsDir)) {
		const sub = join(d.config.projectsDir, entry);
		try {
			const s = statSync(sub);
			if (!s.isDirectory()) continue;
			const watcher = fs.watch(sub, (_event, filename) =>
				handle(filename, sub),
			);
			d.watchers.push(watcher);
			d.subdirs.add(sub);
		} catch {
			/* ignore */
		}
	}
	console.log(
		"[session-sync] watching",
		d.subdirs.size,
		"subdirs (non-recursive fallback); safety-net interval set to",
		d.config.safetyNetIntervalMs,
		"ms",
	);
}

async function fireSync(
	d: DaemonState,
	path: string,
	sessionId: string,
): Promise<void> {
	const uploadId = `${sessionId}:${Date.now()}`;
	d.pending.set(uploadId, { uploadId, estimatedRemainingMs: 500 });
	try {
		// Keep the JWT fresh before every upload. Hot-path no-op when the
		// existing token still has >5min of life. On refresh failure
		// (revoked refresh_token, transient network), log + skip this
		// upload — the next tick re-tries. We deliberately don't crash:
		// a steady stream of warnings is louder than a dead daemon.
		try {
			d.auth = await refreshAuthIfNeeded(d.auth, {
				profileName: d.config.profileName,
			});
		} catch (err) {
			console.warn(
				"[session-sync] token refresh failed; skipping upload for",
				sessionId,
				"-",
				(err as Error).message,
			);
			return;
		}
		const projectPath = projectPathFromFile(path, d.config.projectsDir);
		const outcome = await syncSession({
			parentPath: path,
			sessionId,
			state: d.state,
			auth: d.auth,
			envIdentity: d.envIdentity,
			username: d.config.username,
			projectPath,
			now: new Date(),
		});
		if (outcome.kind === "ok") {
			for (const o of outcome.outcomes) {
				if (o.outcome.kind === "uploaded") {
					d.state[o.filePath] = o.outcome.updatedState;
				} else if (o.outcome.kind === "kill_switch") {
					d.state[o.filePath] = o.outcome.updatedState;
				}
			}
			await persistStateMaybe(d);
		} else {
			console.warn(
				"[session-sync] parent sync failed for",
				sessionId,
				"-",
				outcome.error.message,
			);
		}
	} catch (err) {
		console.error("[session-sync] fireSync threw:", err);
	} finally {
		d.pending.delete(uploadId);
	}
}

async function tick(d: DaemonState): Promise<void> {
	if (d.stopping) return;
	const ready = d.coalescer.takeReady(Date.now(), d.config.idleThresholdMs);
	for (const r of ready) {
		void fireSync(d, r.path, r.sessionId);
	}
}

async function safetyTick(d: DaemonState): Promise<void> {
	if (d.stopping) return;
	const candidatePaths = Object.keys(d.state);
	const items = await safetyNetTick({
		state: d.state,
		candidatePaths,
		fileSizeFn: fileSize,
		now: new Date(),
	});
	for (const item of items) {
		void fireSync(d, item.path, item.sessionId);
	}
}

async function shutdown(d: DaemonState, signal: string): Promise<void> {
	if (d.stopping) return;
	d.stopping = true;
	console.log("[session-sync] received", signal, "- shutting down");
	for (const w of d.watchers) {
		try {
			w.close();
		} catch {
			/* ignore */
		}
	}
	const plan = planShutdown({
		pendingUploads: Array.from(d.pending.values()),
		deadlineMs: 1_000,
	});
	const start = Date.now();
	for (const step of plan.steps) {
		const remaining = 1_000 - (Date.now() - start);
		if (step.kind === "complete") {
			// Best-effort: wait until pending entry vanishes or budget exhausted.
			const target = step.uploadId;
			while (d.pending.has(target) && Date.now() - start < 1_000) {
				await new Promise((r) => setTimeout(r, 25));
			}
			if (remaining <= 0) {
				// Burst the budget mid-loop: persist before bailing so we
				// don't skip the persist-state step at the tail of `plan.steps`.
				await persistStateMaybe(d, true);
				break;
			}
		} else if (step.kind === "abandon") {
			// Just record — bytes get re-synced on next boot via state replay.
			d.pending.delete(step.uploadId);
		} else if (step.kind === "persist-state") {
			await persistStateMaybe(d, true);
		} else if (step.kind === "exit") {
			break;
		}
	}
	try {
		await removePidFile(d.config.stateDir);
	} catch (err) {
		console.warn("[session-sync] removePidFile failed:", err);
	}
	console.log(
		"[session-sync] shutdown complete (completed=" +
			plan.completedCount +
			" abandoned=" +
			plan.abandonedCount +
			")",
	);
	process.exit(0);
}

async function main(): Promise<void> {
	const config = parseConfig(process.argv.slice(2), process.env);
	console.log("[session-sync] starting; projectsDir =", config.projectsDir);

	// 1. Auth.
	let auth: AuthContext;
	try {
		auth = await loadAuth({ profileName: config.profileName });
	} catch (err) {
		console.error("[session-sync] auth failed:", (err as Error).message);
		process.exit(1);
	}
	console.log("[session-sync] auth ok; userId =", auth.userId);

	// 2. Env detect + install-id.
	const detected = detectEnvironment(process.env);
	mkdirSync(config.stateDir, { recursive: true });
	let envId = detected.id;
	if (detected.kind === "local-devcontainer") {
		envId = await getOrCreateInstallId(config.stateDir);
	}
	const envIdentity: EnvIdentity = { kind: detected.kind, id: envId };
	console.log("[session-sync] env =", envIdentity);

	// 3. Pid file (sentinel for CLI daemon-deference per ENG-5862).
	await writePidFile(config.stateDir);

	// 4. State.
	let state: StateFile;
	try {
		state = await readState(config.stateFile);
	} catch (err) {
		console.error("[session-sync] state read failed:", err);
		process.exit(1);
	}
	console.log(
		"[session-sync] state loaded with",
		Object.keys(state).length,
		"entries",
	);

	const d: DaemonState = {
		state,
		auth,
		envIdentity,
		config,
		coalescer: new Coalescer(),
		pending: new Map(),
		stopping: false,
		watchers: [],
		subdirs: new Set(),
		lastPersistAt: 0,
	};

	// 5. Startup scan.
	const scan = await startupScan({
		projectsDir: config.projectsDir,
		listFiles: listJsonlFilesRecursive,
		fileSizeFn: fileSize,
		state,
		now: new Date(),
	});
	console.log("[session-sync] startup scan: ", scan.length, "items");
	for (const item of scan) {
		void fireSync(d, item.path, item.sessionId);
	}

	// 6. Pre-flight recursive watch verification.
	let useRecursive = config.useRecursiveWatch;
	if (useRecursive) {
		const ok = await preflightRecursiveWatch(
			config.projectsDir,
			config.preflightTimeoutMs,
		);
		console.log(
			"[session-sync] fs.watch recursive preflight:",
			ok ? "PASS" : "FALLBACK",
		);
		if (!ok) useRecursive = false;
	} else {
		console.log("[session-sync] --no-recursive-watch flag set");
	}

	// 7. Watchers.
	await startWatchers(d, useRecursive);

	// 8. Tick + safety-net loops.
	const tickTimer = setInterval(() => {
		void tick(d);
	}, d.config.tickIntervalMs);
	const safetyTimer = setInterval(() => {
		void safetyTick(d);
	}, d.config.safetyNetIntervalMs);

	// 9. Signal handlers.
	const onSig = (sig: string) => {
		clearInterval(tickTimer);
		clearInterval(safetyTimer);
		void shutdown(d, sig);
	};
	process.on("SIGTERM", () => onSig("SIGTERM"));
	process.on("SIGINT", () => onSig("SIGINT"));

	console.log(
		"[session-sync] daemon ready (idle=" +
			config.idleThresholdMs +
			"ms tick=" +
			config.tickIntervalMs +
			"ms safety=" +
			config.safetyNetIntervalMs +
			"ms)",
	);
}

void main().catch((err) => {
	console.error("[session-sync] fatal:", err);
	process.exit(1);
});
