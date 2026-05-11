/**
 * CLI argument parsing for session-parser
 * Separated for testability
 */

import type { OutputFormat } from "./finder";

// Type definitions (moved to top so they can be used in constants)
export type PickerMethod = "tmux" | "vsc" | "auto";

// Valid values for enum-like arguments
const VALID_OUTPUT_FORMATS: readonly OutputFormat[] = ["path", "id", "json"] as const;
const VALID_PICKER_METHODS: readonly PickerMethod[] = ["auto", "tmux", "vsc"] as const;

// Regex for validating --since argument
// Accepts: "Nd" (days), "Nw" (weeks), or "YYYY-MM-DD" (ISO date)
const SINCE_PATTERN = /^(\d+[dw]|\d{4}-\d{2}-\d{2})$/;

/**
 * Require that a flag has a value (not missing, not another flag)
 */
function requireArgValue(args: string[], i: number, flag: string): string {
  const value = args[i + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

/**
 * Validate that a value is one of the allowed options
 */
function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  flag: string
): T {
  if (!validValues.includes(value as T)) {
    throw new Error(
      `Invalid ${flag}: expected one of [${validValues.join(", ")}], got "${value}"`
    );
  }
  return value as T;
}

/**
 * Validate that a value is a positive integer
 */
function validatePositiveInteger(value: string, flag: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Invalid ${flag}: expected positive integer, got "${value}"`);
  }
  return num;
}

/**
 * Validate that a value is a non-negative integer
 */
export function validateNonNegativeInteger(value: string, flag: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`Invalid ${flag}: expected non-negative integer, got "${value}"`);
  }
  return num;
}

/**
 * Validate --since format: "Nd", "Nw", or "YYYY-MM-DD"
 */
function validateSince(value: string, flag: string): string {
  if (!SINCE_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${flag}: expected format like "1d", "2w", or "YYYY-MM-DD", got "${value}"`
    );
  }
  return value;
}

export interface FindArgs {
  allProjects: boolean;
  project?: string;
  output: OutputFormat;
  since?: string;
  noPreview: boolean;
  outputFile?: string;
  remote: boolean;
}

export function parseFindArgs(args: string[]): FindArgs {
  const result: FindArgs = {
    allProjects: false,
    output: "path",
    noPreview: false,
    remote: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--project") {
      const value = requireArgValue(args, i, "--project");
      result.project = value;
      i++;
    } else if (arg === "--output") {
      const value = requireArgValue(args, i, "--output");
      result.output = validateEnum(value, VALID_OUTPUT_FORMATS, "--output");
      i++;
    } else if (arg === "--since") {
      const value = requireArgValue(args, i, "--since");
      result.since = validateSince(value, "--since");
      i++;
    } else if (arg === "--no-preview") {
      result.noPreview = true;
    } else if (arg === "--output-file") {
      const value = requireArgValue(args, i, "--output-file");
      result.outputFile = value;
      i++;
    } else if (arg === "--remote") {
      result.remote = true;
    }
  }

  return result;
}

export interface PickArgs {
  allProjects: boolean;
  since?: string;
  method: PickerMethod;
}

export interface ListArgs {
  allProjects: boolean;
  project?: string;
  output: OutputFormat;
  since?: string;
  limit: number;
  remote: boolean;
  /**
   * Effi CLI profile name (e.g. `lihu-staging.owner@askeffi.ai:staging`).
   * When set under `--remote`, the API finder reads credentials from that
   * profile instead of the active `~/.effi/current_profile`. No-op when
   * `--remote` is unset — the local path doesn't have a profile concept.
   */
  profile?: string;
}

export function parseListArgs(args: string[]): ListArgs {
  const result: ListArgs = {
    allProjects: false,
    output: "path",
    limit: 10,
    remote: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--project") {
      const value = requireArgValue(args, i, "--project");
      result.project = value;
      i++;
    } else if (arg === "--output") {
      const value = requireArgValue(args, i, "--output");
      result.output = validateEnum(value, VALID_OUTPUT_FORMATS, "--output");
      i++;
    } else if (arg === "--since") {
      const value = requireArgValue(args, i, "--since");
      result.since = validateSince(value, "--since");
      i++;
    } else if (arg === "--limit" || arg === "-n") {
      const value = requireArgValue(args, i, arg);
      result.limit = validatePositiveInteger(value, arg);
      i++;
    } else if (arg === "--remote") {
      result.remote = true;
    } else if (arg === "--profile") {
      const value = requireArgValue(args, i, "--profile");
      result.profile = value;
      i++;
    }
  }

  return result;
}

// =============================================================================
// SEARCH ARGS
// =============================================================================

/**
 * Validate --status: server accepts "active" or "completed" (see
 * `ApiListOptions.status` in `finder/api-client.ts`). Anything else would
 * silently 400 at the API layer; reject at the CLI to surface the typo.
 */
const VALID_SEARCH_STATUSES: readonly ("active" | "completed")[] = [
  "active",
  "completed",
] as const;

export interface SearchArgs {
  /** Positional query string. Required for `--remote` and for semantic mode. */
  query: string;
  /**
   * When true, dispatch to the API full-text path (`/api/v1/dev-sessions?q=`).
   * When false (default), dispatch to the day-old semantic-search shim
   * (`experiments/session-semantic-search/`). See `commands/search.ts`.
   *
   * Both surfaces share one verb because they're "search across sessions" at
   * the user-intent level; the flag picks the substrate. Director decision —
   * not to be relitigated here.
   */
  remote: boolean;
  /** Server cap is 100; default mirrors `parseListArgs` at 20. */
  limit: number;
  /** Same shape as `parseListArgs`'s `--since`: Nd / Nw / YYYY-MM-DD. */
  since?: string;
  /** Same shape as `--since`, applied as an upper bound. */
  until?: string;
  /** Filter by owning user_id (UUID). Forwarded to `ApiListOptions.user_id`. */
  user?: string;
  /** Forwarded to `ApiListOptions.status`. */
  status?: "active" | "completed";
  /** path / id / json — same union as `ListArgs`; same renderer. */
  output: OutputFormat;
  /**
   * Effi CLI profile name. Same semantics as `ListArgs.profile` — applies
   * to the `--remote` path only; semantic-shim path doesn't have a profile
   * concept.
   */
  profile?: string;
  /**
   * Forwarded verbatim to the semantic-search shim when `--remote` is unset.
   * Captured here so the API path can ignore them and the shim sees its
   * native argv shape — keeps the legacy path byte-identical.
   */
  semanticRest: string[];
}

/**
 * Parse arguments for `session search "<query>" [...]`.
 *
 * Two consumers, two argv-shapes:
 *
 *   - `--remote` path → uses `query`, `limit`, `since`, `until`, `user`,
 *     `status`, `output`. Renders through `formatListLine` / `formatOutput`
 *     same as `parseListArgs`.
 *   - Default (semantic) path → passes the positional + any unrecognized
 *     flags through to `experiments/session-semantic-search/search.py`
 *     unchanged. `semanticRest` carries the un-consumed args so the shim
 *     sees its native CLI surface.
 *
 * Why one parser instead of "if --remote then parse otherwise pass-through":
 * the shim and the API path share the `--limit` and `--since` semantics;
 * keeping a single parser avoids the trap where a future contributor adds
 * `--limit` to one branch but not the other.
 *
 * The semantic path's pre-existing flags (`-k <n>`, `--index`) are NOT
 * recognized here — they fall into `semanticRest` and the shim handles them
 * as before. `--remote --index` is undefined behavior; not in scope for
 * AC 35.
 */
export function parseSearchArgs(args: string[]): SearchArgs {
  const result: SearchArgs = {
    query: "",
    remote: false,
    limit: 20,
    output: "path",
    semanticRest: [],
  };

  // Positional-first contract: the bare query must appear before any
  // unknown (semanticRest-bound) flag. This rules out the silent
  // misclassification where `["-k", "5", "my query"]` was bound as
  // `query="5"` and `semanticRest=["-k", "my query"]` — the user meant
  // `-k 5` as the shim's "top-k" flag with `my query` as the search
  // text. We can't know unknown-flag arities (the shim's argparse
  // owns those), so we can't safely consume a positional that appears
  // after one — reject instead of guess.
  //
  // Known no-value flags (--remote) and known value-bearing flags
  // (--limit, --since, …) don't set this gate, so the dominant
  // `--remote "<query>"` shape works.
  let unknownFlagSeen = false;

  // Two-pass: collect the positional query + classify known flags. Anything
  // unknown is forwarded to `semanticRest` so the semantic shim sees its
  // native argv. Positional comes first too (existing semantic CLI: e.g.
  // `session search "rls policy" -k 5`).
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === "--remote") {
      result.remote = true;
    } else if (arg === "--limit" || arg === "-n") {
      const value = requireArgValue(args, i, arg);
      result.limit = validatePositiveInteger(value, arg);
      i++;
    } else if (arg === "--since") {
      const value = requireArgValue(args, i, "--since");
      result.since = validateSince(value, "--since");
      i++;
    } else if (arg === "--until") {
      const value = requireArgValue(args, i, "--until");
      result.until = validateSince(value, "--until");
      i++;
    } else if (arg === "--user") {
      const value = requireArgValue(args, i, "--user");
      result.user = value;
      i++;
    } else if (arg === "--status") {
      const value = requireArgValue(args, i, "--status");
      result.status = validateEnum(
        value,
        VALID_SEARCH_STATUSES,
        "--status",
      );
      i++;
    } else if (arg === "--output") {
      const value = requireArgValue(args, i, "--output");
      result.output = validateEnum(value, VALID_OUTPUT_FORMATS, "--output");
      i++;
    } else if (arg === "--profile") {
      const value = requireArgValue(args, i, "--profile");
      result.profile = value;
      i++;
    } else if (!arg.startsWith("-") && result.query === "") {
      if (unknownFlagSeen) {
        // Positional after an unknown flag — likely the unknown flag's
        // value, not a query. Don't guess; surface the ambiguity.
        throw new Error(
          `session search: positional query must come before unknown flags; got "${arg}" after a flag the parser doesn't recognize. Put the query first: \`session search "<query>" --remote ...\` or \`session search "<query>" -k 5\`.`,
        );
      }
      // First bare positional is the query. Subsequent bare positionals
      // fall into semanticRest (the shim handles repeats how it wants).
      result.query = arg;
    } else {
      // Unknown flag (or its consumed value). Forward to the semantic shim.
      // We deliberately don't try to consume value-bearing unknown flags
      // here — the shim re-parses semanticRest with its own argparse so a
      // pass-through is enough. The cost: a stray `--remote-ish-typo`
      // lands in semanticRest and the shim will complain. That's fine —
      // surfaces the typo at the layer that knows its own flag set.
      if (arg.startsWith("-")) {
        unknownFlagSeen = true;
      }
      result.semanticRest.push(arg);
    }
  }

  return result;
}

// =============================================================================

export function parsePickArgs(args: string[]): PickArgs {
  const result: PickArgs = {
    allProjects: false,
    method: "auto",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--since") {
      const value = requireArgValue(args, i, "--since");
      result.since = validateSince(value, "--since");
      i++;
    } else if (arg === "--method") {
      const value = requireArgValue(args, i, "--method");
      result.method = validateEnum(value, VALID_PICKER_METHODS, "--method");
      i++;
    }
  }

  return result;
}

// =============================================================================
// FETCH ARGS
// =============================================================================

export interface FetchArgs {
  sessionId: string;
  help: boolean;
}

/**
 * Parse arguments for `session fetch <id>`.
 *
 * Accepts a single positional session ID argument and --help.
 * The session ID can be a full UUID or a short prefix.
 */
export function parseFetchArgs(args: string[]): FetchArgs {
  const result: FetchArgs = {
    sessionId: "",
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (!arg.startsWith("-")) {
      result.sessionId = arg;
    }
  }

  return result;
}

// =============================================================================
// RESUME ARGS
// =============================================================================

export interface ResumeArgs {
  sessionId: string;
  help: boolean;
}

/**
 * Parse arguments for `session resume <id>`.
 *
 * Accepts a single positional session ID argument and --help.
 * The session ID can be a full UUID or a short prefix.
 */
export function parseResumeArgs(args: string[]): ResumeArgs {
  const result: ResumeArgs = {
    sessionId: "",
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (!arg.startsWith("-")) {
      result.sessionId = arg;
    }
  }

  return result;
}

// =============================================================================
// CODE-HISTORY ARGS
// =============================================================================

export interface CodeHistoryArgs {
  /** Absolute or relative path to the file whose line history we want. */
  file: string;
  /** 1-based line number (positive integer). */
  line: number;
  /**
   * Emit a single JSON object on stdout instead of the human-readable
   * plain block. Absence → plain mode. See ENG-5055 (slice 6).
   *
   * Layering: this flag changes ONLY the render step. The git layer,
   * session/linear decoration, and stderr side-effects (AC-18 warning,
   * AC-19 "no committed history" path) all stay identical — JSON mode
   * just replaces plain's line-by-line `console.log` with one
   * `JSON.stringify` write.
   */
  json: boolean;
}

/**
 * Reserved flags that the code-history spec (ENG-5039) explicitly carves
 * out for a follow-up (tracked as ENG-5048). Each listed flag must FAIL
 * with a dedicated "not yet" error rather than silently being ignored —
 * otherwise a user who types `code-history foo.ts:1 -n 3` expecting
 * multi-commit walking gets a single commit back and doesn't know why.
 *
 * Slice 2 (ENG-5041) introduces the reject. Slices 3-6 leave this set
 * intact; the follow-up that actually implements `-n` / `--all` / `-L` /
 * `--func` will remove entries here as each one is delivered.
 *
 * Exported so tests can iterate rather than hand-writing every case.
 */
export const CODE_HISTORY_RESERVED_FLAGS: readonly string[] = [
  "-n",
  "--all",
  "-L",
  "--func",
] as const;

/**
 * The exact stderr message emitted when a reserved flag appears. Pinned
 * as a constant so the parser, the E2E tests, and any future help text
 * can all reference the same string — no drift on whether it's "not yet"
 * vs "not implemented" vs "coming soon".
 */
export const CODE_HISTORY_RESERVED_FLAG_MESSAGE =
  "not yet — see git log -L for multi-commit walking; follow-up tracked in ENG-5048";

/**
 * Parse arguments for `session code-history <file>:<line>`.
 *
 * Pattern reference: `parseFetchArgs` above shares the positional-only
 * shape, but `parseCodeHistoryArgs` THROWS on malformed input whereas
 * `parseFetchArgs` silently returns an empty `sessionId` — code-history
 * has a stricter grammar (`<file>:<line>`) so we fail loudly at parse
 * time rather than let an empty/half-parsed arg reach the git layer.
 * code-history is also UNIQUE in this codebase in taking a `file:line`
 * positional — the only parser with a colon-embedded positional — so see
 * the arg-parser tests in `commands/code-history.test.ts` for edge cases
 * (absolute paths, embedded colons in paths: the separator is the LAST
 * colon).
 *
 * Contract (per spec AC 1, AC 2):
 *
 *   - Returns `"help"` if `--help` / `-h` is present.
 *   - Returns `{ file, line }` on a valid `file.ts:42` positional.
 *   - Throws a clear `Error` for: missing positional, extra positionals,
 *     no `:` separator, empty file or line portion, non-integer or
 *     non-positive line. Exact wording for the no-colon case is pinned
 *     by the tests: `Expected <file>:<line>, got "<arg>"`.
 *
 * The caller (`runCodeHistory`) turns thrown errors into stderr + non-zero
 * exit. Existence / line-in-range checks live in the command layer
 * because they need `fs` access — this parser stays pure.
 */
export function parseCodeHistoryArgs(
  args: string[],
): CodeHistoryArgs | "help" {
  // These three passes stay separate (rather than merged into a single loop)
  // on purpose:
  //   1. --help wins over everything, including reserved-flag detection —
  //      `session code-history --help -n 3` should print help, not the
  //      reserved-flag error.
  //   2. The reserved-flag reject runs BEFORE the positional-count check
  //      further down so `-n 3 file:1` surfaces the pinned ENG-5048
  //      message instead of the generic "extra positionals" path.
  //   3. The positional-count check runs last so a valid `file:line`
  //      can be parsed once the earlier two passes have approved the argv.
  // Keeping the ordering in three explicit passes makes the precedence
  // obvious at a glance and is cheap for a 4-element reserved list.

  // Pass 1: --help wins over everything.
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return "help";
    }
  }

  // Pass 2: reserved-flag rejection (AC 24). Match on flag NAME only —
  // each reserved flag has its own value shape (`-n N`, `--all` bare,
  // `-L a,b`, `--func name`) and we don't need to consume the value to
  // know we won't honor the flag. `.includes` on a 4-element readonly
  // array is fine; a Set wouldn't read any clearer.
  for (const arg of args) {
    if (CODE_HISTORY_RESERVED_FLAGS.includes(arg)) {
      throw new Error(CODE_HISTORY_RESERVED_FLAG_MESSAGE);
    }
  }

  // Pass 3: recognize `--json` (slice 6 — ENG-5055). A bare flag: no
  // value, so no `requireArgValue` dance. Absent in argv → plain mode
  // (default `json: false` on the returned `CodeHistoryArgs`).
  // `--help` already won in pass 1, so `--help --json` and
  // `--json --help` both return `"help"` regardless of order.
  let json = false;
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
    }
  }

  // Find positionals. The spec accepts EXACTLY one — no more, no less.
  // Previously any extra positionals were silently ignored, which meant
  // `session code-history foo:1 bar:2` took `foo:1` and dropped `bar:2`
  // without warning. Close the grammar: one positional, or we throw.
  const positionals = args.filter((a) => !a.startsWith("-"));
  if (positionals.length === 0) {
    throw new Error("Missing argument: expected <file>:<line>");
  }
  if (positionals.length > 1) {
    throw new Error(
      `Unexpected extra arguments: expected one <file>:<line>, got ${positionals.length} ` +
        `(${positionals.map((p) => JSON.stringify(p)).join(", ")})`,
    );
  }
  const positional = positionals[0]!;

  // Split on the LAST colon so absolute paths (`/foo/bar.ts:42`) and
  // paths with embedded colons (`weird:name.ts:42`) parse correctly.
  const lastColon = positional.lastIndexOf(":");
  if (lastColon === -1) {
    throw new Error(`Expected <file>:<line>, got "${positional}"`);
  }

  const file = positional.slice(0, lastColon);
  const lineStr = positional.slice(lastColon + 1);

  if (file.length === 0) {
    throw new Error(`Expected <file>:<line>, got "${positional}" (file portion is empty)`);
  }

  // Reject non-integer, decimal, and non-numeric values. Use a regex check
  // so that "1.5", "abc", "1e2", " 1", etc. all fail — `Number()` is too
  // permissive.
  if (!/^-?\d+$/.test(lineStr)) {
    throw new Error(
      `Invalid line "${lineStr}" in "${positional}": expected a positive integer`,
    );
  }
  const line = Number(lineStr);
  if (!Number.isInteger(line) || line <= 0) {
    throw new Error(
      `Invalid line "${lineStr}" in "${positional}": line must be a positive integer (1-based)`,
    );
  }

  return { file, line, json };
}

// =============================================================================
// FORK ARGS
// =============================================================================

export interface ForkArgs {
  sessionId: string;
  dryRun: boolean;
  help: boolean;
}

/**
 * Parse arguments for `session fork <id>`.
 *
 * Accepts a single positional session ID argument, --dry-run, and --help.
 * The session ID can be a full UUID, a short prefix, or a file path.
 */
export function parseForkArgs(args: string[]): ForkArgs {
  const result: ForkArgs = {
    sessionId: "",
    dryRun: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (!arg.startsWith("-")) {
      result.sessionId = arg;
    }
  }

  return result;
}
