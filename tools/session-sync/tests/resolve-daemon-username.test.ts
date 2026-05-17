/**
 * Resolution policy for the daemon's `username` field (ENG-6040).
 *
 * Three priorities tested below — dx wins, env.USER fallback when dx
 * returns null, env.USER fallback when dx throws (config not reachable),
 * "unknown" sentinel when everything is missing.
 */
import { describe, expect, test } from "bun:test";
import { resolveDaemonUsername } from "../src/username.ts";

describe("resolveDaemonUsername", () => {
	test("returns dx.resolveUser() when set", () => {
		const out = resolveDaemonUsername({ USER: "vscode" }, () => "lihu");
		expect(out).toBe("lihu");
	});

	test("falls back to env.USER when dx returns null", () => {
		const out = resolveDaemonUsername({ USER: "vscode" }, () => null);
		expect(out).toBe("vscode");
	});

	test("falls back to env.USER when dx throws (e.g., no .dx/config.json)", () => {
		const out = resolveDaemonUsername({ USER: "vscode" }, () => {
			throw new Error("dx: could not find .dx/config.json");
		});
		expect(out).toBe("vscode");
	});

	test("falls back to env.USERNAME when env.USER is missing", () => {
		const out = resolveDaemonUsername({ USERNAME: "winuser" }, () => null);
		expect(out).toBe("winuser");
	});

	test("returns 'unknown' when nothing is available", () => {
		const out = resolveDaemonUsername({}, () => null);
		expect(out).toBe("unknown");
	});

	test("treats empty-string dx result as not-found and falls back", () => {
		const out = resolveDaemonUsername({ USER: "vscode" }, () => "");
		expect(out).toBe("vscode");
	});
});
