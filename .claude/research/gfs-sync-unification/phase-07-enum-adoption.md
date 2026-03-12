# Phase 07: Python Enum Adoption (Step 4)

**Date:** 2026-03-12
**Linear:** ENG-2030

## Summary

Replaced string literals with `GfsSyncStatus` and `GfsSyncEventType` enums across 4 sync service files.

## Files Modified

### 1. `python-services/agent_api/sync_worker.py`
- Already had `from agent_api.gfs_sync_types import GfsSyncEventType, GfsSyncStatus` import
- **File sync section** (process_pending_syncs, process_pending_deletions):
  - `"sync_failed"` -> `GfsSyncEventType.SYNC_FAILED` (3 occurrences)
  - `"sync_succeeded"` -> `GfsSyncEventType.SYNC_SUCCEEDED` (1 occurrence)
  - `"deletion_succeeded"` -> `GfsSyncEventType.DELETION_SUCCEEDED` (1 occurrence)
  - `"deletion_failed"` -> `GfsSyncEventType.DELETION_FAILED` (2 occurrences)
- **cleanup_timed_out** (project_files section):
  - `"processing"` -> `GfsSyncStatus.PROCESSING` (1 occurrence)
  - `"sync_started"` -> `GfsSyncEventType.SYNC_STARTED` (1 occurrence)
  - `"sync_timed_out"` -> `GfsSyncEventType.SYNC_TIMED_OUT` (1 occurrence)
  - `"deleting"` -> `GfsSyncStatus.DELETING` (1 occurrence)
  - `"deletion_started"` -> `GfsSyncEventType.DELETION_STARTED` (1 occurrence)
  - `"deletion_timed_out"` -> `GfsSyncEventType.DELETION_TIMED_OUT` (1 occurrence)
- **run_sync_worker** (pending count queries):
  - `["pending", "failed"]` -> `[GfsSyncStatus.PENDING, GfsSyncStatus.FAILED]` (1 occurrence)
  - `"pending_deletion"` -> `GfsSyncStatus.PENDING_DELETION` (1 occurrence)

**Note:** Email/attachment/drive sections already used enums (previous work).

### 2. `python-services/agent_api/email_sync_service.py`
- Added `from agent_api.gfs_sync_types import GfsSyncStatus`
- `{"gfs_sync_status": "excluded"}` -> `{"gfs_sync_status": GfsSyncStatus.EXCLUDED}` (4 occurrences in content gates for emails and attachments)

### 3. `python-services/agent_api/drive_sync_service.py`
- Added `from agent_api.gfs_sync_types import GfsSyncStatus`
- Content gate exclusions: `"excluded"` -> `GfsSyncStatus.EXCLUDED` (3 occurrences)
- `"synced"` -> `GfsSyncStatus.SYNCED` (1 occurrence in sync_drive_file success path)
- `"upload_failed"` -> `GfsSyncStatus.UPLOAD_FAILED` (1 occurrence in sync_drive_file error path)
- `"deleted"` -> `GfsSyncStatus.DELETED` (1 occurrence in delete_drive_file)

### 4. `python-services/agent_api/project_file_search_service.py`
- Added `from agent_api.gfs_sync_types import GfsSyncStatus`
- `"synced"` -> `GfsSyncStatus.SYNCED` (1 occurrence in _cleanup_old_versions)

## Intentionally NOT Changed

- `"awaiting_confirmation"` in `drive_sync_service.py` line 697 -- this status is not in the `GfsSyncStatus` enum. It's a drive-specific value that exists in the Postgres enum but was not added to the Python enum.
- `"operation": "excluded"` values in return dicts -- these are internal return markers, not database status values.
- String literals in `api/drive.py`, `api/email.py`, `admin_gfs_mutations.py`, `admin_gfs_reconciliation.py` -- these are outside the 4-file scope of Step 4.

## Enum Serialization

`GfsSyncStatus` and `GfsSyncEventType` are `StrEnum` subclasses. When used as values in Supabase update/insert dicts, they serialize as their string value automatically (e.g., `GfsSyncStatus.SYNCED == "synced"`). No special handling needed.

## Verification

- **Baseline tests:** All pass (1420 tests, 3 skipped)
- **Post-change tests:** All pass (same count)
- **Ruff check:** Clean
- **Ruff format:** Applied to 2 files (drive_sync_service.py, email_sync_service.py)

## Literal Count

| File | Literals replaced |
|------|------------------|
| sync_worker.py | 15 |
| email_sync_service.py | 4 |
| drive_sync_service.py | 8 |
| project_file_search_service.py | 1 |
| **Total** | **28** |
