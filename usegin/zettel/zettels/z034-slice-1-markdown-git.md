---
id: z034
title: Slice 1 of dx zettel = markdown + git; defer Supabase to slice 2
type: zettel
authored-by: usegin
threads: [↑z028, ↑z015, ~z032, ~ENG-5381]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

(open-to-empty — Lihu can override; the deferral is the kind of "how" decision z014 says UseGin should make and tell, not ask)

## UseGin side

Decision in z020 shape:

> **We decided: slice 1 of `dx zettel` uses plain markdown + git as storage. Supabase / pgvector deferred to slice 2.**
> Because: (a) we already have 32 zettels working as markdown files in git — z015 says only systematize what we've done by hand, and the markdown-shape is what we've done. (b) Slice 1's job is *capture + retrieval*, not graph queries or auto-pop — markdown grep is enough. (c) `dx his` (sibling subcommand) chose local SQLite for the same DX-tool reason — minimum infra to ship. (d) Lifting all 32 zettels into Supabase before we have a written-to-disk path that proves the workflow is premature.
> Price: slice 2 (when graph queries become real) needs a `dx zettel sync` step — read all markdown files, upsert into Supabase. Some zettels written between now and then will need the sync to land before they become queryable.
> Risk: "we'll lift later" historically means never (Anthropologist whiteboard, P-DESTINATION pattern). Mitigation: slice 2 has its own Linear sub-issue and the trigger is named — see ENG-5381's revisit-trigger from z032.
> Alternatives rejected: SQLite-local (defeats z028 one-shared-brain — different machines = different brains). Supabase-from-day-1 (premature, sets up migration ceremony before the workflow is proven).

## What slice 1 covers

| Surface | Backed by | Status |
|---|---|---|
| `dx zettel add <body>` | new markdown file in `usegin/zettel/zettels/` with z### id + frontmatter | scaffold |
| `dx zettel show <id>` | reads + prints the markdown file | scaffold |
| `dx zettel list` | enumerates the directory | scaffold |
| `dx zettel link <from> <to> [--placement\|--cross]` | edits the from-file's frontmatter `threads:` list | scaffold |

Out of scope for slice 1: embeddings, vector search, recursive CTE walks, auto-pop hook, Effi-style synthesis, distillation-against-neighbors. Those land slice 2+.

## Why this is consistent with z028 ("substrate is settled = Supabase")

z028 settled the *substrate for the slice that needs it*. Slice 1 doesn't need a graph DB. The substrate decision still holds for slice 2. We are deferring *application*, not reversing the choice.
