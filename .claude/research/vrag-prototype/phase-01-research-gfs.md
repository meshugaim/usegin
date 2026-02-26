# Phase 01 Research: GFS Patterns to Replicate for VRAG Prototype

**Date:** 2026-02-26
**Ticket:** ENG-2098

---

## 1. Upload UI

**File:** `nextjs-app/components/project-file-manager.tsx`

### What It Does
- Client component with internal/external tabs
- Calls three server actions: `uploadProjectFile`, `deleteProjectFile`, `getProjectFileDownloadUrl`
- All imported from `@/app/actions/project-files`
- Multi-file upload (sequential, not parallel)
- Upload sends `FormData` with `file` + `accessLevel` (the active tab)

### Sync Status Polling
- Polls via `router.refresh()` every 1.5s when any file has `file_version.gfs_sync_status === "pending"` or file-level `gfs_sync_status` in `["pending_deletion", "deleting"]`
- Displays sync status icon per file via `<GfsSyncStatusIcon>`
- Shows version number from `file_version.version_number`

### Deletion Flow
- Sets `gfs_sync_status = "pending_deletion"` (does NOT delete the DB row)
- UI dims the row and disables actions while deleting
- `deleted_at` is set later by a DB trigger when `deletion_succeeded` event fires

### Key Props
```ts
interface ProjectFileManagerProps {
  projectId: string;
  initialFiles: { internal: ProjectFile[]; external: ProjectFile[] };
  isOwner: boolean;
}
```

### Reusability for VRAG
The component is tightly coupled to the `project-files` server actions and the `gfs_sync_status` enum. To reuse with a different backend, we need:
1. Swap out the server action imports (or parameterize them)
2. The `ProjectFile` type and `GfsSyncStatus` enum are shared via `@/lib/gfs/sync-types`
3. The polling mechanism (check pending status -> refresh) is generic and reusable

---

## 2. DB Schema

### Core Tables

#### `project_files`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK -> projects | |
| filename | TEXT | |
| access_level | TEXT | 'internal' or 'external' |
| current_version_id | UUID FK -> project_file_versions | Points to latest version |
| gfs_sync_status | gfs_sync_status ENUM | File-level status (for deletion tracking) |
| gfs_doc_id | TEXT | Google document ID |
| is_archived | BOOLEAN | Default false |
| deleted_at | TIMESTAMPTZ | Soft delete (NULL = active) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Unique constraint:** `(project_id, access_level, filename)` — one file per name per access level per project.

#### `project_file_versions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| file_id | UUID FK -> project_files | |
| version_number | INTEGER | |
| storage_path | TEXT | Supabase Storage path |
| file_type | TEXT | Extension without dot |
| size_bytes | BIGINT | |
| gfs_sync_status | gfs_sync_status ENUM | Version-level sync status |
| gfs_doc_id | TEXT | Google document ID for this version |
| store_sync_error | TEXT | Error message if sync failed |
| synced_to_store_at | TIMESTAMPTZ | |
| deleted_from_store_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**Unique constraint:** `(file_id, version_number)`

#### `project_file_search_stores`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK -> projects | |
| access_level | TEXT | 'internal' or 'external' |
| store_type | TEXT | 'file', 'email', or 'drive' |
| google_store_id | TEXT | GFS store resource name |
| google_store_name | TEXT | Display name |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Unique constraint:** `(project_id, access_level, store_type)`

#### `file_sync_events` (event sourcing)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_file_id | UUID FK -> project_files | |
| event_type | gfs_sync_event_type ENUM | sync_started, sync_succeeded, etc. |
| error_message | TEXT | |
| gfs_doc_id | TEXT | Populated on sync_succeeded |
| triggered_by | TEXT | 'upload_api', 'worker', etc. |
| duration_ms | INTEGER | |
| created_at | TIMESTAMPTZ | |

**Trigger:** `trg_update_sync_status` — AFTER INSERT on `file_sync_events`, auto-updates `project_files.gfs_sync_status` and `gfs_doc_id`.

### Shared ENUMs

**`gfs_sync_status`:** `blocked`, `pending`, `processing`, `synced`, `failed`, `excluded`, `pending_deletion`, `deleting`, `deleted`

**`gfs_sync_event_type`:** `sync_started`, `sync_succeeded`, `sync_failed`, `sync_timed_out`, `deletion_started`, `deletion_succeeded`, `deletion_failed`, `deletion_timed_out`, `sync_requested`, `deletion_requested`

### RLS Policies
- **project_files:** Members view by role (owner/internal see all, external sees external only). Only owners CRUD.
- **project_file_versions:** Same role-based visibility via `can_view_project_file()`. Only owners CRUD.
- **project_file_search_stores:** All members can view, only owners manage.
- **file_sync_events:** Service role full access. Members can view/insert for their project's files.

### Storage
- Bucket: `user-files`
- Path format: `{orgs|workspaces}/{container_id}/projects/{project_id}/{access_level}/{file_id}/{version_id}.{ext}`

---

## 3. Sync Worker

**File:** `python-services/agent_api/sync_worker.py`

### Architecture
- Background task started via FastAPI lifespan
- Polls every 10s (configurable via `SYNC_WORKER_POLL_INTERVAL`)
- Uses service-role Supabase client (bypasses RLS)
- Unique worker ID: `Worker-{hostname}-{short_uuid}`

### Claim Mechanism (SKIP LOCKED)
- Uses Postgres RPC functions: `claim_pending_file_sync`, `claim_pending_file_deletion`
- Each call claims exactly ONE row via `SELECT ... FOR UPDATE SKIP LOCKED`
- Worker loops up to `MAX_ITEMS_PER_CYCLE` (default 10) times per cycle
- Concurrent workers naturally partition work via SKIP LOCKED

### Retry & Exclusion
- Max retries: 5 (configurable via `SYNC_WORKER_MAX_RETRIES`)
- Failure count checked in the RPC: counts `sync_failed` events in `file_sync_events`
- After exhausting retries, RPC sets `gfs_sync_status = 'excluded'`

### Sync Flow (upload)
1. `claim_pending_file_sync` RPC claims a row and inserts `sync_started` event
2. Worker calls `ProjectFileSearchService.sync_project_file_upload()`:
   a. Ensures project has a GFS store (`ensure_project_store`)
   b. Downloads file from Supabase Storage to temp dir
   c. Content size gate: extracts text, checks against 3M char limit, marks `excluded` if too large
   d. Builds GFS metadata (file_id, filename, mime_type, access_level, date, size_bytes)
   e. Uploads to Google File Search (display_name = version UUID for dedup)
   f. Persists `gfs_doc_id` early via callback (before polling completes)
   g. Polls for document to reach `STATE_ACTIVE`
   h. Updates version sync status to `synced`
   i. Cleans up old versions from GFS
3. Worker inserts `sync_succeeded` or `sync_failed` event

### Sync Flow (deletion)
1. `claim_pending_file_deletion` RPC claims a row and inserts `deletion_started` event
2. Worker calls `ProjectFileSearchService.sync_project_file_delete()`:
   a. Looks up `gfs_doc_id` from `project_file_versions`
   b. Deletes from GFS (handles 404/403 gracefully)
   c. Updates version sync status to `deleted`
3. Worker inserts `deletion_succeeded` or `deletion_failed` event

### Office File Workaround
- `.csv` and `.docx` use a two-step upload: File API upload -> import into store
- Direct `upload_to_file_search_store` rejects these MIME types
- `.xlsx` and `.pptx` temporarily disabled (Google 500 errors)

---

## 4. Search Service

### Multi-Store Query Service

**File:** `python-services/agent_api/agent/multi_store_query_service.py`

#### Store Types
- `file_store_ids` — uploaded project files (internal/external)
- `email_store_ids` — email stores (internal/external)
- `drive_store_ids` — Google Drive synced files

#### Entity Type Routing
| entity_type | Stores queried | Auto-injected filter |
|-------------|---------------|---------------------|
| `"file"` | file + drive stores | None |
| `"email"` | email stores | `entity_type = "email"` |
| `"email_attachment"` | email stores | `entity_type = "attachment"` |
| `None` | all stores | None |
| `["email", "file"]` | email + file + drive | Per-store filters |

#### Query Execution
- Queries all selected stores **in parallel** via `ThreadPoolExecutor`
- Each store query is a `generate_content()` call to `gemini-2.5-flash` with `FileSearch` tool
- Sentry child spans created on main thread, passed to worker threads
- Results merged: answers concatenated, chunks combined from all stores

#### Response Shape
```python
{
    "success": True,
    "answer": "merged answer text",
    "chunks": [
        {
            "type": "retrieved_context",
            "title": "...",
            "text": "...",
            "uri": "..."
        }
    ],
    "store_results": [...],  # per-store results
    "query": "original query"
}
```

### Project File Search Service

**File:** `python-services/agent_api/project_file_search_service.py`

#### Key Methods
- `ensure_project_store(project_id, access_level, store_type)` — creates GFS store if needed, upserts to `project_file_search_stores`
- `sync_project_file_upload(...)` — full upload pipeline (download, extract, gate, upload, poll)
- `sync_project_file_delete(file_version_id)` — delete from GFS by gfs_doc_id
- `upload_to_google_search(file_path, store_id, display_name, ...)` — handles direct upload vs office workaround
- `download_file_from_storage(storage_path, temp_dir)` — downloads from Supabase `user-files` bucket

#### GFS Metadata Fields for Files
Built via `gfs_metadata.file_fields()`:
- `entity_type`, `file_id`, `filename`, `file_extension`, `mime_type`, `access_level`, `date_epoch`, `size_bytes`

---

## 5. Server Actions

**File:** `nextjs-app/app/actions/project-files.ts`

All actions are thin wrappers that:
1. Get authenticated Supabase client
2. Validate auth
3. Delegate to `@/lib/services/project-files` service layer
4. `revalidatePath` on success

### Actions
| Action | Service method | Notes |
|--------|---------------|-------|
| `uploadProjectFile(projectId, formData)` | `projectFilesService.uploadProjectFile()` | Extracts file + accessLevel from FormData |
| `deleteProjectFile(projectId, fileId)` | `projectFilesService.deleteProjectFile()` | Sets pending_deletion, doesn't hard delete |
| `getProjectFileDownloadUrl(projectId, fileId)` | `projectFilesService.getProjectFileDownloadUrl()` | Returns signed URL (1hr) |
| `getProjectFiles(projectId)` | `projectFilesService.getProjectFiles()` | Returns `{internal: [], external: []}` |

### Service Layer Details

**File:** `nextjs-app/lib/services/project-files/operations.ts`

#### Upload Flow
1. Validate file type (`.txt`, `.md`, `.pdf`, `.docx` allowed for upload)
2. Validate file size (max from `@/lib/upload-limits`)
3. Authorize: must be project owner
4. Get storage container (org or workspace)
5. Find or create `project_files` row (handles concurrent insert via unique violation retry)
6. Generate storage path, upload to Supabase Storage (`user-files` bucket, `upsert: false`)
7. Create `project_file_versions` row (handles concurrent version race)
8. Update `current_version_id` pointer on `project_files`
9. Return with `gfs_sync_status: "pending"` — worker picks it up

#### Delete Flow
1. Authorize: must be project owner
2. Verify file exists and is not deleted
3. Set `gfs_sync_status = "pending_deletion"` (only from sync-lane states)
4. Worker handles actual GFS deletion; DB trigger sets `deleted_at` on `deletion_succeeded`

---

## 6. API Routes

### Search Tool (MCP)

**File:** `python-services/agent_api/agent/file_search_tool.py`

The search is exposed as an MCP tool, not a REST endpoint. Two variants:

#### `search_files` (default)
- Simple query-only tool
- Schema: `{ query: string }` (required)
- Calls `query_service.query_store(query_text)`

#### `semantic_search` (feature-flagged)
- Advanced tool with entity_type and filter support
- Schema: `{ query: string, entity_type?: string|string[], filter?: string }`
- Calls `query_service.query_store(query_text, entity_type=..., metadata_filter=...)`
- Enabled when `"semantic_search"` is in `config.feature_flags`

#### Tool Registration
```python
server = create_sdk_mcp_server(name="file-search", version="1.0.0", tools=[active_tool])
```
Only one variant is registered at a time (the model never sees the other).

### Wiring: chat_service.py -> agent.py

**File:** `python-services/agent_api/chat_service.py` (lines 119-160)

1. `ProjectStoreService(auth_token)` queries `project_file_search_stores` for all stores
2. Filters by user role (external users only see external stores)
3. Creates `MultiStoreQueryService(file_store_ids, email_store_ids, drive_store_ids)`
4. Passes to `Agent(config, file_search_service=multi_store_service)`
5. Agent creates MCP server via `create_file_search_mcp_server(service, use_semantic_search=...)`

### Legacy REST Endpoint (still exists)

**File:** `python-services/agent_api/api/file_search.py`

- `POST /project-file-search/sync` — synchronous sync endpoint (predates the worker)
- Takes `ProjectFileSyncRequest` with operation, project_id, file_id, etc.
- Uses user's JWT for Supabase auth
- Still in the codebase but the worker is the primary sync mechanism

---

## Key Patterns for VRAG Prototype

### Pattern 1: Event-Sourced Sync Status
- `file_sync_events` is append-only, DB trigger denormalizes to `project_files.gfs_sync_status`
- This decouples status tracking from the sync worker
- **VRAG equivalent:** Need similar event table + trigger for Vertex AI Search indexing

### Pattern 2: SKIP LOCKED Work Claiming
- Postgres RPCs atomically claim one item at a time
- Concurrent workers partition work naturally
- Retry limiting done in-database (count failure events)
- **VRAG equivalent:** Same pattern, different target (VAIS instead of GFS)

### Pattern 3: Store-per-Project-per-Access-Level
- Each project gets separate stores for internal/external
- Stores created lazily on first file upload
- Mapped in `project_file_search_stores` table
- **VRAG equivalent:** Each project gets a VAIS DataStore + Engine per access level

### Pattern 4: Version-Based Dedup
- `display_name = version_uuid` enables dedup on retry
- Old versions cleaned up after new version syncs
- **VRAG equivalent:** VAIS document IDs can be version UUIDs

### Pattern 5: Two-Level Sync Status
- `project_files.gfs_sync_status` = file-level (for deletion lifecycle)
- `project_file_versions.gfs_sync_status` = version-level (for upload lifecycle)
- Both use the same `gfs_sync_status` ENUM

### Pattern 6: MCP Tool Interface
- Search exposed as MCP tool, not REST
- `FileSearchService` protocol: `query_store(query_text, entity_type, metadata_filter) -> dict`
- Same protocol for single-store and multi-store implementations
- **VRAG equivalent:** New VAIS query service implementing the same protocol
