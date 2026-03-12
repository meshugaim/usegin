# Research: VAIS Product Capabilities & Migration Gaps

## Current State
Phase: COMPLETE | Status: all experiments run, filter size test pending
Last checkpoint: Metadata filtering deep dive completed 2026-03-12
Next: Filter size limit test running in background

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

**Must denormalize.** See Part 3 for list workaround analysis.

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

## Part 3: Metadata Filtering — Complete Comparison

### Filter Syntax

| Capability | GFS (AIP-160) | VAIS (Discovery Engine) | Gap? |
|---|---|---|---|
| String equality | `key = "value"` | `key: ANY("value")` | Syntax only |
| Multiple string values | `key = "a" OR key = "b"` | `key: ANY("a", "b")` | Syntax only |
| Not equal | `key != "value"` | `NOT key: ANY("value")` | Syntax only |
| Numeric comparison | `key >= 100` | `key >= 100` | No gap |
| Numeric range | `key >= 10 AND key <= 20` | `IN(key, 10, 20)` or same AND | No gap |
| AND | `a = "x" AND b = "y"` | `a: ANY("x") AND b: ANY("y")` | Syntax only |
| OR (same field) | `key = "a" OR key = "b"` | `key: ANY("a", "b")` | No gap |
| OR (cross-field) | `a = "x" OR b = "y"` | `a: ANY("x") OR b: ANY("y")` | **No gap** (corrected — VAIS supports OR) |
| Parenthetical grouping | Supported | Supported (required for mixed AND/OR) | No gap |
| List membership | `recipients : "bob@co.com"` | **Not supported** | **Real gap** |
| `=` on strings | Works | Does NOT work (must use `ANY()`) | Syntax only |
| `!=` operator | Works | Does NOT work (must use `NOT ... ANY()`) | Syntax only |
| NOT on compound expr | N/A | `NOT (A AND B)` does NOT work | VAIS limitation |
| Substring/wildcard | Not supported | Not supported | Neither has it |
| Case sensitivity | Case-sensitive | Case-sensitive | Same |

### Metadata Type Support

| Type | GFS | VAIS | Gap? |
|---|---|---|---|
| String | ✅ `string_value` | ✅ `"type": "string"` | No gap |
| Number (int/float) | ✅ `numeric_value` | ✅ `"type": "number"` | No gap |
| String list | ✅ `string_list_value` | **Not supported** | **Real gap** |
| Boolean | Via string/number | Via string | Same |
| Nested objects | Not supported | Dot notation access | VAIS advantage |

### Schema Requirements

| Aspect | GFS | VAIS |
|---|---|---|
| Schema declaration | Not needed — ad-hoc at upload | Required before upload |
| Adding new fields | Just include in next upload | Schema update + potential re-index |
| Field indexability | All fields filterable by default | Must set `indexable: true` per field |
| Max fields | No documented limit | 50 indexable fields |
| Schema migration | N/A | `update_schema()` LRO (~3s), idempotent |

### The List Membership Gap — Workaround Analysis

GFS supports `string_list` natively. `recipients : "bob@co.com"` tests membership — bob is IN the list. One document, multiple values per field. VAIS has no equivalent.

**Best workaround: Two-hop via Supabase**
1. Query Supabase: "which document IDs have bob in recipients?" (~50ms)
2. Filter VAIS: `file_id: ANY("id1", "id2", ..., "idN")` (~600ms)
- Already have email metadata in Supabase
- Total latency still faster than GFS's 6-8s
- ANY() size limit: ~262K values (only constrained by gRPC 10 MiB payload). No practical limit for our use case.

**Rejected alternatives:**
- Denormalize into separate fields (`recipient_1`, `recipient_2`) — fixed cardinality, filter complexity
- Duplicate documents per recipient — data explosion, dedup burden
- Comma-joined string — experimentally proven: ANY() only matches full string

### Metadata in Search Results

| Aspect | GFS | VAIS |
|---|---|---|
| Metadata returned with chunks | **No** — chunks have text only | **Yes** — `document_metadata.struct_data` on every chunk |
| Source identification | Must parse `grounding_chunk.web.title` | `chunk.name` path + full metadata dict |
| Use case | Need separate lookup to show "from: alice, subject: Q4 Budget" | Metadata available inline — can render source info directly |

### Metadata Updates

| Aspect | GFS | VAIS |
|---|---|---|
| Post-upload metadata change | Delete + re-upload only | `update_mask=["struct_data"]` on INCREMENTAL re-import (proven) |
| Latency | Full re-upload + re-index | ~85s LRO (no content re-upload) |
| `update_document()` API | N/A | Exists but broken — stores, doesn't index |

---

## Part 4: Full Product Comparison (VAIS vs GFS for our use case)

### VAIS Advantages
- **Heading-aware chunking** (`includeAncestorHeadings`) — structural context in every chunk
- **boost_spec** — conditional relevance boosting by metadata fields
- **Metadata in search results** — chunks include full struct_data
- **Reliable file processing** — no silent hangs, all Office formats, honest LROs
- **Faster raw retrieval** — ~600ms vs GFS 6-8s
- **Metadata-only updates** — via update_mask on ImportDocumentsRequest
- **Negation filters** — `NOT field: ANY("value")` works
- **Chunk visibility** — `ChunkServiceClient.list_chunks()` for debugging
- **Import transparency** — `error_samples` on every import result
- **Parallel queries** — 2.76x speedup, thread-safe (verified)

### GFS Advantages
- **Synthesized answers** — Gemini generates grounded natural-language responses in one call
- **String list support** — native `string_list_value` with `:` membership operator
- **No schema required** — ad-hoc metadata, no upfront planning
- **Already in production** — established patterns, 14+ metadata fields, battle-tested

### Previously Thought to be GFS Advantages (Corrected)
- ~~OR operator~~ → VAIS supports OR including cross-field
- ~~!= operator~~ → VAIS supports via `NOT field: ANY("value")`
- ~~Negation~~ → VAIS supports NOT and - prefix

### Migration Blockers
1. **List membership** — only structural gap. Workaround: two-hop via Supabase (viable if ANY() clause supports enough IDs)
2. **Filter syntax translation** — not a capability gap, just different syntax throughout codebase
3. **No built-in synthesis** — separate Gemini call needed (out of scope per user)
4. **Schema upfront** — operational friction, not a blocker

---

## Experiments
- `vais_metadata_update_experiment.py` — metadata-only update via update_mask
- `vais_product_gaps_experiment.py` — boost, ranking, lists, chunk limit, negation
- `vais_filter_size_experiment.py` — ANY() clause size limits (~262K UUIDs, gRPC 10 MiB limit)
- `vertex_ai_search_experiment.py` — original comprehensive evaluation
- `vertex_ai_search_latency_experiment.py` — raw chunks vs Gemini latency
- `vais_parallel_query_experiment.py` — parallel query safety + speedup
- `vertex_reliability_gap_filling.py` — reliability comparison vs GFS
- `vais_gcs_deletion_experiment.py` — GCS blob deletion safety

## Research Phase Files
- `phase-01-online-docs.md` — VAIS UpdateDocument API research
- `phase-02-local-code.md` — Local codebase metadata update patterns
- `phase-03-filter-syntax.md` — VAIS filter syntax deep dive
- `phase-03-gfs-filter-syntax.md` — GFS filter syntax deep dive
- `phase-03-filter-edge-cases.md` — VAIS filter edge case testing
- `phase-04-filter-size-limits.md` — ANY() clause size limits (~262K values, gRPC 10 MiB limit)
