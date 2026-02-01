/**
 * Common test fixtures for session parsing tests.
 *
 * These provide stable values that make test assertions predictable
 * and reduce magic strings scattered throughout test files.
 *
 * @example
 * ```ts
 * import { TEST_SESSION_ID, TEST_MODEL } from "./testing";
 *
 * const entries = [systemEntry({ session_id: TEST_SESSION_ID })];
 * ```
 */

/** Default session ID for tests. Short and recognizable. */
export const TEST_SESSION_ID = "test-session";

/** Default model name for tests. */
export const TEST_MODEL = "claude-test";

/** Default working directory for tests. */
export const TEST_CWD = "/test/workspace";

/** Standard timestamp for tests (ISO 8601). */
export const TEST_TIMESTAMP = "2025-01-15T10:00:00.000Z";

/**
 * UUID generator for tests.
 * Creates sequential, predictable UUIDs like "uuid-001", "uuid-002".
 *
 * @example
 * ```ts
 * const gen = createUuidGenerator();
 * gen() // "uuid-001"
 * gen() // "uuid-002"
 * ```
 */
export function createUuidGenerator(prefix = "uuid"): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `${prefix}-${String(counter).padStart(3, "0")}`;
  };
}

/**
 * Timestamp generator for tests.
 * Creates sequential timestamps incrementing by 1 minute.
 *
 * @example
 * ```ts
 * const gen = createTimestampGenerator();
 * gen() // "2025-01-15T10:00:00.000Z"
 * gen() // "2025-01-15T10:01:00.000Z"
 * ```
 */
export function createTimestampGenerator(
  start: Date = new Date(TEST_TIMESTAMP)
): () => string {
  let current = new Date(start);
  return () => {
    const result = current.toISOString();
    current = new Date(current.getTime() + 60 * 1000); // +1 minute
    return result;
  };
}
