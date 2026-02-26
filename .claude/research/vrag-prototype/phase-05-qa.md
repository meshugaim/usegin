# Phase 05: QA Report -- VRAG Prototype (ENG-2098)

**Date:** 2026-02-26
**Reviewer:** QA Agent (Claude Opus 4.6)
**Verdict:** **ITERATE** -- one functional bug, otherwise excellent

---

## Summary

The VRAG prototype is well-implemented, closely follows the spec, and achieves full isolation from production GFS. All 7 slices are present and structurally correct. One functional bug must be fixed before shipping.

---

## Checklist Results

### 1. DB Migration -- PASS

**File:** `/workspaces/test-mvp/supabase/migrations/20260226112339_vrag_prototype.sql`

- Schema `vrag_prototype` created with proper grants and default privileges
- 4 tables present: `corpora`, `files`, `file_versions`, `sync_events` -- all match spec exactly
- 2 RPCs: `claim_pending_file_sync`, `claim_pending_file_deletion` -- both `SECURITY DEFINER`, `FOR UPDATE ... SKIP LOCKED`, retry logic with `excluded` fallback
- Trigger `trg_vrag_update_sync_status` fires on `sync_events` INSERT, maps all 10 event types correctly
- Storage bucket `vrag-files` created (private, `ON CONFLICT DO NOTHING`)
- RLS enabled on all 4 tables (no user-facing policies, correct for admin-only prototype)
- `updated_at` triggers on `corpora` and `files` using `public.update_updated_at_column()`
- `supabase/config.toml` has `vrag_prototype` in exposed schemas: `schemas = ["public", "storage", "graphql_public", "vrag_prototype"]`
- **Migration applies cleanly** (`bunx supabase migration up` -- "Local database is up to date")

### 2. Python Services -- PASS

**Files in `/workspaces/test-mvp/python-services/agent_api/vrag/`:**

| Module | Exists | Key Verification |
|--------|--------|------------------|
| `__init__.py` | Yes | Docstring, marks package |
| `corpus_service.py` | Yes | `rag.create_corpus()`, `display_name=f"vrag-{project_id[:8]}"`, `.schema("vrag_prototype")` for all queries |
| `file_service.py` | Yes | `rag.upload_file()`, bare ID extraction via `.split("/")[-1]`, `int()` conversion, `NotFound` handling |
| `search_service.py` | Yes | Supabase pre-filter + `rag.retrieval_query()` with `rag_file_ids`, `response.contexts` null guard |
| `models.py` | Yes | All Pydantic models match spec |
| `routes.py` | Yes | 5 endpoints (search, corpus, files list, file delete, upload) |
| `sync_worker.py` | Yes | Poll-claim-process loop, env var gate, lifespan integration |

**VragCorpusService:** Correct `rag.create_corpus()` call with `display_name`. Lazy `vertexai.init()` with env var defaults. Schema-qualified insert into `corpora`.

**VragFileService:** Correct `rag.upload_file()` call. Bare numeric ID extraction: `response.name.split("/")[-1]` then `int()`. `google.api_core.exceptions.NotFound` handled gracefully for delete.

**VragSearchService:** Two-step flow: (1) corpus lookup, (2) pre-filter files by project/entity_type/access_level with `.is_("deleted_at", "null")` and `.not_.is_("rag_file_id", "null")`, (3) `rag.retrieval_query()` with `rag_file_ids` as strings. Null-safe: `if response.contexts and response.contexts.contexts`.

**Schema qualification:** Every Supabase call uses `.schema("vrag_prototype")` -- verified across all 4 service files plus routes.py plus sync_worker.py.

### 3. API Routes -- PASS (with one bug, see Issue #1)

**File:** `/workspaces/test-mvp/python-services/agent_api/vrag/routes.py`

- 5 endpoints present and correctly wired:
  - `POST /vrag/search` -- delegates to `VragSearchService.search()`
  - `POST /vrag/corpus` -- delegates to `VragCorpusService.ensure_corpus()`
  - `GET /vrag/files/{project_id}` -- joins with `file_versions`, schema-qualified
  - `DELETE /vrag/files/{file_id}` -- validates state, inserts `deletion_requested` event
  - `POST /vrag/upload` -- multipart, validates extension + size, upsert pattern
- Router registered on main app: `app.include_router(vrag_routes.router, prefix="/api", tags=["vrag"])`
- File list uses PostgREST foreign key join syntax: `file_versions!fk_vrag_files_current_version(version_number, size_bytes)` -- handles both list and dict join response shapes
- All endpoints wrapped in try/except, return structured error responses

### 4. Sync Worker -- PASS

**File:** `/workspaces/test-mvp/python-services/agent_api/vrag/sync_worker.py`

- Module-level `vrag_shutdown_event = asyncio.Event()` -- correct pattern
- `POLL_INTERVAL` configurable via `VRAG_SYNC_POLL_INTERVAL` env var (default 10s)
- Worker uses `run_in_executor` for blocking Vertex RAG calls -- correct async pattern
- `_claim_pending_sync()` uses `.schema("vrag_prototype").rpc("claim_pending_file_sync", ...)` -- critical schema-qualified RPC
- Sync flow: ensure corpus -> download from storage -> upload to RAG -> update file_versions -> insert sync_succeeded event -> cleanup old versions
- Deletion flow: delete from RAG -> insert deletion_succeeded event
- Error handling: catch per-file, insert `sync_failed`/`deletion_failed` events, never crash the worker
- Old version cleanup: queries non-current versions with `rag_file_resource_name`, deletes from RAG, marks `deleted_from_rag_at`
- Lifespan integration in `main.py`: `VRAG_SYNC_WORKER_ENABLED` env var gate, graceful shutdown via `vrag_shutdown_event.set()`
- Uses `"synced_at": "now()"` -- matches existing VAIS worker pattern, confirmed working

### 5. Frontend Pages -- PASS

**Admin pages at `/workspaces/test-mvp/nextjs-app/app/admin/rag/`:**

| Component | File | Verified |
|-----------|------|----------|
| Main page (server) | `app/admin/rag/page.tsx` | Auth + admin check, project fetch, back arrow to `/admin` |
| Search page (server) | `app/admin/rag/search/page.tsx` | Auth + admin check, `searchParams.project` pre-select |
| Client orchestrator | `components/admin/rag/rag-admin-client.tsx` | Project selector, conditional render of corpus + file manager, search link |
| Corpus status | `components/admin/rag/rag-corpus-status.tsx` | Fetch corpus info, "Create Corpus" button, loading/error states |
| File manager | `components/admin/rag/rag-file-manager.tsx` | Upload form (file input + entity type + access level), file table, polling (2s interval for in-progress statuses), delete button |
| Search panel | `components/admin/rag/rag-search-panel.tsx` | Query input, entity/access filters, top-K slider (1-100), chunk cards with score badges (green/yellow/red), collapsible debug section |

**Server actions:** `/workspaces/test-mvp/nextjs-app/app/actions/vrag.ts`
- 7 actions: `getVragProjects`, `getVragCorpus`, `createVragCorpus`, `getVragFiles`, `uploadVragFile`, `deleteVragFile`, `searchVrag`
- All wrapped in `Sentry.withServerActionInstrumentation()`
- Uses `getPythonApiUrl()` + `getSentryTraceHeaders()` for API calls
- `getVragProjects` uses `getSupabaseAdmin()` to query `public.projects` directly
- Upload correctly omits `Content-Type` header (browser sets multipart boundary)
- Mutations call `revalidatePath("/admin/rag")`

**Admin index:** `/admin` page has "RAG Prototype" card with correct href, icon, and gradient.

### 6. Isolation -- PASS

- **ZERO imports** from production GFS modules (`gfs`, `project_file`, `multi_store`, `sync_worker`)
- **ZERO references** to production tables (`project_files`, `gfs_stores`, `gfs_file_versions`)
- All Python code confined to `agent_api/vrag/`
- All frontend code confined to `app/admin/rag/`, `components/admin/rag/`, and `app/actions/vrag.ts`
- Database tables in isolated `vrag_prototype` schema
- Storage bucket `vrag-files` (separate from production `conversations` bucket)
- Only shared references: `public.gfs_sync_status` and `public.gfs_sync_event_type` ENUMs (intentional reuse per spec)

### 7. Build Check -- PASS

- `uv run ruff check agent_api/vrag/` -- **All checks passed!**
- `bun run typecheck` (tsgo --noEmit) -- **No errors** (zero output = clean)
- `bunx supabase migration up` -- **Already applied, no errors**

---

## Issues Found

### Issue #1 (Bug): Re-upload of synced file skips sync -- MUST FIX

**Location:** `/workspaces/test-mvp/python-services/agent_api/vrag/routes.py`, lines 298-301

**Problem:** When uploading a new version of an existing file that was previously synced (`sync_status = 'synced'`), the upload endpoint updates `current_version_id` but does NOT reset `sync_status` to `'pending'`. The worker's `claim_pending_file_sync` RPC only picks up files with `sync_status IN ('pending', 'failed')`. Result: the new version is stored in Supabase Storage but never uploaded to Vertex RAG.

**Root cause:** The spec comment says "file stays in pending status for worker to pick up" -- this is only true for newly created files (which get `DEFAULT 'pending'`). Re-uploads of existing synced files need an explicit status reset.

**Fix:** After the `current_version_id` update on line 299-301, also set `sync_status`:

```python
supabase.schema("vrag_prototype").from_("files").update(
    {"current_version_id": version_id, "sync_status": "pending"}
).eq("id", file_id).execute()
```

Alternatively, insert a `sync_requested` event into `sync_events` (the trigger would set the status to `pending`), which is more consistent with the event-sourced pattern. Either approach works.

**Severity:** Medium -- first upload works fine, re-upload silently fails to sync. Would be caught on first real use but confusing to debug.

---

## Items NOT Flagged (Considered and Dismissed)

1. **`"now()"` string in PostgREST updates** -- The existing VAIS worker (`agent_api/vais/sync_worker.py:207`) uses the same pattern and is proven in production. PostgREST accepts this.

2. **Frontend route path `app/admin/rag/`** vs spec's `app/(admin)/admin/rag/` -- All existing admin pages (`gfs`, `vais`, `drive`, etc.) use `app/admin/` without a `(admin)` route group. The implementation follows the actual codebase convention.

3. **Admin check uses `.single()` in page components** -- While CLAUDE.md discourages `.single()` for Python, these are Next.js pages using supabase-js where `.single()` throwing on 0 rows is the desired behavior (redirect to 404).

4. **No admin authorization check in Python routes** -- Per spec, all VRAG routes use service-role Supabase client. The admin gate happens in Next.js server actions (the only callers). This is consistent with the existing VAIS pattern.

---

## Verdict

**ITERATE** -- Fix Issue #1 (re-upload sync_status reset), then ship. The bug is a one-line fix. Everything else is solid: correct schema qualification, proper isolation, clean builds, well-structured code following established patterns.
