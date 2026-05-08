/**
 * Download + decompress the gzipped JSONL behind a signed URL (Step 5a of
 * ENG-5861).
 *
 * The single-GET endpoint (`/api/v1/dev-sessions/{id}`) returns a short-lived
 * signed URL pointing at the bucket object. This helper fetches that URL and
 * gunzips the response, returning the uncompressed JSONL text. No business
 * logic — the caller decides whether to pipe the text into the parser, write
 * it to disk, or stream it.
 *
 * `fetch` is dependency-injected so unit tests round-trip real gzipped bytes
 * without opening a socket. `node:zlib`'s `gunzipSync` is used here (Bun
 * supports it natively); for very large payloads the streaming `gunzip`
 * variant would be a future refinement, but slice 1's session sizes are well
 * within sync-decompress range.
 */

import { gunzipSync } from "node:zlib";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Fetch the signed URL, gunzip, return text.
 *
 * Throws on non-200, on gunzip failure, or on any underlying network error.
 * The signed URL is short-lived (5 min); a caller hitting an expired URL
 * gets a 403 from the storage layer, which surfaces as a thrown error here.
 */
export async function downloadSessionJsonl(
  signedUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const res = await fetchImpl(signedUrl, { method: "GET" });
  if (res.status !== 200) {
    throw new Error(
      `downloadSessionJsonl: HTTP ${res.status} for signed URL`,
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // gunzipSync throws on malformed gzip; let that bubble up — the bucket
  // contract is "always gzip", so a non-gzip body is corruption worth
  // surfacing rather than silently masking.
  const decompressed = gunzipSync(bytes);
  return decompressed.toString("utf-8");
}
