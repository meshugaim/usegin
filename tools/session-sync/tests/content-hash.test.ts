import { describe, expect, test } from "bun:test";
import { computeContentHash } from "../src/content-hash.ts";

const enc = new TextEncoder();

describe("computeContentHash", () => {
	test("known empty-string SHA-256 vector", async () => {
		expect(await computeContentHash(new Uint8Array())).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	test("known short-string vector ('abc')", async () => {
		expect(await computeContentHash(enc.encode("abc"))).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	test("hex output is 64 lowercase chars", async () => {
		const hash = await computeContentHash(enc.encode("anything"));
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	test("different bytes → different hashes", async () => {
		expect(await computeContentHash(enc.encode("a"))).not.toBe(
			await computeContentHash(enc.encode("b")),
		);
	});
});
