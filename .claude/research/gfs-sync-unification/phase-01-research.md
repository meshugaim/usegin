# GFS Sync Unification -- Phase 01 Research

## 1. Plan Summary (Steps 0-7)

### Step 0: Seed test data
Populate local Supabase with realistic rows across all affected tables before writing any migrations. Covers 9 tables: `project_file_search_stores`, `project_files`, `project_file_versions`, `file_sync_events`, `inbound_emails`, `email_attachments`, `email_sync_events`, `drive_files`, `drive_sync_events`. The seed data must exercise every edge case the migrations will encounter (every gfs_sync_status value, deleted_at set/unset, is_excluded flags, NULL gfs_doc_id, etc.). After seeding, snapshot counts grouped by status for before/after comparison.

### Step 1: Fix trigger & claim bugs (ENG-2030 Phase 1)
A single migration that fixes 4 bugs from the drift audit:
- **1a**: Add allowlist guards to `update_drive_sync_status()` -- currently any event overwrites any state (drift #1). File/email triggers already have `AND gfs_sync_status = ANY('{...}')` guards; drive trigger has none.
- **1b**: Add `AND NOT is_excluded` to drive trigger's `deletion_succeeded` branch -- currently excluded files get `deleted_at` set (drift #2).
- **1c**: Add `AND deleted_at IS NULL` to file/email/attachment claim RPCs -- soft-deleted entities can currently be claimed (drift #3). Drive claims already have this check.
- **1d**: Standardize `triggered_by` DEFAULT to `'sync_worker'` on `file_sync_events` and `email_sync_events` (drift #7). Drive already has this default.

### Step 2: Add `is_excluded` to `project_files`
Simple schema addition: `ALTER TABLE project_files ADD COLUMN is_excluded BOOLEAN NOT NULL DEFAULT false`. Brings `project_files` in line with `inbound_emails`, `email_attachments`, and `drive_files` which all already have this column (drift #6).

### Step 3: Drop vestigial columns (ENG-2664)
Drop 7 columns from `project_file_versions` and 1 from `inbound_emails`. These are left over from the pre-event-sourced design where sync state lived per-version. Now sync operates at the `project_files` level via event-sourced triggers.

Columns to drop from `project_file_versions`:
- `gfs_sync_status` -- sync state now on `project_files`
- `gfs_doc_id` -- same, on `project_files`
- `store_sync_error` -- errors in `file_sync_events.error_message`
- `synced_to_store_at` -- timing in events
- `deleted_from_store_at` -- timing in events
- `sync_retry_count` -- retries counted by claim RPCs from events
- `sync_started_at` -- timing in events

Column to drop from `inbound_emails`:
- `sync_retry_count` -- nobody writes this; claim RPCs count events

### Step 4: Python enum adoption
Replace string literals with `GfsSyncStatus` / `GfsSyncEventType` enums from `gfs_sync_types.py` in:
- `sync_worker.py`
- `email_sync_service.py`
- `drive_sync_service.py`
- `project_file_search_service.py`

No migration needed. Pattern: `"synced"` -> `GfsSyncStatus.SYNCED`.

### Step 5: Standardize failure enums and retry counting (ENG-2666)
Two behavior changes:
- **5a**: `failed` -> `upload_failed` for all GFS upload failures. Currently files/emails use `failed`, drive uses `upload_failed`. Data migration required for existing rows in `project_files`, `inbound_emails`, `email_attachments`. Claim RPCs updated from `IN ('pending', 'failed')` to `IN ('pending', 'upload_failed')`.
- **5b**: Standardize retry counting on `*_failed` events everywhere. Drive currently counts `*_started` events with `retry_reset_at` scoping. Keep `retry_reset_at` as opt-in for drive only.
- **5c**: Update Python code that references `'failed'` status.

### Step 6: Merge event tables (ENG-2665)
The heaviest step. Merge `file_sync_events`, `email_sync_events`, `drive_sync_events` into one `gfs_sync_events` table with `entity_type` (enum: file, email, attachment, drive) + `entity_id` (UUID). Sub-steps:
- 6a: Create `gfs_entity_type` enum and `gfs_sync_events` table
- 6b: Backfill from 3 old tables (preserving `created_at` and `id`)
- 6c: Write unified trigger `update_gfs_sync_status()` dispatching by `entity_type`
- 6d: Update all 9 claim RPCs to query new table
- 6e: Drop old triggers, functions, and tables
- 6f: Update all Python event insertion code
- 6g: Regenerate TypeScript types
- 6h: Verify row counts match and trigger paths work

### Step 7: Extract Python upload/delete helpers
Extract 2 shared helpers from the 4 sync paths (no migration):
- `prepare_and_upload()`: content gate -> temp file -> upload_to_google_search. Each caller still owns downloading content, building metadata, and post-upload persistence.
- `delete_from_store()`: unified deletion with 404/403 handling.
Update all 4 sync paths to use helpers.

### Step 8: Final verification
Re-run status snapshot, compare with step 0 (only `failed` -> `upload_failed` should differ). Run all unit tests. Verify TypeScript compilation. Close ENG-2030.

---

## 2. SQL for Each Migration

### Step 1 migration: `fix_gfs_sync_trigger_and_claim_bugs`

```sql
-- 1a: Replace drive trigger with allowlist guards
CREATE OR REPLACE FUNCTION update_drive_sync_status()
RETURNS TRIGGER AS $$
DECLARE
  new_status  gfs_sync_status;
  allowed     gfs_sync_status[];
  current_st  gfs_sync_status;
BEGIN
  CASE NEW.event_type
    -- Download stage
    WHEN 'download_started'   THEN new_status := 'downloading';   allowed := '{pending, download_failed}';
    WHEN 'download_succeeded' THEN new_status := 'stored';        allowed := '{pending, downloading, download_failed}';
    WHEN 'download_failed'    THEN new_status := 'download_failed'; allowed := '{pending, downloading, download_failed}';
    WHEN 'download_skipped'   THEN new_status := 'synced';        allowed := '{pending, stored, downloading, download_failed, synced}';
    -- GFS upload stage
    WHEN 'sync_started'       THEN new_status := 'processing';    allowed := '{stored, upload_failed}';
    WHEN 'sync_succeeded'     THEN new_status := 'synced';        allowed := '{stored, processing, upload_failed, synced}';
    WHEN 'sync_failed'        THEN new_status := 'upload_failed'; allowed := '{stored, processing, upload_failed}';
    WHEN 'sync_timed_out'     THEN new_status := 'upload_failed'; allowed := '{stored, processing, upload_failed}';
    -- Deletion stage
    WHEN 'deletion_started'   THEN new_status := 'deleting';      allowed := '{pending_deletion}';
    WHEN 'deletion_succeeded' THEN new_status := 'deleted';       allowed := '{pending_deletion, deleting, deleted}';
    WHEN 'deletion_failed'    THEN new_status := 'pending_deletion'; allowed := '{pending_deletion, deleting}';
    WHEN 'deletion_timed_out' THEN new_status := 'pending_deletion'; allowed := '{pending_deletion, deleting}';
    ELSE RETURN NEW;
  END CASE;

  SELECT gfs_sync_status INTO current_st FROM drive_files WHERE id = NEW.drive_file_id;

  UPDATE drive_files
  SET gfs_sync_status = new_status,
      gfs_doc_id = COALESCE(NEW.gfs_doc_id, drive_files.gfs_doc_id),
      last_synced_at = CASE
          WHEN NEW.event_type IN ('sync_succeeded', 'download_skipped') THEN NOW()
          ELSE drive_files.last_synced_at
      END,
      updated_at = NOW(),
      -- 1b: is_excluded check on deletion
      deleted_at = CASE
          WHEN NEW.event_type = 'deletion_succeeded' AND NOT drive_files.is_excluded THEN NOW()
          ELSE drive_files.deleted_at
      END,
      force_sync_at = CASE
          WHEN NEW.event_type IN ('sync_succeeded', 'download_skipped') THEN NULL
          ELSE drive_files.force_sync_at
      END
  WHERE id = NEW.drive_file_id
    AND gfs_sync_status = ANY(allowed);

  IF NOT FOUND THEN
    RAISE LOG 'gfs_sync guard blocked % on drive_file % (current: %, allowed: %)',
      NEW.event_type, NEW.drive_file_id, current_st, allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1c: Add deleted_at IS NULL to file claim
-- (Rewrite claim_pending_file_sync WHERE clause to add AND pf.deleted_at IS NULL)
-- (Rewrite claim_pending_email_sync WHERE clause to add AND ie.deleted_at IS NULL)
-- (Rewrite claim_pending_attachment_sync WHERE clause to add AND ea.deleted_at IS NULL)

-- 1d: Standardize triggered_by default
ALTER TABLE file_sync_events ALTER COLUMN triggered_by SET DEFAULT 'sync_worker';
ALTER TABLE email_sync_events ALTER COLUMN triggered_by SET DEFAULT 'sync_worker';
```

**Note on 1c**: All 9 claim RPCs must be rewritten with `CREATE OR REPLACE FUNCTION`. The file sync claim adds `AND pf.deleted_at IS NULL` to the outer SELECT. Email sync claim adds `AND ie.deleted_at IS NULL`. Attachment sync claim adds `AND ea.deleted_at IS NULL`. The file/email/attachment deletion claims do NOT need this guard (they operate on pending_deletion rows where deleted_at should be NULL by design, and the drive deletion claim already handles it).

### Step 2 migration: `add_is_excluded_to_project_files`

```sql
ALTER TABLE project_files
  ADD COLUMN is_excluded BOOLEAN NOT NULL DEFAULT false;
```

### Step 3 migration: `drop_vestigial_gfs_sync_columns`

```sql
-- CRITICAL: Must first update count_stale_file_versions() which references pfv.gfs_sync_status and pfv.gfs_doc_id
-- Option A: Rewrite to query project_files instead (preferred -- that's where the canonical data lives)
-- Option B: Drop the function entirely if stale version counting is no longer meaningful

-- Drop from project_file_versions
ALTER TABLE project_file_versions
  DROP COLUMN IF EXISTS gfs_sync_status,
  DROP COLUMN IF EXISTS gfs_doc_id,
  DROP COLUMN IF EXISTS store_sync_error,
  DROP COLUMN IF EXISTS synced_to_store_at,
  DROP COLUMN IF EXISTS deleted_from_store_at,
  DROP COLUMN IF EXISTS sync_retry_count,
  DROP COLUMN IF EXISTS sync_started_at;

-- Drop from inbound_emails
ALTER TABLE inbound_emails
  DROP COLUMN IF EXISTS sync_retry_count;
```

**Also need to drop associated indexes:**
- `idx_project_file_versions_gfs_sync_status` (on `gfs_sync_status`)
- `idx_project_file_versions_processing` (partial index on `gfs_sync_status = 'processing'`)
- `idx_project_file_versions_gfs_doc_id` (on `gfs_doc_id`)

### Step 5 migration: `standardize_gfs_failure_enums`

```sql
-- Update file trigger
-- (Rewrite update_project_file_sync_status with sync_failed/sync_timed_out -> 'upload_failed')

-- Update email trigger
-- (Rewrite update_inbound_email_sync_status with sync_failed/sync_timed_out -> 'upload_failed')

-- Data migration
UPDATE project_files SET gfs_sync_status = 'upload_failed' WHERE gfs_sync_status = 'failed';
UPDATE inbound_emails SET gfs_sync_status = 'upload_failed' WHERE gfs_sync_status = 'failed';
UPDATE email_attachments SET gfs_sync_status = 'upload_failed' WHERE gfs_sync_status = 'failed';

-- Update claim RPCs: 'failed' -> 'upload_failed' in WHERE clauses
-- claim_pending_file_sync: IN ('pending', 'failed') -> IN ('pending', 'upload_failed')
-- claim_pending_email_sync: IN ('pending', 'failed') -> IN ('pending', 'upload_failed')
-- claim_pending_attachment_sync: IN ('pending', 'failed') -> IN ('pending', 'upload_failed')
```

### Step 6 migration: `merge_gfs_event_tables`

```sql
-- 6a: Create enum and table
CREATE TYPE gfs_entity_type AS ENUM ('file', 'email', 'attachment', 'drive');

CREATE TABLE gfs_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type gfs_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  event_type gfs_sync_event_type NOT NULL,
  error_message TEXT,
  gfs_doc_id TEXT,
  triggered_by TEXT DEFAULT 'sync_worker',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gfs_sync_events_entity
  ON gfs_sync_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_gfs_sync_events_created
  ON gfs_sync_events (created_at DESC);

-- 6b: Backfill (4 INSERT ... SELECT statements)
-- file_sync_events -> entity_type='file', entity_id=project_file_id
-- email_sync_events WHERE email_attachment_id IS NULL -> entity_type='email', entity_id=inbound_email_id
-- email_sync_events WHERE email_attachment_id IS NOT NULL -> entity_type='attachment', entity_id=email_attachment_id
-- drive_sync_events -> entity_type='drive', entity_id=drive_file_id

-- 6c: Unified trigger function (dispatches by entity_type to update the correct table)

-- 6d: Update all 9 claim RPCs to query gfs_sync_events

-- 6e: Drop old triggers, functions, tables
DROP TRIGGER IF EXISTS file_sync_events_trigger ON file_sync_events;
DROP TRIGGER IF EXISTS email_sync_events_trigger ON email_sync_events;
DROP TRIGGER IF EXISTS trg_update_drive_sync_status ON drive_sync_events;
DROP FUNCTION IF EXISTS update_project_file_sync_status();
DROP FUNCTION IF EXISTS update_inbound_email_sync_status();
DROP FUNCTION IF EXISTS update_drive_sync_status();
DROP TABLE file_sync_events;
DROP TABLE email_sync_events;
DROP TABLE drive_sync_events;
```

---

## 3. Test Data Requirements

### Tables and minimum seed rows:

| Table | Minimum Rows | Edge Cases |
|---|---|---|
| `project_file_search_stores` | 6 | 1 per store_type x access_level combo (file/email/drive x internal/external) |
| `project_files` | 8+ | One per gfs_sync_status value (pending, processing, synced, failed, excluded, pending_deletion, deleting, deleted). Include: one with deleted_at set, one with gfs_doc_id NULL, one with gfs_doc_id set |
| `project_file_versions` | 3+ | Rows WITH vestigial columns populated (gfs_sync_status, gfs_doc_id, store_sync_error, synced_to_store_at, deleted_from_store_at, sync_retry_count, sync_started_at) |
| `file_sync_events` | 5+ | Across event types: sync_started, sync_succeeded, sync_failed, deletion_started, deletion_succeeded |
| `inbound_emails` | 4+ | Various gfs_sync_status + sync_retry_count populated. Include: one classified+synced, one classified+failed, one with deleted_at |
| `email_attachments` | 4+ | gfs_sync_status in pending, synced, failed, excluded. Include: one with deleted_at set |
| `email_sync_events` | 3+ | Including one with email_attachment_id set |
| `drive_files` | 4+ | is_excluded=true + deleted_at=NULL, is_excluded=true + pending_deletion (bug #2), deleted_at set + pending (bug #3), gfs_sync_status='failed' (will become upload_failed) |
| `drive_sync_events` | 3+ | Across event types |

### Prerequisites:
- Need a real `project_id` from `projects` table
- Drive files need `drive_connections` and `drive_folder_scopes` parent rows
- Email attachments need `inbound_emails` parent rows
- File sync events need `project_files` parent rows

---

## 4. Current State

### Triggers (3 separate functions):

1. **`update_project_file_sync_status()`** -- defined in `20260211012420_allowlist_sync_state_transitions.sql`
   - HAS allowlist guards (`AND gfs_sync_status = ANY(allowed)`)
   - Maps sync_failed/sync_timed_out -> `failed`
   - Sets `deleted_at` on deletion_succeeded (no is_excluded check, but project_files doesn't have is_excluded yet)
   - Fires on INSERT to `file_sync_events`

2. **`update_inbound_email_sync_status()`** -- defined in same migration
   - HAS allowlist guards
   - Maps sync_failed/sync_timed_out -> `failed`
   - Dispatches to `email_attachments` if `email_attachment_id IS NOT NULL`, else to `inbound_emails`
   - Fires on INSERT to `email_sync_events`

3. **`update_drive_sync_status()`** -- latest definition in `20260220114520_wire_upload_failed_status.sql`
   - NO allowlist guards (bare UPDATE with no state check) -- **this is bug #1**
   - Maps sync_failed/sync_timed_out -> `upload_failed` (already standardized for drive)
   - Sets `deleted_at` on deletion_succeeded without checking `is_excluded` -- **this is bug #2**
   - Has drive-specific columns: `last_synced_at`, `force_sync_at`
   - Fires on INSERT to `drive_sync_events`

### Claim RPCs (9 functions, defined in `20260221175528_claim_pending_rpc_functions.sql`):

| Function | Entity | Missing `deleted_at IS NULL` | Counts | Status filter |
|---|---|---|---|---|
| `claim_pending_file_sync` | project_files | YES -- **bug #3** | sync_failed events | IN (pending, failed) |
| `claim_pending_file_deletion` | project_files | N/A (pending_deletion) | deletion_failed events | = pending_deletion |
| `claim_pending_email_sync` | inbound_emails | YES -- **bug #3** | sync_failed events (email_attachment_id IS NULL) | IN (pending, failed) + status=classified |
| `claim_pending_email_deletion` | inbound_emails | YES -- **bug #3** (less critical) | deletion_failed events | = pending_deletion |
| `claim_pending_attachment_sync` | email_attachments | YES -- **bug #3** | sync_failed events | IN (pending, failed) |
| `claim_pending_attachment_deletion` | email_attachments | N/A (pending_deletion) | deletion_failed events | = pending_deletion |
| `claim_pending_drive_download` | drive_files | NO (has it) | download_started since retry_reset_at | IN (pending, download_failed) + is_excluded=false |
| `claim_pending_drive_sync` | drive_files | NO (has it) | sync_started since retry_reset_at | IN (stored, upload_failed) + is_excluded=false |
| `claim_pending_drive_deletion` | drive_files | N/A (pending_deletion) | deletion_failed since retry_reset_at | = pending_deletion |

### Postgres ENUMs:

**`gfs_sync_status`** (current values in enum definition order):
`blocked`, `pending`, `processing`, `synced`, `failed`, `excluded`, `pending_deletion`, `deleting`, `deleted`, `downloading`, `stored`, `download_failed`, `upload_failed`

Note: `retry_exhausted` exists in the Python StrEnum but NOT in the Postgres enum.

**`gfs_sync_event_type`** (current values):
`sync_started`, `sync_succeeded`, `sync_failed`, `sync_timed_out`, `deletion_started`, `deletion_succeeded`, `deletion_failed`, `deletion_timed_out`, `sync_requested`, `deletion_requested`, `download_started`, `download_succeeded`, `download_failed`, `download_skipped`

### Python enums (`gfs_sync_types.py`):

**`GfsSyncStatus`**: BLOCKED, PENDING, DOWNLOADING, PROCESSING, STORED, SYNCED, FAILED, DOWNLOAD_FAILED, UPLOAD_FAILED, EXCLUDED, RETRY_EXHAUSTED, PENDING_DELETION, DELETING, DELETED

**`GfsSyncEventType`**: All 14 values matching Postgres enum.

Note: The Python enums include `RETRY_EXHAUSTED` which is NOT in the Postgres enum. The docstring says "Nothing references these yet" -- they were created as forward declarations.

### Event tables (3 separate):

| Table | FK Column(s) | triggered_by default | Extra columns |
|---|---|---|---|
| `file_sync_events` | project_file_id | None (drift #7) | -- |
| `email_sync_events` | inbound_email_id, email_attachment_id (nullable) | None (drift #7) | -- |
| `drive_sync_events` | drive_file_id | 'sync_worker' | -- |

### `count_stale_file_versions()`:

Latest definition (from `20260223214237`):
```sql
SELECT COUNT(*)::integer
FROM project_file_versions pfv
INNER JOIN project_files pf ON pfv.file_id = pf.id
WHERE pf.project_id = p_project_id
  AND pf.access_level = p_access_level
  AND pfv.gfs_sync_status = 'synced'
  AND pfv.gfs_doc_id IS NOT NULL
  AND pfv.id != pf.current_version_id;
```

**CRITICAL**: This function references `pfv.gfs_sync_status` and `pfv.gfs_doc_id` on `project_file_versions` -- exactly the columns being dropped in Step 3. Must be rewritten or dropped BEFORE the column drop.

---

## 5. Ordering Dependencies

```
Step 0 (Seed data)
  |
  v
Step 1 (Trigger/claim bug fixes) -- no deps beyond seed data
  |
  v
Step 2 (Add is_excluded to project_files) -- could technically run in parallel with Step 1
  |
  v
Step 3 (Drop vestigial columns, ENG-2664)
  |-- MUST rewrite count_stale_file_versions() first
  |-- MUST grep codebase for references first
  |-- MUST regenerate TypeScript types after
  |
  v
Step 4 (Python enum adoption) -- no SQL migration, but must come before Step 5
  |-- so the `GfsSyncStatus.FAILED` -> `GfsSyncStatus.UPLOAD_FAILED` rename is clean
  |
  v
Step 5 (Failure enum standardization, ENG-2666)
  |-- MUST come before Step 6 (so the unified trigger uses upload_failed from day 1)
  |-- Data migration: UPDATE existing 'failed' rows to 'upload_failed'
  |-- Claim RPCs: update WHERE clauses
  |
  v
Step 6 (Merge event tables, ENG-2665)
  |-- MUST come after Step 1 (unified trigger should include allowlist guards)
  |-- MUST come after Step 5 (unified trigger should use upload_failed)
  |-- All 9 claim RPCs get rewritten (query new table)
  |-- Python event insertion code changes
  |-- TypeScript types regenerated
  |
  v
Step 7 (Python helpers) -- no SQL migration
  |-- Should come after Step 6 (helpers insert into gfs_sync_events, not old tables)
  |
  v
Step 8 (Final verification)
```

Key ordering rationale:
- Step 5 before Step 6: The unified trigger should use `upload_failed` from day 1, not `failed`. If reversed, you'd write the unified trigger with `failed`, then immediately rewrite it.
- Step 4 before Step 5: Enum adoption makes the `failed` -> `upload_failed` change a single-point edit in `GfsSyncStatus`.
- Step 1 before Step 6: The unified trigger must include allowlist guards from inception.
- Step 3 before Step 6: Reduces noise -- vestigial columns are gone before the big merge.

---

## 6. Gotchas

### BLOCKER: `count_stale_file_versions()` references columns being dropped
The function queries `pfv.gfs_sync_status` and `pfv.gfs_doc_id` on `project_file_versions` -- both are being dropped in Step 3. The plan mentions grepping for references but doesn't explicitly call out this function as a required fix. The function is actively used by `admin_gfs_service.py` and `admin_gfs_repository.py`.

**Resolution options:**
1. Rewrite to use `project_files.gfs_sync_status` and `project_files.gfs_doc_id` instead (but the semantics change -- "stale versions" means versions that were individually synced but aren't current, which is a per-version concept).
2. Drop the function if stale version counting is no longer meaningful now that sync operates at the file level.
3. Keep it but with different columns (e.g., just check `pfv.id != pf.current_version_id` and `pf.gfs_doc_id IS NOT NULL`).

### Index cleanup on column drop
Dropping `gfs_sync_status` from `project_file_versions` will fail if indexes referencing it still exist. Must explicitly drop:
- `idx_project_file_versions_gfs_sync_status`
- `idx_project_file_versions_processing`
- `idx_project_file_versions_gfs_doc_id`

Using `DROP COLUMN IF EXISTS` will handle this automatically in Postgres (indexes on dropped columns are auto-dropped), but it's worth verifying.

### Python `GfsSyncStatus.FAILED` after Step 5
After Step 5, `failed` is no longer used in the database. But the Python enum still has `FAILED = "failed"`. Decision needed: remove it from the StrEnum (breaking if any code references it), or keep it as a historical/reserved value? The plan says to update Python code that references `failed` to use `upload_failed`, but doesn't say whether to remove the enum member.

### `retry_exhausted` in Python but not Postgres
`GfsSyncStatus.RETRY_EXHAUSTED = "retry_exhausted"` exists in the Python enum but not in the Postgres `gfs_sync_status` type. This is fine as long as nobody writes it to the DB, but it's a lurking inconsistency.

### Drive trigger trigger name mismatch
The original drive trigger is named `trg_update_drive_sync_status` (from `20260216090347`). The plan's Step 6e says `DROP TRIGGER IF EXISTS drive_sync_events_trigger ON drive_sync_events` -- wrong name. Must use the actual name `trg_update_drive_sync_status`.

### File/email trigger names
The file trigger is named `trg_update_project_file_sync_status` (created in older migration). The email trigger is named `trg_update_inbound_email_sync_status`. Step 6e must use the correct names when dropping.

### email_sync_events split in backfill
The backfill in Step 6b splits `email_sync_events` into two entity types based on `email_attachment_id IS NULL`. This is correct but must preserve the original `id` and `created_at` for both paths. The plan does this.

### RLS on new `gfs_sync_events` table
The plan doesn't mention RLS policies for the new `gfs_sync_events` table. The old `drive_sync_events` has RLS (service_role full access + project owner SELECT). `file_sync_events` and `email_sync_events` RLS status needs to be checked. Must add appropriate RLS to the unified table.

### Claim RPCs in Step 6d are massive
All 9 claim RPCs must be rewritten in Step 6 to query `gfs_sync_events` instead of the entity-specific event tables. Each is 40-80 lines of SQL. The migration file will be very large. Consider keeping each RPC as `CREATE OR REPLACE FUNCTION` to make the diff reviewable.

### `awaiting_confirmation` status in drive claims
The `admin_get_drive_connection_stats()` function counts `awaiting_confirmation` status for drive files. This status doesn't appear in the `gfs_sync_status` enum -- it may be set via application code directly. Need to verify this doesn't conflict with the unified trigger.

### `download_skipped` -> `synced` mapping in drive trigger
Drive trigger maps `download_skipped` -> `synced` with special `last_synced_at` update. The unified trigger must preserve this. The file/email triggers don't have download events, so the unified trigger's CASE must handle drive-only event types.

### TypeScript type regeneration
Steps 3 and 6 both require `bunx supabase gen types typescript --local > lib/supabase/database.types.ts`. Any TypeScript code referencing dropped columns or old table names will need fixing. The `database.types.ts` file is ~2600 lines.

### Transaction safety of backfill
Step 6's backfill (INSERT ... SELECT from 3 tables) and table drops happen in the same migration file. Supabase runs each migration in a transaction. If the backfill is large, this could be slow. For production, may need to split into separate migrations. For local dev, this is fine.

---

## 7. Linear Issue Details

### ENG-2030 (parent)
- Status: Backlog
- Covers all 12 drifts from March 2026 audit (table in description)
- 5 drifts resolved with "No action" (intentional differences): #8 claim ordering, #9 access_level expressions, #10 email preconditions, #11 storage_path locations, #12 drive two-stage pipeline
- 7 drifts require action: #1-3 bug fixes, #4-5 enum/retry standardization, #6 schema consistency, #7 triggered_by default
- Previous attempt (ENG-2035-2038) was reverted: extracted `sync_entity_to_gfs()` but added +65 net lines of indirection
- Sub-issues: ENG-2664 (vestigial columns), ENG-2665 (event table merge), ENG-2666 (failure enums), ENG-2667 (deferred abstractions)
- ENG-2035-2038 are marked Done (but were reverted)

### ENG-2664 (drop vestigial columns)
- Phase 1, "tender" -- verify nothing references columns before dropping
- Lists all 8 columns explicitly
- Calls out `count_stale_file_versions()` as "last known consumer"
- Requires: grep codebase, check admin queries/dashboards, check TypeScript types impact

### ENG-2665 (merge event tables)
- Phase 2, "heavy" -- data migration + trigger rewrite
- Schema for new table clearly defined
- Explicit note: "Depends on Phase 1 bug fixes (especially Drive allowlist guards -- the unified trigger should include them from day 1)"
- 5 migration sub-steps listed

### ENG-2666 (failure enums + retry counting)
- Phase 2, "tender" -- behavior change
- Two sub-problems: failure status naming and retry counting methodology
- Sequencing note: "Can be done before or after event table merge. If done after, touches 1 trigger. If done before, touches 3 triggers but the merge is simpler."
- Plan chose BEFORE (Step 5 before Step 6)

### ENG-2667 (deferred abstractions)
- Phase 3, explicitly "do NOT pursue yet"
- Lists 3 things NOT to do: unify claim RPCs, unify sync services beyond helpers, full orchestration wrapper
- Rationale: tried twice and reverted, different return types across RPCs, post-Vertex the natural unification point changes
- This issue serves as documentation of what NOT to do
