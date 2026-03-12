# Phase 02: Local Codebase — VAIS Document Metadata Updates After Upload

**Date:** 2026-03-12
**Status:** COMPLETE

## Summary

The local codebase comprehensively demonstrates that **VAIS `update_document()` does NOT work for making metadata filterable on unstructured documents**. This was discovered empirically in Feb 2026, documented as a warning in production code, and led to removing the `_update_document_metadata` method entirely. The codebase uses INCREMENTAL re-import as the standard upload path (which functions as an upsert), but has NOT implemented a metadata-only re-import workaround. No delete-and-re-upload pattern exists specifically for metadata changes.

---

## 1. `update_document` Usage in the Codebase

### Current state: ZERO usage

The `update_document()` method was used historically but was **removed entirely** in commit `4dbd5733` (Feb 26, 2026):

```
fix(vais): use JSONL document import for GCS uploads to enable metadata filtering

VAIS never indexes metadata added via update_document() after a
data_schema="content" GCS import. Replaced the two-step upload (import
content, then update metadata) with a single-step JSONL document import
using data_schema="document" that includes both base64 content and
structData atomically.

Also fixed:
- Removed dead _update_document_metadata method
```

**The deleted method** (`_update_document_metadata` in `document_service.py`) did this:

```python
def _update_document_metadata(self, branch, document_id, metadata, client=None):
    doc = discoveryengine.Document(name=doc_name, struct_data=struct_data)
    client.update_document(document=doc, allow_missing=False)
```

It had **two additional bugs** beyond the fundamental indexing limitation:
1. `allow_missing=False` was passed as a kwarg to `update_document()`, but it belongs on `UpdateDocumentRequest` (caused `TypeError`, silently caught)
2. The GCS blob was deleted before the metadata update ran, so the document's `content.uri` was already invalid

Today, the only reference to `update_document` in the entire `python-services/` tree is the **warning comment** in the module docstring (see section 2 below).

### Grep evidence

```bash
$ grep -rn "update_document" python-services/ --include="*.py"
python-services/agent_api/vais/document_service.py:14:IMPORTANT: Using data_schema="content" with a post-import update_document() call
```

No SDK calls, no experiment usage, no test usage. Completely purged.

---

## 2. The Warning in `document_service.py`

File: `/workspaces/test-mvp/python-services/agent_api/vais/document_service.py`, lines 14-17:

```python
IMPORTANT: Using data_schema="content" with a post-import update_document() call
does NOT work -- VAIS stores the struct_data but never indexes it for filtering.
The JSONL approach (data_schema="document") is the only reliable way to get
filterable metadata on GCS-imported documents.
```

This warning serves as institutional memory — it documents the empirical finding so future developers (human or AI) don't re-attempt the broken approach.

---

## 3. INCREMENTAL Re-Import Patterns

### Production code: INCREMENTAL is the STANDARD mode

`VaisDocumentService.upload_document()` always uses INCREMENTAL reconciliation mode:

```python
# document_service.py, line 214
reconciliation_mode=discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
```

This means every upload is effectively an **upsert** — if the same document ID exists, the import replaces it. Since document IDs are deterministic (`vais-{uuid}`), re-uploading a file with the same ID + different metadata would update the metadata AND keep it indexed (because metadata is present at import time).

However, **no code path in the codebase explicitly uses this for metadata-only updates**. The sync worker (`sync_worker.py`) only syncs documents on initial upload. There is no "re-sync" or "metadata changed" trigger.

### Experiment code: INCREMENTAL used consistently

Every experiment that imports documents uses `INCREMENTAL`:
- `vais_reliability/phase2_single_file.py` (line 212)
- `vais_reliability/phase2b_gcs_upload.py` (line 237)
- `vais_reliability/phase4_concurrent.py` (line 241)
- `vais_reliability/phase5_metadata_load.py` (line 281)
- `vertex_ai_search_experiment.py` (line 1052)
- `vertex_ai_search_mixed_metadata_experiment.py` (line 512)
- `vertex_ai_search_latency_experiment.py` (line 483)
- `vais_gcs_deletion_experiment.py` (line 248)

None of these experiments test a **metadata-only re-import** (re-importing with same content but different struct_data). The INCREMENTAL mode is used for initial imports, not for update scenarios.

### Untested: metadata-only re-import via `update_mask`

The `ImportDocumentsRequest` proto has an `update_mask` field that could theoretically allow updating only `struct_data` during an INCREMENTAL re-import without re-uploading content. This is **untested** in the codebase. The phase-01-online-docs research flagged this as an open question.

---

## 4. Experiment Code Related to Metadata Updates

### No dedicated metadata UPDATE experiment exists

Searched all 70+ experiment files in `python-services/experiments/`. None test post-upload metadata modification. The experiments test:
- Initial upload with `struct_data` (vertex_ai_search_experiment.py phase 4)
- Metadata filtering after upload (vertex_ai_search_experiment.py phase 8)
- Mixed metadata schemas (vertex_ai_search_mixed_metadata_experiment.py)
- Metadata under concurrent load (vais_reliability/phase5_metadata_load.py)
- GCS deletion behavior (vais_gcs_deletion_experiment.py)

All of these set metadata at import time. None attempt to change metadata after import.

### Related experiment findings

**`vertex_ai_search_experiment.py`** (lines 909, 1017-1022):
- Confirms `struct_data` survives the import cycle (round-trip verified)
- Confirms metadata filtering works when schema is defined before upload
- Confirms `struct_data` on chunks is available via `document_metadata.struct_data`

**`vais_reliability/phase5_metadata_load.py`**:
- Tests metadata filtering under concurrent import load
- Confirms no cross-contamination between document groups
- Confirms eventual consistency (22-55s indexing delay)
- Does NOT test metadata updates post-import

---

## 5. Phase-07-Date-Filter-Fix Findings

File: `/workspaces/test-mvp/.claude/research/vais-prototype/phase-07-date-filter-fix.md`

This is the definitive internal reference for the `update_document()` limitation. Key findings:

### Root cause: Three cascading bugs

1. **GCS upload metadata never indexed (critical):** `_upload_via_gcs` used `data_schema="content"` for GCS import, then called `update_document()` to set struct_data. While `update_document` stores the struct_data, **VAIS never indexes post-import metadata for search filtering.** Documents uploaded this way are searchable by content but invisible to all metadata filters (`ANY()`, `>=`, `<=`).

2. **`update_document()` called with wrong API (masked by #1):** `allow_missing=False` was a kwarg to `client.update_document()`, but it's a field on `UpdateDocumentRequest`. Caused `TypeError`, silently caught by try/except.

3. **GCS blob deleted before metadata update (masked by #1 and #2):** Even after fixing #2, `update_document` with the fetched document failed because `content.uri` still pointed to the deleted GCS blob.

### The fix

Replaced the two-step approach (import content, then update metadata) with a **single-step JSONL document import** using `data_schema="document"`. The JSONL contains both file content and `structData` in one atomic operation.

### Verification results

- `project_id: ANY("...")` filter: 1 result (was 0 before fix)
- `uploaded_at >= yesterday AND uploaded_at <= now`: 1 result (was 400 error before)
- `uploaded_at >= tomorrow`: 0 results (correct exclusion)

### Key discovery (quoted from the research)

> **VAIS metadata filtering only works when metadata is present at import time.** Using `update_document()` to add struct_data after a `data_schema="content"` GCS import stores the data but does NOT make it filterable.

---

## 6. Delete-and-Re-Upload Patterns

### No explicit delete-and-re-upload pattern for metadata changes

The codebase has a `delete_document()` method in `VaisDocumentService` (lines 248-282) and a deletion flow in the sync worker (`_delete_document`, line 315), but these are used for **permanent file removal**, not as a metadata update workaround.

The sync worker deletion flow:
1. Claims pending deletions via `claim_pending_vais_deletion` RPC
2. Calls `doc_service.delete_document(datastore_id, vais_doc_id)`
3. Updates DB status to `deleted`
4. Logs event

There is no "delete then re-upload with new metadata" pattern anywhere in production code.

### The upload path IS effectively an upsert

Because `INCREMENTAL` reconciliation mode is used, a re-upload of the same document ID would replace the existing document including its metadata. The codebase could theoretically do a metadata update by re-importing via the existing `upload_document()` method with the same `document_id` but different `metadata`. This would:
1. Re-upload the file content to GCS
2. Build a new JSONL with updated `structData`
3. Import with `INCREMENTAL` mode (replaces existing document)
4. Clean up GCS staging blobs

This is a **full document replacement**, not a metadata-only update, and no code path triggers it today.

---

## 7. Evolution Timeline

| Date | Commit | Change |
|------|--------|--------|
| ~Feb 20, 2026 | `e2cb32f9` | Initial `document_service.py` with two-step GCS upload (import content, then `update_document()` for metadata) |
| Feb 26, 2026 | `4dbd5733` | **Fix:** Replaced two-step with single JSONL import. Removed `_update_document_metadata`. Added warning comment. |
| Feb 27, 2026 | `e7faa2bf` | **Unify:** Removed inline vs GCS branching. All uploads now use GCS + JSONL with `content.uri`. |

After `e7faa2bf`, the codebase has a single, clean upload path that sets metadata atomically at import time.

---

## 8. Conclusions

1. **`update_document()` is completely absent** from the codebase — removed after empirical proof it doesn't index metadata for unstructured stores.
2. **The warning in `document_service.py`** (line 14-17) serves as institutional memory about this limitation.
3. **INCREMENTAL re-import is the standard mode** for all uploads, providing implicit upsert capability, but no code path uses it for metadata updates specifically.
4. **No experiment code tests metadata updates** — all experiments test initial upload with metadata, not post-upload changes.
5. **Phase-07 is the definitive internal reference** — it documents the three cascading bugs and the fix.
6. **No delete-and-re-upload workaround exists** — the closest thing is the implicit upsert from INCREMENTAL mode, which would require re-uploading file content.
7. **Untested workaround:** INCREMENTAL re-import with `update_mask` on `ImportDocumentsRequest` could theoretically allow metadata-only updates without re-uploading content. Nobody has tried this.

---

## Sources

- `/workspaces/test-mvp/python-services/agent_api/vais/document_service.py` — production code with warning
- `/workspaces/test-mvp/python-services/agent_api/vais/sync_worker.py` — sync worker (upload + delete flows)
- `/workspaces/test-mvp/.claude/research/vais-prototype/phase-07-date-filter-fix.md` — root cause analysis
- `/workspaces/test-mvp/.claude/research/vais-metadata-update/phase-01-online-docs.md` — API documentation analysis
- `/workspaces/test-mvp/.claude/research/eng-2204/phase-01-research.md` — unification issue research
- `/workspaces/test-mvp/.claude/research/vertex-ai-search-reliability/phase-05-metadata-load.md` — metadata filtering under load
- Git commits: `4dbd5733` (JSONL fix), `e7faa2bf` (upload unification)
