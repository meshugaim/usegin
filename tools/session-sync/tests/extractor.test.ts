import { describe, expect, test } from "bun:test";
import { extractMetadata } from "../src/extractor.ts";

function jsonl(lines: object[]): string {
	return lines.map((l) => JSON.stringify(l)).join("\n");
}

describe("extractMetadata", () => {
	test("counts user+assistant turns and total lines", () => {
		const content = jsonl([
			{ type: "user", message: { role: "user", content: "hi" } },
			{
				type: "assistant",
				message: { role: "assistant", content: "hello" },
			},
			{ type: "user", message: { role: "user", content: "again" } },
			{ type: "system" },
		]);
		const meta = extractMetadata(content);
		expect(meta.turn_count).toBe(3);
		expect(meta.line_count).toBe(4);
	});

	test("extracts first_user_message and previews", () => {
		const content = jsonl([
			{ type: "user", message: { role: "user", content: "first ask" } },
			{
				type: "assistant",
				message: { role: "assistant", content: "answer" },
			},
			{ type: "user", message: { role: "user", content: "second ask" } },
			{ type: "user", message: { role: "user", content: "third ask" } },
			{ type: "user", message: { role: "user", content: "latest ask" } },
		]);
		const meta = extractMetadata(content);
		expect(meta.first_user_message).toBe("first ask");
		expect(meta.preview_first?.[0]).toBe("first ask");
		expect(meta.preview_last?.at(-1)).toBe("latest ask");
	});

	test("extracts claude_model from assistant message", () => {
		const content = jsonl([
			{
				type: "assistant",
				message: {
					role: "assistant",
					model: "claude-opus-4-7",
					content: "ok",
				},
			},
		]);
		expect(extractMetadata(content).claude_model).toBe("claude-opus-4-7");
	});

	test("extracts git_branch and git_sha when present", () => {
		const content = jsonl([
			{
				type: "user",
				gitBranch: "main",
				message: { role: "user", content: "x" },
			},
		]);
		const meta = extractMetadata(content);
		expect(meta.git_branch).toBe("main");
	});

	test("status flips to 'completed' when type:'result' present", () => {
		const incomplete = jsonl([
			{ type: "user", message: { role: "user", content: "x" } },
		]);
		const complete = jsonl([
			{ type: "user", message: { role: "user", content: "x" } },
			{ type: "result", total_cost_usd: 0.1 },
		]);
		expect(extractMetadata(incomplete).status).toBe("active");
		expect(extractMetadata(complete).status).toBe("completed");
	});

	test("missing fields return null, not undefined or empty string", () => {
		const meta = extractMetadata("");
		expect(meta.claude_model).toBeNull();
		expect(meta.git_branch).toBeNull();
		expect(meta.git_sha).toBeNull();
		expect(meta.first_user_message).toBeNull();
	});

	test("malformed lines are skipped without throwing", () => {
		const content = [
			"{not-json",
			JSON.stringify({
				type: "user",
				message: { role: "user", content: "ok" },
			}),
		].join("\n");
		const meta = extractMetadata(content);
		expect(meta.turn_count).toBe(1);
		expect(meta.first_user_message).toBe("ok");
	});

	test("array-content user messages are flattened to text", () => {
		const content = jsonl([
			{
				type: "user",
				message: {
					role: "user",
					content: [
						{ type: "text", text: "part 1" },
						{ type: "text", text: "part 2" },
					],
				},
			},
		]);
		expect(extractMetadata(content).first_user_message).toBe("part 1\npart 2");
	});

	// ENG-6068 RED — pins the daemon-side contract for `started_at`:
	// `extractMetadata` walks every JSONL line, parses each, and surfaces the
	// EARLIEST string `timestamp` value it finds. Mirrors
	// `extractFirstEventTimestamp` in `nextjs-app/lib/services/dev-sessions.ts:988-1007`
	// — same shape, same comparison semantics (lexical string compare on ISO-8601 UTC).
	//
	// The daemon emits ISO-8601 UTC (`Z`-suffix); we pin that exact shape end-to-end
	// so the server's strict validator (`^\d{4}-\d{2}-\d{2}` + `Date.parse` finite,
	// `nextjs-app/lib/services/dev-sessions.ts:392-401`) accepts the value and the
	// downstream `storage_path` date segment matches the real session day, not the
	// upload day. GREEN flips both these tests from `test.failing` to `test` once
	// the walker is wired.
	//
	// Fixture has two intentional shapes:
	//   1. Walk-past lines — `isSnapshotUpdate`-style entries with NO `timestamp`
	//      field, sitting in front of the real events. Production JSONLs from the
	//      conversation-watcher routinely lead with these; the canonical
	//      `extractFirstEventTimestamp` docstring (lines 977-982) calls this out
	//      explicitly. A "read entry[0].timestamp" implementation would return
	//      undefined here — forcing GREEN to actually walk.
	//   2. Events out of order — the second event's `timestamp` is earlier than
	//      the first event's. "first-encountered" would return the later value;
	//      "earliest" (the correct semantics) returns the smaller string. Forces
	//      GREEN to compare, not just take.
	test(
		"extractMetadata: started_at is the earliest event timestamp, walking past non-event lines — ENG-6068",
		() => {
			const content = jsonl([
				// Walk-past: daemon-meta lines with no `timestamp`. GREEN must skip these.
				{ type: "isSnapshotUpdate", payload: { foo: 1 } },
				{ type: "file-history-snapshot", path: "src/x.ts" },
				// Out-of-order events: the EARLIEST timestamp is 12:24:00, not 12:24:05.
				{
					type: "assistant",
					timestamp: "2026-03-11T12:24:05.000Z",
					message: { role: "assistant", content: "hi" },
				},
				{
					type: "user",
					timestamp: "2026-03-11T12:24:00.000Z",
					message: { role: "user", content: "hello" },
				},
			]);
			const meta = extractMetadata(content);
			expect(meta.started_at).toBe("2026-03-11T12:24:00.000Z");
		},
	);

	// Pin the null-sentinel contract for sessions with zero parseable timestamps.
	// `SyncMetadata.started_at` on the server is optional; the daemon's POST
	// composition (B.2 GREEN, `sync-flow.ts:238`) should OMIT the field when
	// extractMetadata returns null (not send `started_at: null` or empty string)
	// so the server's `if (m.started_at != null)` validator branch stays out
	// of the picture for daemon-meta-only files. The null sentinel here is what
	// the composition layer keys off.
	//
	// Not `test.failing`: this contract is trivially satisfied in RED (the
	// stub returns `null` unconditionally), but it MUST hold after GREEN lands
	// the walker — guardrail against a GREEN implementation that returns
	// `undefined`, `""`, or `"null"` for daemon-meta-only files.
	test("extractMetadata: started_at is null when no JSONL line carries a string timestamp — ENG-6068", () => {
		const content = jsonl([
			{ type: "isSnapshotUpdate", payload: { foo: 1 } },
			// Non-string timestamp must NOT count — guards against future
			// JSONL writers emitting `timestamp: <epoch-ms-number>`.
			{ type: "user", timestamp: 1_741_692_240_000 },
		]);
		const meta = extractMetadata(content);
		expect(meta.started_at).toBeNull();
	});
});
