/**
 * Session finder - discover and browse Claude sessions.
 *
 * This is the main entry point for the finder module. It re-exports all public
 * APIs from the submodules, maintaining backward compatibility with existing imports.
 *
 * Module structure:
 * - types.ts     - Type definitions (SessionInfo, DiscoverOptions, etc.)
 * - discovery.ts - Session discovery (discoverSessions, getCurrentProjectHash)
 * - remote.ts    - Remote discovery (discoverRemoteSessions from ~/agent-records/)
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
// REMOTE DISCOVERY (LEGACY — ~/agent-records/)
// =============================================================================
//
// AC 43 (slice 3) deletes this path once the API-driven discovery below has
// proven itself in production. Until then, both surfaces coexist: callers
// migrated to the API helpers use `findRemoteSessionsViaApi` etc.; the
// legacy `~/agent-records/` scanner remains for the unmigrated callers.

export {
  AGENT_RECORDS_DIR,
  discoverRemoteSessions,
  findRemoteSessionById,
  findRemoteSessionsByPrefix,
  mergeSessionLists,
} from "./remote";

// =============================================================================
// REMOTE DISCOVERY (API — /api/v1/dev-sessions)
// =============================================================================
//
// Step 5a of ENG-5861 added the HTTP client + credential-aware finder; this
// section makes the public surface reachable from the canonical
// `from "../finder"` import path that `commands/*.ts` already uses.

export {
  type ApiAuthContext,
  type ApiClientError,
  type ApiErrorKind,
  type ApiListOptions,
  type ApiListResponse,
  type ApiSessionItem,
  type FetchLike,
  getSession,
  listSessions,
} from "./api-client";

export {
  type ApiFinderDeps,
  type ApiFinderOptions,
  findRemoteSessionsViaApi,
  resolveRemoteSessionViaApi,
} from "./api-finder";

export { downloadSessionJsonl } from "./api-download";

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
  findAgentFilesByPrefix,
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
  formatRelativeTime,
  formatListLine,
  warnIfConflictingFlags,
} from "./output";
