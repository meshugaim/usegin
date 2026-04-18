/**
 * `session code-history <file>:<line>` — show the commit + transcript
 * context for a single line of code.
 *
 * This file is the thin command-layer wiring: parse args → call git layer
 * → format → write to stdout / stderr. All heavy lifting lives in
 * `./code-history/{git,format,trailers,types}.ts` so each piece is
 * independently testable.
 *
 * Currently implemented:
 *   - Header line         — AC 4, AC 5 (ENG-5040 slice 1)
 *   - "No committed history" degradation — AC 19 (ENG-5040 slice 1)
 *   - Body preview line   — AC 8, AC 9 (ENG-5041 slice 2)
 *   - Rename following    — AC 20       (ENG-5041 slice 2)
 *   - Reserved-flag rejection — AC 24   (ENG-5041 slice 2)
 *   - `session:` line     — AC 6, AC 13 (ENG-5043 slice 4)
 *   - `linear:` line      — AC 7, AC 18 (ENG-5044 slice 5)
 *
 * Future slices extend `runCodeHistory` with:
 *   - `--json` mode (slice 6)
 *
 * TODO: Slice numbering mirrors ENG-5040's plan. With slice 5 landed,
 * only `slice 6` (JSON mode, ENG-5045) is forward-looking. "Slice N
 * landed in …" attributions (slices 1, 2, 4, 5) are historical and
 * stay pinned.
 * Grep hint:
 *   grep -nE 'slice 6' tools/session/src/commands/code-history{.ts,/*.ts}
 */

import { readFileSync, statSync } from "node:fs";

import { parseCodeHistoryArgs, CODE_HISTORY_RESERVED_FLAGS } from "../cli-args";

// external session tooling (async I/O)
import { fetchSession } from "../fetch";
import { parseSession } from "../parser";

// code-history internals
import { getMostRecentCommit } from "./code-history/git";
import {
  formatHeader,
  formatBody,
  formatSessionBlock,
} from "./code-history/format";
import { formatLinearLine, fetchLinearIssue } from "./code-history/linear";
import { decorateCommitWithLinear } from "./code-history/linear-decorate";
import { decorateCommitWithSession } from "./code-history/session-decorate";

/**
 * Print the command-specific help for `session code-history`.
 *
 * Kept in sync with the spec (ENG-5039). Slice 1 wires it up; later slices
 * document new flags (`--json`, reserved `-n`/`--all`/`-L`/`--func`) as
 * they land.
 */
export function printCodeHistoryHelp(): void {
  // RESERVED section lists flags that the parser rejects with the
  // pinned CODE_HISTORY_RESERVED_FLAG_MESSAGE — iterate the exported
  // constant so this list and the parser check can't drift. Follow-up
  // work (`-n`, `--all`, `-L`, `--func`) is tracked in ENG-5048.
  const reservedList = CODE_HISTORY_RESERVED_FLAGS.map((f) => `  ${f}`).join("\n");
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

RESERVED:
  The following flags are reserved for a follow-up (tracked in ENG-5048)
  and currently rejected with a "not yet" error:
${reservedList}

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

  // Session decoration (slice 4 — ENG-5043 AC 6, AC 13). Runs BEFORE
  // rendering so the session block can be composed synchronously in
  // its canonical position (after header, before body). The decorator
  // is pass-through when the commit body has no `Claude-Session:`
  // trailer; it populates `commit.session` otherwise. On
  // SessionNotFoundError it degrades to `{id, sinceTimestampCmd}` only
  // (no extractors) per AC 13 — no throw, no stderr noise.
  let decorated;
  try {
    decorated = await decorateCommitWithSession(commit, {
      fetchSession,
      parseSession,
    });
  } catch (error) {
    // Non-SessionNotFound errors propagate from the decorator (spec:
    // "don't swallow real errors as fetch failures"). Route through
    // the same `"Error: "`-prefixed stderr path used by upfront
    // validation so the user sees a consistent shape.
    bailWithError(error);
  }

  // Linear decoration (slice 5 — ENG-5044 AC 7, AC 18). Runs AFTER
  // session decoration so the pipeline's order matches the plain-
  // block render order (header → session → linear → body). The
  // decorator is pass-through when the commit body has no `ENG-\d+`
  // reference; it populates `commit.linear` when the subprocess
  // succeeds and emits a single-line stderr warning (via the
  // injected `warn` hook) when the subprocess fails — `commit.linear`
  // stays absent in that case so the renderer omits the line.
  //
  // Unlike the session decorator, this one has no "real error"
  // propagation path: all failures (timeout, nonzero exit, missing
  // `plan` CLI, malformed JSON, partial response) collapse to a
  // stderr warning + omit (spec AC 18). `fetchLinearIssue` itself
  // returns null for every failure mode — see its docstring for the
  // exhaustive list.
  decorated = await decorateCommitWithLinear(decorated, {
    fetchLinearIssue,
    warn: (msg) => console.error(msg),
  });

  console.log(formatHeader(decorated));

  // Session block (AC 6) — renders as the SECOND block, after the
  // header and before linear + body. Returns null when
  // `decorated.session` is absent (missing-layer → no lines, AC 9
  // invariant).
  const sessionBlock = formatSessionBlock(decorated);
  if (sessionBlock !== null) {
    console.log(sessionBlock);
  }

  // Linear line (AC 7) — renders as the THIRD line, after the session
  // block and before the body. Returns null when `decorated.linear`
  // is absent: either because the commit body has no `ENG-\d+` ref
  // (AC 9 missing-layer invariant) or because `plan show` failed
  // and the decorator already emitted an AC-18 warning to stderr.
  // In both cases the renderer omits the line cleanly.
  const linearLine = formatLinearLine(decorated.linear);
  if (linearLine !== null) {
    console.log(linearLine);
  }

  // Body preview (AC 8). `formatBody` strips trailers, joins the first
  // two non-blank lines, and truncates. Empty string means "no non-trailer
  // body content" — per AC 9 ("missing layer → no line") we omit the
  // `body:` line entirely in that case rather than emitting a placeholder.
  //
  // Pattern: "missing layer = no line" — the session block above
  // (returns null → skip console.log) and the linear line above
  // (same shape) mirror this. With three call sites now all sharing
  // the "format returns null/empty → skip the write" shape, an
  // `emitLayerLine` helper would be worth extracting — but the
  // session block is MULTI-line while linear / body are SINGLE-line,
  // so the helper would need a branch. Deferred until slice 6 lands
  // the JSON mode and gives us a clearer abstraction boundary.
  const bodyPreview = formatBody(decorated.body);
  if (bodyPreview.length > 0) {
    console.log(`body: ${bodyPreview}`);
  }
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
