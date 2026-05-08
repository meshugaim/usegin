/**
 * Deterministic gzip equivalent to `gzip -n` (no original filename, no
 * modification timestamp). Byte-identical input produces byte-identical
 * gzip — required by AC 14 so the content-hash short-circuit on the
 * server side actually short-circuits.
 *
 * Implementation note: Node's zlib `gzipSync` writes mtime=0 by default
 * (the GZIP_HEADER mtime field is only set when the input is a
 * filesystem stream). It also doesn't set FNAME unless told to. So the
 * raw `gzipSync(buffer)` call is already deterministic given the
 * compression level. We pass `{ level: 9 }` explicitly so future
 * default-level changes in zlib don't drift our hashes.
 */

import { gzipSync } from "node:zlib";

export function gzipDeterministic(bytes: Uint8Array): Uint8Array {
	const out = gzipSync(bytes, { level: 9 });
	return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}
