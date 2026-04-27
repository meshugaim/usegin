/**
 * Unit tests for the cross-surface ENG-ID link transform (D4).
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";

import {
	autoLinkEngIds,
	autoLinkEngIdsFromEnv,
	extractEngIds,
	getLinearOrgUrl,
} from "./links";

describe("autoLinkEngIds", () => {
	test("wraps a free-standing ENG-id", () => {
		const out = autoLinkEngIds("see ENG-1234 for context");
		expect(out).toBe(
			"see <https://linear.app/askeffi/issue/ENG-1234|ENG-1234> for context",
		);
	});

	test("wraps multiple ENG-ids in one body", () => {
		const out = autoLinkEngIds("ENG-1 blocks ENG-2; ENG-3 unblocks");
		expect(out).toBe(
			"<https://linear.app/askeffi/issue/ENG-1|ENG-1>" +
				" blocks " +
				"<https://linear.app/askeffi/issue/ENG-2|ENG-2>" +
				"; " +
				"<https://linear.app/askeffi/issue/ENG-3|ENG-3>" +
				" unblocks",
		);
	});

	test("is idempotent — running twice produces the same output", () => {
		const once = autoLinkEngIds("ENG-1 lands");
		const twice = autoLinkEngIds(once);
		expect(twice).toBe(once);
	});

	test("does not match a longer alpha prefix (ENGRAM-1)", () => {
		const out = autoLinkEngIds("ENGRAM-1 is unrelated");
		expect(out).toBe("ENGRAM-1 is unrelated");
	});

	test("does not double-link an ID inside an already-linked block", () => {
		const input =
			"<https://linear.app/askeffi/issue/ENG-99|ENG-99> already linked";
		const out = autoLinkEngIds(input);
		expect(out).toBe(input);
	});

	test("respects a custom org URL via options", () => {
		const out = autoLinkEngIds("ENG-7", {
			orgUrl: "https://linear.app/example",
		});
		expect(out).toBe(
			"<https://linear.app/example/issue/ENG-7|ENG-7>",
		);
	});

	test("normalizes a trailing slash on the org URL", () => {
		const out = autoLinkEngIds("ENG-7", {
			orgUrl: "https://linear.app/example/",
		});
		expect(out).toBe(
			"<https://linear.app/example/issue/ENG-7|ENG-7>",
		);
	});

	test("does not match alphanumerically-suffixed IDs (ENG-12abc)", () => {
		const out = autoLinkEngIds("ENG-12abc shouldn't match");
		expect(out).toBe("ENG-12abc shouldn't match");
	});

	test("returns empty string for empty input", () => {
		expect(autoLinkEngIds("")).toBe("");
	});
});

describe("extractEngIds", () => {
	test("returns empty array for body with no IDs", () => {
		expect(extractEngIds("nothing here")).toEqual([]);
	});

	test("returns empty array for empty input", () => {
		expect(extractEngIds("")).toEqual([]);
	});

	test("extracts a single ID", () => {
		expect(extractEngIds("see ENG-1234")).toEqual(["ENG-1234"]);
	});

	test("dedupes repeated IDs", () => {
		expect(extractEngIds("ENG-1 then ENG-1 again")).toEqual(["ENG-1"]);
	});

	test("preserves first-occurrence order", () => {
		expect(extractEngIds("ENG-3 ENG-1 ENG-2 ENG-1")).toEqual([
			"ENG-3",
			"ENG-1",
			"ENG-2",
		]);
	});

	test("catches IDs already inside Slack mrkdwn link wrappers", () => {
		expect(
			extractEngIds(
				"see <https://linear.app/askeffi/issue/ENG-99|ENG-99> for more",
			),
		).toEqual(["ENG-99"]);
	});

	test("skips longer alpha prefix (ENGRAM-1)", () => {
		expect(extractEngIds("ENGRAM-1 isn't ours")).toEqual([]);
	});

	test("skips alphanumeric suffix (ENG-12abc)", () => {
		expect(extractEngIds("ENG-12abc shouldn't match")).toEqual([]);
	});
});

describe("getLinearOrgUrl + autoLinkEngIdsFromEnv", () => {
	const ORIGINAL = process.env.LINEAR_ORG_URL;

	beforeEach(() => {
		delete process.env.LINEAR_ORG_URL;
	});

	afterEach(() => {
		if (ORIGINAL === undefined) {
			delete process.env.LINEAR_ORG_URL;
		} else {
			process.env.LINEAR_ORG_URL = ORIGINAL;
		}
	});

	test("getLinearOrgUrl falls back to the default when env is unset", () => {
		expect(getLinearOrgUrl({})).toBe("https://linear.app/askeffi");
	});

	test("getLinearOrgUrl returns env value when set", () => {
		expect(getLinearOrgUrl({ LINEAR_ORG_URL: "https://linear.app/x" })).toBe(
			"https://linear.app/x",
		);
	});

	test("getLinearOrgUrl ignores whitespace-only env value", () => {
		expect(getLinearOrgUrl({ LINEAR_ORG_URL: "   " })).toBe(
			"https://linear.app/askeffi",
		);
	});

	test("autoLinkEngIdsFromEnv reads the configured org URL", () => {
		process.env.LINEAR_ORG_URL = "https://linear.app/foo";
		const out = autoLinkEngIdsFromEnv("ENG-9");
		expect(out).toBe("<https://linear.app/foo/issue/ENG-9|ENG-9>");
	});
});
