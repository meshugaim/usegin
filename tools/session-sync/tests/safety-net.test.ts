import { describe, expect, test } from "bun:test";
import { safetyNetTick } from "../src/safety-net.ts";
import type { StateFile } from "../src/state.ts";

const NOW = new Date("2026-05-08T12:00:00.000Z");
const PATH_A = "/home/u/.claude/projects/-x/sess-A.jsonl";
const PATH_B = "/home/u/.claude/projects/-x/sess-B.jsonl";

describe("safetyNetTick", () => {
	test("retry-due: nextRetryAt at-or-past now → emitted", async () => {
		const past = new Date(NOW.getTime() - 1000).toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "",
				nextRetryAt: past,
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 100,
			now: NOW,
		});
		expect(items).toEqual([
			{ path: PATH_A, sessionId: "A", reason: "retry-due" },
		]);
	});

	test("retry-due boundary: nextRetryAt === now → emitted (<=)", async () => {
		const exact = NOW.toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "",
				nextRetryAt: exact,
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 100,
			now: NOW,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.reason).toBe("retry-due");
	});

	test("retry-due in future → not emitted", async () => {
		const future = new Date(NOW.getTime() + 60_000).toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "",
				nextRetryAt: future,
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 100,
			now: NOW,
		});
		expect(items).toEqual([]);
	});

	test("stale-since-last-tick: file size changed but no event fired", async () => {
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async (p) => (p === PATH_A ? 250 : 0),
			now: NOW,
		});
		expect(items).toEqual([
			{ path: PATH_A, sessionId: "A", reason: "stale-since-last-tick" },
		]);
	});

	test("stale: same size as state → not emitted", async () => {
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 100,
			now: NOW,
		});
		expect(items).toEqual([]);
	});

	test("lastUploadedAt = '' sentinel: never new Date('')", async () => {
		// State row from a kill-switch never-uploaded path; nextRetryAt
		// in the past → emit retry-due. The bug we're guarding against
		// would `new Date("")` and produce NaN.
		const past = new Date(NOW.getTime() - 1000).toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "",
				lastUploadedSize: 0,
				sessionId: "A",
				storagePath: "",
				lastUploadedAt: "",
				nextRetryAt: past,
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 100,
			now: NOW,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.reason).toBe("retry-due");
	});

	test("retry-due takes precedence over stale (single emission)", async () => {
		const past = new Date(NOW.getTime() - 1000).toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
				nextRetryAt: past,
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 250, // also "grew"
			now: NOW,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.reason).toBe("retry-due");
	});

	test("multiple sessions: independent classification", async () => {
		const past = new Date(NOW.getTime() - 1000).toISOString();
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "",
				nextRetryAt: past,
			},
			[PATH_B]: {
				contentHash: "h2",
				lastUploadedSize: 50,
				sessionId: "B",
				storagePath: "p2",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A, PATH_B],
			fileSizeFn: async (p) => (p === PATH_B ? 80 : 100),
			now: NOW,
		});
		expect(items).toHaveLength(2);
		const byPath = Object.fromEntries(items.map((i) => [i.path, i.reason]));
		expect(byPath[PATH_A]).toBe("retry-due");
		expect(byPath[PATH_B]).toBe("stale-since-last-tick");
	});

	test("stale: file shrank → not emitted (truncation isn't growth)", async () => {
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: "A",
				storagePath: "p",
				lastUploadedAt: "2026-05-08T11:00:00.000Z",
			},
		};
		const items = await safetyNetTick({
			state,
			candidatePaths: [PATH_A],
			fileSizeFn: async () => 50,
			now: NOW,
		});
		expect(items).toEqual([]);
	});
});
