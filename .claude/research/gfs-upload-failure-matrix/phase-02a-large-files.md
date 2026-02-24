# Phase 2a: Concurrency x File Size Matrix — Large & Super-Heavy Files (OLD DEV KEY)

## Summary

The OLD DEV KEY (`GEMINI_API_KEY_DEV` on `effi-vertex-experiment`) exhibits two distinct failure modes with direct upload (`uploadToFileSearchStore`):

1. **Super-heavy files (2000p/1.15MB) are categorically broken**: 0% pass rate even at c=1 — all 3 runs timed out at 600s with `STATE_FAILED`. This is a file-size threshold problem, not a concurrency problem.
2. **Large files (500p/291KB) degrade sharply at c>=3**: 100% pass rate at c=1-2, 61% at c=3, 33% at c=5. The transition zone is c=2 to c=3 for this key.

The 600s timeout was critical — many uploads that would have been classified as "failures" at 120s actually completed successfully at 150-593s. However, some genuinely hang forever (600s+ with `STATE_FAILED` document state).

## Raw Results

### Large Files (500 pages, 291KB) — Direct Upload, OLD DEV KEY

| Config | Runs | Total Files | Successes | Timeouts | Pass Rate | Success Duration Range |
|--------|------|-------------|-----------|----------|-----------|----------------------|
| c=1 | 3 | 3 | 3 | 0 | **100%** | 22.5–23.4s |
| c=2 | 3 | 6 | 6 | 0 | **100%** | 21.8–205.5s |
| c=3 | 6 | 18 | 11 | 7 | **61%** | 20.9–427.1s |
| c=5 | 3 | 15 | 5 | 10 | **33%** | 190.1–593.4s |

#### c=1 (baseline) — 3 runs, all fast
| Run | File-0 | Wall Time |
|-----|--------|-----------|
| 1 | 23.4s OK | 23s |
| 2 | 22.5s OK | 22s |
| 3 | 22.6s OK | 23s |

Highly consistent. ~22-23s per 500-page PDF is the baseline processing time.

#### c=2 — 3 runs, 100% pass but massive latency variance
| Run | File-0 | File-1 | Wall Time | Notes |
|-----|--------|--------|-----------|-------|
| 1 | 21.8s OK | 22.9s OK | 23s | Fast — both files processed normally |
| 2 | 205.5s OK | 201.4s OK | 205s | **9x slower** — but still succeeded |
| 3 | 150.2s OK | 23.1s OK | 150s | Mixed — one fast, one 7x slower |

**KEY INSIGHT**: c=2 is 100% reliable but introduces severe latency unpredictability. Runs 2 and 3 would have been classified as timeouts at 120s. The 600s timeout revealed them as slow-but-successful.

#### c=3 — 6 runs, 61% pass rate (transition zone)
| Run | File-0 | File-1 | File-2 | Wall Time | OK/Total |
|-----|--------|--------|--------|-----------|----------|
| 1a | 27.5s OK | 427.1s OK | 195.0s OK | 427s | 3/3 |
| 1b | 26.6s OK | 21.1s OK | 27.9s OK | 28s | 3/3 |
| 2a | 367.4s OK | 159.5s OK | **604.8s TIMEOUT** | 605s | 2/3 |
| 2b | **603.6s TIMEOUT** | 147.2s OK | 22.9s OK | 604s | 2/3 |
| 3a | **604.1s TIMEOUT** | 20.9s OK | **604.6s TIMEOUT** | 605s | 1/3 |
| 3b | **604.3s TIMEOUT** | **600.8s TIMEOUT** | **601.4s TIMEOUT** | 605s | 0/3 |

Run-level pass rate: 2/6 fully successful, 2/6 partial, 2/6 total failure.

**Observation**: Results are bimodal — a file either completes quickly (20-30s) or enters a "stuck" state that either resolves after minutes (150-427s) or never resolves (600s+ timeout with `STATE_FAILED`).

#### c=5 — 3 runs, 33% pass rate
| Run | File-0 | File-1 | File-2 | File-3 | File-4 | Wall Time | OK/Total |
|-----|--------|--------|--------|--------|--------|-----------|----------|
| 1 | **600.5s TO** | **603.0s TO** | **602.4s TO** | **604.7s TO** | **600.0s TO** | 605s | 0/5 |
| 2 | **603.0s TO** | 201.7s OK | 593.4s OK | **604.8s TO** | **605.3s TO** | 606s | 2/5 |
| 3 | **604.0s TO** | 556.5s OK | 190.1s OK | 296.0s OK | **603.2s TO** | 604s | 3/5 |

Run 1 was total failure (0/5). Runs 2-3 had partial success. Even the successful uploads at c=5 took 190-593s (compared to 22s baseline).

### Super-Heavy Files (2000 pages, 1.15MB) — Direct Upload, OLD DEV KEY

| Config | Runs | Total Files | Successes | Timeouts | Pass Rate |
|--------|------|-------------|-----------|----------|-----------|
| c=1 | 3 | 3 | 0 | 3 | **0%** |

| Run | File-0 | Document State |
|-----|--------|----------------|
| 1 | 600.5s TIMEOUT | STATE_FAILED |
| 2 | 602.4s TIMEOUT | STATE_FAILED |
| 3 | 604.7s TIMEOUT | STATE_FAILED |

**Categorically broken.** All 3 runs timed out after the full 600s. The document state is `STATE_FAILED` in all cases — the backend gave up on processing the file. Higher concurrency was not tested because the baseline (c=1) already has 0% pass rate.

Note: Prior experiments showed 2000-page files succeeding on fresh keys with shorter timeouts (~10s). This 0% rate may be key-specific (old dev key accumulation/quota issue). Phase 3 (key isolation tests) will determine if fresh keys behave differently.

### Reference: Small File Baseline (from Phase 1 smoke test)
| Config | Files | Pass Rate | Duration |
|--------|-------|-----------|----------|
| small (5p), c=1 | 1 | 100% | 9.6s |

## Duration Distribution Analysis

### Success Duration Percentiles (Large Files)

| Config | n | Min | p25 | p50 (median) | p75 | p95 | Max |
|--------|---|-----|-----|--------------|-----|-----|-----|
| c=1 | 3 | 22.5s | 22.5s | 22.6s | 23.4s | 23.4s | 23.4s |
| c=2 | 6 | 21.8s | 23.0s | 87.1s | 200.8s | 204.7s | 205.5s |
| c=3 | 11 | 20.9s | 22.9s | 27.9s | 195.0s | 411.5s | 427.1s |
| c=5 | 5 | 190.1s | 201.7s | 296.0s | 556.5s | 586.0s | 593.4s |

**Striking pattern**: At c=5, even the *fastest* successful upload (190s) is 8x slower than the c=1 baseline. The backend is clearly under contention.

### "Would 120s have been enough?"

Files that succeeded but took >120s (these would have been classified as failures with the old timeout):

| Config | Files > 120s that succeeded | % of successes that would be "false failures" at 120s |
|--------|---------------------------|-----------------------------------------------------|
| c=1 | 0/3 | 0% |
| c=2 | 3/6 | 50% |
| c=3 | 4/11 | 36% |
| c=5 | 5/5 | 100% |

**At c=5, every successful upload took >120s.** A 120s timeout would have shown 0% pass rate across all runs.

## Key Findings

### 1. File Size Cliff at ~2000 Pages
Super-heavy files (2000p) are completely unprocessable by the old-dev key — 0% success even at c=1 with 600s timeout. This isn't a timeout issue; the documents reach `STATE_FAILED`. Something in the GFS backend can't handle files this large on this key.

### 2. Concurrency Degradation is Gradual, Not a Cliff
For large files (500p):
- c=1: 100% pass, fast (22-23s)
- c=2: 100% pass, but with 0-10x latency variance
- c=3: 61% pass, bimodal (either fast or stuck)
- c=5: 33% pass, even successes are 8-25x slower than baseline

There is no single "safe concurrency" — even c=2 sometimes takes 200s.

### 3. Bimodal Outcome Distribution
At c>=2, individual files in the same batch exhibit wildly different durations: one file finishes in 22s while another in the same concurrent batch takes 427s or times out entirely. This suggests contention at the backend level (possibly per-store or per-key processing queues).

### 4. The 600s Timeout was Essential
At 120s: c=2 would show ~67% pass rate (vs actual 100%), c=5 would show 0% (vs actual 33%). Many "slow but successful" uploads were hidden by the old timeout.

However, even at 600s, some files genuinely never complete — the `STATE_FAILED` document state confirms the backend abandoned processing.

## Anomalies and Surprises

1. **c=3 run 1b was perfectly fast (28s wall time)** while c=3 run 3b was 100% failure (all 3 files timed out). Same key, same file, same concurrency — just different timing. Suggests time-varying backend capacity.

2. **c=2 run 1 was fast (23s) while run 2 was 10x slower (205s)**. These ran sequentially on the same key, minutes apart. Backend load is volatile.

3. **c=5 runs improved over time**: run 1 was 0/5, run 2 was 2/5, run 3 was 3/5. Could be coincidence (n=3 is small) or could suggest some backend warm-up / queue clearing effect.

## Sources

### Test Configuration
- API Key: `old-dev` (= `GEMINI_API_KEY_DEV` on project `effi-vertex-experiment`)
- Method: `uploadToFileSearchStore` (direct upload)
- Timeout: 600s per upload
- Poll interval: 5s
- Each run uses a fresh, isolated file search store

### Raw Result Files
All JSON results stored at `/tmp/gfs-experiment/results/`:
- `old-dev_large_c1_direct_run{1,2,3}_20260223-*.json`
- `old-dev_large_c2_direct_run{1,2,3}_20260223-*.json`
- `old-dev_large_c3_direct_run{1,2,3}_20260223-*.json` (batch 1)
- `old-dev_large_c3_direct_run{1,2,3}_20260224-*.json` (batch 2)
- `old-dev_large_c5_direct_run{1,2,3}_20260223-*.json`
- `old-dev_super-heavy_c1_direct_run{1,2,3}_20260224-*.json`

### Experiment Harness
`/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_experiment.py`

### Timestamps
- Experiment started: 2026-02-23 22:25 UTC
- Experiment ended: 2026-02-24 00:49 UTC
- Total wall time: ~2h 24m

## Open Questions

1. **Is the super-heavy failure key-specific?** Fresh keys may handle 2000-page files fine — prior experiments showed success on fresh keys. Phase 3 will test this.

2. **What's the file size threshold?** We tested 500p (works at c=1) and 2000p (fails at c=1). Where's the cutoff? 750p? 1000p? This wasn't in the original plan but may be worth one targeted test.

3. **Is the latency variance time-of-day dependent?** c=3 batch 2 run 1 (00:27 UTC) was perfectly fast while batch 1 run 3 (23:04 UTC) was 100% failure. Could be coincidence or could reflect Google's backend capacity fluctuations.

4. **Does store accumulation matter?** Each run used a fresh store, so we're testing concurrency in isolation. In production, stores have existing documents — does that make it worse?

## Dead Ends

- **c=8 and c=10 for large files**: Skipped per plan since c=5 already showed 33% pass rate. The trend is clear.
- **c=2, c=3, c=5 for super-heavy**: Skipped since c=1 already has 0% pass rate. Cannot be worse.
