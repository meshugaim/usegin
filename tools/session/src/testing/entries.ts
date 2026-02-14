/**
 * Entry factory functions for session parsing tests.
 *
 * These create properly-typed Entry objects with sensible defaults,
 * making it easy to write tests without specifying every field.
 *
 * @example
 * ```ts
 * import { userEntry, assistantEntry, systemEntry } from "./testing";
 *
 * const entries = [
 *   systemEntry(),
 *   userEntry("u1", "Hello"),
 *   assistantEntry("a1", "Hi there!", { parentUuid: "u1" }),
 * ];
 * ```
 */

import type {
  Entry,
  UserEntry,
  AssistantEntry,
  SystemEntry,
  CompactBoundaryEntry,
  ResultEntry,
  MessageContent,
} from "../types";
import { TEST_SESSION_ID, TEST_MODEL, TEST_CWD } from "./fixtures";

// ============================================================================
// USER ENTRY
// ============================================================================

export interface UserEntryOptions {
  /** Parent UUID for conversation linking */
  parentUuid?: string | null;
  /** Session ID (defaults to TEST_SESSION_ID) */
  sessionId?: string;
  /** Agent ID for subagent entries */
  agentId?: string;
  /** Timestamp */
  timestamp?: string;
  /** Tool results to include in this message */
  toolResults?: Array<{
    toolUseId: string;
    content: string;
    isError?: boolean;
  }>;
}

/**
 * Creates a user entry with sensible defaults.
 *
 * @param uuid - Unique identifier for this entry
 * @param content - Text content or omit for tool-result-only messages
 * @param options - Additional options
 *
 * @example
 * ```ts
 * // Simple text message
 * userEntry("u1", "Hello world")
 *
 * // With parent UUID
 * userEntry("u2", "Follow-up", { parentUuid: "a1" })
 *
 * // Tool result only (no text)
 * userEntry("u3", "", {
 *   toolResults: [{ toolUseId: "t1", content: "file contents" }]
 * })
 * ```
 */
export function userEntry(
  uuid: string,
  content: string = "",
  options: UserEntryOptions = {}
): UserEntry {
  const {
    parentUuid,
    sessionId = TEST_SESSION_ID,
    agentId,
    timestamp,
    toolResults = [],
  } = options;

  // Build message content
  const messageContent: MessageContent[] = [];

  if (content) {
    messageContent.push({ type: "text", text: content });
  }

  for (const tr of toolResults) {
    messageContent.push({
      type: "tool_result",
      tool_use_id: tr.toolUseId,
      content: tr.content,
      is_error: tr.isError,
    });
  }

  const entry: UserEntry = {
    type: "user",
    uuid,
    session_id: sessionId,
    message: {
      role: "user",
      content: messageContent.length > 0 ? messageContent : content,
    },
  };

  if (parentUuid !== undefined) {
    entry.parentUuid = parentUuid;
  }

  if (agentId) {
    entry.agentId = agentId;
  }

  if (timestamp) {
    entry.timestamp = timestamp;
  }

  return entry;
}

// ============================================================================
// ASSISTANT ENTRY
// ============================================================================

export interface AssistantEntryOptions {
  /** Parent UUID for conversation linking */
  parentUuid?: string | null;
  /** Session ID (defaults to TEST_SESSION_ID) */
  sessionId?: string;
  /** Model name (defaults to TEST_MODEL) */
  model?: string;
  /** Agent ID for subagent entries */
  agentId?: string;
  /** Timestamp */
  timestamp?: string;
  /** Tool calls to include in this message */
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  /** Token usage data from the API response */
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * Creates an assistant entry with sensible defaults.
 *
 * @param uuid - Unique identifier for this entry
 * @param content - Text content
 * @param options - Additional options
 *
 * @example
 * ```ts
 * // Simple response
 * assistantEntry("a1", "Hello!")
 *
 * // With tool call
 * assistantEntry("a2", "Let me check that file", {
 *   parentUuid: "u1",
 *   toolCalls: [{ id: "t1", name: "Read", input: { file_path: "/test.ts" } }]
 * })
 * ```
 */
export function assistantEntry(
  uuid: string,
  content: string = "",
  options: AssistantEntryOptions = {}
): AssistantEntry {
  const {
    parentUuid,
    sessionId = TEST_SESSION_ID,
    model = TEST_MODEL,
    agentId,
    timestamp,
    toolCalls = [],
    usage,
  } = options;

  // Build message content
  const messageContent: MessageContent[] = [];

  if (content) {
    messageContent.push({ type: "text", text: content });
  }

  for (const tc of toolCalls) {
    messageContent.push({
      type: "tool_use",
      id: tc.id,
      name: tc.name,
      input: tc.input,
    });
  }

  const entry: AssistantEntry = {
    type: "assistant",
    uuid,
    session_id: sessionId,
    message: {
      role: "assistant",
      model,
      content: messageContent.length > 0 ? messageContent : content,
      ...(usage ? { usage } : {}),
    },
  };

  if (parentUuid !== undefined) {
    entry.parentUuid = parentUuid;
  }

  if (agentId) {
    entry.agentId = agentId;
  }

  if (timestamp) {
    entry.timestamp = timestamp;
  }

  return entry;
}

// ============================================================================
// SYSTEM ENTRY
// ============================================================================

export interface SystemEntryOptions {
  /** Parent UUID */
  parentUuid?: string | null;
  /** Session ID (defaults to TEST_SESSION_ID) */
  sessionId?: string;
  /** Model name (defaults to TEST_MODEL) */
  model?: string;
  /** Working directory (defaults to TEST_CWD) */
  cwd?: string;
  /** Available tools */
  tools?: string[];
}

/**
 * Creates a system init entry with sensible defaults.
 *
 * @param uuid - Unique identifier for this entry (defaults to "sys-init")
 * @param options - Additional options
 *
 * @example
 * ```ts
 * // Basic system init
 * systemEntry()
 *
 * // Custom settings
 * systemEntry("sys1", { tools: ["Read", "Write"], model: "claude-opus" })
 * ```
 */
export function systemEntry(
  uuid: string = "sys-init",
  options: SystemEntryOptions = {}
): SystemEntry {
  const {
    parentUuid,
    sessionId = TEST_SESSION_ID,
    model = TEST_MODEL,
    cwd = TEST_CWD,
    tools = [],
  } = options;

  const entry: SystemEntry = {
    type: "system",
    subtype: "init",
    uuid,
    session_id: sessionId,
    cwd,
    tools,
    model,
  };

  if (parentUuid !== undefined) {
    entry.parentUuid = parentUuid;
  }

  return entry;
}

// ============================================================================
// RESULT ENTRY
// ============================================================================

export interface ResultEntryOptions {
  /** Parent UUID */
  parentUuid?: string | null;
  /** Session ID (defaults to TEST_SESSION_ID) */
  sessionId?: string;
  /** Whether the result was successful (defaults to true) */
  success?: boolean;
  /** Duration in milliseconds (defaults to 1000) */
  durationMs?: number;
  /** Total cost in USD */
  costUsd?: number;
}

/**
 * Creates a result entry with sensible defaults.
 *
 * @param uuid - Unique identifier for this entry
 * @param resultText - The result message
 * @param options - Additional options
 *
 * @example
 * ```ts
 * // Successful result
 * resultEntry("r1", "Task completed")
 *
 * // With cost and duration
 * resultEntry("r2", "Done", { durationMs: 5000, costUsd: 0.05 })
 *
 * // Error result
 * resultEntry("r3", "Failed to complete", { success: false })
 * ```
 */
export function resultEntry(
  uuid: string,
  resultText: string = "Done",
  options: ResultEntryOptions = {}
): ResultEntry {
  const {
    parentUuid,
    sessionId = TEST_SESSION_ID,
    success = true,
    durationMs = 1000,
    costUsd,
  } = options;

  const entry: ResultEntry = {
    type: "result",
    subtype: success ? "success" : "error",
    uuid,
    session_id: sessionId,
    result: resultText,
    duration_ms: durationMs,
  };

  if (parentUuid !== undefined) {
    entry.parentUuid = parentUuid;
  }

  if (costUsd !== undefined) {
    entry.total_cost_usd = costUsd;
  }

  return entry;
}

// ============================================================================
// COMPACT BOUNDARY ENTRY
// ============================================================================

export interface CompactBoundaryEntryOptions {
  /** UUID of the last entry before compaction */
  logicalParentUuid?: string;
  /** What triggered the compaction (defaults to "auto") */
  trigger?: string;
  /** Token count before compaction (defaults to 170000) */
  preTokens?: number;
  /** Session ID (defaults to TEST_SESSION_ID) */
  sessionId?: string;
  /** Timestamp */
  timestamp?: string;
}

/**
 * Creates a compact_boundary system entry with sensible defaults.
 *
 * Mirrors the real structure from Claude Code sessions:
 * - parentUuid is always null (starts a new conversation root)
 * - logicalParentUuid points to the last pre-compaction entry
 * - compactMetadata has trigger and preTokens
 *
 * @param uuid - Unique identifier for this entry
 * @param options - Additional options
 *
 * @example
 * ```ts
 * // Basic compaction boundary
 * compactBoundaryEntry("cb1")
 *
 * // With custom metadata
 * compactBoundaryEntry("cb1", {
 *   logicalParentUuid: "a5",
 *   preTokens: 172646,
 *   timestamp: "2026-02-13T14:55:14.557Z",
 * })
 * ```
 */
export function compactBoundaryEntry(
  uuid: string,
  options: CompactBoundaryEntryOptions = {}
): CompactBoundaryEntry {
  const {
    logicalParentUuid = "pre-compact-001",
    trigger = "auto",
    preTokens = 170000,
    sessionId = TEST_SESSION_ID,
    timestamp = "2025-01-15T12:00:00.000Z",
  } = options;

  return {
    type: "system",
    subtype: "compact_boundary",
    uuid,
    parentUuid: null,
    session_id: sessionId,
    timestamp,
    logicalParentUuid,
    compactMetadata: {
      trigger,
      preTokens,
    },
    content: "Conversation compacted",
    level: "info",
  };
}
