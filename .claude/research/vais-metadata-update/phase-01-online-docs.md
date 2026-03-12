# Phase 01: Online Docs — Can VAIS Document Metadata Be Updated After Upload?

**Date:** 2026-03-12
**Verdict:** The API exists but does NOT work for the use case we care about.

## Summary

The Discovery Engine `UpdateDocument` API exists at both the REST and SDK level, but **updating `struct_data` (metadata) on an already-imported unstructured document does NOT make the metadata filterable in search**. This was empirically verified in our own codebase (phase-07-date-filter-fix). The only reliable path for filterable metadata on unstructured documents is to include it at import time.

---

## 1. The UpdateDocument API Exists

### REST API
- **Method:** `PATCH /v1/{document.name=projects/*/locations/*/dataStores/*/branches/*/documents/*}`
- **Available in:** v1 and v1beta (v1alpha1 returned 404)
- **Request body:** Contains the `document` object
- **Source:** `google/cloud/discoveryengine/v1/document_service.proto`

### Python SDK
- **Class:** `discoveryengine_v1.DocumentServiceClient`
- **Method:** `update_document(request=UpdateDocumentRequest(...))`
- **Source:** `google-cloud-discoveryengine` package, verified in GitHub source

### UpdateDocumentRequest Fields (from proto)
| Field | Type | Description |
|-------|------|-------------|
| `document` | `Document` | Required. The document to update/create. |
| `allow_missing` | `bool` | If true, creates new document if not found. |
| `update_mask` | `FieldMask` | Which fields to update. If not set, updates all fields. |

### Document Fields (from proto)
| Field # | Name | Type | Notes |
|---------|------|------|-------|
| 1 | `name` | string | Immutable resource name |
| 2 | `id` | string | Immutable identifier |
| 3 | `schema_id` | string | Schema in same data store |
| 4 | `struct_data` | Struct | Structured metadata (oneof with json_data) |
| 5 | `json_data` | string | JSON alternative to struct_data |
| 6 | `derived_struct_data` | Struct | Output-only |
| 7 | `parent_document_id` | string | Parent doc ID |
| 10 | `content` | Content | Unstructured data (raw_bytes or uri) |
| 11 | `acl_info` | AclInfo | Access control |
| 13 | `index_time` | Timestamp | Output-only |
| 15 | `index_status` | IndexStatus | Output-only |

**Key observation:** There is NO dedicated `custom_metadata` field. Metadata for unstructured documents lives in `struct_data` (or `json_data`). The Document proto makes no distinction between "structured data for structured stores" and "metadata for unstructured stores" -- both use `struct_data`.

---

## 2. The Critical Limitation: Post-Import Metadata Is NOT Indexed

### What the API does
`update_document()` successfully **stores** `struct_data` on the document record. If you call `get_document()` or `list_documents()` afterward, you will see the metadata.

### What the API does NOT do
The stored metadata is **never indexed for search filtering**. Documents imported via `data_schema="content"` (or any path) and then updated with `update_document()` to add/modify `struct_data` will:
- Show metadata in `get_document()` responses
- Be invisible to metadata filters (`ANY()`, `>=`, `<=`, etc.) in search queries
- Return 0 results when filtered by the updated metadata

### Evidence from our codebase
This was discovered and documented in `.claude/research/vais-prototype/phase-07-date-filter-fix.md`:

> **VAIS metadata filtering only works when metadata is present at import time.** Using `update_document()` to add struct_data after a `data_schema="content"` GCS import stores the data but does NOT make it filterable. The `data_schema="document"` JSONL approach is the only reliable path for GCS imports with filterable metadata.

Three cascading bugs were found in the original two-step approach:
1. `data_schema="content"` + post-import `update_document()` stores metadata but VAIS never indexes it
2. `allow_missing` was passed as a kwarg instead of on `UpdateDocumentRequest` (silently caught TypeError)
3. GCS blob was deleted before metadata update could reference it

The fix was to abandon `update_document()` entirely and use single-step JSONL import with `data_schema="document"`, where both `content.uri` and `structData` are in the JSONL file atomically.

The current production code (`python-services/agent_api/vais/document_service.py`) documents this:
> IMPORTANT: Using data_schema="content" with a post-import update_document() call does NOT work -- VAIS stores the struct_data but never indexes it for filtering.

---

## 3. Alternative: Re-Import with INCREMENTAL Mode

### How it works
`ImportDocumentsRequest` has a `reconciliation_mode` field:
- **INCREMENTAL** (default): "Inserts new documents or updates existing documents" -- upsert behavior
- **FULL**: "Calculates diff and replaces the entire document dataset"

The import request also has an `update_mask` field: "Indicates which fields in the provided imported documents to update. If not set, the default is to update all fields."

### Can it update metadata?
**Yes, in theory.** Re-importing a document with the same ID using `data_schema="document"` JSONL containing updated `structData` with `reconciliation_mode=INCREMENTAL` should replace the document (upsert). Since metadata is present at import time in this path, it should be indexed.

### Caveats
- This is a **full document replacement**, not a metadata-only update
- Requires re-uploading the file content (or at minimum, providing a GCS URI to it)
- Triggers a full re-indexing of the document
- LRO-based (async), not instant
- No evidence this has been tested specifically for "metadata-only change, same file content"

### The `update_mask` on ImportDocumentsRequest
The proto defines `update_mask` on `ImportDocumentsRequest` as well, which could theoretically allow updating only specific fields during import. This is **untested** in our codebase.

---

## 4. Structured vs. Unstructured Data Stores

The API documentation makes no explicit distinction between structured and unstructured data stores for the `UpdateDocument` method. However:

- **Structured stores:** Documents are primarily `struct_data`/`json_data`. `update_document()` likely works as expected since the document IS its structured data.
- **Unstructured stores:** Documents have `content` (file) + `struct_data` (metadata). The indexing pipeline for unstructured stores processes content and metadata together at import time. Post-import `update_document()` modifies the stored record but does not re-trigger the indexing pipeline.

The Google documentation on refreshing data mentions: "For unstructured documents, you can import data with JSONL metadata or CSV metadata alongside document files, allowing metadata modifications in subsequent refreshes." This confirms the re-import path is the intended mechanism.

---

## 5. Summary Table

| Method | Stores metadata? | Metadata indexed/filterable? | Requires file re-upload? |
|--------|-------------------|------------------------------|--------------------------|
| `update_document()` | Yes | **NO** | No |
| Re-import (INCREMENTAL, `data_schema="document"`) | Yes | Yes (expected) | Yes (content.uri or rawBytes) |
| Delete + re-import | Yes | Yes | Yes |

---

## 6. Unresolved Questions

1. **Re-import metadata-only:** Can you re-import with `data_schema="document"` JSONL containing only `id` + `structData` (no `content`), and have it update just the metadata? Or does INCREMENTAL mode require the full document? Untested.

2. **`update_mask` on ImportDocumentsRequest:** Does setting `update_mask` to `["struct_data"]` during re-import allow a metadata-only update without re-uploading content? Untested.

3. **Re-indexing latency:** If re-importing with the same file content but different metadata, does VAIS skip content re-processing and only update the metadata index? Unknown.

4. **Is this a bug or by design?** The API accepts the `update_document()` call and stores the data without error, but never indexes it. Google documentation does not warn about this behavior. It could be a bug that gets fixed, or it could be by design (indexing is a batch pipeline triggered only at import time).

---

## Sources
- Protobuf: `googleapis/google/cloud/discoveryengine/v1/document.proto`
- Protobuf: `googleapis/google/cloud/discoveryengine/v1/document_service.proto`
- Protobuf: `googleapis/google/cloud/discoveryengine/v1/import_config.proto`
- Python SDK: `google-cloud-python/packages/google-cloud-discoveryengine/`
- Internal: `.claude/research/vais-prototype/phase-07-date-filter-fix.md`
- Internal: `python-services/agent_api/vais/document_service.py` (docstring)
- Google docs: "Refreshing data" page (confirmed re-import as the update path)
