# Phase 09: Merge 3 Event Tables into 1 Polymorphic `gfs_sync_events` (ENG-2665)

**Date:** 2026-03-12
**Status:** Complete

## Summary

Merged `file_sync_events`, `email_sync_events`, and `drive_sync_events` into a single `gfs_sync_events` table with a `gfs_entity_type` discriminator enum (`file`, `email`, `attachment`, `drive`).

## Migration: `20260312030252_merge_gfs_event_tables.sql`

### Schema
- Created `gfs_entity_type` enum: `file`, `email`, `attachment`, `drive`
- Created `gfs_sync_events` table with columns: `id`, `entity_type`, `entity_id`, `event_type`, `error_message`, `gfs_doc_id`, `triggered_by`, `duration_ms`, `created_at`
- Indexes: `(entity_type, entity_id, created_at DESC)` and `(created_at DESC)`

### Backfill
- `file_sync_events` -> `entity_type='file'`, `entity_id=project_file_id`
- `email_sync_events WHERE email_attachment_id IS NULL` -> `entity_type='email'`, `entity_id=inbound_email_id`
- `email_sync_events WHERE email_attachment_id IS NOT NULL` -> `entity_type='attachment'`, `entity_id=email_attachment_id`
- `drive_sync_events` -> `entity_type='drive'`, `entity_id=drive_file_id`
- Row count verification: new total = sum of old table counts (0 rows in local dev, verified by schema)

### RLS Policies (CRITICAL)
- RLS enabled: `ALTER TABLE gfs_sync_events ENABLE ROW LEVEL SECURITY`
- 3 policies created:
  1. **Service role full access** (FOR ALL TO authenticated WHERE auth.role() = 'service_role')
  2. **Project members can view** (FOR SELECT with CASE on entity_type, joins through entity tables to project_members)
  3. **Project members can insert** (FOR INSERT with same CASE logic)
- Drive entity type restricts to `pm.role = 'owner'` (matches old drive_sync_events policy)
- DB security check passes: 457 checks, 0 failures

### Unified Trigger
- Single `update_gfs_sync_status()` SECURITY DEFINER function replaces 3 separate triggers
- Dispatches by `entity_type` with entity-specific branches:
  - **Drive**: download stage + upload stage + deletion stage, extra columns (`last_synced_at`, `force_sync_at`, `is_excluded` guard)
  - **File/Email/Attachment**: upload + deletion stages
- Allowlist guards preserved from Step 1 bug fixes
- Blocked transitions logged via RAISE LOG

### Claim RPCs Updated (9 functions)
All claim RPCs now query `gfs_sync_events WHERE entity_type = '...' AND entity_id = ...`:
1. `claim_pending_file_sync`
2. `claim_pending_file_deletion`
3. `claim_pending_email_sync`
4. `claim_pending_email_deletion`
5. `claim_pending_attachment_sync`
6. `claim_pending_attachment_deletion`
7. `claim_pending_drive_download`
8. `claim_pending_drive_sync`
9. `claim_pending_drive_deletion`

### Old Infrastructure Dropped
- Triggers: `trg_update_sync_status`, `trg_update_email_sync_status`, `trg_update_drive_sync_status`
- Functions: `update_project_file_sync_status()`, `update_inbound_email_sync_status()`, `update_drive_sync_status()`
- Tables: `file_sync_events`, `email_sync_events`, `drive_sync_events` (CASCADE)

## Python Changes

### `gfs_sync_types.py`
- Added `GfsSyncEntityType(StrEnum)` with values: `FILE`, `EMAIL`, `ATTACHMENT`, `DRIVE`

### `sync_worker.py`
- `_insert_event()`: Uses `entity_type=GfsSyncEntityType.FILE`, `entity_id=project_file_id`, inserts to `gfs_sync_events`
- `_insert_email_event()`: Routes by `email_attachment_id` presence -> `ATTACHMENT` or `EMAIL` entity_type
- `_insert_drive_event()`: Uses `entity_type=GfsSyncEntityType.DRIVE`, `entity_id=drive_file_id`
- All 5 `cleanup_timed_out_*()` methods: Query `gfs_sync_events` with `.eq("entity_type", ...).eq("entity_id", ...).eq("event_type", ...).gte("created_at", ...)`

### Comment updates
- `admin_gfs_domain_models.py`, `admin_gfs_repository.py`, `drive_sync_service.py`: Updated docstring references from old table names to `gfs_sync_events`

## TypeScript Changes

### `admin-drive.ts`
- `getDriveFileEvents()`: Queries `gfs_sync_events` with `.eq("entity_type", "drive").eq("entity_id", driveFileId)` instead of `drive_sync_events`

### `database.types.ts`
- Regenerated from local schema
- Old tables (`file_sync_events`, `email_sync_events`, `drive_sync_events`) removed
- New `gfs_sync_events` table type present with `gfs_entity_type` enum

### Integration Tests Updated
- `drive/rls.test.ts`: Updated to use `gfs_sync_events` with entity_type/entity_id
- `drive/schema.test.ts`: Updated table references
- `drive/trigger.test.ts`: Updated to insert via `gfs_sync_events`
- `project-files/sync-state-transitions.test.ts`: Updated event insertion
- `test_email_sync_events.py`: Updated table references
- `test_file_sync_events.py`: Updated table references
- `test_sync_worker_e2e.py`: Updated table references
- `test_claim_pending_rpcs.py`: Updated table references

### Other Files Updated
- `tools/project-clone/src/clone-db.ts`: Updated to delete from `gfs_sync_events` with entity_type WHERE clauses
- `tests/e2e/drivers/file-upload.driver.ts`: Updated table reference
- `supabase/seed/gfs-sync-test-data.sql`: Updated seed data for new table

## Unit Test Fix

- `test_sync_worker_drive.py::TestCleanupTimedOutDriveDownloads::test_skips_files_with_recent_download_started`: Fixed mock chain depth. The new code uses 3 `.eq()` calls (entity_type, entity_id, event_type) instead of 2 (drive_file_id, event_type), requiring an extra `.eq.return_value` in the mock chain for tests that verify "skip" behavior.

## Additional Fixes (Session 2)

Fixed remaining integration test references missed in initial commit:
- `test_claim_pending_rpcs.py`: Added `entity_type` to all event query `.eq()` chains (file, email, attachment, drive)
- `test_email_attachment_flow.py`: Updated cleanup and assertion queries
- `test_sync_worker_e2e.py`: Updated all event inserts and queries
- `test_sync_worker.py` (unit): Updated `TestInsertEmailEventWithAttachmentId` -> `TestInsertEmailEventEntityTypeDispatch`, fixed all `email_attachment_id` assertions to `entity_id`
- `test_sync_worker_drive.py` (unit): Fixed all 4 cleanup mock chains and `drive_file_id` assertion
- `tools/db-checks/src/extract/python.test.ts`: Updated example table names

## Commits

1. `e6821b03` — Migration, Python code, TypeScript code, initial test updates
2. `44d94f1c` — Remaining integration test fixes + unit test assertion fixes

## Test Results

- **Python unit tests**: All passed (3 skipped)
- **Next.js unit tests**: 2110 passed, 7 todo, 0 failed
- **TypeScript type check**: Clean (0 errors)
- **DB security check**: All tables have RLS, all operations have matching policies
- **Push**: Both commits pushed to main
