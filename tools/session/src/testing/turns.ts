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

import type { Turn, ToolCall, ToolResult } from "../types";

// ============================================================================
// TURN FACTORIES
// ============================================================================

export interface TurnOptions {
  /** Parent UUID for conversation linking */
  parentUuid?: string | null;
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
 * @param uuid - Unique identifier for this turn
 * @param text - User message text
 * @param options - Additional options
 *
 * @example
 * ```ts
 * userTurn("u1", "Hello")
 * userTurn("u2", "", { toolResults: [{ toolUseId: "t1", content: "data", isError: false }] })
 * ```
 */
export function userTurn(
  uuid: string,
  text: string,
  options: TurnOptions = {}
): Turn {
  const {
    parentUuid,
    isOnCurrentBranch = true,
    toolCalls = [],
    toolResults = [],
  } = options;

  return {
    role: "user",
    uuid,
    text,
    toolCalls,
    toolResults,
    isOnCurrentBranch,
    ...(parentUuid !== undefined ? { parentUuid } : {}),
  };
}

/**
 * Creates an assistant turn with sensible defaults.
 *
 * @param uuid - Unique identifier for this turn
 * @param text - Assistant response text
 * @param options - Additional options
 *
 * @example
 * ```ts
 * assistantTurn("a1", "Hello!")
 * assistantTurn("a2", "Let me check", {
 *   toolCalls: [{ id: "t1", name: "Read", input: { file_path: "/test.ts" } }]
 * })
 * ```
 */
export function assistantTurn(
  uuid: string,
  text: string,
  options: TurnOptions = {}
): Turn {
  const {
    parentUuid,
    isOnCurrentBranch = true,
    toolCalls = [],
    toolResults = [],
  } = options;

  return {
    role: "assistant",
    uuid,
    text,
    toolCalls,
    toolResults,
    isOnCurrentBranch,
    ...(parentUuid !== undefined ? { parentUuid } : {}),
  };
}

// ============================================================================
// TOOL CALL HELPERS
// ============================================================================

/**
 * Creates a tool call object.
 *
 * @example
 * ```ts
 * toolCall("t1", "Read", { file_path: "/src/index.ts" })
 * toolCall("t2", "Bash", { command: "ls -la" })
 * ```
 */
export function toolCall(
  id: string,
  name: string,
  input: Record<string, unknown> = {}
): ToolCall {
  return { id, name, input };
}

/**
 * Creates a tool result object.
 *
 * @example
 * ```ts
 * toolResult("t1", "file contents here")
 * toolResult("t2", "File not found", true) // error
 * ```
 */
export function toolResult(
  toolUseId: string,
  content: string,
  isError: boolean = false
): ToolResult {
  return { toolUseId, content, isError };
}
