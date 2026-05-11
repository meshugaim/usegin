/**
 * `session list` — list sessions, optionally merging local + API-remote.
 *
 * Step 5b of ENG-5861 (slice 1, AC 32 + AC 33): when `--remote` is set,
 * remote rows come from `/api/v1/dev-sessions` via the Step-5a helpers
 * (`findRemoteSessionsViaApi`), not the legacy `~/agent-records/` glob
 * (`discoverRemoteSessions`). The legacy helper stays in the tree for
 * the unmigrated callers (`commands/find.ts`, `commands/fetch.ts`,
 * resolve helpers); AC 43 (slice 3) deletes it after this slice's GA.
 *
 * Output parity: API rows render through the same `formatListLine` as
 * local rows, populated from server-side fields:
 *
 *   - `display_title` (server-coalesced: summary → first user message →
 *     "(untitled)") → `meta.summary` so `formatListLine` picks it as the
 *     preview text.
 *   - `turn_count`, `line_count`         → `meta.turnCount`, `meta.lineCount`.
 *   - `last_synced_at`                   → `SessionInfo.mtime`.
 *   - `username`                         → `SessionInfo.username` (shown on
 *     remote rows once UI surfaces it; today both local and remote share
 *     the same single-line shape).
 *
 * The API row has no local file, so `SessionInfo.path = ""` and the list
 * loop checks `session.meta` BEFORE attempting `extractSessionMeta(path)`.
 * See the `SessionInfo` JSDoc in `finder/types.ts` for the dual-source
 * invariant.
 *
 * Linear: ENG-5861
 */

import {
  claudeProjectsDirExists,
  discoverSessions,
  extractSessionMeta,
  findRemoteSessionsViaApi,
  formatOutput,
  formatListLine,
  getCurrentProjectHash,
  mergeSessionLists,
  parseSinceFilter,
  warnIfConflictingFlags,
  type ApiFinderDeps,
  type ApiFinderOptions,
  type ApiSessionItem,
  type SessionInfo,
  type SessionMeta,
} from "../finder";
import { NoSessionsFoundError } from "../errors";
import { parseListArgs, type ListArgs } from "../cli-args";

/**
 * Convert a `Nd` / `Nw` / `YYYY-MM-DD` `--since` value to the ISO timestamp
 * the API's `since` filter expects. The local-path discovery does this
 * conversion inside `discoverSessions` via `parseSinceFilter`, but the
 * API client takes a fully-resolved ISO string.
 *
 * Returns `undefined` when `since` is absent or malformed (the caller's
 * argument parser already validates well-formed values, so this is just
 * a defense-in-depth).
 */
function sinceToIso(since: string | undefined): string | undefined {
  if (!since) return undefined;
  // Reuse the same parser the local path uses so the two surfaces never
  // diverge on what "1w" means.
  const d = parseSinceFilter(since);
  return d ? d.toISOString() : undefined;
}

/**
 * Adapt an `ApiSessionItem` (server row) to a `SessionInfo` (local-shape
 * row the renderer already knows). The renderer reads `meta` first, so
 * `path` can be `""` — see SessionInfo JSDoc.
 */
function apiItemToSessionInfo(item: ApiSessionItem): SessionInfo {
  const meta: SessionMeta = {
    // `display_title` is the server-coalesced one-liner the spec promised
    // (AC 42): summary → first_user_message → "(untitled)". Feeding it via
    // `summary` makes `formatListLine` pick it as the preview text without
    // the renderer needing to learn about API rows.
    summary: item.display_title || null,
    messages: item.first_user_message ? [item.first_user_message] : [],
    turnCount: item.turn_count,
    lineCount: item.line_count,
    hasUserMessages: !!item.first_user_message,
  };

  return {
    path: "",
    id: item.session_id,
    mtime: new Date(item.last_synced_at),
    project: "", // API rows don't carry project_hash; project_path is a string the renderer doesn't need
    source: "remote",
    username: item.username,
    meta,
  };
}

/**
 * Dependency-injection seam — tests pass a stub `findRemoteSessionsViaApi`
 * and a stub local-discovery callable. Production wires the real ones.
 *
 * Keeping deps optional preserves the existing `runList(args)` call shape
 * used by `cli.ts`; tests pass `runList(args, { ... })`.
 */
export interface RunListDeps {
  findRemoteSessionsViaApiFn?: typeof findRemoteSessionsViaApi;
  discoverSessionsFn?: typeof discoverSessions;
  extractSessionMetaFn?: typeof extractSessionMeta;
  /** Override for `console.log` so tests can capture rendered output. */
  log?: (line: string) => void;
  /** Override for `console.error` so tests can capture warnings. */
  errorLog?: (line: string) => void;
  /** API finder options (profileName, etc.) — usually unset in tests. */
  apiOptions?: ApiFinderOptions;
  /** Forwarded to the API finder's own DI shape (fetchImpl etc.). */
  apiDeps?: ApiFinderDeps;
}

/**
 * Render the merged session list. Extracted so both tests and the CLI
 * entry point go through one code path — the only difference is which
 * dependencies are injected.
 */
async function renderList(
  listArgs: ListArgs,
  sessions: SessionInfo[],
  log: (line: string) => void,
  extractMeta: typeof extractSessionMeta,
): Promise<void> {
  const limited = sessions.slice(0, listArgs.limit);

  if (listArgs.output === "path") {
    for (const session of limited) {
      // API-remote rows carry pre-extracted meta; opening `""` as a file
      // would crash. Local + legacy-remote rows extract on demand.
      const meta = session.meta ?? (await extractMeta(session.path));
      log(formatListLine(session, meta));
    }
    if (process.stdout.isTTY) {
      log("\n  Expand: session <id>    Timeline: --timeline    Full: --full");
    }
  } else {
    for (const session of limited) {
      log(formatOutput(session, listArgs.output));
    }
  }
}

export async function runList(
  args: string[],
  deps: RunListDeps = {},
): Promise<void> {
  const listArgs = parseListArgs(args);
  const findRemoteFn = deps.findRemoteSessionsViaApiFn ?? findRemoteSessionsViaApi;
  const discoverFn = deps.discoverSessionsFn ?? discoverSessions;
  const extractMeta = deps.extractSessionMetaFn ?? extractSessionMeta;
  const log = deps.log ?? ((line: string) => console.log(line));
  const errorLog = deps.errorLog ?? ((line: string) => console.error(line));

  // Warn if conflicting flags are specified
  const conflictWarning = warnIfConflictingFlags({
    project: listArgs.project,
    allProjects: listArgs.allProjects,
  });
  if (conflictWarning) {
    errorLog(`Warning: ${conflictWarning}`);
  }

  const currentProject = getCurrentProjectHash();
  const projectFilter = listArgs.allProjects
    ? undefined
    : listArgs.project || currentProject || undefined;

  const localSessions = await discoverFn({
    project: projectFilter,
    allProjects: listArgs.allProjects,
    since: listArgs.since,
  });

  // When --remote is set, merge in rows from /api/v1/dev-sessions. Local
  // wins on `session_id` collisions because local has the raw JSONL (the
  // API stores gzipped bytes + summarized metadata).
  let sessions = localSessions;
  if (listArgs.remote) {
    const apiItems = await findRemoteFn(
      deps.apiOptions ?? {},
      {
        limit: listArgs.limit,
        since: sinceToIso(listArgs.since),
      },
      deps.apiDeps ?? {},
    );
    const remoteSessions = apiItems.map(apiItemToSessionInfo);
    sessions = mergeSessionLists(localSessions, remoteSessions);
  }

  if (sessions.length === 0) {
    // Check if the projects directory exists for better error message
    const projectsDirExists = await claudeProjectsDirExists();
    const error = new NoSessionsFoundError({
      project: projectFilter,
      allProjects: listArgs.allProjects,
      since: listArgs.since,
      projectsDirExists,
    });
    errorLog(`Error: ${error.message}`);
    process.exit(1);
  }

  await renderList(listArgs, sessions, log, extractMeta);
}
