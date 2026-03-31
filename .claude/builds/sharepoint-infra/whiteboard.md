# SharePoint Infra — ENG-4158

## Current State
Slice: 1 (infra) | Step: done | Status: complete
Last checkpoint: Post-review passed — 278 baseline tests all green, regression check clean
Next: Push to main

## Auto-Inject
Priority: Don't regress > Orchestrate > Build.
Role: I am the liaison. Workers implement; I verify and commit.
Process: Read whiteboard → plan step → spawn worker → verify result → commit → update whiteboard.

## Scope
Migrate `drive_connections` → `cloud_connections` with provider column. Create SharePoint tables (scopes, files, subscriptions). Add gfs_sync_items partition. RLS + triggers. Prove Drive still works.

## Blast Radius (drive_connections rename)
- **167 occurrences across 32 files**
- App code: 4 files (27 hits) — drive.py, callback/route.ts, project-drive.ts, drive_sync_service.py
- Tests: 8 files (79 hits) — mostly table name strings in queries/inserts
- Generated types: database.types.ts — regenerated automatically
- Migrations: 10 files — NOT touched (new migration does the rename)
- Seed data: gfs-sync-test-data.sql (3 hits)
- Strategy: mechanical find-replace on `.table("drive_connections")` / `.from("drive_connections")`

## Key Patterns (from migration audit)
- RLS: 4 policies per table (SELECT/INSERT/UPDATE/DELETE), all `TO authenticated`, all use `is_project_owner()`
- For tables without direct project_id: RLS via connection chain (JOIN through cloud_connections)
- Partition: `CREATE TABLE gfs_sync_items_sharepoint PARTITION OF gfs_sync_items FOR VALUES IN ('sharepoint')`
- Per-partition FK: `ALTER TABLE gfs_sync_items_sharepoint ADD CONSTRAINT ... FOREIGN KEY (entity_id) REFERENCES sharepoint_files(id) ON DELETE RESTRICT`
- Triggers: `create_gfs_sync_item` and `cleanup_gfs_sync_item` functions already exist — just call with 'sharepoint'
- PostgREST computed relationships: bidirectional functions for sharepoint_files ↔ gfs_sync_items
- Storage bucket: INSERT INTO storage.buckets with file_size_limit

## Decisions
1. Two commits: (a) migration + SharePoint tables, (b) code rename + test updates
2. No insert trigger on sharepoint_files (spec says BackgroundTask creates gfs_sync_items explicitly)
3. is_excluded trigger: sharepoint_files.is_excluded change → projects to gfs_sync_items

## Baseline (278 tests, all pass)
| Suite | Tests | Result |
|-------|-------|--------|
| NextJS Drive integration (rls, schema, soft-delete, trigger) | 74 | 74 pass |
| Python unit (drive_api, drive_sync_service, gfs_upload_resilience) | 128 | 128 pass |
| Python unit (sync_worker_drive) | 27 | 27 pass |
| Python integration (claim_pending_rpcs, list_data_summary) | 49 | 49 pass |

Run NextJS integration with: `cd nextjs-app && bun run test:integration -- tests/integration/drive/`
Run Python unit with: `cd python-services && uv run pytest tests/unit/test_drive_api.py tests/unit/test_drive_sync_service.py tests/unit/test_sync_worker_drive.py tests/unit/test_gfs_upload_resilience.py -v`
Run Python integration with: `cd python-services && uv run pytest tests/integration/db/test_claim_pending_rpcs.py tests/integration/db/test_list_data_summary.py -v`

## Quality Log
| Step | Agent | Result | Notes |
|------|-------|--------|-------|
| baseline | drive-integ | PASS | 74/74 |
| baseline | py-unit | PASS | 155/155 |
| baseline | py-integ | PASS | 49/49 |
| spec | positive | PASS | Strong patterns, correct decisions |
| spec | negative | 3 CRITICAL found | RLS text refs, constraint name, admin fn — all fixed |
| implement | migration-worker | PASS | 2 migrations, 643 security checks, 0 failures |
| implement | rename-worker | PASS | 18 files, 204 python + 73 nextjs tests pass |
| implement | liaison fix | PASS | Soft-delete test updated (revive pattern), provider added to callback |
| post-review | integrity | PASS | No assertions removed/weakened |
| post-review | regression | PASS | No scope creep, no missing provider fields |
| post-review | python tests | PASS | 204/204 |
| post-review | nextjs tests | PASS | 74/74 |
