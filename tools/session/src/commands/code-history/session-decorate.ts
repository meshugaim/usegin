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
import { extractIntent, extractTrigger, extractOutcome } from "./context";
import { formatSinceTimestamp } from "./format";
import { extractClaudeSessionTrailer } from "./trailers";
import type { DecoratedCommit } from "./types";

/** Length of the short session UUID embedded in the `sinceTimestampCmd`
 * hint — matches the 8-char short SHA used elsewhere in the formatter
 * so the `(→ session <shortId> …)` hint line-reads next to a commit's
 * short SHA without visual asymmetry. */
const SHORT_SESSION_ID_LEN = 8;

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
  commit: DecoratedCommit,
  deps: DecorateSessionDeps,
): Promise<DecoratedCommit> {
  const uuid = extractClaudeSessionTrailer(commit.body);
  if (uuid === null) {
    // No `Claude-Session:` trailer on this commit — nothing to decorate.
    // Return the input commit unchanged so the pipeline can fall through
    // to the body preview without emitting a session block.
    return commit;
  }

  // Compose the copy-paste hint up-front. AC 13 degradation still uses
  // this hint even when fetch fails, so it lives outside the try/catch.
  const shortId = uuid.slice(0, SHORT_SESSION_ID_LEN);
  const sinceTimestamp = formatSinceTimestamp(commit.committedAt);
  const sinceTimestampCmd =
    `session ${shortId} --since-timestamp ${sinceTimestamp}`;

  let parsed: ParsedSession;
  try {
    const fetchResult = await deps.fetchSession(uuid);
    parsed = await deps.parseSession(fetchResult.localPath);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      // AC 13 — session JSONL not available locally or in the archive.
      // Degrade to `{id, sinceTimestampCmd}` without extractors so the
      // session line + hint still render. Any OTHER error (malformed
      // JSONL, permission denied, etc.) propagates unmodified.
      return {
        ...commit,
        session: { id: uuid, sinceTimestampCmd },
      };
    }
    throw error;
  }

  // Extractors produce `null` when the session doesn't carry the
  // relevant turn shape (e.g. a non-commit-authoring session). Convert
  // `null` to "omit the key" so the renderer's `undefined`-check omits
  // the line entirely — no placeholder, no blank line.
  const intent = extractIntent(parsed.turns);
  const trigger = extractTrigger(parsed.turns, commit.sha);
  const outcome = extractOutcome(parsed.turns, commit.sha);

  const sessionCtx: NonNullable<DecoratedCommit["session"]> = {
    id: uuid,
    // `shortId` is populated ONLY on the fully-resolved path — the AC-13
    // degraded branch above returns before reaching here. Slice 6's JSON
    // mode relies on this split: `shortId` present → session was parsed
    // end-to-end; absent → we fell through to graceful degradation. Plain
    // mode doesn't surface `shortId` directly (it embeds the short form
    // inside `sinceTimestampCmd`), so the field is inert for plain output.
    shortId: shortId,
    sinceTimestampCmd,
  };
  if (intent !== null) sessionCtx.intent = intent;
  if (trigger !== null) sessionCtx.trigger = trigger;
  if (outcome !== null) sessionCtx.outcome = outcome;

  return { ...commit, session: sessionCtx };
}

// Re-export so callers can catch the classification. Keeping this
// re-export co-located with the decorate function means consumers
// importing from this module see the full contract (function +
// exceptions) without reaching into `../../errors`.
export { SessionNotFoundError };
