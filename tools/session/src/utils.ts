/**
 * Shared utilities for the session parser.
 *
 * Provides common helpers used across the parser, finder, and CLI modules.
 */

/**
 * Read the text content of a JSONL file, transparently decompressing gzip files.
 *
 * Gzip detection is based on file extension: files ending in `.gz` are decompressed
 * using Bun.gunzipSync before decoding. All other files are read as plain text.
 *
 * This supports the archived session format (`.jsonl.gz`) used in ~/agent-records/
 * alongside the standard `.jsonl` format used in ~/.claude/projects/.
 */
export async function readJsonlContent(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (filePath.endsWith(".gz")) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    return new TextDecoder().decode(Bun.gunzipSync(buffer));
  }
  return file.text();
}
