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
 * Information about a discovered session.
 *
 * **Dual-source nature (ENG-5861).** `SessionInfo` covers two surfaces:
 *
 *   - **Local / legacy-remote** (`source` absent or `"remote"` from
 *     `~/agent-records/`): `path` is a real filesystem path. Callers that
 *     need full metadata (turn count, summary, first message) read the file
 *     and extract on demand via `extractSessionMeta(path)`.
 *   - **API-remote** (`source: "remote"` with `meta` populated): the row
 *     came from `/api/v1/dev-sessions`, where the daemon has already
 *     uploaded summarized fields. There's no local file to open, so `path`
 *     is the empty string and `meta` carries pre-extracted display data
 *     (`display_title` → `summary`, `turn_count`, etc.). Callers MUST
 *     check `meta` first and only fall back to filesystem extraction when
 *     it's absent — opening `""` as a path is an obvious crash. The list
 *     renderer (`commands/list.ts`) is the load-bearing consumer; other
 *     surfaces (`fzf.ts`, `pickers.ts`) only see local sessions in
 *     slice 1, so the `path = ""` invariant is local to the API-list flow.
 *
 * This shape is deliberately a thin adaptor over the API row rather than
 * a `SessionInfo.path?` ripple — `path` is read by ~half a dozen non-list
 * call sites that have no business knowing about the API surface, and
 * widening their accepted type to handle "remote with no path" would push
 * the dual-source concern into modules that should stay local-only.
 */
export interface SessionInfo {
  /**
   * Filesystem path to the session file. **Empty string** when the row
   * came from `/api/v1/dev-sessions` and only metadata is available; the
   * file would have to be downloaded via signed URL before it could be
   * read. Slice-1 callers that hit this case use `meta` instead.
   */
  path: string;
  id: string;
  mtime: Date;
  project: string; // Project hash (directory name)
  source?: "local" | "remote"; // Where this session was discovered
  username?: string; // agent-records username directory (remote sessions only)
  /**
   * Pre-extracted metadata for API-remote rows. When set, the list
   * renderer uses these fields directly instead of calling
   * `extractSessionMeta(path)` — that call would `readJsonlContent("")`
   * and crash. Absent for local + legacy-remote rows; set only by the
   * API adapter in `commands/list.ts` (and any future API consumer).
   */
  meta?: SessionMeta;
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
  turnCount: number; // Number of user+assistant conversation turns
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
  deleteCommand?: string; // Shell command to delete selected session (receives path as $1)
  reloadCommand?: string; // Shell command to regenerate NUL-separated entries for reload
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
      .map((matchedSession) => `  ${matchedSession.id.slice(0, 8)}`)
      .join("\n");
    super(
      `Ambiguous session ID '${prefix}'. Did you mean:\n${matchList}`
    );
    this.name = "AmbiguousSessionError";
    this.prefix = prefix;
    this.matches = matches;
  }
}
