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
 * Part A (ENG-5050 — this file's Red state) lands:
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
 */
const TRUNCATE_MAX_LEN = 200;
const TRUNCATE_ELLIPSIS = "…";

/**
 * Collapse runs of internal whitespace and cap length at 200 chars
 * (including the trailing "…" when truncation is required).
 *
 * Semantics (matches ENG-5050 AC 15):
 *   - `null` → `null`
 *   - Consecutive `\n`/`\t` runs collapse to a single space
 *     (so `"a\n\n\tb"` → `"a b"`).
 *   - Truncation is applied AFTER whitespace collapse, so a 300-char
 *     input that's mostly `\n` can end up short of the cap.
 *   - When the collapsed value exceeds the cap, output is exactly
 *     `TRUNCATE_MAX_LEN` chars: 199 of content + the ellipsis — same
 *     rule as the body preview line from ENG-5041.
 *
 * Pure function: no mutation of the input, no side effects.
 *
 * @returns unimplemented sentinel until the Green phase lands
 */
export function truncate(value: string | null): string | null {
  void value;
  void TRUNCATE_MAX_LEN;
  void TRUNCATE_ELLIPSIS;
  return "<unimplemented>";
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
 *   - `Caveat: …` style system caveats emitted before real input.
 *
 * Used by `extractIntent` to skip over these when hunting for the first
 * real user turn, and will be reused by Part B's `extractTrigger`
 * backward-walk to find the last real user ask before an assistant turn.
 *
 * Pure: no side effects, no I/O.
 *
 * @returns unimplemented sentinel (false) until the Green phase lands
 */
export function isCommandOrCaveat(text: string): boolean {
  void text;
  return false;
}

// ============================================================================
// extractIntent
// ============================================================================

/**
 * Extract the first human-authored user message from a conversation.
 *
 * Skips over system-injected wrappers (see `isCommandOrCaveat`) so that
 * a session starting with `[<caveat>, <command-name>, "fix the build"]`
 * returns `"fix the build"`.
 *
 * Returns `null` when:
 *   - `turns` has no user turns, OR
 *   - every user turn's text is a command/caveat wrapper.
 *
 * Pure: the input array is not mutated.
 *
 * @returns unimplemented sentinel until the Green phase lands
 */
export function extractIntent(turns: Turn[]): string | null {
  void turns;
  return "<unimplemented>";
}
