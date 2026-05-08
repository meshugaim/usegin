/**
 * Tests for `downloadSessionJsonl` (Step 5a of ENG-5861).
 *
 * Round-trips real gzipped bytes through an injected `fetchImpl` to confirm
 * the helper decompresses correctly. No real network.
 */

import { describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { downloadSessionJsonl, type FetchLike } from "./api-download";

function gzip(text: string): Uint8Array {
  return new Uint8Array(gzipSync(text));
}

function bytesResponse(
  status: number,
  bytes: Uint8Array,
  contentType = "application/gzip",
): Response {
  return new Response(bytes, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("downloadSessionJsonl — happy path", () => {
  test("round-trip: gzip(text) → fetch returns those bytes → returns text", async () => {
    const text = '{"type":"system","sessionId":"abc"}\n{"type":"user","text":"hi"}\n';
    const compressed = gzip(text);
    let seenUrl = "";
    const fetchImpl: FetchLike = async (input) => {
      seenUrl = String(input);
      return bytesResponse(200, compressed);
    };
    const out = await downloadSessionJsonl(
      "https://signed.example/abc?token=xyz",
      fetchImpl,
    );
    expect(out).toBe(text);
    expect(seenUrl).toBe("https://signed.example/abc?token=xyz");
  });

  test("handles large JSONL payloads", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(JSON.stringify({ type: "user", n: i, text: "x".repeat(80) }));
    }
    const text = `${lines.join("\n")}\n`;
    const compressed = gzip(text);
    const fetchImpl: FetchLike = async () => bytesResponse(200, compressed);
    const out = await downloadSessionJsonl("https://signed.example/big", fetchImpl);
    expect(out).toBe(text);
  });
});

describe("downloadSessionJsonl — failure modes", () => {
  test("non-200 throws", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("forbidden", { status: 403 });
    await expect(
      downloadSessionJsonl("https://signed.example/expired", fetchImpl),
    ).rejects.toThrow(/403/);
  });

  test("404 throws", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 404 });
    await expect(
      downloadSessionJsonl("https://signed.example/missing", fetchImpl),
    ).rejects.toThrow(/404/);
  });

  test("non-gzip body throws", async () => {
    const fetchImpl: FetchLike = async () =>
      bytesResponse(200, new Uint8Array([1, 2, 3, 4]));
    await expect(
      downloadSessionJsonl("https://signed.example/garbage", fetchImpl),
    ).rejects.toThrow();
  });

  test("network throw propagates", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(
      downloadSessionJsonl("https://signed.example/x", fetchImpl),
    ).rejects.toThrow("ECONNREFUSED");
  });
});
