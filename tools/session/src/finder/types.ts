/**
 * Type definitions for the session finder module.
 *
 * This file contains all interfaces, types, and error classes used by the finder.
 * It has no runtime dependencies on other finder modules to avoid circular imports.
 */

// =============================================================================
// CORE SESSION TYPES
// =============================================================================

/**
 * Information about a discovered session file.
 */
export interface SessionInfo {
  path: string;
  id: string;
  mtime: Date;
  project: string; // Project hash (directory name)
}

/**
 * Options for discovering sessions.
 */
export interface DiscoverOptions {
  project?: string; // Filter to specific project hash
  allProjects?: boolean; // Show sessions from all projects (overrides project)
  since?: string; // Filter to sessions after date (e.g., "1d", "1w", "2024-01-15")
  debug?: boolean; // Log debug info to stderr
}

/**
 * Output format for session display.
 */
export type OutputFormat = "path" | "id" | "json";

// =============================================================================
// SESSION METADATA TYPES
// =============================================================================

/**
 * Lightweight summary of a session (messages + line count).
 */
export interface SessionSummary {
  messages: string[];
  lineCount: number;
}

/**
 * Full metadata extracted from a session file.
 */
export interface SessionMeta {
  messages: string[];
  lineCount: number;
  summary: string | null;
  hasUserMessages: boolean;
}

// =============================================================================
// FZF INTEGRATION TYPES
// =============================================================================

/**
 * Options for running fzf.
 */
export interface FzfOptions {
  filter?: string; // Non-interactive mode for testing
}

/**
 * Options for running fzf with multi-line entries.
 */
export interface FzfMultiLineOptions {
  filter?: string; // Non-interactive mode for testing
  preview?: boolean; // Enable preview pane (default: true)
}

// =============================================================================
// PICKER TYPES
// =============================================================================

/**
 * Picker method for interactive session selection.
 */
export type PickerMethod = "tmux" | "vsc" | "auto";

/**
 * Options for tmux popup picker.
 */
export interface TmuxPopupOptions {
  width?: string;
  height?: string;
  allProjects?: boolean;
  since?: string;
}

/**
 * Options for VS Code picker command.
 */
export interface VscCommandOptions {
  allProjects?: boolean;
  since?: string;
}

/**
 * Options for the session picker.
 */
export interface SessionPickerOptions {
  allProjects?: boolean;
  since?: string;
  timeoutMs?: number;
  method?: PickerMethod;
}

/**
 * Result from the session picker.
 */
export interface SessionPickerResult {
  path: string;
  id: string;
  date: string;
  project: string;
  summary: string | null;
}

// =============================================================================
// OUTPUT TYPES
// =============================================================================

/**
 * Data structure for output file (JSON written for external consumption).
 */
export interface OutputFileData {
  path: string;
  id: string;
  date: string;
  project: string;
  summary: string | null;
}

/**
 * Options for polling for a file.
 */
export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Options for checking conflicting command line flags.
 */
export interface ConflictingFlagsOptions {
  project?: string;
  allProjects?: boolean;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Custom error for ambiguous session ID prefixes.
 *
 * Thrown when a short session ID prefix matches multiple sessions.
 * Includes the list of matching sessions for helpful error messages.
 */
export class AmbiguousSessionError extends Error {
  public readonly prefix: string;
  public readonly matches: SessionInfo[];

  constructor(prefix: string, matches: SessionInfo[]) {
    const matchList = matches
      .map((m) => `  ${m.id.slice(0, 8)}`)
      .join("\n");
    super(
      `Ambiguous session ID '${prefix}'. Did you mean:\n${matchList}`
    );
    this.name = "AmbiguousSessionError";
    this.prefix = prefix;
    this.matches = matches;
  }
}
