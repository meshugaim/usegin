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
  /** Interleave commits chronologically in narrative output instead of appending at end. */
  commits: boolean;
  /** Filter out task-notification turns from output. */
  excludeNotifications: boolean;
  /** Show only turns at or after this timestamp. Raw string — resolved to Date at use site. */
  sinceTimestamp?: string;
  /** Show only turns at or after the timestamp of the given git commit SHA. */
  sinceCommit?: string;
  /** Delegate to `plan list --session <id> --json` instead of parsing. */
  issues: boolean;
  /**
   * Fall back to fetching from `/api/v1/dev-sessions` (then Supabase storage)
   * when the session ID/prefix isn't found locally. Without this flag the
   * resolver throws SessionNotFoundError; with it, the parse path delegates
   * to `fetchSession` which already handles the local → agent-records →
   * Supabase fallback chain. ENG-5956 (slice 1, "read any session from
   * any env").
   */
  remote: boolean;
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
    commits: false,
    excludeNotifications: false,
    issues: false,
    remote: false,
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
    } else if (arg === "--commits") {
      result.commits = true;
    } else if (arg === "--exclude-notifications") {
      result.excludeNotifications = true;
    } else if (arg === "--since-timestamp") {
      const value = requireArgValue(args, i, "--since-timestamp");
      result.sinceTimestamp = value;
      i++;
    } else if (arg === "--since-commit") {
      const value = requireArgValue(args, i, "--since-commit");
      result.sinceCommit = value;
      i++;
    } else if (arg === "--last") {
      const value = requireArgValue(args, i, "--last");
      const n = validateNonNegativeInteger(value, "--last");
      if (n === 0) {
        throw new Error('Invalid --last: expected positive integer, got "0"');
      }
      result.last = n;
      i++;
    } else if (arg === "--issues") {
      result.issues = true;
    } else if (arg === "--remote") {
      result.remote = true;
    } else if (!arg?.startsWith("-")) {
      result.file = arg || "";
    }
  }

  // --tool and --tools are mutually exclusive
  if (result.tool && result.tools) {
    throw new Error("Cannot use --tool and --tools together");
  }

  // --issues is mutually exclusive with output-shaping flags
  if (result.issues && result.full) throw new Error("Cannot use --issues with --full");
  if (result.issues && formatExplicit) throw new Error("Cannot use --issues with --format");
  if (result.issues && result.timeline) throw new Error("Cannot use --issues with --timeline");
  if (result.issues && result.stream) throw new Error("Cannot use --issues with --stream");

  // --full sets format to narrative, unless --format was explicitly provided
  if (result.full && !formatExplicit) {
    result.format = "narrative";
  }

  return result;
}

/**
 * Build the command array that delegates --issues to `plan list`.
 */
export function buildIssuesCommand(sessionId: string): string[] {
  return ["plan", "list", "--session", sessionId, "--json"];
}
