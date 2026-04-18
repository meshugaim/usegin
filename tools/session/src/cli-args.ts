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
    }
  }

  return result;
}

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
  // These two passes stay separate (rather than merged into a single loop)
  // on purpose:
  //   1. --help wins over everything, including reserved-flag detection —
  //      `session code-history --help -n 3` should print help, not the
  //      reserved-flag error.
  //   2. The reserved-flag reject runs BEFORE the positional-count check
  //      further down so `-n 3 file:1` surfaces the pinned ENG-5048
  //      message instead of the generic "extra positionals" path.
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

  return { file, line };
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
