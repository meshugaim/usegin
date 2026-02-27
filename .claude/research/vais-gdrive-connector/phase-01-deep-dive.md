# Phase 01: Deep Dive into Existing Google Drive Integration

**Date**: 2026-02-26
**Purpose**: Map the full architecture of Drive integration for VAIS standalone connector extraction

---

## 1. Unified.to Integration

### How OAuth Works

Unified.to is a middleware service that provides pre-verified OAuth apps for third-party integrations. The codebase uses it as the sole intermediary for Google Drive API access.

**SDK**: `unified-python-sdk>=0.57.4` (in `python-services/pyproject.toml`)

**Environment Variables** (3 required):
- `UNIFIED_API_KEY` -- JWT for Unified.to API authentication
- `UNIFIED_WORKSPACE_ID` -- workspace that owns the connections (used in OAuth flow)
- `UNIFIED_WEBHOOK_SECRET` -- HMAC-SHA256 secret for webhook signature verification (optional in dev)

These come from Doppler (secrets management) -- not checked into the repo.

**Client**: `/workspaces/test-mvp/python-services/agent_api/unified_client.py`

`UnifiedClient` is a thin wrapper around the SDK. Key operations:
- `get_auth_url(success_redirect, failure_redirect)` -- generates OAuth URL for Google Drive via `get_unified_integration_auth()` with `integration_type="googledrive"` and scope `storage_file_read`
- `list_files(connection_id, parent_id)` -- lists files/folders in a Drive folder
- `get_file(connection_id, file_id)` -- gets file details including `download_url` (JWT-signed proxy URL, ~1h TTL)
- `download_file(download_url)` -- downloads file content via httpx (120s timeout, follows redirects)
- `list_connections()` -- lists all active workspace connections (recovery after restarts)
- `remove_connection(connection_id)` -- revokes OAuth tokens
- `register_webhooks(connection_id, hook_url)` -- registers CREATED/UPDATED/DELETED webhooks for file change notifications

All methods are defensive: return None/empty on failure, never raise. Errors are logged and sent to Sentry.

### OAuth Flow (Full Sequence)

1. **User clicks "Connect Google Drive"** in project config UI
2. **Next.js server action** `connectDriveAction()` (`nextjs-app/app/actions/project-drive.ts`) calls Python API `POST /api/drive/connect`
3. **Python endpoint** calls `UnifiedClient.get_auth_url()` with success_redirect pointing to Next.js callback URL: `{NEXT_PUBLIC_SITE_URL}/api/drive/callback?project_id={projectId}`
4. **User is redirected** to Unified.to's hosted OAuth page (Google consent screen)
5. **After consent**, Unified.to redirects browser to success_redirect URL with `&id={connection_id}` appended
6. **Next.js callback** (`nextjs-app/app/api/drive/callback/route.ts`) receives the connection ID:
   - Upserts `drive_connections` row (handles soft-delete revival)
   - Fire-and-forget: registers Unified.to webhooks via Python API
   - Redirects user to project config page with `?drive=connected#integrations`
7. **Why the callback lives in Next.js**: The OAuth success_redirect must be a publicly reachable URL. The Python API only has an internal Railway URL (`python-services.railway.internal:8080`), so the callback must live in the Next.js app which has a public domain.

---

## 2. Database Schema

### Tables (3 main + 1 audit)

All in the `public` schema. Created by migration `20260216090347_drive_integration.sql`, modified by several subsequent migrations.

#### `drive_connections`
One connection per project. Tracks Unified.to connection state.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| project_id | UUID FK(projects) | UNIQUE -- one connection per project |
| unified_connection_id | TEXT | Unified.to's connection ID |
| status | TEXT | `active`, `disconnecting`, `error` |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | Soft delete support (added later) |

#### `drive_folder_scopes`
Selected Drive folders for sync. Originally had `access_level` TEXT column (internal/external), migrated to `is_external` BOOLEAN (ENG-2040). Supports multi-folder model -- multiple folders per connection.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| connection_id | UUID FK(drive_connections) | |
| is_external | BOOLEAN | Whether folder is externally accessible |
| remote_folder_id | TEXT | Drive folder ID from Unified.to |
| folder_path | TEXT | Human-readable path (e.g., "My Drive/Reports") |
| parent_scope_id | UUID FK(self) | For nested folder hierarchy |
| created_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | Soft delete support (added later) |

#### `drive_files`
Individual files synced from Drive. One row per file.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| project_id | UUID FK(projects) | |
| folder_scope_id | UUID FK(drive_folder_scopes) | |
| remote_file_id | TEXT | Drive file ID |
| filename | TEXT | |
| mime_type | TEXT | |
| size_bytes | BIGINT | |
| folder_path | TEXT | |
| is_external | BOOLEAN | |
| content_hash | TEXT | SHA-256 for change detection |
| storage_path | TEXT | Path in `drive-files` Supabase Storage bucket |
| gfs_sync_status | gfs_sync_status ENUM | `pending`, `downloading`, `stored`, `processing`, `synced`, `failed`, `upload_failed`, `download_failed`, `excluded`, `awaiting_confirmation`, `pending_deletion`, `deleting`, `deleted`, `retry_exhausted` |
| gfs_doc_id | TEXT | GFS document ID after upload |
| last_synced_at | TIMESTAMPTZ | |
| remote_updated_at | TIMESTAMPTZ | Drive-side modification time |
| is_excluded | BOOLEAN | User-toggled exclusion |
| sync_error | TEXT | Last error message |
| retry_reset_at | TIMESTAMPTZ | |
| force_sync_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | Soft delete |

Unique constraint: `(project_id, remote_file_id)` -- partial index WHERE `deleted_at IS NULL`.

#### `drive_sync_events`
Append-only audit log. Mirrors `file_sync_events`.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| drive_file_id | UUID FK(drive_files) | |
| event_type | gfs_sync_event_type ENUM | |
| error_message | TEXT | |
| gfs_doc_id | TEXT | |
| triggered_by | TEXT | Default: `sync_worker` |
| duration_ms | INTEGER | |
| created_at | TIMESTAMPTZ | |

### Database Trigger
`trg_update_drive_sync_status` -- auto-updates `drive_files.gfs_sync_status` when events are inserted.

### RPC Functions (Atomic Claims)
- `claim_pending_drive_download(p_max_retries, p_cooldown_minutes)` -- claims one file needing download (SKIP LOCKED)
- `claim_pending_drive_sync(p_max_retries, p_cooldown_minutes)` -- claims one file needing GFS upload (SKIP LOCKED)
- `claim_pending_drive_deletion()` -- claims one file needing deletion

### Storage Bucket
`drive-files` -- private Supabase Storage bucket (25MB limit, no MIME restriction). Service-role access only.

### RLS
All tables have RLS enabled. `is_project_owner()` function gates access. Service role bypasses RLS.

---

## 3. File Sync Pipeline

### Two-Stage Decoupled Architecture

The sync pipeline is split into two independent stages, both run by the same `SyncWorker` (`python-services/agent_api/sync_worker.py`):

#### Stage 1: Download (Drive -> Supabase Storage)
- **Method**: `DriveSyncService.download_drive_file(file_record)`
- **RPC**: `claim_pending_drive_download` (SKIP LOCKED)
- **Flow**:
  1. Resolve Unified.to connection ID through FK chain: `drive_files.folder_scope_id` -> `drive_folder_scopes.connection_id` -> `drive_connections.unified_connection_id`
  2. Get fresh file details from Unified.to (download_url is a JWT-signed proxy URL, ~1h TTL)
  3. Download file content via httpx
  4. Compute SHA-256 content hash; skip if unchanged
  5. Write to temp file with correct extension (Google Workspace files are auto-converted to Office equivalents by Unified.to)
  6. Upload to `drive-files` Supabase Storage bucket at path: `{project_id}/{access_level}/{remote_file_id}{ext}`
- **Status transitions**: `pending` -> `downloading` -> `stored` (success) or `download_failed` (failure)

#### Stage 2: GFS Upload (Supabase Storage -> GFS)
- **Method**: `DriveSyncService.sync_drive_file(file_record)`
- **RPC**: `claim_pending_drive_sync` (SKIP LOCKED)
- **Flow**:
  1. Download file content from Supabase Storage (`drive-files` bucket)
  2. Truncate large text files (>1MB) for GFS indexing (full file stays in Storage)
  3. Content gate: extract text, check for empty/too-large content
  4. Ensure GFS store exists: `ensure_project_store(project_id, access_level, store_type="drive")`
  5. Build metadata using `gfs_metadata.file_fields()` + `to_custom_metadata()`
  6. Clean up orphaned GFS doc from previous failed attempt (if `gfs_doc_id` exists)
  7. Upload to GFS via `upload_to_google_search()` with early doc_id persistence callback
  8. Update `drive_files` record: `gfs_sync_status='synced'`, `gfs_doc_id`, `storage_path`, `last_synced_at`
- **Status transitions**: `stored` -> `processing` -> `synced` (success) or `upload_failed` (failure)

#### File Deletion
- **Method**: `DriveSyncService.delete_drive_file(file_record)`
- **Flow**: Delete from GFS (ignore 404/403), delete from Supabase Storage (best-effort), soft-delete the `drive_files` row

### Change Detection
- **Webhooks**: Unified.to sends CREATED/UPDATED/DELETED events to `POST /webhooks/unified`. Python endpoint verifies HMAC-SHA256 signature, resolves scope via ancestor folder walking, and updates `drive_files` status.
- **Manual polling**: `POST /drive/poll/{project_id}` -- BFS walk of scoped folders via Unified.to, compares with existing DB records.
- **Content hashing**: SHA-256 hash comparison skips re-download if content unchanged.
- **Cooldown**: 30-minute debounce window prevents re-sync of recently synced files.

### Sync Worker Integration
The `SyncWorker` class (`sync_worker.py`) runs all pipelines in a single background task:
- Main loop polls every 10s (configurable)
- Concurrent stages: `process_drive_downloads`, `process_pending_drive_syncs`, `process_pending_drive_deletions`, `cleanup_timed_out_drive_files`, `cleanup_timed_out_drive_downloads`
- All run via `asyncio.run_in_executor()` for non-blocking I/O

---

## 4. Frontend UI

### Location
All Drive UI lives within the project config page:

- **Integrations tab**: `/workspaces/test-mvp/nextjs-app/app/projects/[projectId]/config/integrations-tab-content.tsx`
  - Shows "Google Drive" card with connection status badge (Connected / Not Connected / Error)
  - "Connect" button starts OAuth flow
  - Opens `DriveConfigModal` when connected

- **Drive config modal**: `/workspaces/test-mvp/nextjs-app/app/projects/[projectId]/config/drive-config-modal.tsx`
  - Full-featured modal with folder browsing, selection, file list, exclusion toggles, external/internal tagging
  - Folder picker: tree-style navigation of Drive folders via `listDriveFoldersAction` (calls Python API -> Unified.to)
  - Folder selection: creates scope + triggers BFS scan via `selectDriveFolderAction`
  - File exclusion: per-file toggle via `toggleDriveFileExclusionAction`
  - External toggle: per-folder and per-file via `toggleFolderExternalAction` / `toggleFileExternalAction`
  - Disconnect button

- **Server actions**: `/workspaces/test-mvp/nextjs-app/app/actions/project-drive.ts`
  - ~1200 lines of server actions
  - All actions check auth (`supabase.auth.getUser()`), then call Python API with service-role auth
  - Actions: `connectDriveAction`, `getDriveConnectionAction`, `getDriveFilesAction`, `getDriveFolderScopesAction`, `listDriveFoldersAction`, `selectDriveFolderAction`, `toggleDriveFileExclusionAction`, `confirmDriveSyncAction`, `forceSyncDriveFilesAction`, `disconnectDriveAction`, `deselectDriveFolderAction`, `getDriveFolderInfoAction`, `toggleFileExternalAction`, `toggleFolderExternalAction`

- **OAuth callback**: `/workspaces/test-mvp/nextjs-app/app/api/drive/callback/route.ts`
  - Receives `?id=<connection_id>&project_id=<uuid>` from Unified.to redirect
  - Upserts `drive_connections` record
  - Fire-and-forget webhook registration

---

## 5. Coupling Assessment

### Tightly Coupled to Main App

| Component | Coupling | Why |
|-----------|----------|-----|
| `drive_connections` table | **Strong** | FK to `projects(id)`, RLS uses `is_project_owner()` |
| `drive_files` table | **Strong** | FK to `projects(id)`, `drive_folder_scopes(id)` |
| `DriveSyncService` | **Strong** | Imports `ProjectFileSearchService` (GFS), `TextExtractionService`, `gfs_metadata`, `SYNCABLE_EXTENSIONS`, `WORKSPACE_MIME_MAP` |
| `sync_worker.py` | **Strong** | Orchestrates email sync, file sync, and drive sync in single worker |
| `api/drive.py` | **Strong** | Uses `ProjectFileSearchService` for GFS deletion, service-role Supabase |
| Server actions | **Strong** | Use `createClient()` from Next.js Supabase, `getPythonApiUrl()`, `getSentryTraceHeaders()` |
| OAuth callback | **Medium** | Uses `getSupabaseAdmin()`, `NEXT_PUBLIC_SITE_URL`, redirects to project config page |

### Standalone-Extractable Parts

| Component | Extractability | Notes |
|-----------|---------------|-------|
| `UnifiedClient` | **High** | Self-contained wrapper. Only deps: `httpx`, `unified_python_sdk`, `sentry_sdk`. No project/GFS imports. |
| `DriveSyncService.download_drive_file()` | **Medium** | Stage 1 (Drive -> Storage) is independent of GFS. Could be extracted if you replace Supabase Storage with any blob store. |
| `DriveSyncService.scan_folder()` | **Medium** | BFS folder scan is useful. Depends on Supabase for DB but the scan logic itself is clean. |
| OAuth flow pattern | **High** | The Unified.to OAuth pattern (get_auth_url -> redirect -> callback -> store connection_id) is reusable. |
| DB schema pattern | **High** | The 3-table pattern (connections, folder_scopes, files) is a good model for standalone use. |

### What Cannot Be Extracted Easily

| Component | Blocker |
|-----------|---------|
| `DriveSyncService.sync_drive_file()` | Deeply intertwined with GFS: `ProjectFileSearchService`, `ensure_project_store()`, `upload_to_google_search()`, `gfs_metadata` |
| `sync_worker.py` | Orchestrates all sync types (files, emails, drive) in one worker class |
| Frontend server actions | Every action checks Supabase auth, calls main app's Python API |
| RLS policies | All use `is_project_owner()` function from main app |

---

## 6. VAIS Prototype Current State

### No Drive Awareness Whatsoever

Searched both `python-services/agent_api/vais/` and `vais-ui/` -- **zero references** to Drive, Google Drive, Unified.to, or any Drive-related concepts.

### VAIS Architecture

**Schema**: `vais_prototype` (separate Postgres schema, not in `public`)

**Tables**:
- `vais_stores` -- one per project, tracks VAIS DataStore + Engine pair
- `vais_documents` -- tracked documents with sync status, metadata, soft delete
- `vais_document_versions` -- version tracking per document
- `vais_sync_events` -- audit log

**Upload path**: Manual file upload via VAIS API -> Supabase Storage (`user-files` bucket) -> VAIS sync worker -> GCS staging -> JSONL import to Discovery Engine

**Key difference from GFS**:
- GFS uses 6 stores per project (internal/external x file/email/drive)
- VAIS uses **1 DataStore per project** with metadata filtering (`access_level`, `entity_type`)

### VAIS Sync Worker
`/workspaces/test-mvp/python-services/agent_api/vais/sync_worker.py`
- Separate from GFS sync worker (parallel background task)
- Same pattern: poll -> claim via RPC (SKIP LOCKED) -> process -> update status
- Reads from Supabase Storage (`user-files` bucket), uploads to VAIS via GCS + JSONL

### VAIS UI
`/workspaces/test-mvp/vais-ui/` -- standalone Next.js app
- File manager page: manual file upload, document list, deletion
- Calls VAIS API directly (`NEXT_PUBLIC_VAIS_API_URL`)
- No auth (prototype-grade)
- No Drive UI at all

### VAIS API
`/workspaces/test-mvp/python-services/agent_api/api/vais.py`
- Store status, document upload/list/delete, semantic search
- Service-role Supabase (no JWT validation, prototype-grade)

### VAIS Metadata Schema
```json
{
  "project_id": { "type": "string", "indexable": true },
  "access_level": { "type": "string", "indexable": true },
  "entity_type": { "type": "string", "indexable": true },
  "file_type": { "type": "string", "indexable": true },
  "file_id": { "type": "string", "indexable": true },
  "file_name": { "type": "string", "retrievable": true },
  "uploaded_at": { "type": "number", "indexable": true }
}
```

---

## 7. Key Blockers and Decisions for VAIS Drive Connector

### Must-Decide

1. **New DB tables or extend existing?**
   - Option A: Create `vais_prototype.vais_drive_connections`, `vais_drive_folder_scopes`, `vais_drive_files` in the VAIS schema (fully standalone)
   - Option B: Reuse existing `public.drive_connections`, `drive_folder_scopes`, `drive_files` tables (shared state with GFS pipeline)
   - Option C: Create bridge table (`vais_drive_documents`) that links `drive_files.id` to `vais_documents.id`
   - **Recommendation**: Option A for true standalone, Option C if you want to avoid duplicating Unified.to connections

2. **Shared or separate Unified.to connection?**
   - If the main app already has a Drive connection for a project, should VAIS reuse it?
   - For standalone prototype: separate connections (simpler, no coupling to main app state)

3. **entity_type value for Drive files**
   - `"file"` (treat same as manual uploads) vs `"drive_file"` (distinguishable)
   - Research recommends `"file"` unless filtering by source is needed

4. **Storage bucket**
   - Main app uses `drive-files` bucket
   - VAIS manual uploads use `user-files` bucket
   - For standalone Drive connector: could use either, or a new `vais-drive-files` bucket

### Prerequisites (Need from User)

- `UNIFIED_API_KEY` and `UNIFIED_WORKSPACE_ID` -- required for Drive OAuth
- `UNIFIED_WEBHOOK_SECRET` -- optional for dev, required for production webhook verification
- `VAIS_SYNC_ENABLED=true` -- to enable VAIS sync worker
- GCP Application Default Credentials -- for VAIS/Discovery Engine API access
- `NEXT_PUBLIC_SITE_URL` -- for OAuth redirect (callback URL must be publicly reachable)

### Architecture Risk

The `UnifiedClient` is highly reusable standalone. But the full pipeline (OAuth -> folder selection -> BFS scan -> download -> upload to VAIS) requires rebuilding the orchestration layer. The existing one is ~1500 lines of Python API endpoints (`api/drive.py`) tightly coupled to `ProjectFileSearchService` and the GFS status machine.

**Estimated reuse vs rebuild**:
- `UnifiedClient`: **100% reusable** as-is (copy the file)
- OAuth flow pattern: **90% reusable** (same pattern, different callback URL)
- Folder scan logic: **70% reusable** (`DriveSyncService.scan_folder()` minus GFS deps)
- Download logic: **80% reusable** (`download_drive_file()` minus GFS status machine)
- GFS upload logic: **0% reusable** (need VAIS upload instead)
- API endpoints: **30% reusable** (need to rewrite for VAIS schema/types)
- Frontend: **20% reusable** (server actions are tightly coupled to main app auth)
- DB schema: **70% reusable** (same pattern, different schema/table names)
