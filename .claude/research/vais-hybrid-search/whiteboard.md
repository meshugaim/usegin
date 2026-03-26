# Research: Making VAIS Hybrid Search Functional

## Current State
Phase: COMPLETE | Status: PROVEN — hybrid search works, with caveats
Last checkpoint: Phase 3 confirmed ordering changes with larger corpus (12 queries, 3 trials, 100% consistent)

## Verdict

**VAIS hybrid search IS functional.** The `ranking_expression` with `RANK_BY_FORMULA` works as documented. Our original experiment had two flaws that made it appear broken:

1. **We read `chunk.relevance_score`** — this is ALWAYS pinned to `semantic_similarity_score`, regardless of the formula. It never reflects the composite score. This is by design.
2. **Our corpus was too small** — only 2 relevant results where keyword-strong already ranked #1 on both signals, so reordering was invisible.

## Proven Facts

| Claim | Status | Evidence |
|-------|--------|----------|
| `RANK_BY_FORMULA` is a real feature | PROVEN | GA since Aug 2025, documented, formula evaluated internally |
| `semantic_similarity_score` and `keyword_similarity_score` are valid variables | PROVEN | `rank_signals` returns real floats (0.87, 2.86, etc.) |
| The formula changes result ordering | PROVEN | 1-position swap at positions 4-5 across 12 queries, 100% consistent |
| `chunk.relevance_score` reflects the formula | DISPROVEN | Always equals `semantic_similarity_score` regardless of formula |
| NaN handling (`fill_nan`) is needed | DISPROVEN | Both signals are populated floats for our data |
| `embedding_spec` is needed | DISPROVEN | Only needed for `RANK_BY_EMBEDDING` mode (different pipeline) |

## Key Insight

The effect is **modest** (1-position swap out of 6 results) because VAIS's embedding model already captures term-level signal. Keyword-dense docs score high on BOTH semantic AND keyword axes (keyword-only-1 got the highest semantic score at 0.875). The hybrid formula provides incremental benefit at the margins, not dramatic reordering.

## Production Recommendations

1. **Current ranking expression is correct and functional.** No code change needed for the formula itself. The `ranking_expression` and `RANK_BY_FORMULA` in `search_service.py` work.

2. **Consider reading `rank_signals` for composite score.** If we want the displayed relevance score to reflect the hybrid formula (not just semantic similarity), read `result.rank_signals.relevance_score` instead of `chunk.relevance_score`. Optional — depends on whether consumers care about the score value vs just ordering.

3. **Consider reciprocal rank formula.** Google's own example uses `rr()`: `0.2 * rr(semantic_similarity_score, 16) + 0.8 * rr(keyword_similarity_score, 16)`. This normalizes the two signals to comparable scales. Our raw `* 0.5 + * 0.5` formula works but the signals have different ranges (semantic: 0-1, keyword: 0-3+), so keyword may dominate in practice. Worth tuning on staging.

4. **No urgent production changes needed.** The formula is working — it just has modest impact because VAIS embeddings already capture keyword signal.

## Phases

1. **Documentation & SDK analysis** — DONE (phase-01a-web-docs.md, phase-01b-sdk-proto.md)
2. **Diagnostic experiment** — DONE (phase-02-diagnostic.md, experiments/vais_hybrid_diagnostic.py)
3. **Ordering confirmation** — DONE (phase-03-ordering.md, experiments/vais_hybrid_ordering.py)

## Dead Ends
- `ranking_expression` without `RANK_BY_FORMULA` → requires `embedding_spec` (wrong backend)
- `fill_nan()` — not needed, signals are real floats
- Comparing `chunk.relevance_score` across conditions — always pinned to semantic score
- Prior experiments (product_gaps, vertex_ai_search) tested wrong variables and wrong backend
