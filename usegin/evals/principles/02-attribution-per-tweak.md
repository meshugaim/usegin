# Principle 2 — A prompt change produces a per-metric delta, not a verdict

Improvement is only real if you can name which dimension moved and by how much.

## Why

Without per-metric attribution, evals become a vibe detector: "the new prompt
feels better." Vibe detectors cannot be automated. They can't tell you whether
to keep a change or revert it. They can't drive `dx evals iterate`.

The attribution chain is: one prompt tweak → one re-run → per-metric delta
table → decision. Break any link and the chain fails. If you change two things
at once, the delta is uninterpretable. If you aggregate metrics before
attributing, the signal is lost.

This principle is what makes Lihu's "know how each tweak affects each param"
concrete: the run output is the attribution surface.

## How to apply

One tweak per iterate generation. The `iterate` director enforces this:
each worker mutates exactly one artifact (the prompt under iteration); no
worker may change scorers, cases, or DoGs. The pre-run snapshot captures the
exact system prompt, tool definitions, and model version so the delta is
unambiguous.

The run summary must always show:

1. **Current run scores** — per case, per dimension.
2. **Baseline scores** — from `<corpus>/baselines/<suite>.json`.
3. **Delta** — per dimension, signed (↑ / ↓ / =).
4. **What changed** — a one-line description of the tweak (from the commit
   message or the `iterate` generation label).

Example delta table:

```
Tweak: added "always cite the exact Drive document title" to system prompt

| dimension          | baseline | this run | delta  |
|--------------------|----------|----------|--------|
| citation_present   | 0.85     | 1.00     | ↑+0.15 |
| citation_correct   | 0.80     | 0.83     | ↑+0.03 |
| claim_supported    | 0.70     | 0.75     | ↑+0.05 |
| latency_ms (med)   | 4200     | 4400     | ↓+200  |
```

This table says: the citation instruction helped all faithfulness metrics but
added 200ms latency. That is a decision surface. "Feels better" is not.

## Anti-pattern

Running before and after a multi-change refactor and declaring "it improved."
The delta is real but unattributable. Revert to single-tweak runs. If a
refactor must happen all at once, the delta is informational only — document
it as a snapshot, not an attribution.

Also: reporting only the aggregate score ("mean judge score went from 7.1 to
7.4"). If the aggregate moved, you need the per-dimension breakdown to know
whether to keep it. Mean judge score is a summary for communication, not a
decision input.

## Cross-refs

- `principles/01-measurable-params.md` — named metrics are the pre-condition
  for attribution.
- `principles/04-dog-driven-iteration.md` — the iterate director enforces
  single-tweak discipline automatically.
- SYNTHESIS.md CF6 — the PreToolUse hook that locks cases + scorers enforces
  the "one mutable artifact per worker" invariant.
- BUILD-PLAN.md S4 — the matrix runner produces the multi-axis attribution
  surface (model × prompt × case).
