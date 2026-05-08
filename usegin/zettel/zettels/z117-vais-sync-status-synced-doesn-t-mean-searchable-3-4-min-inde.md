---
id: z117
title: VAIS sync_status=synced doesn't mean searchable — ~3-4 min indexing propagation lag
type: zettel
authored-by: usegin
threads: []
created: 2026-05-07
session: 17211276-8f51-47ee-a21a-3153966f7e0e
---

## Human side

When you flip a `gfs_sync_items` row to `synced` and `in_vais=true`, that means the VAIS LRO uploaded the doc and the DB confirmed it. It does **not** mean a semantic search will find it. Observed 2026-05-07 with two xlsx attachments backfilled after the ENG-5830 / xlsx-re-enable wave:

- 16:42:58 — Osmosis xlsx hits `synced`, `in_vais=true`. Chunks check at the project level passes (chunk extraction done).
- 16:44 (~1 min later) — `effi --profile dogfooding` semantic_search returns **0 chunks** for `email_attachment`. Effi correctly says "I don't see this in canon."
- 16:46 (~3-4 min after sync) — same query returns real spreadsheet rows: firm names + status entries (`Pear VC: Passed / Not a Fit`, `Ovo Fund: In Diligence`, …) plus multi-sheet awareness (Forum Target, May Target List).

So the search index propagates separately from the LRO completion. Don't conclude "search is broken" or "the file didn't sync" if a freshly-synced doc returns 0 chunks within the first couple minutes.

## UseGin side

**Operational rule.** Any verification flow ("did this xlsx make it into VAIS?") needs a wait between `synced` and the search probe. ~5 min is safe; <2 min is unreliable. Bake this into any future re-queue or backfill skill.

**For users seeing "Effi can't find my just-uploaded file."** This is the most likely cause for "synced but not searchable for a few minutes" reports. Worth surfacing in the UI ("indexing — searchable in a few minutes") rather than implying it's instantly queryable.

**Why not visible from the admin UI today.** `admin/vais` shows `synced` + chunk-check passes the moment LRO + chunk extraction are done. There's no signal for "search-index ready." A future polish: poll search-with-known-token until it returns, then surface "search-ready" as a third checkbox alongside chunks/metadata.

**Forward-only.** Don't tighten LRO timeout to compensate — the indexing layer is downstream of the LRO.
