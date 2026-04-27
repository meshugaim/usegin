---
name: pre-mortem-team
purpose: Imagine the project failed; reverse-engineer why. Surface failure modes before commitment.
size: 3-5
mode: parallel-imagination + synthesis
created: 2026-04-27
---

## Members

- **Cal** (lead — imagines the project failed at the *direction* level)
- **John × 2-3** (each imagines a different failure-mode level —
  technical, operational, organizational)
- **Sam** (synthesizer — patterns across the imagined failures)

## Operating mode

Adapted from Klein's pre-mortem (1989):

1. **Frame.** "Imagine it's three months from now. The project failed.
   What killed it?"
2. **Spawn Cal + Johns in parallel.** Each writes a "looking-back-from-
   failure" memo at `<root>/pre-mortem/<name>.md`. They do *not* read
   each other.
3. **Sam reads all memos.** Patterns across the imagined failures
   become the real risk surface. He writes `<root>/pre-mortem/
   summary.md` with: top recurring failures (≥2 imagined), unique
   one-off failures (1 imagined), pattern across failures.
4. **Output to Mark** — who decides which preventions to action *before*
   commitment.

## Charter shape (per imaginer)

> You are <Cal | John>. It's three months from now. The
> project (<scope>) failed. Looking back, you can see clearly why.
>
> Write a memo at <path> with:
> 1. **What failed** — specific milestone or claim that broke.
> 2. **Why** — the causal chain. Be concrete: not "complexity" but
>    "the X module needed to integrate with Y, and Y's contract
>    changed under us in week 3."
> 3. **What we knew but ignored** — the warning signs we had at the
>    start.
> 4. **What would have prevented it** — the specific intervention
>    that would have caught this *before* commitment.
>
> No hedging. Pick the most *plausible* failure mode for your slot
> and commit to it.

## Output artifact

`<root>/pre-mortem/summary.md` with prioritized preventions +
z026 dilemmas for which preventions are worth their cost.

## When to use this team

- Before committing to a multi-week build.
- When a direction "feels right" but no one has stress-tested it.
- Direct trigger: "pre-mortem this" / "imagine it failed" / "what
  would kill this".
- After `prioritize` lands a winner, *before* spec — last-pass risk
  surface.

## Common failure modes

- **Lukewarm imagination.** "It might fail because complexity" —
  rejected. The premise is *it failed*; commit to a specific cause.
- **Imaginers reading each other.** Independence makes recurring
  failures meaningful.
- **Treating the output as a kill-list.** The synthesis is a *risk
  surface*, not a veto. Mark + Lihu decide which preventions are
  worth their cost.
