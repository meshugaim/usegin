# GFS Sync Unification — Regression Audit

**Auditor:** Claude (regression audit)
**Date:** 2026-03-12
**Scope:** Commits `3c34916d` through `365e7ada` (GFS Sync Unification, phases 1-11 + stale_count fix)

---

## Summary

The stale_count regression (already found and fixed in `12ccbd11`) was the most serious issue. The audit found **4 additional findings** ranging from a safety guard removal to minor cosmetic leftovers.

---

## Finding 1: `delete_stale_version()` lost its safety guard against deleting the current version

**Severity: REGRESSION**

**File:** `python-services/agent_api/admin_gfs_mutations.py` (line 218)

The old implementation had a safety check:

```python
# Verify this is NOT the current version (safety check)
if version_id == pf.get("current_version_id"):
    return {
        "success": False,
        "error": "Cannot delete current version - this is not a stale version",
    }
```

The new implementation queries `project_files` and fetches `current_version_id` but **never checks it**. The field is selected (`"id, gfs_doc_id, current_version_id"`) but the code jumps straight to deleting the GFS doc. This means an admin could accidentally call `delete_stale_version` with a file's own ID (now that `version_id` maps to `project_files.id`) and delete the active GFS document.

**Additionally:** The old code updated the DB row to `gfs_sync_status = 'deleted'` after successful GFS deletion. The new code does not update any DB state — it deletes the GFS doc and logs the action, leaving the `project_files` row still showing `gfs_sync_status = 'synced'` with a `gfs_doc_id` pointing to a deleted document. The corresponding test `test_delete_stale_version_updates_db_to_deleted_status` was deleted rather than migrated.

---

## Finding 2: Sync queue error messages hardcoded to `None`

**Severity: REGRESSION (minor)**

**File:** `python-services/agent_api/admin_gfs_repository.py` (line 284)

The sync queue (`get_sync_queue()`) now sets `error=None` for all items. Previously, `store_sync_error` was read from `project_file_versions`. While `store_sync_error` was dropped from `project_file_versions`, the error information IS available in `gfs_sync_events.error_message` (the most recent `sync_failed` event for the entity). The admin UI sync queue loses the ability to show *why* a file failed.

Similarly, `get_store_files()` in `admin_gfs_service.py` (line 389) sets `error=None` with the comment `# Error info not stored on project_files`. The data exists in `gfs_sync_events` but is not queried.

---

## Finding 3: UI lost granular error messages for failed/excluded files

**Severity: REGRESSION (minor, UX degradation)**

**Files:**
- `nextjs-app/app/projects/[projectId]/files/project-files-client.tsx` (line 402)
- `nextjs-app/components/project-file-manager.tsx` (lines 408-412)

The old UI showed specific error text from `file_version.store_sync_error`:
- Failed files: `"Sync failed: {error_message}"`
- Excluded files: `"Too large for AI search"` vs `"Unsupported file type"` (distinguished by `/too large/i` regex)

The new UI shows generic strings:
- Failed files: `"Sync failed"` (no reason)
- Excluded files: `"Unsupported file type"` or `"Not supported"` (always, even for too-large files)

The test at `nextjs-app/tests/unit/components/project-file-manager.test.tsx:410` has a comment acknowledging this: *"After dropping store_sync_error from project_file_versions (ENG-2664), the component can no longer distinguish 'too large' from 'unsupported'."*

This is an intentional simplification, but it is a user-visible functionality loss.

---

## Finding 4: Stale comment references `file_sync_events` in test docstring

**Severity: COSMETIC**

**File:** `python-services/tests/integration/db/test_claim_pending_rpcs.py` (line 270)

The docstring says `"sync_started event was inserted in file_sync_events"` but the code correctly inserts into `gfs_sync_events`. The helper function is also still named `insert_file_sync_events` though it operates on `gfs_sync_events`. Harmless but confusing.

---

## Finding 5: db-checks test still uses `count_stale_file_versions` as example input

**Severity: COSMETIC**

**File:** `tools/db-checks/src/extract/python.test.ts` (line 193)

The Python extractor test uses `count_stale_file_versions` as its example RPC call to extract. The function was dropped from the database. This is only a test input string (not a live query), so it still passes, but it tests parsing of a call that no longer exists in production code.

---

## Items Verified Clean

- **Old table references in live code:** `file_sync_events`, `email_sync_events`, `drive_sync_events` are NOT referenced in any `.py` or `.ts/.tsx` code (only in migrations, docs, research, and one stale comment).
- **Dropped column references:** `gfs_corpus_name`, `gfs_upload_started_at`, `gfs_upload_completed_at`, `gfs_sync_retry_count`, `pfv.gfs_sync_status`, `pfv.gfs_doc_id`, `store_sync_error` — no live code references.
- **RPC calls to dropped functions:** No `.rpc("count_stale_file_versions")` calls remain in Python.
- **Seed data file:** `supabase/seed/gfs-sync-test-data.sql` uses `gfs_sync_events` (new unified table) and does not reference any dropped tables. Would run cleanly.
- **`stale_count` regression:** Already fixed in `12ccbd11` — `count_stale_versions()` in `admin_gfs_health.py` properly queries `project_files` with join to `project_file_versions`.
- **TypeScript type changes:** `ProjectFile.file_version` still exists as an optional nested type for content metadata (size, type, path). Sync status reads now come from `file.gfs_sync_status` directly. Components updated correctly.
- **Test coverage:** Net -162 lines across test files, but this is primarily from removing tests for dual-table update patterns that no longer exist (e.g., `test_force_resync_file_updates_both_models`, `test_delete_stale_version_returns_error_when_trying_to_delete_current_version`). The removal of the safety-guard test (Finding 1) is a concern.
- **`STATUS_PRIORITY`** in `admin_gfs_models.py` uses display status `"failed"`, which is correct — `get_store_files()` maps `upload_failed` -> `"failed"` display status before sorting.
