---
id: z056
title: Auto-pop reason-chain is the difference between magic and noise
type: zettel
authored-by: usegin
threads: []
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
Friction noticed while designing slice-3 auto-pop (AUTO-POP-DESIGN.md §3): a popped zettel without provenance ('z038, z034, z028 — here you go') feels like noise even when the matches are good. The same pop with reason chain ('z038 cued by similar_to to your prompt; z034 reached by thread from z038') reads as legible inference. The reason chain is what lets the consumer (Claude or human) decide whether to trust each card and whether to re-thread it (z040 cluster emergence). Implication for slice 2: the recall RPC must return the path that produced each result, not just the result. This is non-obvious — the graph walk knows the path internally but most ranked-result APIs throw it away. Don't throw it away.
