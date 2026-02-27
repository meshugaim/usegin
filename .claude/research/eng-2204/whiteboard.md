# ENG-2204 Build Whiteboard — COMPLETE

## Current State
Phase: DONE | Status: shipped + follow-up experiments complete
Last checkpoint: Parallel query experiment committed

## Goal
Implement ENG-2204 (unify VAIS upload to always use GCS + JSONL import with metadata) + heading preservation feature.

## Final Commits (8 total, all on main)
1. `b4334b3e` — test(vais): baseline tests for document and search services
2. `e7faa2bf` — fix(vais): unified upload to GCS + content.uri (replaces two-path inline/GCS split)
3. `ea930561` — chore(vais): removed dead inline upload code and stale comments
4. `c2637c2a` — feat(vais): heading_chain extraction from chunk content
5. `d01c2464` — fix(vais): remap text/markdown to text/plain for VAIS compatibility
6. `2e20fce9` — fix(vrag-auth): ignore gcloud config set project failure
7. `cba678bb` — fix(vais-ui): deduplicate React keys in search results
8. `a0081576` — experiment(vais): parallel DataStore query benchmark

## What Was Delivered
- **Unified upload path**: All files go through GCS → JSONL (content.uri + structData metadata) → import. No more inline/GCS branching.
- **Dead code removed**: `_upload_inline()`, `INLINE_UPLOAD_LIMIT`, `INLINE_SUPPORTED_MIME_TYPES`, `_build_struct_data()`, stale imports all removed.
- **Heading chain extraction**: `heading_chain: list[str] | None` field on `VaisChunkResult`. Regex parser extracts structured heading chain from VAIS chunk content. Headings preserved in both content text and structured field.
- **MIME type fix**: `text/markdown` remapped to `text/plain` for VAIS platform compatibility.
- **47 tests**: First-ever VAIS unit tests covering document upload, search, heading extraction.
- **vrag-auth fix**: `gcloud config set project` failure no longer aborts the script.
- **UI fix**: React duplicate key warning in search results.

## Parallel Query Experiment
- **2.76x speedup** with ThreadPool, zero errors across 45 queries
- Discovery Engine SDK is thread-safe, results deterministic
- Per-query latency ~1.2s identical in sequential vs parallel
- Comparable to GFS experiment (3.11x, ENG-1529)
- VAIS already faster per-query (~1.2s vs ~3.5s GFS)
- Useful for cross-project search or multi-filter fan-out

## VAIS Architecture Notes (from investigation)
- **structData**: document-level metadata for filtering, NOT returned with chunks in CHUNKS mode
- **includeAncestorHeadings**: VAIS prepends markdown `#` heading chain to chunk content at ingestion
- **heading_chain**: our parser extracts these into `list[str]` — complement to content, not replacement
- **Chunk-to-document**: `document_id` and `source_file` extracted from chunk.name path + metadata
- **UI visibility**: ChunkCard shows source_file and truncated document_id; heading_chain NOT yet in UI

## QA Verification — ALL PASS
- Code review: PASS
- Unit tests: 47/47 pass
- E2E upload: PASS (.txt + .md via remap)
- E2E search: PASS (chunks with scores)
- E2E heading_chain: PASS (fresh upload → sync → search → structured headings returned)
- Pre-push checks: PASS (lint + tests)

## Phase Map
1. Research — [ DONE ✓ ]
2. Design+Spec — [ DONE ✓ ]
3. Implementation — [ DONE ✓ ]
4. Review + QA — [ DONE ✓ ]
5. Final Push — [ DONE ✓ ]
6. Follow-up fixes — [ DONE ✓ ] — vrag-auth, React keys, parallel experiment
