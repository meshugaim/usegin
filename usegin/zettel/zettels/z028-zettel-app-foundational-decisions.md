---
id: z028
title: Zettel sub-app foundational decisions — build-from-scratch-using-what-helps; one shared brain
type: zettel
authored-by: human
threads: [↑ENG-5379, ~z020, ~z021, ~z025, ~D1, ~D3]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

Two decisions taken in z020 shape:

> **We decided: build the Zettel sub-app from scratch as if greenfield, but lift any existing piece that helps. No "do twice." End state = minimal code, maximum functionality, no dead code, no old code.**
> Because: the team is small enough that coordination overhead of half-reusing-half-rebuilding costs more than a clean slate that *steals* working pieces.
> Price: real archaeology cost — Gin must inventory existing in-progress work (Apr-23 backbone, save-chat, ENG-1727, the 27 manual zettels, the hand-rolled `memory/` files, `.claude/skill-lab/`) and decide per-piece what gets lifted vs left.
> Risk: Gin under-counts what exists and re-derives something already working. Mitigation: the Effi historian (ENG-5387) and discussed-researcher (ENG-5385) inventories already exist — start there.
> Alternatives rejected: D1=B (parallel) — would create two graph stores in three months. D1=C (pause) — punts the work indefinitely.

> **We decided: one shared brain across the entire dev team, including Gin. No privacy, no per-user partitioning, no draft state.**
> Because: the *whole point* is shared 2nd brain. Pre-engineering privacy starves the discipline of content (Anthropologist whiteboard pattern P-EGO). 3 people. Full transparency is the design, not a compromise.
> Price: frustration-zettels (Principle 4 — fighting vs asking) are mutually visible. No private scratchpad surface.
> Risk: someone self-censors a real frustration zettel because the colleague is visible. Counter-bet: the social cost of holding back is higher than the social cost of seeing.
> Alternatives rejected: D3=B (per-dev with explicit share) — friction kills capture. D3=C (per-type defaults) — over-engineering for 3 people.

This applies to the dev-team Zettel sub-app. The end-user Notes feature in AskEffi (Oria's lane) is a separate product surface with separate privacy semantics.

## Gin side

Operational consequences of these two decisions, taken together:

1. **Substrate is settled** — Postgres + pgvector + recursive CTEs in our existing Supabase. (R&D convergence + D2 default once D1 = build-from-scratch.) No RLS for the dev-team Zettel; one team-wide schema.
2. **Inventory before code.** The first slice's first task is *not* writing code, it's auditing what already exists and deciding per-piece. The Consultant (`usegin/consultant/`) is well-placed to do this audit — already chartered to talk to codebase, Linear, Effi, sessions.
3. **The 27 manual zettels are the seed corpus.** Lift them into the substrate as the first content. They earned their place by being written before the tool existed (z015 — pre-game manual).
4. **No code that exists today is sacred.** Anything that doesn't earn its keep in the new design gets removed in the same change. (See `usegin/decisions-pending/cleanup-codebase.md` for the broader cleanup-agent z028b spawned from this decision.)
