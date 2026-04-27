/**
 * Per-machine cursor for `dx slack inbox --unread`.
 *
 * Stores the last-seen mention `ts` so subsequent `--unread` runs only
 * surface mentions strictly newer than the cursor. Path is
 * `~/.dx/slack-inbox-cursor.json` per the ENG-5415 acceptance criteria.
 *
 * Best-effort, lossy semantics: a corrupt or missing file is treated
 * as "no cursor" rather than an error — `--unread` is a UX nicety, not
 * a correctness gate. Writes are atomic-via-rename so a crash mid-write
 * doesn't leave a half-truncated file.
 *
 * Part of: ENG-5415
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_CURSOR_PATH = join(
  homedir(),
  ".dx",
  "slack-inbox-cursor.json",
);

export interface InboxCursor {
  /** Latest mention `ts` Gin has acknowledged, e.g. "1700000000.000123". */
  lastSeenTs?: string;
  /** ISO time the cursor was last updated — diagnostics only. */
  updatedAt?: string;
}

/**
 * Load the cursor from disk. Returns an empty cursor when the file is
 * absent or unreadable / unparseable (best-effort).
 */
export function readInboxCursor(
  path: string = DEFAULT_CURSOR_PATH,
): InboxCursor {
  try {
    if (!existsSync(path)) return {};
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<InboxCursor>;
    if (typeof parsed?.lastSeenTs === "string") {
      return {
        lastSeenTs: parsed.lastSeenTs,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist the cursor to disk. Creates the parent directory if missing.
 *
 * Atomic-via-rename: write to `<path>.tmp`, then rename. POSIX renames
 * are atomic on the same filesystem, so concurrent readers always see
 * a fully-formed file (or the prior version).
 */
export function writeInboxCursor(
  cursor: InboxCursor,
  path: string = DEFAULT_CURSOR_PATH,
): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const payload: InboxCursor = {
    lastSeenTs: cursor.lastSeenTs,
    updatedAt: cursor.updatedAt ?? new Date().toISOString(),
  };
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  renameSync(tmp, path);
}
