# GFS Sync Unification: Python Test Restoration (ENG-2030)

## Summary

Restored 8 regressed test assertions across 3 Python test files and fixed 4 source files to make them pass. All 1603 unit tests pass (3 skipped).

## Findings Restored

### Finding 3: State transition event insertion test
- **File:** `test_project_file_search_sync.py`
- **Test:** `test_sync_project_file_upload_state_transitions` (parametrized: success + failure)
- **What:** Verifies `sync_project_file_upload` returns correct contract (success flag, gfs_doc_id on success, error on failure) that the sync worker depends on for event insertion

### Finding 4: Excluded file error persistence
- **File:** `test_project_file_search_sync.py`
- **Test:** `test_excluded_reason_persisted_to_sync_events`
- **What:** Verifies exclusion reason (char count + limit) is persisted to `gfs_sync_events.error_message`, not just returned ephemerally
- **Code fix:** `project_file_search_service.py` now inserts a sync event with error_message on exclusion
- **Code fix:** Content gate reason now includes limit: `"content too large (4000000 chars, limit 3000000)"`

### Finding 5: delete_stale_version current-version safety guard
- **File:** `test_admin_gfs_mutations.py`
- **Test:** `test_delete_stale_version_returns_error_when_trying_to_delete_current_version`
- **What:** Verifies you CANNOT delete the GFS doc for the current (active) version
- **Code fix:** `admin_gfs_mutations.py` now checks `version_id == current_version_id` and returns error

### Finding 6: DB update after GFS deletion
- **File:** `test_admin_gfs_mutations.py`
- **Test:** `test_delete_stale_version_updates_db_to_deleted_status`
- **What:** Verifies DB is updated (`gfs_doc_id=None, gfs_sync_status='deleted'`) after GFS doc removal
- **Code fix:** `admin_gfs_mutations.py` now calls `.update({"gfs_doc_id": None, "gfs_sync_status": "deleted"})` after deletion

### Finding 7: DB update failure handling
- **File:** `test_admin_gfs_mutations.py`
- **Test:** `test_delete_stale_version_handles_db_update_failure`
- **What:** Verifies error reporting when DB update fails after GFS deletion succeeds
- **Code fix:** Same `delete_stale_version` DB update block includes try/except

### Finding 8: DB update verification for excluded files
- **File:** `test_project_file_search_sync.py`
- **Test:** `test_sync_excluded_file_updates_db_status`
- **What:** Verifies DB is updated with `gfs_sync_status='excluded'` (not just return value)
- **Code fix:** `project_file_search_service.py` now updates `project_files.gfs_sync_status` to `'excluded'`, consistent with `email_sync_service` and `drive_sync_service`

### Finding 9: force_resync_file version-not-found error
- **File:** `test_admin_gfs_mutations.py`
- **Test:** `test_force_resync_file_returns_error_when_version_not_found`
- **What:** Verifies error when update affects 0 rows (nonexistent file)
- **Code fix:** `admin_gfs_mutations.py` now checks `result.data` after update and returns error on empty

### Finding 14: Sync queue error field from gfs_sync_events
- **File:** `test_admin_gfs_repository.py`
- **Test:** `test_get_sync_queue_populates_error_from_sync_events`
- **What:** Verifies `SyncQueueRecord.error` is populated from `gfs_sync_events.error_message`
- **Code fix:** `admin_gfs_repository.py` adds `_get_latest_errors()` method that batch-queries `gfs_sync_events` for failed file error messages

## Files Modified

### Tests (3 files, 8 new tests)
- `python-services/tests/unit/test_admin_gfs_mutations.py` — 4 tests added
- `python-services/tests/unit/test_project_file_search_sync.py` — 3 tests added
- `python-services/tests/unit/test_admin_gfs_repository.py` — 1 test added

### Source (3 files)
- `python-services/agent_api/admin_gfs_mutations.py` — safety guard, DB update, row-count check
- `python-services/agent_api/project_file_search_service.py` — excluded status persistence, sync event insertion, content gate reason improvement
- `python-services/agent_api/admin_gfs_repository.py` — error field from gfs_sync_events

## Test Results
- 1603 passed, 3 skipped, 0 failed
- ruff format: clean
- ruff check: clean
