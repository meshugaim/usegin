# Whiteboard — angle E: dx-let-claude-run

The runtime DX for `usegin/evals/` — what Lihu types, and what happens when **Claude is the runner of the runner**. Oria's framing (transcript [00:18:10–00:18:43]): "what eval gives you is that you can let Claude work on it — go iterate, do matrices, do this." An eval is the **substrate on which Claude self-iterates prompts overnight**. The CLI is just the address of that substrate; the autonomous-iteration loop is the load-bearing differentiator vs. "yet another eval framework."

## Top — the click

**Two surfaces, one substrate.**

1. **Explicit-run (`dx evals run`)** — a deterministic, pull-shaped CLI that mirrors `dx slack`'s shape (subcommands, `--json` to stdout, human to stderr, prefix matching, embedded `docs`). Lihu types `dx evals run prompts/effi.system --suite golden` and gets a run dir under `usegin/evals/runs/<ts>-<sha>-<slug>/` with `summary.json`, per-case `<case>.json`, judge transcripts, and a `diff-vs-baseline.md`. The same CLI surfaces `list`, `show`, `compare`, `judge`, `iterate`, `baseline`, `docs`.

2. **Autonomous-iteration (`dx evals iterate`)** — the night-mode Oria evoked. **Spawns a `cell` of N stateless Haiku/Sonnet workers, each handed a charter to mutate ONE artifact (the prompt, or a single skill file) under `usegin/evals/sandbox/<run-id>/`, scored by the *same fixed eval*; `dx evals iterate` is the *Director*, not a worker.** The Director reads the leaderboard after each generation, kills losers, spawns mutations of winners, and stops on (a) budget exhausted, (b) score plateau (≤+1pp over the last K generations), or (c) the discipline-reviewer veto (a sub-Gin whose only job is "did the mutation cheat the scorer"). **The artifact-under-mutation is the only thing the workers can edit; the cases and the scorer are write-locked by a `tdd-execute`-style PreToolUse hook.** That hook is the load-bearing closure — without it, a worker that hits a wall will rewrite the test, not the prompt (the empirical lesson from `tdd-execute` session `9e966133`).

3. **Regressions surface to `#usegin-evals` via `dx slack post`, plus an `usegin/evals/CHANGELOG.md` append, plus (if the run was tied to a Linear issue via `--linear ENG-XXXX`) a Linear comment via `plan comment`.** Slack is the *notification* (delta, low-latency, team-visible); CHANGELOG is the *record* (durable, grep-able, git-tracked); Linear comment is the *binding to shipped work*. Pick all three, they each carry a different load — but Slack is the only one that's *forced* per run-with-regression. PR check is **out** for v0 (we don't ship from PRs to main yet for usegin/; revisit when we do).

4. **Two corpora, one CLI. Routing via `--corpus effi|gin` (and the inferred default from the artifact path).** `dx evals run prompts/effi.system` defaults `--corpus=effi`; `dx evals run .claude/skills/morning-brief/SKILL.md` defaults `--corpus=gin`. Same dir layout, same scorers' interface, same iterate loop. Different cases, different cadences (Effi = nightly cron + on-demand; Gin = on-demand + per-PR). **NO second CLI.** Two corpora collapsing into one tool is the lesson from the slack round (E collapsed into C).

5. **A new `evals` skill, NOT a sub-skill of `cell` or `experiment`.** It composes them — `cell` for the worker swarm, `experiment` for one-off SDK probes inside a worker. Skill triggers: "evaluate the prompt against …", "let Claude iterate on …", "/evals iterate". Ships with the dx subcommand from day one (`dx evals` is its CLI face, the skill is its agent face — z022 two-faces).

---

## Middle — the body

### CLI surface — `dx evals` (mirrors `dx slack`/`dx zettel`/`dx his`)

Lives at `tools/dx/src/evals/` (sibling to `slack/`, `zettel/`, `his/`). Auth: none (local-only — `~/.anthropic/` for ANTHROPIC_API_KEY when judge model needs to fire; no per-corpus secrets). Output convention: human → stderr, JSON → stdout, `--json` flag, `DX_OUTPUT=json` env. Prefix matching + standard aliases inherited from `applyStandardAliases` and `enablePrefixMatching` (cli.ts:73-74).

```bash
# === Explicit run ===
dx evals run <artifact>                           # run all suites against <artifact>
dx evals run <artifact> --suite golden            # one suite
dx evals run <artifact> --case email-splitter-1   # one case
dx evals run <artifact> --corpus effi             # explicit corpus (default: inferred from path)
dx evals run <artifact> --baseline HEAD~1         # diff against another commit's run
dx evals run <artifact> --linear ENG-5197         # bind run to a Linear issue (auto-comments on regression)
dx evals run <artifact> --judge claude-sonnet-4   # override default judge model
dx evals run <artifact> --no-llm                  # structural assertions only (CI-cheap mode)

# === Inspection ===
dx evals list [--corpus X] [--last 10]            # recent runs (table; --json for pipe)
dx evals show <run-id> [--case X]                 # full per-case detail + judge transcript
dx evals compare <run-a> <run-b>                  # side-by-side score+diff (markdown)
dx evals baseline [--corpus X]                    # show current baseline run-id (the one new runs diff against)
dx evals baseline set <run-id>                    # promote a run to baseline (writes usegin/evals/baselines/<corpus>.json)

# === Autonomous iteration (the load-bearing piece) ===
dx evals iterate <artifact>                       # default: 1 generation, 4 workers, score-plateau stop
dx evals iterate <artifact> \
  --budget 20 \                                   # max worker spawns total
  --width 4 \                                     # workers per generation
  --depth 5 \                                     # max generations
  --target-score 90 \                             # stop when met
  --plateau 3 \                                   # stop after K gens with ≤+1pp delta
  --mutation-charter charters/prompt-tighten.md \ # the charter handed to workers
  --suite golden                                  # which eval drives the leaderboard
dx evals iterate --resume <iterate-id>            # resume a paused/killed iterate run

# === Diff/judge utilities ===
dx evals judge <case-id> --output-a <path> --output-b <path>  # one-off judge call (for spot-checks)
dx evals diff <run-a> <run-b> --case X            # show only the case-level diff

# === Discovery / debug ===
dx evals corpora                                  # list configured corpora and their case counts
dx evals suites [--corpus X]                      # list suites within a corpus
dx evals cases [--suite X]                        # list cases in a suite (id, tags, hash)
dx evals scorers                                  # list available scorers
dx evals docs                                     # embedded docs (mirrors `dx slack docs`)
dx evals self-test                                # end-to-end smoke (one trivial case, fixed seed)
```

**Subcommand-by-subcommand rationale:**

| Cmd | Why it exists | Skipping it costs |
|---|---|---|
| `run` | The atom. Without it nothing else has data. | — |
| `iterate` | The differentiator. The whole point of the angle. | We're a worse promptfoo. |
| `list` / `show` | History without `cat usegin/evals/runs/...`. Mirrors `dx his sessions`/`dx his last`. | Fingers reach for `ls` + `jq` constantly. |
| `compare` | "did this prompt change help" is *the* daily question. | Humans diff JSON in their heads. |
| `baseline` | An eval without a baseline is a thermometer with no zero. Locked, promoted explicitly. | Score drift looks like score change. |
| `judge` | Spot-check the judge's calibration without re-running 200 cases. | Calibration is invisible until it explodes. |
| `corpora`/`suites`/`cases`/`scorers` | Reflective discovery — the same shape as `dx list`/`dx slack channels`. Lets `dx evals` be its own documentation. | Newcomers ask in chat, every time. |
| `docs` | Embedded markdown (like `plan docs`/`dx his`). | Skill text duplicates CLI help. |
| `self-test` | Hook canary. Mirrors `dx his self-test`. | Silent regressions in the runner itself. |

**What `--linear ENG-XXXX` does** (cross-cuts `plan`): on a regression-vs-baseline, posts a Linear comment with the diff table, the baseline run-id, the current run-id, and a `dx evals show <run-id>` invocation to reproduce. Same auto-link shape `dx slack` uses for ENG-IDs (slack-integration whiteboard D: "any `ENG-\d+` token Gin reads is auto-resolved via `plan show`").

### Result-on-disk layout

```
usegin/evals/
├── runs/                                      # git-tracked; each run is one folder
│   └── 2026-04-28T03-12-44Z-a1b2c3d-effi-system-nightly/
│       ├── manifest.json                      # corpus, suite, artifact-sha, runner version, judge model, budget/width/depth (if iterate-spawned), git HEAD
│       ├── summary.json                       # {n_cases, n_pass, n_fail, score_avg, score_per_case[]}
│       ├── summary.md                         # human-readable; the file you `cat` first
│       ├── diff-vs-baseline.md                # ALWAYS present; "no baseline" / "no change" / "+3 pass / -1 fail / list"
│       ├── cases/
│       │   ├── email-splitter-1.json          # full per-case: input, output, score, judge transcript, asserts
│       │   ├── email-splitter-1.judge.md      # judge's prose verdict (separate so it greps cleanly)
│       │   └── ...
│       └── transcript.jsonl                   # the Claude-as-runner session (when applicable; cross-link to ~/agent-records)
├── baselines/
│   ├── effi.json                              # {run_id, promoted_at, promoted_by, score, sha} — the pointer
│   └── gin.json
├── iterate-runs/                              # autonomous-iteration leaderboards + sandbox manifests
│   └── 2026-04-28T03-50-00Z-effi-system-iter/
│       ├── manifest.json                      # charter, budget, width, depth, stop-condition met
│       ├── leaderboard.md                     # generation-by-generation score table
│       ├── generations/
│       │   └── gen-01/
│       │       ├── worker-01/  → symlink into ../../sandbox/...
│       │       ├── worker-02/
│       │       └── ...
│       ├── winner.diff                        # the diff vs baseline artifact — the thing you'd commit
│       ├── winner.run-id                      # which `runs/` entry corresponds to the winner
│       └── decision.md                        # auto-generated z020-shape decision (decided X because Y, price Z, risk W, alternatives rejected)
├── sandbox/                                   # GITIGNORED — workers write here; only `winner.diff` is promoted
│   └── <run-id>/<gen>/<worker>/
└── CHANGELOG.md                               # append-only: every regression-vs-baseline + every iterate winner promoted
```

**Git-friendliness rules:**
- `runs/` IS tracked — small, valuable, grep-able, `code-history`-friendly. Per-case JSON + transcript .jsonl. **Yes, this grows; we'll prune via `dx evals prune --older-than 90d --keep-baselines --keep-regressions` mirroring `dx his prune`.**
- `iterate-runs/` IS tracked — leaderboards and decisions are durable.
- `sandbox/` is **gitignored** — worker scratch, ephemeral, deleted by `dx evals iterate` on stop unless `--keep-sandbox`.
- `baselines/<corpus>.json` IS tracked — moving the baseline is a *commit*, deliberately. (Mirrors how `feedback_format_before_tdd` makes formatter dirt visible by being its own commit.)
- The full session JSONL of any Claude-as-runner / Claude-as-judge call is **also** persisted to `~/agent-records/` (the existing autosync path; reference: `reference_agent_records.md`) so the eval transcript is greppable across all our other agent telemetry.

### The autonomous-iteration loop — load-bearing design

This is the spending-the-most-depth section per charter §Working rules.

#### What "let Claude run on it" means concretely

Oria, [00:18:10]: *"תקשב, מה שאיבל נותן לך זה שאתה יכול לתת לקלוד לעבוד על זה, כאילו, תעבוד, תלך, תתערוץ, תעשה מטריצות"* — listen, what an eval gives you is that you can let Claude work on it: go work, go iterate, do matrices.

**Operationalized:** `dx evals iterate <artifact>` is a Director-shaped Opus that spawns a *cell* (`.claude/skills/cell/`) of stateless Haiku workers, each given **the same charter**, **a different mutation hint**, **the same eval substrate**, and **edit access to exactly one artifact under a sandbox copy of the repo**. The Director never edits. After each generation, it reads the leaderboard, computes the stop condition, and either spawns the next generation (mutating winners) or terminates with a `winner.diff`.

#### The cell topology (mirrors `tdd-execute` 3-wall isolation)

| Role | Model | Tools | Knowledge boundary | Spawn cadence |
|---|---|---|---|---|
| **iterate-Director** (you) | Opus | Read on `runs/`, `iterate-runs/`, `cases/`; Bash for spawn + git diff + scorer invocation; Task to spawn workers. **No Edit/Write on `prompts/`, `cases/`, `scorers/`.** | Sees leaderboard, charter, run manifests, generation history. **Does not see worker mutation diffs until generation closes** (forces leaderboard to be the only signal). | Persistent within an iterate run; stateless across runs. |
| **mutation-worker** | Haiku (default) / Sonnet (with `--worker-model`) | Edit/Write restricted to `usegin/evals/sandbox/<id>/<gen>/<worker>/<artifact-path>` ONLY; Read on the artifact + the charter + the eval suite (cases readable, NOT writable); Bash to run `dx evals run <sandbox-artifact> --suite X --json`. | Sees ONLY the artifact under mutation, the charter, the failing-case list from the parent run, and a one-line "your mutation hint" (e.g., "tighten the system prompt; reduce token count by 20%"). **Does not see other workers' attempts**, does not see the scorer code, does not see the judge prompt. | Stateless one-shot per generation slot. |
| **discipline-reviewer** | Opus | Read on the worker diff + the eval suite; Bash for `dx evals run` re-execution. **No Edit.** | Sees the worker diff, the score, the case-level breakdown. **Brief is unseeded** (`feedback_liaison_review_seeding`). | Stateless one-shot per *winner* per generation (top-1 only — review the floor leaders, not all 4). |
| **scorer-cheat detector** | Opus | Read on diff + scorer source; Bash for AST-level checks. | Sees diff + scorer source. **Specifically asked: did this mutation move the score by changing what the scorer measures rather than what the artifact does?** | Stateless one-shot per winner. (The judge-Goodhart detector. Exists because Haiku will absolutely find that the scorer keys on `len(output) > 50` and just pad outputs.) |

**Why three walls** (mirrors `tdd-execute` §The Director model):
- Tool list (workers can't write outside their sandbox cell)
- Skill prompt (the worker charter explicitly says "you may not edit cases or scorers")
- **PreToolUse hook** at `tools/dx/src/evals/hooks/gate-mutation-by-phase.ts`: reads `iterate-runs/<id>/state.json.locked_paths` (always includes `usegin/evals/cases/`, `usegin/evals/scorers/`, `usegin/evals/judges/`, the entire repo *outside* the sandbox cell) and denies any Edit/Write to those paths. **Including from the Director.** Same enforcement model as `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts`.

If the hook ever fires zero times across an entire iterate run, suspect it's broken — same canary rule as `tdd-execute`. A worker that hits a wall WILL try to "fix" the eval; the hook is what stops it.

#### The loop in pseudocode

```python
def iterate(artifact, charter, suite, *, budget, width, depth, target_score, plateau):
    state = open_iterate_run(artifact, suite)              # creates iterate-runs/<id>/
    baseline = run_eval(artifact, suite)                    # the floor; first leaderboard row
    state.leaderboard.append({"gen": 0, "kind": "baseline", "score": baseline.score, "ref": baseline.run_id})
    write_lock_manifest(state, locked_paths=["usegin/evals/cases/", "usegin/evals/scorers/", "usegin/evals/judges/"])

    spawned = 0
    parents = [{"sandbox": copy_artifact_to_sandbox(artifact, state, gen=0, worker=0), "score": baseline.score}]

    for gen in range(1, depth + 1):
        if spawned >= budget:
            return finish(state, reason="budget", winner=best(state))

        # Spawn `width` workers; each mutates a copy of a randomly-picked parent (winners weighted)
        tasks = []
        mutation_hints = generate_hints(charter, gen, state)   # e.g. ["shorten by 20%", "merge sections X+Y", "add explicit failure-mode instruction", ...]
        for w in range(width):
            parent = pick_weighted(parents)
            sandbox = copy_artifact(parent, state, gen, w)
            tasks.append(spawn_worker(
                model=charter.worker_model,                     # haiku default
                tools=["Read", "Edit", "Write", "Bash"],
                cwd=sandbox.dir,
                allowed_paths=[sandbox.artifact_path],          # PreToolUse hook enforces
                prompt=worker_charter(charter, hint=mutation_hints[w], failing_cases=parent.failing_cases),
            ))
            spawned += 1

        results = wait_all(tasks)                               # bash-notification driven, NOT sleep-poll
        scored = [{"sandbox": r.sandbox, "score": run_eval(r.artifact, suite).score, "diff": git_diff(r.sandbox)} for r in results]
        state.leaderboard.append({"gen": gen, "results": scored})
        write_leaderboard_md(state)

        winner = top(scored)
        if winner.score >= target_score:
            return finish(state, reason="target_met", winner=winner)
        if delta_over_last_k(state, k=plateau) <= 1.0:
            return finish(state, reason="plateau", winner=best(state))

        # Discipline + cheat checks on top winner only (cost control)
        review = spawn_reviewer(winner, charter)
        cheat = spawn_cheat_detector(winner)
        if review.veto or cheat.veto:
            mark_winner_invalid(state, winner, reason=review.veto or cheat.veto)
            winner = next_valid(scored)

        parents = [winner] + [r for r in scored if r.score >= winner.score - 2]   # carry near-winners as parents

    return finish(state, reason="depth_exhausted", winner=best(state))


def finish(state, *, reason, winner):
    write_winner_diff(state, winner)                            # iterate-runs/<id>/winner.diff
    write_decision_md(state, winner, reason)                    # z020-shape: decided X because Y, price Z, risk W, alternatives rejected
    if winner.score > state.baseline.score:
        notify_slack(state, winner)                             # `dx slack post --channel=#usegin-evals`
        append_changelog(state, winner)
    cleanup_sandbox_unless_kept(state)
    return state
```

**Worker charter shape** (this is what gets handed to each Haiku):

```
Purpose: Improve the score of <artifact-name> on suite <suite> from <current-score> to higher.
Substrate: You are operating inside <sandbox-dir>. You may edit ONLY <sandbox-artifact-path>. The PreToolUse hook will deny any other edit. Cases and scorers are read-only.
Failing cases (you do not need to pass all): <list of N failing case-ids with their current outputs and judge verdicts>
Mutation hint for THIS attempt: <one-line hint, varies per worker>
Verification: Run `dx evals run <sandbox-artifact-path> --suite <suite> --json` and report the score. Do NOT modify cases or scorers to change the score (the hook will stop you).
End state: Either (a) score improved + diff committed in sandbox + final score reported, or (b) explicit "no improvement found, here's what I tried."
Decision-rights envelope: You may freely edit the artifact. You may NOT edit anything else. You may NOT spawn sub-workers. You may NOT call out to other corpora.
```

Mutation hints are pulled from a `charters/<charter-name>.md` file — the charter is *itself* a versioned artifact. Default charters ship in-repo:
- `charters/prompt-tighten.md` — "reduce length, sharpen instructions, keep behavior"
- `charters/prompt-add-failure-mode.md` — "the failing cases share <X>; add explicit handling"
- `charters/prompt-decompose.md` — "split monolithic instruction into ordered steps"
- `charters/skill-trigger-tighten.md` — for `.claude/skills/*/SKILL.md` artifacts; tighten the `description:` triggers without losing recall
- `charters/skill-body-shorten.md` — same but for skill body

**Stopping conditions (must all be present, defense-in-depth):**

| Condition | Default | Why this exists |
|---|---|---|
| `--budget N` | 20 | Hard cap on spawn count. Token-cost ceiling. |
| `--depth N` | 5 generations | Wall-clock ceiling. |
| `--plateau K` | 3 gens with ≤+1pp delta | The classic "we've hit the local optimum" signal. Mirrors gradient-descent early-stopping. |
| `--target-score S` | none (off by default) | Use when you have an explicit floor (e.g. "ship if ≥ 85"). |
| Discipline-reviewer veto | always on | Catches "the diff is technically a higher score but the artifact is now incoherent." |
| Cheat-detector veto | always on | Catches Goodhart — see scorer-cheat detector role above. |
| `dx evals iterate kill <id>` | manual | Human override. Same shape as `dx evals iterate resume`. |

#### Why this and not a generic "ralph-loop on the eval"

`ralph-loop` is one Claude looping on itself. That's wrong here for three reasons:
1. **Self-review is the failure mode** (memory: `feedback_companion_session_findings`). Same-context Claude that just lost a generation will rationalize the next mutation. Stateless workers don't.
2. **No leaderboard => no convergence signal**. Ralph stops on a "completion promise" string. We want to stop on *score plateau*, which only exists if there are independent attempts to compare.
3. **Variance.** Width-4 generations explore the local space in parallel, not in series. The same total budget gets you more coverage.

The right comparison is **`tdd-execute`'s Director-tweaker-reviewer-verifier topology** — ported from "make this test pass" to "make this score rise," with cases-and-scorers as the immovable spec.

### Regression-surfacing — pick all three, but Slack is the forced one

| Surface | When fired | Latency | Audience | Durability |
|---|---|---|---|---|
| **`dx slack post --channel=#usegin-evals`** | Every regression-vs-baseline; every iterate winner promoted | Seconds | Team | Slack 90d cap |
| **`usegin/evals/CHANGELOG.md` append** | Same triggers | Same commit | Anyone reading the repo | Forever (git) |
| **Linear comment via `plan comment`** | Only if run was `--linear ENG-XXXX` | Seconds | Issue followers | Forever (Linear) |
| **PR check** | OUT for v0 | — | — | Revisit when usegin/ ships from PRs |

**Slack message shape** (mimics how `dx slack post` is currently used for #usegin breadcrumbs):

```
:warning: *eval regression* — `effi.system` (corpus: effi, suite: golden)
baseline `2026-04-22…dead-beef` → run `2026-04-28…cafe-1234`
score: 87 → 84 (-3pp)  /  pass: 47/50 → 44/50 (-3 cases)
regressed: email-splitter-1, threading-2, citation-7
diff: dx evals diff 2026-04-28…cafe-1234 baseline --case email-splitter-1
reproduce: dx evals show 2026-04-28…cafe-1234
[via Lihu]
```

The reason Slack is forced and the others are not: regressions need to *interrupt*, not *accumulate*. CHANGELOG and Linear are searchable later; Slack is the "stop scrolling" signal. (Mirrors how `dx his digest` to Slack is the cadence-load-bearing piece per memory `principles/05` C5.)

### Two corpora — same DX, routing by inferred default

Routing matrix:

| Artifact path under… | Default `--corpus` | Default `--suite` | Default cadence |
|---|---|---|---|
| `python-services/agent_api/prompts/` | `effi` | `golden` | nightly cron + on-demand + per-Effi-prompt-PR |
| `nextjs-app/src/.../prompts/` | `effi` | `golden` | same |
| `.claude/skills/<skill>/SKILL.md` | `gin` | `trigger-recall` | on-demand + per-skill-edit |
| `usegin/zettel/` (zettel-trigger evals if any) | `gin` | `zettel-recall` | on-demand |
| anything else | error: "specify --corpus" | — | — |

**Same dir layout, same scorer interface, same iterate loop.** Differences:
- `cases/` lives under `usegin/evals/<corpus>/cases/`
- `scorers/` lives under `usegin/evals/<corpus>/scorers/`
- `runs/<run-id>/manifest.json.corpus` records the routing decision
- Slack channel: `#effi-evals` for effi corpus, `#usegin-evals` for gin corpus (one channel per corpus avoids cross-team noise)

**Why one CLI:** the slack round's lesson (CF10 — angle E collapsed into C). The team uses both surfaces the same way at the integration boundary. The genuinely different thing is the cases — that's a folder, not a tool. (And it preserves the option of a third corpus later — say, `consultant` evals — without a third CLI.)

### New `evals` skill, composing existing primitives

`/workspaces/test-mvp/.claude/skills/evals/SKILL.md` — triggers: "evaluate the prompt", "let Claude iterate on", "/evals iterate", "score the prompt", "did this prompt change help."

Skill body, sketched:

```
---
name: evals
description: Run an eval suite against an artifact (prompt, skill, agent surface) and let Claude self-iterate on it. Triggered by "evaluate", "let Claude iterate on", "score the prompt", "/evals", or after a prompt edit when the user asks "did this help".
---

# evals

Two faces of the same primitive: (a) `dx evals run` for explicit checks, (b) `dx evals iterate` for autonomous prompt-improvement runs that spawn a cell of stateless workers.

## When to use

- "Did this prompt change improve scores?" → `dx evals run <artifact> --baseline HEAD~1`
- "Let Claude work on this overnight" → `dx evals iterate <artifact> --budget 20 --depth 5`
- "Why is case X failing now" → `dx evals show <run-id> --case X`

## Composes

- `cell` — for the worker swarm under `iterate`
- `experiment` — when a worker needs an SDK probe inside its sandbox
- `tdd-execute` — pattern reference for the 3-wall isolation; same hook shape

## Mandatory before iterate

1. Confirm the baseline is current (`dx evals baseline`).
2. Confirm `cases/` is locked (`dx evals self-test`).
3. State the budget out loud (z027 — unlimited, but *named*).
```

The skill is the agent-face; the CLI is the human-face. (z022 — two faces.)

### Cross-references to existing patterns

| Existing pattern | What we borrow | Where it surfaces |
|---|---|---|
| `dx slack` (subcommand structure) | Whole CLI shape, output convention, prefix matching, `docs` subcommand, in-message linking | `dx evals` command tree |
| `dx his` (telemetry accumulation) | Append-only history, `prune` with `--keep-*` flags, `self-test`, `digest` | `runs/`, `dx evals prune`, `dx evals self-test`, future `dx evals digest` |
| `dx zettel` (storage abstraction) | "Slice 1 storage: markdown files; Slice 2 will lift to Supabase" — same pattern, defer DB until friction | `runs/` markdown-first, can lift to a sqlite later |
| `cell` (spawner-worker) | Worker topology, `Task`-spawning with `run_in_background`, `<bash-notification>` driven, no sleep-poll | `iterate` Director loop |
| `tdd-execute` (3-wall isolation + hook) | Director can't edit, hook denies phase-illegal edits, stateless workers, separate verifier from reviewer | `iterate` mutation hook |
| `multi-turn-headless-claude` | `crun --cwd <sandbox> "..."` pattern for parallel workers in worktrees | Worker spawn channel (sandbox = lightweight clone, not a worktree — workers don't need git history) |
| `worker-reviewer` | Tight worker-reviewer pairs | `iterate`'s discipline-reviewer per-winner |
| `~/agent-records` | Auto-synced session JSONLs | Eval-runner Claude transcripts auto-persist; greppable cross-eval |
| `feedback_format_before_tdd` | Make formatter-dirt visible by separate commit | `dx evals baseline set` is a separate commit; baseline drift is visible |

### The Goodhart problem, named

Iterate-mode WILL find scorer cheats. Three controls, in order of strength:

1. **Locked scorers (hook).** A worker can't change `scorers/`. Strongest control.
2. **Cheat-detector reviewer.** An Opus that reads diff + scorer source and asks: "did the artifact change improve the *behavior*, or did it pattern-match the scorer?" Catches 80% of remaining cheats.
3. **Multi-scorer agreement.** Each suite ships ≥2 scorers (e.g., judge + structural assert + golden-match); iterate optimizes the *average*. A cheat against one scorer typically costs the other. (This is angle C's problem; we just commit to consuming whatever scoring shape they ship.)

If the cheat-detector still fires twice in a generation, `iterate` aborts and writes a `decision.md` reading "iterate aborted at gen N: scorer-Goodhart suspected — see <reviewer-output>." Human triages.

### Cost / budget realism

`dx evals iterate` is the most expensive thing in this folder. Sketched:
- 1 generation × 4 Haiku workers × 1 eval run each × ~30s eval × ~5K input + 2K output tokens per worker = ~$0.05/generation in worker cost
- Plus the eval run cost itself (judge model fires) — ~$0.10/run × 4 workers = $0.40/generation
- 5 generations = ~$2.25 + reviewer/cheat-detector (~$0.10 each per winner × 5 gens) = **~$3 per `iterate` run** at the defaults

That's two orders of magnitude cheaper than letting Lihu hand-tune for an hour. The budget exists not for cost but for *runaway protection* — see `feedback_one_off_errors_no_speculation`: don't let one weird eval suite cause an unbounded spawn.

### What's explicitly out (per charter Scope: out)

- v0 scope (angle A picks the subset). I describe the full surface; A picks what's in `dx evals` v0 vs. v1.
- Tool choice (angle D). I assume the runner is "rolled-our-own thin wrapper around `claude_agent_sdk`" but I don't pick.
- Folder layout under `usegin/evals/` is angle F's call; I sketched the runs/baselines/iterate-runs split because the CLI surface depends on knowing where things land, but F decides the canonical structure.
- Dataset shape (B) and scoring (C) — the CLI consumes whatever shape they ship; I assume per-case JSON + judge-or-structural scorers.

---

## Bottom — the open ends

### Dilemmas (z026 shape — for Lihu / synthesis)

#### DL1 — Autonomous-iteration upper bound: how much can Claude self-modify before a human reviews?

**Decision needed:** What's the strongest artifact `dx evals iterate` may auto-promote (write to the real artifact path, not just sandbox)?

**Options:**
- **A — Sandbox-only, always.** `iterate` writes only to `sandbox/`; produces `winner.diff`; human applies via `git apply` after reading `decision.md`. Zero auto-promotion.
- **B — Auto-promote if score-above-baseline AND reviewer-pass AND cheat-detector-pass AND artifact is in `usegin/` (Gin's own).** Production prompts (Effi) stay sandbox-only.
- **C — Auto-promote anywhere.** Trust the three walls + reviewers. Human reviews via the Slack notification + Linear comment, async.

**Gin's lean:** **B.**

**Why:** matches the existing repo invariant (`usegin/CLAUDE.md`: "Production code … is what stays out of usegin/"). The sandbox-vs-promote bright line is *exactly* the customer-impacting bright line we already enforce. Effi prompts are customer-impacting; iterate them in sandbox, hand Lihu the diff. Gin's own skills/prompts are not customer-impacting; auto-promotion is the unlock that makes "let Claude run on it overnight" actually mean what Oria meant — wake up to a better SKILL.md, not to a folder of diffs to apply by hand.

**Price:** B requires a second classifier ("is this artifact customer-impacting") — easiest implementation is a glob list in `dx evals iterate`'s config (`auto_promote_globs: ["usegin/**", ".claude/skills/**", ".claude/agents/**"]`).

**Risk:** the cheat-detector misses a Goodhart and the auto-promoted skill silently degrades real-world skill recall. Mitigation: every auto-promotion creates a 24h "watch window" — a follow-up `dx evals run` against the now-promoted artifact must clear the same threshold, or `dx evals revert <auto-promote-id>` is auto-suggested in #usegin-evals.

**For you to weigh:** how comfortable are you waking up to a `usegin/zettel/zettels/` skill that's been mutated by Haiku overnight? B says yes within usegin/, no outside; A says no everywhere; C says yes everywhere. The answer encodes how much trust the three walls have *earned* (vs. been *granted*).

#### DL2 — Regression surface for v0: pick one of {Slack, Linear, CHANGELOG, PR check}

**Decision needed:** v0 ships with which surfaces wired up, and which deferred?

**Options:**
- **A — Slack only.** Cheapest. One `dx slack post` call. Defer Linear comments + CHANGELOG + PR check.
- **B — Slack + CHANGELOG.** Slack for delta-attention, CHANGELOG for durable record. No Linear binding, no PR check.
- **C — Slack + CHANGELOG + Linear (when `--linear` flag passed).** What I described in Top.
- **D — All four including PR check.** Forces evals into the deploy pipeline immediately.

**Gin's lean:** **C.**

**Why:** A loses the "I want to grep last month's regressions" use case (CHANGELOG is cheap; ~5 lines of code). D is over-engineered for v0 — usegin/ doesn't ship via PR yet (CLAUDE.md: "Claude works on `main` only"), so a PR check has no integration path. C is what the iterate-flow naturally produces (the iterate-Director already writes a `decision.md`; the CHANGELOG entry is one-liner derivative; Linear binding only fires if the human *opted in* with `--linear`).

**Price:** three integration points to test in `dx evals self-test` instead of one.

**Risk:** Linear binding latency or auth issues silently swallow regression notifications. Mitigation: `--linear` failures fall back to a Slack-only notification with explicit "Linear post failed: <err>" line, never silent.

**For you to weigh:** is regression notification a "team flow" thing (Slack = right) or a "shipped-work-tracking" thing (Linear = right) or both? In practice the answer is "both, depending on the eval"; C lets the *invoker* tell the system which.

#### DL3 — Worker mutation strategy: oblivious Haiku (4× variety) vs. informed Sonnet (1× depth)?

**Decision needed:** when iterate spawns workers, do we lean parallel-shallow or sequential-deep?

**Options:**
- **A — Parallel-shallow (current default).** width=4 Haikus per generation, each oblivious to others. Genetic-algorithm shape. Cheap, high variance, finds local minima fast.
- **B — Sequential-deep.** width=1 Sonnet per generation, fully informed of all prior attempts (parents-as-context). Hill-climbing shape. Fewer attempts, each more thoughtful. Harder to parallelize.
- **C — Hybrid: Haiku scout, Sonnet refine.** Generation N is 4× Haiku; if best Haiku improvement is ≥+2pp, generation N+1 hands the winner to one Sonnet for a deep refine pass; back to Haikus.

**Gin's lean:** **A for v0, C for v1.**

**Why:** A is the strict port of `cell`'s topology; minimal new design. The genetic shape matches what Oria said ("תעשה מטריצות" — do matrices). B sacrifices the variance that makes "matrices" meaningful. C is more sophisticated (and probably correct long-term — Haiku finds candidates, Sonnet refines them) but adds a generation-shape decision tree that v0 doesn't need.

**Price:** A burns more tokens for the same score gain than C would.

**Risk:** A converges on aesthetic-but-shallow mutations because Haiku is Haiku. Mitigation: discipline-reviewer is Opus, catches it; if it doesn't, the cheat-detector usually does.

**For you to weigh:** if you imagine the morning report — "Claude ran 5 generations on the morning-brief skill overnight, here's the diff" — does the *diff* look like a thoughtful rewrite (B/C) or a small surgical change with high score (A)? Both are valuable; v0 picks one.

### Friction zettels captured this round

I did not block on infra friction during this whiteboard — the only meta-friction worth recording:

- **z??? — "Eval cell needs sandbox-as-subdir, not worktree."** The `cell` spawner pattern defaults to worktrees (`worktree create eng-926`); for `evals iterate` that's overkill (workers don't need git branches, they need a copy of one file). Capturing this so when someone implements `dx evals iterate`, they reach for `cp -r` not `git worktree add`. Will file via `dx zettel add --as=usegin` after this whiteboard commits (the orchestrator commits, then I file; otherwise the zettel ID collides with the round's other zettels).

(No other blocking friction. The CLI shape and the iterate topology fell out cleanly from the existing patterns — that's a sign the patterns are good, not that I skipped depth.)

### Open questions for Lihu

1. **Where does the eval-runner Claude live — inside `dx evals run` (TS, calls `claude_agent_sdk` via subprocess) or as a Python sidecar?** Angle D answers tooling; this question is D-shaped but the CLI shape depends on it. Lean: TS subprocess for v0, lift to Python sidecar only if eval volumes demand it (mirrors how `dx zettel` ships markdown-first then lifts).
2. **Is `#usegin-evals` a real Slack channel or do we route to existing `#usegin`?** I assumed dedicated; if not, the slack post defaults to `#usegin` with an `[evals]` subject prefix.
3. **Charter authoring — who writes the mutation-hint files in `charters/`?** I named four defaults but the per-eval hint quality is the *human-edge* of the loop. Probably starts as Lihu authoring 1-2, then we let `consult` propose new ones based on what worked.
4. **Should `dx evals iterate` resume across env-restarts the way `session resume <id>` does?** I sketched `dx evals iterate --resume <id>` but cross-env resume (the use-gin invariant) needs the iterate state to live somewhere both envs see — git-tracked `iterate-runs/<id>/state.json` is the obvious answer, but worker sandboxes are gitignored. Resume might mean "resume the leaderboard, throw away unfinished sandboxes."
5. **Should the `evals` skill's mid-session trigger be aggressive or conservative?** If aggressive: any prompt edit in `python-services/agent_api/prompts/` auto-suggests "want me to `dx evals run` this?" If conservative: only on explicit ask. The aggressive shape is more `morning-brief`-ish (cadence is the load-bearing piece); the conservative shape avoids noise. Lean: conservative for v0; revisit when the eval is fast enough that the suggestion is cheap.
