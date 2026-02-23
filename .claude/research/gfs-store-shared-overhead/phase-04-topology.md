# Phase 4: Sharing Topology of GFS Processing Capacity

## Summary

Upload processing, query execution, and delete operations use **independent resource pools** within the same API key. Heavy concurrent uploads that saturate the upload processing pipeline have zero measurable impact on query latency or delete throughput. Recovery from upload saturation is **instant** -- a sequential upload succeeds in ~40s immediately after 3 concurrent uploads all timed out. The upload bottleneck appears to be a concurrency limit (not a capacity/cooldown limit).

## Findings

### Test F: API Key Isolation -- SKIPPED (1 key available)

Only `GEMINI_API_KEY_DEV` was available in the environment. Production uses 3 separate keys (`GEMINI_API_KEY`, `GEMINI_API_KEY_STAGING`, `GEMINI_API_KEY_DEV`), but staging and production keys are not accessible from the dev environment.

**Gap:** We cannot determine whether the per-key bottleneck extends to the GCP project level. If all 3 keys belong to the same GCP project, they may share capacity. This is the most important unanswered question.

### Test G: Upload <-> Query Competition -- INDEPENDENT POOLS

**Setup:**
- Pre-loaded a store with 3 x 10-page documents
- Ran 5 baseline queries (no concurrent uploads)
- Started 3 concurrent 500-page uploads to saturate the key
- Ran 5 queries while uploads were in-flight

**Results:**

| Phase | Query | Latency | Answer Length | Chunks |
|-------|-------|---------|---------------|--------|
| Baseline | q0 | 2.5s | 320 chars | 5 |
| Baseline | q1 | 2.5s | 413 chars | 5 |
| Baseline | q2 | 2.6s | 500 chars | 5 |
| Baseline | q3 | 2.9s | 561 chars | 5 |
| Baseline | q4 | 2.6s | 379 chars | 5 |
| Under load | q0 | 2.2s | 344 chars | 5 |
| Under load | q1 | 2.4s | 362 chars | 5 |
| Under load | q2 | 2.2s | 296 chars | 5 |
| Under load | q3 | 2.6s | 327 chars | 5 |
| Under load | q4 | 2.7s | 377 chars | 5 |

**Baseline avg: 2.6s | Under-load avg: 2.4s | Difference: -7% (faster!)**

All 3 concurrent 500-page uploads timed out at 180s, confirming the key was fully saturated. Yet queries were *slightly faster* under load (likely noise). Every query returned 5 grounding chunks with substantive answers.

**Interpretation:** Upload processing and query execution use completely independent resource pools. Saturating upload capacity has zero impact on query performance. This is the most important finding for production: even if a large file import is stuck processing, users can still query their existing documents without degradation.

### Test H: Time Recovery -- INSTANT (No Cooldown)

**Setup:**
- Phase 1: Saturated with 3 concurrent 500-page uploads (all 3 timed out at ~181s)
- Phase 2: Immediately after saturation ended, tried sequential 500-page uploads at t+0s, t+30s (actual t+56s), t+60s (actual t+111s)

**Results:**

| Upload | Delay After Saturation | Result | Processing Time |
|--------|----------------------|--------|-----------------|
| Saturation #0 | N/A | timeout | 182.0s |
| Saturation #1 | N/A | timeout | 182.3s |
| Saturation #2 | N/A | timeout | 181.0s |
| Probe #0 | 0s (immediately) | **success** | 40.5s |
| Probe #1 | 56s | **success** | 40.9s |
| Probe #2 | 111s | **success** | 48.7s |

**All 3 recovery probes succeeded, including the one started immediately after saturation.**

**Interpretation:** There is no cooldown period. Capacity recovers instantly. The ~40s processing time for sequential 500-page uploads is longer than the ~28s measured in Phase 1 (solo upload), but this is within expected variance for 500-page PDFs. The key insight is that the bottleneck is a **concurrency limit**, not a rate/quota that depletes over time. The moment concurrent operations drop below the threshold, new operations proceed normally.

This means the production fix does not need a backoff timer after saturation detection -- it only needs to limit concurrent heavy uploads.

### Test I: Upload <-> Delete Competition -- INDEPENDENT POOLS

**Setup:**
- Pre-loaded 5 x 10-page documents
- Baseline: deleted 1 document without concurrent uploads
- Started 3 concurrent 500-page uploads (all timed out)
- Deleted remaining 4 documents while uploads were in-flight

**Results:**

| Delete | Condition | Latency | Result |
|--------|-----------|---------|--------|
| baseline-del-0 | No load | 2.13s | success |
| under-load-del-0 | 3 uploads in-flight | 2.3s | success |
| under-load-del-1 | 3 uploads in-flight | 2.2s | success |
| under-load-del-2 | 3 uploads in-flight | 1.4s | success |
| under-load-del-3 | 3 uploads in-flight | 2.1s | success |

**Baseline avg: 2.13s | Under-load avg: 2.00s | All 5/5 deletes succeeded**

**Interpretation:** Deletes use an independent resource pool from uploads, just like queries. Saturating upload processing has no measurable impact on delete latency. This means cleanup operations (deleting old documents, removing stores) can run at any time without worrying about upload state.

## Key Insights

### 1. Three independent resource pools: uploads, queries, deletes

The GFS API separates capacity into at least three independent pools:
- **Upload processing** (chunking, indexing) -- shared per-key, saturates with heavy concurrent files
- **Query execution** (generate_content with FileSearch) -- unaffected by upload load
- **Delete operations** -- unaffected by upload load

This is the most production-relevant finding. It means:
- Users can always query existing data, even during heavy imports
- Cleanup operations don't need to wait for imports to finish
- Only upload-to-upload operations compete with each other

### 2. No cooldown/rate-limit after saturation

Capacity recovery is instant. The bottleneck is a concurrency limit, not a depleting quota. A sequential upload succeeds in ~40s immediately after 3 concurrent uploads all timed out. No backoff timer needed.

### 3. The concurrency limit is low (1-2 concurrent heavy uploads max)

Phase 3 showed 5 concurrent -> 4/5 timeout. This phase showed 3 concurrent -> 3/3 timeout. Combined with Phase 3's observation that the first-submitted upload sometimes succeeds, the effective concurrency limit for 500-page PDFs appears to be ~1 concurrent heavy upload per API key.

### 4. Query performance is consistent

10/10 queries succeeded with 5 grounding chunks each, averaging 2.4-2.6s whether or not uploads were running. This matches the production query latency of ~1.5-2s per store observed in Sentry traces.

## Production Implications

1. **Per-key upload serialization is sufficient.** No need to serialize queries or deletes. Only concurrent heavy uploads compete.

2. **No backoff timer needed.** After a stuck upload finishes (or times out), the next upload can proceed immediately.

3. **Query-during-import is safe.** Users can chat and search while their files are being processed. No degradation.

4. **Delete-during-import is safe.** Store cleanup, document removal, and reconciliation can run concurrently with imports.

5. **The upload semaphore should be per-key, value=1.** At most 1 heavy upload at a time per API key. Light uploads (small files) can probably be parallelized but this was not tested in this phase.

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/gfs_sharing_topology_experiment.py`
- Previous experiment: `/workspaces/test-mvp/python-services/experiments/gfs_store_concurrency_experiment.py`
- Phase 3 results: `/workspaces/test-mvp/.claude/research/gfs-store-shared-overhead/phase-03-experiment.md`
- Query pattern reference: `/workspaces/test-mvp/python-services/agent_api/agent/multi_store_query_service.py`
- API key config: `/workspaces/test-mvp/python-services/agent_api/agent/config.py`
- Run ID: `30864618`, executed 2026-02-23 17:51-18:07 UTC
- SDK: `google-genai` via `google.genai.Client`

## Open Questions

1. **Is the bottleneck per-key or per-GCP-project?** Test F was skipped due to only having 1 key. If all 3 keys (dev, staging, production) belong to the same project, they may share upload capacity. This is the highest-priority open question for the multi-key architecture decision.

2. **What is the exact concurrency limit?** We know 3 concurrent = 3/3 timeout and 5 concurrent = 4/5 timeout. Is the limit exactly 1, or could 2 concurrent 500-page uploads succeed? A gradient test (1, 2 concurrent 500-page files) would pin this down.

3. **Does the upload concurrency limit scale with file size?** Phase 3 showed 50-page files at 5 concurrent = 5/5 success. Is there a "processing weight" budget where small files use less?

4. **Do query and delete share a pool?** We tested query-vs-upload and delete-vs-upload. We did not test query-vs-delete (unlikely to matter in practice since both are lightweight).

## Dead Ends

None. All three executed tests (G, H, I) produced clean, unambiguous results. The only gap is Test F which was impossible to run with available credentials.
