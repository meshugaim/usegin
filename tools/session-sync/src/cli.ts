#!/usr/bin/env bun
/**
 * session-sync daemon entrypoint (AC 13, 16, 18, 19, 20, 21, 40, 41, 45 daemon side).
 *
 * Wire layer that composes the pure modules (env-detect, install-id,
 * state, coalescer, startup-scan, safety-net, lifecycle, heartbeat) with
 * the HTTP primitives (auth, sync-session, syncFile, postHeartbeat). NOT
 * unit-tested — the smoke procedure in `README.md` is its verification.
 *
 * Backoff triggers (sync 503 sync_disabled, sync 409 lock_held, heartbeat
 * 409 lock_held) all funnel through `applyBackoff`/`computeLockBackoffAt`
 * in `backoff.ts`; the daemon's persisted state row carries one
 * `nextRetryAt` marker that `isInBackoff` reads on the next watch tick.
 */

import {
	existsSync,
	watch as fsWatch,
	mkdirSync,
	readdirSync,
	statSync,
} from "node:fs";
import { stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getCredentialsPath } from "../../lib/auth/credentials.ts";
import { resolveProfileName } from "../../lib/auth/profiles.ts";
import { type AuthContext, loadAuth, refreshAuthIfNeeded } from "./auth.ts";
import { applyBackoff, computeLockBackoffAt } from "./backoff.ts";
import { Coalescer } from "./coalescer.ts";
import { detectEnvironment } from "./env-detect.ts";
import { classifyError } from "./error-classify.ts";
import { type HeartbeatLoopHandle, heartbeatLoop } from "./heartbeat.ts";
import { getOrCreateInstallId } from "./install-id.ts";
import {
	type PendingUpload,
	planShutdown,
	removePidFile,
	writePidFile,
} from "./lifecycle.ts";
import {
	deleteFlag,
	type NeedsAuthErrorClass,
	readFlag,
	updateFlag,
	writeFlag,
} from "./needs-auth-flag.ts";
import { safetyNetTick } from "./safety-net.ts";
import { startupScan } from "./startup-scan.ts";
import {
	type PerFileState,
	readState,
	type StateFile,
	writeState,
} from "./state.ts";
import {
	dispatch,
	type Effect,
	initialNeedsAuth,
	initialOk,
	type MachineSnapshot,
	type Trigger,
} from "./state-machine.ts";
import { type LockHolder, postHeartbeat } from "./sync-client.ts";
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
	/**
	 * Live `AuthContext`. Null when the daemon is in `needs-auth` state
	 * (ENG-5990) — startup auth-fail, mid-run auth-class failure, or
	 * restart-into-needs-auth all clear this. Code paths that read `auth`
	 * MUST guard against null.
	 */
	auth: AuthContext | null;
	envIdentity: EnvIdentity;
	config: Config;
	coalescer: Coalescer;
	pending: Map<string, PendingUpload>;
	stopping: boolean;
	watchers: Array<{ close: () => void }>;
	subdirs: Set<string>;
	// Track last persisted state hash to throttle disk writes.
	lastPersistAt: number;
	// Heartbeat-loop handle (AC 40, 41). `null` until the loop is started
	// at the bottom of `main()`; shutdown() calls `.stop()` to clear the
	// 60s interval so the process can exit cleanly.
	heartbeat: HeartbeatLoopHandle | null;
	/**
	 * Auth state machine snapshot (ENG-5990). When `state === "needs-auth"`,
	 * `fireSync` and the heartbeat tick are no-ops, the credentials watcher
	 * is armed (`credWatcher !== null`), and `auth` is null.
	 */
	authState: MachineSnapshot;
	/**
	 * Watcher on `~/.effi/profiles/<profile>/credentials.json`, armed only
	 * while in `needs-auth`. mtime change → retry `loadAuth`; success →
	 * dispatch a `credentials-changed` trigger that transitions back to `ok`.
	 *
	 * Armed in `ok → needs-auth`; closed in `needs-auth → ok`. This
	 * structurally closes the self-write feedback loop (the daemon's own
	 * `refreshAuthIfNeeded` rewrites credentials.json every ~55min; in
	 * `ok` state the watcher is closed so that write is invisible).
	 */
	credWatcher: { close: () => void } | null;
	/**
	 * Factory for the heartbeat loop. Stored on DaemonState so we can
	 * stop+restart the heartbeat across needs-auth transitions without
	 * recreating the closure manually each time.
	 */
	startHeartbeatLoop: () => HeartbeatLoopHandle;
	/**
	 * The resolved profile name (after `resolveProfileName` honored
	 * `current_profile` / EFFI_PROFILE / etc.). Cached at boot so the
	 * credentials watcher and recovery `loadAuth` calls hit the same
	 * profile dir without re-reading `current_profile` on every event.
	 */
	resolvedProfileName: string;
}

/**
 * Read a JSONL file's mtime in milliseconds via async `stat`, returning
 * null if the file has been deleted between the watch event and this
 * call. Used by the heartbeat loop (AC 41) — the safety-net's own
 * `statSync`-based size check stays untouched.
 *
 * Async by design: the heartbeat loop already awaits between sessions
 * and a missed-fd EBADF on shutdown shouldn't surface as a sync error.
 */
async function getMtimeMs(path: string): Promise<number | null> {
	try {
		const s = await stat(path);
		return s.mtimeMs;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		// Any other stat error (EACCES on rotated dir, etc.) → treat as
		// "no signal", same as deletion — heartbeat loop skips.
		return null;
	}
}

/**
 * Single emit-site for the AC-15 lock_held warning, shared between the
 * sync path (`fireSync`) and the heartbeat path (`sendHeartbeat`). One
 * placeholder string (`"unknown"`) is used for every null holder field
 * so log output reads consistently regardless of which trigger emitted
 * it. The math + state mutation lives in `backoff.ts::applyBackoff` —
 * this helper is the boundary's *output* side; `applyBackoff` is the
 * state side. Two helpers, two responsibilities.
 *
 * `source` differentiates the prefix ("409 lock_held" vs "heartbeat 409
 * lock_held") so a human grepping the daemon log can tell whether the
 * 409 came from a sync POST or a heartbeat POST without parsing
 * timestamps.
 */
function warnLockHeld(opts: {
	source: "sync" | "heartbeat";
	sessionId: string;
	holder: LockHolder;
	nextRetryAt: string;
}): void {
	const prefix =
		opts.source === "sync" ? "409 lock_held" : "heartbeat 409 lock_held";
	const h = opts.holder;
	console.warn(
		`[session-sync] ${prefix} for ${opts.sessionId}: ` +
			`holder env=${h.environment_kind ?? "unknown"}:${
				h.environment_id ?? "unknown"
			} user=${h.username ?? "unknown"} expires_at=${
				h.expires_at ?? "unknown"
			}; nextRetryAt=${opts.nextRetryAt}`,
	);
}

/**
 * Map an `ErrorClass` (auth/lock/network) plus diagnostic context into the
 * `NeedsAuthErrorClass` enum the flag file carries. The flag's value is
 * for diagnostics only — the banner uses presence-of-flag, not this
 * field — so the enum stays small and intentional.
 */
function diagnoseErrorClass(args: {
	source: "loadAuth" | "refresh" | "api";
	status?: number;
	message: string;
}): NeedsAuthErrorClass {
	if (args.source === "loadAuth") {
		if (/no credentials/i.test(args.message)) return "missing_credentials";
		return "expired_refresh_token";
	}
	if (args.source === "refresh") return "expired_refresh_token";
	if (args.status === 401) return "401_from_api";
	if (args.status === 403) return "403_from_api";
	return "unknown";
}

/**
 * Execute one Effect against `DaemonState`. Pure-ish — flag I/O and
 * watcher arm/close are the side-effects; the in-memory mutations are
 * direct on `d`. The state-machine emits effects in load-bearing order;
 * callers MUST iterate the array sequentially and await each.
 */
async function applyEffect(d: DaemonState, effect: Effect): Promise<void> {
	switch (effect.kind) {
		case "write-flag":
			try {
				await writeFlag(d.config.stateDir, {
					since: effect.since,
					lastCheckedAt: effect.lastCheckedAt,
					errorClass: effect.errorClass,
					errorMessage: effect.errorMessage,
				});
			} catch (err) {
				console.error("[session-sync] writeFlag failed:", err);
			}
			return;
		case "update-flag":
			try {
				await updateFlag(d.config.stateDir, {
					lastCheckedAt: effect.lastCheckedAt,
					errorClass: effect.errorClass,
					errorMessage: effect.errorMessage,
				});
			} catch (err) {
				console.error("[session-sync] updateFlag failed:", err);
			}
			return;
		case "delete-flag":
			try {
				await deleteFlag(d.config.stateDir);
			} catch (err) {
				console.error("[session-sync] deleteFlag failed:", err);
			}
			return;
		case "assign-auth":
			d.auth = effect.auth;
			return;
		case "clear-auth":
			d.auth = null;
			return;
		case "arm-watcher":
			armCredWatcher(d);
			return;
		case "close-watcher":
			d.credWatcher?.close();
			d.credWatcher = null;
			return;
		case "stop-heartbeat":
			d.heartbeat?.stop();
			d.heartbeat = null;
			return;
		case "start-heartbeat":
			d.heartbeat = d.startHeartbeatLoop();
			return;
		case "drain-backlog":
			// One-shot safety-net pass to drain rows that accumulated during
			// `needs-auth`. The regular interval will pick up anything this
			// pass misses (e.g. a row whose nextRetryAt slid past during the
			// drain itself).
			await safetyTick(d);
			return;
	}
}

/**
 * Dispatch a trigger through the pure state machine and execute every
 * effect in order. Console-logs the transition for grep-ability.
 */
async function dispatchTrigger(
	d: DaemonState,
	trigger: Trigger,
): Promise<void> {
	const before = d.authState.state;
	const result = dispatch(d.authState, trigger);
	d.authState = result.next;
	if (result.effects.length > 0 && before !== d.authState.state) {
		console.log(
			`[session-sync] auth-state: ${before} → ${d.authState.state}`,
			trigger.kind === "auth-failure"
				? `(${trigger.ctx.errorClass}: ${trigger.ctx.errorMessage})`
				: "",
		);
	}
	for (const effect of result.effects) {
		await applyEffect(d, effect);
	}
}

/**
 * Arm a watcher on the profile's credentials.json. mtime change →
 * retry `loadAuth` and dispatch a `credentials-changed` trigger.
 *
 * Idempotent: re-arming while a watcher exists is a no-op.
 */
function armCredWatcher(d: DaemonState): void {
	if (d.credWatcher) return;
	const credPath = getCredentialsPath(d.resolvedProfileName);
	let lastMtimeMs = 0;
	try {
		lastMtimeMs = statSync(credPath).mtimeMs;
	} catch {
		// File may not exist yet (missing-credentials path). Watch the
		// parent dir; on first appearance we'll fire.
	}
	let watcher: { close: () => void } | null = null;
	try {
		// Watch the parent dir so we catch the file's creation as well as
		// in-place mtime bumps. Filtering for our exact basename keeps the
		// signal narrow.
		const parent = credPath.slice(0, credPath.lastIndexOf("/"));
		mkdirSync(parent, { recursive: true });
		const baseName = credPath.slice(credPath.lastIndexOf("/") + 1);
		watcher = fsWatch(parent, (_event, filename) => {
			if (!filename || filename !== baseName) return;
			let mtimeMs = 0;
			try {
				mtimeMs = statSync(credPath).mtimeMs;
			} catch {
				return;
			}
			if (mtimeMs === lastMtimeMs) return;
			lastMtimeMs = mtimeMs;
			void onCredentialsChanged(d);
		});
	} catch (err) {
		console.warn(
			"[session-sync] failed to arm credentials watcher:",
			(err as Error).message,
		);
		return;
	}
	d.credWatcher = watcher;
	console.log("[session-sync] credentials watcher armed on", credPath);
}

/**
 * Credentials watcher callback: retry `loadAuth`, optionally pre-emptively
 * refresh, then dispatch a `credentials-changed` trigger. Result is interpreted
 * by the state machine — happy path transitions to `ok`, failure stays in
 * `needs-auth` with bumped `lastCheckedAt`.
 */
async function onCredentialsChanged(d: DaemonState): Promise<void> {
	if (d.authState.state !== "needs-auth") return; // stale event after teardown
	const now = new Date().toISOString();
	try {
		let auth = await loadAuth({ profileName: d.resolvedProfileName });
		// Pre-emptive refresh: if the new token also has <REFRESH_BUFFER
		// remaining, refresh now before handing it to the heartbeat.
		auth = await refreshAuthIfNeeded(auth, {
			profileName: d.resolvedProfileName,
		});
		await dispatchTrigger(d, {
			kind: "credentials-changed",
			loadResult: { ok: true, auth },
			now,
		});
	} catch (err) {
		const klass = classifyError(err as Error);
		if (klass !== "auth") {
			// Network/lock during recovery — log and idle until the next
			// mtime tick. The state machine treats this as a failed recovery.
			console.warn(
				"[session-sync] credentials-changed: non-auth error during recovery -",
				(err as Error).message,
			);
		}
		await dispatchTrigger(d, {
			kind: "credentials-changed",
			loadResult: {
				ok: false,
				ctx: {
					errorClass: diagnoseErrorClass({
						source: "loadAuth",
						message: (err as Error).message,
					}),
					errorMessage: (err as Error).message,
				},
			},
			now,
		});
	}
}

/**
 * Wire-layer heartbeat callback: POST one heartbeat for a single
 * session, then update `d.state[path]` based on the outcome.
 *
 * - 200 → bump `lastHeartbeatAt = expires_at ?? new Date().toISOString()`.
 *   The lease was refreshed; `shouldHeartbeat` will read this on its next
 *   tick and skip until 60s past it.
 * - 409 → apply the AC-15 backoff, identical to the sync path's 409
 *   handling — set `nextRetryAt = holder.expires_at + buffer` (or
 *   `now + 60s` when the holder is stale-null). The sync loop's
 *   `isInBackoff` filter then suppresses upload attempts on the same
 *   marker. One mechanism, two triggers.
 * - transport_error → log + skip; next heartbeat tick retries.
 */
async function sendHeartbeat(
	d: DaemonState,
	path: string,
	perFile: PerFileState,
): Promise<void> {
	// ENG-5990: skip the entire tick if we're idle on needs-auth. Reading
	// `d.auth` fresh per tick (vs capturing in a closure at heartbeat-loop
	// start) means a second recovery cycle re-arms the heartbeat against
	// the new AuthContext, not the stale one.
	if (d.authState.state === "needs-auth" || d.auth === null) return;
	// Refresh JWT first — heartbeat is far less hot than sync but the
	// daemon can park overnight and a stale token would silently fail
	// every tick.
	try {
		d.auth = await refreshAuthIfNeeded(d.auth, {
			profileName: d.config.profileName,
		});
	} catch (err) {
		const klass = classifyError(err as Error);
		if (klass === "auth") {
			await dispatchTrigger(d, {
				kind: "auth-failure",
				ctx: {
					errorClass: diagnoseErrorClass({
						source: "refresh",
						message: (err as Error).message,
					}),
					errorMessage: (err as Error).message,
				},
				now: new Date().toISOString(),
			});
			return;
		}
		console.warn(
			"[session-sync] heartbeat: token refresh failed for",
			perFile.sessionId,
			"-",
			(err as Error).message,
		);
		return;
	}
	const res = await postHeartbeat({
		apiUrl: d.auth.apiUrl,
		token: d.auth.token,
		sessionId: perFile.sessionId,
		environmentKind: d.envIdentity.kind,
		environmentId: d.envIdentity.id,
	});
	// Wire-side classification: 401/403-with-auth-body from heartbeat POST
	// flips state. lock_held + sync_disabled + 5xx keep existing handlers.
	if (!res.ok && res.kind === "transport_error") {
		const klass = classifyError(res);
		if (klass === "auth") {
			await dispatchTrigger(d, {
				kind: "auth-failure",
				ctx: {
					errorClass: diagnoseErrorClass({
						source: "api",
						status: res.status,
						message: `heartbeat ${res.status}`,
					}),
					errorMessage: `heartbeat ${res.status}: ${
						typeof res.body === "string"
							? res.body
							: (JSON.stringify(res.body) ?? "<no body>")
					}`,
				},
				now: new Date().toISOString(),
			});
			return;
		}
	}
	const now = new Date();
	if (res.ok) {
		d.state[path] = {
			...perFile,
			lastHeartbeatAt: res.expiresAt ?? now.toISOString(),
		};
		await persistStateMaybe(d);
		return;
	}
	if (res.kind === "lock_held") {
		const { holder } = res;
		const nextRetryAt = computeLockBackoffAt(holder, now);
		// Same backoff helper the sync 409 path uses — `applyBackoff`
		// preserves contentHash / lastUploadedSize / storagePath /
		// lastUploadedAt / lastHeartbeatAt and only mutates `nextRetryAt`.
		// The sync loop's `isInBackoff` filter then suppresses upload
		// attempts on the same marker. One mechanism, three triggers.
		d.state[path] = applyBackoff(perFile, perFile.sessionId, nextRetryAt);
		warnLockHeld({
			source: "heartbeat",
			sessionId: perFile.sessionId,
			holder,
			nextRetryAt,
		});
		await persistStateMaybe(d);
		return;
	}
	// transport_error — bad response, but the JSONL bytes haven't been
	// lost (the next sync tick still has them). Log loud and move on.
	console.warn(
		"[session-sync] heartbeat:",
		res.status,
		"for",
		perFile.sessionId,
		"-",
		typeof res.body === "string"
			? res.body
			: (JSON.stringify(res.body) ?? "<no body>"),
	);
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
	// ENG-5990 AC3: in needs-auth, return early — no refresh, no POST, no
	// pending-map mutation, no state write.
	if (d.authState.state === "needs-auth" || d.auth === null) return;
	const uploadId = `${sessionId}:${Date.now()}`;
	d.pending.set(uploadId, { uploadId, estimatedRemainingMs: 500 });
	try {
		// Keep the JWT fresh before every upload. Hot-path no-op when the
		// existing token still has >5min of life. On refresh failure
		// (revoked refresh_token, transient network), classify: auth-class
		// flips state to needs-auth (daemon goes idle); network-class logs
		// and skips this upload — the next tick re-tries.
		try {
			d.auth = await refreshAuthIfNeeded(d.auth, {
				profileName: d.config.profileName,
			});
		} catch (err) {
			const klass = classifyError(err as Error);
			if (klass === "auth") {
				await dispatchTrigger(d, {
					kind: "auth-failure",
					ctx: {
						errorClass: diagnoseErrorClass({
							source: "refresh",
							message: (err as Error).message,
						}),
						errorMessage: (err as Error).message,
					},
					now: new Date().toISOString(),
				});
				return;
			}
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
				} else if (o.outcome.kind === "lock_held") {
					// AC 15: 409 from sync. Persist `nextRetryAt` so the next
					// watch-loop / safety-net tick honors the backoff window
					// instead of immediately re-uploading. `syncFile` already
					// preserved prior contentHash / lastUploadedAt — the row
					// we write here is the same row minus the new marker.
					d.state[o.filePath] = o.outcome.updatedState;
					// Surface who is holding the lock so the human can debug a
					// "why is staging not getting my session" pairing. Emitted
					// here (not inside `syncFile`) so the pure outcome function
					// stays log-free and so a future dedupe layer can live in
					// one place; see the Red-test layering note in
					// `sync-flow-409.test.ts`. `warnLockHeld` is the single
					// emit-site; the heartbeat path (sendHeartbeat) uses it too.
					warnLockHeld({
						source: "sync",
						sessionId,
						holder: o.outcome.holder,
						nextRetryAt: o.outcome.updatedState.nextRetryAt ?? "unknown",
					});
				} else if (o.outcome.kind === "completed_and_released") {
					// AC 18 ext (slice 2, step 6): clean done state. Persist
					// the final hash so a startup-scan replay doesn't re-upload
					// the same bytes. We deliberately leave the row in the state
					// file — slice-1 doesn't sweep completion entries and the
					// safety-net's `isInBackoff` filter is harmless on a hash-
					// matched row; the 5-min scan will GC naturally when the
					// file rotates out of the watched directory.
					d.state[o.filePath] = o.outcome.updatedState;
					console.log(
						"[session-sync] released lock for completed session",
						sessionId,
					);
				} else if (o.outcome.kind === "completed_release_denied") {
					// AC 18 ext: 403 — a different env stole the lock between
					// our successful sync and our DELETE (rare race). Server's
					// 403 body deliberately omits holder fields (release is an
					// identity assertion, not a discovery surface — see step 4
					// route.ts:130-134), so we log the bare denial without
					// holder details. State row still advances; the lease lapses
					// naturally at `expires_at` (~2 min from acquisition). No
					// retry — the release call is gated on the post-200 branch
					// of `syncFile`, which doesn't recur for finalized JSONLs
					// (size unchanged → hash-match short-circuit before POST).
					// `envIdentity` is inlined so "why did MY env get denied"
					// debugging doesn't require scrolling to the boot log.
					d.state[o.filePath] = o.outcome.updatedState;
					console.warn(
						"[session-sync] release denied (403 not_holder) for completed session",
						sessionId,
						`envKind=${d.envIdentity.kind} envId=${d.envIdentity.id}`,
						"- another env now holds the lock; lease will lapse naturally",
					);
				} else if (o.outcome.kind === "completed_release_transport_error") {
					// AC 18 ext: 5xx / network failure on the release call.
					// Best-effort contract: the sync DID land — failing the
					// outcome would force a re-upload of bytes the server
					// already has. The lease lapses naturally at `expires_at`
					// (~2 min from acquisition). No retry — the release call
					// is gated on the post-200 branch of `syncFile`, which
					// doesn't recur for finalized JSONLs (size unchanged →
					// hash-match short-circuit before POST; heartbeat is a
					// POST not a DELETE). `envIdentity` is inlined for the
					// same boot-log-scrolling reason as the 403 branch above.
					//
					// Log shape mirrors the 403 branch above and the heartbeat
					// transport_error log (see sendHeartbeat): we always emit
					// `status` + `body` so a human reading staging logs can
					// tell apart a 5xx, a malformed body, and a thrown network
					// error (status=0, body=null sentinels) without parsing a
					// message string. `body` is JSON-stringified the same way
					// the heartbeat path does it.
					d.state[o.filePath] = o.outcome.updatedState;
					const { status, body, message } = o.outcome.error;
					console.warn(
						"[session-sync] release transport error for completed session",
						sessionId,
						`envKind=${d.envIdentity.kind} envId=${d.envIdentity.id}`,
						"- HTTP",
						status,
						typeof body === "string"
							? body
							: (JSON.stringify(body) ?? "<no body>"),
						"-",
						message,
						"- lease will lapse naturally; no retry",
					);
				}
			}
			await persistStateMaybe(d);
		} else {
			// ENG-5990 AC7: classify the bubbled error. `fatal_error` from a
			// 4xx may carry an auth-class status (401, or 403 with auth body).
			// Extract status from the synthesized message (sync-flow.ts:455
			// shape: "session-sync: HTTP <status> from sync endpoint: <body>").
			const msg = outcome.error.message;
			const statusMatch = /HTTP (\d{3})/.exec(msg);
			const status = statusMatch
				? Number.parseInt(statusMatch[1] ?? "0", 10)
				: 0;
			if (
				status === 401 ||
				(status === 403 && /unauthorized|expired|invalid_grant/i.test(msg))
			) {
				await dispatchTrigger(d, {
					kind: "auth-failure",
					ctx: {
						errorClass: diagnoseErrorClass({
							source: "api",
							status,
							message: msg,
						}),
						errorMessage: msg,
					},
					now: new Date().toISOString(),
				});
				return;
			}
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
	// Idempotent — onSig already called stop(), but if shutdown was
	// invoked by some other path (uncaught exception handler, future
	// callers) we still want the interval cleared before we walk the
	// pending uploads.
	d.heartbeat?.stop();
	d.heartbeat = null;
	try {
		d.credWatcher?.close();
	} catch {
		/* ignore */
	}
	d.credWatcher = null;
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

	// 2. Env detect + install-id. Done before auth so the stateDir is
	// guaranteed mkdir'd before we look for needs-auth.flag in it.
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

	// Resolve the active profile name once, up-front. The state-dir flag
	// I/O is profile-agnostic, but the credentials watcher and recovery
	// `loadAuth` calls need to hit the same profile dir that auth.ts will
	// (which honors `current_profile`).
	const resolvedProfileName = await resolveProfileName(config.profileName);

	// 1. Auth — with ENG-5990 restart persistence + needs-auth fallback.
	//
	// (a) If <stateDir>/needs-auth.flag exists, boot directly into
	//     needs-auth, preserving `since` from the flag. Skip loadAuth
	//     entirely (the credentials watcher will retry on mtime change).
	// (b) Otherwise call loadAuth; on success, pre-emptively refresh if
	//     the token has <5min left, then enter `ok`. Any failure (loadAuth
	//     throw, pre-emptive refresh throw with auth-class) enters
	//     `needs-auth` without exiting.
	let auth: AuthContext | null = null;
	let authState: MachineSnapshot = initialOk();
	const existingFlag = await readFlag(config.stateDir);
	const nowISO = new Date().toISOString();
	if (existingFlag) {
		console.log(
			"[session-sync] needs-auth.flag present; booting into needs-auth (since",
			existingFlag.since + ")",
		);
		authState = initialNeedsAuth(existingFlag.since);
		// Bump lastCheckedAt so the banner reflects this boot's check.
		await updateFlag(config.stateDir, {
			lastCheckedAt: nowISO,
			errorClass: existingFlag.errorClass,
			errorMessage: existingFlag.errorMessage,
		});
	} else {
		try {
			auth = await loadAuth({ profileName: config.profileName });
			// Pre-emptive refresh (AC2): if the just-loaded token has
			// <REFRESH_BUFFER_SECONDS remaining, refresh now so the first
			// heartbeat / fireSync doesn't hit a guaranteed 401.
			auth = await refreshAuthIfNeeded(auth, {
				profileName: config.profileName,
			});
			console.log("[session-sync] auth ok; userId =", auth.userId);
		} catch (err) {
			const message = (err as Error).message;
			console.warn("[session-sync] auth failed at startup:", message);
			// Enter needs-auth without exiting — daemon stays up.
			authState = { state: "needs-auth", since: nowISO };
			auth = null;
			await writeFlag(config.stateDir, {
				since: nowISO,
				lastCheckedAt: nowISO,
				errorClass: diagnoseErrorClass({
					source: "loadAuth",
					message,
				}),
				errorMessage: message,
			});
		}
	}

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
		heartbeat: null,
		authState,
		credWatcher: null,
		// Forward-reference: the factory is assigned after `d` is constructed
		// (closure needs to see `d`). This is a typed placeholder.
		startHeartbeatLoop: () => {
			throw new Error("heartbeat factory not yet wired");
		},
		resolvedProfileName,
	};

	// Wire the heartbeat factory now that `d` exists.
	d.startHeartbeatLoop = (): HeartbeatLoopHandle =>
		heartbeatLoop({
			getState: () => d.state,
			getMtimeMs,
			sendHeartbeat: (path, perFile) => sendHeartbeat(d, path, perFile),
		});

	// If we booted into needs-auth, arm the watcher now (effects for the
	// startup-trigger were already applied inline above — keep that path
	// minimal; this is the structural complement).
	if (d.authState.state === "needs-auth") {
		armCredWatcher(d);
	}

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

	// 9. Heartbeat loop (AC 40, 41). Started AFTER state is loaded and
	// the sync watchers are attached, so the very first tick has
	// something to walk. The factory schedules a 60s `setInterval` that
	// reads the live `d.state` snapshot, calls `shouldHeartbeat` per
	// entry, and posts via `sendHeartbeat` only on the entries that
	// match. Shutdown calls `.stop()` to clear the interval.
	//
	// ENG-5990: only start the heartbeat in `ok` state. The state machine
	// will re-start it via the `start-heartbeat` effect on `needs-auth → ok`
	// recovery; `sendHeartbeat` reads `d.auth` fresh per tick so the
	// restart uses the refreshed auth, not the stale one.
	if (d.authState.state === "ok") {
		d.heartbeat = d.startHeartbeatLoop();
	}

	// 10. Signal handlers.
	const onSig = (sig: string) => {
		clearInterval(tickTimer);
		clearInterval(safetyTimer);
		d.heartbeat?.stop();
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
			"ms heartbeat=60000ms)",
	);
}

void main().catch((err) => {
	console.error("[session-sync] fatal:", err);
	process.exit(1);
});
