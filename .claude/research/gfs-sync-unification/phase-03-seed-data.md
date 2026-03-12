# Phase 03: Seed Test Data for GFS Sync Unification

**Date:** 2026-03-12
**Part of:** ENG-2030 (Step 0)

## What Was Done

Inserted realistic test data into all GFS-affected tables in the LOCAL Supabase database to exercise edge cases from the drift audit. The seed data will be used to verify each subsequent migration step.

### Seed File

`supabase/seed/gfs-sync-test-data.sql` — idempotent, uses `ON CONFLICT DO NOTHING` and manual status fixups after trigger-fired events.

### Row Counts (Baseline Snapshot)

| Table | Rows | Notes |
|---|---|---|
| project_file_search_stores | 6 | file/email/drive x internal/external |
| project_files | 9 | One per status + bug case |
| project_file_versions | 11 | 9 matched to files + 2 vestigial-column test rows |
| file_sync_events | 8 | History for synced, failed, deleted files |
| inbound_emails | 7 | Various statuses + bug case |
| email_attachments | 5 | pending, synced, failed, excluded, deleted |
| email_sync_events | 10 | Email body + attachment events |
| drive_connections | 1 | One active connection |
| drive_folder_scopes | 2 | Internal + external folders |
| drive_files | 11 | All statuses + drift audit edge cases |
| drive_sync_events | 22 | Full lifecycle events for drive files |

### Status Breakdown

**project_files (9 rows):**
- pending: 2 (1 normal, 1 soft-deleted bug case)
- processing: 1
- synced: 1
- failed: 1
- excluded: 1
- pending_deletion: 1
- deleting: 1
- deleted: 1

**inbound_emails (7 rows):**
- pending: 2 (1 normal, 1 soft-deleted bug case)
- synced: 1
- failed: 1 (sync_retry_count = 3)
- excluded: 1
- pending_deletion: 1
- deleted: 1

**email_attachments (5 rows):**
- pending: 1, synced: 1, failed: 1, excluded: 1, deleted: 1

**drive_files (11 rows):**
- pending: 2 (1 normal, 1 soft-deleted bug case)
- synced: 1
- failed: 1 (will become upload_failed in step 5)
- excluded: 1 (is_excluded=true)
- pending_deletion: 2 (1 normal, 1 is_excluded=true bug case)
- deleted: 1
- upload_failed: 1
- download_failed: 1
- stored: 1

### Edge Cases Covered

1. **Soft-deleted + pending status (drift bug #3):** project_files, inbound_emails, and drive_files each have one row with `deleted_at IS NOT NULL` and `gfs_sync_status = 'pending'`. The claim RPCs should NOT return these, but currently DO (confirmed by test).

2. **Excluded drive files:** Two drive files with `is_excluded = true`:
   - One with `gfs_sync_status = 'excluded'` (correctly excluded)
   - One with `gfs_sync_status = 'pending_deletion'` (drift bug #2 — deletion_succeeded should NOT set deleted_at when is_excluded)

3. **Vestigial columns on project_file_versions:** Two extra version rows with all vestigial columns populated (`gfs_sync_status`, `gfs_doc_id`, `store_sync_error`, `synced_to_store_at`, `sync_retry_count`, `sync_started_at`). Proves column drop won't lose active data.

4. **Various failure statuses:** `failed`, `upload_failed`, `download_failed` — covers the enum standardization in step 5.

5. **retry_count > 0:** One inbound_email with `sync_retry_count = 3`.

### Bug Verification Results

**claim_pending_file_sync bug (confirmed):**
- Called `claim_pending_file_sync(100)` — returned the soft-deleted file (`5d000001-...-0009`).
- This file has `deleted_at IS NOT NULL` but `gfs_sync_status = 'pending'`.
- Step 1 fix: add `AND deleted_at IS NULL` to the WHERE clause.

**claim_pending_email_sync bug (confirmed):**
- After claiming other pending rows, `claim_pending_email_sync(100)` eventually returned the soft-deleted email (`5d000003-...-0007`).
- Same root cause: missing `deleted_at IS NULL` check.

**Drive trigger no-guard bug (confirmed):**
- During seed, the drive trigger unconditionally overwrote statuses on every event insert (no allowlist guards). Had to use manual fixup UPDATEs after event insertion.
- File/email triggers correctly blocked transitions via allowlist guards.

### Important Notes

- **Stop dev servers before re-seeding:** The Python API sync worker will claim pending rows and change their statuses. Run `just agent-dev-kill` before seeding.
- **Seed data uses UUID prefix `5d` for easy identification** (e.g., `5d000001-...` for project_files).
- **Events cause trigger side effects:** The seed inserts events (for history), then manually fixes entity statuses afterward. This is necessary because the drive trigger has no guards.
- **Verified project_file_versions vestigial columns** exist and are writable: `gfs_sync_status`, `gfs_doc_id`, `store_sync_error`, `synced_to_store_at`, `deleted_from_store_at`, `sync_retry_count`, `sync_started_at`.
