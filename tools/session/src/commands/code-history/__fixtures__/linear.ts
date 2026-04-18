/**
 * Shared Linear-line test fixtures for `session code-history` (slice 5 —
 * ENG-5044).
 *
 * These constants pin the exact ENG id + title + status strings the
 * slice-5 tests assert against. Centralized here so format-layer tests
 * (`linear.test.ts`), decorator-layer tests (`linear-decorate.test.ts`),
 * and integration tests (`code-history.test.ts`) share the same
 * literal — drift between layers would let one layer assert a
 * `[status]` the other couldn't reproduce.
 *
 * Slice 6 (`--json` mode, ENG-5045) will consume the same constants.
 * Keep this module scoped to things that cross test-file boundaries —
 * single-file constants stay inside that file.
 */

/**
 * Canonical ENG identifier used across the Linear-line tests. Matches
 * the spec's "Concrete example" so reviewers can align the rendered
 * block in tests with the rendered block in the ENG-5039 spec doc.
 */
export const LINEAR_FIXTURE_ID = "ENG-5039";

/**
 * Canonical issue title. Short enough to fit under `truncate`'s 200-char
 * cap, so `formatLinearLine` tests assert on the verbatim bytes without
 * worrying about ellipsis drift. Tests that EXERCISE truncation build
 * their own over-long titles locally rather than mutating this fixture.
 */
export const LINEAR_FIXTURE_TITLE =
  "feat(tools/session): code-history — commit + transcript context per line";

/**
 * Canonical state display name. Matches what `plan show` emits for
 * the `status` field (Linear's workflow state `name`).
 */
export const LINEAR_FIXTURE_STATUS = "In Progress";

/**
 * The full expected `linear:` line for the canonical fixture. Pinned
 * bytes so the format tests, decorator tests, and integration tests
 * all reference ONE string — wording / spacing / bracket drift breaks
 * a single constant rather than scattering fixups across files.
 *
 * Layout: 4-space indent + `linear:` + 3 spaces + id + 2 spaces +
 * title + 2 spaces + `[status]`. Matches `formatLinearLine`'s pinned
 * shape (see that function's docstring).
 */
export const EXPECTED_LINEAR_LINE =
  `    linear:   ${LINEAR_FIXTURE_ID}  ${LINEAR_FIXTURE_TITLE}  [${LINEAR_FIXTURE_STATUS}]`;
