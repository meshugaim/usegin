import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __setFsyncSpy, getOrCreateInstallId } from "../src/install-id.ts";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("getOrCreateInstallId", () => {
	let stateDir: string;

	beforeEach(() => {
		stateDir = mkdtempSync(join(tmpdir(), "install-id-test-"));
	});

	afterEach(() => {
		__setFsyncSpy(null);
		rmSync(stateDir, { recursive: true, force: true });
	});

	test("first call generates a UUIDv4 and persists it", async () => {
		const id = await getOrCreateInstallId(stateDir);
		expect(id).toMatch(UUID_V4_REGEX);

		const onDisk = readFileSync(join(stateDir, "install-id"), "utf8");
		expect(onDisk.trim()).toBe(id);
	});

	test("second call reads the existing id without regenerating", async () => {
		const first = await getOrCreateInstallId(stateDir);
		const second = await getOrCreateInstallId(stateDir);
		expect(second).toBe(first);
	});

	test("concurrent first calls do not generate two ids", async () => {
		const [a, b, c] = await Promise.all([
			getOrCreateInstallId(stateDir),
			getOrCreateInstallId(stateDir),
			getOrCreateInstallId(stateDir),
		]);
		expect(a).toBe(b);
		expect(b).toBe(c);
		const onDisk = readFileSync(join(stateDir, "install-id"), "utf8");
		expect(onDisk.trim()).toBe(a);
	});

	test("the install-id file is fsync'd before the function returns", async () => {
		// Invariant pinned by the spec (AC 19): the daemon must never POST
		// with an empty environment_id, so the install-id must hit the
		// platter before the function resolves. We assert this by spying
		// on the fsync hook and recording whether it ran *before* resolve.
		const events: string[] = [];
		__setFsyncSpy(() => {
			events.push("fsync");
		});

		const id = await getOrCreateInstallId(stateDir);
		events.push("resolved");

		expect(id).toMatch(UUID_V4_REGEX);
		expect(events).toEqual(["fsync", "resolved"]);
	});

	test("fsync is NOT called when reading an existing id (no write happened)", async () => {
		await getOrCreateInstallId(stateDir);

		let fsyncCalls = 0;
		__setFsyncSpy(() => {
			fsyncCalls += 1;
		});

		await getOrCreateInstallId(stateDir);
		expect(fsyncCalls).toBe(0);
	});
});
