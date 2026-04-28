# Evals — how we know our agents are getting better

Two agents, two corpora, one measurement substrate. `usegin/evals/` is the
data home for everything we know about how Effi and Gin perform.

## What this is

A standalone sub-app (parallel to `usegin/zettel/`, `usegin/consultant/`)
that houses eval cases, judge rubrics, scorer libraries, run results, and
baselines for two corpora:

- **`effi/`** — AskEffi-product sessions. Cases reference real transcripts
  from the `conversations` bucket. The question is: is Effi answering
  faithfully, citing correctly, not hallucinating?
- **`gin/`** — Gin dev-loop sessions. Cases live in
  `.claude/skills/*/evals/evals.json`. The question is: does the skill
  trigger correctly, does it achieve its stated goal?

Both corpora share one `framework/` substrate (judge rubrics, structural
scorers, runner shell, named suite configs). Cases and runs are corpus-local.

Design source: `usegin/research/evals/SYNTHESIS.md` (12 convergent findings)
and `usegin/research/evals/recommendation.md` (Lihu's three calls + R4
sequence). Build sequence: `BUILD-PLAN.md`.

## How to drive it

```bash
# Run a suite (once dx evals is graduated to tools/dx/)
dx evals run --corpus gin --suite default

# Until graduation — invoke the runner directly
bun usegin/evals/framework/runners/run.ts --corpus gin --suite default

# Run a matrix (model × prompt)
dx evals run --matrix model=opus,sonnet --matrix prompt=v1,v2 --corpus effi

# Autonomous prompt iteration against a DoG
dx evals iterate <prompt-path> --dog effi/dogs/citation-faithful.md --budget 10
```

Results land in `<corpus>/runs/<YYYY-MM-DD-HHMM>-<suite>-<sha>/`. Each run
folder has one `.json` per case plus `summary.md` (human-readable table).

## Where things live

| Artifact | Path |
|---|---|
| Effi cases | `effi/cases/<id>.json` |
| Effi DoG docs | `effi/dogs/<goal>.md` |
| Effi run results | `effi/runs/<ts>-<suite>-<sha>/` |
| Effi frozen baselines | `effi/baselines/<suite>.json` |
| Gin cases | `gin/cases/<id>.json` (or via `.claude/skills/*/evals/evals.json`) |
| Gin DoG docs | `gin/dogs/<goal>.md` |
| Gin run results | `gin/runs/<ts>-<suite>-<sha>/` |
| Gin frozen baselines | `gin/baselines/<suite>.json` |
| Judge rubrics | `framework/judges/<judge-vN>.md` |
| Structural scorers | `framework/scorers/<scorer>.*` |
| Named suites | `framework/configs/<suite>.yaml` |
| Runner code | `framework/runners/` |
| Principles | `principles/` |
| Standing charter | `charter.md` |
| Build plan | `BUILD-PLAN.md` |
| Iterate sandbox (gitignored) | `sandbox/` |

## Two corpora — when to add to which

Add to **`effi/`** when the case is about product quality: faithfulness,
citation correctness, no-PII, tool-call shape, confabulation. Cases are
transcript-pointers into the `conversations` bucket. Source: `is_error=TRUE`
sessions or hand-picked regression triggers. Effi cases are ship-grade — slow
churn, anti-leakage, Linear-tied.

Add to **`gin/`** when the case is about skill recall and agent behavior:
does the skill trigger?, does `dx evals run` do the right thing?, does
`morning-brief` surface the right context? Cases are dev-loop-grade — faster
churn, no PII, free to mutate.

## Standalone posture

This sub-app does not import from other usegin sub-apps. It cross-references
by name (e.g. "see `usegin/zettel/zettels/z078`"). Production code
(`nextjs-app/`, `python-services/`) does not import from here. The reverse
direction is allowed: cases may reference production prompts/tool-defs by
path snapshot.
