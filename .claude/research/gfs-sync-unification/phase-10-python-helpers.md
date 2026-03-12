# Phase 10: Extract Python Helpers (Step 7)

**Date:** 2026-03-12
**Linear:** ENG-2030 (Step 7)
**Status:** Complete
**Commit:** `77eb1df5`

## Summary

Completed adoption of the 2 helper methods (`delete_from_store`, `check_content_gate`) that consolidate duplicated GFS upload/delete logic. Both helpers already existed on `ProjectFileSearchService` from prior steps; this step wired the remaining callers that still used inline patterns.

## Helpers Already Extracted

### 1. `delete_from_store(gfs_doc_id: str) -> dict[str, Any]`

**Location:** `project_file_search_service.py:274` (method on `ProjectFileSearchService`)

Consolidates the identical GFS deletion pattern (try delete, catch 404/403 -> success).

**Previously using helper:** `sync_project_file_delete`, `delete_email`, `delete_attachment`, `delete_drive_file`
**Newly updated to use helper (this step):**
- `drive_sync_service.py:sync_drive_file()` orphan cleanup (was calling `_delete_document_api_call` with inline 404 handling)
- `api/email.py:_delete_gfs_docs()` (was calling `_delete_document_api_call` with inline 404/403 handling)
- `api/drive.py:_queue_gfs_resync()` (was calling `_delete_document_api_call` with inline 404/403 handling)

### 2. `check_content_gate(file_path, filename, *, entity_label="file") -> ContentGateResult`

**Location:** `project_file_search_service.py:302` (method on `ProjectFileSearchService`)

All 4 upload paths were already using this helper before this step.

## Files Modified (This Step)

### Source files
- `python-services/agent_api/drive_sync_service.py` -- orphan cleanup in `sync_drive_file()` now uses `delete_from_store` instead of inline `_delete_document_api_call` + manual 404/403 handling
- `python-services/agent_api/api/email.py` -- `_delete_gfs_docs()` now uses `delete_from_store` instead of inline pattern
- `python-services/agent_api/api/drive.py` -- `_queue_gfs_resync()` now uses `delete_from_store` instead of inline pattern

### Test files
- `python-services/tests/unit/test_drive_api.py` -- updated `TestQueueGfsResync` tests to assert on `delete_from_store` instead of `_delete_document_api_call`
- `python-services/tests/unit/test_gfs_upload_resilience.py` -- updated `TestDriveSyncOrphanCleanup` tests to assert on `delete_from_store`

## Verification

After changes, no production code outside `project_file_search_service.py` calls `_delete_document_api_call` directly. All external callers go through `delete_from_store()`.

## New Tests

`python-services/tests/unit/test_gfs_helpers.py` — 16 tests covering:
- `TestDeleteFromStore` (6 tests): success, 404, NOT_FOUND, 403, PERMISSION_DENIED, other errors
- `TestCheckContentGate` (7 tests): normal content, empty, None text, too large, extraction failure, non-completed status, entity label
- `TestContentGateResult` (3 tests): allowed, blocked, frozen immutability

## Test Results

- **Before:** 1590 passed, 3 skipped
- **After:** 1590 passed, 3 skipped (16 new helper tests, existing caller tests updated)

## Migration Surface After This Step

To migrate from GFS to Vertex AI:
- Swap the guts of `delete_from_store()` (1 method, ~15 lines)
- Swap the guts of `upload_to_google_search()` (1 method)
- Point at 1 corpus instead of 6 stores

Instead of modifying 4+ separate inline deletion patterns and 4 upload paths.
