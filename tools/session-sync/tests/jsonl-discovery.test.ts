import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSubagentFiles } from "../../lib/jsonl-discovery.ts";

describe("discoverSubagentFiles (shared with conversation-watcher)", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "subagent-discovery-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("flat layout: agent-*.jsonl in same dir as parent", async () => {
		const sessionId = "abc-123";
		const parentPath = join(dir, `${sessionId}.jsonl`);
		writeFileSync(parentPath, "");
		writeFileSync(join(dir, "agent-a.jsonl"), "");
		writeFileSync(join(dir, "agent-b.jsonl"), "");
		writeFileSync(join(dir, "other.jsonl"), "");

		const found = await discoverSubagentFiles(parentPath);
		expect(found.sort()).toEqual(
			[join(dir, "agent-a.jsonl"), join(dir, "agent-b.jsonl")].sort(),
		);
	});

	test("nested layout: {session-uuid}/subagents/agent-*.jsonl", async () => {
		const sessionId = "abc-123";
		const parentPath = join(dir, `${sessionId}.jsonl`);
		writeFileSync(parentPath, "");
		const nested = join(dir, sessionId, "subagents");
		mkdirSync(nested, { recursive: true });
		writeFileSync(join(nested, "agent-x.jsonl"), "");

		const found = await discoverSubagentFiles(parentPath);
		expect(found).toEqual([join(nested, "agent-x.jsonl")]);
	});

	test("no subagents → empty array", async () => {
		const parentPath = join(dir, "lonely.jsonl");
		writeFileSync(parentPath, "");
		expect(await discoverSubagentFiles(parentPath)).toEqual([]);
	});
});
