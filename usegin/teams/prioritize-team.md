---
name: prioritize-team
purpose: Rank a refined idea pool against criteria via independent prioritizers + Borda + convergence-bucket aggregation.
size: 4
mode: parallel-independent + Borda merge
created: 2026-04-27
---

## Members

- **Mark** (pragmatic priming: "prefer Effort over Impact when tied")
- **Johan** (strategist priming: "prefer Impact and Strategic Fit;
  tolerate Effort cost")
- **John** (risk-conscious priming: "prefer Confidence and
  Reversibility")
- **Sam** (evidence-driven priming: "weight Confidence by convergence
  count from brainstorm `From:` field")

Optional 5th — **Cal** (scope-skeptic priming: "default smaller scope")
when the pool has heavy "should we?" splits.

## Operating mode

- Spawn in one batched response.
- **No reading peer rankings.** Independence is what makes Borda
  meaningful.
- Each writes to `<root>/prioritize/prioritizers/<NN>-<name>.md` with a
  full ranking + per-criterion scores + 1-line rationale per idea.
- Orchestrator (Mark, outside the team) aggregates via:
  - **Borda count** — each rank-1 gets N points, rank-2 gets N-1, etc.
  - **Convergence buckets** — count how many placed each idea in
    top-K (K = ⌈pool/3⌉).
- Both views in `aggregate.md`.

## Charter shape (per prioritizer)

- read-first: ideas.md (whole pool) + criteria.md + topic.md
- the persona priming
- mandate: rank EVERY idea, score each on 4-5 criteria, rationale
  references ≥2 criteria
- honor `Conflicts-with:` (no ties), skip `Refined-merged-into:`,
  treat gap-fills one tier lower
- working rules (no edit ideas.md, no peer reading, no commits)
- deliverable: ranking table

## Output artifact

`<root>/prioritize/aggregate.md` (Borda + convergence) +
`<root>/ideas.md` populated with `Rank:` and `Rationale:` fields +
dilemmas section in z026 shape for splits.

## When to use this team

- Driven by the `prioritize` skill.
- After `refine` produces a legible pool (atomic titles, four context
  fields, conflicts mapped).
- Direct trigger: "rank these" / "pick winners" / "what should we do
  first".

## Common failure modes

- **Solo prioritization.** Skipping the team because "I can rank these
  myself" — that's exactly the bias the team prevents.
- **Mono-priming.** All four as "pragmatic PM" → identical rankings.
  Vary primings (3 distinct, doubled up if N>3).
- **Borda without convergence-buckets.** Borda alone hides "team agrees
  on top-3 but split on rank-4". Always present both.
- **Changing criteria mid-round.** Invalidates aggregation.
