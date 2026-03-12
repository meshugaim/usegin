# Phase 08: Standardize Failure Enums (ENG-2666)

**Date:** 2026-03-12
**Migration commit:** 7f6fb580
**Code update commit:** ff1606e1, 2179cf42
**Migration:** `20260312024440_standardize_gfs_failure_enums.sql`

## What Changed

### Problem
File and email triggers mapped `sync_failed`/`sync_timed_out` to `'failed'`, while the Drive trigger mapped them to `'upload_failed'`. Claim RPCs used `IN ('pending', 'failed')` for files/emails but `IN ('stored', 'upload_failed')` for drive. This drift meant different entity types used different status values for the same failure.

### Solution

**SQL Migration (1 file):**
- `update_project_file_sync_status()` — `sync_failed`/`sync_timed_out` now produce `'upload_failed'` instead of `'failed'`
- `update_inbound_email_sync_status()` — same changes for both email body and attachment paths
- Data migration: All entity rows with `gfs_sync_status = 'failed'` -> `'upload_failed'`
- Claim RPCs: `IN ('pending', 'failed')` -> `IN ('pending', 'upload_failed')` with `deleted_at IS NULL` checks

**TypeScript changes:**
- `lib/gfs/sync-types.ts`: `FAILED: "failed"` replaced with `UPLOAD_FAILED: "upload_failed"`
- Service files (`project-stats.ts`, `project-core.ts`): Status checks updated
- UI components: `gfs-sync-status-icon.tsx`, `project-files-client.tsx`, `email-config-modal.tsx`, `email-tab-content.tsx`, `admin-drive.ts`
- Database types regenerated
- 7 test files updated

**Python code changes:**
- `gfs_sync_types.py`: Removed `FAILED = "failed"` from `GfsSyncStatus` enum (13 members, was 14)
- `test_gfs_sync_types.py`: Updated expected values list, count, and spot-check assertions
- Seed data (`gfs-sync-test-data.sql`): All `'failed'` fixups changed to `'upload_failed'`

**Python integration test changes:**
- `test_file_sync_events.py`: Transition tables and flow assertions updated
- `test_email_sync_events.py`: Same for email body and attachment paths
- `test_claim_pending_rpcs.py`: Comments updated
- `test_sync_worker_e2e.py`: Assertion updated

## Verification

### Post-migration
- 0 rows with `gfs_sync_status = 'failed'` across all entity tables
- Triggers correctly map `sync_failed`/`sync_timed_out` -> `upload_failed`

### Test Results
- Python unit tests: 1574 passed, 3 skipped, 0 failed
- Next.js unit tests: 2110 passed, 7 todo, 0 failed

## Notes
- Postgres `gfs_sync_status` enum still contains `'failed'` (cannot remove enum values easily). Now unused.
- Event types `sync_failed`/`sync_timed_out` unchanged — they describe *what happened*. Only the *resulting status* changed.
- Display-level types (`DataRowSyncStatus`, `DriveFileDisplayStatus`) still use `"failed"` as a display label, correctly mapped from `upload_failed` by `mapSyncStatus()`.
