/**
 * Session-context extractors for `session code-history`.
 *
 * Pure, I/O-free module by contract: no filesystem, no network, no
 * runtime-namespace calls, no asynchronous declarations. Inputs are a
 * plain `Turn[]` (from an already-parsed session) plus helpers like
 * `truncate`. Keeping this module pure lets renderers (slices 4/5/6 —
 * session trailer, Linear trailer, JSON) import it without dragging
 * I/O into their unit tests. The invariant is enforced by a grep-style
 * test in `context.test.ts` — see the test for the exact forbidden
 * tokens.
 *
 * Part A (ENG-5050) — currently in this file:
 *   - `truncate` — whitespace run-collapse + 200-char cap with "…"
 *   - `extractIntent` — first "real" user turn text, skipping caveats
 *     and command wrappers
 *   - `isCommandOrCaveat` — predicate reused by Part B's trigger walk
 *
 * Part B (ENG-5051) will add `extractTrigger` / `extractOutcome`
 * alongside these, reusing `truncate` + `isCommandOrCaveat`.
 */

// Type-only imports — zero runtime dependency, preserves pure-module invariant.
import type { Turn } from "../../types";

// ============================================================================
// truncate
// ============================================================================

/**
 * Truncation constants. Kept at the top of the module so a reader can see
 * the budget at a glance. The 200-char target matches the body-preview
 * budget from ENG-5041 (see `BODY_PREVIEW_MAX_LEN` in `format.ts`): the
 * two budgets are intentionally the same so that a commit-row's body
 * preview and a session-context snippet wrap to the same width.
 *
 * Exported because ENG-5051's `extractTrigger` / `extractOutcome` will
 * reuse the same budget, and downstream test code pins to these constants
 * rather than hardcoding `200` / `"…"`.
 */
export const CONTEXT_MAX_LEN = 200;
export const CONTEXT_ELLIPSIS = "…";

/**
 * Internal string-only variant of `truncate`: applies the collapse-then-cap
 * rule without the null passthrough. Callers that already know their input
 * is non-null (e.g. `extractIntent` after an empty-text guard) can skip the
 * null-overload routing. Not exported — the public API is `truncate`.
 *
 * See `truncate` below for the full semantics (whitespace collapse scope,
 * cap-inclusive ellipsis, collapse-before-cap ordering).
 */
function truncateString(value: string): string {
  // Run-collapse: every run of \n/\t (any mix, any length) → single space.
  const collapsed = value.replace(/[\n\t]+/g, " ");
  if (collapsed.length <= CONTEXT_MAX_LEN) return collapsed;
  // Total length budget INCLUDES the ellipsis (1 char), so keep
  // CONTEXT_MAX_LEN - 1 chars of content + ellipsis = CONTEXT_MAX_LEN total.
  return collapsed.slice(0, CONTEXT_MAX_LEN - 1) + CONTEXT_ELLIPSIS;
}

/**
 * Collapse runs of internal whitespace and cap length at `CONTEXT_MAX_LEN`
 * (including the trailing "…" when truncation is required).
 *
 * Semantics (matches ENG-5050 AC 15):
 *   - `null` → `null`
 *   - Consecutive `\n`/`\t` runs collapse to a single space
 *     (so `"a\n\n\tb"` → `"a b"`). Collapses only `\n` and `\t`
 *     (and runs thereof); other whitespace (`\r`, `\v`, NBSP, and
 *     runs of regular spaces) passes through unchanged.
 *   - Truncation is applied AFTER whitespace collapse, so a 300-char
 *     input that's mostly `\n` can end up short of the cap.
 *   - When the collapsed value exceeds the cap, output is exactly
 *     `CONTEXT_MAX_LEN` chars: 199 of content + the ellipsis — same
 *     rule as the body preview line from ENG-5041.
 *
 * Pure function: no mutation of the input, no side effects.
 */
export function truncate(value: string | null): string | null {
  return value === null ? null : truncateString(value);
}

// ============================================================================
// isCommandOrCaveat
// ============================================================================

/**
 * True when `text` is a system-injected user turn rather than a real
 * human message. Covers:
 *   - `<command-name>…</command-name>` wrappers (Claude Code slash
 *     commands like `/retro`).
 *   - `<command-message>…</command-message>` (the slash-command payload
 *     that appears alongside a matching tool_use turn).
 *   - Any other `<…>`-prefixed wrapper (e.g. `<caveat>`,
 *     `<local-command-stdout>`, `<command-stderr>`) — the spec rule
 *     from ENG-5039 / ENG-5042 is "trimmed text does not start with `<`"
 *     for a real user turn.
 *   - `Caveat: …` style free-text preambles emitted before real input.
 *
 * Used by `extractIntent` to skip over these when hunting for the first
 * real user turn, and will be reused by Part B's `extractTrigger`
 * backward-walk to find the last real user ask before an assistant turn.
 *
 * Known false-positive: a user message starting with literal `<` in prose
 * would be skipped. In practice this hasn't been observed — Claude Code's
 * command wrappers always occupy leading position — but if a real case
 * surfaces, the real message is ignored and the next non-wrapper turn is
 * returned.
 *
 * Pure: no side effects, no I/O.
 */
export function isCommandOrCaveat(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) return true;
  if (trimmed.startsWith("Caveat:")) return true;
  return false;
}

// ============================================================================
// extractIntent
// ============================================================================

/**
 * Extract the first human-authored user message from a conversation.
 *
 * Skips over:
 *   - system-injected wrappers (see `isCommandOrCaveat`), and
 *   - empty-text user turns (e.g. a pure tool-result user turn that
 *     happens to carry no prose).
 *
 * So a session starting with `[<caveat>, <command-name>, "fix the build"]`
 * returns `"fix the build"`.
 *
 * Returns `null` when:
 *   - `turns` has no user turns, OR
 *   - every user turn is empty or a command/caveat wrapper.
 *
 * Return boundary (ENG-5042 AC 15): the returned string is already
 * `truncate`d — whitespace runs are collapsed and the result is ≤200
 * chars. Downstream consumers (slices 4/5/6 renderers) can render
 * the value verbatim without re-applying the bounded-string rule.
 *
 * Pure: the input array is not mutated; `Array.find` reads each turn
 * at most once and exits on the first match. Chosen over a `for…of`
 * walk because ENG-5051 will land `extractTrigger` / `extractOutcome`
 * alongside this — a backward walk there is naturally `findLast`, so
 * the family reads as a set.
 */
export function extractIntent(turns: Turn[]): string | null {
  const intent = turns.find(
    (t) =>
      t.role === "user" &&
      t.text.trim() !== "" &&
      // Empty-text and command/caveat skips are distinct questions —
      // empty guards against pure tool-result user turns, isCommandOrCaveat
      // guards against system-injected wrappers.
      !isCommandOrCaveat(t.text),
  );
  // AC 15: apply truncate at the extractor's return boundary so
  // downstream consumers receive a ready-to-render string. The
  // non-null internal variant is safe here because the predicate
  // above already filtered empty text.
  return intent ? truncateString(intent.text) : null;
}
