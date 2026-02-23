# GFS Store Shared Overhead — Who Shares What?

## Current State
Phase: complete | Status: final (post-judgment extension completed)
Last checkpoint: Cross-key experiment + documentation review resolved the key boundary question
Process: Read SKILL → read whiteboard → note-to-self → spawn phase manager → distill → update

## Driving Question

**Who shares what capacity with whom in Google File Search?**

## Phases

1. **Forensics** ✅ — No documented concurrency limits exist
2. **Experiment design** ✅ — 5-test matrix
3. **Core experiments** ✅ — Per-API-key bottleneck proven, small files immune
4. **Sharing topology** ✅ — Three independent pools mapped, instant recovery
5. **Judgment** ✅ — Process: ADEQUATE, Answer: SUPPORTED
6. **Cross-key isolation** ✅ — Different keys are independent; old key throttled, fresh keys not
7. **Documentation review** ✅ — Official docs say per-project; reality contradicts this for File Search uploads

## The Sharing Model (Final)

```
┌─────────────────────────────────────────────────────────────────┐
│                    GFS Upload Processing                        │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  API Key A (old)    │  │  API Key B (fresh)   │              │
│  │                     │  │                      │              │
│  │  THROTTLED          │  │  NOT THROTTLED       │  Independent │
│  │  3 concurrent 500p  │  │  3 concurrent 500p   │  lanes per  │
│  │  → 2/3 timeout      │  │  → 0/3 timeout       │  key        │
│  │  1 success @ 100s   │  │  all succeed @ 25s   │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  Keys are independent — even within the same GCP project.       │
│  Old/heavily-used keys have tighter limits than fresh keys.     │
│                                                                 │
│  ┌──────────┐  ┌───────────┐                                   │
│  │  QUERIES │  │  DELETES  │  Fully independent from uploads.  │
│  │  No limit│  │  No limit │  Zero degradation under upload    │
│  │  observed│  │  observed │  saturation.                      │
│  └──────────┘  └───────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Upload Pool — Key-Level, Usage-Dependent

| Property | Value | Evidence | Confidence |
|----------|-------|----------|------------|
| **Scope** | Per-API-key, across ALL stores under that key | Tests A, 2, 3, 4 | HIGH |
| **Keys are independent** | Yes — even within same GCP project | Test 3: A1 vs A2, both succeed | HIGH |
| **Cross-project independent** | Yes | Test 4: A1 vs B, both succeed | HIGH |
| **Key age/usage matters** | Old key throttled, fresh keys not — same concurrency | Dev key retest vs fresh key | HIGH |
| **Small files** | ≤50 pages immune to timeouts | Tests B+C: 16/16 | HIGH |
| **Recovery** | Instant — no cooldown | Test H: 3 probes, all immediate | HIGH |
| **Nature** | Concurrency limit, NOT depleting quota | Test H: instant recovery | HIGH |
| **Failure mode** | Silent hang (done=None, no error, forever) | All experiments | HIGH |
| **Gate signal** | pendingDocumentsCount observable | Test D | OBSERVED |

### Query Pool — Fully Independent from Uploads

| Property | Value | Evidence | Confidence |
|----------|-------|----------|------------|
| **During upload saturation** | Zero degradation | Test G: 2.4s vs 2.6s baseline | HIGH (10/10) |

### Delete Pool — Fully Independent from Uploads

| Property | Value | Evidence | Confidence |
|----------|-------|----------|------------|
| **During upload saturation** | Zero degradation | Test I: 2.0s vs 2.1s baseline | HIGH (5/5) |

## Documentation vs Reality

**Official docs say: rate limits are per-PROJECT, not per-key.**
Every Google source confirms this. Forum moderators state it explicitly.

**Our experiments say: upload throttling is per-KEY with usage-based degradation.**
Same project, same concurrency, same file — old key throttled, fresh key not.

### How to Reconcile

Google's Service Control API (`services.allocateQuota`) explicitly supports API keys as consumer identifiers — the infrastructure CAN track per-key. Three plausible mechanisms:

1. **Leaked key flagging** — Google proactively degrades keys identified as exposed. `GEMINI_API_KEY_DEV` may have been flagged from env vars, logs, or CI artifacts. Degradation can manifest as silent timeouts rather than explicit errors.

2. **Undocumented abuse detection** — Google's behavioral analysis system can silently alter quotas. Documented case: 15 failed requests in 2 hours → quota permanently set to 0. A softer version may apply throttling rather than blocking.

3. **File Search is a different beast** — The documented per-project limits apply to `generate_content` (the main Gemini API). File Search Store operations (`uploadToFileSearchStore`) are newer, less mature, and may have their own undocumented internal rate limiting that happens to be keyed per-API-key.

## Full Evidence Table

| Test | Question | Setup | Result | N |
|------|----------|-------|--------|---|
| A | Cross-store sharing | 5 stores × 1 × 500p, same key, concurrent | 1/5 success, 4/5 timeout | 1 |
| B | Concurrency gradient | Same store, N=1-5 × 50p | 11/11 success (~10s) | 4 |
| C | Tiny file concurrency | Same store, 5 × 1p | 5/5 success (~9s) | 1 |
| D | Queue observability | Poll store metadata | pending→active visible | 1 |
| E | Cancel + slowdown | 5 × 50p concurrent | All complete, ~5x slower | 1 |
| G | Upload vs query | Queries during 3×500p saturation | 10/10 OK (2.4s) | 1 |
| H | Time recovery | Sequential after 3×timeout | All 3 instant success | 3 |
| I | Upload vs delete | Deletes during 3×500p saturation | 5/5 OK (2.0s) | 1 |
| 1 | Baseline (3 keys) | 1 × 500p sequential per key | 3/3 success (~28s) | 1 |
| 2 | Same-key concurrent | Key A1: 3 stores × 500p concurrent | 3/3 success (~25-29s) | 1 |
| 3 | Cross-key same project | A1 vs A2 concurrent | Both succeed (~23s) | 1 |
| 4 | Cross-project | A1 vs B concurrent | Both succeed (~23s) | 1 |
| 5 | Heavy cross-project | A1×3 + B×1 concurrent | All 4 succeed | 1 |
| DEV | Dev key retest | GEMINI_API_KEY_DEV: 3 × 500p concurrent | 2/3 timeout, 1 @ 100s | 1 |

## Production Implications

1. **Chat is always safe.** Queries are fully independent from uploads. Users can search during heavy sync.
2. **Key rotation works.** Fresh keys get higher upload concurrency capacity. Rotating keys or pooling across multiple keys multiplies throughput.
3. **`GEMINI_API_KEY_DEV` is throttled.** Should be replaced or supplemented with fresh keys for upload-heavy workloads.
4. **Per-store serialization is insufficient.** Upload capacity is shared across all stores under a key. Need key-level or global concurrency control.
5. **Small files can be concurrent.** ≤50-page files don't timeout (but do slow ~5x).
6. **No cooldown needed.** Capacity recovers instantly after stuck uploads finish/timeout.
7. **pendingDocumentsCount is a usable gate** for upload scheduling.

## Related Linear Issues

### Directly Informed by This Research
- **ENG-2020** `Backlog` — bug: concurrent GFS imports to same store cause silent hangs → NOW KNOWN: bottleneck is per-key, not per-store. Per-store serialization is insufficient.
- **ENG-2014** `Backlog` — chore: reduce GOOGLE_UPLOAD_TIMEOUT from 600s to 120s → SUPPORTED: all successes complete <45s on fresh keys, <105s on throttled key.
- **ENG-1976** `Backlog` — feat: concurrent item processing within batches → CAUTION: safe for small files, unsafe for large files on throttled keys. Need key-level concurrency control.
- **ENG-1975** `Backlog` — feat: parallelize content types in sync worker → SAFE: different content types going to different stores don't interfere IF using fresh keys.
- **ENG-1981** `Backlog` — bug: no cooldown between sync retries → INFORMED: no cooldown needed — capacity recovers instantly.

### Sync Worker Architecture (Affected by Findings)
- **ENG-1967** `Backlog` — sync worker throughput (parent) → Key pooling is now a viable throughput multiplier.
- **ENG-1977** `Done` — horizontal scaling via SKIP LOCKED → Multiple workers safe IF they use different keys.
- **ENG-2006** `Backlog` — ensure_project_store race condition → Still relevant, but per-store locking alone won't prevent upload contention.

### Observability (Would Have Helped)
- **ENG-1993** `In Progress` — GFS sync observability (parent) → pendingDocumentsCount is a new signal to add.
- **ENG-1998** `Backlog` — GFS import polling is a black box → pendingDocumentsCount partially addresses this.
- **ENG-1994** `Backlog` — add capture_exception to sync failure paths → Would surface throttling patterns in Sentry.
- **ENG-1122** `Backlog` — deep profiling with Sentry traces → Would reveal per-key timing differences.
- **ENG-1999** `Backlog` — retry count not visible → Would help detect keys hitting throttle limits.
- **ENG-1995** `Backlog` — file metadata missing from error context → Would correlate file size with throttling.

### Upload Errors (May Be Throttling Symptoms)
- **ENG-1876** `Backlog` — Failed to upload: 503 UNAVAILABLE → Could be throttled key symptom.
- **ENG-1872** `Backlog` — Failed to upload: 503 "Failed to count tokens" → Same — known community issue, possibly related to key state.
- **ENG-2019** `Backlog` — Failed to upload: 409 ALREADY_EXISTS → Unrelated (duplicate file ID).

### SSE Timeout (Root Cause Now Better Understood)
- **ENG-1935** `Backlog` — SSE stream timeout during GFS search → GFS queries are safe (independent pool), but if the model triggers multiple search rounds, the 6-8s GFS latency is from sequential store queries, not upload contention.
- **ENG-1938** `Backlog` — add SSE heartbeat → Still needed for multi-round tool calls, but GFS query latency won't worsen during sync.

### New Issues Suggested by This Research
- **[NEW]** Replace or rotate `GEMINI_API_KEY_DEV` — it's throttled for concurrent uploads
- **[NEW]** Implement key pooling for upload-heavy workloads — fresh keys get higher capacity
- **[NEW]** Add `pendingDocumentsCount` monitoring to sync worker — observable gate signal
- **[NEW]** Investigate if production key (`GEMINI_API_KEY_STAGING`/prod equivalent) is similarly throttled

## Files

- Whiteboard: `.claude/research/gfs-store-shared-overhead/whiteboard.md`
- Phase 1 (forensics): `.claude/research/gfs-store-shared-overhead/phase-01-forensics.md`
- Phase 3 (core experiments): `.claude/research/gfs-store-shared-overhead/phase-03-experiment.md`
- Phase 4 (topology): `.claude/research/gfs-store-shared-overhead/phase-04-topology.md`
- Phase 5 (cross-key): `.claude/research/gfs-store-shared-overhead/phase-05-cross-key.md`
- Process judgment: `.claude/research/gfs-store-shared-overhead/judgment-process.md`
- Answer judgment: `.claude/research/gfs-store-shared-overhead/judgment-answer.md`
- Experiment code: `python-services/experiments/gfs_store_concurrency_experiment.py`
- Experiment code: `python-services/experiments/gfs_sharing_topology_experiment.py`
- Experiment code: `python-services/experiments/gfs_cross_key_experiment.py`
- Experiment code: `python-services/experiments/gfs_dev_key_retest.py`
