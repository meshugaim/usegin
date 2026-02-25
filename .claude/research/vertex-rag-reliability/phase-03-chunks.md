# Phase 3: Extraction Visibility — Chunk Enumeration (Q4)

## Summary

Vertex AI RAG Engine has **no dedicated chunk listing API** — no `list_chunks()`, no REST endpoint, no SDK method. However, you CAN enumerate all chunks for small files (<=100 chunks) using `retrieval_query()` with `rag_file_ids` and `top_k=100`. For files with >100 chunks (~500K+ chars), you hit the hard `top_k=100` ceiling and can only see a query-dependent subset. This is a **significant improvement over GFS** (which gives zero chunk visibility), but falls short of Vertex AI Search which has a dedicated `list_chunks()` API.

**Q4 Verdict: PARTIAL (GOOD for small files, LIMITED for large files)**

## Findings

### No Dedicated Chunk Listing API

Six approaches were tested to find a chunk enumeration mechanism:

| Approach | Result |
|----------|--------|
| High-level SDK (`vertexai.rag`) | No `list_chunks()` or chunk-related functions. Only `ChunkingConfig` exists (for upload config). |
| Low-level v1beta1 (`VertexRagDataServiceClient`) | No chunk methods. Only file-level CRUD. |
| Low-level v1beta1 (`VertexRagServiceClient`) | Only `retrieve_contexts` and `augment_prompt`. No chunk listing. |
| REST API `ragFiles/{id}/ragChunks` | 404 Not Found |
| REST API `ragFiles/{id}/chunks` | 404 Not Found |
| REST API `ragCorpora/{id}/ragChunks` | 404 Not Found |

**Conclusion:** There is no API path to enumerate chunks outside of retrieval queries. The chunk data exists internally (it's embedded and indexed), but there's no CRUD surface for it.

### `retrieval_query()` as a Workaround

The `retrieval_query()` API with `rag_file_ids` parameter can be used to retrieve chunks from a specific file. Combined with a generic query and `top_k=100`, this becomes a partial chunk enumeration tool.

**Hard top_k limit: exactly 100.** `top_k=100` works, `top_k=101` returns `InvalidArgument('Exceeded the maximum number of contexts to retrieve.')`.

### Chunk Count by File Size

| File | Original Size | Chunks Returned (top_k=100) | Total Text Retrieved | Avg Chunk Size | All Chunks Visible? |
|------|--------------|----------------------------|---------------------|---------------|-------------------|
| test.docx | 37KB (810 chars) | 1 | 810 chars | 810 chars | **YES** (1 < 100) |
| test-small.txt | 100K chars | 21 | 99,939 chars | 4,759 chars | **YES** (21 < 100) |
| test-medium.txt | 1M chars | 100 | 489,147 chars | 4,891 chars | **NO** (~210 expected) |
| test-large.txt | 3M chars | 100 | 489,149 chars | 4,891 chars | **NO** (~630 expected) |
| test-xlarge.txt | 6M chars | 100 | 491,422 chars | 4,914 chars | **NO** (~1,260 expected) |

**Key insight:** For the 100K file, retrieved text (99,939 chars) matches the file size almost exactly, confirming we got ALL chunks. The chunk size is consistently ~4,800-4,900 chars (Vertex RAG default chunking config).

**Scaling formula:** File size / ~4,800 = expected chunk count. Files under ~480K chars will have <100 chunks and be fully enumerable.

### Chunk Metadata Available

Each retrieved chunk exposes these fields:

| Field | Value | Notes |
|-------|-------|-------|
| `text` | Full chunk text (~4,800 chars) | Complete extraction text, not truncated |
| `score` | Float (0.0-1.0) | Semantic similarity to query |
| `source_uri` | File's `display_name` | NOT a resource path, same as display_name |
| `source_display_name` | File's `display_name` | Same as source_uri |
| `chunk.text` | Same as top-level `text` | Redundant nested field |
| `chunk.page_span` | Empty for .txt files | Only populated for PDFs/paginated docs |

**Not available:** chunk index/position, byte offset in original, chunk ID, creation time, embedding vector, overlap regions, section/heading context.

### Chunk Content Quality

Chunks preserve the original text faithfully:
- Section headers and formatting preserved
- No truncation within chunks
- Consistent chunk boundaries (splits at ~4,800 char boundaries)
- The 100K file's 21 chunks cover 99,939 chars of the original ~100,000 char file — near-perfect coverage

### Different Queries Surface Different Chunks

For files with >100 chunks, different queries return overlapping but distinct chunk sets:

```
Query "Section 1 analysis findings data":    100 chunks, sections 1..407
Query "Section 100 report summary":          100 chunks, sections 1..407
Query "Section 150 detailed analysis":        86 chunks, sections 11..407
Query "Section 200 conclusions report":       24 chunks, sections 21..407
```

Across 4 queries on the 1M file, 150 unique sections were seen (out of ~407 total). You CANNOT enumerate all chunks through repeated queries with any reliability — the result set is query-dependent and unpredictable.

### Comparison: Vertex AI Search vs Vertex RAG Engine

Vertex AI Search (the separate product tested in ENG-1477/1478) has a dedicated `ChunkServiceClient.list_chunks()` API that returns ALL chunks with pagination. This is a significant advantage for extraction quality validation.

| Capability | Vertex RAG Engine | Vertex AI Search | GFS |
|-----------|-------------------|-----------------|-----|
| List all chunks for a file | **Partial** (<=100 via retrieval) | **YES** (list_chunks API) | **NO** |
| Chunk text visible | YES | YES | NO |
| Chunk boundary info | NO (no offsets) | YES | NO |
| Chunk metadata | NO (score only) | YES (document_metadata) | NO |
| Max chunks per request | 100 (hard limit) | Paginated (unlimited) | N/A |

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_chunk_visibility.py`
- Full output: `/tmp/vertex_chunk_visibility_output.txt`
- SDK: `google-cloud-aiplatform 1.136.0`
- High-level API: `vertexai.rag` module
- Low-level API: `google.cloud.aiplatform_v1beta1.VertexRagDataServiceClient`, `VertexRagServiceClient`
- REST base: `https://us-west1-aiplatform.googleapis.com/v1beta1/`
- Corpus: `projects/768786717495/locations/us-west1/ragCorpora/2842897264777625600`
- Files tested: 5 files from Phase 2 (100K, 1M, 3M, 6M text + docx)

### File Resource Names Used

```
test-small.txt:   .../ragFiles/5641438470694175467  (100K, 21 chunks)
test-medium.txt:  .../ragFiles/5641440341255965279  (1M, ~210 chunks)
test-large.txt:   .../ragFiles/5641442491175963785  (3M, ~630 chunks)
test-xlarge.txt:  .../ragFiles/5641445186916497321  (6M, ~1260 chunks)
test.docx:        .../ragFiles/5641447907142458648  (37KB, 1 chunk)
```

## Open Questions

1. **Can Layout Parser or LLM Parser change the chunk size?** Default chunking is ~4,800 chars. If we could reduce it, more files would fall under the 100-chunk ceiling. The `RagFileChunkingConfig` has `chunk_size` and `chunk_overlap` fields but we didn't test non-default values.

2. **Is the 100 top_k limit configurable per corpus?** Documentation doesn't mention any way to raise it. It may be a service-wide limit.

3. **Can we use multiple targeted queries to reconstruct all chunks?** In theory, with many carefully crafted queries, we could surface most chunks. But it's unreliable and not a real enumeration API.

4. **Does the v1 (stable) API have different limits?** We only tested v1beta1. The stable API may have different constraints.

## Dead Ends

1. **REST API chunk endpoints.** All variations of `ragChunks` and `chunks` endpoints returned 404. The chunk resource is not exposed via REST at all.

2. **RagFile proto fields.** The `RagFile` proto has no chunk count, chunk list, or chunk reference fields. Chunks are completely hidden from the file-level API.

3. **`top_k > 100` via low-level API.** Tried both the high-level `rag.retrieval_query()` and the low-level `VertexRagServiceClient.retrieve_contexts()` — both enforce the same 100 top_k limit.

4. **`retrieveContexts` REST endpoint.** Tried `POST {corpus}:retrieveContexts` — returned 404. The correct parent is the project/location, not the corpus.
