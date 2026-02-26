# Phase 04: Implementation Log

Implementation date: 2026-02-26

---

## Slices Completed

### Slice 1: DB Migration (ENG-2099) — `456bb51f`

**File:** `supabase/migrations/20260226110953_vais_prototype.sql`

Created via `bunx supabase migration new vais_prototype`, applied via `bunx supabase migration up`.

Contents:
- `vais_sync_status` enum (9 states: pending through deleted)
- `vais_stores` table — one row per project, tracks DataStore + Engine pair, unique on project_id
- `vais_documents` table — one row per logical file, soft delete via `deleted_at`, unique on (project_id, file_name, access_level)
- `vais_document_versions` table — version tracking per document, unique on (document_id, version_number)
- `vais_sync_events` table — audit log for sync debugging
- `claim_pending_vais_sync()` RPC — SKIP LOCKED atomic claim for sync worker
- `claim_pending_vais_deletion()` RPC — SKIP LOCKED atomic claim for deletion worker
- `vais_set_deleted_at()` trigger — auto-sets `deleted_at` when sync_status transitions to 'deleted'
- `updated_at` triggers reusing existing `update_updated_at_column()` function
- RLS policies: members can read (via project_members join), owners can write (via `is_project_owner(pid, uid)`)
- Partial indexes on sync_status for worker queries, project_id for lookups

**Fix during implementation:** The design doc used `is_project_owner(project_id)` (1-arg) but the actual function signature is `is_project_owner(pid uuid, uid uuid)`. Fixed to `is_project_owner(project_id, auth.uid())`. Also fixed `update_updated_at()` to `update_updated_at_column()`.

### Slice 2: Python Config + Types (ENG-2100) — `b5b08866`

**Files:**
- `python-services/agent_api/vais/__init__.py` — package docstring
- `python-services/agent_api/vais/config.py` — configuration module
- `python-services/agent_api/vais/types.py` — Pydantic models

Config provides:
- `GCP_PROJECT` (env: `VAIS_GCP_PROJECT`, default: "effi-vertex-experiment")
- `VAIS_LOCATION` ("global"), `VAIS_COLLECTION` ("default_collection")
- `VAIS_SYNC_ENABLED` feature gate (default: False)
- `METADATA_SCHEMA` with 6 fields (project_id, access_level, entity_type, file_type, file_id indexable; file_name retrievable only)
- `SCHEMA_VERSION = 1` for versioned schema management
- Path builders: `make_parent()`, `make_branch()`, `make_serving_config()`, `make_schema_name()`
- Sync worker tuning: poll interval, max retries, max items per cycle, LRO timeout

Types provides:
- `VaisSyncStatus` (StrEnum, 9 values mirroring Postgres enum)
- `StoreStatus` (StrEnum: creating, ready, error)
- `VaisSearchRequest` — query, entity_type, access_level, filter, num_results
- `VaisChunkResult` — content, relevance_score, document_id, chunk_id, source_file, metadata
- `VaisSearchResponse` — success, query, chunks, total_results, error
- `VaisDocumentResponse`, `VaisStoreResponse`, `VaisDocumentListItem`, `VaisDocumentListResponse`

### Slice 3: Store Service (ENG-2101) — `93e92a76`

**File:** `python-services/agent_api/vais/store_service.py`

`VaisStoreService` class with Supabase client dependency:
- `get_or_create_store(project_id)` — check DB first, lazy-create if missing
- `_get_existing_store()` — queries vais_stores, cleans up error rows for retry
- `_create_store()` — 5-step creation: insert placeholder, create DataStore LRO, create Engine LRO, apply schema, update to ready
- `_create_datastore()` — creates DataStore with layout-based chunking (500 tokens), `include_ancestor_headings=True`, `CONTENT_REQUIRED`, `SOLUTION_TYPE_SEARCH`
- `_create_engine()` — creates Engine with `SEARCH_TIER_ENTERPRISE` for CHUNKS mode
- `get_store_status()` — returns store info + active document count
- Error handling: marks store as 'error' with message on any failure, next call cleans up and retries
- DataStore IDs use `vais-proj-{project_id[:8]}` format, Engine IDs use `vais-eng-{project_id[:8]}`

### Slice 4: Schema Service (ENG-2102) — `47c9fca3`

**File:** `python-services/agent_api/vais/schema_service.py`

`VaisSchemaService` class (stateless, no Supabase dependency):
- `ensure_schema(datastore_id, current_version)` — version-aware, skips if already at target version
- `_apply_schema()` — `SchemaServiceClient.update_schema()` with `allow_missing=True` on `default_schema` resource
- `_verify_schema()` — fetches schema back via `get_schema()`, compares field sets
- Schema definition from `config.METADATA_SCHEMA` — 6 fields, JSON Schema 2020-12 format
- Idempotent: safe to call multiple times (update_schema with allow_missing)

### Slice 5: Document Service (ENG-2103) — `e2cb32f9`

**File:** `python-services/agent_api/vais/document_service.py`

`VaisDocumentService` class with Supabase client dependency:
- `upload_document(datastore_id, document_id, file_bytes, mime_type, metadata)` — chooses inline vs GCS path based on 1MB threshold
- `_upload_inline()` — `ImportDocumentsRequest.InlineSource` with Document containing `content.raw_bytes`, `content.mime_type`, and `struct_data` (protobuf Struct). INCREMENTAL reconciliation mode for upsert.
- `_upload_via_gcs()` — uploads to GCS bucket first, imports via `GcsSource` + `data_schema="content"`, then updates struct_data separately via `update_document()`, cleans up GCS blob
- `_build_struct_data(metadata)` — converts flat dict to `google.protobuf.struct_pb2.Struct` with string_value fields
- `delete_document(datastore_id, vais_document_id)` — `DocumentServiceClient.delete_document()`, treats 404 as success
- `list_vais_documents(datastore_id)` — `DocumentServiceClient.list_documents()` on default_branch
- `download_from_storage(storage_path)` — downloads from Supabase Storage "user-files" bucket
- Helper functions: `get_mime_type(file_name)`, `get_file_type(file_name)`
- MIME type mapping: txt, md, pdf, docx, pptx, xlsx, csv, html

### Slice 6: Search Service (ENG-2104) — `47609bf1`

**File:** `python-services/agent_api/vais/search_service.py`

`VaisSearchService` class (stateless):
- `search(engine_id, query, filter_expr, num_results, num_previous_chunks, num_next_chunks)` — executes `SearchServiceClient.search()` in CHUNKS mode with Sentry span tracing
- `_build_search_request()` — builds `SearchRequest` with `ContentSearchSpec.SearchResultMode.CHUNKS` and `ChunkSpec` for adjacent chunk context
- `_parse_chunk_results()` — extracts `VaisChunkResult` objects from response, parsing document_id and chunk_id from `chunk.name` path segments, struct_data metadata from `chunk.document_metadata`
- `build_access_filter(project_id, access_level, entity_type, user_filter)` — static method, builds VAIS filter expression using `ANY()` syntax. Always scopes to project_id, optionally adds access_level, entity_type (supports list), user_filter. All clauses combined with AND.
- `_extract_from_path(path, segment)` — helper to extract values from VAIS resource paths

### Slice 7: Sync Worker (ENG-2105) — `4edc417d`

**Files:**
- `python-services/agent_api/vais/sync_worker.py` — worker implementation
- `python-services/agent_api/main.py` — lifespan registration

`VaisSyncWorker` class:
- `process_pending_syncs()` — claims via `claim_pending_vais_sync` RPC, for each: ensure store exists (lazy creation), get latest version with storage_path, download from Supabase Storage, upload to VAIS, update status to synced/failed/retry_exhausted
- `process_pending_deletions()` — claims via `claim_pending_vais_deletion` RPC, deletes from VAIS, updates status to deleted (trigger sets deleted_at)
- `_build_metadata(doc, version)` — builds struct_data fields matching METADATA_SCHEMA (project_id, access_level, entity_type, file_id, file_name, file_type)
- `_insert_event()` — audit log to vais_sync_events table
- `run_cycle()` — runs syncs then deletions

`run_vais_sync_worker()` async entry point:
- Same fixed-rate scheduling as GFS worker: polls every VAIS_POLL_INTERVAL, semaphore-bounded concurrency (MAX_CONCURRENT_CYCLES=3)
- Uses `loop.run_in_executor()` for blocking I/O
- Graceful shutdown via `vais_shutdown_event`

**main.py registration:** VAIS worker starts in lifespan alongside GFS worker, conditional on `VAIS_SYNC_ENABLED=true`. Separate shutdown path.

### Slice 8: FastAPI Routes (ENG-2106) — `d8595b5a`

**Files:**
- `python-services/agent_api/api/vais.py` — route definitions
- `python-services/agent_api/main.py` — router registration

Router at `/api/vais` with 5 endpoints:
- `GET /projects/{project_id}/store` — returns store status (DataStore/Engine IDs, schema version, document count) or status="not_found"
- `POST /projects/{project_id}/documents` — multipart upload (file + access_level + entity_type). Creates/updates vais_documents + vais_document_versions, uploads to Supabase Storage, queues for sync worker. Handles re-uploads by incrementing version.
- `DELETE /projects/{project_id}/documents/{document_id}` — soft-delete, sets sync_status to pending_deletion
- `GET /projects/{project_id}/documents` — lists with optional access_level filter, includes latest version info (size, type, version number)
- `POST /projects/{project_id}/search` — CHUNKS mode search via VaisSearchService, auto-injects project_id filter, optional access_level/entity_type/custom filter

Auth: prototype-grade, uses service-role Supabase client (no JWT validation). Production would use JWT middleware.

---

## Deviations from Design

1. **`is_project_owner` signature**: Design used 1-arg form, actual function requires 2 args `(pid, uid)`. Fixed in migration.
2. **`update_updated_at` name**: Design used `update_updated_at()`, actual function is `update_updated_at_column()`. Fixed in migration.
3. **`GCP_PROJECT` not imported in store_service**: Design showed it in imports but it wasn't used directly (path building is in config module). Removed by lint.
4. **Routes in `api/vais.py` not `vais/routes.py`**: Design doc showed the router as `agent_api/api/vais.py` registered from `agent_api.api import vais`. Followed the design doc's main.py pattern (consistent with all other routers living under `api/`).
5. **GCS upload metadata update**: Design noted GCS import doesn't carry struct_data. Implementation adds a separate `_update_document_metadata()` call via `update_document()` after GCS import completes.
6. **Sync worker concurrency**: Design didn't specify. Set MAX_CONCURRENT_CYCLES=3 (lower than GFS's 5) since VAIS LROs are typically faster than GFS.

## Package Structure After Implementation

```
python-services/agent_api/vais/
├── __init__.py           # Package docstring
├── config.py             # GCP settings, schema definition, path builders
├── document_service.py   # Upload (inline/GCS), delete, list, storage download
├── schema_service.py     # Metadata schema CRUD
├── search_service.py     # CHUNKS mode search with metadata filtering
├── store_service.py      # DataStore + Engine lifecycle
├── sync_worker.py        # Background polling + VAIS upload/delete
└── types.py              # Pydantic models + enums

python-services/agent_api/api/
└── vais.py               # FastAPI router (5 endpoints)

supabase/migrations/
└── 20260226110953_vais_prototype.sql   # All tables, enums, RPCs, RLS, triggers
```

## All Slices Complete

| Slice | Issue | Commit | Description |
|-------|-------|--------|-------------|
| 1 | ENG-2099 | `456bb51f` | DB migration (tables, enums, RPCs, RLS) |
| 2 | ENG-2100 | `b5b08866` | Python config + types |
| 3 | ENG-2101 | `93e92a76` | Store service (DataStore + Engine lifecycle) |
| 4 | ENG-2102 | `47c9fca3` | Schema service (metadata schema management) |
| 5 | ENG-2103 | `e2cb32f9` | Document service (upload, delete, list) |
| 6 | ENG-2104 | `47609bf1` | Search service (CHUNKS mode + filters) |
| 7 | ENG-2105 | `4edc417d` | Sync worker (background polling + upload) |
| 8 | ENG-2106 | `d8595b5a` | FastAPI routes (5 REST endpoints) |
| 9 | ENG-2107 | `ed3b4b2d` | Search playground UI + proxy route |
| 10 | ENG-2108 | `770ffbce` | File manager UI (upload, list, delete) |

### Slice 9: Search Playground UI (ENG-2107) — `ed3b4b2d`

**Files:**
- `nextjs-app/app/api/vais/[...path]/route.ts` — catch-all proxy route forwarding GET/POST/DELETE to Python API at `/api/vais/*`. Handles JSON and multipart/form-data passthrough.
- `nextjs-app/app/admin/vais/page.tsx` — VAIS admin index with links to search and files sub-pages. Admin auth check via Supabase `admins` table.
- `nextjs-app/app/admin/vais/search/page.tsx` — search page shell with admin auth guard
- `nextjs-app/app/admin/vais/search/vais-search-playground.tsx` — client component with:
  - Project ID text input (UUID)
  - Search query input with Enter-to-search
  - Entity type dropdown (all/file/email/email_attachment)
  - Access level dropdown (all/internal/external)
  - Max results number input (1-50)
  - Filter expression text input (raw VAIS ANY() syntax)
  - Results display: chunk cards with relevance score badges (%), source file name, entity type/access level badges, expandable content preview (500 char cutoff), collapsible metadata JSON
  - Latency display in ms
  - Loading and error states
- `nextjs-app/app/admin/page.tsx` — added VAIS Prototype entry to admin navigation grid

### Slice 10: File Manager UI (ENG-2108) — `770ffbce`

**Files:**
- `nextjs-app/app/admin/vais/files/page.tsx` — file manager page shell with admin auth guard
- `nextjs-app/app/admin/vais/files/vais-file-manager.tsx` — client component with:
  - Project ID input with Load/Refresh button
  - Upload section: access level selector (internal/external), entity type selector (file/email/email_attachment), multi-file input, upload button
  - Documents table using shadcn Table component: file name, access level badge, entity type badge, sync status badge, file size, creation date, delete button
  - SyncStatusBadge component with color-coded states: synced (green/CheckCircle2), pending (yellow/Clock), processing (blue/Loader2 animated), failed (red/XCircle), deleting (orange/Loader2 animated), excluded (AlertCircle), retry_exhausted (red/XCircle)
  - Delete with browser confirm dialog, loading spinner during deletion
  - Auto-polling every 3s when any document has transient sync status (pending/processing/pending_deletion/deleting)
  - Error and success message banners
  - Empty state placeholder when no documents exist
