/**
 * Session factory functions for session parsing tests.
 *
 * These create ParsedSession objects with all required fields
 * filled in with sensible defaults.
 *
 * @example
 * ```ts
 * import { makeSession, userTurn, assistantTurn } from "./testing";
 *
 * const session = makeSession({
 *   turns: [
 *     userTurn("u1", "Hello"),
 *     assistantTurn("a1", "Hi there!"),
 *   ],
 * });
 * ```
 */

import type { ParsedSession, ParsedSubagent, Turn, RewindInfo, CommitInfo } from "../types";
import { TEST_SESSION_ID, TEST_MODEL, TEST_CWD } from "./fixtures";

/**
 * Creates a ParsedSession with all required fields and sensible defaults.
 *
 * @param overrides - Fields to override from defaults
 *
 * @example
 * ```ts
 * // Empty session
 * makeSession()
 *
 * // With turns
 * makeSession({
 *   turns: [
 *     userTurn("u1", "Hello"),
 *     assistantTurn("a1", "Hi!"),
 *   ],
 * })
 *
 * // With everything
 * makeSession({
 *   sessionId: "custom-session",
 *   model: "claude-opus",
 *   turns: [...],
 *   subagents: [...],
 *   triggeredSkills: ["writing-specs"],
 *   summary: "Implemented a feature",
 * })
 * ```
 */
export function makeSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: TEST_SESSION_ID,
    cwd: TEST_CWD,
    model: TEST_MODEL,
    tools: [],
    turns: [],
    subagents: [],
    rewinds: [],
    triggeredSkills: [],
    commits: [],
    ...overrides,
  };
}

/**
 * Creates a ParsedSubagent with sensible defaults.
 *
 * @param agentId - Unique ID for the subagent
 * @param turns - Turns in the subagent conversation
 * @param options - Additional options
 *
 * @example
 * ```ts
 * makeSubagent("agent-123", [
 *   assistantTurn("a1", "Searching..."),
 *   userTurn("u1", "", { toolResults: [toolResult("t1", "found it")] }),
 * ])
 * ```
 */
export function makeSubagent(
  agentId: string,
  turns: Turn[] = [],
  options: { sessionId?: string; startTimestamp?: string } = {}
): ParsedSubagent {
  const { sessionId = TEST_SESSION_ID, startTimestamp } = options;

  return {
    agentId,
    sessionId,
    turns,
    ...(startTimestamp ? { startTimestamp } : {}),
  };
}

/**
 * Creates a RewindInfo object.
 *
 * @param fromUuid - The UUID we rewound from
 * @param abandonedBranchUuids - UUIDs of messages on the abandoned branch
 *
 * @example
 * ```ts
 * makeRewind("a1", ["u2", "a2"]) // Rewound after a1, abandoning u2 and a2
 * ```
 */
export function makeRewind(
  fromUuid: string,
  abandonedBranchUuids: string[]
): RewindInfo {
  return { fromUuid, abandonedBranchUuids };
}

/**
 * Creates a CommitInfo object.
 *
 * @param hash - Commit hash (short or full)
 * @param message - Commit message (first line)
 *
 * @example
 * ```ts
 * makeCommit("abc1234", "fix: resolve login bug")
 * ```
 */
export function makeCommit(hash: string, message?: string): CommitInfo {
  return { hash, ...(message ? { message } : {}) };
}
