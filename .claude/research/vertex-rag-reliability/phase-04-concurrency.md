# Phase 4: Concurrent Upload Reliability

## Summary

Vertex AI RAG Engine handles concurrent uploads **reliably with zero silent hangs**. All 40 uploads across 4 rounds (5, 10, 5, and 20 parallel) completed successfully. The timing distribution shows a **queuing pattern** (not bimodal) — uploads complete one-at-a-time in a FIFO-like queue rather than in parallel, causing wall time to scale linearly with concurrency. This is the opposite of GFS's behavior: GFS silently hangs, Vertex RAG queues and completes every upload.

## Findings

### Q1: Concurrent Upload Contention — GOOD (No Silent Hangs)

**40/40 uploads succeeded. 0 timeouts. 0 errors. 0 silent hangs.**

| Round | Concurrency | File Size | Success | Error | Timeout | Min | Max | Avg | Stdev |
|-------|-------------|-----------|---------|-------|---------|-----|-----|-----|-------|
| Round 1 | 5 | 1M chars | 5 | 0 | 0 | 14.0s | 58.6s | 36.4s | 17.3s |
| Round 2 | 10 | 1M chars | 10 | 0 | 0 | 16.6s | 117.6s | 66.1s | 33.6s |
| Round 3 | 5 | 3M chars | 5 | 0 | 0 | 31.8s | 139.4s | 86.2s | 42.8s |
| Round 4 | 20 | 1M chars | 20 | 0 | 0 | 11.8s | 223.2s | 118.5s | 65.3s |

### Timing Distribution: Queuing, Not Bimodal

The completion pattern reveals that Vertex RAG Engine **serializes uploads** on the server side. Uploads do not run truly in parallel — they appear to be processed through a queue. Evidence:

**Round 1 (5x 1M):** Completions arrive at ~14s, 27s, 36s, 47s, 59s — roughly 12-13s gaps between completions. The single-upload baseline for 1M is 15.3s, so each upload takes close to its single-upload time.

**Round 2 (10x 1M):** Completions at ~17s, 26s, 41s, 49s, 60s, 70s, 83s, 94s, 103s, 118s — roughly 10-11s gaps. The first upload completes faster (16.6s), consistent with it getting immediate processing.

**Round 3 (5x 3M):** Completions at ~32s, 59s, 87s, 114s, 139s — roughly 27-28s gaps. The single-upload baseline for 3M is 31.5s, so again each takes close to its single time.

**Round 4 (20x 1M):** Completions spaced ~11s apart, first at 11.8s, last at 223.2s. 20 uploads x ~11s per = ~220s total, which matches the wall time exactly.

**This is NOT bimodal.** The distribution is uniform/linear — each upload waits its turn in the queue. GFS's signature is bimodal: either fast (<45s) or infinite. Vertex RAG's signature is monotonic: each upload completes in order, with predictable timing.

### Comparison with Phase 2 Single-Upload Baselines

| File Size | Single Upload (Phase 2) | Per-Upload in Concurrent Queue | Slowdown Factor |
|-----------|------------------------|-------------------------------|----------------|
| 1M chars | 15.3s avg | ~11-13s per slot (Round 1-4) | ~0.8x (slightly faster per-upload!) |
| 3M chars | 31.5s avg | ~27s per slot (Round 3) | ~0.9x (slightly faster per-upload!) |

Surprisingly, the per-upload processing time in concurrent mode is slightly **faster** than single uploads. This may be due to server-side caching/warming effects or simply noise. The key finding is that concurrency does not degrade per-upload time — it adds queue wait time but processing remains stable.

### Wall Time Scaling

| Concurrency | File Size | Wall Time | Expected (N x per-upload) | Ratio |
|-------------|-----------|-----------|--------------------------|-------|
| 5 | 1M | 58.6s | 5 x 15.3s = 76.5s | 0.77x |
| 10 | 1M | 117.6s | 10 x 15.3s = 153s | 0.77x |
| 5 | 3M | 139.4s | 5 x 31.5s = 157.5s | 0.89x |
| 20 | 1M | 223.2s | 20 x 15.3s = 306s | 0.73x |

Wall time is consistently 73-89% of pure serial execution. This suggests the server has **some limited parallelism** (maybe 1.2-1.4x), but is far from fully parallel. The queue is the bottleneck, not the upload/processing.

### GFS vs Vertex RAG: Concurrent Upload Behavior

| Metric | GFS | Vertex RAG Engine |
|--------|-----|-------------------|
| Silent hangs | Yes, at ~1500 concurrent pages | **None** (40/40 success at 20 concurrent) |
| Timing distribution | Bimodal (fast or infinite) | **Monotonic queue** (uniform spacing) |
| Error signaling | None (silent hang) | **N/A (no errors occurred)** |
| Rate limiting | None (just hangs) | **Implicit queue** (serialized processing) |
| Behavior under load | Unpredictable, non-deterministic | **Predictable linear scaling** |
| Max tested concurrency | ~1500 pages triggers hangs | **20 x 1M files = 20M chars (no issues)** |

### Key Difference from GFS

The fundamental difference: **GFS fails silently under contention. Vertex RAG Engine queues work and completes it.** This is a critical reliability advantage:

1. **No silent hangs** — every upload eventually completes
2. **Predictable timing** — you can estimate wall time as `N * single_upload_time * 0.8`
3. **No bimodal outcomes** — you never get the "will it complete or hang forever?" uncertainty
4. **Implicit backpressure** — the queue naturally throttles throughput without errors

The tradeoff is that uploads aren't truly parallel, so high concurrency means high wall time. But wall time is a performance concern, not a reliability concern. GFS's silent hangs are a reliability failure — work is lost with no signal.

## Per-Worker Timing Detail

### Round 1: 5x 1M parallel
```
worker  0:  35.8s
worker  1:  47.0s
worker  2:  58.6s
worker  3:  26.7s
worker  4:  14.0s
```

### Round 2: 10x 1M parallel
```
worker  0:  49.4s
worker  1:  16.6s
worker  2: 103.3s
worker  3:  60.3s
worker  4:  69.5s
worker  5:  83.3s
worker  6: 117.6s
worker  7:  40.7s
worker  8:  26.0s
worker  9:  94.2s
```

### Round 3: 5x 3M parallel
```
worker  0:  31.8s
worker  1: 139.4s
worker  2:  87.2s
worker  3: 113.8s
worker  4:  58.6s
```

### Round 4: 20x 1M parallel
```
worker  0: 158.8s    worker 10: 144.7s
worker  1: 101.9s    worker 11:  78.4s
worker  2: 211.0s    worker 12:  37.3s
worker  3:  92.6s    worker 13:  69.1s
worker  4: 124.8s    worker 14: 135.6s
worker  5:  11.8s    worker 15: 191.0s
worker  6:  58.6s    worker 16: 112.6s
worker  7: 223.2s    worker 17:  44.8s
worker  8: 201.8s    worker 18: 167.9s
worker  9: 178.7s    worker 19:  26.4s
```

## Corpus Info

- Test corpus: `projects/768786717495/locations/us-west1/ragCorpora/6301661778598166528`
- Display name: `reliability-concurrent-2060`
- Files in corpus after experiment: 40
- This corpus was created specifically for this test to avoid mixing with Phase 2/3 data

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_concurrent_upload.py`
- Test files: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_test_files/`
- Phase 2 baselines: `/workspaces/test-mvp/.claude/research/vertex-rag-reliability/phase-02-single-file.md`
- SDK: `google-cloud-aiplatform 1.136.0`, `vertexai.rag`
- GCP project: `effi-vertex-experiment`, region: `us-west1`

## Open Questions

1. **What is the concurrency ceiling?** We tested up to 20 parallel uploads with zero failures. At what point does the queue become a problem? 50? 100? 500? The per-upload processing time remained stable at 20, suggesting the ceiling may be very high.

2. **Is the queue per-corpus or per-project?** If per-corpus, uploading to multiple corpora simultaneously could achieve true parallelism. If per-project, all corpora share the same bottleneck.

3. **Does the queue have a maximum depth?** At some point, queued uploads might be rejected. We didn't find this limit at 20 concurrent.

4. **How does this interact with different file types?** All our tests used .txt files. .docx or .pdf processing might have different concurrency characteristics due to different server-side processing pipelines.

5. **Is there a rate limit that returns explicit errors?** All 40 uploads were queued and processed — we never triggered an explicit rate limit response. A higher concurrency test (50+) might surface one.

## Dead Ends

None — the experiment ran cleanly on the first attempt. The `concurrent.futures.ThreadPoolExecutor` approach worked well since `upload_file()` is synchronous and thread-safe. No need for `asyncio` or signal-based timeouts.
