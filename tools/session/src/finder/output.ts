/**
 * Output formatting utilities for the session finder.
 *
 * This module handles formatting session output in various formats
 * (path, id, json) and command line flag validation.
 */

import type { SessionInfo, OutputFormat, ConflictingFlagsOptions } from "./types";

// =============================================================================
// OUTPUT FORMATTING
// =============================================================================

/**
 * Format session output based on requested format.
 */
export function formatOutput(session: SessionInfo, format: OutputFormat): string {
  switch (format) {
    case "id":
      return session.id;
    case "json":
      return JSON.stringify({
        path: session.path,
        id: session.id,
        date: session.mtime.toISOString(),
        project: session.project,
      });
    case "path":
    default:
      return session.path;
  }
}

// =============================================================================
// FLAG VALIDATION
// =============================================================================

/**
 * Check for conflicting command line flags and return a warning message if found.
 *
 * @returns Warning message string, or null if no conflict
 */
export function warnIfConflictingFlags(options: ConflictingFlagsOptions): string | null {
  if (options.project && options.allProjects) {
    return "Ignoring --project because --all-projects specified";
  }
  return null;
}
