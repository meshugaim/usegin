---
id: z111
title: Measure Claude's effort, energy, temperature, vibe — and compare to the task
type: zettel
authored-by: zisser
threads: [~his-self-rating, ~dx-his, ~glasses-framework, ~telemetry, ~open-question]
created: 2026-04-28
session: zisser-2026-04-28
status: open-to-empty
---

## The click

> "We need to measure Claude's effort, energy, temperature, vibe — and
> compare them to the task. I still don't know how." — Lihu, 2026-04-28

The signal is: a session's *vibe-relative-to-task* tells more than either
alone. A high-effort, low-energy turn on a small task → over-spent. A
low-effort, high-energy turn on a hard task → likely undercooked. A
high-temperature read on a task that didn't warrant it → the agent was
guessing.

We have part of this already:

- `dx his` records human + Gin vibe ratings on multiple aspects (focus,
  thoroughness, friction, gap) — but it's not currently *paired with task
  shape*. A reading sits on a session, not on a *task within a session*.
- `agent records` capture transcripts — raw substrate for inferring effort
  (token count, tool-call count, time on turn) but not currently surfaced.
- The glasses framework names *qualitative* readings but doesn't quantify.

## Open angles

- What is "effort"? Wall-clock? Tool calls? Tokens? Self-reported strain?
- What is "energy"? Velocity per unit time? Self-reported engagement?
- What is "temperature"? Confidence vs hedging? Variance in approach?
- What is "vibe"? Already covered by `dx his` — but per-task, not per-session.
- What is "task shape"? Difficulty proxy: novelty, surface area, blast
  radius, time-budget, reversibility?
- How to *compare*: ratio? gap? a chart? a single derived score?

## What this might map to

- A new `dx` subcommand (`dx effort` or `dx temperature`) — open-to-empty.
- A new glass: **Thermometer** — wearing it, you describe the codebase or
  the agent's run in terms of *temperature* (cold = boring, mature, dead;
  warm = active, healthy; hot = on fire, volatile; feverish = burning effort
  with low yield). Open-to-empty.
- An extension of `dx his` aspect set with task-coupled fields.

## Status: open-to-empty

This is a research question. Don't decide yet. Capture the question;
investigate when the right next step opens. Possible first move: spend a
week noting *effort/energy/temperature/vibe* readings ad-hoc against
specific tasks, see what shape the data wants to take before designing
the schema (per z015 — pre-game manual).
