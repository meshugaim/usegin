# Phase 04: Fix Trigger & Claim Bugs

**Date:** 2026-03-12
**Migration:** `20260312012408_fix_gfs_sync_trigger_and_claim_bugs.sql`
**Linear:** ENG-2030 (Step 1)

## Bugs Fixed

### Bug 1: Drive trigger missing allowlist guards

**Root cause:** `update_drive_sync_status()` did a bare `UPDATE ... WHERE id = NEW.drive_file_id` with no state check. Any event would overwrite any status.

**Fix:** Added `DECLARE new_status/allowed/current_st` pattern matching file/email triggers. Each event_type declares which source statuses it may transition FROM. The `WHERE` clause enforces `AND gfs_sync_status = ANY(allowed)`. Blocked transitions are logged via `RAISE LOG`.

**Allowlist mapping (Drive-specific):**
- Download stage: `download_started` from `{pending, download_failed}`, etc.
- Upload stage: `sync_started` from `{stored, upload_failed}`, etc.
- Deletion stage: `deletion_started` from `{pending_deletion}`, etc.

### Bug 2: Drive trigger missing `is_excluded` check

**Root cause:** `deletion_succeeded` unconditionally set `deleted_at = NOW()`, even for excluded files. Excluded files should not get `deleted_at` — they remain visible but ignored.

**Fix:** Changed the `deleted_at` CASE to: `WHEN NEW.event_type = 'deletion_succeeded' AND NOT drive_files.is_excluded THEN NOW()`.

### Bug 3: Claim RPCs missing `deleted_at IS NULL`

**Root cause:** `claim_pending_file_sync`, `claim_pending_email_sync`, and `claim_pending_attachment_sync` all lacked a `deleted_at IS NULL` filter. Soft-deleted rows with `pending` or `failed` status would be claimed and processed.

**Fix:** Added `AND pf.deleted_at IS NULL` / `AND ie.deleted_at IS NULL` / `AND ea.deleted_at IS NULL` to each claim RPC's WHERE clause. Drive claims already had this filter.

### Bug 4: Inconsistent `triggered_by` defaults

**Root cause:** `drive_sync_events` had `DEFAULT 'sync_worker'` but `file_sync_events` and `email_sync_events` had no default.

**Fix:** `ALTER TABLE ... ALTER COLUMN triggered_by SET DEFAULT 'sync_worker'` on both tables.

## Verification (TDD — Before/After)

### Bug 1: Drive trigger allowlist guards

| Test | Before | After |
|------|--------|-------|
| Insert `sync_succeeded` for `pending_deletion` drive file | Status overwritten to `synced` | Status stayed `pending_deletion` (guard blocked) |

### Bug 2: Drive trigger `is_excluded` check

| Test | Before | After |
|------|--------|-------|
| Insert `deletion_succeeded` for excluded drive file | `deleted_at` set to NOW() | `deleted_at` stayed NULL |

### Bug 3: Claim RPCs `deleted_at IS NULL`

| Test | Before | After |
|------|--------|-------|
| `claim_pending_file_sync(100)` | Returned `seed-deleted-bug.txt` (soft-deleted) | Returned only `seed-pending.txt` |
| `claim_pending_email_sync(100)` | Returned `Deleted-bug email` (soft-deleted) | Returned only `Failed email` |

### Bug 4: `triggered_by` defaults

| Table | Before | After |
|-------|--------|-------|
| `file_sync_events` | NULL (no default) | `'sync_worker'` |
| `email_sync_events` | NULL (no default) | `'sync_worker'` |
| `drive_sync_events` | `'sync_worker'` | `'sync_worker'` (unchanged) |

## Seed Data Used

All tests ran against the seed data in `supabase/seed/gfs-sync-test-data.sql`:
- `pf_deleted_bug` (`5d000001-...-0009`): `pending` + `deleted_at IS NOT NULL` — proved Bug 3 for files
- `ie_deleted_bug` (`5d000003-...-0007`): `pending` + `deleted_at IS NOT NULL` — proved Bug 3 for emails
- `df_pend_del` (`5d000006-...-0005`): `pending_deletion` — proved Bug 1
- `df_excl_pend_del` (`5d000006-...-0007`): `is_excluded=true` + `pending_deletion` — proved Bug 2
