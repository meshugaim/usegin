# Fix Integration Tests Referencing Dropped `project_file_versions` Columns

**ENG-2030** | 2026-03-12

## Root Cause Analysis

The GFS sync unification (commit `5bdc8e33`) had two categories of breakage:

### 1. Test fixtures inserting dropped columns (8 errors in test_sync_worker_e2e.py)

Migration `20260312013616_drop_vestigial_gfs_sync_columns.sql` dropped 7 columns from
`project_file_versions`, including `gfs_sync_status`. Two test fixtures in
`test_sync_worker_e2e.py` still inserted `gfs_sync_status: "pending"` into
`project_file_versions`. All 8 tests in the file depend on these fixtures,
hence 8 errors.

**Fix:** Removed `gfs_sync_status` from `project_file_versions` inserts. That
column now lives on `project_files` (which the fixtures already set correctly).

### 2. Migration regression: RPCs reverted to dropped tables (failures in test_claim_pending_rpcs.py)

Migration `20260312133602_restore_is_excluded_filter_in_claim_rpcs.sql` was
written against the pre-unification schema. It `CREATE OR REPLACE`d three RPCs
(`claim_pending_file_sync`, `claim_pending_email_sync`,
`claim_pending_attachment_sync`) with bodies referencing `file_sync_events` and
`email_sync_events` -- tables dropped by the earlier
`20260312030252_merge_gfs_event_tables.sql` migration.

Additionally, the reverted RPCs used `'excluded'::gfs_sync_status` instead of
`'retry_exhausted'::gfs_sync_status` (added in `20260223211642`).

**Migration execution order:**
1. `030252` — merges 3 event tables into `gfs_sync_events`, rewrites all RPCs
2. `133602` — overwrites 3 RPCs back to reference dropped tables

**Fix:** Rewrote migration `133602` to use `gfs_sync_events` (unified table)
with proper `entity_type` filtering and `retry_exhausted` status. The
`is_excluded = false` filter (the original purpose of this migration) is
preserved.

## Files Changed

| File | Change |
|------|--------|
| `python-services/tests/integration/db/test_sync_worker_e2e.py` | Removed `gfs_sync_status` from 2 `project_file_versions` inserts |
| `python-services/tests/integration/db/test_claim_pending_rpcs.py` | Fixed 2 stale comments (`file_sync_events` -> `gfs_sync_events`, `excluded` -> `retry_exhausted`) |
| `supabase/migrations/20260312133602_restore_is_excluded_filter_in_claim_rpcs.sql` | Fixed 3 RPCs: `file_sync_events`/`email_sync_events` -> `gfs_sync_events`, `excluded` -> `retry_exhausted` |

## Scope Check: Other Integration Tests

Searched `python-services/tests/integration/` for:
- `gfs_sync_status` on `project_file_versions` — **none found** (only the two fixed above)
- `file_sync_events` table references — **none** (only the helper function NAME `insert_file_sync_events` which correctly inserts into `gfs_sync_events`)
- `email_sync_events` table references — **none**
- `drive_sync_events` table references — **none**
- `gfs_doc_id` on `project_file_versions` — **none**

All other integration test files already use the unified schema.
