# Fix Stale Count in Admin Health Summary (ENG-2030)

## Problem

`admin_gfs_service.py` line 196 had `stale_count = 0  # Versions no longer track sync; concept removed` — a hardcoded zero introduced when vestigial sync columns were dropped from `project_file_versions`. This meant the admin health summary always reported 0 stale versions, even when stale versions existed.

## What "Stale Version" Means (New Schema)

A stale version is a row in `project_file_versions` that is NOT the `current_version_id` of its parent `project_files` row, where the parent file has `gfs_doc_id` set (meaning something is synced to GFS). These are orphaned GFS references — old versions that should have been cleaned up when a newer version was synced.

## Solution

Added `StoreHealthService.count_stale_versions(project_id, access_level)` method in `admin_gfs_health.py`. This is the count-only equivalent of the existing `detect_stale_versions()` — same query pattern but returns an integer count instead of detailed `StoreFileInfo` objects. No `gfs_doc_map` parameter needed since we're counting DB-side staleness only.

### Query Pattern

```python
self.supabase.table("project_files")
    .select("id, current_version_id, project_file_versions!project_file_versions_file_id_fkey(id)")
    .eq("project_id", project_id)
    .eq("access_level", access_level)
    .eq("gfs_sync_status", "synced")
    .not_.is_("gfs_doc_id", "null")
    .is_("deleted_at", "null")
    .execute()
```

Then counts versions where `version["id"] != current_version_id`.

## Files Changed

1. **`python-services/agent_api/admin_gfs_health.py`** — Added `count_stale_versions()` method to `StoreHealthService`
2. **`python-services/agent_api/admin_gfs_service.py`** — Replaced `stale_count = 0` with call to `self.health_service.count_stale_versions()`
3. **`python-services/tests/unit/test_admin_gfs_health.py`** — Added `TestCountStaleVersions` class with 5 tests
4. **`python-services/tests/unit/test_admin_gfs_service.py`** — Added `test_list_stores_populates_stale_count` verifying non-zero stale count propagation

## Tests

- 5 unit tests for `count_stale_versions`: basic count, zero when current, multiple stale across files, empty response, None response
- 1 integration test for `list_stores`: verifies `stale_count` is non-zero and status is "unhealthy" when stale versions exist
- Full suite: 1596 passed, 3 skipped
