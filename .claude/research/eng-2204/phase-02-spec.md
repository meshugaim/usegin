# ENG-2204 Spec: Unify VAIS Upload to GCS + JSONL with Heading Extraction

## Goal

Eliminate the two-path upload in `document_service.py` (inline vs GCS) and always use a single GCS-based flow. Add heading chain extraction from chunk content as a structured field.

## Current State

`VaisDocumentService.upload_document()` branches on file size + MIME type:

| Condition | Path | How content reaches VAIS |
|---|---|---|
| `<1MB` AND `mime in INLINE_SUPPORTED_MIME_TYPES` | `_upload_inline` | `InlineSource` with `content.raw_bytes` |
| Everything else | `_upload_via_gcs` | GCS JSONL with base64 `content.rawBytes` |

Both paths set `structData` metadata correctly (fixed in `4dbd5733`). The split is unnecessary complexity.

## Target State

One path for all files:

1. Upload **raw file** to GCS bucket
2. Build JSONL with `content.uri` pointing to GCS file + `structData` metadata
3. Import via `ImportDocumentsRequest` with `gcs_source`, `data_schema="document"`
4. Cleanup GCS staging files after import confirmed

Key change from current GCS path: use `content.uri` (VAIS fetches the file) instead of `content.rawBytes` (base64 in JSONL). This eliminates base64 encoding overhead and JSONL size concerns.

---

## Slice 0: Pre-Implementation Spikes

Two aspects of the design are unverified. These spikes **must complete before any code changes** in slices 1-4. Each spike is a throwaway script or shell session, not production code.

### Spike A: Verify `content.uri` in JSONL

**Goal:** Confirm that Discovery Engine accepts a JSONL document with `content.uri` pointing to a GCS object (instead of `content.rawBytes` with base64).

**Steps:**
1. Upload a small test file (e.g., `test.txt`) to the existing GCS staging bucket.
2. Create a JSONL file with:
   ```json
   {
     "id": "spike-uri-test",
     "content": {
       "mimeType": "text/plain",
       "uri": "gs://<bucket>/spike-uri-test.txt"
     },
     "structData": { "project_id": "spike-test" }
   }
   ```
3. Import via `ImportDocumentsRequest` with `gcs_source` and `data_schema="document"`.
4. Check the LRO result for errors. If successful, search for the document content to confirm it was indexed.
5. Clean up: delete the test document from the DataStore and the GCS blobs.

**If `content.uri` works:** Proceed with slices 1-4 as written.

**If `content.uri` does NOT work:** Remove all `content.uri` branching from the spec. Slice 1 simplifies to: always use the existing GCS JSONL method (base64 `rawBytes` in JSONL), just remove the inline path so all files go through `_upload_via_gcs` unchanged. The unification is the primary goal; `content.uri` is the optimization.

### Spike B: Determine VAIS Heading Format in Chunk Content

**Goal:** Determine the exact format VAIS uses when `includeAncestorHeadings` prepends heading chains to chunk content. Without this, the parser in slice 4 cannot be written.

**Steps:**
1. Upload a structured markdown document with 3+ heading levels through the existing VAIS prototype (use a DataStore that has `include_ancestor_headings=True`, which all VAIS prototype DataStores do). The document should be large enough to produce multiple chunks (>500 tokens per section). Example structure:
   ```markdown
   # Top Level Heading

   Introduction paragraph with enough content to fill a chunk.

   ## Second Level Heading

   More content here, enough to be its own chunk.

   ### Third Level Heading

   Detailed content that should become a separate chunk with all three
   ancestor headings prepended by VAIS.
   ```
2. Search for content from the deepest section using the VAIS search service.
3. **Print the full raw `chunk.content`** (not truncated) for each result. The experiment at `vertex_ai_search_experiment.py:1535` only prints 200-char previews and checks for substring presence -- it never reveals the actual delimiter format.
4. Document the exact format. Possible formats include:
   - `Top Level Heading > Second Level Heading > Third Level Heading\n\nContent...`
   - `# Top Level Heading\n## Second Level Heading\n### Third Level Heading\n\nContent...`
   - Some other delimiter or structure
5. Clean up the test document.

**Output:** The exact heading format string, which becomes the input for the parser in slice 4.

**If headings are NOT separately distinguishable** (e.g., they blend into content with no consistent delimiter): Skip the heading parser entirely in slice 4. The `heading_chain` field can be added to the model but left as `None` until a reliable extraction method is found.

---

## Slice 1: Baseline Tests for Current GCS Path

**Location:** `python-services/tests/unit/test_vais_document_service.py`

There are currently **zero tests** for any VAIS module. Before refactoring the upload path, write baseline tests that cover the current GCS path behavior. These provide regression safety during the refactor in slices 2-3.

### Tests

These tests mock `google.cloud.discoveryengine` and `google.cloud.storage`:

| Test | What it verifies |
|---|---|
| `test_upload_small_inline_file_succeeds` | Files matching inline criteria use `_upload_inline` path |
| `test_upload_large_file_uses_gcs` | Files exceeding `INLINE_UPLOAD_LIMIT` use `_upload_via_gcs` |
| `test_upload_unsupported_mime_uses_gcs` | Files with unsupported MIME type use GCS regardless of size |
| `test_upload_gcs_sets_struct_data_metadata` | `structData` in JSONL contains all metadata fields with correct types |
| `test_upload_gcs_sets_explicit_document_id` | JSONL `id` field matches the provided `document_id` |
| `test_upload_gcs_uses_incremental_reconciliation` | `ImportDocumentsRequest` uses `INCREMENTAL` mode |
| `test_upload_gcs_cleans_up_blob_on_success` | GCS blob is deleted after successful import |
| `test_upload_gcs_cleans_up_blob_on_failure` | GCS blob is cleaned up even when import fails |
| `test_upload_returns_error_on_import_failure` | Returns `{success: False, error: ...}` when LRO has error_samples |
| `test_upload_logs_warning_on_cleanup_failure` | Cleanup failure is logged but doesn't raise |

These tests lock in current behavior. When slice 2 changes the upload path, these tests should be updated to reflect the new single path -- any test that breaks is a regression signal.

---

## Slice 2: Unify to Single GCS Upload Path

**File:** `python-services/agent_api/vais/document_service.py`

### Changes

**`upload_document()`** -- Remove the branching logic. Always call the GCS path. Currently:
```python
use_inline = size < INLINE_UPLOAD_LIMIT and mime_type in INLINE_SUPPORTED_MIME_TYPES
if use_inline:
    result = self._upload_inline(...)
else:
    result = self._upload_via_gcs(...)
```

After: always call the GCS path (or inline the logic into `upload_document`).

**`_upload_via_gcs()`** -- If Spike A confirmed `content.uri` works, modify to use `content.uri` instead of `content.rawBytes`:

1. Upload the **raw file bytes** to GCS (not JSONL-encoded). Path: `{datastore_id}/{document_id}.{ext}` where `ext` is derived from MIME type or file name.
2. Build JSONL with:
   ```json
   {
     "id": "<document_id>",
     "content": {
       "mimeType": "<mime_type>",
       "uri": "gs://<bucket>/<raw_file_path>"
     },
     "structData": { ... metadata ... }
   }
   ```
3. Upload JSONL to a separate GCS path: `{datastore_id}/{document_id}_import.jsonl`
4. Import via `GcsSource` with `data_schema="document"`
5. Cleanup **both** GCS blobs (raw file + JSONL) after import completes

**If Spike A showed `content.uri` doesn't work:** Simply remove the branching and always call the existing `_upload_via_gcs` method (which uses `rawBytes` in JSONL). No changes to the GCS method internals. The unification is the primary goal.

### GCS Cleanup (Two Blobs)

When using `content.uri`, there are two GCS blobs to clean up (raw file + JSONL). The cleanup logic should use a list-based approach:

```python
# Track all staging blobs
staging_blobs: list[storage.Blob] = []
staging_blobs.append(raw_file_blob)
staging_blobs.append(jsonl_blob)

# ... import logic ...

finally:
    for blob in staging_blobs:
        try:
            blob.delete()
            logger.debug("Cleaned up GCS blob: gs://%s/%s", blob.bucket.name, blob.name)
        except Exception as cleanup_err:
            logger.warning(
                "Failed to clean up GCS blob gs://%s/%s: %s",
                blob.bucket.name, blob.name, cleanup_err,
            )
```

This pattern scales if future changes add more staging blobs, and ensures every blob gets a delete attempt even if an earlier delete fails. The GCS bucket's 1-day auto-delete lifecycle is the safety net.

### Rename

Consider renaming `_upload_via_gcs` to just `_import_document` or inlining its body into `upload_document`, since "via GCS" is no longer a distinguishing qualifier.

### Update Baseline Tests

Update the tests from slice 1 to reflect the unified path:
- Remove `test_upload_small_inline_file_succeeds` (no more inline path)
- Remove `test_upload_unsupported_mime_uses_gcs` (no more branching)
- If using `content.uri`: add `test_upload_builds_jsonl_with_content_uri` (JSONL has `content.uri`, not `rawBytes`)
- If using `content.uri`: update cleanup tests to verify **both** blobs are deleted (raw file + JSONL)

---

## Slice 3: Remove Dead Code

**Files:** `python-services/agent_api/vais/document_service.py`, `python-services/agent_api/vais/config.py`

### Remove from `document_service.py`

| Symbol | Reason |
|---|---|
| `_upload_inline()` method | No longer called |
| `INLINE_SUPPORTED_MIME_TYPES` constant | Only used by branching logic and `_upload_inline` |
| `_build_struct_data()` method | Only used by `_upload_inline`; the GCS path builds `structData` as a plain dict, not a protobuf `Struct` |
| `import base64` | Only used by `_upload_via_gcs` for `base64.b64encode()` in the `rawBytes` path. If `content.uri` is used, this import is dead. If `rawBytes` fallback is used, keep it. |

### Remove from `config.py`

| Symbol | Reason |
|---|---|
| `INLINE_UPLOAD_LIMIT` constant | No longer needed for branching |

### Update imports

`config.py` exports `INLINE_UPLOAD_LIMIT` which is imported in `document_service.py`. Remove the import.

### Update docstrings

- Module docstring at top of `document_service.py` -- rewrite to describe single path
- Class docstring on `VaisDocumentService` -- remove two-path description
- `upload_document()` docstring -- remove inline/GCS branching description

### Update `sync_worker.py` comment

Lines 211-213 in `sync_worker.py`:
```python
# Use the vais_document_id from the result, not our initial ID.
# For inline uploads these are the same, but for GCS uploads the actual
# VAIS document ID is a SHA256 hash of the GCS URI (see document_service.py).
```

**Important timing note:** This comment is currently correct -- as of today, there ARE two upload paths, and the GCS path historically did derive the document ID from the GCS URI hash. The comment only becomes stale AFTER slice 2 lands (which removes the inline path and unifies to a single path with explicit document IDs). That is why this cleanup is in slice 3, not slice 2.

After slice 2 lands, simplify the comment to:
```python
# Use the vais_document_id from the result (matches our document_id since
# we set the ID explicitly in the JSONL import).
```

---

## Slice 4: Add Heading Chain Extraction

**Files:** `python-services/agent_api/vais/types.py`, `python-services/agent_api/vais/search_service.py`

**Prerequisite:** Spike B must be completed. The parser implementation depends entirely on the heading format discovered in the spike.

### Background

When `includeAncestorHeadings` is enabled (it is -- `config.py` line 26), VAIS prepends ancestor headings to chunk content. From experiment Phase 7, the headings appear as text within the chunk content, but the **exact delimiter format is unknown**.

The heading research doc (`phase-01-heading-research.md`) suggests a format like `Company Overview > Engineering Department > Infrastructure Team\n\nContent...` but this is speculative -- the experiment only checks for substring presence (lines 1543-1545), never prints the raw delimiter format.

**The parser can only be written after Spike B determines the actual format.**

### Model Change

**`types.py`** -- Add `heading_chain` field to `VaisChunkResult`:

```python
class VaisChunkResult(BaseModel):
    content: str
    relevance_score: float
    document_id: str | None = None
    chunk_id: str | None = None
    source_file: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    heading_chain: list[str] | None = None  # NEW: e.g. ["Company Overview", "Engineering", "Infrastructure Team"]
```

`heading_chain` is `list[str] | None` because:
- Not all chunks will have headings (plain text files, chunks from the start of a document)
- `None` means "no heading chain detected" (vs `[]` which would mean "headings were expected but none found")

### Parser

**`search_service.py`** -- Add a `_extract_heading_chain(content: str) -> list[str] | None` static method.

The parser should:
- Look for the heading prefix pattern at the start of chunk content (format determined by Spike B)
- Return `None` if no heading pattern is found
- Strip the heading chain from the content before returning (or leave it in -- design decision for the implementer based on whether downstream consumers want clean content or content-with-headings)

**Design decision: strip or keep headings in `content`?**

Recommendation: **keep headings in `content`** (don't strip). Reasons:
- LLM consumers benefit from seeing heading context inline
- Search relevance depends on heading terms being in the indexed content (already baked in at ingestion time)
- `heading_chain` provides the structured version for UI breadcrumbs
- Stripping would change the content from what VAIS indexed, creating a mismatch

### Integration Point

In `_parse_chunk_results()`, after extracting `chunk.content`, call `_extract_heading_chain(content)` and set the result on the `VaisChunkResult`.

### Tests

**Location:** `python-services/tests/unit/test_vais_search_service.py`

| Test | What it verifies |
|---|---|
| `test_extract_heading_chain_basic` | Parses heading chain from chunk content with known format (from Spike B) |
| `test_extract_heading_chain_no_headings` | Returns `None` for plain text without heading prefix |
| `test_extract_heading_chain_single_heading` | Handles single heading (e.g., just H1) |
| `test_extract_heading_chain_deep_nesting` | Handles 4+ levels of headings |
| `test_parse_chunk_results_includes_heading_chain` | `_parse_chunk_results` populates `heading_chain` on `VaisChunkResult` |
| `test_build_access_filter_project_only` | Existing filter builder tests (regression) |
| `test_build_access_filter_with_date_range` | Date range filter (regression) |
| `test_build_access_filter_with_entity_type_list` | Entity type list filter (regression) |

### `test_vais_heading_extraction.py` (optional, if parser is complex)

If the heading parser has enough edge cases, it may warrant its own test file. The implementer should decide based on parser complexity.

---

## Slice Order Summary

| Slice | What | Depends on |
|---|---|---|
| **0** | Spikes: verify `content.uri` + determine heading format | Nothing |
| **1** | Baseline tests for current GCS path | Nothing (can run in parallel with spike 0) |
| **2** | Unify to single GCS upload path + update tests | Spike A result, Slice 1 |
| **3** | Remove dead code + stale comments | Slice 2 |
| **4** | Heading chain extraction + parser + tests | Spike B result, Slice 2 (for clean codebase) |

---

## Risks

| Risk | Mitigation |
|---|---|
| `content.uri` in JSONL may not be supported by Discovery Engine for all MIME types | Spike A verifies this before any code changes. Explicit fallback: keep `rawBytes` approach, still unify. |
| Heading format in chunk content is not documented by Google | Spike B determines the actual format before the parser is written. If format is indeterminate, ship `heading_chain` as always-`None` and revisit. |
| No existing tests means no regression safety net | Slice 1 adds baseline tests BEFORE the refactor. Any breakage during slice 2 is caught immediately. |
| GCS cleanup of two blobs (raw + JSONL) adds a second failure point | List-based cleanup iterates all blobs in `finally`. Fire-and-forget with logging + 1-day lifecycle policy as safety net. |

## Key Files

| File | Role |
|---|---|
| `python-services/agent_api/vais/document_service.py` | Primary change target (slices 2-3) |
| `python-services/agent_api/vais/config.py` | Remove `INLINE_UPLOAD_LIMIT` (slice 3) |
| `python-services/agent_api/vais/types.py` | Add `heading_chain` field (slice 4) |
| `python-services/agent_api/vais/search_service.py` | Add heading parser + integration (slice 4) |
| `python-services/agent_api/vais/sync_worker.py` | Update stale comment (slice 3, after slice 2 lands) |
| `python-services/experiments/vertex_ai_search_experiment.py` | Reference for heading format (lines 1469-1585) |
| `python-services/tests/unit/test_vais_document_service.py` | New (slice 1, updated in slice 2) |
| `python-services/tests/unit/test_vais_search_service.py` | New (slice 4) |
