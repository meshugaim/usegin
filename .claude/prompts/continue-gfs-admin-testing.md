# Continue GFS Admin Dashboard Testing

## Session Status: Bugs Fixed, Awaiting User Verification

We're testing `/admin/gfs` with the user. Two bugs were fixed this session.

## Bugs Fixed This Session

### 1. Delete Store Route - FIXED
**File:** `python-services/agent_api/api/admin_gfs.py:127`

Store IDs contain `/` which broke routing:
```python
# Fixed: added :path to handle slashes in store_id
@router.delete("/admin/gfs/stores/{store_id:path}", ...)
```

### 2. Doc Count Mismatch - FIXED
**File:** `python-services/agent_api/admin_gfs_service.py:246-266`

Problem: Dashboard showed "Doc Mismatch" for all stores even when synced correctly.

Root cause: PostgREST join filters return ALL rows but set non-matching joins to `null`. The `count="exact"` counted everything.

Fix: Filter in Python instead:
```python
doc_count_supabase = sum(
    1 for row in (doc_response.data or []) if row.get("project_files")
)
```

## Current Test Data

- **Project:** `91b22ce6-99a5-4f93-9034-9ea9da33f595`
- **Internal store:** 2 docs synced
- **External store:** 1 doc synced
- **Admin user:** `owner@test.local` (in `admins` table)

## What's Verified Working

- [x] Page loads with admin auth
- [x] Stores tab displays stores
- [x] Sync Queue tab works
- [x] Run Reconcile detects orphans
- [x] Delete route fixed (proper 400 error for non-empty stores)
- [ ] **PENDING**: Doc count fix - user needs to refresh and confirm stores show "Healthy"

## Dev Servers Running

```bash
just dev
# Next.js: https://3000--019b1282-5cd8-73b0-9c55-056877369c23.eu-central-1-01.gitpod.dev
# Python API: port 8000
```

## Next Steps

1. **User verifies** doc count fix shows Healthy status for both stores
2. Test any other issues user finds
3. When done, commit fixes:
   - `python-services/agent_api/api/admin_gfs.py` (route fix)
   - `python-services/agent_api/admin_gfs_service.py` (doc count fix)

## Key Files

| File | Purpose |
|------|---------|
| `python-services/agent_api/admin_gfs_service.py` | Admin service - list_stores(), reconciliation |
| `python-services/agent_api/api/admin_gfs.py` | API routes |
| `nextjs-app/app/admin/gfs/page.tsx` | Dashboard page |
| `docs/gfs-hardening.impl-status.md` | Implementation status |
