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

import type {
  ParsedSession,
  ParsedSubagent,
  Turn,
  TokenUsage,
  RewindInfo,
  CommitInfo,
  SessionId,
  AgentId,
  EntryUuid,
} from "../types";
import type { GitCommit } from "../git-commits";
import { asSessionId, asAgentId, asEntryUuid } from "../types";
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
 *   sessionId: asSessionId("custom-session"),
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
 * @param agentId - Unique ID for the subagent (string or AgentId)
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
  agentId: string | AgentId,
  turns: Turn[] = [],
  options: {
    sessionId?: string | SessionId;
    startTimestamp?: string;
    tokenUsage?: TokenUsage;
  } = {}
): ParsedSubagent {
  const { sessionId = TEST_SESSION_ID, startTimestamp, tokenUsage } = options;

  return {
    agentId: typeof agentId === "string" ? asAgentId(agentId) : agentId,
    sessionId: typeof sessionId === "string" ? asSessionId(sessionId) : sessionId,
    turns,
    ...(startTimestamp ? { startTimestamp } : {}),
    ...(tokenUsage ? { tokenUsage } : {}),
  };
}

/**
 * Creates a RewindInfo object.
 *
 * @param fromUuid - The UUID we rewound from (string or EntryUuid)
 * @param abandonedBranchUuids - UUIDs of messages on the abandoned branch
 *
 * @example
 * ```ts
 * makeRewind("a1", ["u2", "a2"]) // Rewound after a1, abandoning u2 and a2
 * ```
 */
export function makeRewind(
  fromUuid: string | EntryUuid,
  abandonedBranchUuids: (string | EntryUuid)[]
): RewindInfo {
  return {
    fromUuid: typeof fromUuid === "string" ? asEntryUuid(fromUuid) : fromUuid,
    abandonedBranchUuids: abandonedBranchUuids.map((u) =>
      typeof u === "string" ? asEntryUuid(u) : u
    ),
  };
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

/**
 * Creates a GitCommit object (from git history) with sensible defaults.
 *
 * @param shortHash - 7-character abbreviated hash
 * @param subject - First line of commit message
 * @param options - Override any field (insertions, deletions, filesChanged, etc.)
 *
 * @example
 * ```ts
 * makeGitCommit("abc1234", "fix: login bug", { insertions: 42, deletions: 7 })
 * ```
 */
export function makeGitCommit(
  shortHash: string,
  subject: string,
  options: Partial<Omit<GitCommit, "shortHash" | "subject">> = {}
): GitCommit {
  const {
    hash = shortHash.padEnd(40, "0"),
    authorName = "Test Author",
    authorEmail = "test@example.com",
    timestamp = "2025-01-15T10:00:00+00:00",
    ...rest
  } = options;

  return {
    hash,
    shortHash,
    subject,
    authorName,
    authorEmail,
    timestamp,
    ...rest,
  };
}
