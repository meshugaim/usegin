/**
 * Red tests for the JSONL session-id rewriter (ENG-5862 step 8, AC 36).
 *
 * Six tests pinning the rewriter contract:
 *   1. Happy path — top-level `sessionId` rewritten.
 *   2. Pass-through — line WITHOUT `sessionId` is byte-equal to source.
 *   3. Multi-line mixed types — only sessionId-bearing lines change.
 *   4. Nested UUIDs preserved — `uuid`/`parentUuid` untouched.
 *   5. Malformed JSON tolerated — passed through byte-identical.
 *   6. Empty input — returns empty string.
 *
 * All `test.failing` until Green lands the implementation. Right-reason
 * failure: the stub throws "Not implemented (ENG-5862 step 8 Red)" — every
 * assertion sites past the call surfaces that error, so each test fails
 * at the throw rather than via a misleading downstream comparison.
 *
 * Part of: ENG-5862
 */

import { describe, expect, test } from "bun:test";
import { rewriteJsonlSessionId } from "./jsonl-rewriter";

const SOURCE_ID = "159b7095-3f96-4de5-a8a5-7cf445849bd6";
const NEW_ID = "abcdef01-2345-6789-abcd-ef0123456789";

describe("rewriteJsonlSessionId — top-level sessionId rewrite", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-1): rewrites top-level sessionId on a single line",
		() => {
			const line = JSON.stringify({
				type: "user",
				sessionId: SOURCE_ID,
				message: { role: "user", content: "hello" },
			});
			const out = rewriteJsonlSessionId(`${line}\n`, NEW_ID);
			const firstLine = out.split("\n")[0];
			const parsed = JSON.parse(firstLine ?? "");
			expect(parsed.sessionId).toBe(NEW_ID);
			// And the source id is gone from this line.
			expect(firstLine).not.toContain(SOURCE_ID);
		},
	);
});

describe("rewriteJsonlSessionId — byte-identical pass-through", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-2): line without sessionId is preserved byte-equal",
		() => {
			// A file-history-snapshot entry — no sessionId field. Includes
			// whitespace and key-order that a JSON.parse/stringify round-trip
			// would silently normalize; we want byte-identical output.
			const line = '{"type":"file-history-snapshot","cwd":"/tmp","mtime":12345}';
			const input = `${line}\n`;
			const out = rewriteJsonlSessionId(input, NEW_ID);
			// Strict byte equality — `===` on strings is byte-equal for UTF-16
			// in V8/JSC alike since we're dealing with ASCII content here.
			expect(out === input).toBe(true);
		},
	);
});

describe("rewriteJsonlSessionId — multi-line mixed entry types", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-3): 30-line fixture — sessionId lines rewritten, others byte-identical",
		() => {
			// Build a mixed fixture: 6 entry types × 5 each = 30 lines.
			// Types with sessionId: user, assistant, system, attachment.
			// Types without: file-history-snapshot, last-prompt, permission-mode.
			const lines: string[] = [];
			for (let i = 0; i < 5; i++) {
				lines.push(
					JSON.stringify({
						type: "user",
						sessionId: SOURCE_ID,
						message: { role: "user", content: `u${i}` },
					}),
				);
				lines.push(
					JSON.stringify({
						type: "assistant",
						sessionId: SOURCE_ID,
						message: { role: "assistant", content: `a${i}` },
					}),
				);
				lines.push(
					JSON.stringify({
						type: "system",
						sessionId: SOURCE_ID,
						subtype: "info",
					}),
				);
				lines.push(`{"type":"file-history-snapshot","mtime":${i}}`);
				lines.push(`{"type":"last-prompt","prompt":"prompt-${i}"}`);
				lines.push(`{"type":"permission-mode","mode":"acceptEdits"}`);
			}
			const input = `${lines.join("\n")}\n`;

			const out = rewriteJsonlSessionId(input, NEW_ID);
			const outLines = out.split("\n");

			// Every line in the output should pair index-by-index with input.
			for (let i = 0; i < lines.length; i++) {
				const srcLine = lines[i] ?? "";
				const outLine = outLines[i] ?? "";
				if (srcLine.includes('"sessionId"')) {
					// sessionId-bearing lines: source id replaced with new id.
					expect(outLine).not.toContain(SOURCE_ID);
					expect(JSON.parse(outLine).sessionId).toBe(NEW_ID);
				} else {
					// sessionId-less lines: byte-identical pass-through.
					expect(outLine === srcLine).toBe(true);
				}
			}
		},
	);
});

describe("rewriteJsonlSessionId — nested UUID preservation", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-4): nested uuid/parentUuid/leafUuid preserved verbatim",
		() => {
			// A realistic assistant entry: top-level sessionId AND nested
			// message uuid + parentUuid (claude code uses these for the
			// conversation-tree linkage; they identify messages, not the
			// session, so they MUST stay put across a fork).
			const nestedUuid = "11111111-2222-3333-4444-555555555555";
			const parentUuid = "66666666-7777-8888-9999-aaaaaaaaaaaa";
			const leafUuid = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
			const line = JSON.stringify({
				type: "assistant",
				sessionId: SOURCE_ID,
				uuid: nestedUuid,
				parentUuid,
				leafUuid,
				sourceToolAssistantUUID: nestedUuid,
				message: { role: "assistant", content: "hi" },
			});
			const out = rewriteJsonlSessionId(`${line}\n`, NEW_ID);
			const parsed = JSON.parse(out.split("\n")[0] ?? "");

			expect(parsed.sessionId).toBe(NEW_ID);
			// Every nested UUID survives unchanged.
			expect(parsed.uuid).toBe(nestedUuid);
			expect(parsed.parentUuid).toBe(parentUuid);
			expect(parsed.leafUuid).toBe(leafUuid);
			expect(parsed.sourceToolAssistantUUID).toBe(nestedUuid);
		},
	);
});

describe("rewriteJsonlSessionId — malformed JSON tolerance", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-5): line that isn't valid JSON is passed through byte-identical",
		() => {
			// A corrupted entry (truncated mid-string). The rewriter must not
			// throw — it passes the malformed line through unchanged.
			const goodLine = JSON.stringify({
				type: "user",
				sessionId: SOURCE_ID,
				message: { role: "user", content: "hi" },
			});
			const malformed = `{"type":"user","sessionId":"${SOURCE_ID}`; // unterminated
			const input = `${goodLine}\n${malformed}\n`;

			// Should not throw.
			const out = rewriteJsonlSessionId(input, NEW_ID);
			const [outGood, outMalformed] = out.split("\n");

			// Good line: rewritten.
			expect(JSON.parse(outGood ?? "").sessionId).toBe(NEW_ID);
			// Malformed line: preserved byte-identical.
			expect(outMalformed === malformed).toBe(true);
		},
	);
});

describe("rewriteJsonlSessionId — empty input", () => {
	test.failing(
		"ENG-5862 AC 36 (rewriter-6): empty input returns empty string",
		() => {
			expect(rewriteJsonlSessionId("", NEW_ID)).toBe("");
		},
	);
});
