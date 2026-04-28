# Evals — Build Plan (v0)

**Triggered:** Lihu, 2026-04-28: *"build it. a-z. standalone out of production code… few principles for the eval: have known measurable params; know how each tweak effects each param; be able to simulate multi dimensions — different llms, different system prompts, on the same 'mental model'/'data state'; enable an automated way where claude knows the dog (definition of good), and iterate using the eval infra until the prompt achieves the goal."*

**Source design:** `usegin/research/evals/SYNTHESIS.md` + `usegin/research/evals/recommendation.md` (closed 2026-04-27). Lihu's directive **overrides R1 toward Effi-first** (he wants iteration on Effi + Effraim system prompts). Everything else holds.

**Standalone, in `usegin/evals/`. Not production code.** `python-services/` and `nextjs-app/` are not touched by this build.

---

## Lihu's four principles (non-negotiable)

1. **Known measurable params.** Every run produces explicit, named, comparable metrics. No "judge says 7/10" without naming the dimension.
2. **Know how each tweak affects each param.** Attribution: a prompt change → a delta on each metric. Diffs land per-metric, not aggregate-only.
3. **Multi-dimensional simulation.** `model × system_prompt × case` matrix. Same case = same "mental model / data state" — the agent sees identical inputs across the matrix; only the LLM and the prompt vary. Lihu and Oria both said "matrices" verbatim ([00:18:13]).
4. **DoG-driven autonomous iteration.** A `Definition of Good` document (markdown, Claude-readable) names the goal in plain language. `dx evals iterate` spawns a Claude director that reads the DoG, mutates the prompt against the eval, scores, and stops when DoG is met (or budget exhausted). The director cannot edit cases or scorers (PreToolUse hook locks them — `tdd-execute` precedent).

---

## Folder layout (per Poll-F's design)

```
usegin/evals/
  README.md               # human face
  CLAUDE.md               # Gin operating manual
  charter.md              # standing charter (z023)
  BUILD-PLAN.md           # this file
  principles/             # the four above + anti-Goodhart
  framework/
    judges/               # judge prompts (markdown, model-agnostic, fork-on-edit)
    scorers/              # structural-assertion library (Python modules)
    runners/              # the actual runner code
    configs/              # named eval suites
  effi/
    cases/                # transcript-pointers + expected_shape
    dogs/                 # Definition-of-Good docs (one per goal)
    runs/                 # committed eval-run results
    baselines/            # frozen reference scores
    README.md
  gin/                    # parallel structure (start empty; populate v1+)
    cases/ runs/ baselines/ dogs/ README.md
  sandbox/                # gitignored — for `iterate` worker mutations
  RD/                     # closed: research/evals → moved into here for cohabitation? no — keep separate
```

**`sandbox/` is gitignored** (per SYNTHESIS DV4 split). `runs/` is committed (per A's call + F's "interesting runs" predicate at scale — at v0, all runs are interesting).

---

## Slices (vertical, in ship order)

Each slice ships independently, lands a commit, is testable in isolation. Worker per slice; orchestrator (this file's owner) verifies + commits + pushes.

### S1 — Skeleton + READMEs + principles
**Output:**
- `usegin/evals/README.md` (human-facing, what+why)
- `usegin/evals/CLAUDE.md` (Gin operating manual, what to do when working inside)
- `usegin/evals/charter.md` (standing charter)
- `usegin/evals/principles/01-measurable-params.md` … `principles/04-dog-driven-iteration.md` + `principles/05-anti-goodhart.md`
- `usegin/evals/effi/README.md`, `usegin/evals/gin/README.md`
- `.gitignore` exception for `usegin/evals/sandbox/` (the inner ignore)
**Acceptance:** a fresh reader (Lihu or another Gin) opens `README.md` and within 2 minutes knows what this is, where to put a new case, where to read a result.

### S2 — Case envelope + DoG schema + first Effi case
**Output:**
- `framework/case-schema.md` — the JSON case envelope: `{id, source: {kind: transcript|prompt, uri|prompt}, mental_model: {dataset_uri?, fixtures?}, dog_ref, expected: {tool_calls?, citations?, no_pii?, shape_hints[]}}`.
- `framework/dog-schema.md` — Definition-of-Good doc shape: H1 goal, H2 dimensions (named, measurable), H2 success criteria per dimension, H2 anti-criteria (Goodhart bait), H2 calibration anchors.
- `effi/dogs/citation-faithful.md` — first DoG: "Effi's answer must be faithful to the cited source." Three named dimensions (citation_present, citation_correct, claim_supported_by_citation).
- `effi/cases/effi-001-citation-test.json` — first concrete case: a real transcript-pointer from `conversations` bucket OR a synthetic-but-plausible test if bucket access is gated. The "mental model" is the actual dogfooding project state.
**Acceptance:** Lihu reads `case-schema.md` + `dog-schema.md` + the first case in 5 minutes and can write case #2 himself.

### S3 — `dx evals run` (single-axis runner — one model, one prompt, all cases)
**Output:**
- `tools/dx/src/evals/index.ts` (or `.../evals.ts`) — new `dx evals` subcommand registered in `tools/dx/src/cli.ts`.
- `framework/runners/run.ts` — for each case: construct prompt (system + user), call Anthropic SDK, capture trace, score against DoG via single Opus judge call, write `<corpus>/runs/<utc>-<sha>-<slug>/{summary.json, <case>.json}` + a `summary.md` table.
- One self-test in `tools/dx/src/evals/run.test.ts` — runs against a fixture case, asserts the result-folder shape.
**Acceptance:** `dx evals run --corpus effi --suite default` produces a folder with one .json per case + a summary.md. JSON is greppable; .md is readable.

### S4 — Matrix mode (`--matrix model=… --matrix prompt=…`)
**Output:**
- Extend `dx evals run` with `--matrix` flags. Cartesian product across the named axes; each combination is its own row in `summary.md` + its own .json file under `runs/<id>/<combo-slug>.json`.
- `framework/runners/matrix.ts` — the cartesian iterator + per-cell scorer dispatch.
- Drift report: for each metric, the matrix view shows delta-vs-baseline.
**Acceptance:** `dx evals run --matrix model=opus,sonnet --matrix prompt=v1,v2 --corpus effi` produces a 4-cell grid in summary.md with per-cell scores per dimension.

### S5 — `dx evals iterate` (DoG-driven autonomous mutation loop)
**Output:**
- `dx evals iterate <prompt-path> --dog <dog-path> --corpus effi --budget 10` subcommand.
- `framework/runners/iterate.ts` — Director-shape: spawns a `cell` of N stateless Haiku workers, each handed a sandbox copy under `usegin/evals/sandbox/<run-id>/<gen>/<worker>/` and a charter to mutate ONE artifact (the prompt). Cases + scorers are write-locked by a PreToolUse hook (skill-scoped, mirrors `tdd-execute`).
- Director reads leaderboard after each generation; kills losers; spawns mutations of winners; stops on (a) budget exhausted, (b) DoG met (all dimensions ≥ threshold defined in DoG), (c) score plateau (≤+1pp over last K generations), (d) discipline-reviewer veto.
- `iterate-runs/<id>/winner.diff` + `decision.md` (z020 shape) committed when the human promotes; sandbox stays gitignored.
- Hook: `.claude/skills/evals-iterate/hooks/lock-cases-scorers.sh` denies edits to `framework/scorers/`, `<corpus>/cases/`, `<corpus>/dogs/` from worker tool calls.
**Acceptance:** running iterate against a deliberately-bad prompt produces a winner.diff that, when applied, raises DoG-score by ≥1pp.

### S6 — `evals` skill + closing zettel + RESUME
**Output:**
- `.claude/skills/evals/SKILL.md` — triggers ("evaluate prompt against …", "let claude iterate on …", "/evals"), points at `dx evals` CLI + this folder.
- `usegin/evals/RESUME.md` — front-door pointer for the next agent who picks up evals work.
- `usegin/zettel/zettels/z109-evals-v0-built.md` — closing zettel.
- README links updated to point at the new sub-app.
**Acceptance:** Lihu types `/evals` or "let's iterate on the Effi prompt" and Gin lands inside this sub-app with full context.

---

## Out of scope for v0 (defer to v1)

- Effraim agent (doesn't exist yet in the codebase; framework is agent-agnostic so Effraim plugs in by adding an entry to a model/prompt registry).
- `dx evals harvest` — the auto-harvester from `is_error=TRUE` Effi sessions. Manual case authoring at v0; harvest in v1.
- Tiered judge cost mix (R3 in recommendation.md) — single Opus judge at v0.
- The 24h auto-promote watch window for `iterate` — at v0 every iterate winner produces `winner.diff`; human applies. Auto-promote within `usegin/**` is v1.
- Inter-rater capture (C's weekly Lihu spot-check) — v1.
- Dashboard / `dx evals show` rich UI — v1; v0 emits markdown tables.

---

## Build sequencing

Sequential, one slice at a time. Each slice → one worker spawn → orchestrator verifies diff → commit + push (with `scripts/hooks/snapshot-staged.sh` tripwire) → next slice.

Worker model per slice: **Opus** for S2 (schema design — load-bearing), S5 (Director + hook — load-bearing). **Sonnet** for S1 (scaffolding), S3 (runner — clear-cut once schema is set), S4 (matrix extension), S6 (skill + zettel — clear-cut).

Orchestrator (main thread) stays out of the editing — verifies, commits, drives. Per `liaison` posture.

---

## Definition-of-Done for the whole build

When this file is closed:
- `dx evals run --corpus effi --suite default` works end-to-end against ≥1 real case.
- `dx evals run --matrix model=opus,sonnet --matrix prompt=v1,v2` produces a 4-cell grid.
- `dx evals iterate <bad-prompt>` against a constructed-to-fail case produces a measurable winner.
- `evals` skill invocable; `usegin/evals/RESUME.md` is the front door.
- z109 closing zettel committed.
- All artifacts on `origin/main`. No production code touched.
