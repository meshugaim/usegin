/**
 * Session finder - discover and browse Claude sessions.
 *
 * This is the main entry point for the finder module. It re-exports all public
 * APIs from the submodules, maintaining backward compatibility with existing imports.
 *
 * Module structure:
 * - types.ts     - Type definitions (SessionInfo, DiscoverOptions, etc.)
 * - discovery.ts - Session discovery (discoverSessions, getCurrentProjectHash)
 * - meta.ts      - Metadata extraction (extractSessionMeta, extractUserMessages)
 * - resolve.ts   - Session resolution (resolveSessionPath, findSessionById)
 * - fzf.ts       - FZF integration (runFzf, formatMultiLineEntry)
 * - pickers.ts   - Picker UI (openSessionPicker, buildTmuxPopupCommand)
 * - output.ts    - Output formatting (formatOutput, warnIfConflictingFlags)
 */

// Re-export error classes from errors module
export {
  SessionError,
  SessionNotFoundError,
  NoSessionsFoundError,
  TmuxNotAvailableError,
  ParsingTimeoutError,
  NoPickerMethodError,
  FzfNotFoundError,
} from "../errors";

// =============================================================================
// TYPES
// =============================================================================

export {
  // Core session types
  type SessionInfo,
  type DiscoverOptions,
  type OutputFormat,

  // Session metadata types
  type SessionSummary,
  type SessionMeta,

  // FZF integration types
  type FzfOptions,
  type FzfMultiLineOptions,

  // Picker types
  type PickerMethod,
  type TmuxPopupOptions,
  type VscCommandOptions,
  type SessionPickerOptions,
  type SessionPickerResult,

  // Output types
  type OutputFileData,
  type PollOptions,
  type ConflictingFlagsOptions,

  // Error classes
  AmbiguousSessionError,
} from "./types";

// =============================================================================
// DISCOVERY
// =============================================================================

export {
  getClaudeProjectsDir,
  claudeProjectsDirExists,
  getCurrentProjectHash,
  parseSinceFilter,
  isBrokenSymlink,
  discoverSessions,
  // Note: hasUserMessages is internal, not exported
} from "./discovery";

// =============================================================================
// METADATA
// =============================================================================

export {
  truncateMessage,
  extractSessionMeta,
  extractSessionSummary,
  extractUserMessages,
} from "./meta";

// =============================================================================
// RESOLVE
// =============================================================================

export {
  extractSessionIdFromPath,
  isSessionId,
  isSessionIdOrPrefix,
  findSessionsByPrefix,
  findSessionById,
  resolveSessionPath,
} from "./resolve";

// =============================================================================
// FZF
// =============================================================================

export {
  isLiveSession,
  formatSessionLine,
  formatMultiLineEntry,
  checkFzfAvailable,
  buildFzfArgs,
  runFzf,
  runFzfMultiLine,
} from "./fzf";

// =============================================================================
// PICKERS
// =============================================================================

export {
  isTmuxAvailable,
  isVscBridgeAvailable,
  detectPickerMethod,
  generateOutputFilePath,
  writeOutputFile,
  pollForFile,
  buildTmuxPopupCommand,
  buildVscCommand,
  openSessionPicker,
} from "./pickers";

// =============================================================================
// OUTPUT
// =============================================================================

export {
  formatOutput,
  warnIfConflictingFlags,
} from "./output";
