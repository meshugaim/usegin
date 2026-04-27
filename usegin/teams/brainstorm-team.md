---
name: brainstorm-team
purpose: Generate a flat pool of ideas via parallel-independent ideators with stable persona variants.
size: 5
mode: parallel-independent
created: 2026-04-27
---

## Members

- **Poll** (creative priming: "what if the corpus were 10x bigger / users typed 100x slower / the constraint were inverted")
- **Din** (subtraction priming: "solve it with zero new tools" / "solve it by removing something")
- **Johan** (provocation priming: "biggest possible move" / "the version that obsoletes the question")
- **John** (failure-imagination priming: "smallest possible move" / "what fails partway through")
- **Cal** (direction priming: "what's the cheaper way" / "why does this beat doing nothing")

## Operating mode

- All five spawn in **one batched response** — multiple Agent calls in
  one message.
- **No sync.** Ideators do **not** read each other's files. Independence
  is what makes overlap meaningful (signal-via-convergence).
- Each writes to `<root>/brainstorm/ideators/<NN>-<name>.md`.
- Orchestrator (Mark) merges to `<root>/brainstorm/ideas.md`. Mechanical
  merge, no editorializing — overlap is preserved as `From:` lines.

## Charter shape (per ideator)

The skill's charter template carries:
- read-first list (topic.md + ≤3 anchoring zettels)
- the persona priming (one of the five above)
- working rules (10–30 ideas, each ≤2 lines, no filtering, no ranking,
  no reading peers, no commits, friction-capture pointer)
- deliverable shape (per-bullet: title, one-line, why)
- ≤5-line return summary

## Output artifact

`<root>/brainstorm/ideas.md` — flat pool, forward-versionable.
Refine + prioritize edit this file in place downstream.

## When to use this team

- Driven by the `brainstorm` skill.
- Direct trigger: "brainstorm X" / "spawn ideators for Y" / "let's get
  ideas for Z".
- Convergence too early (catching yourself picking *the* approach
  before enumerating).
- Pool is empty and the question is "what could we try" not "what
  should we do".

## Common failure modes

- **Filtering during brainstorm.** Bad ideas serve as calibration.
- **Reading peer files mid-run.** Independence broken; convergence
  signal lost.
- **Committing per ideator.** Autosync collision risk; commit in
  two stages (per-ideator-batch + merged-pool).
- **Mono-priming the team.** All five same → identical pool. Vary.
