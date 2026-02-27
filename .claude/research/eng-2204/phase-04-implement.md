# Phase 4: Implementation Log — ENG-2204

## Commits

| Slice | Commit | Summary |
|---|---|---|
| 1 | `b4334b3e` | `test(vais): add baseline tests for document and search services` — 33 tests |
| 2 | `e7faa2bf` | `fix(vais): unify upload to always use GCS + JSONL import with content.uri` — removed inline vs GCS branching, content.uri replaces rawBytes, list-based 2-blob cleanup |
| 3 | `ea930561` | `chore(vais): remove dead inline upload code and stale comments` — INLINE_UPLOAD_LIMIT, stale sync_worker comments |
| 4 | `c2637c2a` | `feat(vais): extract heading chain from chunk content for structured context` — heading_chain field on VaisChunkResult, regex parser, 12 heading tests |

## Test Results

47 tests passing (16 document service + 31 search service):
- Document: upload path, content.uri JSONL, metadata, cleanup (both blobs), error handling
- Search: execution, chunk parsing, path extraction, filter building, heading extraction (10 edge cases), heading integration

## Files Changed

| File | Change |
|---|---|
| `agent_api/vais/document_service.py` | Unified to single GCS path with content.uri, removed inline upload, _build_struct_data, base64/Struct imports |
| `agent_api/vais/config.py` | Removed INLINE_UPLOAD_LIMIT, updated GCS_BUCKET comment |
| `agent_api/vais/types.py` | Added `heading_chain: list[str] | None` to VaisChunkResult |
| `agent_api/vais/search_service.py` | Added `_extract_heading_chain()`, integrated into `_parse_chunk_results()` |
| `agent_api/vais/sync_worker.py` | Fixed 2 stale comments about inline uploads and SHA256 document IDs |
| `tests/unit/vais/__init__.py` | New (empty) |
| `tests/unit/vais/test_document_service.py` | New — 16 tests |
| `tests/unit/vais/test_search_service.py` | New — 31 tests |

## Issues Encountered

None. All slices implemented cleanly per spec. Both spike results (content.uri works, heading format is markdown `#` syntax) were confirmed and used as designed.
