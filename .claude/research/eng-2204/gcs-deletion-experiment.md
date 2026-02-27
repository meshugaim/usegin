# ENG-2204: GCS Blob Deletion After VAIS Import — Experiment Results

**Date:** 2026-02-27
**Verdict:** SAFE to delete GCS staging blobs after VAIS import completes

## Question

Does VAIS copy file content into its own storage during import, or does it reference GCS blobs at query time? If it references GCS, our post-import cleanup in `document_service.py` (lines 234-246) would break search.

## Method

1. Created a fresh DataStore + Engine + Schema with indexable metadata fields
2. Uploaded a test document (photosynthesis research, ~1200 chars) via GCS + JSONL import with `content.uri` pointing to GCS blob — same path as production code in `VaisDocumentService._import_document()`
3. Waited for indexing (document became searchable in ~2s after import LRO)
4. Searched BEFORE deletion: plain semantic search + metadata filter (`file_id: ANY(...)`)
5. Deleted both GCS staging blobs (raw file + JSONL), confirmed 0 blobs remaining
6. Waited 10s for any caching to settle
7. Searched AFTER deletion: same queries

## Results

| Check | Before | After | Status |
|---|---|---|---|
| Plain search chunks | 1 | 1 | PASS |
| Filtered search chunks | 1 | 1 | PASS |
| Content identical | yes | yes | PASS |
| Metadata fields preserved | 6 fields | 6 fields | PASS |
| Metadata values preserved | all match | all match | PASS |
| Chunks returned | yes | yes | PASS |
| Filter works | yes | yes | PASS |

**7/7 checks passed.**

### Before deletion
- Search results: 1 chunk
- Content starts with: `# Photosynthesis Research Summary  ## Overview Photosynthesis is the biological process...`
- Filter (`file_id`): works
- Metadata: `file_type=txt, file_id=test-45eaba4c, project_id=test-gcs-deletion, access_level=internal, file_name=photosynthesis-research.txt, entity_type=file`

### After deletion
- Identical results on all dimensions

## Conclusion

**VAIS copies file content into its own storage during the import LRO.** The GCS blobs are only used as a source during import — they are not referenced at query time. After the import operation completes:

- Search continues to return chunks with full content
- Chunk text is identical to the original file
- Metadata filtering (`ANY()` syntax) continues to work
- All `struct_data` fields are preserved

The current cleanup logic in `VaisDocumentService._import_document()` (deleting both raw file and JSONL blobs in the `finally` block after `operation.result()` returns) is correct and safe.

## Experiment Script

`python-services/experiments/vais_gcs_deletion_experiment.py`

## Timing

- Infrastructure setup (DataStore + Engine + Schema): ~14s
- GCS upload + import LRO: ~353s (import LRO itself was ~346s)
- Indexing lag after import: ~2s
- Total experiment: ~7 minutes
