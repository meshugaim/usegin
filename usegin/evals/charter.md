# Evals — Standing Charter

**Instantiation:** z023 pattern. This charter is the standing authority for
all evals work inside `usegin/evals/`. Every spawned sub-Gin reads it before
doing anything.

**Triggered:** Lihu, 2026-04-28, in response to Oria's "v0 of an eval
framework by tomorrow" and the prior R&D round (SYNTHESIS.md, 6 angles).

---

## Purpose

Make agent quality measurable so that a prompt change produces a named delta
on a named metric, and so that "Claude iterates on the prompt until the DoG
is met" is an actual workflow, not a metaphor.

The frame: **the corpus already exists; only the runner is missing** (CF1 in
SYNTHESIS.md). We are not building measurement infrastructure from scratch —
we are wrapping the Effi `conversations` bucket and the Gin
`.claude/skills/*/evals/evals.json` files with a thin runner, judge layer,
and result surface.

---

## Key tasks

1. Maintain `effi/cases/` and `gin/cases/` as the ground truth of what we
   test. Cases are transcript-pointers + assertion shapes — they reference
   the substrate, they do not embed it.
2. Write and version judge rubrics in `framework/judges/`. Fork on every
   edit; runs reference judges by stable filename.
3. Run suites on demand (and eventually on a schedule). Commit results to
   `<corpus>/runs/`. Post a summary to `#usegin` on regressions.
4. Maintain baselines in `<corpus>/baselines/`. Bump only on explicit
   Lihu sign-off; the baseline IS the regression signal.
5. Run `dx evals iterate` to let Claude mutate a prompt in `sandbox/`
   against a DoG, stopping when the DoG is met or the budget is exhausted.
6. Name every case, DoG, and judge change in a zettel the same turn it
   lands.

---

## End state

`dx evals run --corpus effi --suite default` works end-to-end against ≥1
real Effi case. `dx evals run --matrix model=opus,sonnet --matrix
prompt=v1,v2` produces a 4-cell grid. `dx evals iterate <bad-prompt>` against
a constructed-to-fail case produces a measurable winner.diff. The `evals`
skill is invocable. `RESUME.md` is the front door for the next session.

---

## Doctrinal pointers

- **Principles 01–05** in `principles/` — the five load-bearing rules.
  Read before touching a judge, scorer, or baseline.
- **SYNTHESIS.md** (12 convergent findings) — the why behind every
  structural choice. When a choice seems arbitrary, find it in CF1–CF12.
- **recommendation.md** (Lihu's three calls) — R1 (Gin-first sequencing),
  R2 (sandbox/auto-promote line), R3 (judge cost posture) are settled.
  Don't re-open them without a new finding.
- **BUILD-PLAN.md** — the six slices, in ship order. S1 is skeleton
  (this file); S6 closes the sub-app. Stay in slice order.
- z009 (friction is signal), z022 (two faces), z023 (instantiation), z026
  (dilemma shape), z027 (unlimited resources).

---

## Selbständigkeit

Sub-Gins working inside this charter may:
- Add cases, DoGs, and judges within the existing schema.
- Run suites and commit results.
- Append to `gaps.md` and file zettels.
- Propose baseline bumps (but not execute them without Lihu).
- Mutate prompts in `sandbox/` via `dx evals iterate`.

Sub-Gins may NOT:
- Touch production code (`nextjs-app/`, `python-services/`).
- Edit existing cases, DoGs, or judges in-place (retire + supersede only).
- Bump baselines without Lihu's explicit sign-off.
- Auto-promote Effi production prompts from sandbox to live.
- Re-open settled decisions (R1, R2, R3) without a new finding.

When a sub-Gin hits a wall, the right move is: append to `gaps.md`, file
a zettel, surface the dilemma in `decisions-pending/<topic>.md` (z026
shape), stop. There is no final report — only living artifacts.

---

## Decision rights

| Decision | Who |
|---|---|
| Add a case | Any team member or Gin |
| Retire a case | Lihu (Effi corpus), any team member (Gin corpus) |
| Add a judge version | Lihu or Gin-with-explanation |
| Edit a judge in-place | Nobody — fork only |
| Bump a baseline | Lihu only |
| Promote an iterate winner (Effi) | Lihu manually applies winner.diff |
| Promote an iterate winner (Gin skills) | Auto-promote within `usegin/**`, `.claude/skills/**`; 24h watch window |
| Open a new corpus sub-tree | Lihu |

---

## Fresh-Haiku test

A fresh Haiku agent, handed only this charter and `README.md`, should be
able to:
1. Add a new case to `gin/cases/` with correct front-matter.
2. Run the default suite against it (`dx evals run --corpus gin`).
3. Read the resulting `summary.md` and name which assertion failed and why.
4. File a zettel about the failure.

If it can't, the charter or schema is underspecified. Fix the charter, not
the Haiku.
