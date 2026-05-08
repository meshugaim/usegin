import { describe, expect, test } from "bun:test";
import { computeNextRetryAt, isInBackoff } from "../src/backoff.ts";
import type { PerFileState } from "../src/state.ts";

const baseState: PerFileState = {
	contentHash: "x".repeat(64),
	lastUploadedSize: 0,
	sessionId: "s",
	storagePath: "p",
	lastUploadedAt: "2026-05-08T12:00:00.000Z",
};

describe("computeNextRetryAt", () => {
	test("returns ISO string of (now + intervalMs)", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const out = computeNextRetryAt(now, 5 * 60 * 1000);
		expect(out).toBe("2026-05-08T12:05:00.000Z");
	});
});

describe("isInBackoff", () => {
	test("no nextRetryAt → not in backoff", () => {
		expect(isInBackoff(baseState, new Date("2026-05-08T12:00:00.000Z"))).toBe(
			false,
		);
	});

	test("nextRetryAt > now → in backoff", () => {
		const state: PerFileState = {
			...baseState,
			nextRetryAt: "2026-05-08T12:05:00.000Z",
		};
		expect(isInBackoff(state, new Date("2026-05-08T12:00:00.000Z"))).toBe(true);
	});

	test("nextRetryAt === now → NOT in backoff (boundary is open)", () => {
		const state: PerFileState = {
			...baseState,
			nextRetryAt: "2026-05-08T12:05:00.000Z",
		};
		expect(isInBackoff(state, new Date("2026-05-08T12:05:00.000Z"))).toBe(
			false,
		);
	});

	test("nextRetryAt < now → not in backoff", () => {
		const state: PerFileState = {
			...baseState,
			nextRetryAt: "2026-05-08T12:05:00.000Z",
		};
		expect(isInBackoff(state, new Date("2026-05-08T12:10:00.000Z"))).toBe(
			false,
		);
	});
});
