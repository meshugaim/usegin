/**
 * Testing utilities for session parsing tests.
 *
 * This module provides factory functions and fixtures for creating
 * test data. Import everything from this single entry point.
 *
 * @example
 * ```ts
 * import {
 *   // Entry factories
 *   userEntry,
 *   assistantEntry,
 *   systemEntry,
 *   resultEntry,
 *
 *   // Turn factories
 *   userTurn,
 *   assistantTurn,
 *   toolCall,
 *   toolResult,
 *
 *   // Session factories
 *   makeSession,
 *   makeSubagent,
 *   makeRewind,
 *   makeCommit,
 *
 *   // Fixtures
 *   TEST_SESSION_ID,
 *   TEST_MODEL,
 *   TEST_CWD,
 *   TEST_TIMESTAMP,
 *   createUuidGenerator,
 *   createTimestampGenerator,
 * } from "./testing";
 * ```
 *
 * ## Entry Factories
 *
 * Use these to create raw JSONL entry objects for testing the parser:
 *
 * ```ts
 * const entries = [
 *   systemEntry(),
 *   userEntry("u1", "Hello"),
 *   assistantEntry("a1", "Hi!", { parentUuid: "u1" }),
 * ];
 * const result = parseEntries(entries);
 * ```
 *
 * ## Turn Factories
 *
 * Use these to create parsed Turn objects for testing formatters:
 *
 * ```ts
 * const session = makeSession({
 *   turns: [
 *     userTurn("u1", "Hello"),
 *     assistantTurn("a1", "Hi there!", {
 *       toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
 *     }),
 *   ],
 * });
 * const output = formatNarrative(session);
 * ```
 *
 * ## Fixtures
 *
 * Use the constants for predictable test values:
 *
 * ```ts
 * expect(result.sessionId).toBe(TEST_SESSION_ID);
 * expect(result.model).toBe(TEST_MODEL);
 * ```
 *
 * Use generators for sequences:
 *
 * ```ts
 * const uuid = createUuidGenerator();
 * const entries = [
 *   userEntry(uuid(), "First"),   // uuid-001
 *   userEntry(uuid(), "Second"),  // uuid-002
 * ];
 * ```
 */

// Fixtures
export {
  TEST_SESSION_ID,
  TEST_MODEL,
  TEST_CWD,
  TEST_TIMESTAMP,
  createUuidGenerator,
  createAgentIdGenerator,
  createToolUseIdGenerator,
  createTimestampGenerator,
} from "./fixtures";

// Entry factories
export {
  userEntry,
  assistantEntry,
  systemEntry,
  resultEntry,
  type UserEntryOptions,
  type AssistantEntryOptions,
  type SystemEntryOptions,
  type ResultEntryOptions,
} from "./entries";

// Turn factories
export {
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
  type TurnOptions,
} from "./turns";

// Session factories
export {
  makeSession,
  makeSubagent,
  makeRewind,
  makeCommit,
  makeGitCommit,
} from "./sessions";
