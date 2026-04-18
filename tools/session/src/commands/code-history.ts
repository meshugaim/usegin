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
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  if (parsed === "help") {
    printCodeHistoryHelp();
    return;
  }

  const { file, line } = parsed;

  // Slice 1: bare "is it there?" check. A fuller validation (line in
  // range, binary file detection) is implemented in the Green phase so
  // the AC-2 tests assert actual behavior, not placeholders.
  // NOTE: intentionally minimal — real validation lives in the Green agent's
  // diff.

  const commit = await getMostRecentCommit(file, line);

  if (commit === null) {
    console.error(`No committed history for ${file}:${line}`);
    return;
  }

  console.log(formatHeader(commit));
}
