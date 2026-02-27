# ENG-2204 Phase 1: Current Codebase State — VAIS Integration

Research date: 2026-02-26

## 1. VAIS-Related Code in `python-services/`

### Production VAIS Package: `agent_api/vais/`

A fully self-contained VAIS (Vertex AI Search) prototype package with zero coupling to production GFS code.

| File | Purpose |
|------|---------|
| `agent_api/vais/__init__.py` | Package docstring, declares standalone nature |
| `agent_api/vais/config.py` | All settings: GCP project, location (`global`), GCS bucket, chunk config, metadata schema, path builders |
| `agent_api/vais/types.py` | Pydantic models: `VaisSearchRequest`, `VaisChunkResult`, `VaisSearchResponse`, `VaisDocumentResponse`, `VaisStoreResponse`, enums (`VaisSyncStatus`, `StoreStatus`) |
| `agent_api/vais/store_service.py` | `VaisStoreService` — DataStore + Engine lifecycle (lazy creation per project, schema upgrade) |
| `agent_api/vais/schema_service.py` | `VaisSchemaService` — Metadata schema management (apply, verify, version tracking) |
| `agent_api/vais/document_service.py` | `VaisDocumentService` — Two upload paths (inline <1MB, GCS JSONL >=1MB), delete, list, storage download |
| `agent_api/vais/search_service.py` | `VaisSearchService` — CHUNKS mode search with metadata filtering, filter builder |
| `agent_api/vais/sync_worker.py` | `VaisSyncWorker` — Background processing (poll, claim via RPC, download from Supabase Storage, upload to VAIS) |
| `agent_api/api/vais.py` | FastAPI routes: store status, document upload/delete/list, search |

### Standalone Server: `vais_server.py`

Separate FastAPI app running on **port 58200**. Not wired into the main `agent_api/main.py` — completely standalone. CORS configured for `localhost:63200` (standalone UI) and `localhost:3000`. Sync worker lifecycle managed via FastAPI lifespan, gated by `VAIS_SYNC_ENABLED` env var.

### Experiments: `experiments/`

| File | What it verified |
|------|-----------------|
| `vertex_ai_search_experiment.py` | Full VAIS CRUD lifecycle, CHUNKS search, ANY() filter syntax, metadata schema |
| `vertex_ai_search_latency_experiment.py` | Raw chunks avg=604ms, chunks+Gemini avg=1345ms |
| `vertex_ai_search_mixed_metadata_experiment.py` | Union schemas work, absent keys silently excluded |
| `vais_reliability/setup_infra.py` | DataStore + Engine creation patterns |
| `vais_reliability/phase2_single_file.py` | Inline upload with struct_data metadata |
| `vais_reliability/phase2b_gcs_upload.py` | GCS upload path |
| `vais_reliability/phase3_chunk_visibility.py` | Chunk search after indexing |
| `vais_reliability/phase4_concurrent.py` | Concurrent upload behavior |
| `vais_reliability/phase5_metadata_load.py` | Metadata loading patterns |

### SDK Dependency

`google-cloud-discoveryengine==0.16.0` in `pyproject.toml`. Uses `discoveryengine_v1` (not alpha).

---

## 2. Current GFS (Generalized File Search) Architecture

### Core Services

| File | Purpose |
|------|---------|
| `agent_api/google_file_search_client.py` | `GoogleFileSearchClient` — wrapper around `google.genai` SDK with retry logic. CRUD operations on stores and documents. |
| `agent_api/project_file_search_service.py` | `ProjectFileSearchService` — the heavy lifter. File upload (with text extraction workarounds), store creation, document sync, metadata attachment. ~65KB of production code. |
| `agent_api/agent/multi_store_query_service.py` | `MultiStoreQueryService` — queries multiple GFS stores in parallel via `ThreadPoolExecutor`, merges results. Uses `gemini-2.5-flash` with `FileSearch` tool. |
| `agent_api/agent/file_search_query_service.py` | `FileSearchQueryService` — simpler single-store query (legacy path). |
| `agent_api/project_store_service.py` | `ProjectStoreService` — looks up which stores a user can access based on project role (owner/internal/external). Returns `AccessibleStores` dataclass. |
| `agent_api/agent/file_search_tool.py` | MCP tool wrapper. Two variants: `search_files` (query-only) and `semantic_search` (with entity_type + filter). Registered via `create_file_search_mcp_server`. |
| `agent_api/gfs_metadata.py` | Metadata field constructors: `email_fields()`, `attachment_fields()`, `file_fields()`. Converter `to_custom_metadata()` maps Python types to GFS `CustomMetadata`. |
| `agent_api/sync_worker.py` | Background sync worker for GFS. Polls for pending files/emails, uploads to Google File Search stores. |

### GFS Query Flow (Production)

```
User message → Agent → MCP tool (semantic_search) → MultiStoreQueryService.query_stores()
  → ThreadPoolExecutor: one thread per store
    → genai.Client.models.generate_content(model="gemini-2.5-flash", tools=[FileSearch(...)])
    → Gemini synthesizes answer + returns grounding_chunks
  → Merge answers + chunks from all stores
  → Return to agent as MCP tool response
```

**Key characteristic**: GFS does NOT return raw chunks. Gemini generates a synthesized answer using FileSearch as a grounding tool. The "chunks" in GFS are `grounding_chunks` from `grounding_metadata` — they have `title`, `text` (preview), and `uri` but are secondary to the synthesized answer.

### VAIS Search Flow (Prototype)

```
POST /api/vais/projects/{project_id}/search → VaisSearchService.search()
  → discoveryengine.SearchServiceClient().search(CHUNKS mode)
  → Returns raw chunks with content, relevance_score, document_metadata
  → No LLM synthesis — raw chunks only
```

**Key characteristic**: VAIS returns raw chunks directly from the index. No Gemini call. Chunks have full content text + relevance scores (0-1) + metadata fields.

---

## 3. Data Stores — Configuration and Layout

### GFS Data Stores (Production)

Each project can have up to **6 stores** in the `project_file_search_stores` table:

| Store Type | Access Level | Content |
|-----------|-------------|---------|
| `file` | `internal` | Uploaded files (internal access) |
| `file` | `external` | Uploaded files (external access) |
| `email` | `internal` | Email bodies + attachments (internal) |
| `email` | `external` | Email bodies + attachments (external) |
| `drive` | `internal` | Google Drive synced files (internal) |
| `drive` | `external` | Google Drive synced files (external) |

- Stored in `project_file_search_stores` table (public schema)
- Each store has a `google_store_id` pointing to a Google File Search store
- Access control is **physical**: separate stores per access level, filtered by user role
- Store lookup via `ProjectStoreService.get_accessible_stores()`

### VAIS Data Stores (Prototype)

Each project gets exactly **1 DataStore + 1 Engine** pair:

| Resource | Naming | Example |
|----------|--------|---------|
| DataStore | `vais-proj-{short_id}` | `vais-proj-abc12345` |
| Engine | `vais-eng-{short_id}` | `vais-eng-abc12345` |

- Stored in `vais_prototype.vais_stores` table
- Access control is **logical**: single store per project, `access_level` field in metadata, filtered via `ANY()` expressions
- DataStore configuration: `CONTENT_REQUIRED`, `SEARCH_TIER_ENTERPRISE`, layout-based chunking (500 tokens), `includeAncestorHeadings=true`
- Schema version tracking (`schema_version` column) for automatic upgrades

### VAIS Metadata Schema

Defined in `agent_api/vais/config.py` as `METADATA_SCHEMA` (JSON Schema format):

```python
METADATA_SCHEMA = {
    "properties": {
        "project_id": {"type": "string", "indexable": True, "retrievable": True},
        "access_level": {"type": "string", "indexable": True, "retrievable": True},
        "entity_type": {"type": "string", "indexable": True, "retrievable": True},
        "file_type": {"type": "string", "indexable": True, "retrievable": True},
        "file_id": {"type": "string", "indexable": True, "retrievable": True},
        "file_name": {"type": "string", "indexable": False, "retrievable": True},
        "uploaded_at": {"type": "number", "indexable": True, "retrievable": True},
    },
}
```

Current `SCHEMA_VERSION = 2`.

### GFS Metadata Fields

Defined in `agent_api/gfs_metadata.py`:

- **Files** (8 keys): `file_id`, `entity_type`, `filename`, `file_extension`, `mime_type`, `access_level`, `date_epoch`, `size_bytes`
- **Emails** (14 keys): `email_id`, `entity_type`, `sender`, `sender_domain`, `date_epoch`, `thread_id`, `recipients`, `recipient_domains`, `cc_addresses`, `subject`, `has_attachments`, `attachment_count`, `access_level`, `is_reply`
- **Attachments** (19 keys): 6 own + 13 inherited from parent email

GFS uses `CustomMetadata` (key-value with typed values: `string_value`, `numeric_value`, `string_list_value`).
VAIS uses `struct_data` (protobuf Struct, also supports typed values but via Struct fields).

---

## 4. Chunk Return Format

### GFS Chunk Format (via `grounding_metadata.grounding_chunks`)

```python
{
    "type": "retrieved_context",
    "title": "file display name",       # From grounding chunk
    "text": "chunk text preview",        # Truncated content
    "uri": "gs://... or store URI",      # Source URI
}
```

- Comes embedded in Gemini `generate_content` response
- Appears under `response.candidates[0].grounding_metadata.grounding_chunks`
- The primary output is the synthesized `answer` text; chunks are supplementary citations
- Chunks lack relevance scores — Gemini decides what's relevant
- No metadata fields on chunks (metadata is used for pre-filtering, not returned)

### VAIS Chunk Format (`VaisChunkResult`)

```python
class VaisChunkResult(BaseModel):
    content: str                         # Full chunk text (with ancestor headings)
    relevance_score: float               # 0-1 relevance score
    document_id: str | None              # Extracted from chunk.name path
    chunk_id: str | None                 # Extracted from chunk.name path
    source_file: str | None              # file_name from metadata
    metadata: dict[str, Any]             # All struct_data fields
```

- Comes from `discoveryengine.SearchServiceClient.search()` in CHUNKS mode
- Raw chunks with full content (not truncated)
- Explicit relevance scores
- Document metadata returned inline (project_id, access_level, entity_type, etc.)
- No synthesized answer — just ranked chunks
- Supports `num_previous_chunks` / `num_next_chunks` for context windows

### VRAG Chunk Format (for comparison)

```python
{
    "text": "chunk text",
    "score": 0.75,                       # Relevance score
    "source_display_name": "filename",   # From Vertex RAG
}
```

- Comes from `vertexai.rag.retrieval_query()`
- Raw chunks with scores
- Minimal source info (display name only)
- Pre-filtered by rag_file_ids from Supabase

---

## 5. Architecture Notes from `python-services/CLAUDE.md`

The CLAUDE.md is notably sparse on search architecture. Key points:

- Uses `uv` for dependency management
- Railway deployment via Railpack
- Standard Supabase query patterns (avoid `.single()` / `.maybe_single()`)
- Feature flags require matching browser flag (use `/feature-toggles` skill)
- Python 3.13 runtime

**Not mentioned in CLAUDE.md**: GFS architecture, VAIS prototype, store layout, search flow. This context lives in MEMORY.md and research documents instead.

---

## 6. Integration State Summary

### What's Already in Place

1. **Full VAIS prototype** — standalone server, API, sync worker, database schema, search
2. **Verified SDK patterns** — 7+ experiments confirming CHUNKS mode, metadata filtering (ANY() syntax), JSONL document import, schema management
3. **Database infrastructure** — own `vais_prototype` schema with tables, RPCs, RLS, triggers
4. **Standalone UI** — admin pages at `/admin/vais/` (search playground + file manager)
5. **Background sync worker** — mirrors GFS sync architecture (claim-process-update pattern)
6. **Metadata filtering** — 7 indexed fields including date range (`uploaded_at >= N`)
7. **Two upload paths** — inline (<1MB, pdf/json only) and GCS JSONL (everything else)
8. **Schema versioning** — automatic upgrade on access, version tracked in DB

### What's Missing (Not Connected to Production)

1. **No wiring to main app** — VAIS is NOT registered in `agent_api/main.py`. Zero references to `vais` in the main FastAPI app, agent code, or chat service.
2. **No MCP tool integration** — VAIS search is not available as an MCP tool for the Claude agent. The `file_search_tool.py` only wraps GFS (`MultiStoreQueryService`).
3. **No production store migration** — existing project files are in GFS stores. No migration path from GFS to VAIS.
4. **Simplified auth** — VAIS API uses service-role key directly (no JWT validation). Comment says "production integration would use the same JWT middleware as GFS endpoints."
5. **No email/attachment sync** — VAIS sync worker only handles files from Supabase Storage. No email ingestion pipeline (GFS has `email_sync_service.py`).
6. **No Drive sync** — GFS has `drive_sync_service.py` for Google Drive integration. VAIS has no equivalent.
7. **No admin GFS reconciliation equivalent** — GFS has `admin_gfs_*` modules for health checks, reconciliation, mutations. VAIS has no admin tooling beyond the UI.
8. **Limited metadata fields** — VAIS has 7 fields vs GFS emails' 14+ fields. Missing email-specific fields (sender, thread_id, recipients, etc.)
9. **No feature flag** — VAIS is gated by `VAIS_SYNC_ENABLED` env var, not by the feature toggle system
10. **No Sentry instrumentation** — VAIS search has one `sentry_sdk.start_span` call; GFS has comprehensive span instrumentation (`gfs.query`, `gfs.query_single_store`)

### Key Architectural Differences: GFS vs VAIS

| Aspect | GFS (Production) | VAIS (Prototype) |
|--------|-------------------|-------------------|
| Search approach | Gemini + FileSearch tool (synthesized answer + grounding chunks) | Discovery Engine CHUNKS mode (raw chunks + relevance scores) |
| Stores per project | Up to 6 (by type x access level) | 1 (metadata filtering for access control) |
| Access control | Physical (separate stores) | Logical (metadata filter) |
| Query parallelism | ThreadPoolExecutor across stores | Single SearchServiceClient call |
| Latency | 6-8s (4 sequential Gemini calls, now parallelized) | ~600ms raw chunks, ~1.3s with Gemini |
| Chunking | Google-managed (opaque) | Layout-based, 500 tokens, ancestor headings |
| Metadata | CustomMetadata (key-value typed) | struct_data (protobuf Struct) |
| SDK | `google.genai` (Gemini SDK) | `google.cloud.discoveryengine` (Discovery Engine SDK) |
| Document upload | Direct to Google File Search API | Inline or GCS JSONL import |
| Server | Main FastAPI app (port 8000/58000) | Standalone FastAPI app (port 58200) |
