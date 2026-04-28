# Principle 3 — Simulate across the full matrix: model × prompt × case

The case IS the constant. Everything else — model, prompt, temperature — is a
variable. The matrix makes that explicit.

## Why

A single (model, prompt) pair produces a number. A matrix produces a surface.
The surface shows you: which model benefits from this prompt change? Which
cases expose the regression that others mask? Does Sonnet gain more from the
citation instruction than Opus does?

Lihu and Oria both named "matrices" explicitly in the founding meeting. This
is not a v1 sophistication — it is the evaluation posture. Running one model
against one prompt and declaring "evals pass" is a point estimate. Point
estimates produce false confidence.

The "mental model / data state" is what makes a case a case: the identical
inputs (source transcript, conversation state, available tools, injected
context) that the agent sees regardless of which (model, prompt) cell it's
placed in. Only the model and the system prompt vary across the matrix. The
case fixture is invariant.

## How to apply

The matrix has three axes. Every axis is independently variable:

- **`model`** — e.g., `claude-opus-4-5`, `claude-sonnet-4-6`. Declare in
  the suite config or on the command line via `--matrix model=opus,sonnet`.
- **`system_prompt`** — a named prompt version or a path to a snapshot.
  Declare via `--matrix prompt=v1,v2` or as a list in the suite config.
- **`case`** — the set of cases in the suite. Fixed for a given run; the
  matrix is (model × prompt) × case, not model × prompt × case as an
  unconstrained triple.

The runner produces one result row per `(model, prompt, case)` triple. The
summary table has one column per metric, one row per triple:

```
| model       | prompt | case      | citation_present | claim_supported |
|-------------|--------|-----------|-----------------|-----------------|
| opus-4-5    | v1     | effi-001  | 1.00            | 0.75            |
| opus-4-5    | v2     | effi-001  | 1.00            | 0.83            |
| sonnet-4-6  | v1     | effi-001  | 0.67            | 0.50            |
| sonnet-4-6  | v2     | effi-001  | 1.00            | 0.67            |
```

The case fixture (`effi-001`) is the same across all rows. The transcript
pointer, the mental model (dogfooding project state), the expected shape —
identical. Only the cell changes.

For the Effi corpus: "mental model / data state" means the actual knowledge
state of the dogfooding project at the time the session was recorded — Drive
docs, email threads, meeting notes indexed. For the Gin corpus: "mental model"
means the skill's evals.json context — the exact input prompt and tool list
the skill receives.

## Anti-pattern

Running evals against only one model and declaring a prompt improvement
"general." Prompt changes interact with model behavior in non-obvious ways.
A system-prompt addition that helps Opus may hurt Sonnet's token efficiency.
Always run the matrix on a proposed change before promoting.

Also: treating the case as variable across a comparison. If you change both
the case set and the prompt between two runs, you cannot attribute the delta.
The case set is fixed within a comparison; only (model, prompt) varies.

## Cross-refs

- `principles/01-measurable-params.md` — matrix cells produce per-metric
  scores; named metrics make the matrix readable.
- `principles/02-attribution-per-tweak.md` — the matrix extends attribution
  from "which metric moved" to "which (model, prompt) cell moved which metric."
- SYNTHESIS.md CF3 — two parallel corpora, shared substrate. The matrix
  runner is the substrate; effi/ and gin/ are the case sources.
- BUILD-PLAN.md S4 — `dx evals run --matrix` is the matrix slice.
- recommendation.md R4 — the 4-cell grid (`opus × sonnet`, `v1 × v2`) is
  the demo target for the full build.
