# Phase 01: VAIS Prototype Research

Research date: 2026-02-26

## 1. VAIS SDK -- Document CRUD

### Sources
- `/workspaces/test-mvp/python-services/experiments/vais_reliability/setup_infra.py`
- `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2_single_file.py`
- `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2b_gcs_upload.py`
- `/workspaces/test-mvp/python-services/experiments/vertex_ai_search_experiment.py`
- `/workspaces/test-mvp/.claude/research/vertex-ai-search-reliability/whiteboard.md`
- `/workspaces/test-mvp/.claude/research/vertex-ai-search-reliability/phase-01-infra.md`
- `/workspaces/test-mvp/.claude/research/vertex-ai-search-reliability/phase-02-single-file.md`

### CREATE DataStore + Engine

SDK: `google-cloud-discoveryengine` v0.16.0, location=`global` (NOT regional).

**DataStore creation** via `DataStoreServiceClient.create_data_store()`:
```python
import google.cloud.discoveryengine_v1 as discoveryengine

client = discoveryengine.DataStoreServiceClient()
parent = f"projects/{PROJECT}/locations/global/collections/default_collection"

data_store = discoveryengine.DataStore(
    display_name="...",
    industry_vertical=discoveryengine.IndustryVertical.GENERIC,
    content_config=discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED,
    solution_types=[discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH],
    document_processing_config=discoveryengine.DocumentProcessingConfig(
        default_parsing_config=discoveryengine.DocumentProcessingConfig.ParsingConfig(
            layout_parsing_config=discoveryengine.DocumentProcessingConfig.ParsingConfig.LayoutParsingConfig(),
        ),
        chunking_config=discoveryengine.DocumentProcessingConfig.ChunkingConfig(
            layout_based_chunking_config=discoveryengine.DocumentProcessingConfig.ChunkingConfig.LayoutBasedChunkingConfig(
                chunk_size=500,
                include_ancestor_headings=True,
            ),
        ),
    ),
)

operation = client.create_data_store(parent=parent, data_store=data_store, data_store_id="my-store-id")
result = operation.result(timeout=120)  # LRO -- async, ~3s in experiments
```

**Engine creation** via `EngineServiceClient.create_engine()`:
```python
engine = discoveryengine.Engine(
    display_name="...",
    solution_type=discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH,
    search_engine_config=discoveryengine.Engine.SearchEngineConfig(
        search_tier=discoveryengine.SearchTier.SEARCH_TIER_ENTERPRISE,  # REQUIRED for chunk search
    ),
    data_store_ids=[data_store_id],
)

operation = client.create_engine(parent=parent, engine=engine, engine_id="my-engine-id")
result = operation.result(timeout=300)  # LRO -- async, ~1.7s in experiments
```

Key details:
- Both operations are LROs (Long Running Operations), but complete fast (~3s + ~1.7s).
- `SEARCH_TIER_ENTERPRISE` is **required** for chunk-based search.
- `CONTENT_REQUIRED` is used for the content_config.
- The Engine must reference the DataStore by ID.
- Both live under `collections/default_collection`.

### UPLOAD Documents with Metadata

Two upload paths tested:

**Path 1: Inline upload** (files < 1MB) via `ImportDocumentsRequest` with `InlineSource`:
```python
from google.protobuf.struct_pb2 import Struct

struct_data = Struct()
struct_data.fields["project_id"].string_value = "abc-123"
struct_data.fields["file_type"].string_value = "txt"

doc = discoveryengine.Document(
    id="my-doc-id",
    content=discoveryengine.Document.Content(
        raw_bytes=file_bytes,
        mime_type="text/plain",
    ),
    struct_data=struct_data,  # REQUIRED for CONTENT_REQUIRED datastores
)

request = discoveryengine.ImportDocumentsRequest(
    parent=f"{branch}",  # ...dataStores/{id}/branches/default_branch
    inline_source=discoveryengine.ImportDocumentsRequest.InlineSource(documents=[doc]),
    reconciliation_mode=discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
)

operation = client.import_documents(request=request)
result = operation.result(timeout=600)
```

**Path 2: GCS upload** (files > 1MB) via `ImportDocumentsRequest` with `GcsSource`:
```python
request = discoveryengine.ImportDocumentsRequest(
    parent=branch,
    gcs_source=discoveryengine.GcsSource(
        input_uris=[f"gs://{bucket}/{blob}"],
        data_schema="content",  # Each file becomes one document
    ),
    reconciliation_mode=discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
)
```

**Critical gotchas:**
- `struct_data` is **REQUIRED** even when `content.raw_bytes` is provided. Without it: `"Field 'document.data' is a required field"`.
- Inline upload has a **hard 1MB limit** on `raw_bytes`. Files > 1MB must go through GCS.
- All office formats (docx, pptx, xlsx) succeed in VAIS (unlike GFS where docx hangs).
- LROs complete in 5-10s and always report errors honestly (no hangs, no silent failures).

### DELETE Documents

```python
client = discoveryengine.DocumentServiceClient()
doc_name = f"{branch}/documents/{doc_id}"
client.delete_document(name=doc_name)
```

No force flag needed (unlike GFS which needs `DeleteDocumentConfig(force=True)` for chunked docs).

### SEARCH with Metadata Filters

Via `SearchServiceClient.search()` with `CHUNKS` mode:
```python
from google.cloud.discoveryengine_v1 import SearchRequest

serving_config = f"projects/{PROJECT}/locations/global/collections/default_collection/engines/{engine_id}/servingConfigs/default_search"

request = SearchRequest(
    serving_config=serving_config,
    query="search text",
    content_search_spec=SearchRequest.ContentSearchSpec(
        search_result_mode=SearchRequest.ContentSearchSpec.SearchResultMode.CHUNKS,
    ),
    filter="project_id: ANY(\"abc-123\")",  # metadata filter
)

response = client.search(request)
for result in response.results:
    chunk = result.chunk
    # chunk.content, chunk.relevance_score, chunk.name (contains doc ID path)
```

**Filter syntax (differs from GFS!):**
- Strings: `field: ANY("value")` -- NOT `field = "value"` (GFS style)
- Compound AND: `field1: ANY("v1") AND field2: ANY("v2")`
- OR: `field1: ANY("v1") OR field1: ANY("v2")`
- Numeric: `field >= 123`
- The `=` operator is NOT supported for strings. Must use `ANY()`.
- Filters only work on fields declared `indexable` in the schema.
- Query must be semantically relevant; generic queries return 0 results even with filters.
- In CHUNKS mode, `result.document` is None -- extract doc ID from `chunk.name` path: `.../documents/{doc_id}/chunks/{chunk_id}`.

### LIST Documents

```python
client = discoveryengine.DocumentServiceClient()
branch = f"projects/{PROJECT}/locations/global/collections/default_collection/dataStores/{data_store_id}/branches/default_branch"
docs = list(client.list_documents(parent=branch))
```

Also: chunk listing via v1alpha `ChunkServiceClient.list_chunks()`.

### Schema Setup (Metadata Indexing)

Must be configured BEFORE document upload for filtering to work.

```python
client = discoveryengine.SchemaServiceClient()
schema_name = f"projects/{PROJECT}/locations/global/collections/default_collection/dataStores/{data_store_id}/schemas/default_schema"

schema_definition = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "project_id": {"type": "string", "indexable": True, "retrievable": True},
        "file_type": {"type": "string", "indexable": True, "retrievable": True},
        "file_id": {"type": "string", "indexable": True, "retrievable": True},
    },
}

schema = discoveryengine.Schema(name=schema_name, json_schema=json.dumps(schema_definition))
operation = client.update_schema(
    discoveryengine.UpdateSchemaRequest(schema=schema, allow_missing=True)
)
result = operation.result(timeout=300)  # LRO, ~3s
```

**Key constraints:**
- Max 50 indexable fields.
- Mixed schemas work -- union schema covers all field types. Documents omit keys they don't have, filtering on absent keys silently excludes.
- Schema is an LRO that triggers re-indexing.
- Use `allow_missing=True` for initial creation.

### Performance Summary (from experiments)
| Operation | Latency |
|---|---|
| DataStore creation | ~3.3s |
| Engine creation | ~1.7s |
| Schema update | ~3.2s |
| Inline upload (< 1MB) | 5-10s |
| Search (CHUNKS mode) | avg ~600ms |
| Indexing (after upload) | ~270s for mixed schemas |

---

## 2. Current GFS Sync Worker

### Sources
- `/workspaces/test-mvp/python-services/agent_api/sync_worker.py` (1318 lines)
- `/workspaces/test-mvp/python-services/agent_api/gfs_sync_types.py`

### Worker Loop Architecture

The `SyncWorker` class runs as a FastAPI background task via lifespan. Main loop at `run_sync_worker()` (line 1163).

**Fixed-rate scheduling:** A new cycle spawns every `POLL_INTERVAL` (10s default) regardless of whether previous cycles finished. A semaphore bounds concurrency to `MAX_CONCURRENT_CYCLES` (5 default). Each cycle runs in a thread pool executor to avoid blocking the event loop.

**Configuration (env vars):**
- `SYNC_WORKER_POLL_INTERVAL`: 10s
- `GOOGLE_UPLOAD_TIMEOUT`: 120s
- `SYNC_WORKER_LOCK_TIMEOUT`: derived from upload timeout
- `SYNC_WORKER_MAX_RETRIES`: 5
- `SYNC_WORKER_MAX_ITEMS_PER_CYCLE`: 10
- `SYNC_WORKER_MAX_CONCURRENT_CYCLES`: 5

### Per-Cycle Work

Each cycle runs these operations sequentially (but cycles overlap via concurrency):
1. `process_pending_syncs()` -- file uploads to GFS
2. `process_pending_deletions()` -- file deletions from GFS
3. `process_pending_email_syncs()` -- email uploads to GFS
4. `process_pending_attachment_syncs()` -- attachment uploads to GFS
5. `process_pending_email_deletions()` -- email deletions from GFS
6. `process_pending_attachment_deletions()` -- attachment deletions from GFS
7. `cleanup_timed_out()` -- stale processing files
8. `cleanup_timed_out_emails()` -- stale processing emails
9. `cleanup_timed_out_attachments()` -- stale processing attachments
10. `process_drive_downloads()` -- Drive file downloads (Stage 1)
11. `process_pending_drive_syncs()` -- Drive file GFS uploads (Stage 2)
12. `process_pending_drive_deletions()` -- Drive file deletions from GFS
13. `cleanup_timed_out_drive_files()` -- stale processing Drive files
14. `cleanup_timed_out_drive_downloads()` -- stale downloading Drive files

### Claiming Work -- Atomic RPCs

All work claiming uses Supabase RPCs with `SKIP LOCKED` for atomic, non-contended claiming:
- `claim_pending_file_sync` -- claims one file with `gfs_sync_status IN ('pending', 'failed')`, atomically sets to `'processing'`, checks retry count, returns file row with storage_path.
- `claim_pending_file_deletion` -- same pattern for `gfs_sync_status = 'pending_deletion'`.
- `claim_pending_email_sync` / `claim_pending_email_deletion` / `claim_pending_attachment_sync` / etc.

### File Download from Supabase Storage

In `ProjectFileSearchService.download_file_from_storage()` (line 411):
```python
response = self.supabase.storage.from_("user-files").download(storage_path)
temp_file_path = temp_dir / file_name
with open(temp_file_path, "wb") as f:
    f.write(response)
```

### File Upload to GFS

In `ProjectFileSearchService.sync_project_file_upload()` (line 1139):
1. Read any known `gfs_doc_id` from previous attempt (dedup support).
2. Ensure project has a GFS store for the access_level via `ensure_project_store()`.
3. Create temp directory, download file from Supabase Storage.
4. **Content size gate (ENG-2063):** Extract text, check against `GFS_CONTENT_SIZE_LIMIT` (3M chars). If over, mark as `excluded`.
5. Build metadata via `to_custom_metadata(file_fields(...))`.
6. Upload to GFS via `upload_to_google_search()` with dedup-on-retry, `on_doc_id_available` callback for early persistence.
7. On success: update version status to `synced`, cleanup old versions.

### Error Handling and Retry

- `retry_with_exponential_backoff()` decorator on all Google API calls.
- Dedup-on-retry: checks for existing document before uploading (O(1) by doc_id, O(n) by display_name scan).
- 409 Duplicate: cleanup orphan + retry once.
- 400 "terminated": fallback to File API + import workaround.
- Timeout: configurable `GOOGLE_UPLOAD_TIMEOUT` (120s default), tiered polling (2s/4s/10s).
- `on_doc_id_available` callback persists GFS doc_id early to survive timeout crashes.

### Status State Machine

From `GfsSyncStatus` enum in `gfs_sync_types.py`:
```
pending -> processing -> synced (happy path)
pending -> processing -> failed (retryable)
pending -> processing -> excluded (content too large)
pending -> processing -> retry_exhausted (max retries)
synced -> pending_deletion -> deleting -> deleted (deletion path)
```

Full enum values: `blocked`, `pending`, `downloading`, `processing`, `stored`, `synced`, `failed`, `download_failed`, `upload_failed`, `excluded`, `retry_exhausted`, `pending_deletion`, `deleting`, `deleted`.

### REUSE vs NEW for VAIS Prototype

**REUSE (worker structure):**
- The entire `SyncWorker` class + `run_sync_worker()` loop architecture. Fixed-rate scheduling, semaphore concurrency, cycle-based processing.
- The `claim_pending_*` RPC pattern for atomic work claiming.
- The event-logging pattern (`_insert_event()` / `file_sync_events` table).
- The `GfsSyncStatus` / `GfsSyncEventType` enums (same lifecycle states).
- Download from Supabase Storage (`download_file_from_storage()`).
- Content size gating logic.
- Retry and timeout handling patterns.
- The `on_doc_id_available` early persistence pattern.

**NEW (VAIS-specific):**
- Replace `ProjectFileSearchService` GFS upload methods with VAIS `ImportDocumentsRequest`.
- Replace GFS store creation (`file_search_stores.create`) with VAIS `DataStoreServiceClient.create_data_store()` + `EngineServiceClient.create_engine()`.
- Replace GFS document deletion with VAIS `DocumentServiceClient.delete_document()`.
- Replace `genai.Client` (Gemini SDK) with `discoveryengine` SDK.
- Need new schema setup logic for VAIS metadata indexing.
- Different metadata format: VAIS uses `struct_data` (protobuf Struct) vs GFS `custom_metadata` list.
- Need to handle inline vs GCS upload path based on file size (1MB threshold).

---

## 3. Current DB Schema

### Sources
- `/workspaces/test-mvp/supabase/migrations/20251128000001_create_project_files.sql`

### Tables

#### `project_files`
```sql
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    access_level TEXT NOT NULL CHECK (access_level IN ('internal', 'external')),
    current_version_id UUID,  -- FK to project_file_versions
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,  -- Soft delete (NULL = active)
    CONSTRAINT project_files_project_access_filename_key UNIQUE(project_id, access_level, filename)
);
```

Note: `gfs_sync_status` is referenced in the Next.js code but not in this initial migration -- must have been added in a later migration. The UI queries and displays it.

#### `project_file_versions`
```sql
CREATE TABLE project_file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('txt', 'md')),  -- extended in later migrations
    size_bytes BIGINT NOT NULL CHECK (size_bytes <= 5242880),  -- 5MB limit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    google_doc_id TEXT,
    store_sync_status TEXT DEFAULT 'pending'
        CHECK (store_sync_status IN ('pending', 'synced_to_store', 'sync_failed', 'deleted_from_store')),
    store_sync_error TEXT,
    synced_to_store_at TIMESTAMPTZ,
    deleted_from_store_at TIMESTAMPTZ,
    CONSTRAINT project_file_versions_file_version_key UNIQUE(file_id, version_number)
);
```

Note: This initial migration has `store_sync_status` with original values. Later migrations likely added `gfs_sync_status` to `project_files` and expanded the enum. The `gfs_doc_id` column was also added later (referenced in the sync worker).

#### `project_file_search_stores`
```sql
CREATE TABLE project_file_search_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('internal', 'external')),
    google_store_id TEXT,
    google_store_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_file_search_stores_project_access_key UNIQUE(project_id, access_level)
);
```

Note: The Python code queries with `.eq("store_type", store_type)` and upserts with `on_conflict="project_id,access_level,store_type"`, so a `store_type` column was added in a later migration (not in this initial one). The current schema supports file/email/drive store types.

### RLS Policies

**project_files:**
- SELECT: Project members can view. Owners/internal see all files; external see only external files. Uses `get_user_project_role()` helper (SECURITY DEFINER).
- INSERT/UPDATE/DELETE: Only project owners (`is_project_owner()`).

**project_file_versions:**
- SELECT: Users who can view the parent file (`can_view_project_file()` -- SECURITY DEFINER).
- INSERT/UPDATE/DELETE: Only users who own the project containing the file (`owns_project_file()` -- SECURITY DEFINER).

**project_file_search_stores:**
- SELECT: Any project member.
- INSERT/UPDATE/DELETE (ALL): Only project owners.

### REUSE vs NEW for VAIS Prototype

**REUSE (schema):**
- `project_files` table structure (project_id, filename, access_level, current_version_id, soft delete).
- `project_file_versions` table structure (file_id, version_number, storage_path, size_bytes).
- `project_file_search_stores` table structure (project_id, access_level, google_store_id).
- All RLS policies (role-based access control logic is store-agnostic).
- The unique constraints and indexes.

**NEW (VAIS-specific):**
- `project_file_search_stores` may need additional columns for VAIS: `vais_engine_id`, `vais_data_store_id` (VAIS needs both a DataStore and an Engine, unlike GFS which is a single store). Or use `store_type = 'vais'` with `google_store_id` holding the data_store_id and a new column for engine_id.
- `project_file_versions` sync status columns: `gfs_sync_status` / `gfs_doc_id` names are GFS-specific. For the prototype we can reuse them (they're just strings), or add VAIS-specific columns.
- Schema definition tracking: VAIS requires pre-configured metadata schemas. May need a table or config to track which schemas have been applied per datastore.

---

## 4. Current Upload UI + Actions

### Sources
- `/workspaces/test-mvp/nextjs-app/app/actions/project-files.ts`
- `/workspaces/test-mvp/nextjs-app/lib/services/project-files/operations.ts`
- `/workspaces/test-mvp/nextjs-app/lib/services/project-files/types.ts`
- `/workspaces/test-mvp/nextjs-app/lib/services/project-files/helpers.ts`
- `/workspaces/test-mvp/nextjs-app/lib/services/project-files/auth.ts`

### Server Actions (thin wrappers)

`app/actions/project-files.ts` exports 4 server actions, each: authenticate user -> delegate to service -> revalidate path on success.

| Action | Purpose |
|---|---|
| `getProjectFiles(projectId)` | List files (internal/external split) |
| `uploadProjectFile(projectId, formData)` | Upload (extracts file + accessLevel from FormData) |
| `deleteProjectFile(projectId, fileId)` | Soft delete (sets `gfs_sync_status` to `pending_deletion`) |
| `getProjectFileDownloadUrl(projectId, fileId)` | Signed download URL (1h expiry) |

### Upload Flow (operations.ts)

`uploadProjectFile()` in `operations.ts`:
1. `validateFileType(filename)` -- checks extension against `ALLOWED_EXTENSIONS` (derived from `GFS_FILE_TYPES` registry).
2. `validateFileSize(filename, content.length)` -- checks against `MAX_FILE_SIZE`.
3. `authorizeProjectAccess()` + `isOwner()` check.
4. `getProjectStorageContainer()` -- gets org/workspace info for storage path.
5. `findOrCreateProjectFile()` -- upsert file record (handles re-upload of same filename).
6. `buildStoragePath()` -- format: `orgs/{org_id}/projects/{project_id}/{access_level}/{file_id}/{version_id}.{ext}`
7. `uploadFileToStorage()` -- upload bytes to Supabase Storage `user-files` bucket.
8. `createFileVersion()` -- insert version record (increments version_number).
9. `updateCurrentVersion()` -- point `project_files.current_version_id` to new version.
10. Return `ProjectFile` with `gfs_sync_status: "pending"`.

The sync worker then picks up the pending version and uploads to GFS asynchronously.

### Delete Flow

`deleteProjectFile()` in `operations.ts`:
1. Auth + ownership check.
2. Verify file exists (not already deleted).
3. Set `gfs_sync_status` to `pending_deletion` (only from valid source states: pending/processing/failed/synced).
4. The `deleted_at` timestamp is set by a DB trigger when the sync worker's deletion actually succeeds.

### File Type Registry

`types.ts` defines `GFS_FILE_TYPES` -- single source of truth (must stay consistent with Python):
```typescript
const GFS_FILE_TYPES = {
    txt:  { ext: ".txt",  mime: "text/plain",       uploadAllowed: true,  needsWorkaround: false },
    md:   { ext: ".md",   mime: "text/markdown",    uploadAllowed: true,  needsWorkaround: false },
    pdf:  { ext: ".pdf",  mime: "application/pdf",  uploadAllowed: true,  needsWorkaround: false },
    docx: { ext: ".docx", mime: "...",              uploadAllowed: true,  needsWorkaround: true  },
    csv:  { ext: ".csv",  mime: "text/csv",         uploadAllowed: false, needsWorkaround: true  },
};
```

Derived constants: `ALLOWED_EXTENSIONS`, `MIME_TYPES`, `SYNCABLE_EXTENSIONS`, `FILE_INPUT_ACCEPT`, `SUPPORTED_FORMATS_LABEL`.

### REUSE vs NEW for VAIS Prototype

**REUSE (all of it):**
- Server actions layer (`project-files.ts`) -- completely store-agnostic.
- Upload flow in `operations.ts` -- uploads to Supabase Storage and creates DB records. The GFS sync is entirely decoupled (worker picks up pending status).
- Delete flow -- sets `pending_deletion` status; worker handles the rest.
- File type registry and validation -- VAIS supports MORE formats than GFS (xlsx, pptx work in VAIS), so we'd potentially expand the registry.
- Storage path structure -- unchanged, files still go to Supabase Storage.
- All auth/authorization helpers.

**NEW (minimal):**
- Expand `GFS_FILE_TYPES` in both Python and TypeScript to re-enable xlsx/pptx (they work in VAIS).
- The upload UI components themselves (not examined here -- likely React components calling server actions) are fully reusable since they're upload-path agnostic.

---

## 5. Current Search Flow

### Sources
- `/workspaces/test-mvp/python-services/agent_api/agent/file_search_tool.py`
- `/workspaces/test-mvp/python-services/agent_api/agent/multi_store_query_service.py`
- `/workspaces/test-mvp/python-services/agent_api/project_store_service.py`
- `/workspaces/test-mvp/python-services/agent_api/chat_service.py`

### MCP Tool: `search_files` / `semantic_search`

`file_search_tool.py` creates an MCP server with one of two tool variants (never both):

- **`search_files`** (default): query-only, no entity_type or filter params.
- **`semantic_search`** (opt-in via `use_semantic_search` flag): adds `entity_type` (file/email/email_attachment, or list) and `filter` (AIP-160 metadata syntax).

Both tools call `query_service.query_store(query_text, ...)` via `asyncio.to_thread` (sync -> thread to avoid blocking event loop).

### MultiStoreQueryService

`multi_store_query_service.py` -- heart of the search flow. Initialized with three lists of GFS store IDs:
- `file_store_ids`: internal/external file stores
- `email_store_ids`: internal/external email stores
- `drive_store_ids`: internal/external drive stores

**Query flow:**
1. `query_stores(query_text, metadata_filter, entity_type)` is the entry point.
2. `_build_store_filter_map()` -- per-store filter map. Different stores may get different filters. Entity-type injection adds `entity_type = "email"` or `entity_type = "attachment"` conditions automatically for email stores.
3. `_select_store_ids()` -- picks which stores to query based on entity_type.
4. Queries all selected stores **in parallel** via `ThreadPoolExecutor(max_workers=len(stores))`.
5. Each store query calls `_query_single_store()` which calls `genai.Client.models.generate_content()` with `FileSearch` tool -- this is the GFS-specific API (Gemini + FileSearch grounding).
6. Results merged: answers concatenated, chunks combined from all stores.

**Store query implementation (GFS-specific):**
```python
response = self.google_client.models.generate_content(
    model="gemini-2.5-flash",
    contents=query_text,
    config=types.GenerateContentConfig(
        tools=[types.Tool(file_search=types.FileSearch(
            file_search_store_names=[store_id],
            metadata_filter=metadata_filter,
        ))]
    ),
)
```

This uses Gemini's built-in FileSearch grounding -- the LLM generates a response grounded by retrieved chunks. VAIS does NOT have this integration; it returns raw chunks via `SearchServiceClient.search()`.

### Store ID Resolution per User Role

`project_store_service.py` -- `ProjectStoreService.get_accessible_stores()`:
1. Creates an authenticated Supabase client using the user's JWT.
2. Queries `project_file_search_stores` for all stores of the project.
3. Maps stores by `(access_level, store_type)` to build an `AccessibleStores` dataclass.
4. Filters by role:
   - **External users**: only external stores (file, email, drive).
   - **Owner/Internal users**: both internal and external stores.
5. Returns `AccessibleStores` with methods: `get_file_store_ids()`, `get_email_store_ids()`, `get_drive_store_ids()`.

The `chat_service.py` calls this to get store IDs, then constructs `MultiStoreQueryService` with the appropriate lists.

### REUSE vs NEW for VAIS Prototype

**REUSE:**
- `ProjectStoreService` and `AccessibleStores` -- role-based store resolution is store-backend agnostic. Only the store ID format changes.
- MCP tool interface (`file_search_tool.py`) -- the tool schema (query, entity_type, filter params) and response format can stay the same.
- Parallel query pattern from `MultiStoreQueryService` -- querying multiple stores in parallel.
- Entity-type to store routing logic.
- Sentry span instrumentation patterns.

**NEW (VAIS search):**
- Replace `genai.Client.models.generate_content()` (Gemini + FileSearch grounding) with `discoveryengine.SearchServiceClient.search()` (VAIS CHUNKS mode).
- VAIS returns raw chunks, not LLM-synthesized answers. Need to either:
  - (a) Return raw chunks to the MCP tool and let the chat model synthesize, or
  - (b) Add a separate Gemini call to synthesize an answer from VAIS chunks.
- Metadata filter syntax: GFS uses `key = "value"`, VAIS uses `key: ANY("value")`. The `_build_metadata_filter()` logic needs a VAIS variant.
- VAIS search requires `serving_config` path construction (engine + serving config), not just store ID.
- Chunk data extraction is different: VAIS returns `chunk.content`, `chunk.relevance_score`, doc ID from `chunk.name` path. GFS returns `grounding_metadata.grounding_chunks` with `retrieved_context`.

---

## Summary: What the Prototype Needs

### Can REUSE as-is
1. **Upload UI + server actions** -- completely store-agnostic
2. **DB schema** -- tables, RLS, constraints all reusable
3. **Sync worker loop** -- polling, claiming RPCs, event logging, concurrency
4. **File download** from Supabase Storage
5. **Store resolution** per user role
6. **MCP tool interface** -- schema stays same

### Needs NEW code
1. **VAIS DataStore + Engine creation** (replace GFS store creation)
2. **VAIS document upload** (inline < 1MB, GCS > 1MB; replace GFS upload)
3. **VAIS document deletion** (replace GFS deletion)
4. **VAIS schema setup** (no GFS equivalent)
5. **VAIS search** (replace Gemini+FileSearch with `SearchServiceClient.search()` in CHUNKS mode)
6. **Metadata format adapter** (`struct_data` vs `custom_metadata`)
7. **Filter syntax adapter** (`ANY()` vs `=`)
8. **Answer synthesis** -- VAIS returns raw chunks, need Gemini call or pass-through to chat model

### Feature gains from VAIS
- Heading-aware chunking (`includeAncestorHeadings`)
- All office formats work (xlsx, pptx fixed)
- Honest LROs (no hangs, no silent failures)
- Raw chunk access (can list/enumerate all chunks)
- Metadata filtering with schema (verified 8/8 tests pass)
