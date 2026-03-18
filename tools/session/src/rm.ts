/**
 * Session deletion - remove session files and their subagents.
 *
 * Extracted as a pure module so the deletion logic is independently testable
 * without needing to exercise CLI confirmation prompts.
 */

import { unlink } from "node:fs/promises";

/**
 * Result of a batch file deletion.
 */
export interface DeleteResult {
  deleted: number;
  failed: number;
}

/**
 * Delete a list of session-related files (main session + subagents).
 *
 * Returns counts of successfully deleted and failed files.
 * Errors are swallowed per-file so one bad path doesn't abort the rest.
 */
export async function deleteSessionFiles(files: string[]): Promise<DeleteResult> {
  let deleted = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await unlink(file);
      deleted++;
    } catch {
      failed++;
    }
  }

  return { deleted, failed };
}
