/**
 * Types for Claude session JSONL parsing
 *
 * Claude Code stores sessions as JSONL files in ~/.claude/projects/<project-hash>/<session-uuid>.jsonl
 *
 * Entry Types (discovered from real session files):
 *
 * | Type                  | Description                                           |
 * |-----------------------|-------------------------------------------------------|
 * | system                | Session initialization (model, tools, cwd)            |
 * | user                  | User messages (text, tool results)                    |
 * | assistant             | Claude responses (text, tool calls, thinking)         |
 * | result                | Session completion (success/error, duration, cost)    |
 * | file-history-snapshot | File state snapshots for undo/redo                    |
 * | queue-operation       | Queue management for async operations                 |
 * | progress              | Hook progress updates (added in Claude Code 2.1.27+)  |
 * | saved_hook_context    | Saved hook context for resumption                     |
 * | summary               | AI-generated session summary                          |
 *
 * Parent Chain:
 * - Entries link via uuid/parentUuid forming a tree (for rewind support)
 * - CAUTION: Cycles can occur in parent chain - always guard traversal!
 *
 * No official schema is published. This was reverse-engineered from session files.
 * Use schema.test.ts to detect drift when new entry types/fields appear.
 */

// Raw JSONL entry types
export type EntryType =
  | "system"
  | "user"
  | "assistant"
  | "result"
  | "file-history-snapshot"
  | "queue-operation"
  | "progress" // Hook progress updates (added in Claude Code 2.1.27+)
  | "saved_hook_context" // Saved hook context
  | "summary"; // Session summary line

/**
 * Array of known entry types for schema drift detection.
 * Keep this in sync with the EntryType union above.
 */
export const KNOWN_ENTRY_TYPES: string[] = [
  "system",
  "user",
  "assistant",
  "result",
  "file-history-snapshot",
  "queue-operation",
  "progress",
  "saved_hook_context",
  "summary",
];

/**
 * Known fields for each entry type, used for schema drift detection.
 * This helps identify when new fields are added to existing types.
 *
 * Note: This list is intentionally comprehensive to reduce noise from
 * the schema drift detector. Add new fields here as they're discovered.
 */
export const KNOWN_FIELDS_BY_TYPE: Record<string, string[]> = {
  system: [
    "type",
    "subtype",
    "uuid",
    "parentUuid",
    "session_id",
    "sessionId",
    "agentId",
    "timestamp",
    "parent_tool_use_id",
    "cwd",
    "tools",
    "model",
    // Metadata fields
    "isSidechain",
    "userType",
    "version",
    "gitBranch",
    "slug",
    // Hook-related fields
    "hookCount",
    "hookInfos",
    "hookErrors",
    "preventedContinuation",
    // Status fields
    "stopReason",
    "hasOutput",
    "level",
    "toolUseID",
    "durationMs",
    "isMeta",
    "cause",
    "error",
    "retryInMs",
    "retryAttempt",
    "maxRetries",
  ],
  user: [
    "type",
    "uuid",
    "parentUuid",
    "session_id",
    "sessionId",
    "agentId",
    "timestamp",
    "parent_tool_use_id",
    "message",
    // Metadata fields
    "isSidechain",
    "userType",
    "cwd",
    "version",
    "gitBranch",
    "slug",
    // Tool-related fields
    "toolUseResult",
    "sourceToolAssistantUUID",
    "sourceToolUseID",
    // Other fields
    "thinkingMetadata",
    "todos",
    "permissionMode",
    "isMeta",
  ],
  assistant: [
    "type",
    "uuid",
    "parentUuid",
    "session_id",
    "sessionId",
    "agentId",
    "timestamp",
    "parent_tool_use_id",
    "message",
    // Metadata fields
    "isSidechain",
    "userType",
    "cwd",
    "version",
    "gitBranch",
    "slug",
    "requestId",
    // Error fields
    "isApiErrorMessage",
    "error",
  ],
  result: [
    "type",
    "subtype",
    "uuid",
    "parentUuid",
    "session_id",
    "sessionId",
    "agentId",
    "timestamp",
    "parent_tool_use_id",
    "result",
    "duration_ms",
    "total_cost_usd",
  ],
  "file-history-snapshot": [
    "type",
    "messageId",
    "snapshot",
    "isSnapshotUpdate",
  ],
  "queue-operation": [
    "type",
    "operation",
    "timestamp",
    "sessionId",
    "content",
  ],
  progress: [
    "type",
    "uuid",
    "parentUuid",
    "timestamp",
    "sessionId",
    "agentId",
    "message",
    "data",
    // Metadata fields
    "isSidechain",
    "userType",
    "cwd",
    "version",
    "gitBranch",
    "slug",
    // Tool-related fields
    "parentToolUseID",
    "toolUseID",
  ],
  saved_hook_context: [
    "type",
    "uuid",
    "parentUuid",
    "timestamp",
    "sessionId",
    "hookContext",
    "hookName",
    "hookEvent",
    "content",
    "toolUseID",
    // Metadata fields
    "cwd",
    "userType",
    "version",
    "isSidechain",
    "gitBranch",
  ],
  summary: [
    "type",
    "summary",
    "timestamp",
    "leafUuid",
  ],
};

export interface BaseEntry {
  type: EntryType;
  uuid?: string;
  parentUuid?: string | null; // Links to parent message for tree structure
  session_id?: string;
  sessionId?: string; // Alternative field name used in some entries
  agentId?: string; // Present in subagent entries
  timestamp?: string;
  parent_tool_use_id?: string | null;
}

export interface SystemEntry extends BaseEntry {
  type: "system";
  subtype: "init";
  cwd: string;
  tools: string[];
  model: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: "user" | "assistant";
  content: MessageContent[] | string;
}

export interface UserEntry extends BaseEntry {
  type: "user";
  message: Message;
}

export interface AssistantEntry extends BaseEntry {
  type: "assistant";
  message: Message & {
    model: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ResultEntry extends BaseEntry {
  type: "result";
  subtype: "success" | "error";
  result: string;
  duration_ms: number;
  total_cost_usd?: number;
}

/**
 * File history snapshot for undo/redo functionality.
 * Captures file state at a point in the conversation for reverting changes.
 *
 * Note: Does not extend BaseEntry as it has a different structure
 * (messageId instead of uuid, no timestamp, etc.)
 */
export interface FileHistorySnapshotEntry {
  type: "file-history-snapshot";
  messageId: string;
  snapshot: Record<string, unknown>;
  isSnapshotUpdate?: boolean;
}

/**
 * Queue operation for managing async operations.
 * Used for background task coordination in the Claude Code CLI.
 *
 * Note: Has a minimal structure with timestamp and sessionId but
 * does not use the same uuid/parentUuid linking as conversation entries.
 */
export interface QueueOperationEntry {
  type: "queue-operation";
  operation: string;
  timestamp?: string;
  sessionId?: string;
  content?: unknown;
}

/**
 * Progress entry for hook execution updates.
 * Added in Claude Code 2.1.27+ to track hook progress during execution.
 *
 * Extends BaseEntry as it participates in the uuid/parentUuid chain.
 */
export interface ProgressEntry extends BaseEntry {
  type: "progress";
  message?: Message;
  data?: Record<string, unknown>;
  parentToolUseID?: string;
  toolUseID?: string;
}

export type Entry =
  | SystemEntry
  | UserEntry
  | AssistantEntry
  | ResultEntry
  | FileHistorySnapshotEntry
  | QueueOperationEntry
  | ProgressEntry;

// Parsed conversation types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  uuid: string;
  parentUuid?: string | null;
  isOnCurrentBranch: boolean;
}

export interface ParsedSubagent {
  agentId: string;
  sessionId: string; // Parent session ID
  turns: Turn[];
  startTimestamp?: string;
}

export interface RewindInfo {
  fromUuid: string; // The UUID we rewound from
  abandonedBranchUuids: string[]; // UUIDs of messages on the abandoned branch
}

export interface CommitInfo {
  hash: string; // Short or full commit hash
  message?: string; // First line of commit message if available
}

export interface ParsedSession {
  sessionId: string;
  cwd: string;
  model: string;
  tools: string[];
  turns: Turn[];
  subagents: ParsedSubagent[];
  rewinds: RewindInfo[];
  triggeredSkills: string[]; // Skills invoked via the Skill tool
  commits: CommitInfo[]; // Commits made during this session
  summary?: string; // Session summary from type:"summary" line
  result?: {
    success: boolean;
    durationMs: number;
    costUsd?: number;
  };
}
