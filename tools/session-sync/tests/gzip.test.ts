import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { gzipDeterministic } from "../src/gzip.ts";

const enc = new TextEncoder();

describe("gzipDeterministic", () => {
	test("round-trips: gunzip(gzip(x)) === x", () => {
		const input = enc.encode("hello world\nthis is a JSONL line\n");
		const out = gzipDeterministic(input);
		const back = gunzipSync(out);
		expect(new Uint8Array(back)).toEqual(input);
	});

	test("is byte-identical across calls (deterministic)", () => {
		const input = enc.encode("line one\nline two\n");
		const a = gzipDeterministic(input);
		const b = gzipDeterministic(input);
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	test("different content produces different bytes", () => {
		const a = gzipDeterministic(enc.encode("alpha"));
		const b = gzipDeterministic(enc.encode("bravo"));
		expect(Array.from(a)).not.toEqual(Array.from(b));
	});

	test("gzip header has no embedded mtime (no FNAME flag, mtime=0)", () => {
		// The gzip header layout: 0:0x1f 1:0x8b 2:method 3:flags
		// 4..7: mtime (LE u32). gzip -n leaves mtime=0 and clears FNAME.
		const input = enc.encode("anything");
		const out = gzipDeterministic(input);
		expect(out[0]).toBe(0x1f);
		expect(out[1]).toBe(0x8b);
		expect(out[4]).toBe(0);
		expect(out[5]).toBe(0);
		expect(out[6]).toBe(0);
		expect(out[7]).toBe(0);
		// FNAME is the bit 3 (0x08) of the flags byte.
		expect((out[3] ?? 0) & 0x08).toBe(0);
	});
});
