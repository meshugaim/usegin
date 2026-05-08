import { describe, expect, test } from "bun:test";
import { IdleDebouncer } from "../src/debounce.ts";

describe("IdleDebouncer", () => {
	test("notify then check before threshold → not idle", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		expect(d.isIdle("a", 1500, 1000)).toBe(false);
	});

	test("notify then check at exactly threshold → idle", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		expect(d.isIdle("a", 2000, 1000)).toBe(true);
	});

	test("notify then check after threshold → idle", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		expect(d.isIdle("a", 5000, 1000)).toBe(true);
	});

	test("multiple notifies advance the last-activity time", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		d.notify("a", 1500);
		expect(d.isIdle("a", 2400, 1000)).toBe(false);
		expect(d.isIdle("a", 2500, 1000)).toBe(true);
	});

	test("per-key isolation", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		d.notify("b", 5000);
		expect(d.isIdle("a", 2500, 1000)).toBe(true);
		expect(d.isIdle("b", 2500, 1000)).toBe(false);
	});

	test("never-notified key is idle by definition", () => {
		const d = new IdleDebouncer<string>();
		expect(d.isIdle("nope", 1000, 1000)).toBe(true);
	});

	test("forget(key) drops the activity record", () => {
		const d = new IdleDebouncer<string>();
		d.notify("a", 1000);
		d.forget("a");
		// After forget, idle by definition.
		expect(d.isIdle("a", 1100, 1000)).toBe(true);
	});
});
