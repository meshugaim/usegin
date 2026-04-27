# Charter — angle E: dx-let-claude-run

You are a professor of **the DX shape — Oria's framing: "what evals give you is letting Claude run on it."** Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- The exact Oria moment: `/tmp/transcript.txt` lines 170-184 (we extracted today's meeting transcript) — Oria's "let Claude run on it, go iterate, do matrices." Read it in Hebrew if you can; the spirit is: an eval is the *substrate* on which Claude self-iterates prompts overnight.
- `/workspaces/test-mvp/CLAUDE.md` + `/workspaces/test-mvp/usegin/CLAUDE.md` (the cell/ralph/tdd-execute mindset — Gin orchestrates many sub-Gins; the DX should match)
- Existing patterns to cross-cut:
  - `.claude/skills/cell/SKILL.md` (autonomous spawner-worker)
  - `.claude/skills/ralph-loop/SKILL.md` and `.claude/skills/loop/SKILL.md` (autonomous iteration)
  - `.claude/skills/tdd-execute/SKILL.md` (cycle-by-cycle director loop)
  - `.claude/skills/multi-turn-headless-claude/SKILL.md` (running Claude non-interactively)
  - `tools/dx/` — what's the existing dx CLI shape (subcommands, output convention, `--json` flag)
  - `tools/dx/src/slack/` — how slack subcommand is structured (we just shipped it; mimicry is fine)
- Memory: `reference_sdk_stop_hook_veto.md` (we know how to wrap headless Claudes), `reference_agent_records.md` (results location).

## Mandate

Design the runtime DX of the evals sub-app — both the **explicit-run shape** (Lihu types `dx evals run …`) and the **autonomous-iteration shape** (the night-mode Oria evoked: Claude reads the eval, mutates a prompt, re-runs, picks the winner, surfaces the diff). Connect to existing usegin orchestration patterns instead of inventing.

## Scope

**In:**
- CLI surface for `dx evals` (subcommands: `run`, `list`, `show`, `compare`, `judge`, `iterate`?). Match the dx convention (`tools/dx/CLAUDE.md` if exists; cross-cut with `dx slack`).
- Result format on disk: where does a run land (`usegin/evals/runs/<timestamp>-<sha>/`?), what files (per-case scores JSON, run summary, judge transcripts, diffs vs. baseline), how it's git-friendly (commit-the-result vs. gitignore-and-publish-elsewhere).
- The autonomous iteration loop ("let Claude run on it"): what does it mean for Claude to *iterate* on a prompt against an eval? Spawn a cell-shape worker with charter "improve case-pass-rate from N to N+1, you may edit the prompt, you may not edit the cases or the scorer"? What stops it (budget, score plateau, oversight)?
- Where regressions surface: Linear comment on the parent issue? Slack post via `dx slack post`? PR check? `usegin/evals/CHANGELOG.md`? Pick — don't punt.
- Connection to existing skills: should we ship a new `evals` skill that triggers this, or does it live under `experiment` / `cell` with conventions?
- The two-corpora reality (Effi product evals vs. Gin dev-loop evals) — same DX, different routing, or two CLIs?

**Out:**
- The v0 minimum (angle A — you say "the DX should look like X by v1"; A picks what subset is in v0).
- Tooling choice (angle D — you describe the runner shape; D says "implemented via promptfoo or rolled-our-own").
- Folder structure of `usegin/evals/` (angle F).
- Dataset and scoring details (B, C).

## Working rules

- Mimic existing dx subcommands (`dx slack`, `dx his`, `dx zettel`) for consistency — read their structure, don't reinvent the output convention.
- The "let Claude run on it" autonomous-iteration design is the load-bearing piece — spend the most depth there. It's the differentiator vs. "just another eval framework."
- Ground every CLI proposal with a concrete invocation example.
- Capture friction as zettels.
- Do NOT commit. Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/dx-let-claude-run/`.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/dx-let-claude-run/whiteboard.md`:

```
## Top — the click
<The DX shape recommendation. Concrete CLI sketch + the autonomous-iteration
loop design + the regression-surfacing decision. E.g.: "`dx evals run [--case
<id>]` for explicit; `dx evals iterate <prompt-path> --budget 10` spawns a
cell of N workers each mutating the prompt, scoring against the same eval,
returning the best diff. Results land under usegin/evals/runs/, regressions
post to #usegin-evals via dx slack.">

## Middle — the body
<Full CLI subcommand list with example invocations. Result-on-disk layout.
Autonomous-iteration loop in pseudocode (what worker charter looks like,
what the budget is, what stops it). Regression-surface choice with rationale.
Two-corpora routing (Effi vs Gin).>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2 — at minimum: "autonomous-iteration upper bound:
how much can Claude self-modify before a human reviews" and "regression
surface: Slack vs Linear vs PR comment — pick one for v0"). Friction zettels.
Open questions for Lihu.>
```

Return a ≤10-line summary in chat.
