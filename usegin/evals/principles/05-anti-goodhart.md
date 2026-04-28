# Principle 5 — Protect the eval from being gamed by the thing you're evaluating

Any scorer that can be maximized will be maximized. The eval infrastructure
must be hardened against the optimization pressure it creates.

## Why

Goodhart's Law is not a distant risk for evals — it is the central failure
mode. The moment you define a metric (citation_present ≥ 0.95), you create
pressure to satisfy it by any means. A sufficiently capable prompt-mutation
director will find the shortcut: add boilerplate citations, repeat the
source title without connecting it to the claim, structure the output so
structural assertions pass regardless of content quality.

Three mechanisms guard against this. They come from Poll-C's work
(SYNTHESIS.md scoring-methods angle). They are independent: each catches a
failure mode the others miss. All three must be active in a production eval
suite; none is optional.

## Mechanism 1 — Rotated rubric

The judge does not use the same rubric every run. A pool of ≥3 rubric
variants is maintained in `framework/judges/`; the runner selects one
at random per run (seeded by the run-id for reproducibility). Each variant
operationalizes the same DoG dimensions differently — different examples,
different phrasing, different anti-criteria emphasis.

A prompt that Goodharts rubric variant A will not Goodhart variants B and C.
A genuine quality improvement scores well across all variants.

Implementation: `framework/configs/<suite>.yaml` lists the judge pool.
Runner samples from the pool per run. The selected judge filename is captured
in `<corpus>/runs/<id>/meta.json`.

At v0, a single judge is acceptable (5 cases; Goodhart pressure is low).
The rotated pool is the v1 target once case-count > 20 and iterate has run
>10 generations.

## Mechanism 2 — Blind monthly human re-baseline

Once per month, Lihu (or a designated team member) re-scores 10 cases by
hand, blind to the current eval scores. The human scores are compared to
the eval scores for the same cases.

If human-eval agreement (Cohen's κ) drops below 0.6 on a dimension, that
dimension's scorer or judge is considered drifted and must be reviewed.

The comparison is committed to `<corpus>/baselines/human-calibration-<YYYY-MM>.json`.
The runner tracks κ over time. A sustained κ < 0.6 is a signal to retire the
judge and fork a calibrated replacement.

This mechanism catches Goodhart at the dimension level: if the eval says
citation_present = 1.0 and the human says 0.6, the scorer is wrong, not
the prompt.

Implementation: `dx evals calibrate --corpus effi --n 10` (v1 primitive, to
be built in recommendation.md's "following week" block). Until then, manual.
Results are committed by hand to the calibration folder.

## Mechanism 3 — Dissent-detector vibe judge

In addition to the primary scorer/judge, every run includes a secondary
"vibe" judge whose only job is to disagree with the primary when the primary
is satisfied. The vibe judge is given the case, the output, and the primary
score, and is asked: "Is this a genuine quality answer, or does it satisfy
the metric while defeating the goal?"

The vibe judge produces a binary: `AGREE` or `DISSENT` with a one-sentence
reason. A `DISSENT` is not a veto — it is a flag. The summary table shows
`vibe: DISSENT` in red; Lihu reviews flagged cases before promoting.

The vibe judge is intentionally adversarial. It is prompted to assume the
primary judge is being gamed and to look for evidence that the output is
technically compliant but substantively wrong.

Implementation: `framework/judges/vibe-v1.md` — the dissent-detector rubric.
Runner calls it after the primary judge, attaches result to the case JSON.

## Anti-pattern

Running the vibe judge as the primary judge. The vibe judge's value is its
independence from the primary. Using only the vibe judge produces a system
that is all dissent and no signal. The mechanisms work because they are
layered, not substituted.

Also: treating a month with no Dissents as confirmation the eval is working.
No Dissents could mean the eval is healthy, or it could mean the vibe judge's
prompting has drifted to be too agreeable. Monitor κ on the vibe judge too.

## Cross-refs

- `principles/04-dog-driven-iteration.md` — anti-criteria in the DoG are the
  declarative version of anti-Goodhart; the three mechanisms are the runtime
  enforcement.
- `principles/01-measurable-params.md` — named dimensions are the attack
  surface; anti-Goodhart defends that surface.
- SYNTHESIS.md CF9 — scorer pyramid: structural-first catches structural
  shortcuts; judge-second catches semantic ones; human-third calibrates both.
- SYNTHESIS.md CF12 — variance budget (N≥3, report median + IQR); high-IQR
  cases are Goodhart candidates.
- framework/judges/vibe-v1.md (to be written in S2+) — the dissent-detector
  rubric.
