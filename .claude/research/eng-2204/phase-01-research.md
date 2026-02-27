# ENG-2204 Research: Phase 01

## Issue Details

- **ID:** ENG-2204
- **Title:** vais: unify upload to always use GCS + JSONL import with metadata
- **URL:** https://linear.app/askeffi/issue/ENG-2204/vais-unify-upload-to-always-use-gcs-jsonl-import-with-metadata
- **Status:** Backlog
- **Assignee:** Unassigned
- **Labels:** chore
- **Blocked by:** None
- **Blocks:** None
- **Comments:** 0

## Problem Statement

The VAIS document upload currently has **two code paths**:

1. **Small files (<1MB) with supported MIME types:** Inline JSONL import with base64 content + metadata. Works correctly -- metadata is indexed and filterable. But hits a 1MB payload limit.
2. **Large files (>=1MB) OR unsupported MIME types:** GCS raw upload, then JSONL import with `data_schema="document"`. Content is searchable, but the original issue states metadata was not indexed for filtering (date, file_type, access_level filters don't work for large files).

**Note:** Looking at the current code (`python-services/agent_api/vais/document_service.py`), the GCS path was already partially fixed in commit `4dbd5733` ("fix(vais): use JSONL document import for GCS uploads to enable metadata filtering"). The GCS path now uses `data_schema="document"` with a JSONL file containing both content (base64 `rawBytes`) and `structData` metadata. However, the two paths still exist as separate methods (`_upload_inline` and `_upload_via_gcs`).

## Desired Outcome

Unify to a **single upload path** for all file sizes:

1. Sync worker picks up pending document from `vais_document_versions` (status: `pending`)
2. Download from Supabase Storage
3. Upload raw file to GCS staging bucket (`gs://vais-prototype-uploads/{datastore_id}/{document_id}.{ext}`)
4. Create JSONL import request with:
   - `content.uri` pointing to the GCS file (VAIS fetches it -- no size limit)
   - `structData` with all metadata: `project_id`, `access_level`, `entity_type`, `file_type`, `file_id`, `file_name`, `uploaded_at` (epoch)
   - Explicit document ID matching internal ID scheme
5. Submit JSONL import via `ImportDocumentsRequest` with `data_schema="document"`
6. Wait for import LRO to complete
7. Delete GCS blob after successful indexing (GCS is staging only)
8. Update DB status to `synced`

### Key difference from current GCS path

The current GCS path embeds file content as base64 `rawBytes` in the JSONL. The desired approach uses `content.uri` to point to the raw file in GCS, letting VAIS fetch the file itself. This:
- Eliminates the base64 encoding overhead
- Removes the inline JSONL size concern entirely
- Makes GCS a true staging area (raw files, not JSONL-encoded files)

## What to Change (per issue)

- **`document_service.py`:** Remove `_upload_inline` method. Modify `_upload_via_gcs` to always create a JSONL with `content.uri` + `structData` instead of base64 `rawBytes`. Add GCS cleanup after successful import.
- **`sync_worker.py`:** May need to handle the LRO completion check before cleaning up GCS.
- **Remove** the `INLINE_SUPPORTED_MIME_TYPES` branching logic.

## Current Code State

File: `python-services/agent_api/vais/document_service.py`

### Existing Two-Path Architecture

```python
# In upload_document():
use_inline = size < INLINE_UPLOAD_LIMIT and mime_type in INLINE_SUPPORTED_MIME_TYPES

if use_inline:
    result = self._upload_inline(branch, document_id, file_bytes, mime_type, metadata)
else:
    result = self._upload_via_gcs(branch, datastore_id, document_id, file_bytes, mime_type, metadata)
```

### Inline Path (`_upload_inline`)
- Builds `discoveryengine.Document` with `content.raw_bytes` + `content.mime_type`
- Sets `struct_data` from metadata
- Uses `InlineSource` with the Document
- Submits `ImportDocumentsRequest` with INCREMENTAL reconciliation

### GCS Path (`_upload_via_gcs`)
- Builds a JSONL dict with `id`, `content.rawBytes` (base64), `content.mimeType`, `structData`
- Uploads JSONL to GCS bucket
- Submits `ImportDocumentsRequest` with `gcs_source` and `data_schema="document"`
- Cleans up GCS blob in `finally` block (fire-and-forget)

### Supporting Infrastructure
- `INLINE_SUPPORTED_MIME_TYPES` set: `application/pdf`, `application/json`, 3 Google Apps types
- `VAIS_MIME_TYPES` dict: maps file extensions to MIME types
- `_build_struct_data()`: converts flat dict to protobuf `Struct`
- Config values in `agent_api/vais/config.py`: `GCS_BUCKET`, `INLINE_UPLOAD_LIMIT`, etc.

## Testing Criteria (from issue)

- Upload a small text file (<1MB) -- should go through GCS+JSONL, metadata filterable
- Upload a large PDF (>1MB) -- should go through same path, metadata filterable
- Search with `uploaded_at >= N` filter -- should return results for both files
- Search with `file_type: ANY("pdf")` filter -- should return only PDF
- Delete a document -- should remove from VAIS and clean up GCS blob

## GCS Cleanup

The GCS bucket already has a 1-day auto-delete lifecycle as a safety net. Explicit blob deletion should happen after successful VAIS indexing. If deletion fails, the lifecycle policy catches it within 24 hours.

## Parent/Sibling Context

### No Direct Parent

ENG-2204 has no parent issue in Linear. It is a standalone Backlog item.

### Related Parent-Level Issue

**ENG-2095: "prototype: Vertex AI Search end-to-end file search chain"** is the overarching VAIS prototype epic that describes building a standalone prototype proving VAIS can replace GFS. It covers the full pipeline from upload to chunk retrieval. ENG-2204 addresses a specific technical debt item within that prototype (unifying the upload paths), but is not formally linked as a child.

### Relevant Recent Commits

- `f7f17a81` -- docs(vais): phase 7 date filter fix research notes
- `4dbd5733` -- fix(vais): use JSONL document import for GCS uploads to enable metadata filtering (partial fix of the same problem)
- `4cea15fa` -- docs(vrag): update whiteboard for date_epoch fix
- `41593794` -- fix(vrag): auto-populate date_epoch on file upload for filter support
- `e08498cb` -- fix(sync): gate empty documents before VAIS import (ENG-2173)

### No Sibling Issues

Since ENG-2204 has no parent, there are no formal sibling issues. The closest related issues are other VAIS prototype tasks (ENG-2095 and its subtree), but ENG-2204 sits independently in the backlog.

## Implementation Notes

The primary change is architectural simplification:
1. **Delete** `_upload_inline()` method entirely
2. **Modify** `_upload_via_gcs()` to use `content.uri` instead of `content.rawBytes`
3. **Remove** `INLINE_SUPPORTED_MIME_TYPES` constant and branching logic in `upload_document()`
4. **Upload raw file** to GCS (not JSONL-encoded file), then reference it via URI in the JSONL metadata
5. **Ensure** GCS cleanup happens only after VAIS LRO confirms success
6. **Rename** the method since "via_gcs" is now the only path (consider just inlining into `upload_document()`)
