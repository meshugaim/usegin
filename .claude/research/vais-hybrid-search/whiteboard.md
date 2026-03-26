# Research: VAIS Hybrid Search — Complete Findings

**Date:** 2026-03-26
**Status:** COMPLETE
**Experiments:** `python-services/experiments/vais_hybrid_*.py`, `vais_keyword_retrieval_test.py`

---

## Executive Summary

VAIS (Vertex AI Search / Discovery Engine) performs **hybrid retrieval by default** — both keyword (BM25) and semantic (embedding) retrieval run in parallel on every search. This is baked into the architecture, not configurable, and has been active since we started using VAIS. No production code changes are needed to get hybrid search.

The `ranking_expression` feature (ENG-3474) was a ranking-layer optimization on top of already-hybrid retrieval. It was reverted because it solved a problem that didn't exist: keyword-matching documents were already being retrieved.

---

## What VAIS Does On Every Search

```
Query
  │
  ├──► Keyword retrieval (BM25/topicality) ──► candidates
  │                                               │
  ├──► Semantic retrieval (embeddings)     ──► candidates ──► merge ──► rank ──► results
  │
  └──► (both run in parallel, always)
```

| Stage | What happens | Configurable? | Our status |
|-------|-------------|---------------|------------|
| **Retrieval** | Keyword + semantic in parallel, merged | Thresholds via `relevanceFilterSpec` (v1alpha only) | Default (both active) |
| **Ranking** | Default VAIS ranking or custom `ranking_expression` | Yes, via `RANK_BY_FORMULA` | Default (reverted custom formula) |
| **Scoring** | `chunk.relevance_score` = semantic similarity always | No | As-is |

---

## Proven Facts (with experimental evidence)

### 1. Keyword retrieval is independently active

**Experiment:** Uploaded a gardening plant catalog (`doc-garden-keywords`) containing query terms "budget", "pricing", "cost", "infrastructure" as field labels — zero semantic relevance to finance/technology.

**Result:** Appeared at rank #4 (score 0.685) when searching for "budget pricing cost infrastructure". A document about plants was surfaced purely because it contained query terms.

**Evidence:** `experiments/vais_keyword_retrieval_test.py` — Test 1

### 2. Two retrieval paths are independently controllable

**Experiment:** Used `relevanceFilterSpec` (v1alpha REST API) to selectively block each path.

| Condition | Results | Gardening doc | Semantic-only docs |
|-----------|---------|---------------|-------------------|
| Default (both paths) | 7 results | Present (rank #4) | Present |
| Block semantic (`semanticSearchThreshold: HIGH`) | 4 results | **Survives** | **Vanish** |
| Block keyword (`keywordSearchThreshold: HIGH`) | 6 results | **Vanishes** | **Survive** |

The gardening doc survives when semantic is blocked (keyword path retrieved it) and vanishes when keyword is blocked (semantic path didn't retrieve it). Two independent pipelines, proven.

**Evidence:** `experiments/vais_keyword_retrieval_test.py` — Test 2

### 3. ranking_expression with RANK_BY_FORMULA works (but is optional)

**Experiment:** Compared result ordering with and without `ranking_expression` across 12 queries, 3 trials each.

**Result:** 1-position swap at positions 4-5, 100% consistent. The formula is evaluated and reorders results. Effect is modest because VAIS embeddings already capture keyword signal — keyword-dense docs score high on both axes.

**Key detail:** `chunk.relevance_score` is always pinned to `semantic_similarity_score` regardless of formula. The formula only affects ordering, not the reported score. Composite score available via `result.rank_signals.relevance_score`.

**Evidence:** `experiments/vais_hybrid_ordering.py`, `experiments/vais_hybrid_diagnostic.py`

### 4. rank_signals expose both scoring components

**Experiment:** Inspected `result.rank_signals` on search responses.

**Available signals:**
- `semantic_similarity_score` — embedding similarity (range: 0-1)
- `keyword_similarity_score` — BM25/topicality (range: 0-3+)
- `relevance_score` — composite (shifts with formula)
- `topicality_rank`, `document_age`, `boosting_factor`, `default_rank`, `pctr_rank`, `custom_signals`

Both keyword and semantic scores are real floats (not NaN). `fill_nan()` is not needed for our data.

**Evidence:** `experiments/vais_hybrid_diagnostic.py`

---

## relevanceFilterSpec — Future Tuning Capability

`relevanceFilterSpec` (Public Preview since Dec 2025) lets you control each retrieval path's aggressiveness independently:

```json
{
  "relevanceFilterSpec": {
    "semanticSearchThreshold": {"relevanceThreshold": "HIGH"},
    "keywordSearchThreshold": {"relevanceThreshold": "LOW"}
  }
}
```

Threshold values: `LOW`, `MEDIUM`, `HIGH` (higher = stricter = fewer candidates from that path).

**Current status:** v1alpha REST only. Not in our Python SDK (`google-cloud-discoveryengine` v0.16.0). To use it today, we'd need raw REST calls with service account token auth. Worth revisiting when it hits v1 or v1beta.

**Use cases:**
- Raise keyword threshold if getting too many noisy keyword matches
- Raise semantic threshold if embeddings surface loosely related content
- Could help tune precision vs recall per retrieval path

---

## History of Misunderstandings

| Date | What happened | What was wrong |
|------|---------------|----------------|
| 2026-02-09 | `vertex_ai_search_experiment.py` phase 9 tested `ranking_expression="relevance_score"` | Used wrong backend (defaulted to `RANK_BY_EMBEDDING`), concluded feature requires `embedding_spec` |
| 2026-03-12 | `vais_product_gaps_experiment.py` tested `ranking_expression` with metadata fields | Same wrong backend, same wrong conclusion: "FAILED — requires embedding_spec" |
| 2026-03-25 | ENG-3474 added `RANK_BY_FORMULA` + `ranking_expression` to production | Correct backend, but unit test mocked SDK — no real verification |
| 2026-03-26 | This research: compared `chunk.relevance_score` across conditions | Wrong field — always pinned to semantic score, made feature look broken |
| 2026-03-26 | Inspected `rank_signals`, ran larger corpus test | Proved formula works, but effect is modest |
| 2026-03-26 | Investigated retrieval layer | Discovered VAIS already does hybrid retrieval by default — the whole ranking exercise was unnecessary |
| 2026-03-26 | Reverted ENG-3474 | Ranking formula was optional optimization on top of already-hybrid retrieval |

---

## Production Status

**Current state (after revert):**
- Hybrid retrieval: **active** (always on, by architecture)
- Hybrid ranking: **default VAIS ranking** (no custom formula)
- No production code changes needed

**Optional future improvements (not urgent):**
1. `relevanceFilterSpec` — tune keyword vs semantic retrieval aggressiveness (when SDK supports it)
2. `ranking_expression` — re-add if we find specific cases where default ranking produces poor results
3. `rank_signals` — read composite score if consumers need it for display/filtering

---

## Experiment Files

| File | What it does |
|------|-------------|
| `experiments/vais_hybrid_search_experiment.py` | Initial 3-doc verification (showed feature appeared broken) |
| `experiments/vais_hybrid_diagnostic.py` | Inspects rank_signals, tests fill_nan/rr formulas |
| `experiments/vais_hybrid_ordering.py` | Proves ordering changes with 8-doc corpus |
| `experiments/vais_keyword_retrieval_test.py` | Proves independent keyword retrieval path via gardening doc + relevanceFilterSpec |
| `.claude/research/vais-hybrid-search/phases/` | Detailed phase findings (gitignored) |

---

## Test Infrastructure (still alive on effi-vais-v1-dev)

- DataStore: `hybrid-exp-cd64300f`
- Engine: `hybrid-eng-cd64300f`
- 9 docs indexed (3 original + 5 ordering test + 1 gardening)
- Clean up with: `uv run python experiments/vais_hybrid_search_experiment.py` (without `--no-cleanup`)
