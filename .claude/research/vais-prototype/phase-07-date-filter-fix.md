# Phase 7: Date Filter Fix

**Date**: 2026-02-26
**Status**: FIXED
**Issue**: VAIS search with `uploaded_at` date filters returned 400: `Unsupported field "uploaded_at" on comparison operators`

## Root Cause

Three cascading issues:

1. **GCS upload metadata never indexed** (critical): The `_upload_via_gcs` path used `data_schema="content"` for GCS import, then called `update_document()` to set struct_data after import. While `update_document` stores the struct_data on the document, **VAIS never indexes post-import metadata for search filtering**. Documents imported via `data_schema="content"` with metadata added later are findable by query but invisible to all metadata filters (`ANY()`, `>=`, `<=`).

2. **`update_document()` called with wrong API** (masked by #1): The `_update_document_metadata` method passed `allow_missing=False` as a keyword argument to `client.update_document()`, but `allow_missing` is a field on `UpdateDocumentRequest`, not a kwarg. This caused `TypeError` which was silently caught by the try/except.

3. **GCS blob deleted before metadata update** (masked by #1 and #2): Even after fixing #2, `update_document` with the fetched document failed because the document's `content.uri` still pointed to the already-deleted GCS blob.

## Fix

Replaced the two-step GCS upload (import content, then update metadata) with a single-step **JSONL document import** using `data_schema="document"`. The JSONL file contains both file content (base64-encoded `rawBytes`) and `structData` metadata in one atomic operation.

### Files Changed

- `python-services/agent_api/vais/document_service.py`:
  - Rewrote `_upload_via_gcs` to use JSONL document import (`data_schema="document"`)
  - Removed dead `_update_document_metadata` method
  - Fixed `list_vais_documents` to use `dict(doc.struct_data)` instead of `doc.struct_data.fields` (proto-plus `MapComposite` doesn't have `.fields`)
  - Preserved native types (float for numbers) in `list_vais_documents` metadata extraction

- `python-services/agent_api/vais/search_service.py`:
  - Preserved native types in `_parse_chunk_results` metadata extraction (numbers stay as float, not coerced to string)

## Key Discovery

**VAIS metadata filtering only works when metadata is present at import time.** Using `update_document()` to add struct_data after a `data_schema="content"` GCS import stores the data but does NOT make it filterable. The `data_schema="document"` JSONL approach is the only reliable path for GCS imports with filterable metadata.

## Verification

Uploaded a test file via the JSONL path and confirmed:
- `project_id: ANY("...")` filter: 1 result (was 0 before)
- `uploaded_at >= yesterday AND uploaded_at <= now`: 1 result (was 400 error before)
- `uploaded_at >= tomorrow`: 0 results (correct exclusion)
- Search results include metadata with native types (uploaded_at as float, not string)
