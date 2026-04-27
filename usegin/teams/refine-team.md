---
name: refine-team
purpose: Sharpen a flat brainstorm pool — per-idea clarification, semantic dedup, gap-fill, conflict mapping.
size: 3-6 (by pool size)
mode: parallel-edit-in-place
created: 2026-04-27
---

## Members

By slice ownership (theme-contiguous, NOT random):

- **Sam** (semantic-dedup priming) — owns the dedup-heavy slice
- **Mark** (pragmatic priming) — owns context-field-heavy slice (cost,
  reversibility, prerequisites, blast radius)
- **Ron** (correctness priming) — owns the conflicts-with mapping

Pool ≤15 → 1 refiner (skip the team).
Pool 15–40 → 3 refiners.
Pool 40+ → 5–6 refiners with explicit cross-slice handoffs.

## Operating mode

- Each refiner reads the **whole pool** but edits **only their slice**
  (own by id-range, not line-range).
- Edit `<root>/ideas.md` IN PLACE — append `Refined:` field per idea,
  `Refined-merged-into: <id>` for dups (no deletion — z039 / append-
  mostly).
- Each refiner also writes `<root>/refine/refiners/<NN>-<theme>.md` —
  working notes (decisions, frictions, open questions ≤3).
- Orchestrator (Mark) does the merge step: pulls dups together, adds
  cross-slice gap-fills, sorts pool, writes structural summary at top.

## Output artifact

Edited `<root>/ideas.md` with structural summary at top:

```
> **Refine summary** (round N, date): M ideas in pool.
> - K dups merged.
> - G gap-fills added.
> - C cost-small ideas (try-first candidates).
> - Q conflicts-with pairs.
> - Strongest convergence (≥3 sources): <ids>.
```

## When to use this team

- Driven by the `refine` skill.
- After `brainstorm` produces a noisy pool.
- Direct trigger: "refine these" / "sharpen the pool" / "clean up the
  brainstorm".

## Common failure modes

- **Refiners ranking ideas.** That's prioritize's job.
- **Deleting ideas.** Always `Refined-merged-into:` — preserve forward.
- **Editing other refiners' slices.** Stay in your id-range.
- **Random partition instead of by-theme.** Refiners need context to
  recognize semantic dups; random slices break that.
- **Skipping the structural summary.** Prioritize lands cold and needs
  the orientation.
