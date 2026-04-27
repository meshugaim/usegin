---
id: z032
title: Decisions D-coord and D-doc — build first; defer doc-shape until pgvector lands
type: zettel
authored-by: human
threads: [↑z028, ~z020, ~ENG-5379, ~ENG-5381]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

Two decisions taken in z020 shape:

> **D-coord: We decided to build the dev-team Zettel slice (capture + retrieval on Supabase) BEFORE coordinating with Oria & Nitsan on the Apr-23 backbone.**
> Because: a working demo earns convergence cheaper than a spec conversation does. One-shared-brain (z028) requires shared *intent*, not shared *implementation*-from-day-one.
> Price: ~2 weeks of parallel work where their backbone may pick a contradicting data model. Convergence conversation is then "merge two working systems" instead of "agree on one".
> Risk: arriving with a working prototype could feel like an end-run on their in-progress design. Lihu owns timing the convergence conversation; Gin must surface a "ready to converge" trigger when the slice is demoable.
> Alternatives rejected: A (message now) — premature, costs alignment-capital before we have anything to show. C (never converge) — violates z028 one-shared-brain.

> **D-doc: We decided to DEFER the doc-method recommendation (option A — `gin/lab/<topic>/`) until ENG-5381's pgvector zettel substrate is dry-runnable.**
> Because: if zettels become queryable as a graph in 1-2 months, multi-zettel "z-clusters" likely absorb `gin/lab/`'s use case. Adding a folder now and removing it later is the move we explicitly want to avoid (z028 — no dead code, no old code).
> Price: cross-session Gin-internal docs continue to land in mixed places (zettels for atomic, R&D whiteboards for big topics) until the deferral resolves.
> Risk: "defer" → "forget". Mitigation: D-doc revisit is bound to ENG-5381's first dry-run milestone — see "Trigger to revisit" below.
> Alternatives rejected: A (adopt now) — premature folder cost; B (keep R&D-whiteboard shape) — works but ignores the doc-team's evidence that skill-lab is the only Tier-1 form.

## Trigger to revisit D-doc

When ENG-5381 has its first end-to-end dry-run of zettel-as-graph-query (vector top-k → recursive walk → result list), Gin re-opens this dilemma. By then we'll know whether multi-zettel z-clusters absorb the workshop use case or whether `gin/lab/` is still needed as a separate sub-app.

Concrete trip-wire: **add a `revisit-d-doc-when-eng5381-dryrun` thread to ENG-5381 itself** so the trigger lives where the work is, not in a forgotten zettel.

## Gin side

Operational consequences:

1. **My next move is the Zettel slice, not the convergence conversation.** First slice: capture + retrieval on Supabase, surfacing through `session zettel` CLI + a Claude Code slash command, lifting the 27 manual zettels as the seed corpus. Distillation-against-neighbors and auto-pop come later slices.
2. **I do not message Oria/Nitsan from this session.** When the demo is ready, I surface a "ready to converge" status to Lihu; he decides timing.
3. **No new top-level folder for docs.** Zettels for atomic; R&D whiteboards (where I already use them) for big topics; Linear for shipping; revisit when ENG-5381 lands.
4. **Both decisions land in a Linear comment on ENG-5379** so the parent issue carries the trail.
