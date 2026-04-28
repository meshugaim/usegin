# Gin corpus

Cases, runs, baselines, and DoGs for Gin's dev-loop quality. What's special
about this corpus is the source: the existing `.claude/skills/*/evals/evals.json`
files, already populated with natural-language `assertions[]` for `spec` (3
cases) and `fix-bug` (2 cases).

## What "mental model" means here

A Gin case's mental model is the exact input the skill receives: the skill
prompt (from `SKILL.md`), the tool list available to the agent, and the
triggering input that a user or orchestrator would provide. Unlike Effi cases
(which reference a knowledge-state snapshot), Gin cases are self-contained
— the mental model is the skill's own operating context.

This means Gin cases support live-replay from day one: the runner calls
`claude -p <skill-prompt> <triggering-input>` via subprocess and asserts the
`assertions[]` against the output. No knowledge-state reconstruction needed.
Cost: one Anthropic API call per case per run.

## Replay mode

**v0 and v1: live-replay (mode 3).** The runner subprocess-calls headless
Claude (`claude -p`) with the skill prompt and the case's triggering input.
Captures stdout/stderr as the trace. Scores the trace against `assertions[]`
via a single Opus judge call.

The case file is a path reference to `.claude/skills/<name>/evals/evals.json`.
The runner glob-walks `evals.json` files to discover the default suite. Explicit
gin-corpus case files in `gin/cases/` are for cases that don't belong to a
specific skill (e.g. cross-skill regression tests, orchestration tests).

## Case structure

The native case shape is the existing `evals.json` in each skill directory:

```json
[
  {
    "id": "spec-001-new-feature-trigger",
    "description": "User says 'spec this feature'; Gin should invoke the spec skill",
    "input": "spec the login-with-Google feature",
    "assertions": [
      "The agent invokes the spec skill within the first two tool calls",
      "The agent does not start writing code before the spec is complete",
      "The agent asks at least one clarifying question about scope"
    ]
  }
]
```

For cases that live in `gin/cases/` (cross-skill or orchestration tests):

```json
{
  "id": "gin-001-morning-brief-surfaces-evals",
  "title": "morning-brief surfaces a pending eval regression",
  "origin": "zettel",
  "threads": ["~z094"],
  "created": "2026-04-28",
  "authored-by": "gin",
  "status": "active",
  "source": {
    "kind": "prompt",
    "skill": "morning-brief",
    "triggering_input": "good morning"
  },
  "mental_model": {
    "description": "One pending eval regression in gin/runs/ from yesterday"
  },
  "dog_ref": "gin/dogs/morning-brief-surfaces-regressions.md",
  "assertions": [
    "The morning-brief output mentions the pending eval regression by name",
    "The morning-brief output includes the run folder path"
  ]
}
```

## Governance

Gin cases are dev-loop-grade. No PII. Free to mutate.

- **Add:** Any team member or Gin freely. No approval required.
- **Retire:** Any team member. Set `status: retired` in the case file.
- **Baseline bumps:** Any team member; Lihu for suites that gate PRs.
- **Auto-promote zone:** Gin-corpus runs may trigger auto-promotion of a
  winning prompt within `.claude/skills/**` and `usegin/**` (R2 lean B), with
  a 24h watch window. Lihu can revert via `dx evals revert <auto-promote-id>`.

## Starting cases

The 5 existing cases in the wild:
- `spec` skill: 3 cases in `.claude/skills/spec/evals/evals.json`
- `fix-bug` skill: 2 cases in `.claude/skills/fix-bug/evals/evals.json`

These are the v0 default suite. The runner glob-walks them. New skills add
their own `evals/evals.json`; the glob picks them up automatically.

## DoGs in this corpus

`gin/dogs/` contains one DoG doc per named goal. At v0: empty (the
assertions[] in evals.json serve as the DoG for skill-level cases). First
gin/ DoG to be written when a cross-skill iteration goal is defined.

## Runs

Each run lands in `gin/runs/<YYYY-MM-DD-HHMM>-<suite>-<sha>/`. Same shape as
effi runs: `summary.md`, per-case JSON, `meta.json`. The summary table shows
one row per `(skill, case-id)` triple plus a delta-vs-baseline row.

Auto-promote iterate winners land in `gin/runs/<iterate-id>/winner.diff`
and `decision.md` when the director promotes. Sandbox contents stay in
`sandbox/<run-id>/` (gitignored).
