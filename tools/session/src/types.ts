import type { GitCommit } from "./git-commits";

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

// ============================================================================
// BRANDED ID TYPES
// ============================================================================
//
// These provide compile-time safety to prevent mixing different ID types.
// At runtime, they are just strings - the brand exists only in the type system.
//
// Usage:
//   const sessionId = asSessionId("abc-123");
//   const entryUuid = asEntryUuid("uuid-001");
//
// The compiler will catch errors like:
//   const turn: Turn = { uuid: sessionId, ... }; // Error! SessionId not assignable to EntryUuid
//

/** Session identifier (from session_id or sessionId fields) */
export type SessionId = string & { readonly __brand: "SessionId" };

/** Entry UUID (uuid field in entries, used for parent-child linking) */
export type EntryUuid = string & { readonly __brand: "EntryUuid" };

/** Agent identifier (agentId field in subagent entries) */
export type AgentId = string & { readonly __brand: "AgentId" };

/** Tool use identifier (id field in tool_use blocks) */
export type ToolUseId = string & { readonly __brand: "ToolUseId" };

// Helper functions to create branded IDs from strings

/** Create a SessionId from a string */
export function asSessionId(id: string): SessionId {
  return id as SessionId;
}

/** Create an EntryUuid from a string */
export function asEntryUuid(uuid: string): EntryUuid {
  return uuid as EntryUuid;
}

/** Create an AgentId from a string */
export function asAgentId(id: string): AgentId {
  return id as AgentId;
}

/** Create a ToolUseId from a string */
export function asToolUseId(id: string): ToolUseId {
  return id as ToolUseId;
}

// ============================================================================
// ENTRY TYPES
// ============================================================================

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

// ============================================================================
// TOOL INPUT TYPES
// ============================================================================
//
// ToolInputMap provides typed definitions for known tool inputs.
// This enables type-safe access to tool parameters without unsafe casts.
//
// Usage:
//   // Type guard approach (recommended)
//   const input = getToolInput("Read", toolUse);
//   if (input) {
//     console.log(input.file_path);  // Type: string
//   }
//
//   // Generic type approach
//   const typed: TypedToolUseContent<"Bash"> = { ... };
//   console.log(typed.input.command);  // Type: string
//
// Unknown tools fall back to Record<string, unknown> for backward compatibility.
//

/**
 * Map of known tool names to their input types.
 *
 * This enables compile-time type checking for tool inputs.
 * Add new tools here as they're discovered or needed.
 */
export interface ToolInputMap {
  Read: {
    file_path: string;
    offset?: number;
    limit?: number;
  };

  Write: {
    file_path: string;
    content: string;
  };

  Edit: {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  };

  Bash: {
    command: string;
    description?: string;
    timeout?: number;
  };

  Glob: {
    pattern: string;
    path?: string;
  };

  Grep: {
    pattern: string;
    path?: string;
    glob?: string;
  };

  Task: {
    prompt: string;
    description: string;
    name?: string;
    subagent_type?: string;
    resume?: string;
  };

  Skill: {
    skill: string;
    args?: string;
  };

  TodoWrite: {
    todos: Array<{
      id: string;
      content: string;
      status: string;
    }>;
  };
}

/** Names of known tools with typed inputs */
export type KnownToolName = keyof ToolInputMap;

/** Array of known tool names for runtime checks */
export const KNOWN_TOOL_NAMES: KnownToolName[] = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
  "Task",
  "Skill",
  "TodoWrite",
];

/**
 * Type guard to check if a string is a known tool name.
 *
 * @example
 * ```ts
 * if (isKnownToolName(toolName)) {
 *   // toolName is now typed as KnownToolName
 * }
 * ```
 */
export function isKnownToolName(name: string): name is KnownToolName {
  return KNOWN_TOOL_NAMES.includes(name as KnownToolName);
}

/**
 * Generic ToolUseContent with typed input based on tool name.
 *
 * @example
 * ```ts
 * const readTool: TypedToolUseContent<"Read"> = {
 *   type: "tool_use",
 *   id: "toolu_123",
 *   name: "Read",
 *   input: { file_path: "/test.ts" },  // Typed!
 * };
 * ```
 */
export interface TypedToolUseContent<T extends KnownToolName> {
  type: "tool_use";
  id: string;
  name: T;
  input: ToolInputMap[T];
}

/**
 * Type guard that returns typed input if the tool name matches.
 *
 * Returns undefined if the tool name doesn't match, allowing for
 * safe narrowing without unsafe casts.
 *
 * @example
 * ```ts
 * const input = getToolInput("Read", toolUse);
 * if (input) {
 *   // input is typed as ToolInputMap["Read"]
 *   console.log(input.file_path);
 * }
 * ```
 */
export function getToolInput<T extends KnownToolName>(
  expectedName: T,
  toolUse: ToolUseContent
): ToolInputMap[T] | undefined {
  if (toolUse.name === expectedName) {
    return toolUse.input as ToolInputMap[T];
  }
  return undefined;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Content block type used in Task tool results.
 * Task tool returns an array of these instead of a plain string.
 */
export interface ToolResultContentBlock {
  type: "text";
  text: string;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  /**
   * Content can be:
   * - A plain string (most tools)
   * - An array of content blocks (Task tool returns [{type: "text", text: "..."}])
   */
  content: string | ToolResultContentBlock[];
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
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

/**
 * Aggregated token usage across all assistant turns in a session.
 *
 * Token counts come from the Anthropic API usage object on each assistant message.
 * - `inputTokens`: Non-cached input tokens (the `input_tokens` field)
 * - `outputTokens`: Output tokens generated
 * - `cacheCreationInputTokens`: Tokens written to cache
 * - `cacheReadInputTokens`: Tokens read from cache
 *
 * For display purposes, use `inputTokens + cacheCreationInputTokens + cacheReadInputTokens`
 * as the total input context, and `outputTokens` as the generation cost.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
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

/**
 * Saved hook context for session resumption.
 * Stores hook state so that hooks can resume where they left off.
 *
 * Extends BaseEntry as it participates in the uuid/parentUuid chain.
 */
export interface SavedHookContextEntry extends BaseEntry {
  type: "saved_hook_context";
  hookContext?: Record<string, unknown>;
  hookName?: string;
  hookEvent?: string;
  content?: unknown;
  toolUseID?: string;
}

/**
 * AI-generated session summary.
 * Contains a brief summary of what was accomplished in the session.
 *
 * Note: Does not extend BaseEntry as it has a minimal structure
 * (just type, summary, timestamp, and leafUuid).
 */
export interface SummaryEntry {
  type: "summary";
  summary: string;
  timestamp?: string;
  leafUuid?: string;
}

export type Entry =
  | SystemEntry
  | UserEntry
  | AssistantEntry
  | ResultEntry
  | FileHistorySnapshotEntry
  | QueueOperationEntry
  | ProgressEntry
  | SavedHookContextEntry
  | SummaryEntry;

// Parsed conversation types
export interface ToolCall {
  id: ToolUseId;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Type guard that returns typed input if the ToolCall's name matches.
 *
 * Similar to getToolInput but works with the parsed ToolCall type.
 *
 * @example
 * ```ts
 * const input = getToolCallInput("Bash", toolCall);
 * if (input) {
 *   console.log(input.command);  // Type: string
 * }
 * ```
 */
export function getToolCallInput<T extends KnownToolName>(
  expectedName: T,
  toolCall: ToolCall
): ToolInputMap[T] | undefined {
  if (toolCall.name === expectedName) {
    return toolCall.input as ToolInputMap[T];
  }
  return undefined;
}

/**
 * Normalize tool result content to a string.
 *
 * Tool results can be either:
 * - A plain string (most tools like Read, Bash, Grep)
 * - An array of content blocks (Task tool: [{type: "text", text: "..."}])
 *
 * This function extracts the text content and returns a single string.
 *
 * @param content - The raw content from ToolResultContent
 * @returns A plain string representation of the content
 */
export function normalizeToolResultContent(
  content: string | ToolResultContentBlock[] | unknown
): string {
  // Already a string - return as-is
  if (typeof content === "string") {
    return content;
  }

  // Array of content blocks (Task tool format)
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "object" && block !== null && "text" in block) {
          return String((block as ToolResultContentBlock).text);
        }
        // Fallback for unknown array items
        return JSON.stringify(block);
      })
      .join("\n");
  }

  // Fallback for any other type - serialize to JSON
  return JSON.stringify(content);
}

export interface ToolResult {
  toolUseId: ToolUseId;
  content: string;
  isError: boolean;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  uuid: EntryUuid;
  parentUuid?: EntryUuid | null;
  timestamp?: string;
  isOnCurrentBranch: boolean;
}

export interface ParsedSubagent {
  agentId: AgentId;
  sessionId: SessionId; // Parent session ID
  turns: Turn[];
  startTimestamp?: string;
}

export interface RewindInfo {
  fromUuid: EntryUuid; // The UUID we rewound from
  abandonedBranchUuids: EntryUuid[]; // UUIDs of messages on the abandoned branch
}

export interface CommitInfo {
  hash: string; // Short or full commit hash
  message?: string; // First line of commit message if available
}

/**
 * A user message that was queued while the agent was mid-turn.
 *
 * These come from `queue-operation` entries with `operation === "enqueue"`
 * and a non-empty `content` string. They represent real user input that
 * arrived asynchronously and was queued for processing.
 */
export interface QueuedMessage {
  timestamp: string;
  content: string;
}

export interface ParsedSession {
  sessionId: SessionId;
  cwd: string;
  model: string;
  tools: string[];
  turns: Turn[];
  subagents: ParsedSubagent[];
  rewinds: RewindInfo[];
  triggeredSkills: string[]; // Skills invoked via the Skill tool
  commits: CommitInfo[]; // Commits made during this session (regex-extracted from Bash output)
  gitCommits?: GitCommit[]; // Commits from git history (richer data, preferred when available)
  queuedMessages?: QueuedMessage[]; // User messages sent while agent was mid-turn
  slug?: string; // Human-readable session name (e.g., "gleaming-fluttering-torvalds")
  summary?: string; // Session summary from type:"summary" line
  /** Timestamp of the first entry in the session (ISO 8601) */
  startTimestamp?: string;
  /** Timestamp of the last entry in the session (ISO 8601) */
  endTimestamp?: string;
  /** Per-turn durations from system/turn_duration entries (ms) */
  turnDurations?: number[];
  /** Aggregated token usage across all assistant turns */
  tokenUsage?: TokenUsage;
  result?: {
    success: boolean;
    durationMs: number;
    costUsd?: number;
  };
}
