/**
 * Decorate a `DecoratedCommit` with `linear` context (slice 5 — ENG-5044).
 *
 * Responsibility split (mirrors `session-decorate.ts` for review
 * symmetry — slices 4/5 share one decorator shape, one DI pattern, one
 * "missing layer → omit + optional warning" story):
 *
 *   1. Extract the first `ENG-\d+` from the RAW commit body via
 *      `extractLinearRef` (see `./linear.ts` for the raw-body-not-
 *      trailer-stripped rationale).
 *   2. If no ref found: return the commit unchanged. No `linear`
 *      field, no stderr warning — "no ENG ref in body" is the normal
 *      case, not a failure (AC 9 missing-layer invariant).
 *   3. If ref found: call `fetchLinearIssue(id)` (injectable via
 *      {@link DecorateLinearDeps}). On a non-null result, populate
 *      `commit.linear = { id, title, status }`.
 *   4. On a null result: emit the single-line stderr warning naming
 *      the issue id (AC 18) via the injectable `warn` hook, leaving
 *      `commit.linear` absent so the plain renderer omits the line.
 *
 * All failures collapse into one path (null from fetch → warn +
 * omit). `fetchLinearIssue` owns the subprocess/JSON/timeout/partial
 * failure classification; this decorator only cares about "we tried
 * to fetch and got nothing". That split keeps the warning shape
 * independent of the specific failure mode (spec AC 18 pins ONE
 * line, naming the id — it doesn't prescribe different wording for
 * timeouts vs nonzero exits).
 *
 * Dependency injection (`DecorateLinearDeps`) exists for testing:
 *   - Unit / integration tests stub `fetchLinearIssue` to return null
 *     or a specific {id, title, status} without spawning `plan`.
 *   - Tests stub `warn` to capture stderr output without redirecting
 *     a real stderr handle. Prod callers pass
 *     `(msg) => console.error(msg)`.
 *
 * Unlike `session-decorate`, this decorator has NO classification of
 * errors — every failure is null. That's a spec-explicit G4 call:
 * AC 18 says "on ANY failure, skip the line and warn".
 */

import { extractLinearRef, fetchLinearIssue as realFetchLinearIssue } from "./linear";
import type { LinearIssue } from "./linear";
import type { DecoratedCommit } from "./types";

/**
 * Dependency hooks for `decorateCommitWithLinear`.
 *
 * Exposed so tests can stub:
 *   - `fetchLinearIssue` — unit-test the decorator without spawning
 *     `plan show`. Tests pass a canned {id, title, status} for happy
 *     path, `null` for AC-18 failure paths (timeout, nonzero exit,
 *     malformed JSON, missing `plan` CLI — all collapse to null).
 *   - `warn` — capture the AC-18 single-line stderr warning in-memory
 *     rather than redirecting stderr. Prod wires `console.error`.
 *
 * Prod wiring (see `code-history.ts`) threads the real `fetchLinearIssue`
 * from `./linear.ts` and `(msg) => console.error(msg)`.
 */
export interface DecorateLinearDeps {
  /** Fetch a Linear issue by ENG id. Returns null on any failure. */
  fetchLinearIssue: (id: string) => Promise<LinearIssue | null>;
  /** Emit a single-line stderr warning (AC 18). */
  warn: (message: string) => void;
}

/**
 * Canonical AC-18 warning shape, pinned so the decorator, test
 * assertions, and future grep-friendly tooling share one format.
 *
 * The spec AC 18 says "single one-line warning naming the issue id".
 * This helper produces:
 *
 *   `Warning: plan show <id> failed; linear context skipped`
 *
 * `Warning:` (capital W) matches the dominant shape across the
 * `session` CLI (`list.ts`, `find.ts` — `console.error(\`Warning:
 * …\`)`). Keeping the prefix consistent across commands means
 * greps like `rg '^Warning:'` stay stable as slices 5/6/… add more
 * stderr writes.
 *
 * Exported so tests can assert on the exact bytes without hardcoding
 * the template separately.
 */
export function formatLinearWarning(id: string): string {
  return `Warning: plan show ${id} failed; linear context skipped`;
}

/**
 * Decorate `commit` with Linear issue context when its body mentions
 * an `ENG-\d+` reference. Returns the original commit unchanged when
 * no ref is found. Always returns a new object when decoration
 * happens (no mutation of the input).
 *
 * See module header for the full failure-handling contract.
 */
export async function decorateCommitWithLinear(
  commit: DecoratedCommit,
  deps: DecorateLinearDeps,
): Promise<DecoratedCommit> {
  // Red stub — returns the commit unchanged. Tests that assert on
  // `commit.linear` being populated (happy path) fail at the
  // assertion level; tests that assert on "no linear / no warning"
  // for the no-ENG-ref path would trivially pass today, so those
  // are marked `test.failing` too until Green verifies via the
  // positive counter-test that the decorator is actually wired.
  void commit;
  void deps;
  void extractLinearRef;
  void realFetchLinearIssue;
  return commit;
}
