# Principle 4 — Claude reads the DoG, iterates against the eval, stops at goal

The Definition of Good is not a description of quality. It is a stopping
condition that a machine can evaluate.

## Why

"Let Claude iterate on the prompt overnight" is only meaningful if Claude
knows when to stop. Without a DoG, the iterate director has no exit condition
except budget exhaustion. That produces drift: the director optimizes whatever
the scorer happens to reward, which is not necessarily what you wanted.

The DoG makes the goal Claude-readable. It names the dimensions, the
thresholds, and the anti-criteria. The director reads it before the first
generation and uses it to score every generation. When all dimensions meet
their thresholds, the director stops and produces `winner.diff`.

This is the eval-side analog of TDD's Red → Green: the DoG is the Red
(failing test), the iterate loop is Green (make it pass), the freeze is
Refactor (Lihu reviews and promotes). The same three-wall isolation that
`tdd-execute` uses applies here: the worker mutates exactly one artifact
(the prompt), and the test (the case + scorer + DoG) is immutable.

## How to apply

A DoG document has a fixed shape (enforced by `framework/dog-schema.md`):

```markdown
# DoG: <goal name>

## Goal
One sentence: what does success look like for a human reader?

## Dimensions
Each dimension is named, typed, and thresholded:

| dimension         | type    | threshold | notes |
|-------------------|---------|-----------|-------|
| citation_present  | float   | ≥ 0.95    | fraction of answers that include ≥1 citation |
| citation_correct  | float   | ≥ 0.85    | fraction of citations that reference the right source |
| claim_supported   | float   | ≥ 0.80    | fraction of claims traceable to a cited source |

## Anti-criteria (Goodhart bait)
Conditions that would satisfy the metric while defeating the goal:
- Adding a citation to every sentence regardless of relevance → penalized
  by `claim_supported` (unsupported claims still count against)
- Citing a source document that exists but doesn't contain the claim →
  caught by `citation_correct`

## Calibration anchors
Two concrete examples: one that clearly passes, one that clearly fails.
Use these to calibrate a new judge against the DoG.
```

The iterate director workflow:

1. Read DoG → extract dimension thresholds.
2. Spawn N Haiku workers, each with a sandboxed copy of the prompt.
3. Each worker mutates the prompt (one change, per principle 02).
4. Runner scores the new prompt against all cases in the suite.
5. Director reads leaderboard: keep top K, kill rest, spawn mutations of winners.
6. Stop when: (a) all dimensions meet thresholds, (b) budget exhausted,
   (c) score plateau (≤+1pp over last K generations), (d) discipline-reviewer
   veto.
7. Emit `winner.diff` + `decision.md` (z020 shape) to the run folder.

The director cannot edit cases, scorers, dogs, or judges. This is enforced by
`.claude/skills/evals-iterate/hooks/lock-cases-scorers.sh`. A worker that hits
a wall must surface the gap in `gaps.md`, not rewrite the test.

## Anti-pattern

Writing a DoG that is too narrow: "citation_present ≥ 1.0 for all cases."
This is a floor, not a goal. The iterate director achieves it in one generation
(add a citation to every answer) and produces a winner.diff that Goodharts.
A DoG needs anti-criteria that name the ways you can satisfy the metric while
defeating the goal.

Also: a DoG without calibration anchors. The judge interprets the DoG
rubric; without examples, two judge calls on the same answer will diverge.
Calibration anchors are the few-shot examples that ground the judge.

## Cross-refs

- `principles/05-anti-goodhart.md` — the three mechanisms that prevent the
  iterate loop from optimizing the wrong thing.
- `principles/01-measurable-params.md` — DoG dimensions must be named and typed.
- `principles/02-attribution-per-tweak.md` — each iterate generation is
  one tweak; the DoG evaluates the delta.
- SYNTHESIS.md CF6 — PreToolUse hook enforcement for the three-wall isolation.
- BUILD-PLAN.md S5 — the `dx evals iterate` Director implementation.
- framework/dog-schema.md (S2) — the authoritative DoG document shape.
