# Phase 1: GFS Sync Pipeline Architecture

## Summary

The GFS (Google File Search) sync pipeline is an event-sourced, background polling system that syncs three types of content -- project files, inbound emails (with attachments), and Google Drive files -- to Google's File Search API for semantic search indexing. The pipeline uses a single `SyncWorker` that polls Supabase every 10 seconds, processes pending items in batches of 10, and uses event tables with database triggers to manage state transitions. Each environment (production, staging, development) uses a completely isolated Gemini API key and corresponding GFS store namespace.

## Findings

### 1. Store Management

**Table:** `project_file_search_stores` (created in migration `20251128000001`)

| Column | Type | Purpose |
|--------|------|---------|
| project_id | UUID | FK to projects |
| access_level | TEXT | 'internal' or 'external' |
| store_type | TEXT | 'file', 'email', or 'drive' (added in `20260202182249` and `20260216090347`) |
| google_store_id | TEXT | Google File Search store resource ID (e.g., "fileSearchStores/abc123") |
| google_store_name | TEXT | Human-readable display name |

**Unique constraint:** `(project_id, access_level, store_type)` -- each project gets up to 6 stores (2 access levels x 3 types).

**Store creation:** Lazy, via `ProjectFileSearchService.ensure_project_store()`. Called at sync time, not at project creation. If a store doesn't exist for a (project_id, access_level, store_type) triple, it creates one via `google_client.file_search_stores.create()` and upserts the DB record.

**Store naming pattern:**
- File stores: `"Project {Internal|External} - {project_id[:8]}"`
- Email stores: `"Project {Internal|External} Email - {project_id[:8]}"`

**Key file:** `/workspaces/test-mvp/python-services/agent_api/project_file_search_service.py` (lines 250-321)

### 2. Environment Isolation -- API Keys

**File:** `/workspaces/test-mvp/python-services/agent_api/agent/config.py` (lines 34-64)

Environment is determined by `RAILWAY_ENVIRONMENT` env var:

| Environment | RAILWAY_ENVIRONMENT | Required Env Var |
|-------------|---------------------|------------------|
| Production | "production" | `GEMINI_API_KEY` |
| Staging | "staging" | `GEMINI_API_KEY_STAGING` |
| Development | anything else | `GEMINI_API_KEY_DEV` |

**Critical:** Each key corresponds to a different Google Cloud project / Gemini workspace. Stores created with one key are invisible to another. There is NO cross-environment fallback -- if the staging key is missing, it raises `ValueError`, not silently falls back to dev.

**Google client initialization:**
- `ProjectFileSearchService.__init__()`: calls `get_gemini_api_key()` and creates `genai.Client(api_key=...)` directly
- `AdminGfsService.__init__()`: same pattern via `GoogleFileSearchClient(api_key=get_gemini_api_key())`
- `SyncWorker.__init__()`: creates `ProjectFileSearchService(self.supabase)` which internally calls `get_gemini_api_key()`

### 3. Sync Worker Architecture

**File:** `/workspaces/test-mvp/python-services/agent_api/sync_worker.py`

**Lifecycle:** Started as a FastAPI background task in `main.py` lifespan handler (line 121). Uses service role Supabase client (bypasses RLS). Runs indefinitely until `shutdown_event` is set.

**Configuration (all env-var overridable):**

| Setting | Env Var | Default |
|---------|---------|---------|
| Poll interval | `SYNC_WORKER_POLL_INTERVAL` | 10 seconds |
| Lock timeout | `SYNC_WORKER_LOCK_TIMEOUT` | 5 minutes |
| Max retries | `SYNC_WORKER_MAX_RETRIES` | 5 |
| Batch size | `SYNC_WORKER_BATCH_SIZE` | 10 |
| Per-file timeout | `SYNC_WORKER_SYNC_TIMEOUT` | 300 seconds (5 min) |
| Drive cooldown | (hardcoded) | 30 minutes |

**Each cycle processes (in order, sequentially via `run_in_executor`):**
1. `process_pending_syncs` -- project files with `gfs_sync_status IN ('pending', 'failed')`
2. `process_pending_deletions` -- project files with `gfs_sync_status = 'pending_deletion'`
3. `process_pending_email_syncs` -- inbound emails with `status='classified'` AND `gfs_sync_status IN ('pending', 'failed')`
4. `process_pending_attachment_syncs` -- email attachments with `gfs_sync_status IN ('pending', 'failed')`
5. `process_pending_email_deletions` -- inbound emails with `gfs_sync_status = 'pending_deletion'`
6. `process_pending_attachment_deletions` -- email attachments with `gfs_sync_status = 'pending_deletion'`
7. `cleanup_timed_out` -- project files stuck in 'processing' or 'deleting'
8. `cleanup_timed_out_emails` -- emails stuck in 'processing' or 'deleting'
9. `cleanup_timed_out_attachments` -- attachments stuck in 'processing' or 'deleting'
10. `process_drive_downloads` -- Drive files needing download (Stage 1: pending/download_failed)
11. `process_pending_drive_syncs` -- Drive files needing GFS upload (Stage 2: stored/upload_failed)
12. `process_pending_drive_deletions` -- Drive files needing GFS deletion
13. `cleanup_timed_out_drive_files` -- stuck 'processing'/'deleting'
14. `cleanup_timed_out_drive_downloads` -- stuck 'downloading'

### 4. Sync Status State Machine

**Postgres ENUM:** `gfs_sync_status` (migration `20260210193613`)

```
blocked -> excluded (permanently skipped)
pending -> processing -> synced (happy path)
pending -> processing -> failed (retryable)
pending_deletion -> deleting -> deleted
```

Additional statuses added later:
- `downloading` / `stored` / `download_failed` / `upload_failed` (for Drive files, 2-stage pipeline)
- `awaiting_confirmation` (for Drive files needing user approval)

**State transitions are EVENT-DRIVEN:** The worker inserts events into event tables (`file_sync_events`, `email_sync_events`, `drive_sync_events`), and database triggers update the denormalized `gfs_sync_status` column on the entity table.

**Key trigger:** `trg_update_sync_status` (migration `20251217000001`) -- maps event types to status values.

### 5. End-to-End Sync Flow (Project Files)

**Entry point:** User uploads file via Next.js frontend.

1. **File upload API** (`/api/project-file-search/sync` POST) -- called by the Next.js app after file is stored in Supabase Storage. Creates a `project_file_versions` record with `gfs_sync_status = 'pending'`.

2. **Alternatively, worker picks it up:** The `SyncWorker.process_pending_syncs()` method polls `project_files` where `gfs_sync_status IN ('pending', 'failed')`. Each cycle:
   a. Claims work via `_claim_sync_work()` -- inserts `sync_started` event (trigger sets status to `processing`)
   b. Gets `storage_path` from `project_file_versions`
   c. Calls `ProjectFileSearchService.sync_project_file_upload()`:
      - `ensure_project_store()` -- lazy store creation
      - `download_file_from_storage()` -- downloads from Supabase Storage `user-files` bucket to temp dir
      - Builds GFS custom metadata (`file_fields()` + `to_custom_metadata()`)
      - `upload_to_google_search()` -- uploads to GFS store
        - Standard path: `upload_to_file_search_store()` for text/PDF
        - Office workaround: File API upload -> import into store (for .docx/.xlsx/.pptx/.csv)
        - 409 Duplicate handler: cleans up orphaned doc and retries
        - 400 "terminated" fallback: large file falls back to Office workaround path
      - `update_version_sync_status()` -- marks version as 'synced' with `google_doc_id`
      - `_cleanup_old_versions()` -- deletes previous versions from GFS
   d. Inserts `sync_succeeded` or `sync_failed` event

3. **On success:** `google_doc_id` stored on `project_file_versions.google_doc_id` and `project_files.gfs_doc_id`. Status = 'synced'.

### 6. End-to-End Sync Flow (Emails)

Similar pattern but two entities: email body + attachments.

1. Email arrives -> classified -> `gfs_sync_status = 'pending'` on `inbound_emails`
2. Worker calls `EmailSyncService.sync_email()`:
   - Downloads JSON from `emails` storage bucket
   - Formats as plain text with header block
   - Uploads to email-type store with rich metadata (sender, recipients, thread_id, etc.)
3. Attachments processed separately via `sync_attachment()`:
   - Only syncable extensions (from `GFS_FILE_TYPES` registry)
   - Inherits parent email metadata (sender, date, thread_id, etc.)

### 7. End-to-End Sync Flow (Drive Files)

Two-stage pipeline (ENG-1912):

1. **Stage 1: Download** (`process_drive_downloads`)
   - `DriveSyncService.download_drive_file()` -- downloads via Unified.to (Google Drive API proxy)
   - Content-hashing for deduplication (skip if unchanged)
   - Stored in Supabase Storage, status transitions: `pending -> downloading -> stored`

2. **Stage 2: GFS Upload** (`process_pending_drive_syncs`)
   - `DriveSyncService.sync_drive_file()` -- uploads stored content to GFS
   - Status: `stored -> processing -> synced`

### 8. Supported File Types

**Registry:** `GFS_FILE_TYPES` in `project_file_search_service.py` (line 32-49)

| Extension | MIME Type | Workaround |
|-----------|-----------|------------|
| .txt | text/plain | No |
| .md | text/markdown | No |
| .pdf | application/pdf | No |
| .csv | text/csv | Yes (File API + import) |
| .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | Yes |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Yes |
| .pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation | Yes |

Office files need a 3-step workaround: Upload to Google File API -> wait for ACTIVE state -> import into File Search Store. The intermediate File API file is cleaned up after import.

### 9. Work Claiming / Concurrency

The worker uses an **event-based locking** pattern (not DB row locks):

1. Before processing, check if a `sync_started` event exists within `LOCK_TIMEOUT_MINUTES` (5 min)
2. If not, insert `sync_started` event
3. Process the item
4. Insert `sync_succeeded` or `sync_failed` event

This is NOT race-condition-proof with multiple workers (no CAS). It relies on a single worker instance per deployment. The comment-based "claim" is a soft lock, not an atomic CAS operation.

### 10. Retry and Error Handling

- **Individual API calls:** `@retry_with_exponential_backoff()` decorator -- up to 5 retries with 1s base delay, 32s max, 10% jitter. Only retries 429/500/503/timeout/connection errors.
- **Worker-level retries:** Each file gets up to `MAX_RETRY_COUNT` (5) total attempts across cycles. Failures counted via `_get_failure_count()`.
- **Timeout:** Each file sync runs in a `ThreadPoolExecutor` with `SYNC_TIMEOUT_SECONDS` (300s) timeout.
- **Cleanup:** Timed-out operations (stuck in `processing`/`deleting` with no recent `*_started` event within `LOCK_TIMEOUT_MINUTES`) are reset to `failed`/`pending_deletion`.

### 11. Custom Metadata

**File:** `/workspaces/test-mvp/python-services/agent_api/gfs_metadata.py`

Three entity-specific field constructors produce dicts:
- `file_fields()` -- 8 keys: file_id, entity_type, filename, file_extension, mime_type, access_level, date_epoch, size_bytes
- `email_fields()` -- 14 keys: email_id, entity_type, sender, sender_domain, date_epoch, thread_id, recipients, recipient_domains, cc_addresses, subject, has_attachments, attachment_count, access_level, is_reply
- `attachment_fields()` -- 19 keys: 6 own + 13 inherited from email

`to_custom_metadata()` converts dict -> `list[types.CustomMetadata]`, inferring GFS type from Python type (str -> string_value, int/float -> numeric_value, list -> string_list_value).

### 12. Admin Dashboard / Reconciliation

**API routes:** `/api/admin/gfs/*` (admin-only, verified via `admins` table)

Provides:
- `list_stores` -- paginated store listing with health status (healthy/unhealthy/orphan/missing_in_google)
- `get_sync_queue` -- files pending or failed sync
- `reconcile` -- full cross-reference between Google and Supabase (orphan stores, missing stores, orphan docs, missing docs, stale syncs)
- Mutation operations: delete orphan stores/docs, retry sync, force resync, recreate missing stores, delete stale versions

### 13. Key Configuration Points for Staging

| Setting | Where | What to check |
|---------|-------|---------------|
| `GEMINI_API_KEY_STAGING` | Railway env vars | Must be set, must be valid Gemini key for staging project |
| `SUPABASE_URL` | Railway env vars | Must point to staging Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway env vars | Needed for sync worker (bypasses RLS) |
| `SUPABASE_KEY` | Railway env vars | Anon key for user-context operations |
| `RAILWAY_ENVIRONMENT` | Railway env vars | Must be "staging" for correct key routing |
| `SYNC_WORKER_*` | Railway env vars (optional) | Poll interval, batch size, timeouts |
| `GOOGLE_UPLOAD_TIMEOUT` | Railway env vars (optional) | Default 600s for Office file processing |

## Sources

| File | Purpose |
|------|---------|
| `/workspaces/test-mvp/python-services/agent_api/sync_worker.py` | Background sync worker (1787 lines, processes all 3 entity types) |
| `/workspaces/test-mvp/python-services/agent_api/project_file_search_service.py` | Core sync logic: store creation, file download, GFS upload |
| `/workspaces/test-mvp/python-services/agent_api/email_sync_service.py` | Email + attachment sync to GFS |
| `/workspaces/test-mvp/python-services/agent_api/drive_sync_service.py` | Drive file download + GFS upload |
| `/workspaces/test-mvp/python-services/agent_api/google_file_search_client.py` | Google GenAI API wrapper with retry |
| `/workspaces/test-mvp/python-services/agent_api/project_store_service.py` | Per-user store lookup (query side) |
| `/workspaces/test-mvp/python-services/agent_api/agent/config.py` | Environment-based API key routing |
| `/workspaces/test-mvp/python-services/agent_api/gfs_sync_types.py` | Python StrEnum mirrors of Postgres sync ENUMs |
| `/workspaces/test-mvp/python-services/agent_api/gfs_metadata.py` | Custom metadata builders for GFS documents |
| `/workspaces/test-mvp/python-services/agent_api/retry_utils.py` | Exponential backoff decorator |
| `/workspaces/test-mvp/python-services/agent_api/admin_gfs_service.py` | Admin dashboard service |
| `/workspaces/test-mvp/python-services/agent_api/admin_gfs_reconciliation.py` | Cross-reference reconciliation |
| `/workspaces/test-mvp/python-services/agent_api/api/file_search.py` | HTTP endpoint for project file sync |
| `/workspaces/test-mvp/python-services/agent_api/api/admin_gfs.py` | Admin GFS API endpoints |
| `/workspaces/test-mvp/python-services/agent_api/main.py` | FastAPI app with worker startup |
| `/workspaces/test-mvp/supabase/migrations/20251128000001_create_project_files.sql` | project_files, project_file_versions, project_file_search_stores tables |
| `/workspaces/test-mvp/supabase/migrations/20251217000001_content_sync_v2.sql` | file_sync_events table + trigger |
| `/workspaces/test-mvp/supabase/migrations/20260210193613_gfs_sync_enums.sql` | gfs_sync_status + gfs_sync_event_type ENUMs |

## Open Questions

1. **Is `GEMINI_API_KEY_STAGING` actually set and valid on Railway staging?** The `get_gemini_api_key()` function will raise a `ValueError` at worker init time if it's missing, preventing the worker from starting entirely.

2. **Is the sync worker actually running on staging?** If `SUPABASE_SERVICE_ROLE_KEY` is not set, `main.py` logs a warning and skips worker creation (line 117). Need to check Railway logs for "Sync worker started as background task".

3. **Are there stores already created in the staging Gemini namespace?** If staging was recently set up or the key was rotated, all existing `google_store_id` values in `project_file_search_stores` would point to stores that don't exist under the new key.

4. **Does the file upload API path also work on staging?** The `/api/project-file-search/sync` endpoint creates its own `ProjectFileSearchService` with user auth (not service role). It uses `get_gemini_api_key()` independently.

5. **Is there a single worker instance or could multiple Railway replicas cause work-claiming races?** The event-based locking is not atomic.

## Dead Ends

None -- the architecture search was straightforward. All key components were in expected locations within `python-services/agent_api/`.
