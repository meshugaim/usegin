# Subapp-shape — whiteboard (angle F)

## Top — the click

`usegin/evals/` is built as a **single sub-app with two parallel corpora sub-trees** (`effi/` + `gin/`) sharing one `framework/` substrate (judges, scorer libs, runner shell). Stays in `usegin/` as the **standalone-and-stays-there** posture by default; the *runtime* (a `dx evals` CLI) graduates to `tools/dx/` when (and only when) a non-Gin team-member needs to drive a run from the terminal — but **the cases, judges, configs, and runs continue to live under `usegin/evals/`** even after graduation. The sub-app and the executable are separable: same split as `usegin/` (workspace) ↔ `tools/dx/` (CLI), per `usegin/README.md` lines 32-33 and z033.

Recommended tree (open-to-empty on day 1):

```
usegin/evals/
  README.md            # human face — what this is, how to drive it
  CLAUDE.md            # Gin face — operating manual when working inside
  charter.md           # the standing charter for evals work (z023)
  principles/          # load-bearing principles (anti-Goodhart, freeze-baseline, etc.)
  framework/           # the shared substrate (judges, scorers, runner shape)
    judges/            # judge rubrics + prompts (markdown, model-agnostic)
    scorers/           # structural-assertion library (PII-leak, tool-call-shape, …)
    configs/           # named eval suites: which cases × which scorers × which baselines
  effi/                # corpus 1: AskEffi-product cases
    cases/             # case files (yaml/json), one per case
    runs/              # committed eval-run results, one folder per run
    baselines/         # frozen reference scores per suite
    README.md          # what's special about this corpus
  gin/                 # corpus 2: Gin-internal dev-loop cases
    cases/
    runs/
    baselines/
    README.md
  RD/                  # research manager whiteboards (matches usegin convention)
  gaps.md              # append-only friction log (clones zettel/gaps.md)
  things-we-grow.md    # local registry — eval-suites, judges, baselines as growable artifacts
```

## Middle — the body

### Tree, one line per node

- `README.md` / `CLAUDE.md` — two faces (z022). Human gets "what / why / how to add a case", Gin gets the operating manual.
- `charter.md` — every spawned sub-Gin reads it (mirrors `consultant/charter.md`). Names the goal, scope, allowed sources, deliverable shape, stop condition.
- `principles/` — 4-6 load-bearing principles for evals work (anti-Goodhart, freeze-then-fork-baseline, cases-are-append-mostly, judges-are-versioned, regression-is-a-zettel-trigger). Mirrors `usegin/zettel/principles/`.
- `framework/judges/<judge>.md` — one file per judge: rubric, scoring scale, examples. Plain markdown so humans + Gin both read it; the runtime (angle E) is what compiles them into prompts.
- `framework/scorers/<scorer>.{md,py,ts}` — structural-assertion library. Tool-call-shape, citations-present, PII-leak, latency-budget, etc. Code lives here too because scorers ARE code (tiny pure functions); judges are prompts.
- `framework/configs/<suite>.yaml` — named suites. `effi-prompt-regression-v1`, `gin-skill-trigger-fidelity`, etc. Each suite = (case-glob × scorer-set × judge-set × baseline-ref).
- `<corpus>/cases/<case-id>.yaml` — one file per case. Front-matter with id, origin, threads (zettel/Linear), retired-at?, supersedes?.
- `<corpus>/runs/<YYYY-MM-DD-HHMM>-<suite>-<sha>/` — one folder per run. Contains: inputs snapshot, raw outputs, scorer outputs, judge outputs, summary.json, README.md (human-readable verdict).
- `<corpus>/baselines/<suite>.json` — frozen reference. Bumped by explicit human-or-Gin commit, never auto-overwritten.
- `RD/<manager>/whiteboard.md` — for follow-on R&D inside the sub-app, same shape as `usegin/zettel/RD/`.

### Two-corpora layout — decision

**Decision: parallel sub-trees (`effi/` + `gin/`), NOT a single tree with prefixes.**

| | Single tree, prefixed | Two parallel sub-trees |
|---|---|---|
| Browse-by-corpus | grep / glob | `ls effi/` |
| Different cadences | invisible | structural |
| Different governance | invisible | structural |
| Cross-corpus suite | trivial | `framework/configs/cross-cutting.yaml` references both |
| Risk of leakage between corpora | higher (one accidental path) | lower (different folders) |

Effi cases ship-grade (slow churn, anti-leakage critical, Linear-tied), Gin cases dev-loop-grade (faster churn, no PII, freer to mutate). Different cadences → different sub-trees. Shared `framework/` substrate prevents drift.

### Governance table

| Artifact | Who can add | Who can retire | How a change lands |
|---|---|---|---|
| `effi/cases/*` | Lihu, Oria, Nitsan, Gin (PR-style: writes case + opens decision-pending) | Lihu only (retire = mark `retired-at` + reason; never delete) | direct commit for humans; Gin writes + flags in `gaps.md` |
| `gin/cases/*` | Anyone on the team, Gin freely | Lihu or any team-member | direct commit |
| `framework/judges/*` | Lihu, Gin-with-explanation | Lihu (judges are versioned: `judge-v2.md`, never edit-in-place after first use) | new version commit; old version stays |
| `framework/scorers/*` | Anyone (it's code) | Anyone | normal code-review path |
| `framework/configs/*` | Anyone | Lihu | direct commit; new suite is its own file |
| `<corpus>/baselines/*` | Lihu only (bump = explicit decision) | n/a — baselines are frozen, you fork to a new one | commit message: "bump baseline X v3 → v4 because Y" |
| `<corpus>/runs/*` | auto-written by runner | auto-pruned by runner per retention policy (see dilemma below) | commit if surfacing a regression; otherwise see dilemma |

### Zettel integration mechanism

A case file's front-matter threads to the zettel that motivated it. Same shape as zettel front-matter:

```yaml
---
id: effi-case-0042
title: prompt regression — Effi confabulates owner when Drive doc has stale ACL
origin: zettel        # zettel | linear | curated | synthetic | session-audit
threads: [~z078, ~ENG-5612, ~runs/2026-04-23-1830-effi-prompt-v3-abc1234]
created: 2026-04-27
authored-by: gin      # human | gin | consultant
status: active        # active | retired
retired-at: null
retired-because: null
---
```

- `threads:` uses the same prefix legend as zettels (`~` cross-ref, `↑` parent).
- When a case is added because of a regression, `origin: zettel` + `threads: [~zNNN]` is required.
- A new zettel can be **emitted FROM** a case run too — `dx zettel add --as=usegin --threads "~effi-case-0042"` lifts the finding back into the brain. The flow is bidirectional.

### Relation to AskEffi product code — boundary statement

`usegin/evals/` is **100% Gin-internal**. Production code (`nextjs-app/`, `python-services/`) does **not** import from it. The reverse direction is allowed and expected: cases reference production prompts/tool-defs by **path snapshot**, not by live import.

Snapshot mechanism: a case captures the prompt/tool-def text it's evaluating and stores it inline (or hashes a copy in the run folder). When prod code changes, suites are re-run against the new snapshot — diff is the eval signal. This breaks any import-coupling and makes the boundary explicit.

If/when a future world wants prod CI to gate on evals (per-PR check), the *runner* graduates to `python-services/evals_runner/` reading the same `usegin/evals/` files — runtime moves, data stays.

### Graduation path — thresholds

There are **three independent graduation axes**, not one. Each can move on its own:

1. **Runtime → `tools/dx/evals/`** when *any* of:
   - Non-Gin team-member needs to drive a run from the terminal (Oria/Nitsan/Lihu types `dx evals run <suite>` instead of asking Gin).
   - Cadence becomes scheduled (cron, pre-push, post-deploy) and needs a stable CLI surface.
   - The "spawn N headless claudes against the eval" pattern (angle E) is invoked >5× and would benefit from a wrapper.
2. **CI gate → `python-services/evals/` (or workflow yml)** when *all* of:
   - >50 stable cases in `effi/cases/`.
   - Baseline-bump cadence < monthly (we trust the signal).
   - One full quarter of zero false-positives on baseline regression.
3. **Public/customer surface → never (this is internal)** unless we explicitly decide otherwise. Eval *results* may surface to customers (status page, "we eval our agent"), but cases/judges stay internal — they're our test set.

The default posture: **the sub-app stays in `usegin/` forever**. Graduation is about the runtime, not the data. The data is brain — same as zettels.

### README.md outline (under `usegin/evals/`)

```
# Evals — how we know our agents are getting better
## What this is (1 paragraph: two corpora, one substrate, why)
## How to add a case (the lowest-friction path: `dx evals add --corpus effi`)
## How to run a suite (`dx evals run <suite>` once graduated; `bun usegin/evals/framework/runner.ts <suite>` until then)
## How to read a run folder (what's in `runs/<id>/`)
## Two corpora (effi/ vs gin/ — when to add to which)
## Layout note (parallel to zettel, consultant, zisser — standalone sub-app)
```

### CLAUDE.md outline (under `usegin/evals/`)

```
# Evals sub-app — agent instructions
## What this sub-app is (1 paragraph)
## Standalone-repo posture (no imports across sub-apps; cross-ref by name)
## Where things go (table: case | judge | scorer | config | run | baseline | gaps | RD)
## How to add a case (front-matter shape, threading discipline, origin field)
## When to write a new judge vs reuse one (versioning rule: never edit, fork)
## When to bump a baseline (Lihu-only; commit message shape)
## Working rules (anti-Goodhart, freeze-baseline, cases-append-mostly,
##   regression-is-a-zettel-trigger, two-faces-when-suitable)
## Stop condition (per-run vs per-suite vs per-charter)
## Friction is signal (lift to gaps.md AND a zettel via dx zettel add)
```

## Bottom — the open ends

### Dilemmas (z026 shape)

**Decision needed:** Commit `<corpus>/runs/` to git or gitignore?
- **Options:** A) commit everything / B) commit only "interesting" runs (regression / baseline-bump / human-flagged) / C) gitignore entirely, push to a separate store
- **Lean:** B
- **Why:** A floods git history with noise from headless-claude-swarm runs (angle E) — could be hundreds/day. C breaks the "open-to-empty + grep-friendly" usegin posture (no out-of-tree state). B preserves transparency for the runs that matter and keeps git lean. Implementation: runner writes to `runs/` ignored by default, then `dx evals promote <run>` moves it to a committed path.
- **Price:** the `dx evals promote` step is friction; a useful run could die before promotion if the runner cleans up.
- **Risk:** the "interesting" predicate becomes the system's selection bias. Mitigation: aggressive default (any baseline diff > epsilon → auto-promote).
- **For Lihu:** is the principle "every run is a brain artifact" (→ A) load-bearing here, or is it OK to have an ephemeral substrate (→ B/C)?

**Decision needed:** Single tree (`evals/`) with `effi/` + `gin/` sub-trees, OR two top-level peer sub-apps (`usegin/evals-effi/` + `usegin/evals-gin/`)?
- **Options:** A) single sub-app, two corpora sub-trees (this whiteboard's recommendation) / B) two peer sub-apps sharing nothing / C) two peer sub-apps + a third `evals-framework/` sub-app for the substrate
- **Lean:** A
- **Why:** Shared `framework/` is the load-bearing artifact (judges, scorers, configs reused across corpora). B forces duplication or cross-sub-app imports — both bad per `usegin/CLAUDE.md` "do not import each other". C is technically clean but triples the README/CLAUDE.md surface for one shared substrate.
- **Price:** governance has to live in one place even though the two corpora have different rules.
- **Risk:** the `effi/`-vs-`gin/` boundary blurs over time and the substrate gets accidental Effi-isms (or vice versa). Mitigation: scorer/judge files declare `applies-to: [effi, gin]` in front-matter and a lint job checks corpus → applies-to.
- **For Lihu:** does the "sub-apps are standalone, do not import" rule (CLAUDE.md) override the "shared substrate" benefit, or is one sub-app with internal modules acceptable?

**Decision needed:** Judge versioning — fork-on-edit (this whiteboard's default) or in-place-edit + git history?
- **Options:** A) fork (`judge-v1.md`, `judge-v2.md`, never edit) / B) edit in place, rely on git blame
- **Lean:** A
- **Why:** Runs reference judges by filename; if the judge text changes under a run, the run becomes uninterpretable. Fork makes the (run, judge) pair stable forever.
- **Price:** filename clutter; humans have to know which version is current.
- **Risk:** versions sprawl. Mitigation: `framework/judges/CURRENT.md` is a symlink/ref-pointer to the latest.
- **For Lihu:** acceptable to mirror this same rule for *configs* (suite definitions) too? Same arg applies.

### Friction zettels to capture

(None blocking right now — investigation flowed cleanly. Will capture if Lihu's answers force a structural rethink.)

### Open questions for Lihu

1. **Naming.** `usegin/evals/` vs `usegin/eval/` vs `usegin/evaluations/`. Default: `evals/` (shortest, matches Inspect AI / openai-evals naming convention).
2. **Where does the `dx evals` CLI live before graduation?** Default: `usegin/evals/framework/runner.ts` invoked via `bun usegin/evals/framework/runner.ts <suite>` — ugly but honest. Graduates to `dx evals` when criterion 1 above fires.
3. **Charter inheritance.** Should `usegin/evals/charter.md` mirror the doctrinal-pointer block from `usegin/consultant/charter.md`? Default: yes — same Auftragstaktik shape, same friction-is-signal stance.
4. **Effi's own evals.** The README mentions "Effi gets her own 2nd brain eventually" for zettel. Same question for evals: does Effi (the product) ever get her own internal evals surface? Out of scope for v0 but worth marking.
5. **Cross-cut with `comptroller/`.** Yohai (the comptroller) audits sessions; evals score them. Are these the same job in two costumes, or genuinely different? Worth a zettel naming the distinction once Lihu reads this.
