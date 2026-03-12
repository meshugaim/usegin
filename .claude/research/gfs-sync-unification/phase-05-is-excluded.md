# Phase 05: Add `is_excluded` to `project_files`

**Step:** 2 of GFS Sync Unification plan (ENG-2030)
**Date:** 2026-03-12

## Pre-migration state

- `project_files` had 11 columns: `id`, `project_id`, `filename`, `access_level`, `current_version_id`, `is_archived`, `created_at`, `updated_at`, `deleted_at`, `gfs_sync_status`, `gfs_doc_id`
- No `is_excluded` column existed
- `drive_files` already had `is_excluded boolean NOT NULL DEFAULT false` (the pattern to match)
- 9 rows in local `project_files` (seed data from phase 03)

## Migration

**File:** `supabase/migrations/20260312012855_add_is_excluded_to_project_files.sql`

```sql
ALTER TABLE project_files
  ADD COLUMN is_excluded BOOLEAN NOT NULL DEFAULT false;
```

## Verification

### Column exists with correct definition
```
 column_name | data_type | is_nullable | column_default
-------------+-----------+-------------+----------------
 is_excluded | boolean   | NO          | false
```

### All existing rows have default value
```
 total_rows | false_count | true_count
------------+-------------+------------
          9 |           9 |          0
```

- All 9 rows have `is_excluded = false`
- No NULL values (column is NOT NULL)
- No data corruption

### Security checks
- `bun tools/db-test/src/cli.ts security` — 473 checks passed, 0 failures

## Consistency check

Tables with `is_excluded` after this migration:
- `drive_files` — `boolean NOT NULL DEFAULT false`
- `inbound_emails` — has `is_excluded`
- `email_attachments` — has `is_excluded`
- `project_files` — `boolean NOT NULL DEFAULT false` (NEW)

All four entity tables now have `is_excluded`, enabling uniform trigger logic in the upcoming event table unification (step 6).
