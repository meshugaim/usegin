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
 * Public API:
 *   - `truncate` — whitespace run-collapse + 200-char cap with "…"
 *     (+ `CONTEXT_MAX_LEN` / `CONTEXT_ELLIPSIS` constants)
 *   - `isCommandOrCaveat` — text predicate for system-injected wrappers
 *   - `extractIntent(turns)` — first real user ask in the session
 *   - `extractTrigger(turns, sha)` — user ask immediately preceding the
 *     commit-authoring Bash turn for `sha`
 *   - `extractOutcome(turns, sha)` — first text-bearing assistant turn
 *     immediately following the commit-authoring Bash turn for `sha`
 *
 * Slice 4 (ENG-5043) wires these extractors into the `session code-history`
 * command pipeline. Until then the module is self-contained and tested in
 * isolation via `context.test.ts`.
 */

// Type-only imports — zero runtime dependency, preserves pure-module invariant.
import type { Turn } from "../../types";
// Value import of a pure helper (no I/O, no runtime-namespace calls) —
// canonical SHA-extraction regex lives at its usage site in
// `parse-turn.ts` and is reused here to avoid regex drift between the
// parser and the extractors. `extractCommitsFromToolResult` is a
// same-package utility with no side effects; importing it preserves
// the pure-module invariant enforced by `context.test.ts`.
import { extractCommitsFromToolResult } from "../../parse-turn";

// ============================================================================
// truncate
// ============================================================================

/**
 * Truncation constants. Kept at the top of the module so a reader can see
 * the budget at a glance.
 *
 * The 200-char budget here is intentionally DIFFERENT from the body-preview
 * budget in `format.ts` (`BODY_PREVIEW_MAX_LEN = 160`). The two serve
 * different jobs:
 *   - `BODY_PREVIEW_MAX_LEN` (160) caps the commit-row body preview, a
 *     single compact line meant to fit alongside the header in a dense
 *     `git log`–style table. Shorter = more rows visible at a glance.
 *   - `CONTEXT_MAX_LEN` (200) caps session-context snippets (trigger /
 *     outcome / intent — ENG-5042 AC 15). These carry more text per snippet
 *     because they're human prose, not a commit-subject-style one-liner,
 *     and the renderer lays them out on their own lines.
 *
 * If these budgets ever need to converge (e.g. a unified renderer), change
 * both consciously — don't assume they're "the same constant in two places".
 *
 * Exported because `extractTrigger` / `extractOutcome` reuse the same budget,
 * and downstream test code pins to these constants rather than hardcoding
 * `200` / `"…"`.
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
 *     `CONTEXT_MAX_LEN` chars: 199 of content + the ellipsis. (The
 *     cap-includes-ellipsis convention matches ENG-5041's body-preview
 *     truncation, but the numeric budgets differ — see the constant
 *     docstring above.)
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
 * Used by `isRealUserTurn` (see below), which in turn is shared by
 * `extractIntent` (forward first-match) and `extractTrigger` (backward
 * nearest-match) to skip system-injected turns in either direction.
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
// Module-private Turn predicates
// ============================================================================
//
// The three extractors in this module form a family:
//
//   - `extractIntent`  — `turns.find(isRealUserTurn)`            (first match)
//   - `extractTrigger` — backward-walk, same `isRealUserTurn`    (nearest before)
//   - `extractOutcome` — forward-walk, `isTextBearingAssistantTurn` (nearest after)
//
// The predicates are clustered here so the family shape is visible at a
// glance — intent vs trigger share a predicate; outcome has its own. Keep
// them together: if the caveat rule changes, both user-side extractors must
// stay in sync.

/**
 * Module-private predicate: true when `turn` is a human-authored user turn
 * carrying real prose (not empty, not a system-injected wrapper).
 *
 * Hoisted from `extractIntent`'s inline `Array.find` callback so the family
 * of three extractors (intent / trigger / outcome) reads as a set.
 *
 * Coupling to `isCommandOrCaveat`: this predicate is the sole caller of
 * `isCommandOrCaveat` within the extractor family. Any change to the caveat
 * rule affects both `extractIntent` and `extractTrigger` — tests in both
 * blocks must continue to pass after such a change.
 *
 * **Strengthened over ENG-5039 spec's backward-walk rule.** The spec says
 * "nearest preceding user turn whose text doesn't start with `<`". We
 * additionally skip empty-text user turns, because pure tool-result user
 * turns (text="") are not real user asks. Without this strengthening,
 * `extractTrigger`'s backward walk would return "" whenever a commit-authoring
 * Bash is immediately preceded by another Bash's tool-result turn (which is
 * the common case in a multi-step commit flow). This is an inferred decision
 * per ENG-5042 spec-gap discipline — documented here at the code site rather
 * than in the spec, because the decision is local to the predicate.
 *
 * Not exported — callers should compose the family-level extractors instead.
 */
function isRealUserTurn(turn: Turn): boolean {
  return (
    turn.role === "user" &&
    turn.text.trim() !== "" &&
    // Empty-text and command/caveat skips are distinct questions —
    // empty guards against pure tool-result user turns, isCommandOrCaveat
    // guards against system-injected wrappers.
    !isCommandOrCaveat(turn.text)
  );
}

/**
 * Module-private predicate: true when `turn` is an assistant turn carrying
 * real prose (not empty, not whitespace-only). Used by `extractOutcome`'s
 * forward walk.
 *
 * Separate from `isRealUserTurn` because the outcome side doesn't need the
 * command/caveat skip (assistants don't emit those wrappers) — the only
 * rule is "text after .trim() must be non-empty", which also handles the
 * tool-only assistant turns (text: "") from `makeAssistantTurn({ bash })`.
 */
function isTextBearingAssistantTurn(turn: Turn): boolean {
  return turn.role === "assistant" && turn.text.trim() !== "";
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
 * walk so the family of three extractors reads as a set — `extractIntent`
 * uses `.find`, `extractTrigger` uses `.findLast`, `extractOutcome` uses
 * `.find` against a `slice`.
 */
export function extractIntent(turns: Turn[]): string | null {
  const intent = turns.find(isRealUserTurn);
  // AC 15: apply truncate at the extractor's return boundary so
  // downstream consumers receive a ready-to-render string. The
  // non-null internal variant is safe here because the predicate
  // above already filtered empty text.
  return intent ? truncateString(intent.text) : null;
}

// ============================================================================
// extractTrigger / extractOutcome (ENG-5051)
// ============================================================================

/**
 * True when a Bash `input.command` string is a `git commit` invocation.
 *
 * Literal-prefix semantics (pinned by N1/N2):
 *   - Leading whitespace / parens are trimmed off first — so
 *     `"  git commit -m …"` and `"(git commit -m …)"` count. This
 *     matches how a shell would interpret the leading noise.
 *   - After trimming, the string must begin with the exact prefix
 *     `"git commit"` followed by either end-of-string or a single
 *     space (word-boundary rule). `"git commits"` is NOT a match
 *     (N1). `"git  commit"` (double space) is also NOT a match (N2,
 *     judgment call for literal-prefix semantics).
 *   - No alias resolution: `gc -m …` does NOT match (N7).
 *
 * Module-private (no callers outside `findCommitAuthoringTurnIndex`).
 */
function isGitCommitCommand(command: string): boolean {
  // Strip leading whitespace and parens — matches the "shell would run this"
  // intuition that drives P3 (`  git commit …`) while keeping the prefix
  // rule literal after the strip.
  const trimmed = command.replace(/^[\s()]+/, "");
  // Word-boundary after "commit": either end-of-string (bare `git commit`)
  // or a single space before the next token. Space literal — NOT \s+ — so
  // `git  commit` (double space) stays out per N2.
  if (trimmed === "git commit") return true;
  if (trimmed.startsWith("git commit ")) return true;
  return false;
}

/**
 * Bidirectional `startsWith` — true when either string is a prefix of the
 * other. Handles SHA format variance pinned by P8: the tool_result may carry
 * a short 7-char SHA while the caller queries with the full 40-char SHA
 * (or vice versa).
 *
 * Module-private (only caller is `findCommitAuthoringTurnIndex`).
 */
function shaPrefixMatch(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Locate the index of the assistant turn whose Bash tool_use authored the
 * commit identified by `sha`. "Authored" means: the assistant ran a
 * `git commit ...` command whose matching tool_result (in a following user
 * turn, paired by `toolUseId`) contains `sha` (partial match in either
 * direction; see P8 in the ENG-5051 test list).
 *
 * Returns `null` when no such turn exists — either because no Bash tool_use
 * was executed, or because no tool_result contained the target SHA.
 *
 * Same-SHA pathological (G3): if two tool_results match the query SHA, the
 * first assistant turn in traversal order wins (deterministic first-match).
 * This is impossible in real git (content-addressed SHAs), but hand-crafted
 * fixtures can produce it — the choice is stable across runs rather than
 * behavior-significant.
 *
 * Module-private helper (YAGNI per ENG-5051 scope note): the only callers
 * today are `extractTrigger` and `extractOutcome` in this same file.
 * Named generically so a future slice can export it without a rename.
 */
function findCommitAuthoringTurnIndex(
  turns: Turn[],
  sha: string,
): number | null {
  // Empty-SHA guard: `shaPrefixMatch(anyHash, "")` would be true because
  // `.startsWith("")` is always true — which would resolve to the first
  // `git commit` Bash in `turns`. Not user-visible today (all call sites
  // pass a real SHA) but brittle; bail explicitly so the predicate can't
  // silently degenerate into "first commit found" if a caller ever slips.
  if (sha === "") return null;
  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    if (!turn || turn.role !== "assistant") continue;
    // Walk every Bash tool_use on this turn. A single assistant turn can
    // carry multiple tool calls (e.g. `git add` then `git commit` in one
    // shot); only the ones that are `git commit` invocations are candidates.
    for (const call of turn.toolCalls) {
      if (call.name !== "Bash") continue;
      const command = call.input.command;
      if (typeof command !== "string") continue;
      if (!isGitCommitCommand(command)) continue;
      // Search forward for the matching tool_result (paired by toolUseId).
      // Per fixture shape the result lives on the very next user turn, but
      // we scan forward defensively — a real session could interleave a
      // sidecar entry before the result lands.
      for (let j = i + 1; j < turns.length; j += 1) {
        const later = turns[j];
        if (!later) continue;
        const result = later.toolResults.find((r) => r.toolUseId === call.id);
        if (!result) continue;
        // Reuse the canonical `[branch sha] message` regex from
        // `parse-turn.ts` — single source of truth for SHA extraction.
        const commits = extractCommitsFromToolResult(result.content);
        for (const commit of commits) {
          if (shaPrefixMatch(commit.hash, sha)) {
            return i;
          }
        }
        // Only one tool_result per toolUseId exists; stop scanning forward.
        break;
      }
    }
  }
  return null;
}

/**
 * Extract the user message that triggered the commit identified by `sha`.
 * "Triggered" is defined as the nearest real user turn preceding the
 * commit-authoring Bash turn (see `findCommitAuthoringTurnIndex`), walking
 * backward past any system-injected wrappers via `isRealUserTurn`.
 *
 * Returns `null` when the commit-authoring turn cannot be located, or when
 * no real user turn precedes it.
 *
 * Return boundary (AC 15): result is `truncate`d to `CONTEXT_MAX_LEN`.
 */
export function extractTrigger(turns: Turn[], sha: string): string | null {
  const idx = findCommitAuthoringTurnIndex(turns, sha);
  if (idx === null) return null;
  // Backward walk: nearest real user turn before the commit-authoring turn.
  // `findLast` mirrors the `extractIntent` → `.find` rhyme: the family of
  // three extractors reads as a set (first / nearest-backward / nearest-forward).
  const trigger = turns.slice(0, idx).findLast(isRealUserTurn);
  // AC 15: apply truncate at the extractor's return boundary so downstream
  // consumers receive a ready-to-render string. Mirrors `extractIntent`'s
  // post-follow-up-fix shape.
  return trigger ? truncateString(trigger.text) : null;
}

/**
 * Extract the assistant text immediately reporting the outcome of the
 * commit identified by `sha`. The outcome is the first text-bearing
 * assistant turn following the commit-authoring Bash turn (see
 * `findCommitAuthoringTurnIndex`), skipping over tool-only assistant
 * turns and whitespace-only text turns.
 *
 * Returns `null` when the commit-authoring turn cannot be located, or
 * when no text-bearing assistant turn follows it.
 *
 * Return boundary (AC 15): result is `truncate`d to `CONTEXT_MAX_LEN`.
 */
export function extractOutcome(turns: Turn[], sha: string): string | null {
  const idx = findCommitAuthoringTurnIndex(turns, sha);
  if (idx === null) return null;
  // Forward walk: first text-bearing assistant turn after the commit.
  // `.slice(idx + 1).find(...)` mirrors the family-of-three rhyme.
  const outcome = turns.slice(idx + 1).find(isTextBearingAssistantTurn);
  return outcome ? truncateString(outcome.text) : null;
}
