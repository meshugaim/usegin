/**
 * Wire-field-name pin for `performForkAndInitialSync` (Ron-8-red S1, ENG-5862).
 *
 * The Red `resume.test.ts` mocks `./resume-fork`, so the wire shape its POST
 * emits is invisible to that file. But the server contract is precise:
 * `validateSyncMetadata` (and the `syncSession` upsert) on the route side
 * accept `parent_session_id` and `forked_at_turn` as **snake_case** fields.
 * A future refactor that accidentally camelCases them (`parentSessionId`,
 * `forkedAtTurn`) would silently drop the lineage without failing any
 * existing test — the route returns 200 because the fields are optional.
 *
 * This test pins the wire shape from the orchestrator side: drive
 * `performForkAndInitialSync` against a mocked `globalThis.fetch` and
 * assert the `metadata` part of the multipart body contains the snake_case
 * keys and does NOT contain camelCase variants.
 *
 * Linear: ENG-5862
 */

import { afterEach, describe, expect, test } from "bun:test";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { extractMetadata } from "../../../session-sync/src/extractor.ts";

const ORIGINAL_ID = "11111111-2222-3333-4444-555555555555";

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("performForkAndInitialSync wire shape (Ron-8-red S1)", () => {
	test("POSTs metadata with snake_case parent_session_id + forked_at_turn", async () => {
		const sourceDir = join(tmpdir(), `fork-wire-test-${crypto.randomUUID()}`);
		await mkdir(sourceDir, { recursive: true });
		const sourcePath = join(sourceDir, `${ORIGINAL_ID}.jsonl`);
		// 4 user + 3 assistant = 7 turns. The orchestrator threads
		// `sourceMetadata.turn_count` into `forked_at_turn`, so this
		// fixture's turn shape is what the wire-field pin below asserts.
		const sourceLines = [
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "user", text: "u1" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "assistant" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "user", text: "u2" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "assistant" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "user", text: "u3" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "assistant" }),
			JSON.stringify({ sessionId: ORIGINAL_ID, type: "user", text: "u4" }),
			"",
		];
		await writeFile(sourcePath, sourceLines.join("\n"));
		const sourceMetadata = extractMetadata(sourceLines.join("\n"));
		// Sanity-pin the fixture: any drift in the line shape that breaks
		// turn-count extraction is caught here, not in the wire-field
		// assertion below where the failure mode would be more confusing.
		expect(sourceMetadata.turn_count).toBe(7);

		let capturedMetadataJson: string | null = null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		globalThis.fetch = (async (
			_input: string | URL | Request,
			init?: RequestInit,
		) => {
			const body = init?.body;
			if (body instanceof FormData) {
				const metaPart = body.get("metadata");
				if (typeof metaPart === "string") capturedMetadataJson = metaPart;
			}
			return new Response(
				JSON.stringify({ session: { session_id: "any" } }),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as never;

		// Lazy-import so the mocked fetch is installed before
		// performForkAndInitialSync's transitive imports resolve.
		const { performForkAndInitialSync } = await import("./resume-fork");

		const outcome = await performForkAndInitialSync({
			apiUrl: "http://localhost:63000",
			token: "test-token",
			originalSessionId: ORIGINAL_ID,
			originalLocalPath: sourcePath,
			sourceMetadata,
			environmentKind: "local-devcontainer",
			environmentId: "env-test",
			username: "tester@askeffi.ai",
			projectPath: "/some/project",
		});

		expect(outcome.ok).toBe(true);
		expect(capturedMetadataJson).not.toBeNull();
		const meta = JSON.parse(capturedMetadataJson ?? "{}") as Record<
			string,
			unknown
		>;

		// Snake_case wire-field pins — exact key names, exact value shapes.
		expect(meta.parent_session_id).toBe(ORIGINAL_ID);
		expect(meta.forked_at_turn).toBe(7);

		// camelCase variants MUST NOT be present (would cause the server to
		// silently drop the field).
		expect(meta).not.toHaveProperty("parentSessionId");
		expect(meta).not.toHaveProperty("forkedAtTurn");

		await rm(sourceDir, { recursive: true, force: true });
	});
});
