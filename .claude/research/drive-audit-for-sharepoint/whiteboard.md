# Drive Audit for SharePoint — Research Whiteboard

## Current State
Phase: 2 synthesis | Status: in-progress
Last checkpoint: All 3 tracks complete. Distilling into Linear sub-issues.
Next: Spawn synthesis agent to create Linear sub-issues under ENG-3730

## Auto-Inject (automatically re-injected after every agent/team return)
Process: Read whiteboard → write note-to-self → spawn phase manager → read summary only → distill → update whiteboard
Role: I am the director. I NEVER do research myself — not reading sources, not analyzing findings, not verifying claims, not reading phase files. Every action = a subagent. If I'm about to do it myself, I stop and delegate.
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source.
Convergence: After each phase, ask: do findings answer the thesis? Are new phases producing novel insights? If not, trigger judgment.

## Thesis
By deeply auditing the Google Drive integration — how it was built, what went wrong, what was fixed — we can build the SharePoint integration correctly the first time. The audit is >50% focused on failures/fixes/pivots and <50% on architecture/reuse.

## Phase Plan
- **Phase 1**: [DONE] Three-track parallel investigation
  - Track A: Architecture — 15 migrations, 4 core tables, ~70% reusable, ~30% Google-specific
  - Track B: Failures — soft-delete broke upserts, 14 migration sets in 5 weeks, 5 launch-day bugs, 6+ still-open issues
  - Track C: Sentry — ~75 issues, ~11K events, sync_worker is single point of fragility, network errors dominate
- **Phase 2**: [IN PROGRESS] Synthesis into Linear sub-issues
- **Phase 3**: Judgment (skip — findings are concrete and actionable, no ambiguity)

## Key Findings

### Architecture & Reuse (Track A)
- Two-stage sync (download → Supabase Storage → GFS/VAIS) through Unified.to
- Chose Unified.to to avoid OAuth verification + CASA ($4-15K for Google)
- 15 migrations, 4 core tables + gfs_sync_items partition
- ~70% reusable: gfs_sync_items, SyncWorker dispatch, two-stage pipeline, content hash dedup, retry/cooldown RPCs, soft-delete, text extraction, Unified.to client
- ~30% Google-specific: WORKSPACE_MIME_MAP, folder MIME detection, Drive URL parsing, OAuth callback
- drive.file scope spike was NO-GO (user-added files invisible)
- Key risk for SharePoint: deeper hierarchy (site/library/folder) vs Drive's flat folder model

### Failures & Pivots (Track B)
- **Soft-delete migration** broke upserts + leaked deleted records across 13+ queries
- **Schema churn**: 14 migration sets in 5 weeks, many fixing earlier omissions
- **State machine gaps**: missing transitions left files permanently stuck
- **5 bugs at launch**: wrong column names, missing columns, wrong FKs
- **Biggest pivots**: drive.file scope → NO-GO; single-folder → multi-folder 8 days post-launch; 3 event tables → 1 → gfs_sync_items
- **Still open**: no webhook retry (ENG-2734), no e2e test for webhook→sync chain (ENG-2732), ensure_project_store race (ENG-2006), CASCADE FK orphan risk (ENG-2820), SSE heartbeat missing (ENG-1938)
- **Lessons**: design soft-delete + multi-source + two-stage from day one; validate scopes with real flows early; PostgREST partial indexes break upserts; Railway SSE idle timeout is 10s

### Sentry Errors (Track C)
- **~75 unique issues, ~11K events** across python-fastapi (73) and nextjs-app (2)
- **Top user-facing**: folder scan 502s (49 events, 3 users), GFS query failures (107 events), select-folder constraint errors
- **Highest volume**: text extraction backfill bug (4,620 events, resolved), Unified.to 429 rate limiting (1,011 events), schema mismatches (1,536 events)
- **Biggest category**: network/connection errors (~35 issues, ~660 events) — broken pipes, resets, timeouts across all sync_worker ops
- **Key pattern**: sync_worker is single point of fragility; every network hiccup → Sentry error
- **Supabase instability**: "JSON could not be generated" errors, 502 HTML responses, broken pipes, storage 404s
- **~45 issues still unresolved**, ~30 resolved
- **For SharePoint**: same errors will recur unless connection resilience, idempotency guards, rate limit backoff, storage upload verification added to shared infra

## Deliverables
1. **Linear sub-issue under ENG-3730**: "How we built Drive — what to reuse for SharePoint"
2. **Linear sub-issue under ENG-3730**: "Everything that went wrong with Drive — lessons for SharePoint"
3. **Linear sub-issue under #2**: "Sentry audit — all drive-related errors"
