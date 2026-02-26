# Phase 4: Concurrent Upload Contention (40 files)

## Summary

Vertex AI Search handled 40 concurrent document imports with **100% reliability** — 40/40 API calls succeeded, 40/40 LROs completed, 40/40 documents verified present immediately after upload. Total wall clock time was 7.3 seconds. Zero timeouts, zero errors, zero silent hangs. This is a clear pass and matches RAG Engine's 40/40 result, in stark contrast to GFS which silently hangs at ~1500 concurrent pages.

## Question

Does Vertex AI Search handle 40 concurrent document imports reliably? (Q1: Concurrent upload contention)

## Method

- 40 test files, each ~50KB plain text, uploaded concurrently via `ThreadPoolExecutor(max_workers=40)`
- Each file uploaded via `ImportDocumentsRequest` with inline source (same pattern as Phase 2a)
- Each document included `struct_data` with metadata: `project_id`, `batch_id`, `file_type`, `size_bytes`, `file_index`
- Per-file tracking: API call latency, LRO polling, completion time, success/failure
- Post-upload verification: `get_document()` check for all 40 documents
- 600s timeout per file to catch GFS-style silent hangs

## Results

### Overall

| Metric | Value |
|--------|-------|
| API calls succeeded | 40/40 |
| LROs completed | 40/40 |
| Imports succeeded | 40/40 |
| Documents verified | 40/40 |
| Timeouts | 0 |
| Wall clock time | 7.3s |

### API Call Latency (the `import_documents()` call itself)

| Stat | Value |
|------|-------|
| Min | 1.48s |
| Max | 2.03s |
| Avg | 1.88s |
| P95 | 2.01s |
| Stdev | 0.10s |

All 40 API calls returned within a tight 1.48-2.03s band. The low stdev (0.10s) indicates the API handles concurrent requests without degradation — no queuing, no throttling, no exponential backoff needed.

### LRO Duration (time from API return to LRO done=True)

| Stat | Value |
|------|-------|
| Min | 5.21s |
| Max | 5.28s |
| Avg | 5.23s |
| P95 | 5.24s |

Remarkably uniform — all 40 LROs completed on the first poll (5s poll interval). This suggests the backend batches or parallelizes document processing internally.

### Total Duration (API call + LRO)

| Stat | Value |
|------|-------|
| Min | 6.72s |
| Max | 7.26s |
| Avg | 7.11s |
| P95 | 7.24s |

### Silent Hang Check

Zero files timed out. Zero files showed any polling anomalies. All 40 LROs completed on their first poll check. This is the opposite of GFS behavior, where concurrent operations can silently stall indefinitely.

### Document Verification

All 40 documents were immediately visible via `get_document()` after the LROs completed. No indexing lag was observed, which means the LRO `done=True` signal is honest (consistent with Phase 2a/3 findings on LRO honesty).

## Key Observations

1. **No throttling detected.** 40 concurrent `import_documents()` calls all succeeded without rate limiting, 429 errors, or exponential backoff. The API appears to accept concurrent requests freely at this scale.

2. **Uniform LRO timing.** The near-identical LRO durations (5.21-5.28s) across all 40 files suggest the backend processes them as a cohort rather than sequentially. This is architecturally different from GFS, which appears to have a serial processing bottleneck.

3. **Honest completion signals.** LRO `done=True` meant the document was immediately queryable. No phantom completions where the LRO says done but the document isn't there.

4. **Wall clock efficiency.** 40 files uploaded and verified in 7.3s total. Sequential would have been ~40 * 7s = 280s. The concurrency multiplier is effectively 38x.

5. **Auth note.** ADC failed (needs reauthentication), but `gcloud` CLI token fallback worked. Each thread created its own client with shared credentials — no auth contention.

## Comparison with Other Products

| Product | 40 concurrent uploads | Behavior |
|---------|----------------------|----------|
| **GFS** | Silently hangs at ~1500 pages | No error, no timeout, just stops |
| **RAG Engine** | 40/40 success (queue model) | Returns immediately, processes async |
| **VAIS** | **40/40 success in 7.3s** | Processes concurrently, all verified |

VAIS matches RAG Engine's reliability and exceeds it in transparency (immediate document visibility vs. eventual queue processing).

## Sources

- Script: `python-services/experiments/vais_reliability/phase4_concurrent.py`
- Results: `python-services/experiments/vais_reliability/phase4_results.json`
- Infrastructure: `python-services/experiments/vais_reliability/infra_state.json` (datastore `vais-reliability-51daa72e`)
- Prior art: Phase 2a single-file pattern (`phase2_single_file.py`)

## Open Questions

1. **What about 100+ concurrent uploads?** 40 is the target that matches our RAG Engine test. Would 200 or 500 concurrent uploads still succeed, or is there a throttling threshold?
2. **Does concurrent upload affect search quality?** Documents are present, but are their chunks properly indexed for search? Phase 3 tested chunk visibility for single uploads — a concurrent chunk visibility check would be the definitive test.
3. **Rate limits at scale.** Google's Discovery Engine API likely has per-project QPS limits. At 40 concurrent, we're well within them. Production workloads with many users uploading simultaneously might hit these.

## Dead Ends

None. The experiment worked on the first attempt. The inline upload pattern from Phase 2a transferred directly to concurrent use without modification.
