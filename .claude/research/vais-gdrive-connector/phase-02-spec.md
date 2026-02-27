# Phase 02: VAIS Google Drive Connector — Implementation Spec

Spec date: 2026-02-26
Research: `phase-01-deep-dive.md`, `research-findings.md`

---

## Slice Inventory

8 slices, ordered by dependency:

| # | Title | Layer | Depends On |
|---|-------|-------|------------|
| 1 | DB migration -- `vais_drive_*` tables, RPCs, triggers | DB | -- |
| 2 | Drive connector service -- OAuth, folder browse, file scan | Python | 1 |
| 3 | Drive sync pipeline -- download from Drive, upload to VAIS | Python | 1, 2 |
| 4 | Extend VAIS sync worker -- Drive file processing loop | Python | 3 |
| 5 | Drive API routes -- connect, callback, folders, sync, status | Python | 2, 3, 4 |
| 6 | UI: Connect Drive page | vais-ui | 5 |
| 7 | UI: Folder picker + sync dashboard | vais-ui | 5, 6 |
| 8 | Integration smoke test | Manual | all |

```
Slice 1 (DB) <- Slice 2 (service) <- Slice 3 (pipeline) <- Slice 4 (worker) <- Slice 5 (routes) <- Slices 6-7 (UI, sequential) <- Slice 8 (test)
```

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| DB location | `vais_prototype` schema, `vais_drive_*` prefixed tables | Standalone, no coupling to `public.drive_*` |
| OAuth callback | Python endpoint in `vais_server.py` | Simpler than vais-ui route handler; localhost works for dev |
| Unified.to client | Import from `agent_api.unified_client` | 100% reusable, zero GFS coupling |
| entity_type | `"drive_file"` | Distinguishable from manual uploads in search filters |
| Storage bucket | `user-files` (existing VAIS bucket) | Reuse existing sync worker download path |
| Sync approach | Extend existing VAIS sync worker with Drive-specific claim RPC | One worker, two claim sources (manual + drive) |
| Folder scan | BFS via `UnifiedClient.list_files()` | Same proven pattern as existing Drive integration |
| Google Workspace files | Support .docx/.xlsx/.pptx exports via Unified.to auto-conversion | Same as existing Drive pipeline |
| Metadata schema | No changes needed | Current VAIS schema already has all needed fields; `entity_type: "drive_file"` is a new value but schema is string-typed |

## Environment Variables Required

Already configured (from existing Unified.to integration):
- `UNIFIED_API_KEY` -- JWT for Unified.to API auth
- `UNIFIED_WORKSPACE_ID` -- workspace that owns connections

New (needs to be set):
- `VAIS_PUBLIC_URL` -- base URL for OAuth callback (default: `http://localhost:58200` for dev)
- `VAIS_UI_URL` -- base URL of the vais-ui frontend, used for post-OAuth redirect (default: `http://localhost:63200` for dev)

Already configured (from existing VAIS prototype):
- `VAIS_SYNC_ENABLED=true` -- enables sync worker
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- GCP ADC credentials

---

## Section 1: DB Schema

All tables in `vais_prototype` schema. Migration file: `supabase/migrations/YYYYMMDDHHMMSS_vais_drive_connector.sql`

### Table: `vais_drive_connections`

One row per project. Stores the Unified.to connection ID after OAuth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID PK | `DEFAULT gen_random_uuid()` | |
| project_id | UUID | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE`, UNIQUE | One connection per project |
| unified_connection_id | TEXT | `NOT NULL` | Unified.to's connection ID (from OAuth callback) |
| status | TEXT | `NOT NULL DEFAULT 'active'`, CHECK `('active', 'disconnected', 'error')` | |
| error_message | TEXT | | Last error |
| created_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |
| updated_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |

Indexes: `project_id`, `status`.
Trigger: `updated_at` via `update_updated_at_column()`.

### Table: `vais_drive_folders`

Selected Drive folders for sync. One row per folder scope.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID PK | `DEFAULT gen_random_uuid()` | |
| connection_id | UUID | `NOT NULL REFERENCES vais_drive_connections(id) ON DELETE CASCADE` | |
| project_id | UUID | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Denormalized for query convenience |
| remote_folder_id | TEXT | `NOT NULL` | Drive folder ID from Unified.to |
| folder_name | TEXT | `NOT NULL` | Human-readable folder name |
| folder_path | TEXT | | Full path (e.g., "My Drive/Reports") |
| access_level | TEXT | `NOT NULL DEFAULT 'internal'`, CHECK `('internal', 'external')` | |
| scan_status | TEXT | `NOT NULL DEFAULT 'pending'`, CHECK `('pending', 'scanning', 'scanned', 'error', 'pending_removal')` | `pending_removal` = folder marked for deletion, waiting for file cleanup |
| last_scanned_at | TIMESTAMPTZ | | |
| file_count | INTEGER | `NOT NULL DEFAULT 0` | Count of discovered files |
| created_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |
| updated_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |

Indexes: `connection_id`, `project_id`, `(project_id, remote_folder_id)` unique.
Trigger: `updated_at` via `update_updated_at_column()`.

### Table: `vais_drive_files`

Individual Drive files discovered in scoped folders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID PK | `DEFAULT gen_random_uuid()` | |
| folder_id | UUID | `NOT NULL REFERENCES vais_drive_folders(id) ON DELETE RESTRICT` | Which folder scope (RESTRICT, not CASCADE -- see "Folder Removal Lifecycle" below) |
| project_id | UUID | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Denormalized |
| remote_file_id | TEXT | `NOT NULL` | Drive file ID |
| file_name | TEXT | `NOT NULL` | |
| mime_type | TEXT | | Original Drive MIME type |
| size_bytes | BIGINT | | File size (may be null for Google Workspace types) |
| access_level | TEXT | `NOT NULL` | Inherited from folder |
| content_hash | TEXT | | SHA-256 for change detection |
| storage_path | TEXT | | Path in `user-files` bucket after download |
| sync_status | vais_prototype.vais_sync_status | `NOT NULL DEFAULT 'pending'` | Reuse existing VAIS enum (schema-qualified because enum lives in `vais_prototype`) |
| sync_error | TEXT | | |
| retry_count | INTEGER | `NOT NULL DEFAULT 0` | |
| vais_document_id | TEXT | | VAIS doc ID after successful import |
| remote_updated_at | TIMESTAMPTZ | | Drive-side modification time |
| last_synced_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |
| updated_at | TIMESTAMPTZ | `NOT NULL DEFAULT NOW()` | |

Indexes:
- `folder_id`
- `project_id`
- `(project_id, remote_file_id)` unique partial WHERE `sync_status != 'deleted'`
- `sync_status` partial WHERE `sync_status IN ('pending', 'failed')`

Trigger: `updated_at` via `update_updated_at_column()`.

### Folder Removal Lifecycle (Soft-Delete Pattern)

`vais_drive_files.folder_id` uses `ON DELETE RESTRICT` (not CASCADE) to prevent a race condition: CASCADE would hard-delete file rows before the sync worker can process `pending_deletion` status, leaving orphaned documents in VAIS.

**Removal sequence (enforced in `remove_folder_scope`):**

1. Mark all `vais_drive_files` under the folder as `sync_status = 'pending_deletion'`
2. Sync worker claims each file via `claim_pending_vais_drive_deletion`, deletes from VAIS, sets `sync_status = 'deleted'`
3. Once all files for the folder have `sync_status = 'deleted'` (or there are none), hard-delete the file rows: `DELETE FROM vais_drive_files WHERE folder_id = X`
4. Hard-delete the folder row: `DELETE FROM vais_drive_folders WHERE id = X`

Steps 3-4 can be handled by a cleanup pass in `remove_folder_scope` (poll until all files are deleted, or by the sync worker itself after processing the last deletion for a folder). For the prototype, the API endpoint marks files as `pending_deletion` and returns immediately. The sync worker processes deletions. A periodic cleanup task (or manual re-call) garbage-collects the folder row once all its files are gone.

### RPC: `claim_pending_vais_drive_sync`

Same pattern as `claim_pending_vais_sync`. Claims one Drive file needing VAIS upload.

```sql
CREATE OR REPLACE FUNCTION vais_prototype.claim_pending_vais_drive_sync(p_max_retries INTEGER DEFAULT 5)
RETURNS SETOF vais_prototype.vais_drive_files
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE vais_prototype.vais_drive_files
    SET sync_status = 'processing', updated_at = NOW()
    WHERE id = (
        SELECT id FROM vais_prototype.vais_drive_files
        WHERE sync_status IN ('pending', 'failed')
        AND retry_count < p_max_retries
        AND storage_path IS NOT NULL  -- must have been downloaded first
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;
```

Key: `storage_path IS NOT NULL` ensures we only claim files that have been downloaded to Supabase Storage. The scan + download step sets `storage_path` before marking as `pending`.

### RPC: `claim_pending_vais_drive_deletion`

```sql
CREATE OR REPLACE FUNCTION vais_prototype.claim_pending_vais_drive_deletion()
RETURNS SETOF vais_prototype.vais_drive_files
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE vais_prototype.vais_drive_files
    SET sync_status = 'deleting', updated_at = NOW()
    WHERE id = (
        SELECT id FROM vais_prototype.vais_drive_files
        WHERE sync_status = 'pending_deletion'
        ORDER BY updated_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;
```

### RLS Policies

Same pattern as existing VAIS tables: service role bypasses RLS, RLS uses `is_project_owner()` for write, project members for read. See `20260226110953_vais_prototype.sql` for the exact pattern to follow.

---

## Section 2: Drive Connector Service

New file: `python-services/agent_api/vais/drive_connector.py`

### Class: `VaisDriveConnector`

Handles OAuth flow, folder browsing, and file scanning. Does NOT do VAIS upload (that's the sync worker's job).

**Constructor**: Takes `supabase: Client` (service-role). Creates `UnifiedClient` internally.

**Key reference files**:
- `agent_api/unified_client.py` -- reuse directly via import
- `agent_api/drive_sync_service.py` -- patterns for download, extension mapping, supported file types

### Methods

#### `initiate_oauth(project_id: str) -> str | None`

1. Build callback URL with `project_id` baked in: `{VAIS_PUBLIC_URL}/api/vais/drive/callback?project_id={project_id}`
2. Call `UnifiedClient.get_auth_url(success_redirect=callback_url, failure_redirect=callback_url)`
3. Return the OAuth URL (browser redirect target)

**Important: `project_id` propagation.** The callback needs both `project_id` (ours) and `id` (Unified.to's connection ID). Since Unified.to appends `&id=Y` to the `success_redirect` URL on completion, we bake `project_id` into the redirect URL at initiation time. The callback then receives both: `/api/vais/drive/callback?project_id=X&id=Y`.

No DB writes yet -- connection is created in the callback.

#### `handle_callback(project_id: str, connection_id: str) -> dict`

Called when Unified.to redirects back with `?id=connection_id`.

1. Upsert `vais_drive_connections` row: `(project_id, unified_connection_id=connection_id, status='active')`
2. Return `{success: True, connection_id: row_id}`

Handle case where project already has a connection (re-connect scenario): update existing row, set status='active'.

#### `list_drive_folders(project_id: str, parent_id: str | None = None) -> list[dict]`

1. Look up `vais_drive_connections` for project -> get `unified_connection_id`
2. Call `UnifiedClient.list_files(connection_id, parent_id)`
3. Filter to folders only (`is_folder=True`)
4. Return `[{id, name, path}]`

#### `add_folder_scope(project_id: str, remote_folder_id: str, folder_name: str, folder_path: str, access_level: str) -> dict`

1. Insert `vais_drive_folders` row
2. Return the folder scope record

#### `remove_folder_scope(project_id: str, folder_id: str) -> dict`

Follows the soft-delete pattern (see "Folder Removal Lifecycle" in Section 1):

1. Mark all `vais_drive_files` under this folder as `sync_status = 'pending_deletion'`
2. Set `vais_drive_folders.scan_status = 'pending_removal'` (folder stays in DB until files are cleaned up)
3. Return `{success: True, pending_deletions: N}`

The folder row is **not** deleted immediately. The sync worker processes file deletions from VAIS, then a cleanup pass garbage-collects folder rows where all files have been deleted (or the folder has zero files). This prevents the RESTRICT FK from blocking and ensures no orphaned documents remain in VAIS.

#### `scan_folder(folder_scope: dict) -> dict`

BFS scan of a Drive folder. Discovers all supported files. **Runs as a background task** -- the calling endpoint returns immediately with `scan_status: 'scanning'` and the client polls for completion.

**Phase 1: Discovery (fast, seconds)**
1. Set `vais_drive_folders.scan_status = 'scanning'`
2. Get `unified_connection_id` from parent connection
3. BFS walk: start with `remote_folder_id`, recurse into subfolders
4. For each file:
   - Check if supported (use same `SYNCABLE_EXTENSIONS` logic from `drive_sync_service.py`, plus VAIS-specific types like `.html`)
   - Check if already in `vais_drive_files` (by `remote_file_id`)
   - If new: insert row with `sync_status='pending'`, `storage_path=NULL`
   - If exists: check `remote_updated_at` for changes
5. Update `vais_drive_folders.file_count`, `last_scanned_at`

**Phase 2: Download (slow, runs per-file in background)**
6. For each file with `storage_path IS NULL`:
   - Download from Drive via Unified.to
   - Upload to `user-files` bucket at path: `vais-drive/{project_id}/{remote_file_id}/{file_name}`
   - Set `storage_path` on the `vais_drive_files` row
   - On download failure: leave `storage_path` NULL, set `sync_status='failed'` (re-scan retries)
7. Update `vais_drive_folders.scan_status = 'scanned'`

This two-phase approach means discovery is fast (API metadata calls only) and the HTTP endpoint never blocks on large file downloads. The sync worker picks up files as soon as their `storage_path` is set.

**Supabase Storage note:** File upload to the `user-files` bucket uses `supabase.storage.from_("user-files").upload(path, data, ...)`. This works with the service-role key (which the connector already has). No additional bucket configuration or RLS changes needed -- service-role bypasses storage RLS.

**Supported file types** (same as VAIS `VAIS_MIME_TYPES` in `document_service.py`):
- txt, md, pdf, docx, pptx, xlsx, csv, html
- Google Workspace types via Unified.to auto-conversion (Docs->docx, Sheets->xlsx, Slides->pptx)

#### `get_connection_status(project_id: str) -> dict | None`

Return connection info + folder scopes + file counts. Used by the status API endpoint.

#### `disconnect(project_id: str) -> dict`

1. Mark all Drive files across all folder scopes as `pending_deletion`
2. Update connection status to `'disconnected'`
3. Call `UnifiedClient.remove_connection(unified_connection_id)` to revoke OAuth tokens
4. Return `{success: True}`

---

## Section 3: Drive Sync Pipeline

Extends: `python-services/agent_api/vais/sync_worker.py`

### How Drive Files Enter the VAIS Pipeline

Drive files follow the same upload path as manual files:

```
Drive file (discovered by scan)
  -> Downloaded to Supabase Storage during scan (storage_path set)
  -> Claimed by sync worker via claim_pending_vais_drive_sync RPC
  -> Downloaded from Supabase Storage
  -> Uploaded to VAIS via VaisDocumentService.upload_document()
  -> Status updated to 'synced' in vais_drive_files
```

### New Method on VaisSyncWorker: `process_pending_drive_syncs`

Same pattern as `process_pending_syncs()` but claims from `vais_drive_files` table instead of `vais_documents`.

For each claimed Drive file:
1. Get or create VAIS store for the project (same `VaisStoreService.get_or_create_store()`)
2. Download from Supabase Storage (`user-files` bucket, path from `storage_path`)
3. Build metadata:
   ```python
   {
       "project_id": file["project_id"],
       "access_level": file["access_level"],
       "entity_type": "drive_file",
       "file_id": file["id"],  # our UUID
       "file_name": file["file_name"],
       "file_type": get_file_type(file["file_name"]),
       "uploaded_at": int(time.time()),
   }
   ```
4. Upload to VAIS: `doc_service.upload_document(datastore_id, document_id=f"vais-drive-{file_id}", file_bytes, mime_type, metadata)`
5. Update `vais_drive_files`: `sync_status='synced'`, `vais_document_id`, `last_synced_at`
6. Insert audit event to `vais_sync_events` (reuse same table, use `triggered_by='drive_worker'`)

### New Method: `process_pending_drive_deletions`

Same pattern as `process_pending_deletions()`, claims from `vais_drive_files` where `sync_status='pending_deletion'`.

1. Look up VAIS document ID from `vais_drive_files.vais_document_id`
2. Call `doc_service.delete_document(datastore_id, vais_document_id)`
3. Update status to `'deleted'`

### Worker Loop Integration

In `run_vais_sync_worker()`, add Drive processing to each cycle:

```python
# Existing: process manual uploads
syncs, deletions = await loop.run_in_executor(None, worker.run_cycle, prefix)

# New: process Drive files
drive_syncs, drive_deletions = await loop.run_in_executor(None, worker.run_drive_cycle, prefix)
```

The `run_drive_cycle()` method calls `process_pending_drive_syncs()` then `process_pending_drive_deletions()`.

---

## Section 4: API Routes

New file: `python-services/agent_api/api/vais_drive.py`

Router prefix: `/api/vais/drive` (added to `vais_server.py`)

### Endpoints

#### `GET /connect?project_id={uuid}`

Initiates OAuth flow. Returns redirect URL.

Response: `{"auth_url": "https://api.unified.to/unified/integration/auth/..."}` or `{"error": "..."}`.

Browser should redirect to `auth_url`.

#### `GET /callback?project_id={uuid}&id={connection_id}`

OAuth callback from Unified.to. This is a browser redirect, not an API call.

`project_id` comes from our `success_redirect` URL (baked in by `initiate_oauth`). `id` is appended by Unified.to on successful OAuth. Both are required query params.

1. Validate both `project_id` and `id` are present (if missing, redirect with `?error=oauth_failed`)
2. Call `drive_connector.handle_callback(project_id, connection_id)`
3. Redirect browser to `{VAIS_UI_URL}/vais/drive?project_id={project_id}&connected=true`

Where `VAIS_UI_URL` comes from the env var (default `http://localhost:63200` for dev).

#### `GET /projects/{project_id}/connection`

Get connection status.

Response:
```json
{
  "connected": true,
  "connection_id": "uuid",
  "status": "active",
  "folders": [
    {
      "id": "uuid",
      "folder_name": "Reports",
      "folder_path": "My Drive/Reports",
      "access_level": "internal",
      "scan_status": "scanned",
      "file_count": 12,
      "last_scanned_at": "2026-02-26T..."
    }
  ]
}
```

#### `GET /projects/{project_id}/folders?parent_id={optional}`

Browse Drive folders (for folder picker UI).

Response:
```json
{
  "folders": [
    {"id": "remote_folder_id", "name": "Reports", "path": "My Drive/Reports"}
  ]
}
```

#### `POST /projects/{project_id}/folders`

Add a folder scope.

Body:
```json
{
  "remote_folder_id": "...",
  "folder_name": "Reports",
  "folder_path": "My Drive/Reports",
  "access_level": "internal"
}
```

Response: folder scope record with `scan_status: 'scanning'`.

Side effect: triggers folder scan as a **background task** (via FastAPI `BackgroundTasks`). The endpoint returns immediately. The scan runs discovery (fast BFS metadata walk) then downloads files (slow). Client polls `GET /projects/{project_id}/connection` to observe `scan_status` transition: `'scanning'` -> `'scanned'`.

#### `DELETE /projects/{project_id}/folders/{folder_id}`

Remove a folder scope. Marks all files as `pending_deletion`.

#### `POST /projects/{project_id}/sync`

Trigger a re-scan of all active folder scopes. Returns immediately; scans run as background tasks.

1. Set `scan_status = 'scanning'` on all active folder scopes
2. Kick off background scan for each scope (discovery + download phases)
3. Return `{scanning: N}` where N = number of folder scopes being re-scanned

Client polls `GET /projects/{project_id}/connection` to track scan progress per folder.

#### `GET /projects/{project_id}/files`

List all Drive files for the project across all folder scopes.

Query params: `?folder_id=uuid` (optional filter), `?status=synced` (optional filter)

Response:
```json
{
  "files": [
    {
      "id": "uuid",
      "file_name": "Q1 Report.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 102400,
      "access_level": "internal",
      "sync_status": "synced",
      "sync_error": null,
      "folder_name": "Reports",
      "remote_updated_at": "2026-02-25T...",
      "last_synced_at": "2026-02-26T..."
    }
  ]
}
```

#### `DELETE /projects/{project_id}/disconnect`

Disconnect Drive. Marks all files for deletion, revokes OAuth.

### Wiring into `vais_server.py`

```python
from agent_api.api.vais_drive import router as vais_drive_router
app.include_router(vais_drive_router, prefix="/api/vais/drive", tags=["vais-drive"])
```

---

## Section 5: UI Pages

All in `vais-ui/app/vais/drive/`. Add "Drive" nav link in `vais-ui/app/layout.tsx`.

### Page: `/vais/drive` -- Connect & Dashboard

This is the main Drive management page. Two states:

**State 1: Not Connected**
- Project ID input (same pattern as file manager page)
- "Connect Google Drive" button
- Clicking button: calls `GET /api/vais/drive/connect?project_id=X`, then `window.location.href = auth_url`
- After OAuth, browser redirects back to `/vais/drive?project_id=X&connected=true`

**State 2: Connected**
- Connection status badge (Active / Error)
- Folder scopes list (table):
  - Folder name, path, access level (Internal/External badge), file count, scan status, last scanned
  - Remove button per folder (disabled while `scan_status = 'scanning'`)
- "Add Folder" button opens folder picker (inline or modal)
- "Sync All" button triggers `POST /sync`
- "Disconnect" button with confirmation
- **Scan polling**: When any folder has `scan_status = 'scanning'`, poll `GET /projects/{project_id}/connection` every 3s (same pattern as file manager auto-refresh). Show a spinner/progress indicator on the folder row. Stop polling once all folders are `'scanned'` or `'error'`.

### Component: Folder Picker

Triggered by "Add Folder" button.

- Tree-style folder browser (same UX as existing Drive config modal)
- Starts at Drive root, click folder to expand
- Each folder shows name
- Select button next to each folder
- Access level dropdown (Internal/External) shown when selecting
- On select: calls `POST /folders` which returns immediately and triggers scan in background. Close picker, show folder in scopes table with `scan_status: 'scanning'` spinner. Polling handles the rest.

Implementation: fetch `GET /folders` for root, then `GET /folders?parent_id=X` on expand.

### Component: Drive Files List

Below the folder scopes table.

- Table of all Drive files across all scopes
- Columns: File Name, Folder, Access Level, Sync Status, Size, Last Modified, Synced At
- Reuse `SyncStatusBadge` component from existing file manager
- Auto-refresh every 3s when transient statuses exist (same pattern as file manager)
- Filter by folder (dropdown) and status (dropdown)

### Nav Update

Add to `vais-ui/app/layout.tsx` nav:
```tsx
<Link href="/vais/drive">
  <HardDrive className="h-4 w-4" />
  Drive
</Link>
```

---

## Section 6: Sync Worker Integration Detail

### Modified Files

- `python-services/agent_api/vais/sync_worker.py` -- add `process_pending_drive_syncs`, `process_pending_drive_deletions`, `run_drive_cycle`

### Worker Cycle (Updated)

Each poll cycle now runs:
1. Manual upload syncs (existing `process_pending_syncs`)
2. Manual upload deletions (existing `process_pending_deletions`)
3. **Drive file syncs (new `process_pending_drive_syncs`)**
4. **Drive file deletions (new `process_pending_drive_deletions`)**

Steps 3-4 are the same pattern as 1-2 but claim from `vais_drive_files` instead of `vais_documents`.

### Audit Events

Drive sync events go to the existing `vais_sync_events` table. The `document_id` column references `vais_documents.id` via FK, so we need a slight adjustment:

**Option A (simpler)**: Create a companion `vais_drive_sync_events` table with `drive_file_id FK -> vais_drive_files.id`. Same structure, different FK target.

**Option B (shared)**: Make `vais_sync_events.document_id` nullable and add a `drive_file_id` column. Events reference either one.

**Recommendation**: Option A. Separate table, cleaner, no migration on existing table. Same columns.

Add to migration:

```sql
CREATE TABLE vais_prototype.vais_drive_sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_file_id UUID NOT NULL REFERENCES vais_prototype.vais_drive_files(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    triggered_by TEXT NOT NULL DEFAULT 'drive_worker',
    vais_doc_id TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vais_drive_sync_events_file ON vais_prototype.vais_drive_sync_events(drive_file_id);
CREATE INDEX idx_vais_drive_sync_events_created ON vais_prototype.vais_drive_sync_events(created_at);
```

---

## Section 7: File Type Support

### Supported Types (Upload to VAIS)

Same as `VAIS_MIME_TYPES` in `agent_api/vais/document_service.py`:

| Extension | MIME Type | Notes |
|-----------|----------|-------|
| txt | text/plain | |
| md | text/plain | VAIS rejects text/markdown, remapped |
| pdf | application/pdf | |
| docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | |
| pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation | |
| xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | |
| csv | text/csv | |
| html | text/html | |

### Google Workspace Auto-Conversion

Unified.to auto-converts Google Workspace types on download:

| Google Type | MIME Type | Converts To | Extension |
|-------------|----------|-------------|-----------|
| Google Docs | application/vnd.google-apps.document | .docx | docx |
| Google Sheets | application/vnd.google-apps.spreadsheet | .xlsx | xlsx |
| Google Slides | application/vnd.google-apps.presentation | .pptx | pptx |

Use the `WORKSPACE_MIME_MAP` from `agent_api/project_file_search_service.py` for the mapping. Import it or duplicate the constant in the VAIS drive connector.

### Unsupported Types

Skip during scan (don't create `vais_drive_files` row):
- Google Drive folders, shortcuts
- Images (png, jpg, gif, etc.)
- Videos, audio
- Archives (zip, tar, etc.)
- Binary formats without text content

---

## Section 8: Error Handling & Edge Cases

### OAuth Failures

- If `get_auth_url()` returns None: return error to UI, display "Could not initiate Google Drive connection"
- If callback receives no `id` param: redirect to Drive page with `?error=oauth_failed`

### Scan Failures

- If `list_files()` returns empty for a non-root folder: may be a permission issue or empty folder. Store `scan_status='scanned'` with `file_count=0`.
- If network error during scan: set `scan_status='error'` on the folder scope, don't mark files as deleted.
- Timeout: BFS scan should have a max depth (5 levels) and max files (500) to prevent runaway scans.

### Download Failures

- If file download fails during scan: still create `vais_drive_files` row but leave `storage_path` NULL and `sync_status='failed'`. The sync worker won't claim it (needs `storage_path IS NOT NULL`).
- Re-scan will retry the download.

### Sync Failures

- Same retry logic as existing VAIS sync worker: increment `retry_count`, mark as `failed`, re-attempt until `VAIS_MAX_RETRIES` (5).
- Sync errors stored in `sync_error` column.

### Re-connection

- If user disconnects and reconnects: new `vais_drive_connections` row (or update existing). Old folder scopes and files should have been cleaned up during disconnect.

### Concurrent Scans

- Prototype: no locking. If user clicks "Sync All" twice, two scans may run. Upsert on `(project_id, remote_file_id)` prevents duplicate files.

---

## Section 9: Implementation Notes

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_vais_drive_connector.sql` | DB migration |
| `python-services/agent_api/vais/drive_connector.py` | Drive connector service |
| `python-services/agent_api/api/vais_drive.py` | API routes |
| `vais-ui/app/vais/drive/page.tsx` | Drive management page |
| `vais-ui/app/vais/drive/drive-dashboard.tsx` | Main component |
| `vais-ui/app/vais/drive/folder-picker.tsx` | Folder browser/picker |

### Files to Modify

| File | Change |
|------|--------|
| `python-services/agent_api/vais/sync_worker.py` | Add `process_pending_drive_syncs`, `process_pending_drive_deletions`, `run_drive_cycle` |
| `python-services/vais_server.py` | Mount `vais_drive_router`, add CORS origin for vais-ui |
| `vais-ui/app/layout.tsx` | Add "Drive" nav link |

### Files to Reference (Do NOT Modify)

| File | Why |
|------|-----|
| `python-services/agent_api/unified_client.py` | Import `UnifiedClient` directly |
| `python-services/agent_api/vais/document_service.py` | Reuse `VaisDocumentService.upload_document()` |
| `python-services/agent_api/vais/store_service.py` | Reuse `VaisStoreService.get_or_create_store()` |
| `python-services/agent_api/vais/config.py` | Reference `VAIS_MIME_TYPES`, `VAIS_MAX_RETRIES` |
| `python-services/agent_api/drive_sync_service.py` | Reference patterns for download, extension mapping |
| `vais-ui/app/vais/files/vais-file-manager.tsx` | Reference patterns for status badges, polling, table layout |

---

## Detailed Slice Specs

### Slice 1: DB Migration

**Input**: Nothing (greenfield)
**Output**: Migration file applied locally

Create `supabase/migrations/YYYYMMDDHHMMSS_vais_drive_connector.sql` with:
- `vais_drive_connections` table
- `vais_drive_folders` table
- `vais_drive_files` table
- `vais_drive_sync_events` table
- `claim_pending_vais_drive_sync` RPC
- `claim_pending_vais_drive_deletion` RPC
- RLS policies (same pattern as existing VAIS tables)
- `updated_at` triggers
- Indexes as specified above

All tables in `vais_prototype` schema. Use `SET search_path = vais_prototype;` at top.

**Note:** `vais_drive_files.sync_status` must use the schema-qualified enum type `vais_prototype.vais_sync_status` in the migration SQL (the enum was created in the `vais_prototype` schema). `SET search_path` covers table references but enum types in column definitions should be explicit.

**Note:** `vais_drive_files.folder_id` uses `ON DELETE RESTRICT` (not CASCADE). See "Folder Removal Lifecycle" in Section 1.

Verify: `bunx supabase migration up` succeeds.

### Slice 2: Drive Connector Service

**Input**: Slice 1 (tables exist)
**Output**: `drive_connector.py` with all methods

Create `python-services/agent_api/vais/drive_connector.py`.

Key implementation details:
- Import `UnifiedClient` from `agent_api.unified_client`
- `VAIS_PUBLIC_URL` from env (default `http://localhost:58200`)
- `VAIS_UI_URL` from env (default `http://localhost:63200`)
- `initiate_oauth` bakes `project_id` into the `success_redirect` URL so the callback receives it
- `scan_folder` is designed to run as a background task (called via FastAPI `BackgroundTasks`)
- BFS scan with depth limit (5) and file limit (500 per folder)
- File download to `user-files` bucket uses service-role Supabase client (`supabase.storage.from_("user-files").upload()`) -- service-role bypasses storage RLS
- Supabase queries use `schema("vais_prototype")`
- All methods defensive (try/except, return result dicts)

Verify: unit test with mocked `UnifiedClient` -- test `scan_folder` logic, `handle_callback` upsert behavior.

### Slice 3: Drive Sync Pipeline

**Input**: Slice 1 (tables), Slice 2 (connector has downloaded files)
**Output**: Methods on `VaisSyncWorker` for Drive file processing

Add to `sync_worker.py`:
- `process_pending_drive_syncs(cycle_prefix)` -- claim, download from storage, upload to VAIS
- `process_pending_drive_deletions(cycle_prefix)` -- claim, delete from VAIS
- `run_drive_cycle(prefix)` -- orchestrates both
- `_sync_drive_file(file, prefix)` -- single file sync
- `_delete_drive_file(file, prefix)` -- single file deletion
- `_build_drive_metadata(file)` -- metadata dict for VAIS struct_data

Verify: unit test with mocked Supabase + mocked `VaisDocumentService`.

### Slice 4: Extend VAIS Sync Worker Loop

**Input**: Slice 3 (methods exist)
**Output**: Worker loop calls `run_drive_cycle` each iteration

Modify `run_vais_sync_worker()` to add Drive processing after manual upload processing in each cycle.

Verify: start `vais_server.py` with `VAIS_SYNC_ENABLED=true`, observe logs showing Drive cycle.

### Slice 5: API Routes

**Input**: Slice 2 (connector), Slice 3+4 (sync worker)
**Output**: `vais_drive.py` router mounted in `vais_server.py`

Create `python-services/agent_api/api/vais_drive.py` with all endpoints.
Mount in `vais_server.py`.

Key implementation details:
- `POST /folders` and `POST /sync` use FastAPI `BackgroundTasks` to run scans asynchronously
- `GET /callback` reads `project_id` from query params (baked into redirect URL by `initiate_oauth`), reads `id` from Unified.to's appended param
- `GET /callback` redirects to `{VAIS_UI_URL}/vais/drive?project_id=X&connected=true`

Verify: `curl` test of connect endpoint, folder listing, file listing.

### Slice 6: UI -- Connect Drive Page

**Input**: Slice 5 (API routes)
**Output**: `/vais/drive` page with connect button and connection status

Create:
- `vais-ui/app/vais/drive/page.tsx`
- `vais-ui/app/vais/drive/drive-dashboard.tsx`

Update `vais-ui/app/layout.tsx` (add nav link).

Verify: navigate to `/vais/drive`, see connect button, click triggers OAuth redirect.

### Slice 7: UI -- Folder Picker & Sync Dashboard

**Input**: Slice 6 (connect page works)
**Output**: Folder picker, folder scopes table, file list

Create:
- `vais-ui/app/vais/drive/folder-picker.tsx`

Extend `drive-dashboard.tsx` with:
- Folder scopes table with scan status indicators
- Folder picker (triggered by "Add Folder") -- on select, close picker, show folder with scanning spinner
- **Scan polling**: when any folder has `scan_status = 'scanning'`, poll `GET /connection` every 3s. Stop when all folders resolve to `'scanned'` or `'error'`.
- File list with auto-refresh (3s polling when transient sync statuses exist)
- Sync All button
- Disconnect button

Verify: full flow -- connect Drive, browse folders, select folder, see scanning spinner, see files appear as scan completes, see files syncing, search finds Drive files.

### Slice 8: Integration Smoke Test

Manual verification:
1. Start `vais_server.py` with `VAIS_SYNC_ENABLED=true`
2. Start `vais-ui` dev server
3. Navigate to `/vais/drive`, enter project ID
4. Click "Connect Google Drive", complete OAuth
5. Browse folders, select one as Internal
6. Wait for scan to complete, see files listed
7. Wait for sync worker to process files
8. Go to `/vais/search`, search for content from Drive files
9. Verify `entity_type: "drive_file"` in search results
10. Remove folder scope, verify files marked for deletion
11. Disconnect Drive, verify cleanup
