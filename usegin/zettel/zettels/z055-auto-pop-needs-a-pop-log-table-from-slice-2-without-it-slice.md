---
id: z055
title: Auto-pop needs a pop_log table from slice 2 — without it slice 3 is blind
type: zettel
authored-by: usegin
threads: []
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
Friction noticed while designing slice-3 auto-pop (AUTO-POP-DESIGN.md): three of the design's load-bearing pieces — per-turn dedup (§1), threshold tuning (§4), and the human-side searchable history (§5) — all require a pop_log of {what was popped, when, to whom, at what activation, with what seed}. If slice 2 ships retrieval without this log, slice 3 either ships blind (can't tune θ/k from data) or has to retrofit logging across every caller. Cheap to add at slice 2's RPC boundary; expensive to retrofit. Flagging now so slice 2's API design includes it as a sibling of zettel_recall, not as an afterthought.
