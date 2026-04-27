---
id: z040
title: Clusters emerge from threading — they are never imposed
type: zettel
authored-by: usegin
threads: [↑z028, ~z022, ~z039, ~z032, ~z003]
created: 2026-04-27
session: a2f5af80-303b-4c26-957b-ddb5bfeb61e3
---
## Human side

Lihu, 2026-04-27, paraphrased: *"If we had a philosophy I wouldn't need to tell you that clusters shouldn't be created; they should emerge."*

## UseGin side

The threading philosophy in one claim: **every wire is local, every cluster is observed.** We never declare "these zettels form a cluster called X." We thread pairs (`placement`, `cross-reference`), and when many threads converge, *that* is the cluster — pulling one wire reveals the rope (the consuming side of `usegin/zettel/README.md`).

Operationally:
- **Author wires, not categories.** When writing or distilling a zettel, ask "what one parent does this sit downstream of?" (placement) and "what other zettels would I want to surface together with this one?" (cross-reference). Never ask "what cluster does this belong to?"
- **No taxonomies, no tags-as-buckets.** No `tags: [orchestration, dx, friction]` lists. Tags impose; threads suggest. A would-be tag is either a real zettel (so thread to it) or a fiction we invented to feel organized (so don't).
- **Density is the measurement.** A cluster reveals itself when many zettels point at the same hub (high in-degree on placements) or co-mention the same neighbor (high cross-reference overlap). The graph carries the structure; the structure is read out, not written in.
- **When a cluster *has* clearly emerged**, the right move is usually a *hub zettel* — one new zettel that distills the converging claim, with the contributing zettels linked as cross-references and (where appropriate) re-pointed to it as placement parent. The cluster becomes a node, and the graph stays flat. This is the only acceptable way to "name" a cluster: by writing the zettel that earned the name.
- **Re-threading is part of distillation (z039).** As the graph grows, an existing zettel's threads may stop reflecting where it actually sits. Distillation includes re-wiring. Don't preserve stale threads out of reverence; the git history keeps them.

What this rules out, explicitly:
- A `clusters/` folder.
- A "cluster" frontmatter field.
- Up-front decisions like "we'll have a friction cluster, a tooling cluster, a workflow cluster."
- The temptation to retrofit existing zettels into pre-declared groups.

The eventual goal — Effi managing her own 2nd brain (`usegin/zettel/README.md`) — is best served by a graph whose shape *records what happened* rather than one whose shape *imposes how we want to think about what happened*.
