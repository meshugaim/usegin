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
export const LINEAR_REF_RE = /ENG-\d+/;

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
  return LINEAR_REF_RE.exec(body)?.[0] ?? null;
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
  // One outer try/catch: spec AC 18 collapses every failure mode to
  // null (decorator owns the warning). Classifying here (timeout vs
  // ENOENT vs JSON.parse) would force the decorator to carry a
  // tagged-union back — instead the decorator is "we tried to fetch
  // and got nothing", keeping the warning template identical across
  // all failure modes (AC 18 pins ONE wording, naming the id).
  //
  // Covers:
  //   - Bun.spawn sync throw (ENOENT when `plan` is not on PATH)
  //   - AbortError raised via `AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS)`
  //   - Nonzero exit (we branch on `exitCode !== 0` → return null)
  //   - Malformed stdout (JSON.parse throws, caught below)
  //   - Partial response (type-narrow each required field; absent /
  //     non-string → return null without touching the happy-path
  //     return)
  let proc: ReturnType<typeof Bun.spawn> | undefined;
  try {
    proc = Bun.spawn(["plan", "show", id, "--json"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) return null;
    const stdout = await new Response(proc.stdout).text();
    const parsed = JSON.parse(stdout) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { identifier?: unknown }).identifier !== "string" ||
      typeof (parsed as { title?: unknown }).title !== "string" ||
      typeof (parsed as { status?: unknown }).status !== "string"
    ) {
      return null;
    }
    const record = parsed as {
      identifier: string;
      title: string;
      status: string;
    };
    // G3: title truncation at the extractor boundary mirrors ENG-5042.
    // `truncate` never returns null when called with a non-null string,
    // but its signature includes the null-overload so the `!` is needed.
    return {
      id: record.identifier,
      title: truncate(record.title)!,
      status: record.status,
    };
  } catch {
    return null;
  } finally {
    // `AbortSignal.timeout` SIGTERMs the direct `plan` child, but any
    // grandchild it spawned (a bash wrapper `exec`'ing + spawning
    // `sleep`, say — or, in the integration tests' fake, literal
    // `sleep 10`) inherits the stdout/stderr pipe fds and keeps them
    // open until it exits naturally. Bun's event loop stays alive
    // waiting on those read ends, which means the whole
    // `code-history` process hangs until the grandchild finishes —
    // erasing the user-visible benefit of the timeout.
    //
    // `unref` drops the event-loop refcount for the subprocess so
    // the parent can exit cleanly even though the fds are still held
    // downstream. Safe to call post-`await proc.exited`: we've
    // already read everything we need (or gave up).
    try {
      proc?.unref();
    } catch {
      // Some proc shapes may not expose `unref` in older Bun; swallow.
    }
  }
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
  if (linear === undefined) return null;
  // 4-space indent + `linear:` (7 chars) + 3 spaces → value column 14,
  // matching `session:` / `body:`. Fields separated by 2 spaces, status
  // wrapped in brackets. Layout pinned by `linear.test.ts`.
  return `    linear:   ${linear.id}  ${linear.title}  [${linear.status}]`;
}
