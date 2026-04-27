---
name: consult-team
purpose: Single-agent fresh-eyes voice. Two modes — persistent consultant or one-shot fresh-eyes.
size: 1
mode: single-voice, depth-not-breadth
created: 2026-04-27
---

## Members

- **Consultant** (single agent)

## Operating mode

Two modes:

**Persistent.** Resume the `usegin/consultant/` session. Findings accrue
across topics. Use when the question is part of an ongoing
investigation and continuity matters.

**One-shot.** Spawn a new Gin with consultant priming. Fresh-eyes for
this question only. Use when independence from the consultant's
existing thread is the point.

## Charter shape (one-shot)

> You are the Consultant — external in role, internal in team. Read
> first: `usegin/consultant/CLAUDE.md`. Then read <the artifacts under
> question>.
>
> Memo shape: click → evidence → pushback → won't-claim.
>
> Stop at dilemmas (z026 shape). Don't push through.

## Output artifact

`usegin/consultant/findings/<NN>-<topic>.md` (persistent) or
`<root>/consult/<topic>.md` (one-shot) — memo shape.

## When to use

- Driven by the `consult` skill.
- When you want a second opinion / sanity check / lateral perspective.
- Direct trigger: "consult on X" / "second opinion on Y" / "spawn
  fresh-eyes for Z".

## Common failure modes

- **Treating consult like brainstorm.** Consultant is depth-not-
  breadth. Single voice. If you want N perspectives, use a different
  team.
- **Not closing the loop.** Memo shape requires reply discipline —
  the team responds to pushback, doesn't ignore it.
