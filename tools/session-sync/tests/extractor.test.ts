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
	// `extractMetadata` walks the JSONL and surfaces the first line carrying
	// a string `timestamp` field, verbatim. The daemon emits ISO-8601 UTC
	// (`Z`-suffix); we pin that exact shape end-to-end so the server's
	// strict validator (`^\d{4}-\d{2}-\d{2}` + `Date.parse` finite) accepts
	// the value and downstream `storage_path` date segment matches the
	// real session day, not the upload day. GREEN will flip this from
	// `test.failing` to `test` once the walker is wired.
	test.failing(
		"extractMetadata: started_at is populated from first JSONL event timestamp — ENG-6068",
		() => {
			const content = jsonl([
				{
					type: "user",
					timestamp: "2026-03-11T12:24:00.000Z",
					message: { role: "user", content: "hello" },
				},
				{
					type: "assistant",
					timestamp: "2026-03-11T12:24:05.000Z",
					message: { role: "assistant", content: "hi" },
				},
			]);
			const meta = extractMetadata(content);
			expect(meta.started_at).toBe("2026-03-11T12:24:00.000Z");
		},
	);
});
