import { describe, expect, test } from "bun:test";
import { Coalescer } from "../src/coalescer.ts";

const PATH_A = "/home/u/.claude/projects/-x/sess-A.jsonl";
const PATH_B = "/home/u/.claude/projects/-x/sess-B.jsonl";

describe("Coalescer", () => {
	test("notify then takeReady before threshold returns empty", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		expect(c.takeReady(1500, 1000)).toEqual([]);
		expect(c.pendingCount()).toBe(1);
	});

	test("notify then takeReady at-or-past threshold returns the entry", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		// >= threshold is "ready" (matches debounce.ts isIdle convention).
		const ready = c.takeReady(2000, 1000);
		expect(ready).toEqual([
			{ sessionId: "A", path: PATH_A, lastEventAt: 1000 },
		]);
	});

	test("takeReady removes ready entries (second call empty)", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		c.takeReady(2000, 1000);
		expect(c.takeReady(3000, 1000)).toEqual([]);
		expect(c.pendingCount()).toBe(0);
	});

	test("subsequent notify advances lastEventAt (debounce reset)", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		c.notify({ path: PATH_A, sessionId: "A", time: 1500 });
		// At now=2000, would be 1000ms past first event but only 500ms past last.
		expect(c.takeReady(2000, 1000)).toEqual([]);
		expect(c.takeReady(2500, 1000)).toEqual([
			{ sessionId: "A", path: PATH_A, lastEventAt: 1500 },
		]);
	});

	test("per-session isolation: notifying A doesn't mark B ready", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		c.notify({ path: PATH_B, sessionId: "B", time: 1500 });
		const ready = c.takeReady(2200, 1000);
		expect(ready).toEqual([
			{ sessionId: "A", path: PATH_A, lastEventAt: 1000 },
		]);
		expect(c.pendingCount()).toBe(1); // B still pending
	});

	test("threshold boundary: now == lastEventAt + threshold is ready (>=)", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		// 2000 - 1000 == 1000; >= 1000 → ready.
		expect(c.takeReady(2000, 1000)).toHaveLength(1);
	});

	test("out-of-order notify (older time) does not regress lastEventAt", () => {
		const c = new Coalescer();
		c.notify({ path: PATH_A, sessionId: "A", time: 1500 });
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		// At now=2400, gap from 1500 is 900 (not ready); from 1000 would be 1400.
		expect(c.takeReady(2400, 1000)).toEqual([]);
		expect(c.takeReady(2500, 1000)).toEqual([
			{ sessionId: "A", path: PATH_A, lastEventAt: 1500 },
		]);
	});

	test("pendingCount reflects state through lifecycle", () => {
		const c = new Coalescer();
		expect(c.pendingCount()).toBe(0);
		c.notify({ path: PATH_A, sessionId: "A", time: 1000 });
		c.notify({ path: PATH_B, sessionId: "B", time: 1000 });
		expect(c.pendingCount()).toBe(2);
		c.takeReady(5000, 1000);
		expect(c.pendingCount()).toBe(0);
	});
});
