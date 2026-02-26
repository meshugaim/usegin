# Phase 02: VRAG Prototype Architecture Design

**Date:** 2026-02-26
**Ticket:** ENG-2098
**Status:** Design complete

---

## Design Principles

1. **Standalone** -- zero coupling to production GFS tables. All VRAG tables live in the `vrag_prototype` Supabase schema. All Python code lives under `agent_api/vrag/`.
2. **Adapted to Vertex RAG** -- 1 corpus per project (not 4 stores), Supabase pre-filter + `rag_file_ids` (not metadata filtering), raw chunks (not Gemini-generated answers).
3. **Same UX surface** -- upload/version/delete files, search with entity_type/filter. Reuse `project-file-manager.tsx` patterns but with VRAG-specific server actions.
4. **Admin-only** -- all UI under `/admin/rag`, no production user flows.
5. **Small commits** -- design is sliceable into 7 increments (see section 8).

---

## 1. DB Schema (`vrag_prototype` Supabase schema)

All tables live in a separate `vrag_prototype` schema to avoid any collision with production GFS tables. The public schema's existing ENUM types (`gfs_sync_status`, `gfs_sync_event_type`) are reused since they perfectly model the same lifecycle.

### 1.1 ENUMs (reuse existing)

No new ENUMs needed. We reuse:
- `public.gfs_sync_status` -- `blocked`, `pending`, `processing`, `synced`, `failed`, `excluded`, `pending_deletion`, `deleting`, `deleted`
- `public.gfs_sync_event_type` -- `sync_started`, `sync_succeeded`, `sync_failed`, `sync_timed_out`, `deletion_started`, `deletion_succeeded`, `deletion_failed`, `deletion_timed_out`, `sync_requested`, `deletion_requested`

### 1.2 `vrag_prototype.corpora`

Maps project -> Vertex RAG corpus (1 corpus per project).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `project_id` | UUID FK -> `public.projects` | **UNIQUE** -- one corpus per project |
| `corpus_resource_name` | TEXT NOT NULL | Full Vertex RAG resource path (`projects/P/locations/L/ragCorpora/ID`) |
| `corpus_display_name` | TEXT NOT NULL | Human-readable name (e.g., `vrag-{project_id_short}`) |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

**Unique constraint:** `(project_id)` -- enforces 1 corpus per project.

**Index:** `UNIQUE idx_corpora_project_id ON (project_id)`

### 1.3 `vrag_prototype.files`

File records. Simpler than GFS `project_files` because we don't need `gfs_doc_id` (that's a GFS-specific concept). Instead we store `rag_file_id` (the bare numeric ID from Vertex RAG).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `project_id` | UUID FK -> `public.projects` | |
| `filename` | TEXT NOT NULL | Original filename |
| `entity_type` | TEXT NOT NULL | `'file'`, `'email'`, `'email_attachment'` -- for Supabase pre-filter |
| `access_level` | TEXT NOT NULL | `'internal'` or `'external'` -- for Supabase pre-filter |
| `current_version_id` | UUID FK -> `vrag_prototype.file_versions` | Points to latest version |
| `sync_status` | `public.gfs_sync_status` | File-level status (for deletion tracking). Default `'pending'` |
| `rag_file_id` | BIGINT | **Bare numeric ID** from Vertex RAG (e.g., `5641426399407997742`). NULL until sync succeeds. |
| `rag_file_resource_name` | TEXT | Full resource path (`projects/.../ragFiles/ID`). NULL until sync succeeds. |
| `deleted_at` | TIMESTAMPTZ | Soft delete (NULL = active) |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

**Unique constraint:** `(project_id, entity_type, access_level, filename)` -- one file per name per entity_type per access_level per project.

**Indexes:**
- `idx_files_project_id ON (project_id) WHERE deleted_at IS NULL` -- for listing
- `idx_files_sync_status ON (sync_status) WHERE sync_status IN ('pending', 'failed', 'pending_deletion')` -- for worker claim queries
- `idx_files_project_rag ON (project_id, entity_type, access_level) WHERE deleted_at IS NULL AND rag_file_id IS NOT NULL` -- for Supabase pre-filter queries

### 1.4 `vrag_prototype.file_versions`

Version tracking. Each upload creates a new version. Worker syncs the current version.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `file_id` | UUID FK -> `vrag_prototype.files` | |
| `version_number` | INTEGER NOT NULL | Auto-incrementing per file |
| `storage_path` | TEXT NOT NULL | Supabase Storage path |
| `file_type` | TEXT | Extension without dot |
| `size_bytes` | BIGINT | |
| `sync_status` | `public.gfs_sync_status` | Version-level sync status. Default `'pending'` |
| `rag_file_id` | BIGINT | Bare numeric ID for this version (may differ from file-level if re-upload) |
| `rag_file_resource_name` | TEXT | Full resource path for this version |
| `sync_error` | TEXT | Error message if sync failed |
| `synced_at` | TIMESTAMPTZ | When sync succeeded |
| `deleted_from_rag_at` | TIMESTAMPTZ | When old version was cleaned up |
| `created_at` | TIMESTAMPTZ | `now()` |

**Unique constraint:** `(file_id, version_number)`

**Index:** `idx_file_versions_sync_status ON (sync_status) WHERE sync_status = 'processing'`

### 1.5 `vrag_prototype.sync_events`

Event-sourced sync status tracking. Follows the exact GFS `file_sync_events` pattern.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `file_id` | UUID FK -> `vrag_prototype.files` | |
| `event_type` | `public.gfs_sync_event_type` | |
| `error_message` | TEXT | |
| `rag_file_id` | BIGINT | Populated on sync_succeeded |
| `rag_file_resource_name` | TEXT | Populated on sync_succeeded |
| `triggered_by` | TEXT | `'upload_api'`, `'worker'`, etc. |
| `duration_ms` | INTEGER | |
| `created_at` | TIMESTAMPTZ | `now()` |

### 1.6 Trigger: `trg_vrag_update_sync_status`

AFTER INSERT on `vrag_prototype.sync_events`. Auto-updates `vrag_prototype.files.sync_status` and `rag_file_id`.

```sql
CREATE OR REPLACE FUNCTION vrag_prototype.update_file_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vrag_prototype.files
    SET
        sync_status = CASE NEW.event_type
            WHEN 'sync_requested' THEN 'pending'::gfs_sync_status
            WHEN 'sync_started' THEN 'processing'::gfs_sync_status
            WHEN 'sync_succeeded' THEN 'synced'::gfs_sync_status
            WHEN 'sync_failed' THEN 'failed'::gfs_sync_status
            WHEN 'sync_timed_out' THEN 'failed'::gfs_sync_status
            WHEN 'deletion_requested' THEN 'pending_deletion'::gfs_sync_status
            WHEN 'deletion_started' THEN 'deleting'::gfs_sync_status
            WHEN 'deletion_succeeded' THEN 'deleted'::gfs_sync_status
            WHEN 'deletion_failed' THEN 'pending_deletion'::gfs_sync_status
            WHEN 'deletion_timed_out' THEN 'pending_deletion'::gfs_sync_status
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
```

### 1.7 RPC: `vrag_claim_pending_file_sync`

Follows the exact SKIP LOCKED pattern from GFS `claim_pending_file_sync`.

```sql
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
        WHERE f.sync_status IN ('pending'::gfs_sync_status, 'failed'::gfs_sync_status)
          AND f.deleted_at IS NULL
        ORDER BY f.created_at
        FOR UPDATE OF f SKIP LOCKED
    LOOP
        SELECT COUNT(*) INTO v_failure_count
        FROM vrag_prototype.sync_events se
        WHERE se.file_id = r.id
          AND se.event_type = 'sync_failed'::gfs_sync_event_type;

        IF v_failure_count >= p_max_retries THEN
            UPDATE vrag_prototype.files
            SET sync_status = 'excluded'::gfs_sync_status,
                updated_at = NOW()
            WHERE vrag_prototype.files.id = r.id;
            CONTINUE;
        END IF;

        INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
        VALUES (r.id, 'sync_started'::gfs_sync_event_type, 'worker');

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
$$ LANGUAGE plpgsql;
```

### 1.8 RPC: `vrag_claim_pending_file_deletion`

```sql
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
        WHERE f.sync_status = 'pending_deletion'::gfs_sync_status
        ORDER BY f.updated_at
        FOR UPDATE OF f SKIP LOCKED
    LOOP
        IF r.rag_file_resource_name IS NULL THEN
            INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
            VALUES (r.id, 'deletion_succeeded'::gfs_sync_event_type, 'worker');
            CONTINUE;
        END IF;

        SELECT COUNT(*) INTO v_failure_count
        FROM vrag_prototype.sync_events se
        WHERE se.file_id = r.id
          AND se.event_type = 'deletion_failed'::gfs_sync_event_type;

        IF v_failure_count >= p_max_retries THEN
            UPDATE vrag_prototype.files
            SET sync_status = 'excluded'::gfs_sync_status,
                updated_at = NOW()
            WHERE vrag_prototype.files.id = r.id;
            CONTINUE;
        END IF;

        INSERT INTO vrag_prototype.sync_events (file_id, event_type, triggered_by)
        VALUES (r.id, 'deletion_started'::gfs_sync_event_type, 'worker');

        id := r.id;
        rag_file_resource_name := r.rag_file_resource_name;
        current_version_id := r.current_version_id;
        project_id := r.project_id;
        RETURN NEXT;
        RETURN;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 1.9 RLS Policies

Admin-only prototype -- all tables use service-role access. No RLS needed for the prototype.

```sql
-- Disable RLS on all vrag_prototype tables (admin-only prototype)
ALTER TABLE vrag_prototype.corpora ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrag_prototype.sync_events ENABLE ROW LEVEL SECURITY;

-- Service-role full access (service_role bypasses RLS, so these are just for documentation)
-- No user-facing policies needed since all access is through admin UI -> server actions -> service-role client
```

### 1.10 Storage

- **Bucket:** `vrag-files` (new, separate from `user-files`)
- **Path format:** `vrag/{project_id}/{file_id}/{version_id}.{ext}`
- Simpler than GFS because we don't need org/workspace container nesting (admin-only prototype).

---

## 2. Python API Routes (FastAPI)

New router at `python-services/agent_api/api/vrag.py`, mounted as:
```python
app.include_router(vrag.router, prefix="/api", tags=["vrag"])
```

All routes prefixed with `/api/vrag/`.

### 2.1 `POST /api/vrag/search`

Search files in a project's Vertex RAG corpus with optional pre-filtering.

**Request:**
```python
class VragSearchRequest(BaseModel):
    project_id: str = Field(..., description="Project UUID")
    query: str = Field(..., min_length=1, description="Search query text")
    entity_type: str | None = Field(None, description="Filter: 'file', 'email', 'email_attachment'")
    access_level: str | None = Field(None, description="Filter: 'internal' or 'external'")
    top_k: int = Field(default=10, ge=1, le=100, description="Max chunks to return")
```

**Response:**
```python
class VragChunk(BaseModel):
    text: str
    score: float
    source_display_name: str
    source_file_id: str | None = None  # Resolved from display_name -> file mapping

class VragSearchResponse(BaseModel):
    success: bool
    chunks: list[VragChunk] = []
    query: str
    rag_file_ids_used: list[str] = []  # For debugging: which file IDs were passed to retrieval_query
    error: str | None = None
```

**Flow:**
1. Look up corpus for project in `vrag_prototype.corpora`
2. Supabase pre-filter: `SELECT rag_file_id FROM vrag_prototype.files WHERE project_id=? AND entity_type=? AND access_level=? AND rag_file_id IS NOT NULL AND deleted_at IS NULL`
3. If no matching files, return empty
4. Call `rag.retrieval_query(rag_resources=[RagResource(rag_corpus=corpus_name, rag_file_ids=[...])], text=query, rag_retrieval_config=RagRetrievalConfig(top_k=top_k))`
5. Map chunks back to file records via `display_name` -> `rag_file_resource_name` lookup
6. Return raw chunks

### 2.2 `POST /api/vrag/corpus`

Create or get the Vertex RAG corpus for a project.

**Request:**
```python
class VragCorpusRequest(BaseModel):
    project_id: str = Field(..., description="Project UUID")
```

**Response:**
```python
class VragCorpusResponse(BaseModel):
    success: bool
    corpus_resource_name: str | None = None
    corpus_display_name: str | None = None
    created: bool = False  # True if newly created, False if already existed
    error: str | None = None
```

**Flow:**
1. Check `vrag_prototype.corpora` for existing corpus
2. If exists, return it
3. If not, call `rag.create_corpus(display_name=f"vrag-{project_id[:8]}")` (~15s)
4. Insert into `vrag_prototype.corpora`
5. Return

### 2.3 `GET /api/vrag/files/{project_id}`

List all files for a project.

**Response:**
```python
class VragFileInfo(BaseModel):
    id: str
    filename: str
    entity_type: str
    access_level: str
    sync_status: str
    rag_file_id: str | None
    version_number: int
    size_bytes: int | None
    created_at: str
    updated_at: str

class VragFilesResponse(BaseModel):
    success: bool
    files: list[VragFileInfo] = []
    error: str | None = None
```

**Flow:**
1. Query `vrag_prototype.files` joined with `vrag_prototype.file_versions` (current version)
2. Filter `deleted_at IS NULL`
3. Return

### 2.4 `DELETE /api/vrag/files/{file_id}`

Mark a file for deletion.

**Response:**
```python
class VragDeleteResponse(BaseModel):
    success: bool
    message: str | None = None
    error: str | None = None
```

**Flow:**
1. Verify file exists and is not already deleted/deleting
2. Set `sync_status = 'pending_deletion'`
3. Worker handles actual Vertex RAG cleanup
4. Return

### 2.5 `POST /api/vrag/upload`

Upload a file to a project (creates DB record + stores in Supabase Storage).

**Request:** `multipart/form-data` with fields:
- `file` (UploadFile)
- `project_id` (str)
- `entity_type` (str, default `'file'`)
- `access_level` (str, default `'internal'`)

**Response:**
```python
class VragUploadResponse(BaseModel):
    success: bool
    file_id: str | None = None
    version_id: str | None = None
    message: str | None = None
    error: str | None = None
```

**Flow:**
1. Validate file type (`.txt`, `.pdf`, `.docx`, `.pptx` -- Vertex RAG supported formats)
2. Validate file size (25MB max)
3. Ensure corpus exists for project (lazy creation)
4. Find or create `vrag_prototype.files` row
5. Upload to Supabase Storage (`vrag-files` bucket)
6. Create `vrag_prototype.file_versions` row with `sync_status = 'pending'`
7. Update `current_version_id` on file record
8. Worker picks up pending file for Vertex RAG upload

---

## 3. Python Services

All services live under `python-services/agent_api/vrag/`.

### 3.1 Module Structure

```
python-services/agent_api/vrag/
    __init__.py
    corpus_service.py      # VragCorpusService
    file_service.py        # VragFileService
    search_service.py      # VragSearchService
    sync_worker.py         # VragSyncWorker
    models.py              # Shared Pydantic models
```

### 3.2 `VragCorpusService`

```python
class VragCorpusService:
    """Manage Vertex RAG corpora (one per project)."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def ensure_corpus(self, project_id: str) -> dict:
        """Get or create corpus for project. Returns {corpus_resource_name, corpus_display_name, created}."""
        # 1. Check DB
        result = self.supabase.schema("vrag_prototype").from_("corpora") \
            .select("*").eq("project_id", project_id).execute()
        if result.data:
            return {"corpus_resource_name": result.data[0]["corpus_resource_name"], "created": False}

        # 2. Create in Vertex RAG
        import vertexai
        from vertexai import rag
        vertexai.init(project=GOOGLE_CLOUD_PROJECT, location=GOOGLE_CLOUD_LOCATION)
        corpus = rag.create_corpus(display_name=f"vrag-{project_id[:8]}")

        # 3. Insert into DB
        self.supabase.schema("vrag_prototype").from_("corpora").insert({
            "project_id": project_id,
            "corpus_resource_name": corpus.name,
            "corpus_display_name": corpus.display_name,
        }).execute()

        return {"corpus_resource_name": corpus.name, "created": True}

    def get_corpus(self, project_id: str) -> dict | None:
        """Get corpus for project. Returns None if not exists."""
        ...

    def delete_corpus(self, project_id: str) -> bool:
        """Delete corpus from Vertex RAG and DB."""
        ...
```

### 3.3 `VragFileService`

```python
class VragFileService:
    """Upload/delete files in Vertex RAG corpus."""

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.corpus_service = VragCorpusService(supabase)

    def upload_to_rag(self, corpus_resource_name: str, local_path: str, display_name: str) -> dict:
        """Upload file to Vertex RAG corpus. Returns {rag_file_id, rag_file_resource_name}.

        display_name should be the version UUID for dedup tracking.
        rag.upload_file() is synchronous -- blocks until chunked + embedded.
        """
        from vertexai import rag
        response = rag.upload_file(
            corpus_name=corpus_resource_name,
            path=local_path,
            display_name=display_name,
        )
        resource_name = response.name
        bare_id = resource_name.split("/")[-1]  # CRITICAL: bare numeric ID only
        return {
            "rag_file_id": int(bare_id),
            "rag_file_resource_name": resource_name,
        }

    def delete_from_rag(self, rag_file_resource_name: str) -> bool:
        """Delete file from Vertex RAG. Returns True if deleted, False if not found."""
        from vertexai import rag
        try:
            rag.delete_file(name=rag_file_resource_name)
            return True
        except Exception as e:
            if "NOT_FOUND" in str(e):
                return True  # Already deleted, treat as success
            raise

    def download_from_storage(self, storage_path: str, temp_dir: str) -> str:
        """Download file from Supabase Storage to local temp dir."""
        ...
```

### 3.4 `VragSearchService`

```python
class VragSearchService:
    """Supabase pre-filter + Vertex RAG retrieval_query."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def search(
        self,
        project_id: str,
        query: str,
        entity_type: str | None = None,
        access_level: str | None = None,
        top_k: int = 10,
    ) -> dict:
        """Search with Supabase pre-filter -> rag_file_ids -> retrieval_query.

        Returns {chunks: [...], rag_file_ids_used: [...]}
        """
        # 1. Get corpus
        corpus = self.supabase.schema("vrag_prototype").from_("corpora") \
            .select("corpus_resource_name").eq("project_id", project_id).execute()
        if not corpus.data:
            return {"chunks": [], "rag_file_ids_used": [], "error": "No corpus for this project"}

        corpus_name = corpus.data[0]["corpus_resource_name"]

        # 2. Supabase pre-filter
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
        if not files.data:
            return {"chunks": [], "rag_file_ids_used": []}

        rag_file_ids = [str(f["rag_file_id"]) for f in files.data]

        # 3. Vertex RAG retrieval_query
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

        # 4. Map chunks
        chunks = []
        for ctx in response.contexts.contexts:
            chunks.append({
                "text": ctx.text,
                "score": ctx.score,
                "source_display_name": ctx.source_display_name,
            })

        return {"chunks": chunks, "rag_file_ids_used": rag_file_ids}
```

### 3.5 `VragSyncWorker`

Separate from the existing `SyncWorker`. Runs as its own background task in FastAPI lifespan, gated on a feature toggle or env var (`VRAG_SYNC_WORKER_ENABLED`).

```python
class VragSyncWorker:
    """Background worker for VRAG file sync operations."""

    POLL_INTERVAL = 10  # seconds
    MAX_ITEMS_PER_CYCLE = 5
    MAX_RETRIES = 5

    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        self.corpus_service = VragCorpusService(self.supabase)
        self.file_service = VragFileService(self.supabase)

    async def run(self):
        """Main polling loop."""
        while not shutdown_event.is_set():
            await self._process_cycle()
            await asyncio.sleep(self.POLL_INTERVAL)

    async def _process_cycle(self):
        """One cycle: claim + process pending syncs and deletions."""
        for _ in range(self.MAX_ITEMS_PER_CYCLE):
            claimed = self._claim_pending_sync()
            if not claimed:
                break
            await self._process_sync(claimed)

        for _ in range(self.MAX_ITEMS_PER_CYCLE):
            claimed = self._claim_pending_deletion()
            if not claimed:
                break
            await self._process_deletion(claimed)

    def _claim_pending_sync(self) -> dict | None:
        """Call vrag_prototype.claim_pending_file_sync RPC."""
        result = self.supabase.rpc("claim_pending_file_sync",
            params={"p_max_retries": self.MAX_RETRIES}
        ).execute()
        # Note: RPC is in vrag_prototype schema -- may need schema prefix
        return result.data[0] if result.data else None

    async def _process_sync(self, claimed: dict):
        """Download from Storage, upload to Vertex RAG, record result."""
        start = time.time()
        try:
            # 1. Ensure corpus exists
            corpus = self.corpus_service.ensure_corpus(claimed["project_id"])

            # 2. Download from Supabase Storage
            with tempfile.TemporaryDirectory() as temp_dir:
                local_path = self.file_service.download_from_storage(
                    claimed["storage_path"], temp_dir
                )

                # 3. Upload to Vertex RAG
                # display_name = version UUID for dedup
                result = self.file_service.upload_to_rag(
                    corpus_resource_name=corpus["corpus_resource_name"],
                    local_path=local_path,
                    display_name=str(claimed["current_version_id"]),
                )

            # 4. Update version record
            self.supabase.schema("vrag_prototype").from_("file_versions") \
                .update({
                    "sync_status": "synced",
                    "rag_file_id": result["rag_file_id"],
                    "rag_file_resource_name": result["rag_file_resource_name"],
                    "synced_at": datetime.now(UTC).isoformat(),
                }).eq("id", claimed["current_version_id"]).execute()

            # 5. Insert success event (trigger updates file-level status)
            duration_ms = int((time.time() - start) * 1000)
            self._insert_event(
                file_id=claimed["id"],
                event_type="sync_succeeded",
                rag_file_id=result["rag_file_id"],
                rag_file_resource_name=result["rag_file_resource_name"],
                duration_ms=duration_ms,
            )

            # 6. Clean up old versions from Vertex RAG
            self._cleanup_old_versions(claimed["id"], claimed["current_version_id"])

        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            self._insert_event(
                file_id=claimed["id"],
                event_type="sync_failed",
                error_message=str(e)[:500],
                duration_ms=duration_ms,
            )

    async def _process_deletion(self, claimed: dict):
        """Delete from Vertex RAG."""
        start = time.time()
        try:
            self.file_service.delete_from_rag(claimed["rag_file_resource_name"])

            duration_ms = int((time.time() - start) * 1000)
            self._insert_event(
                file_id=claimed["id"],
                event_type="deletion_succeeded",
                duration_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            self._insert_event(
                file_id=claimed["id"],
                event_type="deletion_failed",
                error_message=str(e)[:500],
                duration_ms=duration_ms,
            )

    def _cleanup_old_versions(self, file_id: str, current_version_id: str):
        """Delete old synced versions from Vertex RAG."""
        old_versions = self.supabase.schema("vrag_prototype").from_("file_versions") \
            .select("id, rag_file_resource_name") \
            .eq("file_id", file_id) \
            .neq("id", current_version_id) \
            .not_.is_("rag_file_resource_name", "null") \
            .is_("deleted_from_rag_at", "null") \
            .execute()

        for v in (old_versions.data or []):
            try:
                self.file_service.delete_from_rag(v["rag_file_resource_name"])
                self.supabase.schema("vrag_prototype").from_("file_versions") \
                    .update({"deleted_from_rag_at": datetime.now(UTC).isoformat()}) \
                    .eq("id", v["id"]).execute()
            except Exception as e:
                logger.warning(f"Failed to clean up old version {v['id']}: {e}")

    def _insert_event(self, file_id: str, event_type: str, **kwargs):
        """Insert a sync event. Trigger handles status denormalization."""
        data = {"file_id": file_id, "event_type": event_type, "triggered_by": "worker"}
        if kwargs.get("rag_file_id"):
            data["rag_file_id"] = kwargs["rag_file_id"]
        if kwargs.get("rag_file_resource_name"):
            data["rag_file_resource_name"] = kwargs["rag_file_resource_name"]
        if kwargs.get("error_message"):
            data["error_message"] = kwargs["error_message"]
        if kwargs.get("duration_ms") is not None:
            data["duration_ms"] = kwargs["duration_ms"]

        self.supabase.schema("vrag_prototype").from_("sync_events").insert(data).execute()
```

---

## 4. Next.js Frontend (Admin-only)

### 4.1 Page Structure

```
nextjs-app/app/admin/rag/
    page.tsx              # Main page: project selector + file list
    search/
        page.tsx          # Search UI
```

### 4.2 Admin Index Entry

Add to `nextjs-app/app/admin/page.tsx` `adminPages` array:
```ts
{
    title: "RAG Prototype",
    description: "Vertex RAG corpus management and search testing",
    href: "/admin/rag",
    icon: Search,  // from lucide-react
    gradient: "from-violet-600 to-purple-600",
},
```

### 4.3 `/admin/rag` Page

Server component. Follows the GFS admin page pattern.

**Layout:**
1. Header with back arrow to `/admin`, icon, title "RAG Prototype"
2. Project selector dropdown (fetches projects from `public.projects`)
3. When project selected:
   - "Corpus" section: shows corpus status (created / not created), "Create Corpus" button
   - "Files" section: file table (similar to `project-file-manager.tsx`)
     - Upload form (file + entity_type dropdown + access_level dropdown)
     - File table: filename, entity_type, access_level, sync_status, rag_file_id, version, size, actions (download, delete)
     - Polling: refresh when any file has pending/processing sync_status
   - "Search" link to `/admin/rag/search?project={id}`

### 4.4 `/admin/rag/search` Page

Client component for interactive search.

**Layout:**
1. Header with back to `/admin/rag`
2. Project selector (pre-filled from query param)
3. Search form:
   - Query text input
   - entity_type dropdown (all, file, email, email_attachment)
   - access_level dropdown (all, internal, external)
   - top_k slider (1-100, default 10)
   - Submit button
4. Results:
   - Number of chunks returned
   - `rag_file_ids_used` debug info (collapsible)
   - Chunk cards: score badge, source_display_name, text content (scrollable), page_span if present

### 4.5 Server Actions

New file: `nextjs-app/app/actions/vrag.ts`

```ts
"use server";

// All actions use admin-only service-role Supabase client
// (no user auth -- admin pages verify admin status in the page component)

export async function getVragProjects(): Promise<...> { ... }
export async function getVragCorpus(projectId: string): Promise<...> { ... }
export async function createVragCorpus(projectId: string): Promise<...> { ... }
export async function getVragFiles(projectId: string): Promise<...> { ... }
export async function uploadVragFile(projectId: string, formData: FormData): Promise<...> { ... }
export async function deleteVragFile(fileId: string): Promise<...> { ... }
export async function searchVrag(projectId: string, query: string, opts: ...): Promise<...> { ... }
```

**Upload action flow:**
1. Extract file, entity_type, access_level from FormData
2. Validate file type + size
3. Call Python API `POST /api/vrag/upload` (or do it directly via Supabase service-role client)
4. `revalidatePath("/admin/rag")`

**Search action flow:**
1. Call Python API `POST /api/vrag/search`
2. Return chunks

**Decision: Direct Supabase vs Python API for uploads**

For the prototype, the upload action writes to Supabase Storage and creates DB records directly using the service-role client (no Python API call needed for the DB write). The Python sync worker handles the Vertex RAG upload asynchronously. This matches the GFS pattern where the Next.js server action creates the DB record and the Python worker syncs to the search backend.

The search action calls the Python API because the Python service has the `vertexai` SDK and GCP credentials.

### 4.6 Components

```
nextjs-app/components/admin/rag/
    rag-file-manager.tsx     # File table + upload form (client component)
    rag-search-panel.tsx     # Search form + results (client component)
    rag-corpus-status.tsx    # Corpus info card (client component)
```

**`rag-file-manager.tsx`** is a simplified version of `project-file-manager.tsx`:
- Same upload form pattern (multi-file, sequential)
- Same sync status polling pattern (refresh every 1.5s when pending)
- Same sync status icons (reuse `GfsSyncStatusIcon`)
- Differences: entity_type dropdown in upload form, no internal/external tabs (entity_type/access_level are per-file dropdowns)

---

## 5. Sync Worker Integration

### 5.1 Lifespan Registration

The VRAG sync worker is started alongside the GFS sync worker in `main.py` lifespan, gated on an env var:

```python
# In lifespan()
vrag_worker_task = None
if os.getenv("VRAG_SYNC_WORKER_ENABLED", "false").lower() == "true":
    from agent_api.vrag.sync_worker import VragSyncWorker, vrag_shutdown_event
    vrag_worker = VragSyncWorker()
    vrag_worker_task = asyncio.create_task(vrag_worker.run())
    logger.info("VRAG sync worker started")
```

### 5.2 Sync Flow

```
Upload Flow:
  1. Admin UI uploads file via server action
  2. Server action: upload to Supabase Storage, create files + file_versions rows, sync_status='pending'
  3. VragSyncWorker polls: calls vrag_prototype.claim_pending_file_sync RPC
  4. RPC claims row (SKIP LOCKED), inserts sync_started event (trigger -> processing)
  5. Worker: downloads from Storage, calls rag.upload_file() (~5-55s)
  6. Worker: records rag_file_id on file_versions, inserts sync_succeeded event (trigger -> synced)
  7. Worker: cleans up old versions from Vertex RAG
  8. Admin UI: polling detects sync_status change, refreshes file list

Deletion Flow:
  1. Admin clicks delete -> server action sets sync_status='pending_deletion'
  2. VragSyncWorker polls: calls vrag_prototype.claim_pending_file_deletion RPC
  3. RPC claims row, inserts deletion_started event (trigger -> deleting)
  4. Worker: calls rag.delete_file() (fast, no force flag needed)
  5. Worker: inserts deletion_succeeded event (trigger -> deleted, sets deleted_at)
  6. Admin UI: file disappears from list (deleted_at IS NOT NULL filtered out)
```

### 5.3 Vertex RAG Init

The worker initializes `vertexai` once on startup:

```python
import vertexai
vertexai.init(
    project=os.environ["GOOGLE_CLOUD_PROJECT"],  # effi-vertex-experiment
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-west1"),
)
```

Environment variables needed:
- `GOOGLE_CLOUD_PROJECT` -- `effi-vertex-experiment`
- `GOOGLE_CLOUD_LOCATION` -- `us-west1` (avoid us-central1, us-east4)
- `GOOGLE_APPLICATION_CREDENTIALS` or ADC configured
- `VRAG_SYNC_WORKER_ENABLED` -- `true` to start the worker

---

## 6. Environment Configuration

### 6.1 New Environment Variables

| Variable | Value | Where |
|----------|-------|-------|
| `VRAG_SYNC_WORKER_ENABLED` | `true` / `false` | Python .env, Railway |
| `GOOGLE_CLOUD_PROJECT` | `effi-vertex-experiment` | Already exists |
| `GOOGLE_CLOUD_LOCATION` | `us-west1` | Already exists |

### 6.2 GCP Auth

Local dev: ADC via `gcloud auth application-default login` (already configured for experiments).
Railway: Service account JSON via `GOOGLE_APPLICATION_CREDENTIALS` env var (future, not needed for prototype which runs locally only).

---

## 7. Data Flow Diagram

```
                    Admin UI (/admin/rag)
                         |
              +----------+----------+
              |                     |
    Server Actions           Server Actions
    (Supabase direct)        (Python API call)
              |                     |
    +---------+---------+     +-----+-----+
    |                   |     |           |
    v                   v     v           |
  Supabase            Supabase   Python API   |
  Storage             DB (vrag_  /api/vrag/   |
  (vrag-files)        prototype  search       |
    ^                 schema)      |           |
    |                   ^     +----+----+     |
    |                   |     |         |     |
    +---+         +-----+    v         v     |
        |         |     Supabase    Vertex   |
        |         |     pre-filter  RAG      |
        |         |     (rag_file_  retrieval |
        |         |     ids query)  _query() |
        |         |                          |
    VragSyncWorker (Python background task)  |
        |         |                          |
        +---------+                          |
    1. claim RPC (SKIP LOCKED)               |
    2. download from Storage                 |
    3. rag.upload_file() -> rag_file_id      |
    4. insert sync_succeeded event           |
```

---

## 8. Implementation Slices

Designed for small, incremental commits.

### Slice 1: DB Migration
- Create `vrag_prototype` schema
- Create tables: corpora, files, file_versions, sync_events
- Create trigger function + trigger
- Create RPC functions (claim_pending_file_sync, claim_pending_file_deletion)
- Create `vrag-files` storage bucket
- **Verification:** `bunx supabase migration up` succeeds

### Slice 2: Python Services (Core)
- Create `agent_api/vrag/` module
- Implement `VragCorpusService` (create/get/delete corpus)
- Implement `VragFileService` (upload/delete from RAG, download from Storage)
- Implement `VragSearchService` (pre-filter + retrieval_query)
- Unit tests for service logic (mock Vertex RAG SDK calls)
- **Verification:** Unit tests pass

### Slice 3: Python API Routes
- Create `agent_api/api/vrag.py` router
- Implement all 5 routes (search, corpus, files, upload, delete)
- Register in `main.py`
- **Verification:** `curl` tests against local API

### Slice 4: Python Sync Worker
- Implement `VragSyncWorker` class
- Lifespan registration (gated on `VRAG_SYNC_WORKER_ENABLED`)
- **Verification:** Upload a file via API, watch worker sync it to Vertex RAG

### Slice 5: Next.js Admin Pages (Files)
- Create server actions (`app/actions/vrag.ts`)
- Create `/admin/rag` page with project selector + file manager
- Create `rag-file-manager.tsx` component
- Create `rag-corpus-status.tsx` component
- Add entry to admin index page
- **Verification:** Upload file in UI, see sync status update

### Slice 6: Next.js Search Page
- Create `/admin/rag/search` page
- Create `rag-search-panel.tsx` component
- Wire to Python API `POST /api/vrag/search`
- **Verification:** Upload file, wait for sync, search and see chunks

### Slice 7: Polish & Testing
- End-to-end flow testing
- Error handling edge cases (corpus creation failure, upload timeout, etc.)
- Sync status icons and messaging
- Clean up experiments corpus resources

---

## 9. Key Design Decisions

### 9.1 One Corpus Per Project (not per entity_type/access_level)
GFS uses 4 stores per project (internal_files, external_files, internal_email, external_email). VRAG uses 1 corpus per project. The filtering is done via Supabase pre-filter + `rag_file_ids`, not by store separation. This is simpler and validated by the ENG-2060 experiments (zero leakage, no performance penalty, no ID limit up to 1000).

### 9.2 Supabase Pre-Filter (not Vertex RAG metadata)
Vertex RAG metadata filtering is broken (proto exists but write path never indexes). The verified workaround is: query Supabase for matching `rag_file_id`s, pass them to `retrieval_query()`. This gives us full SQL filtering power (entity_type, access_level, any future fields) with zero Vertex RAG dependency.

### 9.3 `rag_file_id` as BIGINT (not TEXT)
Vertex RAG file IDs are large integers (e.g., `5641426399407997742`). Storing as BIGINT is type-safe and more efficient than TEXT. The SDK returns them as the last segment of the resource path string, so we parse with `resource_name.split("/")[-1]`.

### 9.4 Separate Schema (`vrag_prototype`)
Zero risk of collision with production GFS tables. Can be dropped entirely when the prototype is complete. Reuses existing ENUMs from public schema (no duplication).

### 9.5 Separate Storage Bucket (`vrag-files`)
Simple path structure (`vrag/{project_id}/{file_id}/{version_id}.{ext}`) without the org/workspace nesting that production `user-files` needs.

### 9.6 Reuse GFS Sync ENUMs
The `gfs_sync_status` and `gfs_sync_event_type` ENUMs model the exact same lifecycle. No reason to duplicate. The "gfs_" prefix is a misnomer for the prototype, but renaming would require migrating production tables.

### 9.7 Python Upload Route (not just server action)
The upload route handles file validation + Supabase Storage upload + DB record creation. This could be done entirely in the Next.js server action (as GFS does), but having a Python upload route keeps all VRAG logic in one place and makes it callable from scripts/tests without a browser.

### 9.8 Worker Gated on Env Var
`VRAG_SYNC_WORKER_ENABLED=true` starts the worker. Default is false, so production is unaffected. Local dev turns it on explicitly.
