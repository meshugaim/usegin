import { describe, expect, test } from "bun:test";
import { isSessionComplete } from "../src/completion.ts";

describe("isSessionComplete", () => {
	test("empty content → false", () => {
		expect(isSessionComplete("")).toBe(false);
	});

	test("single type:'result' line → true", () => {
		expect(isSessionComplete('{"type":"result","total_cost_usd":0.42}')).toBe(
			true,
		);
	});

	test("mixed lines including type:'result' → true", () => {
		const jsonl = [
			'{"type":"user","message":{}}',
			'{"type":"assistant","message":{}}',
			'{"type":"result"}',
		].join("\n");
		expect(isSessionComplete(jsonl)).toBe(true);
	});

	test("only user/assistant types → false", () => {
		const jsonl = [
			'{"type":"user","message":{}}',
			'{"type":"assistant","message":{}}',
			'{"type":"system"}',
		].join("\n");
		expect(isSessionComplete(jsonl)).toBe(false);
	});

	test("malformed lines are skipped without throwing", () => {
		const jsonl = ["{not-json", '{"type":"result"}', "another bad line"].join(
			"\n",
		);
		expect(isSessionComplete(jsonl)).toBe(true);
	});

	test("blank trailing newline is tolerated", () => {
		expect(isSessionComplete('{"type":"result"}\n')).toBe(true);
	});
});
