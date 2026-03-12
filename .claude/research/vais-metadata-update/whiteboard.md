# Research: VAIS Product Capabilities & Migration Gaps

## Current State
Phase: COMPLETE | Status: all experiments run
Last checkpoint: Product gaps experiment completed 2026-03-12
Next: None — findings documented

---

## Part 1: Metadata Update Without Re-Upload

**Answer: YES — with `update_mask=["struct_data"]` on INCREMENTAL re-import**

Confidence: PROVEN (empirically verified 2026-03-12)

`update_mask` on `ImportDocumentsRequest` bypasses the CONTENT_REQUIRED check. Send a JSONL with just `{id, structData}` — no content field. Metadata is stored, indexed, and filterable. Original content/chunks survive. ~85s LRO latency (full import pipeline).

| Method | Stores | Indexes | Preserves Content | Needs Re-upload |
|---|---|---|---|---|
| `update_document()` | YES | **NO** | YES | No |
| INCREMENTAL (no mask) | N/A | N/A | N/A | REJECTED |
| INCREMENTAL + `update_mask=["struct_data"]` | **YES** | **YES** | **YES** | **NO** |

Undocumented pattern. `update_document()` not indexing may be a bug worth filing with Google.

- Experiment: `python-services/experiments/vais_metadata_update_experiment.py`

---

## Part 2: Product-Level Gaps (GFS → VAIS Migration)

### Test 1: boost_spec — WORKS

Conditional boosting accepted with schema-configured fields. Tested:
- Boost by string field: `department: ANY("engineering")` + boost=0.5 ✅
- Boost by numeric range: `date_epoch >= 1706745600` + boost=0.8 ✅
- Negative boost: `department: ANY("marketing")` + boost=-0.5 ✅

All accepted without errors. GFS has no equivalent — this gives VAIS relevance tuning that GFS can't do.

### Test 2: ranking_expression — FAILED

Requires `embedding_spec` even with schema configured. Both `"relevance_score"` and composite expressions (`"relevance_score * 0.7 + priority * 0.3"`) fail with:

> 400 Valid `embedding_spec` has to be provided along with `ranking_expression`.

This is a product requirement, not a config issue. Would need custom embeddings to use. Not viable without significant additional setup.

### Test 3: List-Type Workaround — EXACT MATCH ONLY

`ANY()` on comma-joined strings only matches the **full string**, not individual values within it.

| Filter | Result |
|---|---|
| `ANY("bob@co.com,carol@co.com,dave@co.com,eve@co.com,frank@vendor.com")` | 1 match (exact full string) |
| `ANY("bob@co.com")` | 0 matches |
| `ANY("bob")` | 0 matches |
| `ANY("string1", "string2")` multi-value | 0 matches |

**Must denormalize.** Options:
- Separate fields: `recipient_1`, `recipient_2`, ... (brittle, fixed cardinality)
- Separate documents per recipient (data explosion)
- Accept that VAIS can't filter by list membership (feature gap)

GFS supports `string_list` natively — this is a real product-level gap.

### Test 4: Chunk Limit — CEILING at 224 chunks for 600K chars

| Metric | Value |
|---|---|
| Document size | 600,000 chars |
| Expected chunks (~500 char each) | ~1,000 |
| ChunkService count | 224 |
| Search result count | 38 |

Two separate ceilings observed:
1. **Indexing ceiling**: Only 224 of expected ~1000 chunks were created (layout-based chunking may produce larger chunks, or there's a per-document limit)
2. **Search retrieval ceiling**: Only 38 of 224 chunks returned by search (search has its own per-document limit)

Needs further investigation: is this chunk_size=500 producing larger chunks with layout parsing, or a hard document-level cap?

### Test 5: Negation — WORKS with NOT prefix

| Syntax | Result |
|---|---|
| `access_level != "draft"` | **ERROR** — `!=` not supported |
| `NOT access_level: ANY("draft")` | **WORKS** — 2 results, no drafts |
| `-access_level: ANY("draft")` | **WORKS** — same as NOT |
| `access_level: ANY("internal", "external")` | **WORKS** — positive workaround |

Both `NOT` and `-` prefix work. Parity with GFS's `!=` achieved through different syntax.

---

## Product Comparison: VAIS vs GFS

### VAIS Advantages
- **Heading-aware chunking** (`includeAncestorHeadings`) — GFS can't do this
- **boost_spec** — conditional relevance boosting, GFS has no equivalent
- **Metadata in search results** — chunks include `struct_data`, GFS doesn't return metadata
- **Reliable file processing** — no silent hangs, deterministic errors, all Office formats
- **Honest LROs** — always complete with success or clear error
- **Faster raw retrieval** — ~600ms vs GFS 6-8s (sequential Gemini calls)
- **Metadata-only updates** — via `update_mask` on ImportDocumentsRequest
- **Negation filters** — `NOT field: ANY("value")` works

### GFS Advantages
- **Synthesized answers** — Gemini generates grounded natural-language responses
- **String list support** — `string_list_value` for multi-value fields (recipients, CC)
- **No schema required** — ad-hoc metadata, no upfront planning
- **Filter syntax** — `!=`, `OR` operators (VAIS has `NOT` and `AND` but no `OR` or `!=`)
- **Already in production** — established multi-store pattern, 14+ metadata fields

### Blockers for Migration
1. **List fields** — VAIS can't filter by list membership. Must denormalize or accept the gap.
2. **Filter syntax translation** — AIP-160 → Discovery Engine syntax throughout tool descriptions and backend.
3. **No built-in synthesis** — need separate Gemini call for answer generation.
4. **Schema upfront** — must define all fields before upload.

### Not Blockers (Solved)
- ~~Negation~~ → `NOT` prefix works
- ~~Boosting~~ → `boost_spec` works with schema
- ~~Metadata updates~~ → `update_mask` on ImportDocumentsRequest works

---

## Experiments
- `vais_metadata_update_experiment.py` — metadata-only update via update_mask
- `vais_product_gaps_experiment.py` — boost, ranking, lists, chunk limit, negation
- `vertex_ai_search_experiment.py` — original comprehensive evaluation
- `vertex_ai_search_latency_experiment.py` — raw chunks vs Gemini latency
- `vais_parallel_query_experiment.py` — parallel query safety + speedup
- `vertex_reliability_gap_filling.py` — reliability comparison vs GFS
- `vais_gcs_deletion_experiment.py` — GCS blob deletion safety
