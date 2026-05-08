import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PerFileStateSchema,
	readState,
	StateFileSchema,
	writeState,
} from "../src/state.ts";

describe("state schema + IO", () => {
	let dir: string;
	let path: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "session-sync-state-"));
		path = join(dir, "state.json");
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("readState on missing file returns {}", async () => {
		expect(await readState(path)).toEqual({});
	});

	test("round-trip: writeState then readState yields identical state", async () => {
		const state = {
			"/home/u/.claude/projects/abc/sess-1.jsonl": {
				contentHash:
					"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
				lastUploadedSize: 1234,
				sessionId: "sess-1",
				storagePath: "u-uid/2026-05-08/sess-1.jsonl.gz",
				lastUploadedAt: "2026-05-08T12:00:00.000Z",
			},
		};
		await writeState(path, state);
		expect(await readState(path)).toEqual(state);
	});

	test("nextRetryAt is optional (set on 503 backoff per AC 45)", async () => {
		const state = {
			"/home/u/.claude/projects/abc/sess-2.jsonl": {
				contentHash: "a".repeat(64),
				lastUploadedSize: 0,
				sessionId: "sess-2",
				storagePath: "u-uid/2026-05-08/sess-2.jsonl.gz",
				lastUploadedAt: "2026-05-08T12:00:00.000Z",
				nextRetryAt: "2026-05-08T12:05:00.000Z",
			},
		};
		await writeState(path, state);
		expect(await readState(path)).toEqual(state);
	});

	test("write is atomic — no .tmp leftover after success", async () => {
		await writeState(path, {});
		const entries = readdirSync(dir);
		// Only state.json itself; no `.tmp` siblings left behind.
		expect(entries).toEqual(["state.json"]);
	});

	test("readState on malformed JSON throws (loud signal, no silent overwrite)", async () => {
		writeFileSync(path, "{not-json}");
		await expect(readState(path)).rejects.toThrow();
	});

	test("schema rejects unknown fields strictly (forward-compat tripwire)", () => {
		const result = PerFileStateSchema.safeParse({
			contentHash: "x".repeat(64),
			lastUploadedSize: 0,
			sessionId: "s",
			storagePath: "p",
			lastUploadedAt: "2026-05-08T12:00:00.000Z",
			unknownField: "nope",
		});
		expect(result.success).toBe(false);
	});

	test("StateFileSchema accepts an empty object", () => {
		expect(StateFileSchema.safeParse({}).success).toBe(true);
	});
});
