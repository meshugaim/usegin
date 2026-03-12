# GFS Sync Unification — Phase 01 Review (Gotcha Verification)

Reviewer: Claude (automated)
Date: 2026-03-12

---

## Gotcha 1: `count_stale_file_versions()` references columns Step 3 plans to drop

**Verdict: CONFIRMED — real risk, must address before Step 3.**

The function `count_stale_file_versions()` was last defined in migration `20260223214237_rename_google_doc_id_to_gfs_doc_id.sql` (lines 17–30):

```sql
SELECT COUNT(*)::integer
FROM project_file_versions pfv
INNER JOIN project_files pf ON pfv.file_id = pf.id
WHERE pf.project_id = p_project_id
  AND pf.access_level = p_access_level
  AND pfv.gfs_sync_status = 'synced'    -- ← Step 3 drops this column
  AND pfv.gfs_doc_id IS NOT NULL         -- ← Step 3 drops this column
  AND pfv.id != pf.current_version_id;
```

Step 3 (`docs/plan/gfs-sync-unification.plan.md` lines 204–212) drops both `gfs_sync_status` and `gfs_doc_id` from `project_file_versions`. Dropping these columns will break `count_stale_file_versions()` at the SQL level.

**Active callers exist in Python:**
- `python-services/agent_api/admin_gfs_repository.py:255` — `count_stale_file_versions()` method calls the RPC
- `python-services/agent_api/admin_gfs_service.py:196` — calls the repository method
- `python-services/tests/unit/test_admin_gfs_repository.py:261,277` — two unit tests
- `nextjs-app/lib/supabase/database.types.ts:2260` — TypeScript types reference it

The plan does mention grepping for `count_stale_file_versions` before dropping columns (line 194), but it doesn't call out that the function itself must be `DROP FUNCTION`'d or rewritten first. If the implementor just greps for Python/TS references and forgets the SQL function body, the migration will fail at apply time.

**Required action:** Either drop the function in the Step 3 migration (and remove all Python callers), or rewrite it to not use the dropped columns.

---

## Gotcha 2: Plan uses wrong trigger names in drop statements

**Verdict: CONFIRMED — the plan's DROP TRIGGER names are wrong for all 3 triggers.**

The plan (Step 6e, lines 402–404) says:
```sql
DROP TRIGGER IF EXISTS file_sync_events_trigger ON file_sync_events;
DROP TRIGGER IF EXISTS email_sync_events_trigger ON email_sync_events;
DROP TRIGGER IF EXISTS drive_sync_events_trigger ON drive_sync_events;
```

The actual trigger names (from CREATE TRIGGER statements in migrations) are:

| Plan says | Actual name | Migration |
|-----------|-------------|-----------|
| `file_sync_events_trigger` | `trg_update_sync_status` | `20251217000001_content_sync_v2.sql:105` |
| `email_sync_events_trigger` | `trg_update_email_sync_status` | `20260202182249_email_gfs_sync.sql:91` |
| `drive_sync_events_trigger` | `trg_update_drive_sync_status` | `20260216090347_drive_integration.sql:154` |

All three are wrong. Using `DROP TRIGGER IF EXISTS` with the wrong names will silently succeed (due to `IF EXISTS`) and leave the old triggers in place. The old trigger functions would also survive since they're still referenced. This means after the migration:
- The old triggers would still fire on the old tables (which are being dropped, so this is actually moot — `DROP TABLE` cascades and drops triggers)
- But the `DROP FUNCTION` statements (lines 407–409) would fail because the triggers still reference them... except the tables are dropped first, which cascades.

**Revised assessment:** Since the plan drops the old tables immediately after (line 413–415), `DROP TABLE` cascades to remove the triggers automatically. So the wrong trigger names are cosmetically wrong but functionally harmless — the tables being dropped takes the triggers with them. The `DROP FUNCTION` calls at lines 407-409 will succeed because the referencing triggers are already gone (via table cascade).

However, the trigger names are still wrong and indicate copy-paste sloppiness. An implementor who follows the plan exactly won't get errors but might be confused when reviewing. The `DROP TRIGGER` lines are dead code given the subsequent `DROP TABLE`.

**Revised verdict: NUANCED — trigger names are wrong, but DROP TABLE CASCADE makes it harmless. The DROP TRIGGER statements are redundant.**

---

## Gotcha 3: RLS policies for the unified `gfs_sync_events` table not mentioned

**Verdict: CONFIRMED — real risk, must address.**

Grep for "RLS", "row level", or "policy" in the plan file returned zero matches.

The three existing event tables all have RLS enabled with policies:

**`file_sync_events`** (from `20251217000001_content_sync_v2.sql:114–144`):
- `ALTER TABLE file_sync_events ENABLE ROW LEVEL SECURITY`
- Service role full access (`auth.role() = 'service_role'`)
- Project members can SELECT (via `project_files` → `project_members` join)
- Authenticated users can INSERT (via same join)

**`email_sync_events`** (from `20260202182249_email_gfs_sync.sql:100–118`):
- `ALTER TABLE email_sync_events ENABLE ROW LEVEL SECURITY`
- Service role full access
- Project members can SELECT (via `inbound_emails` → `project_members` join)
- No INSERT policy for end users (service role only)

**`drive_sync_events`** (from `20260216090347_drive_integration.sql:265–281`):
- `ALTER TABLE drive_sync_events ENABLE ROW LEVEL SECURITY`
- Service role full access
- Project owners can SELECT (via `drive_files` → `is_project_owner()`)
- No INSERT/UPDATE/DELETE for end users

The plan's Step 6a (lines 326–347) creates the `gfs_sync_events` table and indexes but has **no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** and **no `CREATE POLICY`** statements. The `CLAUDE.md` for supabase explicitly requires RLS on every new table.

The unified table needs RLS policies that handle all 4 entity types. The SELECT policy will need to join through the appropriate entity table based on `entity_type` (file→project_files, email→inbound_emails, attachment→email_attachments→inbound_emails, drive→drive_files).

Also note: the existing policies are inconsistent (file events allow authenticated INSERT; email/drive events don't). The unified table should standardize on service-role-only writes, matching the newer convention.

---

## Gotcha 4: `GfsSyncStatus.RETRY_EXHAUSTED` exists in Python but not Postgres

**Verdict: FALSE ALARM — `retry_exhausted` exists in both.**

The Postgres enum was extended in migration `20260223211642_add_retry_exhausted_status.sql`:
```sql
ALTER TYPE gfs_sync_status ADD VALUE IF NOT EXISTS 'retry_exhausted';
```

And it's actively used in the RPCs (migration `20260223211952_wire_retry_exhausted_rpcs.sql`) — all 9 `claim_pending_*` functions write `'retry_exhausted'::gfs_sync_status`.

The Python enum (`python-services/agent_api/gfs_sync_types.py:35`) matches:
```python
RETRY_EXHAUSTED = "retry_exhausted"
```

Full Postgres enum values (across all migrations):
- Original (20260210193613): blocked, pending, processing, synced, failed, excluded, pending_deletion, deleting, deleted
- Added (20260217150838): awaiting_confirmation
- Added (20260220094941): downloading, stored, download_failed, upload_failed
- Added (20260223211642): retry_exhausted

All 14 Python enum values exist in the Postgres enum. No mismatch.
