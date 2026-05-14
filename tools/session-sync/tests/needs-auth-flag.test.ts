/**
 * Tests for `needs-auth-flag.ts` (ENG-5990, T6a/T6b/T7/T8/T18).
 *
 * Real-fs tmpdir per test. Pins the shape, atomicity, delete idempotence,
 * and `updateFlag` invariant (preserve `since`, advance `lastCheckedAt`).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	deleteFlag,
	type NeedsAuthFlag,
	readFlag,
	updateFlag,
	writeFlag,
} from "../src/needs-auth-flag.ts";

describe("needs-auth-flag I/O", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "needs-auth-flag-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("writeFlag + readFlag round-trip yields identical payload (T6a)", async () => {
		const flag: NeedsAuthFlag = {
			since: "2026-05-14T09:42:38.598Z",
			lastCheckedAt: "2026-05-14T09:42:38.598Z",
			errorClass: "expired_refresh_token",
			errorMessage: "session-sync: dev-login token is expired.",
		};
		await writeFlag(dir, flag);
		expect(await readFlag(dir)).toEqual(flag);
	});

	test("writeFlag is atomic — no .tmp leftover after success (T6b)", async () => {
		await writeFlag(dir, {
			since: "2026-05-14T09:42:38.598Z",
			lastCheckedAt: "2026-05-14T09:42:38.598Z",
			errorClass: "missing_credentials",
			errorMessage: "missing",
		});
		const entries = readdirSync(dir);
		expect(entries).toEqual(["needs-auth.flag"]);
	});

	test("readFlag on missing file returns null (T14 pre-seed precondition)", async () => {
		expect(await readFlag(dir)).toBeNull();
	});

	test("readFlag on malformed JSON returns null (forward-compat)", async () => {
		const path = join(dir, "needs-auth.flag");
		// Write garbage directly — simulates a torn write from a prior crash.
		const { writeFileSync } = await import("node:fs");
		writeFileSync(path, "{not-json}");
		expect(await readFlag(dir)).toBeNull();
	});

	test("deleteFlag removes the file; idempotent when already absent (T7)", async () => {
		await writeFlag(dir, {
			since: "2026-05-14T09:42:38.598Z",
			lastCheckedAt: "2026-05-14T09:42:38.598Z",
			errorClass: "401_from_api",
			errorMessage: "401",
		});
		expect(existsSync(join(dir, "needs-auth.flag"))).toBe(true);
		await deleteFlag(dir);
		expect(existsSync(join(dir, "needs-auth.flag"))).toBe(false);
		// Second delete: no throw.
		await deleteFlag(dir);
		expect(existsSync(join(dir, "needs-auth.flag"))).toBe(false);
	});

	test("updateFlag preserves `since`, advances `lastCheckedAt` (T8)", async () => {
		await writeFlag(dir, {
			since: "2026-05-14T09:42:38.598Z",
			lastCheckedAt: "2026-05-14T09:42:38.598Z",
			errorClass: "expired_refresh_token",
			errorMessage: "initial",
		});
		await updateFlag(dir, {
			lastCheckedAt: "2026-05-14T09:51:02.103Z",
			errorClass: "expired_refresh_token",
			errorMessage: "second attempt",
		});
		const after = await readFlag(dir);
		expect(after?.since).toBe("2026-05-14T09:42:38.598Z");
		expect(after?.lastCheckedAt).toBe("2026-05-14T09:51:02.103Z");
		expect(after?.errorMessage).toBe("second attempt");
	});

	test("repeated writeFlag never leaves a torn file (atomicity, T6b)", async () => {
		// Tight interleaved loop — only the post-conditions matter: every
		// observable state is a fully-formed JSON payload.
		const writes: Promise<void>[] = [];
		for (let i = 0; i < 8; i++) {
			writes.push(
				writeFlag(dir, {
					since: "2026-05-14T09:42:38.598Z",
					lastCheckedAt: `2026-05-14T09:5${i}:00.000Z`,
					errorClass: "expired_refresh_token",
					errorMessage: `attempt ${i}`,
				}),
			);
		}
		await Promise.all(writes);
		const raw = readFileSync(join(dir, "needs-auth.flag"), "utf8");
		const parsed = JSON.parse(raw);
		expect(parsed.since).toBe("2026-05-14T09:42:38.598Z");
	});
});
