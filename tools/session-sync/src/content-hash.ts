/**
 * SHA-256 hex content hash of uncompressed JSONL bytes (AC 8/14).
 *
 * The server's sync endpoint short-circuits the storage upload when
 * the incoming hash matches the row's existing `content_hash`, so
 * matching the server's hash exactly matters: both sides hash the
 * uncompressed (pre-gzip) JSONL bytes, lowercase hex.
 */

export async function computeContentHash(bytes: Uint8Array): Promise<string> {
	// Copy into a fresh ArrayBuffer-backed view so the WebCrypto type
	// signature accepts it regardless of input buffer kind (TS narrowing
	// on `ArrayBufferLike` vs `ArrayBuffer`).
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	const digest = await crypto.subtle.digest("SHA-256", copy);
	const view = new Uint8Array(digest);
	let out = "";
	for (let i = 0; i < view.length; i += 1) {
		const byte = view[i];
		if (byte === undefined) continue;
		out += byte.toString(16).padStart(2, "0");
	}
	return out;
}
