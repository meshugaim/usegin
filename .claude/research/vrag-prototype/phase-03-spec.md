# Phase 03: VRAG Prototype Implementation Spec

**Date:** 2026-02-26
**Ticket:** ENG-2098
**Status:** Ready for implementation
**Design:** `phase-02-design.md` (this spec operationalizes it)

---

## Overview

Seven independently committable slices that build a Vertex RAG prototype.
Each slice lists exact file paths, what to build, and how to verify.

**Key architectural decisions baked in:**
- All DB tables in `vrag_prototype` schema (isolated from production)
- One Vertex RAG corpus per project (filtering via Supabase pre-filter + `rag_file_ids`)
- `rag_file_id` stored as BIGINT (bare numeric, NOT resource paths)
- Reuse existing `gfs_sync_status` and `gfs_sync_event_type` ENUMs
- supabase-py `.schema("vrag_prototype")` for all non-public schema queries (requires PostgREST exposure -- see Slice 1)
- `.schema("vrag_prototype").rpc(...)` for RPC calls in the `vrag_prototype` schema (verified: supabase-py `Client.schema()` returns a `SyncPostgrestClient` with `.rpc()` and `.from_()` methods)
- Worker gated on `VRAG_SYNC_WORKER_ENABLED` env var
- All UI at `/admin/rag` (admin-only, service-role Supabase client)

---

## Slice 1: DB Migration

### Files to Create

- `supabase/migrations/<timestamp>_vrag_prototype.sql`
  (Run `bunx supabase migration new vrag_prototype` to generate the timestamp. Paste the SQL below into the generated file.)

### What to Build

A single migration file that creates the entire `vrag_prototype` schema. Exact SQL follows.

```sql
-- Migration: VRAG prototype schema
-- Standalone Vertex RAG prototype tables. Zero coupling to production GFS tables.
-- Design: .claude/research/vrag-prototype/phase-02-design.md

-- =============================================================================
-- SCHEMA
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS vrag_prototype;

-- Grant usage to authenticated and service_role so PostgREST can route requests.
GRANT USAGE ON SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA vrag_prototype TO authenticated, service_role;

-- Ensure future tables also get the grants (prevents "permission denied" on new tables).
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON ROUTINES TO authenticated, service_role;

-- =============================================================================
-- TABLE: vrag_prototype.corpora
-- =============================================================================
-- One row per project. Maps project -> Vertex RAG corpus.

CREATE TABLE vrag_prototype.corpora (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    corpus_resource_name TEXT NOT NULL,
    corpus_display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT corpora_project_key UNIQUE(project_id)
);

CREATE INDEX idx_vrag_corpora_project ON vrag_prototype.corpora(project_id);

-- =============================================================================
-- TABLE: vrag_prototype.files
-- =============================================================================
-- File records. One per logical file per project.

CREATE TABLE vrag_prototype.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'email', 'email_attachment')),
    access_level TEXT NOT NULL CHECK (access_level IN ('internal', 'external')),
    current_version_id UUID,  -- FK added after file_versions table exists
    sync_status public.gfs_sync_status NOT NULL DEFAULT 'pending',
    rag_file_id BIGINT,
    rag_file_resource_name TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT files_project_entity_access_filename_key
        UNIQUE(project_id, entity_type, access_level, filename)
);

CREATE INDEX idx_vrag_files_project ON vrag_prototype.files(project_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_vrag_files_sync_status ON vrag_prototype.files(sync_status)
    WHERE sync_status IN ('pending', 'failed', 'pending_deletion');
CREATE INDEX idx_vrag_files_project_rag ON vrag_prototype.files(project_id, entity_type, access_level)
    WHERE deleted_at IS NULL AND rag_file_id IS NOT NULL;

-- =============================================================================
-- TABLE: vrag_prototype.file_versions
-- =============================================================================
-- Version tracking. Each upload creates a new version.

CREATE TABLE vrag_prototype.file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES vrag_prototype.files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT,
    size_bytes BIGINT,
    rag_file_id BIGINT,
    rag_file_resource_name TEXT,
    sync_error TEXT,
    synced_at TIMESTAMPTZ,
    deleted_from_rag_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT file_versions_file_version_key UNIQUE(file_id, version_number)
);

CREATE INDEX idx_vrag_file_versions_file ON vrag_prototype.file_versions(file_id);

-- Now add the FK from files.current_version_id -> file_versions.id
ALTER TABLE vrag_prototype.files
    ADD CONSTRAINT fk_vrag_files_current_version
    FOREIGN KEY (current_version_id) REFERENCES vrag_prototype.file_versions(id);

-- =============================================================================
-- TABLE: vrag_prototype.sync_events
-- =============================================================================
-- Event-sourced sync status tracking.

CREATE TABLE vrag_prototype.sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES vrag_prototype.files(id) ON DELETE CASCADE,
    event_type public.gfs_sync_event_type NOT NULL,
    error_message TEXT,
    rag_file_id BIGINT,
    rag_file_resource_name TEXT,
    triggered_by TEXT NOT NULL DEFAULT 'worker',
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vrag_sync_events_file ON vrag_prototype.sync_events(file_id);
CREATE INDEX idx_vrag_sync_events_created ON vrag_prototype.sync_events(created_at);

-- =============================================================================
-- TRIGGER: update_file_sync_status
-- =============================================================================
-- AFTER INSERT on sync_events -> denormalize status to files table.

CREATE OR REPLACE FUNCTION vrag_prototype.update_file_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vrag_prototype.files
    SET
        sync_status = CASE NEW.event_type
            WHEN 'sync_requested' THEN 'pending'::public.gfs_sync_status
            WHEN 'sync_started' THEN 'processing'::public.gfs_sync_status
            WHEN 'sync_succeeded' THEN 'synced'::public.gfs_sync_status
            WHEN 'sync_failed' THEN 'failed'::public.gfs_sync_status
            WHEN 'sync_timed_out' THEN 'failed'::public.gfs_sync_status
            WHEN 'deletion_requested' THEN 'pending_deletion'::public.gfs_sync_status
            WHEN 'deletion_started' THEN 'deleting'::public.gfs_sync_status
            WHEN 'deletion_succeeded' THEN 'deleted'::public.gfs_sync_status
            WHEN 'deletion_failed' THEN 'pending_deletion'::public.gfs_sync_status
            WHEN 'deletion_timed_out' THEN 'pending_deletion'::public.gfs_sync_status
        END,
        rag_file_id = COALESCE(NEW.rag_file_id, vrag_prototype.files.rag_file_id),
        rag_file_resource_name = COALESCE(NEW.rag_file_resource_name, vrag_prototype.files.rag_file_resource_name),
        updated_at = NOW()
    WHERE id = NEW.file_id;

    -- On deletion_succeeded, set deleted_at
    IF NEW.event_type = 'deletion_succeeded' THEN
        UPDATE vrag_prototype.files
        SET deleted_at = NOW()
        WHERE id = NEW.file_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vrag_update_sync_status
    AFTER INSERT ON vrag_prototype.sync_events
    FOR EACH ROW
    EXECUTE FUNCTION vrag_prototype.update_file_sync_status();

-- =============================================================================
-- RPC: claim_pending_file_sync
-- =============================================================================

CREATE OR REPLACE FUNCTION vrag_prototype.claim_pending_file_sync(
    p_max_retries INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    filename TEXT,
    entity_type TEXT,
    access_level TEXT,
    current_version_id UUID,
    storage_path TEXT,
    size_bytes BIGINT,
    version_created_at TIMESTAMPTZ
) AS $$
DECLARE
    r RECORD;
    v_failure_count INT;
BEGIN
    FOR r IN
        SELECT
            f.id,
            f.project_id,
            f.filename,
            f.entity_type,
            f.access_level,
            f.current_version_id,
            fv.storage_path,
            fv.size_bytes,
            fv.created_at AS version_created_at
        FROM vrag_prototype.files f
        LEFT JOIN vrag_prototype.file_versions fv ON fv.id = f.current_version_id
        WHERE f.sync_status IN ('pending'::public.gfs_sync_status, 'failed'::public.gfs_sync_status)
          AND f.deleted_at IS NULL
        ORDER BY f.created_at
        FOR UPDATE OF f SKIP LOCKED
    LOOP
        SELECT COUNT(*) INTO v_failure_count
        FROM vrag_prototype.sync_events se
        WHERE se.file_id = r.id
          AND se.event_type = 'sync_failed'::public.gfs_sync_event_type;

        IF v_failure_count >= p_max_retries THEN
            UPDATE vrag_prototype.files
            SET sync_status = 'excluded'::public.gfs_sync_status,
                updated_at = NOW()
            WHERE vrag_prototype.files.id = r.id;
            CONTINUE;
        END IF;

        INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
        VALUES (r.id, 'sync_started'::public.gfs_sync_event_type, 'worker');

        id := r.id;
        project_id := r.project_id;
        filename := r.filename;
        entity_type := r.entity_type;
        access_level := r.access_level;
        current_version_id := r.current_version_id;
        storage_path := r.storage_path;
        size_bytes := r.size_bytes;
        version_created_at := r.version_created_at;
        RETURN NEXT;
        RETURN;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: claim_pending_file_deletion
-- =============================================================================

CREATE OR REPLACE FUNCTION vrag_prototype.claim_pending_file_deletion(
    p_max_retries INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    rag_file_resource_name TEXT,
    current_version_id UUID,
    project_id UUID
) AS $$
DECLARE
    r RECORD;
    v_failure_count INT;
BEGIN
    FOR r IN
        SELECT f.id, f.rag_file_resource_name, f.current_version_id, f.project_id
        FROM vrag_prototype.files f
        WHERE f.sync_status = 'pending_deletion'::public.gfs_sync_status
        ORDER BY f.updated_at
        FOR UPDATE OF f SKIP LOCKED
    LOOP
        IF r.rag_file_resource_name IS NULL THEN
            INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
            VALUES (r.id, 'deletion_succeeded'::public.gfs_sync_event_type, 'worker');
            CONTINUE;
        END IF;

        SELECT COUNT(*) INTO v_failure_count
        FROM vrag_prototype.sync_events se
        WHERE se.file_id = r.id
          AND se.event_type = 'deletion_failed'::public.gfs_sync_event_type;

        IF v_failure_count >= p_max_retries THEN
            UPDATE vrag_prototype.files
            SET sync_status = 'excluded'::public.gfs_sync_status,
                updated_at = NOW()
            WHERE vrag_prototype.files.id = r.id;
            CONTINUE;
        END IF;

        INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
        VALUES (r.id, 'deletion_started'::public.gfs_sync_event_type, 'worker');

        id := r.id;
        rag_file_resource_name := r.rag_file_resource_name;
        current_version_id := r.current_version_id;
        project_id := r.project_id;
        RETURN NEXT;
        RETURN;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS: Admin-only prototype
-- =============================================================================
-- Enable RLS on all tables. Service-role bypasses RLS automatically.
-- No user-facing policies needed (all access is admin -> server actions -> service-role).

ALTER TABLE vrag_prototype.corpora ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.sync_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- updated_at triggers
-- =============================================================================

CREATE TRIGGER vrag_corpora_updated_at
    BEFORE UPDATE ON vrag_prototype.corpora
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER vrag_files_updated_at
    BEFORE UPDATE ON vrag_prototype.files
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================
-- Create the vrag-files bucket for file uploads.
-- Supabase Storage bucket creation via SQL insert.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vrag-files', 'vrag-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: service-role full access (RLS bypassed).
-- No user-facing storage policies (admin-only prototype).
```

### Files to Modify

- `supabase/config.toml` -- expose `vrag_prototype` schema to PostgREST

Add `"vrag_prototype"` to the `schemas` array so PostgREST can route `.schema("vrag_prototype")` queries:
```toml
schemas = ["public", "storage", "graphql_public", "vrag_prototype"]
```

**Why this is required:** supabase-py's `.schema("vrag_prototype")` sets the `Accept-Profile` / `Content-Profile` HTTP header, but PostgREST will reject requests for schemas not in its exposed list. Without this, all `.schema("vrag_prototype").from_()` and `.schema("vrag_prototype").rpc()` calls will fail with 404 or "schema not found".

**For hosted Supabase (staging/production):** The schema must also be exposed in the Supabase Dashboard under Settings > API > Exposed schemas. This is a manual step when promoting.

### Verification

```bash
bunx supabase migration up
```

Confirm:
1. `vrag_prototype` schema exists with 4 tables: `corpora`, `files`, `file_versions`, `sync_events`
2. Both RPC functions exist: `vrag_prototype.claim_pending_file_sync`, `vrag_prototype.claim_pending_file_deletion`
3. The trigger fires: insert a dummy `sync_events` row and confirm `files.sync_status` updates
4. Storage bucket `vrag-files` exists
5. PostgREST can route to the schema: `curl http://localhost:54321/rest/v1/rpc/claim_pending_file_sync -H "Accept-Profile: vrag_prototype" -H "apikey: <service_role_key>"` returns a valid response (empty array)

### Commit

```
feat(vrag): add vrag_prototype schema, tables, RPCs, and storage bucket
```

---

## Slice 2: Python Services (VragCorpusService + VragFileService)

### Files to Create

- `python-services/agent_api/vrag/__init__.py`
- `python-services/agent_api/vrag/corpus_service.py`
- `python-services/agent_api/vrag/file_service.py`

### What to Build

#### `__init__.py`

Empty or minimal. Just makes the directory a package.

#### `corpus_service.py` -- VragCorpusService

A service class that manages Vertex RAG corpora (one per project).

**Constructor:** Takes a supabase `Client` instance.

**Methods:**

1. `ensure_corpus(project_id: str) -> dict`
   - Check `vrag_prototype.corpora` for existing corpus for this project
   - If exists, return `{"corpus_resource_name": ..., "corpus_display_name": ..., "created": False}`
   - If not, call `rag.create_corpus(display_name=f"vrag-{project_id[:8]}")`
   - Insert into `vrag_prototype.corpora`
   - Return `{"corpus_resource_name": ..., "corpus_display_name": ..., "created": True}`

2. `get_corpus(project_id: str) -> dict | None`
   - Query `vrag_prototype.corpora` for this project
   - Return the row dict or None

**Critical implementation detail -- schema qualification:**

All Supabase queries MUST use `.schema("vrag_prototype")`:
```python
self.supabase.schema("vrag_prototype").from_("corpora").select("*").eq("project_id", project_id).execute()
```

**Critical implementation detail -- vertexai init:**

Call `vertexai.init()` at module level or in a lazy init pattern. Read `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` from env vars. Default location to `us-west1`.

#### `file_service.py` -- VragFileService

A service class that handles individual file operations against Vertex RAG.

**Constructor:** Takes a supabase `Client` instance.

**Methods:**

1. `upload_to_rag(corpus_resource_name: str, local_path: str, display_name: str) -> dict`
   - Call `rag.upload_file(corpus_name=corpus_resource_name, path=local_path, display_name=display_name)`
   - Extract bare numeric ID: `response.name.split("/")[-1]`
   - Return `{"rag_file_id": int(bare_id), "rag_file_resource_name": response.name}`

2. `delete_from_rag(rag_file_resource_name: str) -> bool`
   - Call `rag.delete_file(name=rag_file_resource_name)`
   - Handle `NOT_FOUND` errors gracefully (return True -- already deleted)
   - Return True on success, raise on unexpected errors

3. `download_from_storage(storage_path: str, temp_dir: str) -> str`
   - Download file from Supabase Storage `vrag-files` bucket to `temp_dir`
   - Return the local file path
   - Use `self.supabase.storage.from_("vrag-files").download(storage_path)`

### Files to Modify

None.

### Verification

Write a quick manual test script (do NOT commit it) that:
1. Creates a `VragCorpusService`, calls `ensure_corpus(some_project_id)` -- expect a corpus to be created in Vertex RAG and a row to appear in `vrag_prototype.corpora`
2. Creates a `VragFileService`, calls `upload_to_rag(corpus_name, "/path/to/test.txt", "test-display")` -- expect a rag_file_id back
3. Calls `delete_from_rag(resource_name)` -- expect True

OR: Write unit tests that mock the `vertexai.rag` calls and verify the Supabase query construction and response mapping.

### Commit

```
feat(vrag): add VragCorpusService and VragFileService
```

---

## Slice 3: Python Services (VragSearchService)

### Files to Create

- `python-services/agent_api/vrag/search_service.py`

### What to Build

#### `search_service.py` -- VragSearchService

A service class that performs Supabase pre-filter + Vertex RAG retrieval_query.

**Constructor:** Takes a supabase `Client` instance.

**Method:**

`search(project_id: str, query: str, entity_type: str | None, access_level: str | None, top_k: int = 10) -> dict`

**Flow:**

1. Look up corpus: `self.supabase.schema("vrag_prototype").from_("corpora").select("corpus_resource_name").eq("project_id", project_id).execute()`
   - If no corpus, return `{"chunks": [], "rag_file_ids_used": [], "error": "No corpus for this project"}`

2. Supabase pre-filter to get matching `rag_file_id`s:
   ```python
   q = self.supabase.schema("vrag_prototype").from_("files") \
       .select("rag_file_id, filename") \
       .eq("project_id", project_id) \
       .is_("deleted_at", "null") \
       .not_.is_("rag_file_id", "null")

   if entity_type:
       q = q.eq("entity_type", entity_type)
   if access_level:
       q = q.eq("access_level", access_level)

   files = q.execute()
   ```
   - If no matching files, return `{"chunks": [], "rag_file_ids_used": []}`

3. Build `rag_file_ids` list: `[str(f["rag_file_id"]) for f in files.data]`
   **Critical: must be strings of bare numeric IDs, NOT resource paths.**

4. Call Vertex RAG:
   ```python
   from vertexai import rag

   response = rag.retrieval_query(
       rag_resources=[
           rag.RagResource(
               rag_corpus=corpus_name,
               rag_file_ids=rag_file_ids,
           )
       ],
       text=query,
       rag_retrieval_config=rag.RagRetrievalConfig(top_k=top_k),
   )
   ```

5. Map response chunks:
   ```python
   chunks = []
   if response.contexts and response.contexts.contexts:
       for ctx in response.contexts.contexts:
           chunks.append({
               "text": ctx.text,
               "score": ctx.score,
               "source_display_name": ctx.source_display_name,
           })
   ```

6. Return `{"chunks": chunks, "rag_file_ids_used": rag_file_ids}`

**Important edge case:** `response.contexts` can be None if no relevant chunks found. Guard against it.

### Files to Modify

None.

### Verification

With a corpus that has files uploaded (from Slice 2 testing), call `search()` and verify:
1. Chunks are returned with text, score, and source_display_name
2. Filtering by entity_type correctly narrows the rag_file_ids
3. Empty project returns empty chunks (no error)

### Commit

```
feat(vrag): add VragSearchService with Supabase pre-filter
```

---

## Slice 4: API Routes

### Files to Create

- `python-services/agent_api/vrag/routes.py`
- `python-services/agent_api/vrag/models.py`

### Files to Modify

- `python-services/agent_api/main.py` -- register the new router

### What to Build

#### `models.py` -- Request/Response Pydantic Models

Define all request and response models. All models in one file for simplicity.

```python
from pydantic import BaseModel, Field

# --- Search ---
class VragSearchRequest(BaseModel):
    project_id: str = Field(..., description="Project UUID")
    query: str = Field(..., min_length=1, description="Search query text")
    entity_type: str | None = Field(None, description="Filter: 'file', 'email', 'email_attachment'")
    access_level: str | None = Field(None, description="Filter: 'internal' or 'external'")
    top_k: int = Field(default=10, ge=1, le=100, description="Max chunks to return")

class VragChunk(BaseModel):
    text: str
    score: float
    source_display_name: str

class VragSearchResponse(BaseModel):
    success: bool
    chunks: list[VragChunk] = []
    query: str = ""
    rag_file_ids_used: list[str] = []
    error: str | None = None

# --- Corpus ---
class VragCorpusRequest(BaseModel):
    project_id: str = Field(..., description="Project UUID")

class VragCorpusResponse(BaseModel):
    success: bool
    corpus_resource_name: str | None = None
    corpus_display_name: str | None = None
    created: bool = False
    error: str | None = None

# --- Files ---
class VragFileInfo(BaseModel):
    id: str
    filename: str
    entity_type: str
    access_level: str
    sync_status: str
    rag_file_id: str | None = None
    version_number: int | None = None
    size_bytes: int | None = None
    created_at: str
    updated_at: str

class VragFilesResponse(BaseModel):
    success: bool
    files: list[VragFileInfo] = []
    error: str | None = None

# --- Upload ---
class VragUploadResponse(BaseModel):
    success: bool
    file_id: str | None = None
    version_id: str | None = None
    message: str | None = None
    error: str | None = None

# --- Delete ---
class VragDeleteResponse(BaseModel):
    success: bool
    message: str | None = None
    error: str | None = None
```

#### `routes.py` -- FastAPI Router

A FastAPI `APIRouter` with prefix `/vrag` and 5 endpoints.

**Supabase client construction:** Each route creates its own service-role Supabase client:
```python
from supabase import create_client
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
```
This matches the pattern used in the existing sync worker (service-role, no user auth).

**Endpoints:**

1. **`POST /vrag/search`** -- Search files in a project's corpus
   - Request body: `VragSearchRequest`
   - Response: `VragSearchResponse`
   - Delegates to `VragSearchService.search()`
   - Wrap in try/except, return `success: false` with error message on failure

2. **`POST /vrag/corpus`** -- Create or get corpus for a project
   - Request body: `VragCorpusRequest`
   - Response: `VragCorpusResponse`
   - Delegates to `VragCorpusService.ensure_corpus()`

3. **`GET /vrag/files/{project_id}`** -- List files for a project
   - Path param: `project_id` (str)
   - Response: `VragFilesResponse`
   - Query `vrag_prototype.files` joined with `vrag_prototype.file_versions` (current version)
   - Filter `deleted_at IS NULL`
   - Map rows to `VragFileInfo` models

4. **`DELETE /vrag/files/{file_id}`** -- Mark file for deletion
   - Path param: `file_id` (str, UUID)
   - Response: `VragDeleteResponse`
   - Verify file exists, is not already deleted/deleting
   - Insert a `deletion_requested` event into `vrag_prototype.sync_events` (trigger updates status to `pending_deletion`)

5. **`POST /vrag/upload`** -- Upload a file
   - Multipart form: `file` (UploadFile), `project_id` (str), `entity_type` (str, default "file"), `access_level` (str, default "internal")
   - Response: `VragUploadResponse`
   - Validate file extension (`.txt`, `.pdf`, `.docx`, `.pptx`)
   - Validate file size (max 25MB)
   - Ensure corpus exists via `VragCorpusService.ensure_corpus()`
   - Find or create `vrag_prototype.files` row (upsert pattern: check for existing row with same project_id + entity_type + access_level + filename, if found increment version)
   - Upload to Supabase Storage `vrag-files` bucket at path `vrag/{project_id}/{file_id}/{version_id}.{ext}`
   - Create `vrag_prototype.file_versions` row
   - Update `current_version_id` on `vrag_prototype.files` (triggers sync via `files.sync_status` which is already `'pending'`)
   - Worker picks it up

#### `main.py` modification

Add these lines alongside the existing router registrations:

```python
from agent_api.vrag import routes as vrag_routes

app.include_router(vrag_routes.router, prefix="/api", tags=["vrag"])
```

### Verification

Start the Python API server. Use curl:

```bash
# Create corpus
curl -X POST http://localhost:8000/api/vrag/corpus \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<some-project-uuid>"}'

# Upload file
curl -X POST http://localhost:8000/api/vrag/upload \
  -F "file=@test.txt" \
  -F "project_id=<some-project-uuid>" \
  -F "entity_type=file" \
  -F "access_level=internal"

# List files
curl http://localhost:8000/api/vrag/files/<some-project-uuid>

# Delete file
curl -X DELETE http://localhost:8000/api/vrag/files/<file-uuid>

# Search (after sync completes)
curl -X POST http://localhost:8000/api/vrag/search \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<uuid>", "query": "test query", "top_k": 5}'
```

Confirm all return valid JSON with `success: true` (except search which needs synced files).

### Commit

```
feat(vrag): add FastAPI routes for corpus, upload, files, delete, search
```

---

## Slice 5: Sync Worker

### Files to Create

- `python-services/agent_api/vrag/sync_worker.py`

### Files to Modify

- `python-services/agent_api/main.py` -- add VRAG worker to lifespan

### What to Build

#### `sync_worker.py` -- VragSyncWorker

A background worker that polls for pending sync and deletion work. Follow the existing `SyncWorker` pattern in `agent_api/sync_worker.py`.

**Class: VragSyncWorker**

**Configuration constants:**
- `POLL_INTERVAL = 10` (seconds, configurable via `VRAG_SYNC_POLL_INTERVAL` env var)
- `MAX_ITEMS_PER_CYCLE = 5`
- `MAX_RETRIES = 5`

**Module-level:**
- `vrag_shutdown_event = asyncio.Event()`
- Logger via `setup_module_logging("vrag-sync-worker", __name__)`

**Constructor:**
- Create service-role Supabase client
- Create `VragCorpusService` and `VragFileService` instances
- Initialize `vertexai` (project + location from env vars)

**Methods:**

1. `async run()` -- Main polling loop. While shutdown_event not set, call `_process_cycle()`, then `await asyncio.sleep(POLL_INTERVAL)`.

2. `async _process_cycle()` -- One cycle:
   - Process up to `MAX_ITEMS_PER_CYCLE` pending syncs
   - Process up to `MAX_ITEMS_PER_CYCLE` pending deletions

3. `_claim_pending_sync() -> dict | None` -- Call the RPC:
   ```python
   result = self.supabase.schema("vrag_prototype").rpc(
       "claim_pending_file_sync",
       {"p_max_retries": self.MAX_RETRIES}
   ).execute()
   return result.data[0] if result.data else None
   ```
   **This is the critical schema-qualified RPC call.** The function lives in `vrag_prototype` schema, NOT public.

4. `async _process_sync(claimed: dict)` -- Process one claimed file:
   a. Ensure corpus exists for claimed["project_id"]
   b. Download file from Supabase Storage to temp dir
   c. Upload to Vertex RAG via `file_service.upload_to_rag()`
   d. Update `file_versions` row: set `rag_file_id`, `rag_file_resource_name`, `synced_at`
   e. Insert `sync_succeeded` event (trigger denormalizes status to `files.sync_status`)
   f. Clean up old versions from Vertex RAG
   g. On error: insert `sync_failed` event with error message

5. `_claim_pending_deletion() -> dict | None` -- Call the deletion RPC (same schema-qualified pattern).

6. `async _process_deletion(claimed: dict)` -- Process one deletion:
   a. Call `file_service.delete_from_rag(claimed["rag_file_resource_name"])`
   b. Insert `deletion_succeeded` event
   c. On error: insert `deletion_failed` event

7. `_cleanup_old_versions(file_id: str, current_version_id: str)` -- Delete old synced versions from Vertex RAG.

8. `_insert_event(file_id, event_type, **kwargs)` -- Insert into `vrag_prototype.sync_events`:
   ```python
   self.supabase.schema("vrag_prototype").from_("sync_events").insert(data).execute()
   ```

**Top-level function:**
```python
async def run_vrag_sync_worker():
    """Entry point for lifespan integration."""
    worker = VragSyncWorker()
    await worker.run()
```

#### `main.py` modification

Add VRAG worker startup to the lifespan function, AFTER the existing GFS worker block:

```python
vrag_worker_task = None
if os.getenv("VRAG_SYNC_WORKER_ENABLED", "false").lower() == "true":
    from agent_api.vrag.sync_worker import run_vrag_sync_worker, vrag_shutdown_event

    vrag_worker_task = asyncio.create_task(run_vrag_sync_worker())
    logger.info("VRAG sync worker started")
```

And in the shutdown section:
```python
if vrag_worker_task:
    from agent_api.vrag.sync_worker import vrag_shutdown_event

    vrag_shutdown_event.set()
    await vrag_worker_task
    logger.info("VRAG sync worker stopped")
```

### Verification

1. Set `VRAG_SYNC_WORKER_ENABLED=true` in `.env`
2. Start the API server
3. Upload a file via the upload API route (Slice 4)
4. Watch logs for the VRAG sync worker picking up the file
5. Confirm `sync_status` transitions: `pending` -> `processing` -> `synced`
6. Confirm `rag_file_id` is populated on the files row
7. Delete the file, confirm `pending_deletion` -> `deleting` -> `deleted` transitions

### Commit

```
feat(vrag): add VragSyncWorker background task
```

---

## Slice 6: Admin File Management Pages

### Files to Create

- `nextjs-app/app/admin/rag/page.tsx`
- `nextjs-app/app/actions/vrag.ts`
- `nextjs-app/components/admin/rag/rag-file-manager.tsx`
- `nextjs-app/components/admin/rag/rag-corpus-status.tsx`

### Files to Modify

- `nextjs-app/app/admin/page.tsx` -- add entry to `adminPages` array

### What to Build

#### `admin/page.tsx` modification

Add to the `adminPages` array:
```ts
{
    title: "RAG Prototype",
    description: "Vertex RAG corpus management and search testing",
    href: "/admin/rag",
    icon: Search,  // import from lucide-react
    gradient: "from-violet-600 to-purple-600",
},
```

Add `Search` to the lucide-react import at the top.

#### `app/actions/vrag.ts` -- Server Actions

All actions use the admin-only service-role Supabase client (`getSupabaseAdmin()`). Each action:
1. Gets the admin client
2. Validates the caller is an admin (query `admins` table)
3. Performs the operation
4. Returns a typed result

**Actions to implement:**

1. `getVragProjects()` -- List all projects (for the project selector dropdown)
   - Query `public.projects` table, return `id` and `name`
   - Uses admin client directly (no schema override needed for public tables)

2. `getVragCorpus(projectId: string)` -- Get corpus info
   - Call Python API: `POST /api/vrag/corpus` with `{project_id}`
   - Return the response

3. `createVragCorpus(projectId: string)` -- Create corpus
   - Call Python API: `POST /api/vrag/corpus` with `{project_id}`
   - `revalidatePath("/admin/rag")`

4. `getVragFiles(projectId: string)` -- List files
   - Call Python API: `GET /api/vrag/files/{projectId}`
   - Return file list

5. `uploadVragFile(formData: FormData)` -- Upload file
   - Extract `projectId`, `file`, `entityType`, `accessLevel` from FormData
   - Forward as multipart to Python API: `POST /api/vrag/upload`
   - `revalidatePath("/admin/rag")`

6. `deleteVragFile(fileId: string)` -- Delete file
   - Call Python API: `DELETE /api/vrag/files/{fileId}`
   - `revalidatePath("/admin/rag")`

**Python API base URL:** Use `getPythonApiUrl()` from `@/lib/api-client` (already used by other admin actions like `project-drive.ts`). Import: `import { getPythonApiUrl, getSentryTraceHeaders } from "@/lib/api-client";`. Include `getSentryTraceHeaders()` in fetch calls for distributed tracing.

#### `app/admin/rag/page.tsx` -- Main Page

Server component. Follow the pattern from `app/admin/gfs/page.tsx`:
1. Auth check (redirect to /sign-in if not logged in)
2. Admin check (notFound if not admin)
3. Fetch initial data (projects list)
4. Render header with back arrow to `/admin`, violet/purple icon, title "RAG Prototype"
5. Render main content area with:
   - Project selector dropdown at the top
   - When a project is selected: `<RagCorpusStatus>` card + `<RagFileManager>` component
   - Link to `/admin/rag/search?project={selectedProjectId}`

The project selector and content below it should be a client component that manages state.

#### `components/admin/rag/rag-corpus-status.tsx` -- Corpus Info Card

Client component. Shows:
- Whether a corpus exists for the selected project
- If exists: corpus resource name, display name, creation date
- If not: "Create Corpus" button that calls `createVragCorpus`
- Loading state while checking/creating

#### `components/admin/rag/rag-file-manager.tsx` -- File Table + Upload

Client component. Adapted from `project-file-manager.tsx` patterns:

**Upload form:**
- File input (accept `.txt,.pdf,.docx,.pptx`)
- Entity type dropdown: `file`, `email`, `email_attachment`
- Access level dropdown: `internal`, `external`
- Upload button
- Calls `uploadVragFile` server action

**File table columns:**
- Filename
- Entity type
- Access level
- Sync status (reuse `GfsSyncStatusIcon` if compatible, or create a simple status badge)
- RAG file ID (show bare numeric ID)
- Version number
- Size
- Actions: Delete button

**Polling:**
- When any file has `sync_status` in `['pending', 'processing', 'pending_deletion', 'deleting']`, poll `getVragFiles` every 2 seconds via `useEffect` + `setInterval`
- Stop polling when all files are in terminal states

### Verification

1. Navigate to `/admin` -- "RAG Prototype" card should appear
2. Click it -- page loads with project selector
3. Select a project -- corpus status shows, file manager shows (empty)
4. Click "Create Corpus" -- corpus is created
5. Upload a `.txt` file -- row appears with `pending` status
6. After worker syncs -- status changes to `synced`, `rag_file_id` populated
7. Click delete -- status transitions through `pending_deletion` -> `deleted` -> row disappears

### Commit

```
feat(vrag): add admin RAG page with file management
```

---

## Slice 7: Admin Search Page

### Files to Create

- `nextjs-app/app/admin/rag/search/page.tsx`
- `nextjs-app/components/admin/rag/rag-search-panel.tsx`

### Files to Modify

- `nextjs-app/app/actions/vrag.ts` -- add `searchVrag` action

### What to Build

#### `app/actions/vrag.ts` modification

Add one new server action:

`searchVrag(projectId: string, query: string, options: { entityType?: string, accessLevel?: string, topK?: number })` -- Search files
   - Call Python API: `POST /api/vrag/search` with the request body
   - Return the full response (chunks + rag_file_ids_used)

#### `app/admin/rag/search/page.tsx` -- Search Page

Server component shell (auth + admin check), rendering the client-side search panel.

Read `project` from `searchParams` to pre-select the project in the panel.

Follow the same header pattern: back arrow to `/admin/rag`, title "RAG Search".

#### `components/admin/rag/rag-search-panel.tsx` -- Search Form + Results

Client component. This is the main interactive piece.

**Form inputs:**
- Project selector dropdown (same as the file management page)
- Query text input (required, min 1 char)
- Entity type dropdown: `all` (default, sends null), `file`, `email`, `email_attachment`
- Access level dropdown: `all` (default, sends null), `internal`, `external`
- Top-K slider: range 1-100, default 10, with numeric display
- Submit button

**Results display:**
- Header: "N chunks returned" count
- Debug section (collapsible): `rag_file_ids_used` array, displayed as a comma-separated list
- Chunk cards, each showing:
  - Score badge (e.g., `0.78`) with color coding (green > 0.7, yellow 0.5-0.7, red < 0.5)
  - Source display name
  - Chunk text content (in a scrollable pre/code block, max height ~200px)
- Error display if the search fails
- Loading state while searching

**Behavior:**
- On form submit, call `searchVrag` server action
- Display results below the form
- Maintain form state between searches (don't clear on submit)

### Verification

1. Navigate to `/admin/rag/search`
2. Select a project that has synced files
3. Enter a query, leave other fields at defaults
4. Submit -- chunks appear with scores and content
5. Change entity_type filter -- results narrow to matching files only
6. Adjust top_k slider -- result count changes accordingly
7. Search on a project with no corpus -- error message displayed gracefully

### Commit

```
feat(vrag): add admin RAG search page with chunk results display
```

---

## Cross-Cutting Concerns

### Schema Qualification (Critical)

Every Supabase call from Python that touches `vrag_prototype` tables MUST use `.schema("vrag_prototype")`:

```python
# Table queries
self.supabase.schema("vrag_prototype").from_("files").select("*").execute()

# RPC calls
self.supabase.schema("vrag_prototype").rpc("claim_pending_file_sync", params).execute()

# Inserts
self.supabase.schema("vrag_prototype").from_("sync_events").insert(data).execute()
```

Without `.schema("vrag_prototype")`, PostgREST defaults to the `public` schema and queries will fail with "relation not found" or silently return empty results.

The `public.gfs_sync_status` and `public.gfs_sync_event_type` ENUMs are referenced cross-schema by the column type definitions in the migration SQL -- no runtime schema prefix needed for enum values.

### File ID Format

Vertex RAG file IDs are bare numeric integers (e.g., `5641426399407997742`).
- Stored as `BIGINT` in Postgres
- Passed as `str` to `rag_file_ids` in `retrieval_query()` (SDK expects strings)
- Extracted from resource paths: `resource_name.split("/")[-1]`
- NEVER pass full resource paths to `rag_file_ids` -- causes `InvalidArgument` error

### Environment Variables

The following must be set for local development:

```bash
# In python-services/.env
VRAG_SYNC_WORKER_ENABLED=true
GOOGLE_CLOUD_PROJECT=effi-vertex-experiment
GOOGLE_CLOUD_LOCATION=us-west1
# GOOGLE_APPLICATION_CREDENTIALS or ADC must be configured
```

### Error Handling

All Python services should:
- Log errors with the `vrag-*` logger prefix
- Return structured error dicts (not raise) from service methods
- Let routes catch exceptions and return `{"success": false, "error": "..."}`
- Never crash the worker on individual file failures (catch + log + record event)

### No New Python Dependencies

`google-cloud-aiplatform>=1.136.0` is already in `pyproject.toml`. The `vertexai` module is part of it. No new packages needed.
