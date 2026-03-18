## Current State
Slice: 1 of 2 — ENG-2972 (claim RPC backend field) | Step: baseline | Status: starting
Last checkpoint: Build created
Next: Run baseline tests, then spec slice 1

## Auto-Inject
Priority: Don't regress > Orchestrate > Build.
Role: Liaison. Workers implement; I verify and commit.
Sequencing: Sequential. ENG-2972 first (RPC change), then ENG-3048 (worker branch).

## Build Plan

### Slice 1: ENG-2972 — Claim RPC returns `backend` field
- Modify `claim_pending_sync()` and `claim_pending_deletion()` SQL functions
- Add `backend TEXT` to return type
- Join entity → project → workspace to check toggle
- Default to `'gfs'` if no toggle setting exists yet (backwards compatible)
- Worker reads new field but doesn't use it yet (that's slice 2)

### Slice 2: ENG-3048 — Worker `if backend == 'vais'` branch
- Add `VaisFileSearchService` construction in `SyncWorker.__init__()`
- Add `if backend == 'vais'` branch in `process_pending_syncs()`
- Add `if backend == 'vais'` branch in `process_pending_deletions()`
- GFS paths untouched

## Dependencies
- ENG-2765 (gfs_sync_items) — landed, claim RPCs exist
- ENG-2942 (VaisFileSearchService) — on feat/vais-file-search-service branch, not yet merged
- Slice 2 depends on slice 1 (worker reads `backend` field from RPC)

## Quality Log
(none yet)
