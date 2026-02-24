# Phase 3: Key Isolation — Fresh Keys vs Old Dev Key

## Summary

The bottleneck is **per-project, not per-key or global**. Fresh keys on the same project (`effi-vertex-experiment`) perform nearly as poorly as the old dev key, while a fresh key on a different project (`effi-gfs-research-b`) achieves near-perfect results on configurations that fail catastrophically on the original project. Super-heavy (2000p) files are NOT universally broken — they succeed reliably at c=1 on clean projects (~81s avg). Key age/freshness has minimal effect within the same project.

## Key Findings

### 1. The bottleneck is PER-PROJECT

This is the single most important finding. The same configuration produces radically different results depending on which GCP project the key belongs to:

| Config | old-dev (effi-vertex-experiment) | fresh-a1 (effi-vertex-experiment) | fresh-a2 (effi-vertex-experiment) | fresh-b (effi-gfs-research-b) |
|--------|:---:|:---:|:---:|:---:|
| Super-heavy c=1 | **0%** (0/3) | **67%** (2/3) | **0%** (0/3) | **100%** (3/3) |
| Large c=3 | **61%** (11/18) | **78%** (7/9) | **33%** (3/9) | **100%** (9/9) |
| Large c=5 | **33%** (5/15) | **40%** (6/15) | — | **100%** (15/15) |

**fresh-b (different project)** is flawless where all three keys on `effi-vertex-experiment` struggle.

### 2. Super-heavy (2000p) is NOT universally broken

On old-dev, 2000p was 0% at c=1 — seemingly impossible. But on fresh-b:
- **Super-heavy c=1: 100%** (3/3), avg 81.3s
- **Super-heavy c=2: 67%** (4/6), avg 84.6s

The 2000p file CAN be processed. It takes ~80s on a clean project. The old project is degraded.

### 3. Key freshness has minimal effect WITHIN the same project

fresh-a1 and fresh-a2 are brand-new keys on the same project as old-dev. They perform similarly to old-dev — sometimes slightly better (fresh-a1 at super-heavy c=1: 67% vs old-dev: 0%), sometimes worse (fresh-a2 at large c=3: 33% vs old-dev: 61%). The variation is within the noise of the backend's inherent volatility.

### 4. The degraded project exhibits high latency even on successes

When uploads DO succeed on `effi-vertex-experiment`, they are dramatically slower than on `effi-gfs-research-b`:

| Config | fresh-a1 avg success time | fresh-b avg success time |
|--------|:---:|:---:|
| Large c=3 | **279.3s** | **22.7s** |
| Large c=5 | **382.1s** | **26.4s** |

That's a 12-15x latency difference for the same operation. The degraded project isn't just failing more — it's slow even when it succeeds.

### 5. Fresh-b large files have near-zero variance

| Config | fresh-b min | fresh-b max | fresh-b avg |
|--------|:---:|:---:|:---:|
| Large c=3 | 21.1s | 33.1s | 22.7s |
| Large c=5 | 22.9s | 33.1s | 26.4s |

All 24 large-file uploads on fresh-b succeeded, with tight timing (21-33s). Zero bimodality. This is what healthy GFS processing looks like.

## Complete Results Table

### All Configurations Tested (Phase 3)

| Key | Size | Pages | C | Pass | Total | Rate | Timeouts | Avg Success Time |
|-----|------|-------|---|------|-------|------|----------|-----------------|
| fresh-a1 | super-heavy | 2000 | 1 | 2 | 3 | 67% | 1 | 77.2s |
| fresh-a1 | large | 500 | 3 | 7 | 9 | 78% | 2 | 279.3s |
| fresh-a1 | large | 500 | 5 | 6 | 15 | 40% | 9 | 382.1s |
| fresh-a2 | super-heavy | 2000 | 1 | 0 | 3 | 0% | 3 | — |
| fresh-a2 | large | 500 | 3 | 3 | 9 | 33% | 6 | 256.2s |
| fresh-b | super-heavy | 2000 | 1 | 3 | 3 | 100% | 0 | 81.3s |
| fresh-b | super-heavy | 2000 | 2 | 4 | 6 | 67% | 2 | 84.6s |
| fresh-b | large | 500 | 3 | 9 | 9 | 100% | 0 | 22.7s |
| fresh-b | large | 500 | 5 | 15 | 15 | 100% | 0 | 26.4s |

### Phase 2 Baseline (old-dev) for Comparison

| Key | Size | Pages | C | Pass | Total | Rate | Timeouts | Avg Success Time |
|-----|------|-------|---|------|-------|------|----------|-----------------|
| old-dev | super-heavy | 2000 | 1 | 0 | 3 | 0% | 3 | — |
| old-dev | large | 500 | 3 | 11 | 18 | 61% | 6 | ~22-540s (bimodal) |
| old-dev | large | 500 | 5 | 5 | 15 | 33% | 9 | ~22-540s (bimodal) |
| old-dev | small/medium | 5-50 | 1-10 | 115 | 115 | 100% | 0 | ~9.5s |

### Per-Run Detail: fresh-b Super-Heavy c=2

| Run | File 0 | File 1 |
|-----|--------|--------|
| 1 | SUCCESS 85s | TIMEOUT 601s (STATE_FAILED) |
| 2 | TIMEOUT 602s (STATE_FAILED) | SUCCESS 79s |
| 3 | SUCCESS 90s | SUCCESS 84s |

Even on the clean project, c=2 with 2000p shows the bimodal pattern: one file processes quickly while the other may hang. This suggests 2000p at c>=2 hits a global processing limit, not just a project-level issue.

### Per-Run Detail: fresh-a1 Large c=3

| Run | File 0 | File 1 | File 2 |
|-----|--------|--------|--------|
| 1 | SUCCESS 111s | SUCCESS 523s | SUCCESS 468s |
| 2 | SUCCESS 127s | SUCCESS 207s | SUCCESS 346s |
| 3 | TIMEOUT 604s (FAILED) | TIMEOUT 600s (FAILED) | SUCCESS 174s |

Bimodal behavior: some files fast (~100-200s), some very slow (300-500s), some timeout. Consistent with a project under processing strain.

## Answers to Phase Questions

### Is the bottleneck per-key, per-project, or global?

**Per-project**, primarily. Three keys on `effi-vertex-experiment` (old-dev, fresh-a1, fresh-a2) all show degraded performance, while fresh-b on `effi-gfs-research-b` is near-flawless. However, there may be a secondary global limit visible at super-heavy c=2 even on the clean project (67% pass rate).

### Does key age/freshness matter?

**No, not meaningfully.** fresh-a1 and fresh-a2 (brand new) perform comparably to old-dev (months old) on the same project. The minor differences (fresh-a1 super-heavy: 67% vs old-dev: 0%) are within the backend's inherent volatility — fresh-a2 also got 0% on that same config.

### Is super-heavy universally broken?

**No.** Super-heavy (2000p) works reliably at c=1 on a clean project (100%, ~81s). It starts struggling at c=2 even on clean projects (67%), suggesting 2000p concurrent processing has real limits. On the degraded project (`effi-vertex-experiment`), super-heavy is effectively broken even at c=1.

## Hypothesis: Project-Level Processing Quota Degradation

The `effi-vertex-experiment` project has been used extensively for months of GFS experiments — hundreds of store creates, thousands of document uploads, many of which ended in timeouts and forced deletions. This historical usage appears to have degraded the project's processing allocation at Google's backend.

Evidence supporting this hypothesis:
1. Fresh keys on the same project don't help (rules out key-level throttling)
2. A fresh key on a different project works perfectly (rules out global limits for tested configs)
3. Even successes on the degraded project are 12-15x slower than on the clean project
4. The degradation pattern is consistent with resource exhaustion, not rate limiting (no 429 errors, just hangs)

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_experiment.py`
- Analysis script: `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_analyze.py`
- Result JSON files: `/tmp/gfs-experiment/results/fresh-*.json` (28 files)
- Phase 2 baseline results: `/tmp/gfs-experiment/results/old-dev*.json` (42 files)
- GCP projects: `effi-vertex-experiment` (project ID 768786717495), `effi-gfs-research-b` (project ID 663439666827)
- API keys tested: fresh-a1 (gfs-research-a1), fresh-a2 (gfs-research-a2) on effi-vertex-experiment; fresh-b (gfs-research-b) on effi-gfs-research-b

## Open Questions

1. **Would a third project confirm the pattern?** We've only tested two projects. A third clean project would strengthen the per-project hypothesis.
2. **Can a degraded project recover?** If we stop using `effi-vertex-experiment` for a week, does it recover? Or is the degradation permanent?
3. **What is the exact global limit for super-heavy?** fresh-b at c=2 shows 67% — is c=1 truly the safe limit for 2000p, or does the 67% at c=2 just reflect bad luck?
4. **Does the project's store count matter?** `effi-vertex-experiment` may have orphaned stores/documents from previous experiments that contribute to the degradation.
5. **Would Google support acknowledge per-project processing quotas?** This is undocumented behavior.

## Dead Ends

- **Key freshness as a solution**: Creating new API keys on the same degraded project does not fix the problem. This was a reasonable hypothesis but definitively disproven.
