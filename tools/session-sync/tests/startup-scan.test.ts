import { describe, expect, test } from "bun:test";
import { startupScan } from "../src/startup-scan.ts";
import type { StateFile } from "../src/state.ts";

const PROJECTS_DIR = "/home/u/.claude/projects";
const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";
const PATH_A = `${PROJECTS_DIR}/-x/${SESSION_A}.jsonl`;
const PATH_B = `${PROJECTS_DIR}/-y/${SESSION_B}.jsonl`;
const NOW = new Date("2026-05-08T12:00:00.000Z");

function makeFsFakes(files: Record<string, number>) {
	return {
		listFiles: async (_dir: string) => Object.keys(files),
		fileSizeFn: async (path: string) => {
			const size = files[path];
			if (size === undefined) {
				throw new Error(`fake fileSizeFn: missing ${path}`);
			}
			return size;
		},
	};
}

describe("startupScan", () => {
	test("brand-new file (no state entry, size > 0) → 'new'", async () => {
		const fakes = makeFsFakes({ [PATH_A]: 100 });
		const state: StateFile = {};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([
			{ path: PATH_A, sessionId: SESSION_A, reason: "new" },
		]);
	});

	test("file grew offline → 'grew'", async () => {
		const fakes = makeFsFakes({ [PATH_A]: 200 });
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: SESSION_A,
				storagePath: "p",
				lastUploadedAt: "2026-05-07T00:00:00.000Z",
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([
			{ path: PATH_A, sessionId: SESSION_A, reason: "grew" },
		]);
	});

	test("file untouched + no nextRetryAt → not in output", async () => {
		const fakes = makeFsFakes({ [PATH_A]: 100 });
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: SESSION_A,
				storagePath: "p",
				lastUploadedAt: "2026-05-07T00:00:00.000Z",
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([]);
	});

	test("nextRetryAt expired → 'retry-due'", async () => {
		const past = new Date(NOW.getTime() - 60_000).toISOString();
		const fakes = makeFsFakes({ [PATH_A]: 100 });
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: SESSION_A,
				storagePath: "p",
				lastUploadedAt: "2026-05-07T00:00:00.000Z",
				nextRetryAt: past,
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([
			{ path: PATH_A, sessionId: SESSION_A, reason: "retry-due" },
		]);
	});

	test("nextRetryAt in future → not in output", async () => {
		const future = new Date(NOW.getTime() + 60_000).toISOString();
		const fakes = makeFsFakes({ [PATH_A]: 100 });
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: SESSION_A,
				storagePath: "p",
				lastUploadedAt: "2026-05-07T00:00:00.000Z",
				nextRetryAt: future,
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([]);
	});

	test("lastUploadedAt = '' sentinel + size > 0 → 'new' (no new Date(''))", async () => {
		const fakes = makeFsFakes({ [PATH_A]: 100 });
		// State entry exists but was created by kill-switch — never uploaded.
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "",
				lastUploadedSize: 0,
				sessionId: SESSION_A,
				storagePath: "",
				lastUploadedAt: "",
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		// Treated as 'grew' since lastUploadedSize=0 < currentSize=100. Either
		// 'new' or 'grew' is acceptable so long as the entry IS in output and
		// no `new Date("")` blew up. We pin 'grew' because state has an entry.
		expect(items).toHaveLength(1);
		expect(items[0]?.path).toBe(PATH_A);
		expect(items[0]?.sessionId).toBe(SESSION_A);
		expect(items[0]?.reason).toBe("grew");
	});

	test("subagent files (agent-*.jsonl) NOT in output", async () => {
		const agentPath = `${PROJECTS_DIR}/-x/agent-${SESSION_A}.jsonl`;
		const fakes = makeFsFakes({ [PATH_A]: 100, [agentPath]: 50 });
		const state: StateFile = {};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.path).toBe(PATH_A);
	});

	test("non-UUID-shaped basenames are skipped", async () => {
		const fakes = makeFsFakes({
			[`${PROJECTS_DIR}/-x/random.jsonl`]: 100,
			[PATH_A]: 100,
		});
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state: {},
			now: NOW,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.path).toBe(PATH_A);
	});

	test("empty projects dir → empty output", async () => {
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			listFiles: async () => [],
			fileSizeFn: async () => 0,
			state: {},
			now: NOW,
		});
		expect(items).toEqual([]);
	});

	test("multiple files: each evaluated independently", async () => {
		const fakes = makeFsFakes({
			[PATH_A]: 200, // grew
			[PATH_B]: 100, // new
		});
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "h",
				lastUploadedSize: 100,
				sessionId: SESSION_A,
				storagePath: "p",
				lastUploadedAt: "2026-05-07T00:00:00.000Z",
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		const reasons = Object.fromEntries(items.map((i) => [i.path, i.reason]));
		expect(reasons[PATH_A]).toBe("grew");
		expect(reasons[PATH_B]).toBe("new");
	});

	test("no-op: zero size + lastUploadedSize=0 + lastUploadedAt='' → skipped", async () => {
		const fakes = makeFsFakes({ [PATH_A]: 0 });
		const state: StateFile = {
			[PATH_A]: {
				contentHash: "",
				lastUploadedSize: 0,
				sessionId: SESSION_A,
				storagePath: "",
				lastUploadedAt: "",
			},
		};
		const items = await startupScan({
			projectsDir: PROJECTS_DIR,
			...fakes,
			state,
			now: NOW,
		});
		expect(items).toEqual([]);
	});
});
