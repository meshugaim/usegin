import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isPidAlive,
	probeSyncHealthSync,
	readDaemonPid,
	readLastUploadAgeS,
	summarizeHealth,
} from "../src/health.ts";

/**
 * A valid, in-range PID that is guaranteed not to be a live process: spawn a
 * trivial command synchronously (which also reaps it, so it's not a zombie),
 * then reuse its now-dead PID. This exercises the ESRCH ("no such process")
 * branch deterministically — unlike a hardcoded large number, which could in
 * principle be live on a busy host.
 */
function deadButValidPid(): number {
	const { pid } = spawnSync("true", []);
	if (typeof pid !== "number" || pid <= 0) {
		throw new Error("could not obtain a reaped child pid for the test");
	}
	return pid;
}

function freshStateDir(): string {
	return mkdtempSync(join(tmpdir(), "session-sync-health-"));
}

function writePid(dir: string, pid: string): void {
	writeFileSync(join(dir, "daemon.pid"), pid, { mode: 0o600 });
}

function writeFlag(dir: string): void {
	writeFileSync(
		join(dir, "needs-auth.flag"),
		JSON.stringify({
			since: "2026-05-22T00:00:00.000Z",
			lastCheckedAt: "2026-05-22T00:00:00.000Z",
			errorClass: "missing_credentials",
			errorMessage: "no credentials",
		}),
		{ mode: 0o600 },
	);
}

function writeState(dir: string, uploads: (string | undefined)[]): void {
	const state: Record<string, unknown> = {};
	uploads.forEach((lastUploadedAt, i) => {
		state[`/abs/path/${i}.jsonl`] = {
			contentHash: "h",
			lastUploadedSize: 0,
			sessionId: `s${i}`,
			storagePath: `p${i}`,
			lastUploadedAt: lastUploadedAt ?? "",
		};
	});
	writeFileSync(join(dir, "state.json"), JSON.stringify(state), {
		mode: 0o600,
	});
}

describe("summarizeHealth — severity resolution (banner parity: down > auth > stale > ok)", () => {
	test("down wins even when auth/stale also true", () => {
		expect(
			summarizeHealth({
				daemonAlive: false,
				needsAuth: true,
				lastUploadAgeS: 99999,
			}).state,
		).toBe("down");
	});

	test("auth wins over stale when daemon alive", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: true,
				lastUploadAgeS: 99999,
			}).state,
		).toBe("auth");
	});

	test("stale when alive, authed, and last upload past threshold", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: false,
				lastUploadAgeS: 700,
			}).state,
		).toBe("stale");
	});

	test("ok when alive, authed, and last upload within threshold", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: false,
				lastUploadAgeS: 30,
			}).state,
		).toBe("ok");
	});

	test("null age is ok, not stale (a fresh daemon hasn't uploaded yet)", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: false,
				lastUploadAgeS: null,
			}).state,
		).toBe("ok");
	});

	test("custom stale threshold is respected", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: false,
				lastUploadAgeS: 120,
				staleThresholdS: 60,
			}).state,
		).toBe("stale");
	});

	test("threshold boundary is inclusive (age == threshold ⇒ stale)", () => {
		expect(
			summarizeHealth({
				daemonAlive: true,
				needsAuth: false,
				lastUploadAgeS: 600,
			}).state,
		).toBe("stale");
	});
});

describe("isPidAlive", () => {
	test("the current process is alive", () => {
		expect(isPidAlive(process.pid)).toBe(true);
	});

	test("a valid-but-dead pid is not alive (ESRCH — the daemon-died case)", () => {
		// This is the ENG-6157 silent-outage shape: a stale pidfile points at a
		// PID whose process has exited. `process.kill(pid, 0)` throws ESRCH.
		expect(isPidAlive(deadButValidPid())).toBe(false);
	});

	test("an out-of-range pid is not alive (fail-closed on throw)", () => {
		expect(isPidAlive(2 ** 31 - 1)).toBe(false);
	});

	test("a non-positive pid is not alive", () => {
		expect(isPidAlive(0)).toBe(false);
		expect(isPidAlive(-1)).toBe(false);
	});

	test("a non-integer pid is not alive", () => {
		expect(isPidAlive(3.5)).toBe(false);
		expect(isPidAlive(Number.NaN)).toBe(false);
	});
});

describe("readDaemonPid", () => {
	test("reads a valid pid from the pidfile", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, "12345");
			expect(readDaemonPid(dir)).toBe(12345);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("trims surrounding whitespace/newline", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, "  12345\n");
			expect(readDaemonPid(dir)).toBe(12345);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("returns null when the pidfile is absent", () => {
		const dir = freshStateDir();
		try {
			expect(readDaemonPid(dir)).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("returns null for non-numeric garbage", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, "not-a-pid");
			expect(readDaemonPid(dir)).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("rejects a non-positive pid in the file", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, "0");
			expect(readDaemonPid(dir)).toBeNull();
			writePid(dir, "-5");
			expect(readDaemonPid(dir)).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("readLastUploadAgeS", () => {
	test("returns null when state.json is absent", () => {
		const dir = freshStateDir();
		try {
			expect(readLastUploadAgeS(dir, Date.now())).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("returns null when state.json is malformed (fail-silent)", () => {
		const dir = freshStateDir();
		try {
			writeFileSync(join(dir, "state.json"), "{ not json");
			expect(readLastUploadAgeS(dir, Date.now())).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("ignores the empty-string 'never uploaded' sentinel", () => {
		const dir = freshStateDir();
		try {
			writeState(dir, ["", ""]);
			expect(readLastUploadAgeS(dir, Date.now())).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("takes the max (most recent) lastUploadedAt across entries", () => {
		const dir = freshStateDir();
		try {
			const now = Date.parse("2026-05-22T08:10:00.000Z");
			writeState(dir, [
				"2026-05-22T08:00:00.000Z", // 600s ago
				"2026-05-22T08:09:00.000Z", // 60s ago — the max
				"", // sentinel ignored
			]);
			expect(readLastUploadAgeS(dir, now)).toBe(60);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("skips a non-string lastUploadedAt (e.g. number/null) without throwing", () => {
		const dir = freshStateDir();
		try {
			writeFileSync(
				join(dir, "state.json"),
				JSON.stringify({
					"/abs/a.jsonl": { lastUploadedAt: 1716364200000 },
					"/abs/b.jsonl": { lastUploadedAt: null },
				}),
			);
			expect(readLastUploadAgeS(dir, Date.now())).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("skips an unparseable date string but keeps a valid sibling", () => {
		const dir = freshStateDir();
		try {
			const now = Date.parse("2026-05-22T08:10:00.000Z");
			writeFileSync(
				join(dir, "state.json"),
				JSON.stringify({
					"/abs/a.jsonl": { lastUploadedAt: "not-a-date" },
					"/abs/b.jsonl": { lastUploadedAt: "2026-05-22T08:09:00.000Z" }, // 60s ago
				}),
			);
			expect(readLastUploadAgeS(dir, now)).toBe(60);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("returns null when state.json is a JSON array (not an object map)", () => {
		const dir = freshStateDir();
		try {
			writeFileSync(join(dir, "state.json"), JSON.stringify([1, 2, 3]));
			// Object.values on an array yields its elements (non-objects) → no
			// usable entries → null, no throw.
			expect(readLastUploadAgeS(dir, Date.now())).toBeNull();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("clamps a future lastUploadedAt to age 0 (no negative ages)", () => {
		const dir = freshStateDir();
		try {
			const now = Date.parse("2026-05-22T08:00:00.000Z");
			writeState(dir, ["2026-05-22T08:05:00.000Z"]); // 5 min in the future
			expect(readLastUploadAgeS(dir, now)).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("probeSyncHealthSync — fs integration", () => {
	test("down when there is no pidfile", () => {
		const dir = freshStateDir();
		try {
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("down");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("down when the pidfile is non-numeric garbage", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, "not-a-pid");
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("down");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("down when the pidfile points at a valid-but-dead pid (stale pidfile — ENG-6157 outage shape)", () => {
		const dir = freshStateDir();
		try {
			// A daemon crashed/was killed without removing its pidfile; the PID
			// is a well-formed number whose process no longer exists. This is
			// exactly the silent-outage the live segment exists to surface.
			writePid(dir, String(deadButValidPid()));
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("down");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("down outranks auth — a dead daemon with a leftover needs-auth.flag still reads down", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(deadButValidPid()));
			writeFlag(dir);
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("down");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("ok when daemon alive, no flag, no uploads yet", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(process.pid));
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("ok");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("auth when daemon alive but needs-auth.flag present", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(process.pid));
			writeFlag(dir);
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("auth");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("ok when daemon alive and a recent upload exists", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(process.pid));
			const now = Date.parse("2026-05-22T08:10:00.000Z");
			writeState(dir, ["2026-05-22T08:09:00.000Z"]); // 60s ago
			expect(probeSyncHealthSync({ stateDir: dir, now }).state).toBe("ok");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("stale when daemon alive but last upload is old, and carries the age through", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(process.pid));
			const now = Date.parse("2026-05-22T08:30:00.000Z");
			writeState(dir, ["2026-05-22T08:00:00.000Z"]); // 1800s ago
			const h = probeSyncHealthSync({ stateDir: dir, now });
			expect(h.state).toBe("stale");
			// The statusline renders `h.lastUploadAgeS` ("stale 30m"); pin that
			// the probe surfaces the age rather than nulling it out.
			expect(h.lastUploadAgeS).toBe(1800);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("malformed state.json never breaks the probe (alive ⇒ ok)", () => {
		const dir = freshStateDir();
		try {
			writePid(dir, String(process.pid));
			writeFileSync(join(dir, "state.json"), "{ corrupt");
			expect(probeSyncHealthSync({ stateDir: dir }).state).toBe("ok");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
