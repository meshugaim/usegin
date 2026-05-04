/**
 * Sanity tests for the static registry.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import { EXPECTED_REAL_TEAM_ID, ZISSER_CHANNELS } from "./registry";

describe("ZISSER_CHANNELS", () => {
	it("exposes outbox/alerts/log keys", () => {
		expect(ZISSER_CHANNELS.outbox).toBe("#zisser-out");
		expect(ZISSER_CHANNELS.alerts).toBe("#zisser-alerts");
		expect(ZISSER_CHANNELS.log).toBe("#zisser-log");
	});

	it("all entries start with '#'", () => {
		for (const v of Object.values(ZISSER_CHANNELS)) {
			expect(v.startsWith("#")).toBe(true);
		}
	});
});

describe("EXPECTED_REAL_TEAM_ID", () => {
	it("matches the AskEffi workspace shape (Txxxxx)", () => {
		expect(EXPECTED_REAL_TEAM_ID).toMatch(/^T[A-Z0-9]+$/);
	});
});
