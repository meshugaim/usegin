import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Metadata sidecar for a checked-out issue description.
 * Stored as `.meta.json` alongside `description.md`.
 */
export interface CheckoutMeta {
  identifier: string;
  id: string;
  fetchedAt: string;
  descriptionHash: string;
}

/**
 * Write a `.meta.json` sidecar into the given issue directory.
 */
export function writeCheckoutMeta(dir: string, meta: CheckoutMeta): void {
  const metaPath = join(dir, ".meta.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
}

/**
 * Read `.meta.json` from the given issue directory, or null if it doesn't exist.
 */
export function readCheckoutMeta(dir: string): CheckoutMeta | null {
  const metaPath = join(dir, ".meta.json");
  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, "utf-8"));
}

/**
 * Compute a sha256 hash of the description content using Bun.CryptoHasher.
 */
export function hashDescription(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}
