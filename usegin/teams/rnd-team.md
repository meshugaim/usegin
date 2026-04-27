---
name: rnd-team
purpose: Study a multi-angle question via N parallel professors + cross-cutting synthesis.
size: dynamic (3–10 + 1 synthesizer)
mode: parallel-independent + cross-cut synthesis
created: 2026-04-27
---

## Members

- **Poll × N** — one professor per pre-decomposed angle. Each gets a
  unique angle charter; angles must be genuinely independent (each
  professor must produce a useful whiteboard *without reading the
  others*).
- **Sam** — cross-cutter; runs after the N Polls return.

## Operating mode

- Pre-decompose into 3–10 angles **at the orchestrator (Mark)**, not
  inside a single professor charter. Sub-Gins via Agent tool can't
  fan out further (z029).
- Spawn all Polls in one batched response.
- Commit each whiteboard *as it lands*, not at the end. Autosync
  collision risk if batched.
- After all Polls return, spawn Sam (or main-thread synthesize) for
  cross-cutting findings + dilemmas in z026 shape.

## Charter shape (per Poll)

```
You are Poll, professor of <angle>.

## Read first
<3–8 anchored paths/zettels/Linear issues>

## Mandate
<one sentence: produce one whiteboard on this angle>

## Scope
<in / out — explicit>

## Working rules
- Spawn freely (Read, Grep, sub-Explore agents) within charter.
- Capture friction as zettels (zettel-capture skill).
- Do NOT commit. Orchestrator commits.
- Top → middle → bottom shape (load-bearing).

## Deliverable
<exact path>/whiteboard.md with:
  ## Top — the click
  ## Middle — the body
  ## Bottom — the open ends

Return ≤10-line summary.
```

## Output artifact

`<root>/RD/<angle>/whiteboard.md` (one per Poll) +
`<root>/SYNTHESIS.md` (Sam's cross-cut) +
dilemmas in z026 shape (chat or `recommendation.md`).

## When to use this team

- Driven by the `rnd` skill.
- Direct trigger: "let's R&D X" / "send a team to study X" / "spawn N
  professors for X".
- Topic with ≥3 genuinely-independent angles.
- Output should be a synthesis ranking patterns, not a single answer.

## Common failure modes

- **Batching commits at the end.** Autosync collision risk.
- **Vague angle charters.** Vague charter → vague whiteboard.
- **One-manager-charter-that-fans-out.** z029 — sub-Gins can't fan
  out. Decompose at the orchestrator.
- **Synthesizing before all inputs land.** Biases toward early
  returners.
- **Skipping the friction-capture pointer.** Half the value of R&D
  comes from friction zettels.
