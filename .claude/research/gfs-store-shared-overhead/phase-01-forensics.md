# Phase 1: Forensic Analysis of GFS Store Concurrency Behavior

## Summary

Google does not document per-store concurrency limits for File Search Stores. The official documentation actively recommends concurrent uploads via `Promise.all()` without any caveats. However, our experiment data provides strong evidence of an undocumented per-store processing bottleneck: 5 concurrent 500-page uploads to the same store all timeout (5/5), while the same files sequentially succeed (4/5). Combined with community reports of widespread silent failures in the File Search Store API, this points to a server-side processing queue or resource pool per store that silently drops or starves operations when overloaded.

## Findings

### 1. Documented Limits (Thread 1: Google Documentation)

**What Google documents:**
- Maximum file size per document: 100 MB
- Store count per project: 10 File Search Stores
- Project-level storage by tier: Free=1GB, Tier 1=10GB, Tier 2=100GB, Tier 3=1TB
- Recommended max store size: 20 GB for "optimal retrieval latencies"
- Display name max length: 512 characters
- Pagination: max 20 stores per page

**What Google does NOT document:**
- Maximum documents per store (no limit stated)
- Maximum concurrent operations per store
- Maximum concurrent operations per project
- Processing time SLAs or timeouts
- Per-store processing queue depth or behavior
- What happens when multiple operations target the same store simultaneously

**Critical gap:** The File Search Stores API response includes `pendingDocumentsCount` and `failedDocumentsCount` fields, confirming Google tracks processing state per store. But no documentation explains the processing model (e.g., sequential per store? shared worker pool? max parallelism?).

**Source:** [File Search API docs](https://ai.google.dev/gemini-api/docs/file-search), [File Search Stores API](https://ai.google.dev/api/file-search/file-search-stores), [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

### 2. Existing Experiment Analysis (Thread 2)

**File:** `/workspaces/test-mvp/python-services/experiments/gfs_import_hang_experiment.py`

#### Phase 1 Timing Pattern (Sequential, Accumulating Store)

| Test | Pages | Time | Result |
|------|-------|------|--------|
| 50 pages | 50 | 9.1s | success |
| 1 page | 1 | 9.1s | success |
| 50 pages | 50 | 8.5s | success |
| 500 pages | 500 | 27.8s | success |
| 1000 pages | 1000 | 123.6s | **timeout** |
| 2852 pages | 2852 | 123.2s | **timeout** |
| 2852 (File API) | 2852 | 125.0s | **timeout** |
| 2000 generated | 2000 | 125.2s | **timeout** |

Key observation: The 1000-page test timed out after 123.6s in Phase 1, but in Phase 3 (clean store), 1000 pages succeeded in 43-47s. The difference: Phase 1 ran on a store that already had accumulated documents from prior tests. This strongly suggests **accumulated store state degrades processing capacity**.

#### Phase 2 Non-Determinism (700 Pages)

| Pages | Result | Time |
|-------|--------|------|
| 700 | success | 23.3s |
| 700 | **timeout** | 183.6s |
| 750 | success | 38.3s |
| 800 | success | 36.1s |
| 1000 | **timeout** | 602.2s |

The 700-page non-determinism is critical. Same file, same store, one succeeds in 23s and another hangs for 183s. This rules out a hard page-count threshold and points to a non-deterministic server-side resource contention issue.

#### Phase 3 (Clean Store Per Test)

| Pages | Attempts | Results | Times |
|-------|----------|---------|-------|
| 700 | 3 | success, timeout, success | 34.8s, 182.1s, 34.5s |
| 800 | 3 | all success | 34-44s |
| 900 | 2 | all success | 37-39s |
| 1000 | 2 | all success | 43-47s |

Even with cleanup between each attempt, 700 pages sometimes hangs. But 800, 900, and even 1000 always succeed. This suggests the hang is not purely about page count -- it may involve timing relative to Google's internal processing pipeline (e.g., a previous operation's cleanup not yet complete despite the cleanup_test_docs() call).

#### Phase 4 Concurrency (5 x 500-page PDFs)

| Mode | Timeouts | Wall Time |
|------|----------|-----------|
| Concurrent | 5/5 | 303s |
| Sequential | 1/5 | 284s |

**This is the smoking gun.** 500 pages is well within limits (succeeds in ~28s individually). But 5 concurrent uploads to the same store = 100% failure. Sequential = 80% success. The one sequential failure may be residual store state from the prior concurrent test.

#### Stuck Operation Behavior

The experiment polls `operation.done` and logs `error`, `metadata`, and `name` fields. When stuck:
- `operation.done = None` (not False, not True -- None)
- `operation.error = None`
- `operation.metadata = None` or empty
- No progress indicators at all

The 2-minute diagnostic dump (line 598-613 of `project_file_search_service.py`) was added to capture undocumented fields but likely returns the same empty state. Google simply stops updating the operation -- no error, no progress, no cancellation.

### 3. Codebase Architecture (Thread 3)

**SDK:** `google-genai>=1.62.0` (from `pyproject.toml`)

**Upload paths** (from `project_file_search_service.py`):
1. **Direct upload:** `client.file_search_stores.upload_to_file_search_store()` -- for non-Office files
2. **File API workaround:** `client.files.upload()` then `client.file_search_stores.import_file()` -- for Office files and files that fail direct upload with "terminated" error

**Retry logic** (from `retry_utils.py`):
- Up to 5 retries with exponential backoff (1s base, 32s max, 10% jitter)
- Retries on: 429, 503, 500, timeout, connection errors, FAILED_PRECONDITION
- Does NOT retry on: 400, 401, 403, 404
- Important: retries apply to the HTTP API calls, not to the operation polling loop

**Polling behavior** (from `project_file_search_service.py:560-614`):
- Polls every 2 seconds
- Default timeout: 600 seconds (configurable via `GOOGLE_UPLOAD_TIMEOUT` env var)
- Logs progress every 30 seconds
- One-time diagnostic dump at 120 seconds
- On timeout: raises `TimeoutError`

**Sync worker concurrency model** (from `sync_worker.py`):
- `MAX_CONCURRENT_CYCLES = 5` (env: `SYNC_WORKER_MAX_CONCURRENT_CYCLES`)
- `MAX_ITEMS_PER_CYCLE = 10`
- Fixed-rate scheduling: new cycle every `POLL_INTERVAL` (10s default)
- Within a cycle, items are processed **sequentially** via a `for` loop
- BUT: multiple cycles can run concurrently (bounded by semaphore)
- Different work types (files, emails, attachments, drive files) processed sequentially within each cycle via `await loop.run_in_executor()` calls

**Concurrency risk in production:** While each cycle processes items sequentially, up to 5 cycles can run simultaneously. If two cycles pick up files targeting the same store (e.g., two files uploaded to the same project's internal store), they will issue concurrent GFS upload operations to the same store. The `claim_pending_file_sync` RPC prevents duplicate claims but does NOT prevent same-store concurrent uploads.

### 4. Community Evidence (Thread 4)

**503 "Failed to count tokens" errors:**
Multiple reports of `uploadToFileSearchStore` returning 503 for files >10KB. Originally reported November 2025, still unresolved as of February 2026. This affects all file types (CSV, XLSX, PDF). No Google engineer response. Workaround: use File API + import. ([Forum thread 1](https://discuss.ai.google.dev/t/file-search-store-api-returns-503-for-all-file-sizes-files-upload-works-fine/121691), [Forum thread 2](https://discuss.ai.google.dev/t/file-search-store-uploadtofilesearchstore-returns-503-for-files-10kb-still-broken-in-feb-2026/123818))

**"Upload has already been terminated" errors:**
Occurs for files between 1.3MB and 5MB via direct upload. No confirmed workaround in the community. ([Forum thread](https://discuss.ai.google.dev/t/gemini-file-search-api-upload-has-already-been-terminated-error-when-uploading-large-csv-files-5mb/116138))

**Undocumented content limits:**
A 175KB XLSX with 308K characters across 3 sheets fails. A 1.7MB PDF succeeds. Google engineer confirmed reproduction and filed internal bug ([GitHub #1658](https://github.com/googleapis/python-genai/issues/1658)). This suggests token count (not file size) is the real constraint.

**No community reports of concurrency-specific failures:**
Despite searching extensively, I found no community reports of the specific pattern we observe (concurrent uploads to same store causing hangs). This suggests either (a) most users upload files one at a time, (b) the failure mode is too obscure to diagnose without controlled experiments, or (c) users who hit this get different symptoms (503, "terminated") depending on the exact timing.

**JavaScript tutorial recommends concurrency:**
Phil Schmid's tutorial explicitly recommends `Promise.all()` for concurrent uploads. The Google Codelabs tutorial also mentions concurrent uploads as a best practice. Neither mentions any per-store limitations. This is either safe at small scale or the tutorials are misleading.

### 5. Inferred Processing Model

Based on all evidence, I infer the following (unconfirmed) model:

1. **Each File Search Store has a processing queue.** The `pendingDocumentsCount` field in the API response confirms Google tracks documents awaiting processing per store.

2. **Processing is likely serial or limited-parallel per store.** Our experiment shows that 5 concurrent operations overwhelm the store while sequential operations succeed. If there were no per-store limit, concurrent operations should be at least as fast as sequential.

3. **The queue has an undocumented depth or timeout.** When too many operations are queued, some are silently dropped or starved. The `operation.done` never transitions to True and no error is reported.

4. **Store state accumulates processing debt.** Phase 1 showing 1000-page failure while Phase 3 (clean store) shows 1000-page success suggests that residual processing work from prior documents (or cleanup tasks) consumes capacity.

5. **The failure mode is silent.** Google's operation API design (polling `done` field) provides no mechanism for reporting "operation was dropped" or "operation was queued but the queue is full." It just never completes.

## Sources

### Documentation
- [File Search API docs](https://ai.google.dev/gemini-api/docs/file-search) - Official limits page
- [File Search Stores API reference](https://ai.google.dev/api/file-search/file-search-stores) - API surface and fields
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) - General rate limits (no File Search specific limits)

### Codebase Files
- `/workspaces/test-mvp/python-services/experiments/gfs_import_hang_experiment.py` - Experiment code and results
- `/workspaces/test-mvp/python-services/agent_api/project_file_search_service.py` - Production upload logic
- `/workspaces/test-mvp/python-services/agent_api/google_file_search_client.py` - Client wrapper
- `/workspaces/test-mvp/python-services/agent_api/retry_utils.py` - Retry configuration
- `/workspaces/test-mvp/python-services/agent_api/sync_worker.py` - Sync worker concurrency model
- `/workspaces/test-mvp/python-services/pyproject.toml` - SDK version (google-genai>=1.62.0)

### Community Reports
- [503 for all file sizes (Feb 2026)](https://discuss.ai.google.dev/t/file-search-store-uploadtofilesearchstore-returns-503-for-files-10kb-still-broken-in-feb-2026/123818)
- [503 for all file sizes (Jan 2026)](https://discuss.ai.google.dev/t/file-search-store-api-returns-503-for-all-file-sizes-files-upload-works-fine/121691)
- ["Upload terminated" for large CSVs](https://discuss.ai.google.dev/t/gemini-file-search-api-upload-has-already-been-terminated-error-when-uploading-large-csv-files-5mb/116138)
- [Context limit question (GitHub #1658)](https://github.com/googleapis/python-genai/issues/1658)
- [MIME type issue (GitHub #1900)](https://github.com/googleapis/python-genai/issues/1900)
- [Phil Schmid tutorial recommending Promise.all()](https://www.philschmid.de/gemini-file-search-javascript)

### Web Searches
- Google Generative AI File Search Store quotas and limits
- generativelanguage.googleapis.com rate limits for file search
- Google-genai SDK file_search_stores upload timeout issues
- Community reports of stuck operations and silent failures
- pendingDocumentsCount processing queue behavior

## Open Questions

1. **What is the actual per-store processing concurrency limit?** Our data shows 5 concurrent uploads fail, but we don't know if 2 or 3 would succeed. An experiment with 1, 2, 3, 4, 5 concurrent uploads to the same store would pinpoint the threshold.

2. **Does the `pendingDocumentsCount` field reflect queued operations?** Querying the store's metadata during concurrent uploads could reveal whether Google acknowledges all 5 operations or drops some immediately.

3. **Is the limit per-store or per-API-key?** If 5 concurrent uploads to 5 different stores all succeed, the bottleneck is per-store. If they also fail, it's per-API-key or per-project.

4. **Does the File API + import path behave differently?** Our experiment used direct upload. The two-step workaround (File API upload then import_file) might serialize differently server-side.

5. **What is the role of store "age" or accumulated documents?** Phase 1 vs Phase 3 suggests stores with more documents have less processing capacity. Is this about concurrent processing or about total embeddings/index size?

6. **Can we cancel stuck operations?** The `operations.cancel()` or `operations.delete()` APIs might exist but aren't used in our code. If we could cancel, we could implement a "cancel and retry" pattern.

## Dead Ends

1. **Google Cloud quotas pages** - These cover Vertex AI and general Gemini API quotas (RPM, TPM, RPD) but have zero mention of File Search Store specific quotas.

2. **GitHub python-genai issues** - Many issues about 503 errors and MIME type problems, but none about concurrent upload hangs. The closest is the "terminated" error for large files.

3. **Batch API limits** - The rate limits page mentions "100 concurrent batch requests" for the Batch API, but this is a different API entirely and doesn't apply to File Search Stores.

4. **10 stores per project limit** - Mentioned in one tutorial but not confirmed in official docs. Even if real, this is about store count, not per-store operation concurrency.
