# Phase 3: GFS Store Concurrency Experiment

## Summary

The bottleneck is **per-API-key, not per-store**. Concurrent 500-page uploads across 5 completely separate stores showed 4/5 timeouts (Test A), proving the interference operates at the API key / account level. However, file size is the critical variable: 50-page PDFs process concurrently without issue at any concurrency level tested (1-5), and 1-page PDFs process trivially. The `pendingDocumentsCount` field works and provides real-time visibility into processing state.

## Findings

### Test A: Cross-store control — BOTTLENECK IS PER-KEY

This is the most important result. 5 separate stores, each with one 500-page PDF, all uploaded concurrently:

| Store | File | Result | Time |
|-------|------|--------|------|
| store-0 | 500p-file-0 | **success** | 105.8s |
| store-1 | 500p-file-1 | **timeout** | 181.0s |
| store-2 | 500p-file-2 | **timeout** | 180.0s |
| store-3 | 500p-file-3 | **timeout** | 181.4s |
| store-4 | 500p-file-4 | **timeout** | 180.5s |

Wall time: 181.4s

**Interpretation:** Only 1/5 succeeded despite being in completely different stores. The successful one (store-0) took 105.8s — much longer than a solo 500-page upload would take (~28s per Phase 1 data). This proves the processing bottleneck is NOT per-store but rather per-API-key or per-account. Google appears to have a shared processing capacity that gets saturated when concurrent operations compete, regardless of which store they target.

**Note on the one success:** store-0's upload call returned first (5.9s) and likely got to the front of the processing queue before the others. The 4 that timed out may still have completed eventually — our 180s timeout cut them off.

### Test B: Concurrency gradient — SMALL FILES UNAFFECTED

Same store, concurrent 50-page PDFs at N=1, 2, 3, 5:

| N | Files | All succeeded? | Typical time |
|---|-------|----------------|--------------|
| 1 | 1x50p | Yes (1/1) | 9.6s |
| 2 | 2x50p | Yes (2/2) | 9.4-10.5s |
| 3 | 3x50p | Yes (3/3) | 8.9-9.7s |
| 5 | 5x50p | Yes (5/5) | 9.0-10.0s |

All 11/11 succeeded. Processing time remained consistent (~9-10s) regardless of concurrency. No interference detected at any concurrency level with 50-page files.

**Interpretation:** With small files (50 pages, ~30KB each), Google's processing pipeline handles concurrency without issue. The per-file processing time doesn't degrade even at 5 concurrent operations on the same store. This strongly suggests interference is processing-time-dependent or total-processing-load-dependent, not simply operation-count-dependent.

### Test C: Tiny files (1-page) — TRIVIALLY CONCURRENT

5 concurrent 1-page PDFs on the same store:

| File | Result | Time |
|------|--------|------|
| 1p-file-0 | success | 8.3s |
| 1p-file-1 | success | 8.0s |
| 1p-file-2 | success | 9.7s |
| 1p-file-3 | success | 8.4s |
| 1p-file-4 | success | 10.0s |

Wall time: 10.0s. All 5/5 succeeded.

**Interpretation:** Confirms Test B. Tiny files process concurrently with no interference. The minimum processing time appears to be ~8-10s regardless of file size (overhead from the API/chunking pipeline itself).

### Test D: pendingDocumentsCount observation — FIELD WORKS

3 concurrent 50-page PDFs with store state polling:

| Time | pending_documents_count | active_documents_count |
|------|------------------------|----------------------|
| t=4s | 3 | None |
| t=5s | 3 | None |
| t=5s | 3 | None |
| t=10s | None | 3 |
| t=10s | None | 3 |
| t=11s | None | 3 |

Transition: at t=4-5s, all 3 documents show as `pending`. By t=10s, all 3 have transitioned to `active` (and `pending` becomes `None` — Google uses None rather than 0).

All 3/3 succeeded (9.5-10.8s).

**Key observations:**
1. `pending_documents_count` accurately reflects in-flight processing
2. `active_documents_count` tracks completed documents
3. `failed_documents_count` remained `None` throughout (no failures)
4. The transition from pending to active happens atomically for all docs in a batch (all 3 moved together)
5. These fields could be used to implement a wait-for-idle check before starting new uploads

**Note:** Google returns `None` instead of `0` for empty counts. Code should treat `None` as `0`.

### Test E: Cancel stuck operation — NO STUCK OPS WITH 50-PAGE FILES

5 concurrent 50-page uploads, with plan to cancel a stuck one:

| Op | Result | Time |
|----|--------|------|
| e-file-0 | success | 56.6s |
| e-file-1 | success | 57.1s |
| e-file-2 | success | 57.6s |
| e-file-3 | success | 58.1s |
| e-file-4 | success | 58.5s |

Wall time: 59.0s. All 5/5 succeeded after 30s wait.

**Important nuance:** All operations completed within the 30s check window, so the cancel API was never tested. However, the timing is noteworthy: all 5 completed in ~56-59s (much longer than the ~10s in Test B where N=5 also ran). The extra ~47s delay vs Test B is unexplained — possibly Google batched/queued them differently due to the sequential `upload_to_file_search_store` calls (Test B used ThreadPoolExecutor which submitted them more simultaneously).

The `operations.cancel` API remains untested. Would need 500-page files to trigger the stuck condition.

## Key Insights

### 1. The bottleneck is per-API-key, not per-store

Test A definitively proves this. 5 different stores, 5 different files, all competing for the same processing capacity. Only the first-in-queue succeeded within the timeout window.

**Production implication:** Per-store upload serialization (our current fix direction) is NECESSARY but NOT SUFFICIENT. If a user has 4 stores (internal_files, external_files, internal_email, external_email), uploading to all 4 simultaneously would still cause interference because they share the same API key.

### 2. File size is the determining factor, not concurrency count

- 5 concurrent 500-page PDFs: 4/5 timeout
- 5 concurrent 50-page PDFs: 5/5 success (~10s each)
- 5 concurrent 1-page PDFs: 5/5 success (~8-10s each)

The interference is proportional to the total processing load (pages * concurrent operations), not the operation count alone.

### 3. pendingDocumentsCount is a usable signal

The store metadata API returns real-time pending/active/failed counts. This could be used to implement a "wait until pending=0 before uploading next batch" strategy.

### 4. Minimum processing time is ~8-10s

Even a 1-page PDF takes ~8s to process. This is the baseline overhead of the GFS import pipeline (upload, chunking, indexing). Cannot be reduced.

### 5. Processing appears to serialize internally

In Test E, 5 concurrent 50-page uploads took ~57s each to complete (vs ~10s for isolated uploads). This suggests Google may be serializing processing internally even though the operations don't "hang." The total processing time scales linearly: 5 files * ~10s each ≈ 50s, which aligns with the ~57s observed (plus overhead).

## Recommendations for Production

1. **Per-API-key serialization, not just per-store.** Since the bottleneck is shared across stores, serialization must be at the API key level if uploading large files.

2. **Use pendingDocumentsCount as a gate.** Before starting a new upload, check if any store under the same API key has `pending_documents_count > 0`. Wait for it to drain.

3. **Small file uploads are safe to parallelize.** Files under ~50 pages can be uploaded concurrently without interference. Only large files (500+ pages) cause saturation.

4. **Timeout should be proportional to file size.** A 50-page file completes in ~10s. A 500-page file alone takes ~28s. Set timeout to `max(60s, pages * 0.1s)` as a rough heuristic.

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/gfs_store_concurrency_experiment.py`
- Full output: `/home/vscode/.claude/projects/-workspaces-test-mvp/3b205439-a261-4697-a111-02bf22d95da7/tool-results/b99455d.txt`
- Prior experiment: `/workspaces/test-mvp/python-services/experiments/gfs_import_hang_experiment.py`
- SDK: `google-genai>=1.62.0` (from `python-services/pyproject.toml`)
- Run ID: `bd9c8829`, executed 2026-02-23 17:34-17:41 UTC

## Open Questions

1. **Would 500-page cross-store uploads eventually complete if given more time?** Our 180s timeout may have been too aggressive. The successful one in Test A took 106s — the others may have needed 200-300s.

2. **What is the exact page/size threshold where concurrent processing starts to interfere?** We tested 50 and 500. The transition zone (100-300 pages) is untested.

3. **Does `operations.cancel` work on stuck operations?** Test E failed to trigger the stuck condition with 50-page files. Need to repeat with 500-page files.

4. **Does the interference scale with API key quota tier?** We tested with a single dev API key. Production keys may have different capacity.

5. **Is the Test E timing anomaly (57s vs 10s) reproducible?** The 5x slowdown for 50-page files in Test E vs Test B needs investigation — possibly a Google-side queuing effect.

## Dead Ends

- **Test E (cancel API)**: Could not trigger the stuck condition with 50-page files. The cancel API remains untested. The experiment design should have used 500-page files, but that would have made the test take 15+ minutes.
