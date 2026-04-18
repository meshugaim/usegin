/**
 * Decorate a `DecoratedCommit` with `session` context (slice 4 — ENG-5043).
 *
 * When the commit body contains a `Claude-Session: <uuid>` trailer, this
 * module:
 *   1. Extracts the UUID (last-match-wins for amended commits).
 *   2. Resolves the session JSONL locally, auto-fetching from remote
 *      archive when missing.
 *   3. Parses the session and runs the ENG-5042 extractors
 *      (`extractIntent` / `extractTrigger` / `extractOutcome`).
 *   4. Returns a copy of the commit with `commit.session` populated.
 *
 * On `SessionNotFoundError` from the local+remote search: degrades
 * gracefully — returns `commit.session = { id, sinceTimestampCmd }` with
 * no extractors (AC 13). Other errors propagate so real failures (a
 * corrupted JSONL, permission denied, etc.) remain visible.
 *
 * Dependency injection shape (the `SessionDeps` arg) exists for testing:
 * integration tests stub `fetchSession` to throw `SessionNotFoundError`
 * (or an arbitrary generic `Error`) and assert the classification,
 * without the subprocess cost of seeding the archive machinery. Prod
 * callers pass the real implementations from `../../fetch.ts` /
 * `../../finder/resolve.ts` / `../../parser.ts`.
 */

import type { ParsedSession } from "../../types";
import type { FetchResult } from "../../fetch";
import { SessionNotFoundError } from "../../errors";
import { extractClaudeSessionTrailer } from "./trailers";
import { formatSinceTimestamp } from "./format";
import {
  extractIntent,
  extractTrigger,
  extractOutcome,
} from "./context";
import type { DecoratedCommit } from "./types";

/**
 * Short-SHA length used in the `(→ session <shortId> --since-timestamp …)`
 * hint. Matches the 8-char short SHA from the header line (spec "Concrete
 * example": `session 533a2546 --since-timestamp …`).
 *
 * Deliberately a constant rather than reusing the header's short-SHA
 * magic number because the two values could in theory diverge (a future
 * tweak might want the hint at 7 or 12 chars while keeping the header
 * at 8). Pinning here keeps the intention explicit.
 */
const SESSION_SHORT_ID_LEN = 8;

/**
 * Dependency hooks for `decorateCommitWithSession`.
 *
 * Exposed so integration tests can stub session resolution /
 * SessionNotFound classification without subprocess + archive seeding.
 * Prod wiring threads the real functions from `../../fetch.ts` /
 * `../../finder/resolve.ts` / `../../parser.ts` — see `code-history.ts`
 * for the default composition.
 */
export interface SessionDeps {
  /** Resolve a session ID (or prefix) to a local JSONL path, fetching from remote if needed. */
  fetchSession: (input: string) => Promise<FetchResult>;
  /** Parse a local JSONL file into a structured session. */
  parseSession: (jsonlPath: string) => Promise<ParsedSession>;
}

/**
 * Compose the `(→ session <shortId> --since-timestamp <t-30m>)` hint
 * string the session line renders in its tail.
 *
 * Centralized because the Red-phase `formatSessionBlock` unit tests
 * compose this literal too — keeping the string shape in one place
 * prevents drift between the pipeline and the formatter's fixtures.
 */
function composeSinceTimestampCmd(uuid: string, commitISO: string): string {
  const shortId = uuid.slice(0, SESSION_SHORT_ID_LEN);
  const since = formatSinceTimestamp(commitISO);
  return `session ${shortId} --since-timestamp ${since}`;
}

/**
 * Decorate `commit` with session context when it carries a
 * `Claude-Session:` trailer. Returns the original commit unchanged when
 * no trailer is present. Always returns a new object when decoration
 * happens (no mutation of the input).
 *
 * See module header for error-handling contract. Tests live in
 * `code-history.test.ts` (integration via subprocess) and
 * `session-decorate.test.ts` (in-process failure classification).
 */
export async function decorateCommitWithSession(
  _commit: DecoratedCommit,
  _deps: SessionDeps,
): Promise<DecoratedCommit> {
  // Red-phase stub — populates a pinned `<unimplemented>` sentinel
  // session so EVERY test.failing assertion (including the
  // "no-trailer → session absent" case) fails at the assertion level
  // rather than passing by accident. Green phase replaces this with
  // the real extract → compose → deps → populate flow.
  return {
    ..._commit,
    session: {
      id: "<unimplemented>",
      sinceTimestampCmd: "<unimplemented>",
    },
  };
}

// Re-export so callers can catch the classification. Keeping this
// re-export co-located with the decorate function means consumers
// importing from this module see the full contract (function +
// exceptions) without reaching into `../../errors`.
export { SessionNotFoundError };

// Declare these imports as `used` in the public API surface so the
// decorator's implementation (Green phase) has them wired. The
// extractors are not yet referenced in the Red stub — they're imported
// here so the module graph is complete from the Red phase onward.
//
// This is a deliberate choice, not an oversight: wiring the imports in
// Red makes the Green edit a pure logic change, not a logic+imports
// change, which keeps the Green diff narrowly-scoped to behavior.
void extractClaudeSessionTrailer;
void composeSinceTimestampCmd;
void extractIntent;
void extractTrigger;
void extractOutcome;
