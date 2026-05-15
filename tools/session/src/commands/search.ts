/**
 * `session search` — DUAL-MODE: semantic (default) vs API full-text (`--remote`).
 *
 * Two searches share one verb because both answer "search across sessions"
 * at the user-intent level; the flag picks the substrate:
 *
 *   - DEFAULT (no flag) → semantic-vector path. Shells out to
 *     `experiments/session-semantic-search/` (fastembed + sqlite-vec).
 *     This is the day-old capability; preserved EXACTLY — same argv,
 *     same Python entry-point, same install-on-first-run dance. Tests
 *     enforce the dispatch-without-API-call invariant.
 *
 *   - `--remote` → Postgres full-text path. Calls `/api/v1/dev-sessions?q=`
 *     via the Step-5a helpers (`findRemoteSessionsViaApi`), adapts the
 *     `ApiSessionItem[]` to `SessionInfo[]` via the same
 *     `apiItemToSessionInfo` adapter that `commands/list.ts` uses, and
 *     renders through the same `formatListLine` / `formatOutput`
 *     renderer for output parity with `session list --remote`.
 *
 * Spec AC 35 (ENG-5861): `session search "<query>"` calls
 * `/api/v1/dev-sessions?q=<query>` (Postgres `ts_rank` over
 * `searchable_content` + `summary`). Supports `--user`, `--since`,
 * `--until`, `--status`.
 *
 * The default flip — should bare `session search "<q>"` go to the API
 * instead of semantic? — is a deliberate non-decision for this slice.
 * Both paths exist; flipping the default is a one-line change in
 * `runSearch` if we decide later.
 *
 * Linear: ENG-5861
 */

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  extractSessionMeta,
  findRemoteSessionsViaApi,
  formatOutput,
  formatListLine,
  parseSinceFilter,
  type ApiFinderDeps,
  type ApiFinderOptions,
  type SessionInfo,
} from "../finder";
import { parseSearchArgs, type SearchArgs } from "../cli-args";
import { apiItemToSessionInfo } from "./list";
import { handleApiClientError } from "./api-error-handler";

/**
 * Convert `Nd` / `Nw` / `YYYY-MM-DD` to an ISO timestamp the API's
 * `since`/`until` filters expect.
 *
 * Verbatim copy of `commands/list.ts`'s `sinceToIso` (3 lines, intentional).
 * Same name so the duplication is visually obvious; lifting to a shared
 * helper for two callers crosses the "tiny abstraction" threshold — if a
 * third caller arrives, promote then.
 */
function sinceToIso(rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  const d = parseSinceFilter(rel);
  return d ? d.toISOString() : undefined;
}

/**
 * Dependency-injection seam — tests pass stubs for the API finder, the
 * semantic shim, and console outputs. Production wires the real ones.
 *
 * Keeping deps optional preserves the existing `runSearch(args)` call
 * shape used by `cli.ts`; tests pass `runSearch(args, { ... })`. Mirrors
 * `commands/list.ts`'s `RunListDeps`.
 */
export interface RunSearchDeps {
  findRemoteSessionsViaApiFn?: typeof findRemoteSessionsViaApi;
  extractSessionMetaFn?: typeof extractSessionMeta;
  log?: (line: string) => void;
  errorLog?: (line: string) => void;
  apiOptions?: ApiFinderOptions;
  apiDeps?: ApiFinderDeps;
  /**
   * Override the semantic-shim dispatcher (production: shells out to
   * `uv run python search.py`). Tests assert this is NOT invoked on the
   * `--remote` path and IS invoked on the default path.
   *
   * Takes the parsed `SearchArgs` so a stub can assert on the structured
   * shape (`query`, `semanticRest`) without re-parsing argv. Returns the
   * shim's exit code; the caller surfaces it via `process.exit`
   * (production behavior). When the override is provided, the runner
   * skips `process.exit` so tests don't terminate the process.
   */
  runSemanticFn?: (searchArgs: SearchArgs) => Promise<number>;
}

async function renderRemote(
  searchArgs: SearchArgs,
  sessions: SessionInfo[],
  log: (line: string) => void,
  extractMeta: typeof extractSessionMeta,
): Promise<void> {
  const limited = sessions.slice(0, searchArgs.limit);

  if (searchArgs.output === "path") {
    for (const session of limited) {
      // API rows carry pre-extracted meta; opening "" as a file would
      // crash. Same guard as `commands/list.ts` — only local rows hit the
      // filesystem fallback. (Remote-only path: all sessions have
      // `meta`, but the conditional reads the same as list.ts's so the
      // two renderers stay shaped identically.)
      const meta = session.meta ?? (await extractMeta(session.path));
      log(formatListLine(session, meta));
    }
  } else {
    for (const session of limited) {
      log(formatOutput(session, searchArgs.output));
    }
  }
}

/**
 * Empty-result handling note: this returns a different stderr message
 * than `commands/list.ts`'s `NoSessionsFoundError` (we say
 * `No sessions matched "<query>"`, list says "no sessions found" with
 * filter context). Both still exit 1, so scripting doesn't care. The
 * messages diverge on purpose: a search returning zero is a user-typed-
 * this-query negative result (echo the query back so they see exactly
 * what we looked for); list returning zero is a discovery-found-nothing
 * result (echo the filters back so they see what we scanned).
 */
async function runRemoteSearch(
  searchArgs: SearchArgs,
  deps: RunSearchDeps,
): Promise<void> {
  const findRemoteFn = deps.findRemoteSessionsViaApiFn ?? findRemoteSessionsViaApi;
  const extractMeta = deps.extractSessionMetaFn ?? extractSessionMeta;
  const log = deps.log ?? ((line: string) => console.log(line));
  const errorLog = deps.errorLog ?? ((line: string) => console.error(line));

  if (!searchArgs.query) {
    errorLog("Error: `session search --remote` requires a query argument.");
    process.exit(1);
    return;
  }

  // `deps.apiOptions` is the test-only DI override. In production it's
  // unset; we derive `profileName` from the parsed `--profile` flag so
  // multi-env verification doesn't need to mutate `~/.effi/current_profile`.
  const apiOptions: ApiFinderOptions =
    deps.apiOptions ??
    (searchArgs.profile ? { profileName: searchArgs.profile } : {});
  let apiItems;
  try {
    apiItems = await findRemoteFn(
      apiOptions,
      {
        q: searchArgs.query,
        limit: searchArgs.limit,
        since: sinceToIso(searchArgs.since),
        until: sinceToIso(searchArgs.until),
        user_id: searchArgs.user,
        status: searchArgs.status,
      },
      deps.apiDeps ?? {},
    );
  } catch (err) {
    if (handleApiClientError(err, errorLog)) {
      process.exit(1);
      return;
    }
    throw err;
  }

  const sessions = apiItems
    .map(apiItemToSessionInfo)
    .filter((s): s is SessionInfo => s !== null);

  if (sessions.length === 0) {
    errorLog(`No sessions matched "${searchArgs.query}".`);
    process.exit(1);
    return;
  }

  await renderRemote(searchArgs, sessions, log, extractMeta);
}

/**
 * Default-mode semantic search — shell out to the Python shim. Behavior
 * preserved byte-for-byte from the previous implementation; the only
 * change is the args we forward are `query + semanticRest` instead of
 * the raw argv (because `parseSearchArgs` peeled `--remote` off first).
 *
 * `--index` is special: when present (in `semanticRest`, since
 * `parseSearchArgs` doesn't recognize it as a known flag), the shim
 * runs `index.py` instead of `search.py` and is `nice`'d. Mirrors the
 * previous file's branching.
 */
async function runSemanticSearch(searchArgs: SearchArgs): Promise<number> {
  const here = dirname(fileURLToPath(import.meta.url));
  const expDir = join(
    here,
    "..",
    "..",
    "..",
    "..",
    "experiments",
    "session-semantic-search",
  );

  if (!existsSync(join(expDir, ".venv"))) {
    await spawnProcess("uv", ["sync"], expDir);
  }

  // Reconstruct the legacy argv: positional first (if any), then the
  // un-consumed rest. The shim's argparse handles `-k N`, `--index`,
  // `--limit N`, etc. on its own.
  const shimArgs = searchArgs.query
    ? [searchArgs.query, ...searchArgs.semanticRest]
    : searchArgs.semanticRest;

  const isIndex = shimArgs[0] === "--index";
  const rest = isIndex ? shimArgs.slice(1) : shimArgs;
  const script = isIndex ? "index.py" : "search.py";
  const cmd = isIndex ? "nice" : "uv";
  const cmdArgs = isIndex
    ? ["-n", "19", "ionice", "-c", "3", "uv", "run", "python", script, ...rest]
    : ["run", "python", script, ...rest];

  return spawnProcess(cmd, cmdArgs, expDir);
}

function spawnProcess(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

/**
 * Entry-point used by `cli.ts`. `deps` is optional so the production
 * call shape (`runSearch(args)`) stays backward-compatible; tests pass
 * stubs via the second arg.
 */
export async function runSearch(
  args: string[],
  deps: RunSearchDeps = {},
): Promise<void> {
  const searchArgs = parseSearchArgs(args);
  const errorLog = deps.errorLog ?? ((line: string) => console.error(line));

  // ENG-5995: --profile only does work under --remote — the semantic-search
  // shim has no profile concept. Without --remote the flag is silently
  // dropped; surface the mismatch instead of pretending we honored it.
  if (!searchArgs.remote && searchArgs.profile !== undefined) {
    errorLog(
      "Warning: --profile only applies to --remote; ignoring (the semantic search path has no profile concept).",
    );
  }

  if (searchArgs.remote) {
    // `--index` is a semantic-shim flag that triggers index rebuild — it has
    // no meaning on the API path. Without this guard it would silently land
    // in `semanticRest` and be dropped, which looks like "the build flag was
    // accepted but did nothing." Reject explicitly.
    if (searchArgs.semanticRest.includes("--index")) {
      errorLog(
        "Error: --index is incompatible with --remote (it builds the local semantic index).",
      );
      process.exit(1);
      return;
    }
    await runRemoteSearch(searchArgs, deps);
    return;
  }

  // Default path: semantic. Tests stub `runSemanticFn` to assert that
  // the API path was NOT taken; production leaves it undefined and the
  // real spawn runs.
  const semanticRunner = deps.runSemanticFn ?? runSemanticSearch;
  const code = await semanticRunner(searchArgs);
  // When stubbed, tests don't want process.exit. Real path exits with
  // the shim's exit code as before.
  if (!deps.runSemanticFn) {
    process.exit(code);
  }
}
