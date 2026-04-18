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
 * Parse arguments for `session code-history <file>:<line>`.
 *
 * Red-phase stub: returns a deliberately-wrong default so the Red tests
 * fail at ASSERTION level (not import level). The Green agent replaces
 * this body with the real parser. Contract (per spec AC 1, AC 2):
 *
 *   - Returns `"help"` if `--help` / `-h` is present.
 *   - Returns `{ file, line }` on a valid `file.ts:42` positional.
 *   - Throws a clear `Error` for: missing positional, no `:` separator,
 *     empty file or line portion, non-integer or non-positive line.
 *
 * The caller (`runCodeHistory`) turns thrown errors into stderr + non-zero
 * exit. Existence / line-in-range checks live in the command layer
 * because they need `fs` access — this parser stays pure.
 */
export function parseCodeHistoryArgs(
  _args: string[],
): CodeHistoryArgs | "help" {
  // Red stub: return a non-matching shape so assertion-level checks fail.
  return { file: "<unimplemented>", line: 0 };
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
