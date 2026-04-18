/**
 * Linear integration for `session code-history` (slice 5 — ENG-5044).
 *
 * This module owns the three steps that turn a commit body into a
 * `DecoratedCommit.linear` record:
 *
 *   1. {@link extractLinearRef}  — scan the RAW body (including trailers)
 *      for the first `ENG-\d+` occurrence. The first-match rule is
 *      spec-explicit (ENG-5039 Algorithm step 5b) — no multi-issue
 *      handling in v1.
 *   2. {@link fetchLinearIssue}  — spawn `plan show <id> --json`,
 *      parse `{ identifier, title, status }` from the JSON, apply
 *      `truncate` to the title (ENG-5042 consistency). Returns `null`
 *      on ANY failure: nonzero exit, timeout (5s via
 *      `AbortSignal.timeout`), missing `plan` CLI, unparseable JSON,
 *      or partial response (any of the three required fields absent
 *      or non-string).
 *   3. {@link formatLinearLine}  — render the one-line output for the
 *      plain-mode block at 4-space indent. Returns `null` when the
 *      commit has no `linear` field populated (AC 9 missing-layer
 *      invariant).
 *
 * The module does NOT use `stripTrailers` — we scan the FULL body
 * because the ENG ref frequently lives in a `Part of: ENG-XXXX` or
 * `Closes: ENG-XXXX` trailer (forward-pointer context from prior
 * slices).
 *
 * Failure → null contract (G4): every failure path in
 * `fetchLinearIssue` collapses to `null`. The decorator
 * (`decorateCommitWithLinear`, in `linear-decorate.ts`) is responsible
 * for translating null into (a) omitting the `linear` key and (b)
 * emitting the AC-18 stderr warning naming the issue id. Splitting
 * these concerns keeps `fetchLinearIssue` pure (no side effects, no
 * stderr) and lets tests assert on the warning separately.
 */

import { truncate } from "./context";
import type { DecoratedCommit } from "./types";

/**
 * Spec-pinned regex for extracting an ENG reference from a commit body.
 * `ENG-` followed by one or more digits. First match wins.
 *
 * Non-global — we only want the first match and want the capture to
 * behave as a single-match result. If a future slice needs all matches,
 * switch callers to `matchAll` and an `/ENG-\d+/g` form.
 */
const LINEAR_REF_RE = /ENG-\d+/;

/**
 * Subprocess timeout for `plan show` (G1). 5 seconds tolerates
 * startup + heavy JSON while keeping `code-history` snappy when the
 * `plan` CLI or the Linear backend hiccups.
 *
 * Exported for tests that want to simulate / assert against the
 * timeout shape without hardcoding the literal twice.
 */
export const LINEAR_FETCH_TIMEOUT_MS = 5000;

/**
 * Extract the first `ENG-\d+` reference from a commit body.
 *
 * Returns `null` when the body contains no ENG reference, the first
 * match (verbatim) otherwise.
 *
 * Scans the RAW body — trailers are NOT stripped first. A `Part of:`
 * or `Closes:` trailer is a valid source of the ENG ref (and often
 * the only source), so `stripTrailers` would defeat the extractor for
 * the majority of commits in this codebase.
 *
 * First-match-only (G2 — spec-explicit): a body that mentions
 * `ENG-100` then `ENG-200` returns `ENG-100`. No ambiguity, no
 * multi-issue rendering in v1.
 */
export function extractLinearRef(body: string): string | null {
  // Red stub — returns a visible sentinel for EVERY input so unit
  // tests fail at the assertion level regardless of whether they
  // expect a match or `null`. Returning `null` from the stub would
  // silently pass the "no-match" tests against wrong behavior; this
  // distinct string keeps them honest until Green lands the real
  // regex.
  void body;
  // GREEN: replace with LINEAR_REF_RE.exec(body)?.[0] ?? null
  void LINEAR_REF_RE;
  return "<unimplemented-extractLinearRef>";
}

/**
 * Shape returned by `plan show <id> --json` that this module cares
 * about. Other fields (description, url, labels, etc.) are present in
 * the response but ignored here.
 *
 * `id` is the `identifier` field from the JSON (renamed to match the
 * `DecoratedCommit.linear.id` shape — the extractor owns the
 * naming symmetry between the two layers).
 */
export interface LinearIssue {
  id: string;
  title: string;
  status: string;
}

/**
 * Fetch a Linear issue by spawning `plan show <id> --json` and
 * parsing the response. Returns `null` on any failure (AC-18 + G4):
 *
 *   - `plan` CLI missing on PATH (ENOENT)
 *   - nonzero exit (unknown issue, Linear API error, auth failure)
 *   - timeout after {@link LINEAR_FETCH_TIMEOUT_MS} ms
 *   - malformed or non-JSON stdout
 *   - partial response — any of `identifier` / `title` / `status`
 *     absent or not a string (treated as malformed per G4).
 *
 * The caller (`decorateCommitWithLinear`) translates null → omit
 * `commit.linear` + emit stderr warning. This function is pure async
 * with no side effects of its own so it's subprocess-testable in
 * isolation.
 *
 * The returned `title` is already `truncate`d (CONTEXT_MAX_LEN=200 with
 * "…" ellipsis) for consistency with the session extractors (ENG-5042).
 */
export async function fetchLinearIssue(
  id: string,
): Promise<LinearIssue | null> {
  // Red stub — returns null so tests that assert on the happy path
  // fail at their expectations; tests that assert null-on-failure
  // pass today but are still listed under `test.failing` until Green
  // lands the real implementation, because without the real spawn
  // they're asserting a trivial always-null.
  void id;
  void truncate;
  return null;
}

/**
 * Render the plain-mode `linear:` line at 4-space top-level indent.
 *
 * Returns `null` when `linear` is `undefined` (AC 9 missing-layer
 * invariant — caller omits the line entirely, no placeholder, no
 * blank).
 *
 * Format (pinned by `linear.test.ts`):
 *
 *   `    linear:   <id>  <title>  [<status>]`
 *
 * Layout rules (mirror `formatSessionBlock` so slices 4/5/6 share one
 * column-alignment contract):
 *   - 4-space top-level indent.
 *   - `linear:` label (7 chars incl colon) padded to the same width as
 *     `session:` (8 chars incl colon) + 2 trailing spaces = value
 *     starts at column 14. `linear:` + 3 trailing spaces keeps the
 *     value column aligned with `session:`'s value column.
 *   - Fields separated by 2 spaces.
 *   - Status wrapped in square brackets — the bracket pair is the
 *     visual cue that this is metadata, not prose (matches the
 *     spec's "Concrete example").
 */
export function formatLinearLine(
  linear: DecoratedCommit["linear"],
): string | null {
  // Red stub — returns a non-null sentinel when `linear` is provided
  // so the format tests fail on exact-string mismatch, NOT on
  // null-vs-string. When `linear` is absent, null matches the
  // missing-layer invariant (so that assertion is effectively a
  // regression-guard today and stays true in Green).
  if (linear === undefined) return null;
  void linear;
  return "<unimplemented>";
}
