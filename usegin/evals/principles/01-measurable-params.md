# Principle 1 — Every eval run names its metrics; "judge says 7" is not a metric

A run without named dimensions is an opinion. Named, comparable metrics are
the minimum unit of evidence.

## Why

The purpose of evals is to produce a delta: "prompt change X raised
citation_present from 0.71 to 0.84." That sentence requires three things:
a named dimension (`citation_present`), a numeric value (`0.71`), and a
comparable baseline. Without all three, the run is anecdote. Anecdote
accumulates without updating belief.

The temptation is to have a judge say "this is a 7/10" and call it done.
But "7/10" carries no dimension. You can't tell whether the next run at 6/10
is a regression on faithfulness or citation-correctness or both. You can't
know which prompt tweak moved which dial. The metric names ARE the
measurement system — without them, you are not measuring.

## How to apply

Every eval dimension must be:
- **Named.** A slug that appears in the case file, the scorer, the run JSON,
  and the summary table. Example: `citation_present`, `tool_call_shape_valid`,
  `no_pii_leak`, `claim_supported_by_citation`.
- **Typed.** Boolean, integer count, or float in [0,1]. No free-text scores.
- **Grounded.** Either structural (deterministic function of the output) or
  judge-assessed (Claude-as-judge against an explicit rubric). Mixed is fine;
  undeclared is not.
- **Listed in the DoG.** The Definition-of-Good document for a suite names
  every dimension and its threshold. The runner fails the run if it produces a
  dimension not listed in the DoG, or misses one that is.

In the run summary:

```
| case               | citation_present | citation_correct | claim_supported |
|--------------------|-----------------|-----------------|-----------------|
| effi-001           | 1.00            | 0.83            | 0.75            |
| effi-002           | 0.67            | 0.67            | 0.50            |
| baseline (v3)      | 0.85            | 0.80            | 0.70            |
| delta              | ↑ +0.15         | ↑ +0.03         | ↑ +0.05         |
```

## Anti-pattern

"The judge said it was good overall, 8/10." This is not a metric. If a
reviewer asks "which dimension moved?", this answer cannot answer. Retire
any judge rubric that produces only an aggregate score without named
sub-scores. Fork it into a rubric with named dimensions.

## Cross-refs

- `principles/02-attribution-per-tweak.md` — the delta only exists because
  the metric was named.
- `principles/04-dog-driven-iteration.md` — the DoG defines the thresholds
  per dimension; unnamed metrics can't have thresholds.
- SYNTHESIS.md CF9 — scorer pyramid: structural-first, judge-second; structural
  scores are inherently named.
- BUILD-PLAN.md S2 — the case schema and DoG schema enforce named dimensions
  at the data layer.
