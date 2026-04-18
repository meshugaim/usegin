/**
 * Shared session-block test fixtures for `session code-history`.
 *
 * These constants pin the exact UUID + short-ID + hint-command shape
 * the slice-4 tests assert against. Centralized here so format-layer
 * tests (`format.test.ts`) and decorator-layer tests
 * (`session-decorate.test.ts`) can import the same literal — drift
 * between them would let one layer assert on a hint the other layer
 * couldn't reproduce.
 *
 * Slice 5 (Linear line, ENG-5044) and slice 6 (`--json` mode) will
 * grow this module with matching pinned fixtures for their own
 * assertions. Keep it scoped to things that cross test-file
 * boundaries — single-file constants stay in that file.
 */

/**
 * Canonical UUID used across the session-block tests. Full 36-char
 * form; the first 8 chars appear in the `--since-timestamp` hint.
 *
 * Pinned from the ENG-5039 "Concrete example" for shape parity with
 * the spec's rendering.
 */
export const SESSION_FIXTURE_ID = "533a2546-684a-4724-b592-34aa88aac626";

/**
 * Short form of {@link SESSION_FIXTURE_ID} (first 8 chars). Appears
 * in the `(→ session <shortId> --since-timestamp …)` hint rendered
 * on the session line.
 */
export const SESSION_FIXTURE_SHORT_ID = "533a2546";

/**
 * Canonical `sinceTimestampCmd` string used in tests. Mirrors what
 * the pipeline produces at runtime (`session <shortId> --since-timestamp
 * <t-30m>`). Kept as a literal here because the tests pin the block
 * bytes exactly — deriving it from `formatSinceTimestamp` would couple
 * these tests to that helper's Green-phase correctness.
 *
 * Corresponds to a commit timestamp of `2026-04-18T08:43:00+00:00`
 * (see fixture commits in `session-decorate.test.ts`): 08:43 minus
 * 30m = 08:13.
 */
export const EXPECTED_HINT_CMD =
  `session ${SESSION_FIXTURE_SHORT_ID} --since-timestamp 2026-04-18T08:13Z`;
