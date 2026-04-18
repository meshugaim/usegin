/**
 * `session code-history <file>:<line>` — show the commit + transcript
 * context for a single line of code.
 *
 * This file is the thin command-layer wiring: parse args → call git layer
 * → format → write to stdout / stderr. All heavy lifting lives in
 * `./code-history/{git,format,context,linear,types}.ts` so each piece is
 * independently testable.
 *
 * Slice 1 (ENG-5040) implements only the header line (AC 4, AC 5) and the
 * "no committed history" degradation path (AC 19). Later slices extend
 * `runCodeHistory` with session / linear / body lines and `--json`.
 */

import { readFileSync, statSync } from "node:fs";

import { parseCodeHistoryArgs } from "../cli-args";
import { getMostRecentCommit } from "./code-history/git";
import { formatHeader } from "./code-history/format";

/**
 * Print the command-specific help for `session code-history`.
 *
 * Kept in sync with the spec (ENG-5039). Slice 1 wires it up; later slices
 * document new flags (`--json`, reserved `-n`/`--all`/`-L`/`--func`) as
 * they land.
 */
export function printCodeHistoryHelp(): void {
  // TODO(ENG-5041 Green): add a RESERVED section listing
  // `CODE_HISTORY_RESERVED_FLAGS` from ../cli-args so the help text
  // tells users "-n/--all/-L/--func are reserved for ENG-5048" before
  // they try them. The red-phase reviewer flagged this as Green-phase
  // scope for ENG-5041, not Red.
  console.log(`
session code-history - Show the commit + transcript context for a line of code

USAGE:
  session code-history <file>:<line>

Answers "why does this line of code exist?" by locating the most recent
commit that touched <file>:<line> and decorating it with commit metadata,
the authoring Claude session (when present), and any referenced Linear
issue. Output is terse and streamable — machine-first, human-readable.

ARGUMENTS:
  <file>:<line>   File path and 1-based line number, e.g. src/foo.ts:42

OPTIONS:
  --help, -h      Show this help

EXAMPLES:
  session code-history tools/session/src/cli.ts:42
  session code-history ./nextjs-app/app/page.tsx:1
`);
}

/**
 * Entrypoint for the `code-history` subcommand.
 *
 * Exit codes:
 *   0 — success, or "no committed history" (spec AC 19)
 *   1 — invalid args, missing file, line out of range, or internal error
 */
export async function runCodeHistory(args: string[]): Promise<void> {
  let parsed: ReturnType<typeof parseCodeHistoryArgs>;
  try {
    parsed = parseCodeHistoryArgs(args);
  } catch (error) {
    bailWithError(error);
  }

  if (parsed === "help") {
    printCodeHistoryHelp();
    return;
  }

  const { file, line } = parsed;

  // Upfront validation (AC 2) — before any git spawn. These errors flow
  // through the `"Error: "`-prefixed stderr path via throw → catch, which
  // is distinct from AC 19's plain `console.error` "no committed history"
  // path. Keeping them separate lets the AC 19 test pin the exact
  // no-prefix wording without collision.
  try {
    validateFileAndLine(file, line);
  } catch (error) {
    bailWithError(error);
  }

  let commit;
  try {
    commit = await getMostRecentCommit(file, line);
  } catch (error) {
    // Real git failure (not-a-repo, unreadable object, permission denied,
    // etc.) — distinct from the "line has no committed history" path,
    // which `getMostRecentCommit` returns as `null` instead of throwing.
    // Route through the `"Error: "`-prefixed stderr path so the user sees
    // git's actual complaint, not a misleading "No committed history".
    bailWithError(error);
  }

  if (commit === null) {
    console.error(`No committed history for ${file}:${line}`);
    return;
  }

  console.log(formatHeader(commit));
}

/**
 * Write an `"Error: <msg>"` line to stderr and exit with code 1.
 *
 * Command-internal helper for the AC 2 / git-failure stderr path. Kept
 * private (not exported) because it's the specific shape this command
 * needs — other commands in this codebase do their own error formatting.
 *
 * Typed as `never` so TypeScript knows the caller's control flow
 * terminates; lets callers write `bailWithError(e)` without a follow-up
 * `return` or narrowing dance.
 */
function bailWithError(error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${msg}`);
  process.exit(1);
}

/**
 * Upfront argument-semantics validation for `code-history`.
 *
 * Throws a clear `Error` when the file doesn't exist (or isn't a regular
 * file) or when the 1-based line exceeds the file's line count. Per spec
 * AC 2, these are "user typed something wrong" cases — distinct from
 * AC 19's "line exists but was never committed" case, which is surfaced
 * by `getMostRecentCommit` returning `null` and goes through a separate
 * stderr path.
 */
function validateFileAndLine(file: string, line: number): void {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    throw new Error(`${file}: file not found`);
  }
  if (!stat.isFile()) {
    throw new Error(`${file}: not a regular file`);
  }

  // Count newlines to derive the line total. Reading the file once here
  // is fine — code-history is interactive (one invocation per run) and
  // files under investigation are source code (kilobytes, not gigabytes).
  // If that ever changes, swap in a streaming line counter.
  const contents = readFileSync(file, "utf8");
  const lineCount = countLines(contents);
  if (line > lineCount) {
    throw new Error(
      `line ${line} is out of range for ${file} (file has ${lineCount} line${
        lineCount === 1 ? "" : "s"
      })`,
    );
  }
}

/**
 * Count 1-based lines in a text file. A trailing newline does NOT add an
 * extra empty line (matches how editors / `wc -l + 1` typically think
 * about file length). Examples:
 *   `""`      → 0
 *   `"a"`     → 1
 *   `"a\n"`   → 1
 *   `"a\nb"`  → 2
 *   `"a\nb\n"`→ 2
 *
 * Implementation: split on `\n`, then drop a trailing empty segment if
 * the file ended with a newline. That's one pass and two lines, and reads
 * the same way editors describe line length ("this file has N lines").
 */
function countLines(contents: string): number {
  if (contents.length === 0) return 0;
  const parts = contents.split("\n");
  // A trailing newline produces a trailing empty segment we don't want to
  // count as "an extra line".
  return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
}
