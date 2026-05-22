/**
 * Cheap, fail-silent health probe for the session-sync daemon (ENG-6158).
 *
 * Powers the live statusline segment (`.claude/hooks/statusline.ts`), which
 * Claude Code re-renders continuously — so this probe must stay fast and must
 * never throw. It reads only the daemon's own state-dir artifacts:
 *
 *   <stateDir>/daemon.pid       — liveness (pidfile + `kill -0`)
 *   <stateDir>/needs-auth.flag  — the daemon's own auth state (ENG-5990)
 *   <stateDir>/state.json       — per-file sync state, for upload freshness
 *
 * Severity ordering and the staleness rule mirror `banner-env-status.sh`
 * (ENG-5993) so the two surfaces agree:
 *
 *   down  — no live daemon                         (most actionable)
 *   auth  — daemon up but in needs-auth
 *   stale — daemon up + authed, last upload too old
 *   ok    — daemon up + authed + a recent upload (or none yet)
 *
 * Staleness is computed from `max(.lastUploadedAt)` across state entries —
 * NOT the state file's mtime. Heartbeat/safety-net writes bump the file's
 * mtime without uploading anything, so mtime would lie green during the
 * silent-failure mode the banner was built to catch (ENG-5993).
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SyncHealthState = "ok" | "auth" | "stale" | "down";

export interface SyncHealth {
	state: SyncHealthState;
	/** Seconds since the most recent upload, or null when none is known. */
	lastUploadAgeS: number | null;
}

/** 10 min — parity with `banner-env-status.sh`'s `sync_stale_threshold_s`. */
export const DEFAULT_STALE_THRESHOLD_S = 600;

export interface HealthInputs {
	daemonAlive: boolean;
	needsAuth: boolean;
	lastUploadAgeS: number | null;
	staleThresholdS?: number;
}

/**
 * Pure severity resolution. Order: down > auth > stale > ok. A null upload
 * age is treated as ok (a fresh daemon that hasn't uploaded yet is healthy),
 * matching the banner, which only flags stale when an age is known.
 */
export function summarizeHealth(inputs: HealthInputs): SyncHealth {
	const threshold = inputs.staleThresholdS ?? DEFAULT_STALE_THRESHOLD_S;
	const lastUploadAgeS = inputs.lastUploadAgeS;
	if (!inputs.daemonAlive) return { state: "down", lastUploadAgeS };
	if (inputs.needsAuth) return { state: "auth", lastUploadAgeS };
	if (lastUploadAgeS !== null && lastUploadAgeS >= threshold) {
		return { state: "stale", lastUploadAgeS };
	}
	return { state: "ok", lastUploadAgeS };
}

/**
 * Is `pid` a live process? `process.kill(pid, 0)` sends no signal but performs
 * the existence/permission check. EPERM means the process exists but isn't
 * ours to signal — still alive. Any other throw (ESRCH, EINVAL, out-of-range)
 * means not a live daemon. Non-positive pids are rejected up front because
 * `kill(0, …)` / `kill(-1, …)` address process *groups*, not a single daemon.
 */
export function isPidAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "EPERM";
	}
}

function resolveStateDir(stateDir?: string): string {
	return (
		stateDir ??
		process.env.SESSION_SYNC_STATE_DIR ??
		join(homedir(), ".local/state/session-sync")
	);
}

/** Read the daemon pidfile and return its pid, or null if absent/garbage. */
export function readDaemonPid(stateDir: string): number | null {
	try {
		const raw = readFileSync(join(stateDir, "daemon.pid"), "utf8").trim();
		const pid = Number.parseInt(raw, 10);
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

/**
 * Seconds since the newest `lastUploadedAt` across `state.json` entries, or
 * null when there is no upload data (missing/malformed file, empty state, or
 * only the `""` "never uploaded" sentinel). Never throws.
 */
export function readLastUploadAgeS(stateDir: string, now: number): number | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(
			readFileSync(join(stateDir, "state.json"), "utf8"),
		) as unknown;
	} catch {
		return null;
	}
	if (parsed === null || typeof parsed !== "object") return null;

	let newestMs = Number.NEGATIVE_INFINITY;
	for (const entry of Object.values(parsed as Record<string, unknown>)) {
		const raw =
			entry && typeof entry === "object"
				? (entry as { lastUploadedAt?: unknown }).lastUploadedAt
				: undefined;
		if (typeof raw !== "string" || raw === "") continue;
		const ms = Date.parse(raw);
		if (Number.isNaN(ms)) continue;
		if (ms > newestMs) newestMs = ms;
	}
	if (newestMs === Number.NEGATIVE_INFINITY) return null;
	return Math.max(0, Math.floor((now - newestMs) / 1000));
}

export interface ProbeOptions {
	/** Override the daemon state dir (test seam). */
	stateDir?: string;
	/** Override "now" in epoch ms (test seam). */
	now?: number;
	/** Override the staleness threshold in seconds. */
	staleThresholdS?: number;
}

/**
 * Probe daemon health from on-disk state. Synchronous (statusline-friendly)
 * and fail-silent — any unreadable artifact degrades to the safe reading
 * (down / no-age) rather than throwing.
 */
export function probeSyncHealthSync(opts: ProbeOptions = {}): SyncHealth {
	const stateDir = resolveStateDir(opts.stateDir);
	const now = opts.now ?? Date.now();
	const pid = readDaemonPid(stateDir);
	const daemonAlive = pid !== null && isPidAlive(pid);
	const needsAuth = existsSync(join(stateDir, "needs-auth.flag"));
	const lastUploadAgeS = readLastUploadAgeS(stateDir, now);
	return summarizeHealth({
		daemonAlive,
		needsAuth,
		lastUploadAgeS,
		staleThresholdS: opts.staleThresholdS,
	});
}
