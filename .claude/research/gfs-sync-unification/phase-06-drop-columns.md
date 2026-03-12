# Phase 06: Drop Vestigial Columns (ENG-2664)

**Date:** 2026-03-12
**Status:** Complete

## Summary

Dropped 7 vestigial columns from `project_file_versions` and 1 from `inbound_emails`.
These columns were superseded when sync state moved to the parent `project_files` table
via `file_sync_events` triggers.

## Migration

**File:** `supabase/migrations/20260312013616_drop_vestigial_gfs_sync_columns.sql`

### Dropped from `project_file_versions` (7 columns):
- `gfs_sync_status` — moved to `project_files.gfs_sync_status`
- `gfs_doc_id` — moved to `project_files.gfs_doc_id`
- `store_sync_error` — now in `file_sync_events.error_message`
- `synced_to_store_at` — tracked via `file_sync_events` timestamps
- `deleted_from_store_at` — tracked via `file_sync_events` timestamps
- `sync_retry_count` — tracked via `file_sync_events` count
- `sync_started_at` — tracked via `file_sync_events` timestamps

### Dropped from `inbound_emails` (1 column):
- `sync_retry_count` — tracked via `file_sync_events` count

### Also dropped:
- **Function:** `count_stale_file_versions(uuid, text)` — referenced the dropped columns
- **Indexes:** `idx_project_file_versions_gfs_sync_status`, `idx_project_file_versions_processing`, `idx_project_file_versions_gfs_doc_id`

## Code Changes

### Python (`python-services/`)

| File | Change |
|------|--------|
| `admin_gfs_domain_models.py` | Removed `store_sync_error` from `VersionRecord` |
| `admin_gfs_repository.py` | Removed `count_stale_file_versions()`, updated `get_synced_versions_for_all_stores()` and `get_sync_queue()` to query `project_files` |
| `admin_gfs_service.py` | Replaced `count_stale_file_versions()` call with `stale_count = 0` |
| `admin_gfs_mutations.py` | Updated `delete_orphan_doc()`, `retry_sync()`, `force_resync_file()`, `delete_stale_version()` to use `project_files` |
| `admin_gfs_reconciliation.py` | Updated all queries from `project_file_versions` to `project_files` |
| `project_file_search_service.py` | Removed `update_version_sync_status()` method and 7 call sites |
| Tests: `test_admin_gfs_*.py`, `test_project_file_search_sync.py` | Updated to match new queries |

### Next.js (`nextjs-app/`)

| File | Change |
|------|--------|
| `lib/services/project-files/types.ts` | Removed `gfs_sync_status`, `store_sync_error` from `file_version` sub-interface |
| `lib/services/project-files/operations.ts` | Removed dropped columns from Supabase join query |
| `components/project-file-manager.tsx` | Changed from `file.file_version?.gfs_sync_status` to `file.gfs_sync_status` |
| `app/projects/[projectId]/files/project-files-client.tsx` | Same change: file-level sync status |
| `lib/supabase/database.types.ts` | Regenerated — dropped columns confirmed gone |
| All test files referencing `file_version.gfs_sync_status` or `store_sync_error` | Updated |

### Other files updated:
- `tools/project-clone/src/clone-db.ts` — removed dropped columns from upsert
- `supabase/seed/gfs-sync-test-data.sql` — removed dropped columns from INSERTs
- `scripts/setup-gfs-test-data.py` — removed dropped columns from version inserts

## "Too Large" UI Distinction

The `GfsSyncStatusIcon` component still accepts an `error` prop that can differentiate
"Too large for AI search" from "Not supported" for excluded files. However, since
`store_sync_error` was dropped from `project_file_versions`, no caller passes the error
prop for project files anymore. All excluded files now uniformly show "Not supported".

The error detail is still available in `file_sync_events.error_message` if a future
UI wants to surface it — that would require a separate query/join.

## Test Results

- **Python:** 1575 passed, 3 skipped, 0 failed
- **Next.js:** 2110 passed, 7 todo, 0 failed

## Codebase Grep Verification

Before dropping, all references to the 8 columns were identified and updated:
- SQL: migration itself, seed data, `count_stale_file_versions` function
- Python: admin GFS modules, sync service, test files
- TypeScript: types, operations, components, test drivers, stories, clone tool
