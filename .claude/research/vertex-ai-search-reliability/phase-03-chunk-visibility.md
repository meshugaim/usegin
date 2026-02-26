# Phase 3: Chunk Visibility — Can We Enumerate ALL Chunks?

## Summary

Yes. VAIS `ChunkServiceClient.list_chunks()` (v1alpha) enumerates **every chunk** for every document with no ceiling. The SDK auto-paginates transparently. We listed 2,161 chunks for a 6M-char document, 1,086 for 3M, and 362 for 1M — all in under 4 seconds each. Zero empty chunks, zero truncation, 99.8% content coverage on the 1M document. This is a decisive advantage over RAG Engine, which was capped at ~100 chunks via the `retrieval_query()` workaround.

## Findings

### 1. All documents enumerable, all chunks visible

8 documents in the datastore. Every one returned all chunks via `list_chunks()`:

| Document | Size | Chunks | Avg chunk (chars) | Total content | List time |
|----------|------|--------|--------------------|---------------|-----------|
| xlarge.txt (GCS) | 6M | 2,161 | 2,774 | 5,995,614 | 3.28s |
| large.txt (GCS) | 3M | 1,086 | 2,760 | 2,997,796 | 1.95s |
| medium.txt (GCS) | 1M | 362 | 2,760 | 999,262 | 1.23s |
| small.txt (inline) | 100K | 37 | 2,701 | 99,927 | 0.85s |
| binary_garbage | 50K | 36 | 1,334 | 48,010 | 0.89s |
| test.xlsx | 7K | 4 | 2,176 | 8,703 | 0.73s |
| test.docx | 37K | 1 | 1,129 | 1,129 | 0.84s |
| test.pptx | 31K | 1 | 947 | 947 | 0.90s |

**Total: 3,688 chunks across 8 documents.**

### 2. No pagination ceiling

The SDK pager auto-handles all pages. Even with 2,161 chunks (xlarge.txt), the pager returned everything in a single logical call. Tested with explicit page_size=10, 50, and 100 on medium.txt — all returned the same 362 chunks, confirming pagination is reliable and complete.

Note: the SDK reports `pages_fetched=1` because the Python pager abstraction iterates through all API pages transparently. The actual number of API round-trips depends on page_size (362 chunks / page_size=100 = 4 API calls), but this is invisible to the caller.

### 3. Content completeness

For medium.txt (1,001,644 bytes):
- 362 chunks returned
- 999,262 chars of content across all chunks
- **Coverage: 99.8%** of original file size
- The ~0.2% gap is expected (chunk boundaries, heading deduplication from `include_ancestor_headings`)
- Zero empty chunks
- Min chunk: 1,318 chars, Max chunk: 3,000 chars, Avg: 2,760 chars

### 4. Chunk content quality

Every chunk contains actual text — no truncation, no placeholders, no empty content fields:
- Chunks contain full readable text with proper paragraph structure
- First chunk includes document heading: `# medium — Test Document for VAIS Reliability Experiment`
- `document_metadata` is populated on GCS-uploaded docs with `uri` and `title`
- `page_span` is populated for office documents (docx, pptx, xlsx) but NOT for plain text
- Average chunk size ~2,760 chars aligns with the configured `chunk_size=500` (which is in tokens, not chars — roughly 500 tokens * 5.5 chars/token = 2,750 chars)

### 5. Documents that "failed processing" still have chunks

Surprising finding: `large.txt` and `xlarge.txt` both had Phase 2b import errors:
> "Document segmentation stage failure: Chunk size for document ... exceeds threshold. Number of chunks: 1086, while threshold is 1000"

Yet both documents are fully enumerable with all their chunks. The import "failure" was reported as an error sample, but the document and all its chunks are present and accessible. This means the 1000-chunk threshold is a **warning**, not a hard limit — the document was still processed and indexed.

### 6. Performance

Listing scales linearly with chunk count:
- 37 chunks: 0.85s
- 362 chunks: 1.23s
- 1,086 chunks: 1.95s
- 2,161 chunks: 3.28s

Roughly ~1.5ms per chunk, with a fixed overhead of ~0.8s for the API call setup.

### 7. Comparison with RAG Engine

| Capability | RAG Engine | VAIS |
|---|---|---|
| Dedicated chunk listing API | No | Yes (`ChunkServiceClient.list_chunks()`) |
| Max chunks retrievable | ~100 (via `retrieval_query()` workaround) | **No observed limit** (2,161+ verified) |
| Pagination | N/A | Auto-handled by SDK pager |
| Content in chunks | Text content present | Text content present |
| Empty chunks | Not tested | Zero across 3,688 chunks |

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase3_chunk_visibility.py`
- Results JSON: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase3_results.json`
- Phase 2b results (import errors): `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2b_results.json`
- Previous VAIS experiment: `/workspaces/test-mvp/python-services/experiments/vertex_ai_search_experiment.py`
- Infrastructure state: `/workspaces/test-mvp/python-services/experiments/vais_reliability/infra_state.json`
- SDK: `google-cloud-discoveryengine==0.16.0`, `google.cloud.discoveryengine_v1alpha.ChunkServiceClient`

## Open Questions

1. **Is the 1000-chunk "threshold" a search limit or just a processing warning?** Documents with >1000 chunks still have all chunks listed. But can search queries return chunks from these documents? Phase 2b flagged it as a failure, but the chunks exist. Worth testing in a search phase.
2. **What is the true max chunks per document?** We tested up to 2,161 (6M file). The threshold error said 1000, but listing works past it. Is there a hard ceiling at some higher number?
3. **Does list_chunks() respect the same ordering as search results?** Chunk IDs are sequential (`c1`, `c2`, ..., `c362`), suggesting they maintain document order. But is this guaranteed?

## Dead Ends

None. The experiment was straightforward. The `list_chunks()` API worked exactly as expected with no issues.
