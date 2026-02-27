# VAIS Parallel Query Experiment

**Date**: 2026-02-26
**Script**: `python-services/experiments/vais_parallel_query_experiment.py`
**Engine**: `vais-eng-bbbbbbbb` (1 DataStore, 8 synced documents)
**GCP Project**: `effi-vertex-experiment`

## Setup

Single DataStore queried 3 times concurrently with different queries and metadata filters.
Tests concurrent SDK calls against the Discovery Engine backend (same engine, different queries).

| Query | Filter | Target Content |
|-------|--------|----------------|
| Q1: financial results + budget | `project_id + access_level: internal` | Q4 report, budget forecast |
| Q2: engineering roadmap + architecture | `project_id + entity_type: file` | Roadmap, standup |
| Q3: client proposal + external comms | `project_id + access_level: external` | Proposal, external emails |

5 iterations per mode. Warmup query excluded from measurements.

## Results

### A. Latency -- 2.76x speedup

| Mode | Avg Total | Std Dev | Per-Query Avg | Speedup |
|------|-----------|---------|---------------|---------|
| Sequential | 3641ms | 423ms | Q1=1207ms, Q2=1219ms, Q3=1213ms | 1.00x |
| Parallel (ThreadPool) | 1319ms | 22ms | Q1=1289ms, Q2=1312ms, Q3=1266ms | **2.76x** |
| Parallel (asyncio) | 1472ms | 80ms | Q1=1374ms, Q2=1423ms, Q3=1426ms | **2.47x** |

Per-query latency is identical in all modes (~1.2-1.3s). Google does not throttle concurrent
queries from the same client. The variance reduction in parallel mode is notable: std went
from 423ms (sequential) to 22ms (ThreadPool).

ThreadPool slightly outperforms asyncio.to_thread -- likely due to lower overhead from
direct thread management vs asyncio's event loop scheduling.

### B. Reliability -- zero errors

- **0/15 errors** in sequential mode
- **0/15 errors** in ThreadPool parallel mode
- **0/15 errors** in asyncio parallel mode
- **0/45 total errors** across all 45 query executions

### C. Result Parity -- identical results

| Query | Sequential Chunks | Parallel Chunks | Async Chunks | Score |
|-------|-------------------|-----------------|--------------|-------|
| Q1 | [0, 0, 0, 0, 0] | [0, 0, 0, 0, 0] | [0, 0, 0, 0, 0] | n/a |
| Q2 | [1, 1, 1, 1, 1] | [1, 1, 1, 1, 1] | [1, 1, 1, 1, 1] | 0.736 |
| Q3 | [0, 0, 0, 0, 0] | [0, 0, 0, 0, 0] | [0, 0, 0, 0, 0] | n/a |

Results are perfectly deterministic. Q2 returns exactly 1 chunk with relevance score 0.736
across ALL 45 executions. Q1 and Q3 return 0 chunks consistently (seed data has weak semantic
match for those queries). No phantom results, no race conditions, no data corruption.

### D. Thread Safety -- confirmed

`discoveryengine.SearchServiceClient()` is safe to instantiate and use from multiple threads
concurrently. 30 parallel calls (15 ThreadPool + 15 asyncio) with zero errors, zero missing
fields, zero corrupted responses.

## Comparison with GFS Parallel Experiment (ENG-1529)

| Metric | GFS (4 stores) | VAIS (1 store, 3 queries) |
|--------|-----------------|---------------------------|
| Speedup | 3.11x | 2.76x |
| Per-query latency | ~3.5-4.5s | ~1.2-1.3s |
| Error rate | 0/120 | 0/45 |
| SDK type | Sync (genai) | Sync (discoveryengine) |
| Parallelism | ThreadPoolExecutor | ThreadPool + asyncio.to_thread |

VAIS is inherently faster per-query (~1.2s vs ~3.5s for GFS), so the absolute time saved
is smaller, but the speedup ratio is comparable. Both products handle concurrent requests
without rate limiting.

## Production Implications

**Safe to parallelize VAIS queries across DataStores.**

For the current architecture (1 DataStore per project, metadata-filtered queries),
parallelism helps when:
1. Querying MULTIPLE projects simultaneously (cross-project search)
2. Running the same query with different filters (e.g., internal vs external)
3. Fan-out search across multiple engines

For single-project single-query scenarios, there's nothing to parallelize --
VAIS is already fast at ~1.2s per query.

**Recommended approach**: `asyncio.to_thread` for async codebases (natural fit for
FastAPI), `ThreadPoolExecutor` for sync codebases. Both work; ThreadPool has
marginally lower overhead.
