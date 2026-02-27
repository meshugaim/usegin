# Phase 6: Heading Preservation End-to-End Verification

**Date**: 2026-02-26
**Objective**: Verify `includeAncestorHeadings` + `heading_chain` parsing works end-to-end in the VAIS prototype.

## Summary

**PASS** -- heading_chain works correctly end-to-end. VAIS prepends markdown heading lines to chunk content, and the `_extract_heading_chain()` parser correctly extracts them into a `list[str]`.

## Test Environment

- VAIS server: `http://localhost:58200` (running with `VAIS_SYNC_ENABLED=true`)
- Project: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (single VAIS store, status=ready)
- DataStore: `vais-proj-bbbbbbbb`, Engine: `vais-eng-bbbbbbbb`

## Verification 1: Existing Heading-Test Document

**Document**: `vais-qa-heading-test.txt` (1488 bytes, synced, internal)

**Query**: `"backend frontend deployment architecture"`

**Result**:
```json
{
  "heading_chain": ["Project Architecture Guide", "Backend Services", "API Layer"],
  "content_starts_with_heading": true,
  "content_contains_h1": true,   // "# Project Architecture Guide" in content
  "content_contains_h2": true,   // "## Backend Services" in content
  "content_contains_h3": true,   // "### API Layer" in content
  "heading_chain_type": "array",
  "heading_chain_length": 3
}
```

**Verified**:
- `heading_chain` is `list[str]` with 3 elements (H1, H2, H3)
- Heading text extracted without `#` prefix
- Original heading lines remain in `content` (headings in BOTH fields)
- Relevance score: 0.734

## Verification 2: Newly Uploaded Document

**Document**: `vais-heading-verify-test.txt` (2323 bytes, uploaded fresh during test)

**Content structure**:
```
# Artificial Intelligence Research Report
  ## Natural Language Processing
    ### Transformer Architecture
    ### Large Language Models
  ## Computer Vision
    ### Convolutional Neural Networks
    ### Generative Image Models
  ## Reinforcement Learning
    ### Policy Optimization
```

**Upload**: POST `/api/vais/projects/.../documents` -- returned `document_id: 47fd9b34-...`
**Sync**: `pending` -> `processing` -> `synced` (~75 seconds total, including GCS upload + VAIS JSONL import LRO)

**Query**: `"transformer architecture attention mechanism natural language processing"`

**Result**:
```json
{
  "heading_chain": [
    "Artificial Intelligence Research Report",
    "Natural Language Processing",
    "Transformer Architecture"
  ],
  "relevance_score": 0.7135,
  "document_id": "vais-47fd9b34-1421-46e6-8dcd-7881def13e98",
  "chunk_id": "c1",
  "source_file": "vais-heading-verify-test.txt"
}
```

**Verified**:
- heading_chain correctly extracted from freshly uploaded + indexed document
- 3-level heading hierarchy (H1 > H2 > H3) parsed correctly
- Content retains original markdown heading lines

## Verification 3: Plain Text (No Headings)

**Document**: `test-db-guide.txt` (plain text, no markdown headings)

**Query**: `"database PostgreSQL Supabase row level security"`

**Result**: `heading_chain: null`

**Verified**: Documents without markdown headings correctly return `null` (not empty array).

## Verification 4: Unit Tests

All 31 unit tests in `tests/unit/vais/test_search_service.py` pass:
- `TestExtractHeadingChain` (10 tests): basic chain, no headings, single heading, deep nesting (5 levels), special characters, em-dashes, empty content, hash-but-not-heading, stops at body, XLSX pattern
- `TestParseChunkResultsWithHeadings` (2 tests): heading_chain populated in parsed results, None for plain text

## Observations

1. **Single-chunk documents**: Documents under ~2500 bytes are indexed as a single chunk. The heading_chain reflects the ancestor headings at the start of the chunk (typically the top of the document). All queries for different sections of the same single-chunk document return the same heading_chain.

2. **heading_chain is per-chunk, not per-document**: For multi-chunk documents, each chunk would have its own heading_chain reflecting its position in the document hierarchy. Our test documents were small enough to be single chunks.

3. **Content duplication**: Heading text appears in BOTH `heading_chain` (parsed, clean text) and `content` (raw markdown with `#` prefix). This is by design -- `includeAncestorHeadings` prepends headings to content, and `heading_chain` is a convenience extraction for structured access.

4. **File type matters**: `.md` files failed to sync (`retry_exhausted` -- VAIS rejects `text/markdown` MIME type). The `.txt` files succeed because they use `text/plain` which is accepted via JSONL import. The heading parsing works on `.txt` files that contain markdown-style headings.

## Issues Found

- **No multi-chunk heading variation tested**: All test documents were small enough to be single chunks. A larger document (>5000 bytes) would be needed to verify that different chunks get different heading_chains from different positions in the document hierarchy.
- **`.md` MIME type rejected**: VAIS does not accept `text/markdown` -- only `text/plain`, `application/json`, `application/pdf`, etc. Documents with `.md` extension fail to sync. This is a known limitation (visible in the document list: `vais-qa-heading-test.md` has `retry_exhausted`).

## Conclusion

The heading preservation feature works correctly end-to-end:
1. `includeAncestorHeadings` on the VAIS DataStore causes headings to be prepended to chunk content
2. `_extract_heading_chain()` correctly parses `# H1\n## H2\n### H3` patterns from the start of content
3. The `VaisChunkResult.heading_chain` field is properly populated as `list[str]` (or `null` for plain text)
4. The search API returns heading_chain in responses
5. All 31 unit tests pass
