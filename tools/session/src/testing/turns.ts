/**
 * Turn factory functions for session parsing tests.
 *
 * Turns are the parsed representation of entries. These factories
 * make it easy to construct Turn objects for testing formatters
 * and other code that works with ParsedSession data.
 *
 * @example
 * ```ts
 * import { userTurn, assistantTurn, makeSession } from "./testing";
 *
 * const session = makeSession({
 *   turns: [
 *     userTurn("u1", "Hello"),
 *     assistantTurn("a1", "Hi there!"),
 *   ],
 * });
 * ```
 */

import type { Turn, ToolCall, ToolResult, EntryUuid, ToolUseId } from "../types";
import { asEntryUuid, asToolUseId } from "../types";

// ============================================================================
// TURN FACTORIES
// ============================================================================

export interface TurnOptions {
  /** Parent UUID for conversation linking */
  parentUuid?: string | EntryUuid | null;
  /** Whether this turn is on the current branch (defaults to true) */
  isOnCurrentBranch?: boolean;
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[];
  /** Tool results in a user message */
  toolResults?: ToolResult[];
}

/**
 * Creates a user turn with sensible defaults.
 *
 * @param uuid - Unique identifier for this turn (string or EntryUuid)
 * @param text - User message text
 * @param options - Additional options
 *
 * @example
 * ```ts
 * userTurn("u1", "Hello")
 * userTurn("u2", "", { toolResults: [{ toolUseId: asToolUseId("t1"), content: "data", isError: false }] })
 * ```
 */
export function userTurn(
  uuid: string | EntryUuid,
  text: string,
  options: TurnOptions = {}
): Turn {
  const {
    parentUuid,
    isOnCurrentBranch = true,
    toolCalls = [],
    toolResults = [],
  } = options;

  const brandedUuid: EntryUuid = typeof uuid === "string" ? asEntryUuid(uuid) : uuid;
  const brandedParentUuid: EntryUuid | null | undefined =
    parentUuid === null
      ? null
      : parentUuid === undefined
        ? undefined
        : typeof parentUuid === "string"
          ? asEntryUuid(parentUuid)
          : parentUuid;

  return {
    role: "user",
    uuid: brandedUuid,
    text,
    toolCalls,
    toolResults,
    isOnCurrentBranch,
    ...(brandedParentUuid !== undefined ? { parentUuid: brandedParentUuid } : {}),
  };
}

/**
 * Creates an assistant turn with sensible defaults.
 *
 * @param uuid - Unique identifier for this turn (string or EntryUuid)
 * @param text - Assistant response text
 * @param options - Additional options
 *
 * @example
 * ```ts
 * assistantTurn("a1", "Hello!")
 * assistantTurn("a2", "Let me check", {
 *   toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })]
 * })
 * ```
 */
export function assistantTurn(
  uuid: string | EntryUuid,
  text: string,
  options: TurnOptions = {}
): Turn {
  const {
    parentUuid,
    isOnCurrentBranch = true,
    toolCalls = [],
    toolResults = [],
  } = options;

  const brandedUuid: EntryUuid = typeof uuid === "string" ? asEntryUuid(uuid) : uuid;
  const brandedParentUuid: EntryUuid | null | undefined =
    parentUuid === null
      ? null
      : parentUuid === undefined
        ? undefined
        : typeof parentUuid === "string"
          ? asEntryUuid(parentUuid)
          : parentUuid;

  return {
    role: "assistant",
    uuid: brandedUuid,
    text,
    toolCalls,
    toolResults,
    isOnCurrentBranch,
    ...(brandedParentUuid !== undefined ? { parentUuid: brandedParentUuid } : {}),
  };
}

// ============================================================================
// TOOL CALL HELPERS
// ============================================================================

/**
 * Creates a tool call object.
 *
 * @param id - Tool use ID (string or ToolUseId)
 * @param name - Tool name
 * @param input - Tool input parameters
 *
 * @example
 * ```ts
 * toolCall("t1", "Read", { file_path: "/src/index.ts" })
 * toolCall("t2", "Bash", { command: "ls -la" })
 * ```
 */
export function toolCall(
  id: string | ToolUseId,
  name: string,
  input: Record<string, unknown> = {}
): ToolCall {
  return {
    id: typeof id === "string" ? asToolUseId(id) : id,
    name,
    input,
  };
}

/**
 * Creates a tool result object.
 *
 * @param toolUseId - Tool use ID (string or ToolUseId)
 * @param content - Tool output content
 * @param isError - Whether this is an error result
 *
 * @example
 * ```ts
 * toolResult("t1", "file contents here")
 * toolResult("t2", "File not found", true) // error
 * ```
 */
export function toolResult(
  toolUseId: string | ToolUseId,
  content: string,
  isError: boolean = false
): ToolResult {
  return {
    toolUseId: typeof toolUseId === "string" ? asToolUseId(toolUseId) : toolUseId,
    content,
    isError,
  };
}
