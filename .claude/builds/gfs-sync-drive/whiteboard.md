## Current State
Slice: D1 (Infrastructure + backfill) | Step: not started | Status: pending
Last checkpoint: Planning complete. Handoff doc + 4 slice specs written.
Next: Baseline tests, seed data, then implement D1.

## Auto-Inject (re-injected after every agent return)
Priority: Don't regress > Orchestrate > Build. Never sacrifice correctness for velocity.
Role: Liaison. I spawn workers, read code directly, verify results, commit and push. Workers never commit.
Process: Read whiteboard → plan step → spawn worker → verify → commit → update whiteboard.
Integrity: After every implementation step, spawn test-integrity reviewer. Check the diff, not the summary.
Sequencing: Sequential. Each worker builds against committed code from previous step.
Data: Never clean seeded data. Accumulation proves back-compatibility.

Pitfalls (HARD RULES):
1. ONE concern per migration. No bundling.
2. Old RPCs are READ-ONLY. Don't modify them.
3. "Pre-existing failure" is a CLAIM. Verify: git stash, run at prior commit, confirm it fails.
4. Don't silence CI checks. Only allowlist trigger→trigger chains that db-checks can't trace.
5. Projection: is_excluded-only for writer switch, upgrade to full for worker switch.
6. Content gate writes `excluded` (NOT `rejected`).
7. Re-inclusion from `deleted`: TWO-STEP update (status first while is_excluded=true, then is_excluded=false).
8. gfs_doc_id clearing: direct entity-table write during coexistence (COALESCE workaround).
9. Unit test mocks: do NOT write mock-heavy unit tests. Use pgTAP for DB logic, integration for flows.
10. PostgREST computed relationships return arrays. Access via `[0]`.
11. Other agents share the working tree. Always verify `git branch --show-current`. Only `git add` specific files.

Drive-specific:
12. Download stage stays on drive_files. Sync row created at INSERT with `blocked`. Download completion transitions `blocked → pending`.
13. `last_synced_at` and `force_sync_at`: write directly to drive_files after sync (old trigger won't fire).
14. `download_skipped` fast-path: if sync row is already `synced`, skip. Still update `last_synced_at`.
15. Disconnect bulk write: test with realistic volumes (100+ files).
16. Re-scan resurrection: two-step pattern for `deleted → pending` (triggered by scan, not user toggle).
17. `is_external` (boolean) not `access_level` (text) — map at gather time.

Test baseline (record actual numbers before starting):
- JS: [run and record]
- Python: [run and record]
- pgTAP: [run and record]
- Schema: [run and record]

## Per-Slice Cycle
1. **Baseline**: 3 test suites (JS, Python, pgTAP+schema) — all must pass
2. **Seed**: sync-test seed fill (accumulative, never cleaned)
3. **Spec review**: Read slice spec, spawn negative reviewer to check for gaps
4. **Implement**: Spawn workers sequentially, verify each, commit each
5. **Post-review**: Code reviewer + regression detector + test runner
6. **Retro**: Update whiteboard, extract lessons

## Goal
Migrate drive files to use gfs_sync_items for GFS sync lifecycle. Download stage stays on drive_files.

## Scope
- D1: Infrastructure + backfill (creation trigger, cleanup trigger, computed relationships, RLS, backfill)
- D2: Switch writers (exclusion toggle, access level toggle, disconnect, re-scan resurrection, download handoff)
- D3: Switch worker (sync worker + deletion worker write to gfs_sync_items, last_synced_at/force_sync_at direct writes)
- D4: Switch readers (admin stats RPC, drive file list queries, timeout detection)
- NOT in scope: Column split (cleanup), old RPC removal (cleanup), old trigger retirement (cleanup)

## Phase Map
- [ ] Slice D1: Infrastructure + backfill
- [ ] Slice D2: Switch drive writers
- [ ] Slice D3: Switch drive worker
- [ ] Slice D4: Switch drive readers
- [ ] Cleanup: Column split + drop old columns (production-gated)

## Key Context

### Decisions
- Sync row created at INSERT with `blocked` (creation trigger on drive_files)
- Download stage stays on drive_files (pending → downloading → stored)
- `blocked → pending` when download completes (handoff to GFS pipeline)
- `is_excluded` lives on gfs_sync_items (single source of truth)
- Column split (gfs_sync_status → download_status) deferred to cleanup
- No mock-heavy unit tests — pgTAP + integration only

### What already exists
- gfs_sync_items partition: gfs_sync_items_drive (created Slice 1)
- FK: fk_gfs_sync_items_drive_entity
- Entity-agnostic claim RPCs (claim_pending_sync, claim_pending_deletion)
- BEFORE UPDATE validation trigger (transitions, failure_count)
- AFTER UPDATE audit trigger (event logging, vocab fix)
- NO creation trigger, NO cleanup trigger, NO computed relationships, NO backfill, NO RLS UPDATE

### Drive-specific complexity
- Two-stage pipeline: download (drive-specific) then upload (shared GFS)
- `download_skipped` fast-path (content_hash dedup)
- `last_synced_at`, `force_sync_at`, `retry_reset_at` on drive_files
- `is_external` (boolean) instead of `access_level` (text)
- Disconnect cascades orphan files (SET NULL on folder_scope_id)
- Re-scan resurrects soft-deleted files
- `awaiting_confirmation` gate before download

### Writer surfaces (6)
- Download worker handoff (stored → blocked→pending on sync row)
- Exclusion toggle (api/drive.py)
- Access level toggle / re-sync (api/drive.py)
- Disconnect (api/drive.py)
- Re-scan resurrection (api/drive.py)
- Confirm sync stays on drive_files (download stage)

### Reader surfaces
- admin_get_drive_connection_stats() RPC
- Drive file list queries
- Timeout detection (sync_worker.py)

### Test commands
```
cd nextjs-app && bun run test:integration
cd python-services && uv run pytest tests/integration/db/ -v
bun tools/db-test/src/cli.ts pgtap && bun tools/db-test/src/cli.ts schema
sync-test verify --list
```

### Reference files (email migration patterns to follow)
- E1 backfill: supabase/migrations/20260318183104_slice_e1_backfill_emails.sql
- E2 prerequisites: supabase/migrations/20260318183152_slice_e2_writer_prerequisites.sql
- E3 prerequisites: supabase/migrations/20260318200340_slice_e3_worker_prerequisites.sql
- Resolver writer switch: nextjs-app/lib/services/inbound-email-resolver.ts
- Python API writer switch: python-services/agent_api/api/email.py
- Worker switch: python-services/agent_api/email_sync_service.py
- Reader switch: nextjs-app/lib/services/project-email.ts

## Quality Log
(populated as slices complete)

## Lessons Learned
(populated from retros)
