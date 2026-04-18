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
 * Dependency injection shape (the `DecorateSessionDeps` arg) exists for testing:
 * integration tests stub `fetchSession` to throw `SessionNotFoundError`
 * (or an arbitrary generic `Error`) and assert the classification,
 * without the subprocess cost of seeding the archive machinery. Prod
 * callers pass the real implementations from `../../fetch.ts` /
 * `../../finder/resolve.ts` / `../../parser.ts`.
 */

import type { ParsedSession } from "../../types";
import type { FetchResult } from "../../fetch";
import { SessionNotFoundError } from "../../errors";
import type { DecoratedCommit } from "./types";

/**
 * Dependency hooks for `decorateCommitWithSession`.
 *
 * Exposed so integration tests can stub session resolution /
 * SessionNotFound classification without subprocess + archive seeding.
 * Prod wiring threads the real functions from `../../fetch.ts` /
 * `../../finder/resolve.ts` / `../../parser.ts` — see `code-history.ts`
 * for the default composition.
 */
export interface DecorateSessionDeps {
  /** Resolve a session ID (or prefix) to a local JSONL path, fetching from remote if needed. */
  fetchSession: (input: string) => Promise<FetchResult>;
  /** Parse a local JSONL file into a structured session. */
  parseSession: (jsonlPath: string) => Promise<ParsedSession>;
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
  _deps: DecorateSessionDeps,
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
