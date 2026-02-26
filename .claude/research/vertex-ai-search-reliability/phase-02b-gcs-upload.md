# Phase 2b: GCS-Based Upload for Large Text Files

## Summary

GCS upload bypasses the 1MB `raw_bytes` inline limit, but VAIS has a **1,000-chunk-per-document hard limit** that blocks files over ~2.8MB. Medium (1MB) succeeded via GCS in 82s. Large (3MB, 1086 chunks) and xlarge (6MB, 2161 chunks) were imported but **failed document segmentation** with "Chunk size for document exceeds threshold. Number of chunks: N, while threshold is 1000." This is a different failure mode than GFS (which silently drops content) — VAIS gives a clear error with exact chunk counts.

## Findings

### GCS Upload Phase

All three files uploaded to GCS successfully and quickly:

| File | Size | GCS Upload Time |
|------|------|-----------------|
| medium.txt | 1,001,644 bytes | 1.1s |
| large.txt | 3,004,922 bytes | 1.3s |
| xlarge.txt | 6,009,820 bytes | 1.5s |

Bucket `vais-reliability-test-files-51daa72e` was reused (created in a prior run).

### VAIS Import Phase

| File | Size | Import Result | LRO Duration | Chunks Generated | Doc Verified |
|------|------|---------------|--------------|------------------|-------------|
| medium.txt | ~1MB | **SUCCESS** | 81.9s | (unknown, <1000) | Yes (ID: `2ec59f26...`) |
| large.txt | ~3MB | **FAIL** — segmentation | 27.2s | 1,086 (limit 1,000) | Yes (imported but not processed) |
| xlarge.txt | ~6MB | **FAIL** — segmentation | 27.3s | 2,161 (limit 1,000) | Yes (imported but not processed) |

### Key Observations

1. **GCS upload works perfectly** — no size issues, sub-2s uploads for all files up to 6MB.

2. **`data_schema="content"` mode** works correctly. Each GCS file becomes one document with ID = SHA256(URI)[:32] as hex. This was confirmed by hash verification for all three files.

3. **The 1,000-chunk limit is the real ceiling.** VAIS's document segmentation stage chunks text files into ~2,700 character chunks. At ~1,000 chunks max, the effective limit is approximately **2.7MB of text per document**. The medium (1MB) file fits under this. The large (3MB) does not.

4. **Chunk math**: large.txt (3,004,922 bytes) produced 1,086 chunks = ~2,767 bytes/chunk. xlarge.txt (6,009,820 bytes) produced 2,161 chunks = ~2,781 bytes/chunk. Consistent chunk size around 2.7-2.8KB.

5. **LRO behavior is honest** (Q3 finding): The LRO correctly reports `done=True` with an error_sample containing the exact failure reason and chunk counts. No silent failures.

6. **"Imported but failed to process"** — the documents DO get created in the datastore (verified by ID lookup), but they are not chunked/indexed. They exist as document shells. This means `get_document()` succeeds but search would not find them.

7. **LRO timing**: The medium (1MB) file took 82s to import + process. The failing files (3MB, 6MB) took only ~27s — they failed fast during segmentation, which is good behavior.

8. **Comparison to Phase 2a inline limits**: Phase 2a showed a hard 1,000,000-byte `raw_bytes` limit. Phase 2b shows the GCS path has a higher raw size limit (100MB per file per docs) but a lower effective limit (~2.7MB) due to the 1,000-chunk-per-document constraint.

### Effective Text Volume Limits in VAIS

| Upload Method | Hard Limit | Effective Limit | Error Behavior |
|---------------|-----------|-----------------|----------------|
| Inline (`raw_bytes`) | 1,000,000 bytes | ~1MB | Rejected at API call |
| GCS (`data_schema="content"`) | 100MB per file | **~2.7MB** (1,000 chunks) | LRO completes with error_sample |

### Implications for GFS Comparison

GFS handles 3-6MB files with 20-60% failure rate (silent failures). VAIS:
- **Cannot handle 3-6MB files at all** (hard 1,000-chunk limit)
- **BUT fails deterministically** with clear error messages (better than silent failure)
- Effective ceiling is ~2.7MB per document
- Workaround: split large files into multiple documents, each under ~2.7MB

## Sources

- Script: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2b_gcs_upload.py`
- Results: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2b_results.json`
- GCS bucket: `gs://vais-reliability-test-files-51daa72e/phase2b/`
- GCP project: `effi-vertex-experiment`
- VAIS datastore: `vais-reliability-51daa72e`

## Open Questions

1. **Can the 1,000-chunk limit be configured?** The error says "threshold is 1000" — is this a datastore config, or a hard platform limit? Could a different `DocumentProcessingConfig` raise it?
2. **Does advanced chunking mode change the limit?** The datastore uses default chunking. Layout-based or custom chunk sizes might produce fewer chunks for the same document.
3. **What happens to the "imported but not processed" documents?** They exist in the datastore but aren't searchable. Do they count against quotas? Should they be cleaned up?
4. **Multi-document splitting strategy**: If we split a 6MB file into 3 x 2MB documents, does search still work coherently across the split documents?

## Dead Ends

None — the GCS approach worked on the first attempt. The `data_schema="content"` mode was the right choice (auto-generates doc IDs from URI hashes, handles mime type detection automatically).
