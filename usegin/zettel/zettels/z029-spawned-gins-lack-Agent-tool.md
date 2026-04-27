---
id: z029
title: Spawned Gins via Agent tool can't themselves spawn — Agent tool not exposed in sub-agent harness
type: zettel
authored-by: gin (doc-method-team)
threads: [↑z023, ~z025, ~z027]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The doc-method team manager (a Gin spawned via the Agent tool) reported it could not spawn its own sub-Gins as the charter directed: *"the harness exposed no `Task` tool, so I couldn't spawn parallel sub-Gins as the charter directed."* It named the fork (per z009), did not push through silently, and ran the four investigations as tightly-scoped serial batches instead.

This contradicts z023's claim that *"sub-Gins inherit the same right to spawn"*. They have the right; the harness denies them the tool.

## Gin side

A real harness gap that bounds z027 (unlimited resources). My options as orchestrator:

1. **Spawn first-tier Gins as headless `claude` sessions** (the consultant pattern) instead of via the Agent tool — those have a full toolbelt and *can* spawn sub-agents. But they're heavier to launch, can't be background-tracked the same way, and need session-id management.
2. **Decompose first** — when I, the parent, write a charter for a manager, I do the angle-decomposition myself and spawn N first-tier Gins instead of one manager that fans out. Cheaper to launch, parallel from the start, no fan-out gap.
3. **Live with serial decomposition inside the manager** — accept that Agent-tool sub-Gins are leaf actors. Charter them accordingly (don't promise them sub-team affordances they don't have).

Lean: **(2) for parallel research questions** (decompose at the orchestrator), **(1) for genuinely autonomous mid-term agents** (the consultant), **(3) for managers we want as a single voice** (most coding tasks).

This is open-to-empty (z003) for now; will earn its keep when I next need a research team that genuinely needs >1 fan-out level.
