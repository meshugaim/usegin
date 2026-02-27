# Research Findings: Google Drive Connector for Vertex AI Search (VAIS)

**Date**: 2026-02-26
**Researcher**: Claude (Research Director)
**Status**: Complete

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Existing Codebase Analysis](#2-existing-codebase-analysis)
3. [Native Discovery Engine Drive Connector](#3-native-discovery-engine-drive-connector)
4. [SDK/Programmatic Approach](#4-sdkprogrammatic-approach)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Architecture Considerations](#6-architecture-considerations)
7. [Community Reports & Pitfalls](#7-community-reports--pitfalls)
8. [Recommended Approach](#8-recommended-approach)
9. [Sources](#9-sources)

---

## 1. Executive Summary

**Bottom line**: The codebase already has a complete Google Drive integration pipeline (Unified.to -> GFS). The question is whether to connect VAIS to Drive natively or reuse the existing pipeline. We strongly recommend **reusing the existing pipeline** — route Drive files through the existing download/storage layer, then upload to VAIS alongside manual uploads. The native VAIS-to-Drive connector exists but is unreliable, requires Google Workspace admin access, and doesn't fit our multi-tenant SaaS model.

### Key Decision Points

| Approach | Viability | Recommendation |
|----------|-----------|----------------|
| Native VAIS Google Drive connector | Poor for our use case | **Do not use** |
| Build custom pipeline (Drive API -> VAIS) | Viable but redundant | Not needed |
| Reuse existing pipeline (Unified.to -> Storage -> VAIS) | Best fit | **Recommended** |

---

## 2. Existing Codebase Analysis

### What We Already Have — Google Drive Integration (via GFS)

The codebase has a **complete, production-grade Google Drive integration** using Unified.to as middleware, syncing files to GFS (Gemini File Search). This was built as part of ENG-1728/ENG-1729/ENG-1732.

**Key components**:

| Component | File | Purpose |
|-----------|------|---------|
| Drive API endpoints | `python-services/agent_api/api/drive.py` | OAuth connect/callback, folder listing, file exclusion, webhook receiver, manual polling |
| Drive sync service | `python-services/agent_api/drive_sync_service.py` | Downloads Drive files via Unified.to, uploads to GFS |
| Unified.to client | `python-services/agent_api/unified_client.py` | OAuth, file listing, download, connection management, webhooks |
| DB migration | `supabase/migrations/20260216090347_drive_integration.sql` | `drive_connections`, `drive_folder_scopes`, `drive_files`, `drive_sync_events` tables |
| Frontend | `nextjs-app/app/projects/[projectId]/config/drive-config-modal.tsx` | OAuth flow, folder picker, file exclusion UI |
| Spec | `docs/specs/google-drive-integration.md` | Complete integration spec |

**Architecture flow**:
```
User OAuth (Unified.to) -> Drive folder selected -> BFS scan -> drive_files table
  -> Download poller (Stage 1: Drive -> Supabase Storage)
  -> Sync worker (Stage 2: Storage -> GFS)
```

**File types supported**: `.txt`, `.md`, `.pdf`, `.csv`, `.docx`, `.xlsx`, `.pptx`, Google Docs/Sheets/Slides (converted by Unified.to to Office equivalents)

**Access model**: Internal/external folders per project, per-file exclusion, content hashing for change detection, 30-min cooldown debounce

### What We Already Have — VAIS Prototype

The VAIS prototype lives in `python-services/agent_api/vais/` and handles:

| Component | File | Purpose |
|-----------|------|---------|
| Config | `vais/config.py` | GCP project, metadata schema, chunking config |
| Store service | `vais/store_service.py` | Lazy DataStore + Engine creation per project |
| Document service | `vais/document_service.py` | GCS-based JSONL upload with metadata |
| Search service | `vais/search_service.py` | CHUNKS mode search with metadata filtering |
| Sync worker | `vais/sync_worker.py` | Background worker for document sync |
| Schema service | `vais/schema_service.py` | Metadata schema management |

**VAIS upload path**: Supabase Storage -> Download bytes -> Upload raw file to GCS -> Build JSONL with `content.uri` + `structData` -> Import via `GcsSource` -> Clean up staging blobs

**VAIS metadata schema**:
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

### Dependencies

From `python-services/pyproject.toml`:
- `unified-python-sdk>=0.57.4` — Unified.to SDK for Drive API access
- `google-cloud-discoveryengine>=0.16.0` — VAIS SDK

### Experiments

| Experiment | Path | Findings |
|-----------|------|----------|
| Unified.to integration | `experiments/unified-integration/` | OAuth + Drive browsing + chat via Unified.to |
| Drive folder access | `experiments/drive-folder-access/` | Service account approach POC using `google-api-python-client` |
| VAIS parallel query | `python-services/experiments/vais_parallel_query_experiment.py` | Query latency optimization |
| VAIS GCS deletion | `python-services/experiments/vais_gcs_deletion_experiment.py` | Document deletion patterns |

### ADR History

- `docs/decisions/0006-google-drive-integration-via-merge.md` (2025-12-08): Originally chose Merge.dev, later switched to Unified.to (same pattern, different vendor)
- Key rationale: No OAuth app verification needed, pre-verified OAuth, Python SDK, multi-provider potential

---

## 3. Native Discovery Engine Drive Connector

### How It Works

Discovery Engine (VAIS) has a native Google Drive data connector available as a **Public Preview** feature. It uses the `SetUpDataConnector` / `SetUpDataConnectorV2` API methods.

**Configuration requires**:
- `content_config: GOOGLE_WORKSPACE` on the DataStore
- `workspace_config` with:
  - `super_admin_email_address` — a Google Workspace super admin email
  - `super_admin_service_account` — service account for token generation
  - `dasher_customer_id` — obfuscated Workspace customer ID
  - `type` — Google Workspace data source type

**What it does**:
- Connects to an entire Google Workspace organization's Drive
- Indexes all files the service account can access
- Handles periodic sync / incremental updates natively
- Preserves Google Drive ACLs for access control at search time

### Why It Doesn't Fit Our Use Case

| Requirement | Native Connector | Our Need |
|-------------|-----------------|----------|
| Auth model | Google Workspace admin | Per-user OAuth (multi-tenant SaaS) |
| Scope | Entire organization's Drive | Specific folders per project |
| Access control | Google Workspace ACLs | Internal/external per project |
| Multi-tenant | Single org per DataStore | Many orgs, many users |
| Admin requirement | Super admin email required | No admin access available |
| Identity provider | Google Workspace IdP | Our own auth (Supabase) |

**Critical mismatch**: The native connector is designed for organizations that want to index their *own* Google Workspace data for internal search. It requires a **Google Workspace super admin** to configure. Our users are individual project owners connecting *their personal or team Drive folders* via OAuth consent — we don't have (and can't get) super admin access to their Google Workspace.

### Reliability Concerns

Community reports (see Section 7) indicate the native connector has significant reliability issues — DataStores show "Active" but document count stays at "0" or "-" with no error messages. Multiple users report silent ingestion failures with no diagnostic information.

---

## 4. SDK/Programmatic Approach

### Option A: Native Connector via SDK

The `google-cloud-discoveryengine` SDK supports creating Drive-connected DataStores programmatically via `DataStoreServiceClient.create_data_store()` with `content_config=GOOGLE_WORKSPACE` and `workspace_config`.

**Verdict**: Same problems as the Console approach — requires Workspace admin, org-wide scope, doesn't fit multi-tenant.

### Option B: Build Custom Pipeline (Drive API -> VAIS)

Could use `google-api-python-client` (Google Drive API v3) to:
1. OAuth2 per user -> get access token
2. List files in selected folders
3. Download file content
4. Upload to VAIS via our existing `VaisDocumentService`

**Verdict**: Viable but redundant. We already have this exact pipeline built with Unified.to (steps 1-3), and VAIS already handles step 4. Building a second Drive pipeline directly against the Google Drive API would duplicate effort.

### Option C: Reuse Existing Pipeline (Recommended)

The existing Drive integration already:
1. Handles OAuth via Unified.to
2. Scans Drive folders (BFS)
3. Downloads files to Supabase Storage
4. Tracks sync state in `drive_files` table
5. Manages file exclusion, change detection, cooldowns

VAIS just needs a **second sync stage** that reads from the same Supabase Storage path and uploads to VAIS instead of (or in addition to) GFS.

**What's needed**:
- Extend the VAIS sync worker to process Drive files (not just manual uploads)
- Add a `drive_file_id` or `source_type` field to `vais_documents` to track Drive-sourced docs
- When `drive_files.gfs_sync_status` transitions to "synced" (or independently), trigger a VAIS upload
- Reuse the existing `VaisDocumentService.upload_document()` with Drive file metadata

---

## 5. Authentication & Authorization

### Current Auth Setup

**For Unified.to (Drive access)**:
- `UNIFIED_API_KEY` — JWT for Unified.to API auth
- `UNIFIED_WORKSPACE_ID` — workspace that owns connections
- Per-user OAuth via Unified.to's pre-verified Google OAuth app
- Scope: `storage_file_read` (read-only Drive access)
- Token management handled entirely by Unified.to

**For VAIS (Discovery Engine)**:
- Application Default Credentials (ADC) via `gcloud auth application-default login`
- GCP project: `effi-vertex-experiment`
- Service account for production (Railway)

### What Would Be Needed for Different Approaches

| Approach | Auth Requirements | Effort |
|----------|------------------|--------|
| Reuse existing pipeline | None new — Unified.to handles Drive, ADC handles VAIS | Zero |
| Native VAIS connector | Workspace super admin email, service account with domain-wide delegation, Workspace customer ID | High + blocked |
| Direct Drive API | Google OAuth app (needs verification, 2-6 weeks), OAuth2 credentials, consent screen | Medium-High |

### OAuth Scopes

- Unified.to uses `storage_file_read` scope internally
- Direct Google Drive API would need `https://www.googleapis.com/auth/drive.readonly`
- For the native VAIS connector: the service account needs `https://www.googleapis.com/auth/cloud-platform` + Drive scopes via domain-wide delegation

### Per-User vs Organization-Wide

Our model is **per-user OAuth** via Unified.to. Each project owner authenticates with their own Google account and selects specific folders. This is fundamentally incompatible with the native VAIS connector which requires organization-wide access.

---

## 6. Architecture Considerations

### Current VAIS Architecture

Each project gets **one DataStore + one Engine** in VAIS. Access control is via metadata filtering (`access_level: ANY("internal")` or `access_level: ANY("internal", "external")`). Entity types distinguish files vs emails (`entity_type: ANY("file", "email")`).

### How Drive Files Fit

Drive files should be treated as another source of documents in the existing DataStore. They'd use the same metadata schema:

```json
{
  "project_id": "uuid-of-project",
  "access_level": "internal" | "external",
  "entity_type": "drive_file",
  "file_type": "docx" | "pdf" | "txt" | ...,
  "file_id": "uuid-from-drive_files-table",
  "file_name": "Q1 Plan.docx",
  "uploaded_at": 1740000000
}
```

**Key decision: `entity_type` value for Drive files**:
- Option A: `"file"` — treat Drive files identically to manual uploads (simpler, may be what's wanted)
- Option B: `"drive_file"` — distinguish for filtering purposes (e.g., "search only uploaded files")
- Recommendation: Use `"file"` unless there's a specific need to filter by source

### Separate DataStores?

The user asked about separate DataStores for internal/external. The current architecture (single DataStore + metadata filter) is preferred because:
- Fewer GCP resources to manage
- Single Engine to query
- Metadata filtering is verified and working
- Mixed schemas work (from memory notes — tested 6/6 pass)

If complexity grows, could split into separate DataStores per access level, but this creates more infrastructure and requires multi-DataStore query logic.

### Incremental Sync

The existing Drive sync pipeline already handles incremental sync:
1. **New files**: BFS scan discovers them, adds to `drive_files` with `gfs_sync_status='awaiting_confirmation'`
2. **Updated files**: Unified.to webhooks (or manual polling) detect changes, content hash comparison skips unchanged files
3. **Deleted files**: Webhook `DELETED` event marks file for GFS deletion

For VAIS, the same signals would trigger VAIS operations:
- New/updated Drive file in Storage -> VAIS upload (same as manual upload path)
- Deleted Drive file -> VAIS delete document

### Multiple DataStores in One App

Discovery Engine supports "blended search" with multiple DataStores in one Engine/App. However, there's a limitation: if you attach only one DataStore, you cannot add more later. Our current code creates single-DataStore engines. If we wanted to add a Drive-specific DataStore alongside the manual-upload DataStore, we'd need to plan for this at Engine creation time (attach 2+ DataStores from the start).

**Recommendation**: Don't create separate DataStores for Drive vs manual upload. Use a single DataStore with metadata filtering. The `entity_type` field can distinguish sources if needed.

---

## 7. Community Reports & Pitfalls

### Known Issues with Native Drive Connector

| Issue | Source | Status |
|-------|--------|--------|
| DataStore "Active" but 0 documents indexed from Shared Drive | [Google Dev Forum](https://discuss.google.dev/t/vertex-ai-datastore-unable-to-index-google-drive-shared-drive/279685) | Unresolved (2025) |
| Google Drive option disappeared from "Create App" UI after redesign | [Google Dev Forum](https://discuss.google.dev/t/is-it-not-possible-to-use-google-drive-as-a-data-store-in-search-and-conversation-agents-anymore/174243) | Multiple users affected |
| Silent ingestion failure — no errors in Cloud Logging | [Google Dev Forum](https://discuss.google.dev/t/vertex-ai-search-fails-to-ingest-data-from-data-stores-sourced-from-either-google-drive-or-google-cloud-storage/268406) | Unresolved (Jan 2026) |
| Feature marked "Public Preview" — no SLA | Google Docs | Ongoing |

### Common Themes

1. **Silent failures**: The most dangerous pattern. DataStore shows "Active", but nothing is indexed. No error messages, no diagnostic logs.
2. **Shared Drive issues**: Multiple reports of Shared Drives (organizational) failing to index even with correct permissions.
3. **UI instability**: The Console UI for creating Drive-connected DataStores has been removed and re-added, indicating the feature is in flux.
4. **No troubleshooting path**: When ingestion fails, users have no way to diagnose the issue. Google Cloud support is the only recourse.

### Rate Limits & Performance

- Discovery Engine document import is LRO-based (Long Running Operation), typically 60-300 seconds per document
- Our VAIS prototype already handles LRO timeout configuration (`VAIS_LRO_TIMEOUT = 600s`)
- GCS upload + JSONL import is the most reliable path (verified in experiments)
- Unified.to has its own rate limits (varies by plan tier)

### Best Practices from Real Implementations

1. **Always use GCS staging** for document upload — direct inline content is less reliable
2. **JSONL with `content.uri`** is the only way to get filterable metadata (verified in our experiments)
3. **Pre-define metadata schema** before uploading documents — indexing only works on schema-declared fields
4. **Enterprise search tier** required for CHUNKS mode (our code already uses this)
5. **Monitor LRO completion** — don't assume success based on LRO start

---

## 8. Recommended Approach

### Recommendation: Extend Existing Pipeline

**Do NOT use the native VAIS Google Drive connector.**

Instead, extend the existing architecture:

```
[Existing - Already Built]
User OAuth (Unified.to)
  -> Drive folder scan (BFS)
  -> Download to Supabase Storage (Stage 1)
  -> Upload to GFS (Stage 2)

[New - To Build]
  -> Upload to VAIS (Stage 3, parallel to Stage 2)
```

### Implementation Steps

1. **Add VAIS tracking to `drive_files`** — Add a `vais_sync_status` column (or use a separate `vais_drive_documents` join table) to track VAIS sync state independently from GFS sync state.

2. **Extend VAIS sync worker** — Add a new processing stage that:
   - Queries `drive_files` where `storage_path IS NOT NULL` and VAIS sync is pending
   - Downloads from Supabase Storage (same as current VAIS worker does for manual uploads)
   - Uploads to VAIS with metadata (project_id, access_level, entity_type, file_id, file_name, file_type, uploaded_at)
   - Updates VAIS sync status

3. **Wire into existing VAIS store** — Drive files go into the same per-project VAIS DataStore as manual uploads. Use `entity_type: "file"` (or `"drive_file"` if distinction needed).

4. **Handle deletions** — When `drive_files.gfs_sync_status` transitions to `deleted` (file removed from Drive), also delete from VAIS.

5. **Handle updates** — When a Drive file is re-synced (content changed), delete old VAIS document and upload new one (VAIS doesn't support in-place updates of document content).

### What the User Will Need to Provide

- **Nothing new for Drive access** — the existing Unified.to OAuth flow handles this
- **VAIS_SYNC_ENABLED=true** — to enable the VAIS sync worker
- **GCP project with Discovery Engine API enabled** — already configured (`effi-vertex-experiment`)
- **GCS bucket for staging** — already configured (`vais-prototype-uploads`)

### Estimated Effort

| Task | Effort | Complexity |
|------|--------|------------|
| Add VAIS tracking to drive_files schema | Small | Low |
| Extend VAIS sync worker for Drive files | Medium | Medium |
| Handle Drive file deletion in VAIS | Small | Low |
| Handle Drive file updates in VAIS | Small | Medium |
| Testing | Medium | Medium |
| **Total** | **~1-2 days** | **Medium** |

### Major Risks

1. **VAIS LRO latency**: Each document upload takes 60-300s. Large Drive folders (100+ files) will take hours to fully index in VAIS. The existing worker handles this with batching and retry logic.

2. **Dual sync state management**: Tracking both GFS and VAIS sync status for the same Drive file adds complexity. Need clear state machine definition.

3. **VAIS document deletion on Drive file update**: VAIS doesn't support in-place content updates. Must delete + re-upload, which means the document is briefly unsearchable during re-index.

4. **VAIS DataStore creation race**: If a Drive file sync triggers VAIS store creation for a project that hasn't used VAIS before, the LRO for DataStore + Engine + Schema creation is ~60-120s. The existing `get_or_create_store()` handles this.

---

## 9. Sources

### Codebase Files

- `/workspaces/test-mvp/python-services/agent_api/vais/` — VAIS prototype (config, store, document, search, sync worker)
- `/workspaces/test-mvp/python-services/agent_api/api/drive.py` — Drive API endpoints
- `/workspaces/test-mvp/python-services/agent_api/drive_sync_service.py` — Drive sync service
- `/workspaces/test-mvp/python-services/agent_api/unified_client.py` — Unified.to client
- `/workspaces/test-mvp/docs/specs/google-drive-integration.md` — Integration spec
- `/workspaces/test-mvp/docs/decisions/0006-google-drive-integration-via-merge.md` — Original ADR
- `/workspaces/test-mvp/supabase/migrations/20260216090347_drive_integration.sql` — DB migration
- `/workspaces/test-mvp/experiments/drive-folder-access/main.py` — Service account POC
- `/workspaces/test-mvp/experiments/unified-integration/main.py` — Unified.to experiment

### Web Sources

- [Create a search data store | Vertex AI Search](https://docs.cloud.google.com/generative-ai-app-builder/docs/create-data-store-es) — Google Drive is "Public Preview", requires Workspace admin
- [DataConnector REST API](https://docs.cloud.google.com/generative-ai-app-builder/docs/reference/rest/v1/DataConnector) — SetUpDataConnector / SetUpDataConnectorV2 methods
- [Data source access control](https://docs.cloud.google.com/generative-ai-app-builder/docs/data-source-access-control) — Google Drive ACLs preserved, no additional config needed
- [About apps and data stores](https://docs.cloud.google.com/generative-ai-app-builder/docs/create-datastore-ingest) — Blended search with multiple DataStores
- [WorkspaceConfig (v1alpha)](https://cloud.google.com/python/docs/reference/discoveryengine/0.13.3/google.cloud.discoveryengine_v1alpha.types.WorkspaceConfig) — super_admin_email_address, dasher_customer_id
- [DataStore class (v1)](https://docs.cloud.google.com/python/docs/reference/discoveryengine/latest/google.cloud.discoveryengine_v1.types.DataStore) — content_config, workspace_config fields
- [Forum: Unable to index Shared Drive](https://discuss.google.dev/t/vertex-ai-datastore-unable-to-index-google-drive-shared-drive/279685) — Active/0 docs, no errors
- [Forum: Drive option removed from UI](https://discuss.google.dev/t/is-it-not-possible-to-use-google-drive-as-a-data-store-in-search-and-conversation-agents-anymore/174243) — Feature instability
- [Forum: Ingestion failure (Drive + GCS)](https://discuss.google.dev/t/vertex-ai-search-fails-to-ingest-data-from-data-stores-sourced-from-either-google-drive-or-google-cloud-storage/268406) — Silent failures, no diagnostics
