# Phase 05: QA Report

**Date:** 2026-02-26
**Status:** PASS (1 fix applied)

## Check Results

### 1. Python Checks -- ALL PASS

| Check | Result |
|-------|--------|
| `ruff check agent_api/vais/` | All checks passed |
| `ruff format --check agent_api/vais/` | 8 files already formatted |
| `ruff check agent_api/api/vais.py` | All checks passed |
| `ruff format --check agent_api/api/vais.py` | 1 file already formatted |
| `from agent_api.vais import config, types` | imports OK |
| `from agent_api.api.vais import router` | router OK |

### 2. Next.js Checks -- ALL PASS

| Check | Result |
|-------|--------|
| `bun run typecheck` (tsgo --noEmit) | Pass (no errors) |
| `bun run lint` (biome + eslint) | Pass (261 files checked, no fixes) |

### 3. Unit Tests -- ALL PASS

| Suite | Result |
|-------|--------|
| Python (`uv run pytest tests/unit/ -x -q`) | 1265 passed, 3 skipped |
| Next.js (`bun test` per-file) | All 4 test files pass (21 tests) |

Note: `bun test` (all files at once) hangs -- pre-existing issue, not VAIS-related.

### 4. Code Review

| Check | Result |
|-------|--------|
| Production GFS imports from VAIS module | **ZERO** -- fully standalone |
| Hardcoded secrets/credentials | **NONE** |
| Admin gating on all pages | **YES** -- all 3 page.tsx files check `admins` table + `notFound()` |
| Proxy route correctness | **YES** -- uses `getPythonApiUrl()`, forwards all methods + query params + body |
| Router registration | **YES** -- `app.include_router(vais.router, prefix="/api/vais")` in main.py |
| Migration SQL validity | **YES** -- references existing helper functions + tables |
| Sync worker gating | **YES** -- conditional on `VAIS_SYNC_ENABLED` env var |

## Fix Applied

### Migration: Unique constraint blocks re-upload after soft-delete

**File:** `supabase/migrations/20260226110953_vais_prototype.sql`

**Problem:** `CONSTRAINT vais_documents_project_file_key UNIQUE(project_id, file_name, access_level)` is a table-level constraint that includes soft-deleted rows (`deleted_at IS NOT NULL`). If a user deletes a document and re-uploads the same filename, the INSERT violates the constraint.

**Fix:** Replaced the table-level UNIQUE constraint with a partial unique index:
```sql
CREATE UNIQUE INDEX idx_vais_documents_project_file_key
    ON vais_documents(project_id, file_name, access_level)
    WHERE deleted_at IS NULL;
```

This only enforces uniqueness for active (non-deleted) rows, matching the soft-delete pattern.

## File Inventory

### Python (9 files)
- `python-services/agent_api/vais/__init__.py` -- package docstring
- `python-services/agent_api/vais/config.py` -- env vars, schema, path builders
- `python-services/agent_api/vais/types.py` -- Pydantic models, enums
- `python-services/agent_api/vais/store_service.py` -- DataStore + Engine lifecycle
- `python-services/agent_api/vais/schema_service.py` -- metadata schema management
- `python-services/agent_api/vais/document_service.py` -- upload (inline + GCS), delete, list
- `python-services/agent_api/vais/search_service.py` -- CHUNKS mode search + filter builder
- `python-services/agent_api/vais/sync_worker.py` -- background sync loop
- `python-services/agent_api/api/vais.py` -- FastAPI router (REST endpoints)

### Next.js (6 files)
- `nextjs-app/app/admin/vais/page.tsx` -- admin hub page
- `nextjs-app/app/admin/vais/search/page.tsx` -- search playground page
- `nextjs-app/app/admin/vais/search/vais-search-playground.tsx` -- search client component
- `nextjs-app/app/admin/vais/files/page.tsx` -- file manager page
- `nextjs-app/app/admin/vais/files/vais-file-manager.tsx` -- file manager client component
- `nextjs-app/app/api/vais/[...path]/route.ts` -- proxy route

### Database (1 file)
- `supabase/migrations/20260226110953_vais_prototype.sql` -- 4 tables, RLS, RPCs, triggers
