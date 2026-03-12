# Fix: Rewrite count_stale_file_versions() as SQL Function

**Issue:** ENG-2030
**Date:** 2026-03-12

## Problem

The `count_stale_file_versions()` SQL function was dropped in migration `20260312013616` because it referenced `pfv.gfs_sync_status` and `pfv.gfs_doc_id` — columns removed from `project_file_versions` when sync state moved to `project_files`.

Commit `12ccbd11` worked around this by adding `count_stale_versions()` to `StoreHealthService` in Python, which fetched all versions and counted in-memory. This works but is inefficient and doesn't belong in Python.

## Solution

### 1. New SQL Migration

Created `20260312095549_recreate_count_stale_file_versions.sql`:

```sql
CREATE OR REPLACE FUNCTION public.count_stale_file_versions(p_project_id uuid, p_access_level text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
    SELECT COUNT(*)::integer
    FROM project_file_versions pfv
    INNER JOIN project_files pf ON pfv.file_id = pf.id
    WHERE pf.project_id = p_project_id
      AND pf.access_level = p_access_level
      AND pf.gfs_doc_id IS NOT NULL
      AND pfv.id != pf.current_version_id
      AND pf.deleted_at IS NULL;
$$;
```

**Key differences from old function:**
- Old: `pfv.gfs_sync_status = 'synced' AND pfv.gfs_doc_id IS NOT NULL` (version-level sync)
- New: `pf.gfs_doc_id IS NOT NULL` (file-level sync — the current schema)
- Both: same signature `(p_project_id uuid, p_access_level text) RETURNS integer`
- Both: `LANGUAGE sql`, `STABLE`, `SET search_path = 'public'`

### 2. Python Changes

**`admin_gfs_repository.py`** — restored `count_stale_file_versions()` RPC method:
```python
def count_stale_file_versions(self, project_id, access_level) -> int:
    response = self.supabase.rpc(
        "count_stale_file_versions",
        {"p_project_id": project_id, "p_access_level": access_level},
    ).execute()
    return response.data or 0
```

**`admin_gfs_service.py`** — reverted from `health_service.count_stale_versions()` to `repository.count_stale_file_versions()`.

**`admin_gfs_health.py`** — removed `count_stale_versions()` method (Python workaround). Kept `detect_stale_versions()` which returns full detail objects for the file-level view.

### 3. Test Changes

- **`test_admin_gfs_repository.py`** — added 3 tests for the RPC method (returns count, returns 0, handles None)
- **`test_admin_gfs_service.py`** — updated `test_list_stores_populates_stale_count` to mock RPC instead of Python query chain; added RPC call assertion
- **`test_admin_gfs_health.py`** — removed `TestCountStaleVersions` class (5 tests for the deleted Python method)

### 4. Test Results

All 1594 Python unit tests pass. Ruff lint clean.

## Files Changed

- `supabase/migrations/20260312095549_recreate_count_stale_file_versions.sql` (new)
- `python-services/agent_api/admin_gfs_repository.py` (restored RPC method)
- `python-services/agent_api/admin_gfs_service.py` (use repository instead of health service)
- `python-services/agent_api/admin_gfs_health.py` (removed Python workaround)
- `python-services/tests/unit/test_admin_gfs_repository.py` (added RPC tests)
- `python-services/tests/unit/test_admin_gfs_service.py` (updated stale count test)
- `python-services/tests/unit/test_admin_gfs_health.py` (removed workaround tests)
