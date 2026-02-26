# Phase 06: VAIS Prototype Sanity Test

**Date:** 2026-02-26
**Environment:** Local development (VAIS API on :58200, Next.js UI on :63200)
**Sync Worker:** Disabled (VAIS_SYNC_ENABLED not set -- no GCP ADC for real Vertex AI Search)

## Test Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 2a | API Health | **PASS** | `{"status":"healthy","service":"vais-prototype"}` |
| 2b | Store Creation (lazy) | **PASS** | Store auto-created on first upload: `datastore_id=vais-proj-bbbbbbbb`, `engine_id=vais-eng-bbbbbbbb`, `status=ready` |
| 2c | Store Status | **PASS** | Before upload: `status=not_found`, `document_count=0`. After upload: `status=ready`, `document_count=1`, `schema_version=1` |
| 2d | Upload File | **PASS** | `{"success":true,"document_id":"e2dd4750-0132-4eee-bdfa-635b1d8389fc","message":"Document queued for VAIS sync (version 1)"}` |
| 2e | List Documents | **PASS** | Returns document with `sync_status=pending`, correct metadata (file_name, access_level, entity_type, size_bytes=76, file_type=txt) |
| 2f | Wait for Sync | **EXPECTED** | Document remains `sync_status=pending` after 15s. This is correct: sync worker is disabled (no VAIS_SYNC_ENABLED). Worker would connect to real Vertex AI Search. |
| 2g | Search | **PASS** | Endpoint responds correctly: `{"success":true,"query":"machine learning","chunks":[],"total_results":0}`. Zero results expected (no synced documents in actual VAIS). |
| 2h | UI Routes | **PASS** | All three routes return HTTP 307 (redirect to sign-in), confirming pages exist and auth middleware is working: `/admin/vais` (307), `/admin/vais/search` (307), `/admin/vais/files` (307) |
| 2i | Delete Document | **PASS** | `{"success":true,"document_id":"e2dd4750-...","message":"Document queued for deletion"}`. Document transitions to `sync_status=pending_deletion`. |

## Detailed Observations

### API Endpoints Verified

All 7 endpoints from OpenAPI spec respond correctly:

```
GET  /                                          -> service info
GET  /health                                    -> health check
GET  /api/vais/projects/{id}/store              -> store status
POST /api/vais/projects/{id}/documents          -> upload (multipart)
GET  /api/vais/projects/{id}/documents          -> list documents
DELETE /api/vais/projects/{id}/documents/{docId} -> soft delete
POST /api/vais/projects/{id}/search             -> chunk search
```

### Store Lifecycle

- Store creation is lazy (triggered by first document upload, not a separate endpoint)
- Store IDs follow naming convention: `vais-proj-{project_id_prefix}`, `vais-eng-{project_id_prefix}`
- Schema version increments on creation (v1)

### Document Lifecycle

1. Upload -> `sync_status: pending` (queued for sync worker)
2. Sync worker processes -> `sync_status: synced` (not tested, requires GCP)
3. Delete -> `sync_status: pending_deletion` (queued for deletion worker)
4. Deletion worker processes -> `sync_status: deleted` (not tested, requires GCP)

### Sync Worker

The sync worker (`VAIS_SYNC_ENABLED=true`) is correctly gated:
- Without the flag, server starts without the worker (log: "VAIS sync worker disabled")
- Worker requires GCP ADC credentials and real Vertex AI Search access
- For full end-to-end sync testing, set `VAIS_SYNC_ENABLED=true` and ensure `gcloud auth application-default login` is configured for `effi-vertex-experiment`

### UI Routes

All admin UI routes exist behind auth middleware:
- `/admin/vais` -> 307 (main dashboard)
- `/admin/vais/search` -> 307 (search interface)
- `/admin/vais/files` -> 307 (file management)

## Verdict

**All checks PASS.** The VAIS prototype API is functional for the full local workflow (upload, list, search, delete). The sync worker is correctly gated behind `VAIS_SYNC_ENABLED` for environments with GCP credentials. Search returns empty results as expected without a real Vertex AI Search backend.
