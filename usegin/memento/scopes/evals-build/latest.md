# Polaroid — 2026-04-28 11:48 UTC (scope: evals-build)

## Who am I

Gin building the **evals sub-app a-z** per Lihu's 2026-04-28 directive ("build it. a-z. standalone out of production code… so we can iterate programantically on system prompts for effi and effraim"). Liaison posture: orchestrate Wes-shape workers + Ron review per slice; main thread verifies + commits + pushes. Sequential vertical slices (S1..S6) per `usegin/evals/BUILD-PLAN.md`. Scoped Polaroid because main `usegin/memento/latest.md` belongs to a parallel Slack-aftermath run.

## The kill

Ship `usegin/evals/` v0 — standalone sub-app with `dx evals run` (single + matrix) + `dx evals iterate` (DoG-driven autonomous Director loop) so Lihu can iterate Effi/Effraim system prompts programmatically.

## Where I am

- **Phase:** S5 mid-fix (Ron review batch in flight, fix worker crashed at API socket error after 29 tool uses).
- **Done (committed + pushed to main):**
  - **S0 scaffold + BUILD-PLAN** — `5e4bab277`
  - **S1 skeleton** (README/CLAUDE/charter/5 principles + corpus READMEs) — `9319f9107`
  - **S2 case+DoG schemas + first Effi case** — `66282d1e9`
  - **S3 `dx evals run` single-axis runner** (with Ron's 5-blocker+8-nit fix) — `ec0c36d84`
  - **S4 matrix mode `--matrix model=… --matrix prompt=…`** (with Ron's 6-blocker+6-improvement+2-note rework) — `09214287c`
- **Not done (open-to-empty addresses I created):**
  - `usegin/evals/effi/iterate-runs/` exists on disk untracked; needs `.gitignore` entry (Ron fix #15)
  - `.claude/skills/evals-iterate/SKILL.md` + `hooks/pre-tool-use.sh` exist untracked; need `EVALS_ITERATE_RUN_ID` env-gate (Ron fix #12)
  - S6 (evals skill registration + closing zettel + RESUME) — not started
- **In flight (started but not finished — DO NOT TRUST CURRENT STATE):**
  - `tools/dx/src/evals/lib/iterate-director.ts` — original S5 worker landed; fix worker began applying Ron's 4 blockers + 8 improvements + 3 nits but crashed at API socket error
  - `tools/dx/src/evals/lib/iterate-writer.ts` — same uncertainty
  - `tools/dx/src/evals/lib/iterate-stub.ts` — same
  - `tools/dx/src/evals/commands/iterate.ts` + `iterate.test.ts` — same
  - `tools/dx/src/evals/index.ts` — modified (registered iterate subcommand)
  - **None of S5 is committed.** Last commit is S4 (`09214287c`).

## THE ONE THING

> **S5 is uncommitted and partially-fixed. Before doing ANYTHING else: `bun test ./tools/dx/src/evals/ 2>&1 | tail -10` to see if tests are green; then `git diff 09214287c -- tools/dx/src/evals/lib/iterate-director.ts | wc -l` to gauge what the fix worker changed against the original S5 baseline. Decide: replay the fix from scratch, or finish what's there.**

## Pending decisions / questions

- ↑ S5 fix #8 (live-mode `promptOverride` plumbing through `runCase`) is load-bearing for principle 4 — was the fix worker doing option (a) plumbing, or did it punt to gaps.md? Check the diff before re-spawning.
- ↑ The full Ron fix charter for S5 is in conversation history at the failed `Agent` invocation labeled "Fix S5 — apply Ron's 15-item batch" (subagent_type=general-purpose, name=evals-s5-fix). Re-spawn with same charter if state is unrecoverable.

## Don't-trust-yourself warnings

- **S5 files on disk are an unknown mix of original-S5-worker output + partial-fix-worker edits.** Don't commit blindly. Verify with diff before either committing or re-spawning.
- **`usegin/evals/effi/iterate-runs/` is on disk but not in `.gitignore` yet** — if you autosync, sample iterate-run files leak to main. Add `usegin/evals/{effi,gin}/iterate-runs/` to `usegin/evals/.gitignore` BEFORE any commit.
- **The `evals-iterate` skill SKILL.md is untracked** — its hook will engage for ANY Edit/Write call once committed (no env-gate yet per fix #12). Don't commit S5 without the env-gate fix or you brick your own ability to edit `framework/scorers/`.
- **`m-stop` was invoked because Lihu typed `/m-stop`** — explicit close, not panic. Resume cleanly when Gin wakes.
- **6-page Ron review of S5 is NOT lost** — it's in conversation transcript above the fix-worker spawn. Look for "Ron's review of S5" or grep for "isPlateau is wrong-direction".
- **Main `usegin/memento/latest.md` was overwritten by a parallel Slack-aftermath run polaroid** — this is why I scoped to `scopes/evals-build/`. Don't merge them.

## Resume cue

> **First action on wake:**
> 1. `bun test ./tools/dx/src/evals/ 2>&1 | tail -10`
> 2. `git diff 09214287c -- tools/dx/src/evals/lib/iterate-director.ts | wc -l`
> 3. If tests green AND diff substantial → spawn Ron review on current state. If REWORK still needed, re-spawn fix worker with the unchanged 15-item charter from prior turn.
> 4. If tests fail OR diff partial → re-spawn fix worker from scratch with the same 15-item charter.

## Tattoos still holding

- z003 (open-to-empty), z032 (laconic), z002 (no later), z020 (decision shape) — standard
- `feedback_liaison_fix_everything` — fix every Ron finding in single pass, no triage by "scope"
- `feedback_single_iteration_review` — one review pass per phase
- `reference_autosync_concurrent_collisions` — `bash scripts/hooks/snapshot-staged.sh` before EVERY commit (multi-Gin tripwire)
- `feedback_commits_at_every_change` + `feedback_always_push` — commit per slice, push immediately
- Effi-direct meeting fetch (use-gin entry) — `effi meetings show <id> --transcript | jq -r .meeting.transcript | grep` when `effi ask` loops on Hebrew/paraphrased queries
- **Lihu's 4 principles for evals (THIS build):** measurable params; attribution per tweak; multi-dim simulation (case = invariant fixture, model+prompt = matrix axes); DoG-driven iteration

## Pointers

- BUILD-PLAN: `usegin/evals/BUILD-PLAN.md`
- Source design: `usegin/research/evals/SYNTHESIS.md` + `recommendation.md` (closed yesterday)
- Recent commits: `git log --oneline -10` (last clean: `09214287c evals(s4): matrix mode`)
- Tasks: S5 in_progress, S6 pending
- Ron's S5 review (verbatim) — conversation history above fix-worker spawn
- Fix-worker charter for S5 — conversation history at the failed `Agent` call
- First case + DoG: `usegin/evals/effi/{cases,dogs}/`
- Hook precedent: `.claude/skills/tdd-execute/hooks/pre-tool-use.sh`
- Three Effi prompts: `usegin/evals/effi/prompts/{baseline.md, strict-citations.md, prod-snapshot-2026-04-28.md}`
