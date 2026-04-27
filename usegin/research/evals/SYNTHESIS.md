# Evals R&D — Synthesis

**Round:** 6 angles closed 2026-04-27. Trigger: Oria's "I can have a v0 of an eval framework for us by tomorrow" at today's Feature Prioritization meeting [00:18:30], in response to Guy's "we'll never prioritize the whole evals story." Charters under `usegin/research/evals/<angle>/charter.md`; whiteboards under same paths as `whiteboard.md`.

The six Polls (A v0-click, B dataset-sourcing, C scoring-methods, D landscape-buy-vs-build, E dx-let-claude-run, F subapp-shape) ran independently. Convergence is high — five of the six independently arrived at the same v0 shape. The dialectic is preserved where it landed, especially DV1 (Effi-first vs Gin-first) and DV3 (auto-promotion bright line for autonomous-iterate).

---

## The load-bearing finding

**The corpus already exists; only the runner is missing.** Both surfaces (Effi product, Gin dev-loop) capture every session as Claude-Agent-SDK JSONL — Effi in the Supabase `conversations` bucket (`is_error`, `claude_session_id`, `storage_path` already indexed), Gin in `~/agent-records/<user>/YYYY-MM/YYYY-MM-DD/*.jsonl.gz` (auto-synced to GitHub). The skills `spec` and `fix-bug` already ship `evals.json` files (3 + 2 cases) with the canonical case shape — natural-language `assertions[]` written by hand for skill QA. A ~300-line wrapper around `anthropic` SDK + headless-claude + commit-to-`runs/` ships v0 by tomorrow against the existing 5 cases, with the harvester (`dx evals harvest`) following in week 2 to auto-stage candidates from `is_error=TRUE` Effi sessions and from Gin sessions named in friction zettels. **Adopting any framework before this point would lock-in a data model we are about to invent.** Anthropic's published guidance ("Demystifying Evals for AI Agents," 2025) names exactly this floor: 20–50 real-failure tasks; early changes carry large effect sizes so small samples suffice.

This forecloses the entire "build vs buy" question for v0. The substrate is already laid; the click is the runner that walks it.

---

## Convergent findings (3+ angles independently agree → high-confidence facts)

These are settled. Not dilemmas.

| # | Finding | Where it shows up |
|---|---|---|
| **CF1** | **Build minimal, no framework adoption at v0.** ~300 LOC of TS or Python around `anthropic` SDK + JSON case files + judge calls + flat `runs/` folder. Frameworks (Braintrust, LangSmith, etc.) lock prompt store + scoring rubrics into proprietary models before we have 20 real cases. Adopt Langfuse (MIT, self-host) or Inspect AI (MIT, used by Anthropic internally) only at v1 if case-count > 100 and a shared trace dashboard is needed. | A (Top), D (Top + matrix), E (CLI shape), F (folder layout) |
| **CF2** | **Cases are transcript-pointers + assertion-shapes, never copy-pasted prompts.** Effi case = `{source_uri, turn_range, expected_shape}` referencing a real session JSONL. Gin case = the existing `evals.json` shape with a natural-language `assertions[]` list. The case file references the substrate; it does not embed it. | A (`assertions[]` reuse), B (case envelope), F (cases/ as references) |
| **CF3** | **Two parallel corpora, shared substrate, never shared cases.** `usegin/evals/effi/` + `usegin/evals/gin/` for cases/runs/baselines; one `framework/` (judges, scorers, runner) shared. A Gin orchestration regression is not an Effi product regression; the rubrics differ, the judges may differ, but the parser/envelope/runner is one. | B (D3), E (Top #4), F (Top + tree) |
| **CF4** | **Result-surface: files committed to git under `runs/`, with delta line in markdown summary.** JSONL for full per-case verdicts + .md for the human-readable + greppable view. Both committed (small files, durable interest, PR-reviewable). Transcripts (big files) live in `~/agent-records/` or sandbox, not in `runs/`. | A (Top #5), E (`<ts>-<sha>-<slug>/` shape), F (runs/ tree) |
| **CF5** | **`dx evals` as the CLI face, `evals` skill as the agent face — z022 two-faces.** Mirrors `dx slack`'s shape: subcommands (`run`, `list`, `show`, `compare`, `iterate`, `baseline`), `--json` flag, prefix matching, embedded docs, human → stderr / JSON → stdout. The skill triggers ("evaluate the prompt against …", "let Claude iterate on …") drive the same CLI. | A (Top #4), E (CLI sketch), F (graduation question) |
| **CF6** | **Autonomous-iteration loop must lock cases + scorers via PreToolUse hook.** This is the load-bearing closure for "let Claude run on it overnight." Without the hook, a worker that hits a wall will rewrite the test, not the prompt — empirical lesson from `tdd-execute` session `9e966133`. The same 3-wall isolation tdd-execute uses (tool list + skill prompt + PreToolUse hook denying edits to forbidden paths) ports onto a `cell`-style swarm of stateless workers, each mutating one artifact in `usegin/evals/sandbox/<run>/<gen>/<worker>/`. | E (Top #2 + hook design), C (anti-Goodhart shape), A (defers iteration to v1) |
| **CF7** | **Effi-side and Gin-side session JSONLs are the same SDK transcript shape.** The harvester (`dx evals harvest`) is one parser, two source paths. Existing tools — `tools/session/`, `effi-session-audit` skill — already touch this data daily; no new infra is needed to read it. | B (matrix row), E (corpus routing), A (existing infra leverage) |
| **CF8** | **Anthropic's published floor is 20–50 real-failure cases.** Our 5 starter cases (3 spec + 2 fix-bug) are below the floor; v0 ships at 5 to honor "by tomorrow"; week-2 harvester moves us into the published range. The shape we ship at 5 is the same shape that scales to 50. | D (Anthropic citation), A (5 = right minimum for v0), B (week-2 trajectory) |
| **CF9** | **Scorer pyramid: structural-first, judge-second, human-third.** ~20 deterministic structural assertions derived from `effi-session-audit/references/pitfalls.md` catch ~70% of what Lihu catches by hand at near-zero cost. Claude-as-judge handles what structure can't (faithfulness, intent, synthesis quality). Human annotation only at the calibration boundary + the frozen golden set (~5 "must never break" cases). | C (Top, three-layer), A (judge for v0 because case assertions are NL), D (Anthropic guidance: calibrate against human gold) |
| **CF10** | **Trajectory-aware scoring, not outcome-only.** Half the failure modes in `pitfalls.md` are trajectory-failures that produce a confident outcome (loops, parameter fumbles, ignored context, mid-trajectory confabulation papered over by a final synthesis). Score per-turn structurally + per-session aggregate (min/sum/max shape, not single average). | C (Top + DL2), B (case envelope includes turn_range), E (per-case judge transcripts) |
| **CF11** | **Sub-app stays in `usegin/`; only the *runtime* graduates.** `usegin/evals/` is the data home (cases, judges, scorers, runs, baselines) forever. The runner graduates to `tools/dx/evals/` when (and only when) a non-Gin team-member needs to drive a run from the terminal — same split as `usegin/` (workspace) ↔ `tools/dx/` (CLI). The cases, judges, configs, and runs continue to live under `usegin/evals/` even after graduation. | F (Top), A (D4 lean: stay under dx), E (CLI lives at `tools/dx/src/evals/`) |
| **CF12** | **Variance budget: N≥3 runs per case, report median + IQR.** Effi is non-deterministic; a single run is not a measurement. Cases whose IQR exceeds half the scoring scale are flagged "high-variance" and either re-classified (genuinely ambiguous), instrumented (missing structural assertion), or quarantined (intentionally probabilistic, tracked separately). | C (DL3), A (defers to v1 for cost), D (calibration concern) |

---

## Divergent points (real dilemmas — angles disagree or frame differently)

These need a Lean + a call. Promoted to `recommendation.md` in z026 shape where they need Lihu's input; resolved here when the disagreement is shallow.

### DV1 — Effi-first vs Gin-first for v0 *(load-bearing — meeting-shape question)*
- **A** picks **Gin-first** explicitly: tomorrow-feasibility forces it (the data already exists for skills, not yet for Effi).
- **B, C, F** treat both as parallel from day one (two-corpora-from-day-one).
- **E** ships one CLI for both, routed by inferred path — agnostic.
- **The meeting trigger was Effi-product context** (Guy's "we'll never prioritize the whole evals story" was about prompt-iteration on Effi). If the answer Lihu wanted was "regress-protection on Effi prompts by tomorrow," Gin-first is insufficient and the day-1 estimate slips. If the answer was "the substrate that lets Claude iterate, which proves the shape," Gin-first is right.
- **Synthesis lean: Gin-first ships v0 tomorrow; Effi-first ships v1 by Friday with the harvester providing the corpus.** Both are real; sequencing is the call. → recommendation R1.

### DV2 — Auto-promotion bright line for `dx evals iterate` *(load-bearing for "let Claude run on it")*
- **E DL1** frames this exhaustively: A) sandbox-only always, B) auto-promote within `usegin/**` + `.claude/skills/**` only, C) auto-promote anywhere with three-wall trust.
- E leans **B**, matching the existing repo invariant: sandbox-vs-promote = customer-impacting bright line. Effi prompts (customer-impacting) iterate in sandbox; Gin's own skills (not customer-impacting) auto-promote with a 24h watch window.
- No other angle disagrees, but the call is too consequential to settle in synthesis. → recommendation R2.

### DV3 — Judge cost vs structural coverage at scale
- **C DL1** lays out three options: judge-heavy ($60–180/run for 200 cases × 3 runs), structural-heavy (10× cheaper but blind to confabulation that uses real citations), tiered (full structural + cheap judge always, expensive N=3 judge only on flagged cases).
- C leans **tiered**.
- A defers (uses single Opus judge at v0, which is below the v1 cost question).
- D notes Anthropic's guidance: "closely calibrate with human experts" — judge has to be calibrated regardless, doesn't tell us cost mix.
- **Synthesis lean: single judge at v0 (A's pick stands); tiered at v1 once case count > 50 and run cadence is daily.** Cost only becomes load-bearing once we leave the 5-case floor. → recommendation R3.

### DV4 — Commit `runs/` to git or gitignore-with-promote?
- **A**: commit everything under `usegin/evals/runs/` — small files, team-visible, durable.
- **F DL1**: lean B (commit only "interesting" runs — regression / baseline-bump / human-flagged); A floods git history with noise from headless-claude-swarm runs (could be hundreds/day from `iterate`).
- **E**: commits `runs/<ts>-<sha>-<slug>/`, gitignores `sandbox/`. Splits the difference at the directory level.
- **Synthesis lean: E's split.** `runs/` (real explicit-runs) committed; `iterate-runs/<id>/sandbox/` gitignored; `iterate-runs/<id>/winner.diff` + `decision.md` committed when human promotes. Honors A's "every run is a brain artifact" for the small directed runs and F's "git lean" for the swarm sandbox. No new dilemma — synthesis collapses this. ✓

### DV5 — Worker mutation strategy for `iterate`: parallel-shallow Haiku vs sequential-deep Sonnet?
- **E DL3** poses the choice and leans **A for v0, C (hybrid) for v1**: parallel-shallow Haiku swarm matches `cell` topology and Oria's "matrices" framing; hybrid (Haiku scout, Sonnet refine) is a v1 sophistication.
- No other angle touches it.
- **Synthesis lean: accept E's lean.** v0 ships parallel-shallow Haiku; v1 lifts to hybrid. ✓

### DV6 — Two corpora, one CLI vs two CLIs?
- **B** keeps two parallel `cases/effi/` + `cases/gin/` but assumes one runner.
- **E** explicit: **one CLI, routed by `--corpus effi|gin` (inferred from artifact path)**. Two corpora collapsing into one tool is the lesson from the slack round (E collapsed into C).
- **F** picks single sub-app with sub-trees.
- **Synthesis: settled, one CLI.** ✓ No dilemma.

### DV7 — Trace-replay vs tool-mocked replay for v0
- **B DL1** flags this. Trace-replay (assert structural properties on existing JSONLs, no Anthropic spend) is cheapest and v0-feasible but purely backward-looking — won't fire on a new prompt change. Tool-mocked replay (SDK harness injects tool results back) is a week of work, not a day.
- B leans trace-replay if "v0 by tomorrow" is satisfied by it.
- **A's v0 actually does live-replay with headless-claude** (subprocess `claude -p ...` runs the case through fresh) — so A's design is mode 3 (live), not B's mode 1 (trace).
- The disagreement is real but *only on the Effi corpus*. For Gin-skill-evals (A's v0), live-replay is the right shape — the "case" is a prompt, not a session. For Effi (B's domain), live-replay is expensive; trace-replay is the v0 floor.
- **Synthesis lean:** **per-corpus mode**: Gin uses live-replay (case = prompt); Effi uses trace-replay at v0, lifts to live-replay at v1 once budget is approved. → recommendation R4.

### DV8 — Judge versioning: fork-on-edit or in-place?
- **F DL3**: lean fork (`judge-v1.md`, `judge-v2.md`, never edit) so runs reference judges by stable filename. C's N=3 rotated-rubric design also implicitly assumes this — rotation requires multiple stable variants.
- No other angle disagrees.
- **Synthesis: settled, fork-on-edit, with `framework/judges/CURRENT.md` symlink/pointer.** ✓ No dilemma.

---

## Per-corpus path map

| Layer | Effi corpus | Gin corpus |
|---|---|---|
| **Case shape** | `{source_uri: <conversations bucket path>, turn_range: [a,b], expected_shape: {tool_calls_must_include, citations_required, ...}}` | Existing `.claude/skills/<name>/evals/evals.json` shape with NL `assertions[]` |
| **Source of cases** | `conversations` table where `is_error=TRUE` (last 14d) + 2 hand-picked happy-path | Existing skill `evals.json` files (5 cases today) + 3 painful Gin sessions named in zettels (z094, autosync tikurs) |
| **Replay mode (v0)** | Trace-replay (mode 1) — assert structural properties on the existing JSONL | Live-replay (mode 3) — subprocess `claude -p` against the case prompt |
| **Replay mode (v1)** | Live-replay with budget approval | Same |
| **Scorer** | Structural battery (S01–S20 from C) + single Opus judge against `expected_shape` | Single Opus judge against `assertions[]` (A's design); structural battery added in v1 |
| **Cadence (v0)** | On-demand only | On-demand + per-PR (when `usegin/` adopts PR flow) |
| **Cadence (v1)** | Nightly cron + on-demand | + nightly cron after 24h-watch lands |
| **Auto-promote zone for `iterate`** | Sandbox-only — Lihu applies diff manually | Within `.claude/skills/` and `usegin/` — auto-promote with 24h watch window |
| **Result surface** | `usegin/evals/effi/runs/<ts>-<sha>-<slug>/` committed; Slack post forced; CHANGELOG append; Linear comment when `--linear` | `usegin/evals/gin/runs/<ts>-<sha>-<slug>/` committed; Slack post optional |

---

## Open friction zettels worth filing

(Captured in whiteboards; flagging here for the closing zettel to thread.)

1. **`dx evals harvest` is the missing link** between have-data and have-corpus. Today every harvest is hand-rolled (effi-session-audit, ad-hoc `agent-records find`). Fix lands in `tools/dx/`. — from B.
2. **Linear bugs lack `claude_session_id` cross-references.** Most bug issues describe symptoms but don't pin the prod session. Manual back-link is high friction. Fix: small change to `fix-bug` skill that captures session-id when filing. — from B.
3. **`dx his` ratings are write-only as eval-source today.** They exist; nothing reads them as candidate-eval signal. Highest-yield untapped harvest source for Gin. — from B.
4. **`cell` defaults to git worktrees; `evals iterate` wants sandbox-as-subdir** (`cp -r`, not `git worktree add`). Reach for the right primitive when implementing. — from E.
5. **No inter-rater capture infrastructure for the human calibration loop.** C's weekly 10-case Lihu spot-check has nowhere to land — needs a `dx evals calibrate` flow. Cross-cuts to E + F. — from C.
6. **Yohai (comptroller) audits sessions; evals score them.** Same job in two costumes, or genuinely different? Worth a zettel naming the distinction. — from F.

---

## Pointers to the whiteboards

- `v0-click/whiteboard.md` — the click; ~6h shippable, 5 cases, single judge, glob `.claude/skills/*/evals/`
- `dataset-sourcing/whiteboard.md` — harvester not corpus; `is_error=TRUE` + zettel-named-friction as v0 sources
- `scoring-methods/whiteboard.md` — three-layer pyramid; trajectory-aware; 3 anti-Goodhart mechanisms; N=3 variance budget
- `landscape-buy-vs-build/whiteboard.md` — full tooling matrix with citations; "build minimal" rationale; v1 graduation thresholds
- `dx-let-claude-run/whiteboard.md` — `dx evals` CLI sketch; autonomous-iterate Director shape; PreToolUse hook closure
- `subapp-shape/whiteboard.md` — folder tree; governance; graduation question; judge fork-on-edit

Decisions for Lihu in `recommendation.md`.
