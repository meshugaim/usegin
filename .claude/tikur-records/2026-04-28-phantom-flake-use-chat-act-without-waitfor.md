# Tikur: phantom — `use-chat-risk.test.ts:168` flaked under CI load (act-without-waitFor read of hook state)

**Date:** 2026-04-28
**Severity:** medium (low blast-radius — one test, easy to dismiss; high *trust* damage if normalized — the herd learns to ignore phantom signals, then misses real ones)
**Status:** fixed
**Category:** error — the system permitted a test to read post-`act` state synchronously; React's batched update model didn't guarantee the read would see the staged change under load.

## Cluster
**Searched** `phantom`, `flake`, `act.*waitFor`, `setTimeline`, fake-timer ordering across `.claude/tikur-records/` and `usegin/zettel/zettels/`. **Touches:** none direct on the test-flake mechanism (the `reference_fake_timer_cleanup_order` memory is adjacent — different mechanism, same family of timing-coordination bugs). **Standalone today; predator profile added so the next sighting auto-clusters.**

## Timeline
**Tape sources:** GitHub Actions run `25063920221`, commit `a362eee94`, `nextjs-app/tests/unit/hooks/use-chat-risk.test.ts:168-212`, hook source `nextjs-app/hooks/use-chat.ts:311-323`, local 10× rerun.

- 2026-04-28 16:06:27Z — CI workflow "Next.js Tests" reports `(fail) useChat sendProgrammaticMessage > adds user message to timeline and streams the response [3.00ms]`. No stack trace, no diff — pure test-runner flake signature.
- 2026-04-28 16:07Z — Local `bun test tests/unit/hooks/use-chat-risk.test.ts`: 5/5 pass.
- 2026-04-28 16:08Z — Test code reads `result.current.timeline` *synchronously* immediately after `await act(async () => { await sendProgrammaticMessage(...) })` returns. The hook's `sendProgrammaticMessage` schedules a `setTimeline(...)` state update before resolving the awaited promise; under load the React batched-update microtask hadn't flushed before the read.
- 2026-04-28 16:08Z — Sibling assertion at line 197 wrapped in `waitFor` — explains why that assertion never flaked while the prior one did. Mechanism confirmed.
- 2026-04-28 16:10Z — Fix: wrap the user-message assertion in `waitFor` to retry until the state-update has flushed. Local 10× rerun: 10/10 green.

## Five whys

- **Why** did `use-chat-risk.test.ts:168` flake in CI but pass locally?
  - **A:** It read `result.current.timeline` immediately after `await act(...)` resolved, before React's batched-update microtask had flushed the `setTimeline` call inside the hook's `sendProgrammaticMessage`. CI's slower / more contended scheduler made the race observable.
    - **Why** does `await act(...)` not guarantee the staged update is visible after it returns?
      - **A:** `act` flushes synchronous updates and one round of pending effects, but the test's awaited callback resolved *before* the hook's last `setTimeline`'s microtask landed in this code path. Subtle: the await target is the hook's *function-level* promise, not a render-completion promise.
        - **Why** does the codebase allow this pattern at all?
          - **A:** ← *root cause: leverable.* **No marker — no rule, lint, doc, persona — calls out "post-`act` synchronous read of `result.current.<state>` is flake-prone."** The pattern looks correct (`act` is the React-recommended wrapper). The non-determinism is invisible to the eye. The wild glass had a slot for this exact predator class — *phantom* — but no profile until now.

## Root cause

**One sentence, systemic:** Tests can read React-Testing-Library hook state synchronously after `await act(...)` and *appear correct*, while actually relying on microtask-flush ordering that breaks under CI load — a class of flake we had no vocabulary, profile, or detection rule for.

## Fixes

- **Immediate:** wrap the user-message assertion (lines 188-194) in `waitFor`. Commit SHA: pending this turn.
- **System:** added `Phantom` predator profile to `usegin/glasses/wild/predators.md` — defines the pattern, distinguishes from `mirage`, lists structural markers (`act` followed by sync read, fake-timer + render combos, `useRealTimers` before `cleanup`, mocked SSE without microtask flush). Commit SHA: pending this turn (same commit as immediate fix).
- **Tripwire:** the suricate-scout rule in the predator profile gives a phantom-hunter a concrete grep pattern: tests with `act\(async.*\)` followed within 5 lines by a synchronous read of `result.current.<state>` (no intervening `waitFor`). Future scans of `tests/unit/hooks/` and `tests/unit/components/` against this rule will surface the cluster.

## Lekach — what each artifact gets

Same turn (z002):

| Artifact | Change |
|---|---|
| `nextjs-app/tests/unit/hooks/use-chat-risk.test.ts` | Wrap user-message assertion in `waitFor`; cite predator profile in comment. |
| `usegin/glasses/wild/predators.md` | New `Phantom` predator profile with structural markers + grep rule. |
| **This record** | The tikur record itself — first phantom sighting, baseline for cluster detection. |

## Notes for follow-up tikur

- If a phantom sighting in `tests/unit/hooks/` recurs within a week, the cluster is the finding — promote to a meta-zettel naming the cluster, and consider a stronger tripwire (lint rule via custom ESLint plugin scanning the AST for `await act(...)` immediately followed by `result.current` reads outside `waitFor`).
- The `reference_fake_timer_cleanup_order` memory entry is adjacent (different mechanism — fake-timer cleanup ordering — same family of CI-only timing flakes). Do *not* merge them; they are sibling profiles inside the phantom predator class.

## Threading

↑`usegin/glasses/wild/predators.md` (Phantom) · ~`reference_fake_timer_cleanup_order` memory (sibling phantom-class flake) · ~`.claude/skills/tikur/SKILL.md` (self-tripwire — same-turn SHA citation rule).
