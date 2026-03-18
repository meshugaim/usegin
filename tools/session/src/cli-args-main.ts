/**
 * CLI argument parsing for main session command
 * Separated for testability
 */

import { validateNonNegativeInteger } from "./cli-args";

export type OutputFormat = "narrative" | "terminal" | "markdown" | "stats" | "json";

// Valid values for --format
const VALID_FORMATS: readonly OutputFormat[] = ["narrative", "terminal", "markdown", "stats", "json"] as const;

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

export interface MainArgs {
  file: string;
  toolInput: boolean;
  toolOutput: boolean;
  truncate: number;
  subagents: boolean;
  includeWarmups: boolean;
  listFiles: boolean;
  stream: boolean;
  format: OutputFormat;
  full: boolean;
  timeline: boolean;
  showTools: boolean;
  reportLines: number;
  debug: boolean;
  timeout: number;
  help: boolean;
  /** Filter output to show only calls for a specific tool type (case-sensitive) */
  tool?: string;
  /** Filter output to show calls for multiple tool types (comma-separated, case-sensitive) */
  tools?: string;
  /** Show turns from index N onward (0-based). For incremental reads. */
  sinceTurn?: number;
  /** Show only the last N turns. */
  last?: number;
}

export function parseMainArgs(args: string[]): MainArgs {
  const result: MainArgs = {
    file: "",
    toolInput: false,
    toolOutput: false,
    truncate: 500,
    subagents: false,
    includeWarmups: false,
    listFiles: false,
    stream: false,
    format: "stats",
    full: false,
    timeline: false,
    showTools: false,
    reportLines: 3,
    debug: false,
    timeout: 30,
    help: false,
  };

  // Track whether --format was explicitly provided (takes precedence over --full)
  let formatExplicit = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--tool-input") {
      result.toolInput = true;
    } else if (arg === "--tool-output") {
      result.toolOutput = true;
    } else if (arg === "--truncate") {
      const value = requireArgValue(args, i, "--truncate");
      result.truncate = validateNonNegativeInteger(value, "--truncate");
      i++;
    } else if (arg === "--subagents") {
      result.subagents = true;
    } else if (arg === "--include-warmups") {
      result.includeWarmups = true;
    } else if (arg === "--list-files") {
      result.listFiles = true;
    } else if (arg === "--stream") {
      result.stream = true;
    } else if (arg === "--format") {
      const value = requireArgValue(args, i, "--format");
      result.format = validateEnum(value, VALID_FORMATS, "--format");
      formatExplicit = true;
      i++;
    } else if (arg === "--full") {
      result.full = true;
    } else if (arg === "--timeline") {
      result.timeline = true;
    } else if (arg === "--show-tools") {
      result.showTools = true;
    } else if (arg === "--report-lines") {
      const value = requireArgValue(args, i, "--report-lines");
      result.reportLines = validateNonNegativeInteger(value, "--report-lines");
      if (result.reportLines === 0) {
        throw new Error('Invalid --report-lines: expected positive integer, got "0"');
      }
      i++;
    } else if (arg === "--debug") {
      result.debug = true;
    } else if (arg === "--timeout") {
      const value = requireArgValue(args, i, "--timeout");
      result.timeout = validateNonNegativeInteger(value, "--timeout");
      i++;
    } else if (arg === "--tool") {
      const value = requireArgValue(args, i, "--tool");
      result.tool = value;
      i++;
    } else if (arg === "--tools") {
      const value = requireArgValue(args, i, "--tools");
      result.tools = value;
      i++;
    } else if (arg === "--since-turn") {
      const value = requireArgValue(args, i, "--since-turn");
      result.sinceTurn = validateNonNegativeInteger(value, "--since-turn");
      i++;
    } else if (arg === "--last") {
      const value = requireArgValue(args, i, "--last");
      const n = validateNonNegativeInteger(value, "--last");
      if (n === 0) {
        throw new Error('Invalid --last: expected positive integer, got "0"');
      }
      result.last = n;
      i++;
    } else if (!arg?.startsWith("-")) {
      result.file = arg || "";
    }
  }

  // --since-turn and --last are mutually exclusive
  if (result.sinceTurn != null && result.last != null) {
    throw new Error("Cannot use --since-turn and --last together");
  }

  // --tool and --tools are mutually exclusive
  if (result.tool && result.tools) {
    throw new Error("Cannot use --tool and --tools together");
  }

  // --full sets format to narrative, unless --format was explicitly provided
  if (result.full && !formatExplicit) {
    result.format = "narrative";
  }

  return result;
}
