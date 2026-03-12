# Phase 03: VAIS (Discovery Engine) Filter Syntax — Complete Reference

Research date: 2026-03-12
Sources: Official Google Cloud docs, Python SDK reference, our verified experiments

---

## 1. What the Filter Is Designed For

The `SearchRequest.filter` field restricts search results to documents matching specified metadata criteria. From the docs: filters "restrict your search to a specific set of documents." Filters narrow the search space — they do NOT replace semantic search. The query must still be semantically relevant enough for the search engine to surface documents before filters can apply.

This is an important behavioral distinction: **filters are not a pure database WHERE clause**. They combine with relevance-based retrieval, meaning a filter alone cannot retrieve documents that the query doesn't surface.

---

## 2. Formal Grammar (EBNF)

From the official docs:

```ebnf
filter = expression, { " AND " | " OR ", expression };

expression = [ "-" | "NOT " ],
    | "(", expression, ")"
    | text_field, ":", "ANY", "(", literal, { ",", literal }, ")"
    | numerical_field, ":", "IN", "(", lower_bound, ",", upper_bound, ")"
    | numerical_field, comparison, double
    | geolocation_field, ":", "GEO_DISTANCE(", literal, ",", distance_in_meters, ")"
    | geolocation_field, ":", "GEO_DISTANCE(", latitude_double, ",", longitude_double, ",", distance_in_meters, ")"
    | datetime_field, comparison, literal_iso_8601_datetime_format;

lower_bound = ( double, [ "e" | "i" ] ) | "*";
upper_bound = ( double, [ "e" | "i" ] ) | "*";
comparison = "<=" | "<" | ">=" | ">" | "=";
```

---

## 3. Supported Operators — Complete List

### Logical Operators

| Operator | Supported | Notes |
|----------|-----------|-------|
| `AND` | YES | Combines expressions; both must be true |
| `OR` | YES | Either can be true; cross-field OR supported |
| `NOT` | YES | Prefix negation: `NOT field: ANY("val")` |
| `-` | YES | Equivalent to NOT: `-field: ANY("val")` |
| `()` | YES | Parenthetical grouping for precedence |

**Verified**: OR across different fields works. Example: `department: ANY("legal") OR priority: ANY("high")` — confirmed in our experiment (vertex_ai_search_experiment.py, 8/8 tests pass).

### Comparison Operators

| Operator | Supported | Works with |
|----------|-----------|------------|
| `=` | YES | Numbers, datetime, booleans (NOT strings — see below) |
| `!=` | **NO** | Not supported. Use `NOT field: ANY("val")` instead |
| `<` | YES | Numbers, datetime |
| `>` | YES | Numbers, datetime |
| `<=` | YES | Numbers, datetime |
| `>=` | YES | Numbers, datetime |
| `:` | YES | Used with ANY(), IN(), GEO_DISTANCE() — NOT a "contains" operator |

### Function Operators

| Function | Supported | Works with | Syntax |
|----------|-----------|------------|--------|
| `ANY()` | YES | Text/string fields | `field: ANY("value1", "value2")` |
| `IN()` | YES | Numeric range queries | `field: IN(10i, 100e)` |
| `GEO_DISTANCE()` | YES | Geolocation fields | `field: GEO_DISTANCE("address", meters)` |

### NOT Supported

| Operator | Status | Notes |
|----------|--------|-------|
| `!=` | **NO** | Returns error. Workaround: `NOT field: ANY("val")` |
| `LIKE` / wildcards | **NO** | No substring, prefix, or pattern matching |
| `IN` (SQL-style) | **NO** | Use `ANY()` for set membership |
| `CONTAINS` | **NO** | No containment operator |
| `BETWEEN` | **NO** | Use `IN()` with bounds or compound comparison |
| `:` as "contains" | **NO** | `:` is only used as separator before ANY/IN/GEO_DISTANCE |

---

## 4. Operator Details by Field Type

### Text/String Fields

**Syntax**: `field: ANY("value1", "value2")`

```
department: ANY("engineering")                    # single value
department: ANY("legal", "hr")                    # multi-value (OR within)
category: ANY("persona_A")                        # key property
```

**Critical**: The `=` operator does NOT work for string struct_data fields. Our experiment confirmed:
- `department = "engineering"` → ERROR: "Unsupported field on comparison operators"
- `department: "engineering"` (without ANY) → ERROR
- `department: ANY("engineering")` → WORKS

**Exception**: `=` works for boolean string values: `pet-friendly = "true"`. The docs show this pattern for booleans specifically.

**Case sensitivity**: Not explicitly documented. Our experiments used lowercase values consistently.

**Escaping**: Backslash (`\\`) and quote (`\"`) must be escaped in literals.

**No substring matching**: `ANY("bob")` does NOT match `"bob@co.com"`. Exact match only.

### Numeric Fields

**Comparison syntax**: `field >= 2`, `field < 100`, `field = 42`

**Range syntax**: `field: IN(lower, upper)` with bound modifiers:
- `i` suffix = inclusive bound
- `e` suffix = exclusive bound (default)
- `*` = infinity (negative for lower, positive for upper)

```
score: IN(*, 100.0e)      # score < 100
score: IN(10i, 100e)      # 10 <= score < 100
version >= 2               # comparison operator
price < 175                # comparison operator
```

### Datetime Fields

**Comparison syntax**: `field >= "2024-04-16"`

Accepted formats:
- ISO 8601: `"2024-04-16T12:00:00-07:00"`
- Date only: `"2024-04-16"` (matches whole day)
- Year only: `"2023"` (matches whole year)
- Unix epoch microseconds: numeric value

```
manufactured_date = "2023"                        # all of 2023
manufactured_date >= "2024-04-16"                 # on or after
manufactured_date < "2024-04-16T12:00:00-07:00"  # before specific time
```

### Boolean Fields

**Syntax**: `field = "true"` or `field = "false"` (quoted string, not bare boolean)

```
pet-friendly = "true"
non-smoking = "false"
```

### Geolocation Fields

**Address syntax**: `field: GEO_DISTANCE("address string", distance_meters)`
**Coordinate syntax**: `field: GEO_DISTANCE(latitude, longitude, distance_meters)`

```
office.location: GEO_DISTANCE("1600 Amphitheater Pkwy, Mountain View, CA", 500)
office.location: GEO_DISTANCE(34.1829, -121.293, 500)
NOT office.location: GEO_DISTANCE("Palo Alto, CA", 1000)
```

---

## 5. Compound Expressions

### Cross-Field OR — WORKS

```
department: ANY("legal") OR department: ANY("hr")          # same field OR
department: ANY("engineering") OR priority: ANY("high")    # cross-field OR
```

**Note**: The whiteboard.md line 111 incorrectly states VAIS has "no `OR`". This is wrong — OR is verified working in our experiments (8/8 filter tests pass in vertex_ai_search_experiment.py).

### Nested Parentheses — WORKS

```
(price < 175 AND pet-friendly = "true") OR (price < 125 AND pet-friendly = "false")
```

### Negation — WORKS

```
NOT access_level: ANY("draft")                             # NOT prefix
-access_level: ANY("draft")                                # - prefix (equivalent)
NOT (price < 175 AND pet-friendly = "true")                # negate complex expression
```

Our experiment (vais_product_gaps_experiment.py, Test 5) confirmed:
- `!=` → ERROR (not supported)
- `NOT field: ANY("val")` → WORKS
- `-field: ANY("val")` → WORKS
- Positive workaround `field: ANY("allowed1", "allowed2")` → also WORKS

---

## 6. Nested Field Access

**Dot notation supported**: `office.location`, `structData.category`

For structured data, the docs say: "specify the full path to the field: `structData.category`."

For unstructured data with struct_data metadata, our experiment found:
- **Bare key names work**: `department: ANY("engineering")` ✓
- **Prefixed keys silently fail**: `custom_metadata.department: ANY("engineering")` returns empty results (no error!)

This is a critical gotcha — wrong prefix silently returns zero results rather than erroring.

---

## 7. Schema Requirements

Filtering requires **indexable fields** in the data store schema:

1. Fields must be declared with `"indexable": true` in the schema
2. Schema must be defined **BEFORE** uploading documents
3. Maximum **50 indexable fields** per data store
4. Use `SchemaServiceClient.update_schema()` on `default_schema`

```python
schema_definition = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "department": {"type": "string", "indexable": True, "retrievable": True},
        "uuid":       {"type": "string", "indexable": True, "retrievable": True},
        "version":    {"type": "number", "indexable": True, "retrievable": True},
    },
}
```

**Field property flags**:
- `indexable` — enables filtering and faceting
- `retrievable` — includes field in search responses
- `searchable` — includes field in full-text search
- `completable` — enables autocomplete on field
- `dynamicFacetable` — enables dynamic faceting

**Without schema**: struct_data fields are stored but NOT indexed for filtering. The data is there, but filters silently return nothing.

---

## 8. DOCUMENTS vs CHUNKS Mode

### Filter Application

Filters apply at the **document level** regardless of search result mode. In CHUNKS mode, filters narrow to documents whose struct_data matches, then chunks from those documents are returned.

### CHUNKS Mode Gotchas

From our experiment:
- `result.document` is **None** in CHUNKS mode — extract document ID from `chunk.name` path: `.../documents/{doc_id}/chunks/{chunk_id}`
- "Data stores with document chunking turned on aren't optimized for returning documents"
- Chunk results include `content`, `relevance_score`, `document_metadata`, `page_span`
- `document_metadata` is **EMPTY** for text/plain uploads (populated for PDFs)
- struct_data from the document does NOT appear on chunk `document_metadata`

### No Chunk-Level Filtering

There is no way to filter on chunk-specific attributes. All filtering is based on the parent document's struct_data. The docs do not document any chunk-level filter fields.

---

## 9. Behavior with Missing Fields

From our mixed metadata experiment (vertex_ai_search_mixed_metadata_experiment.py, 6/6 pass):

**Documents missing a filtered field are silently excluded** — no errors, no false matches.

Example: If Doc A has `thread_id` but Doc B does not, filtering `thread_id: ANY("abc")` returns only Doc A. Doc B is excluded because it lacks the field entirely.

This means you can use a **union schema** — declare all possible fields, and documents simply omit keys they don't have. Filtering on absent keys silently excludes those documents.

---

## 10. Structured vs Unstructured Data Store Differences

| Aspect | Structured | Unstructured |
|--------|-----------|--------------|
| Field reference | `structData.category` (full path) | Bare key: `department` |
| Schema | Auto-detected from data | Must define manually with SchemaServiceClient |
| Metadata attachment | Direct in document JSON | Via struct_data on import or JSONL metadata files |
| Filter syntax | Same operators | Same operators |
| Key properties | Some built-in fields filterable | Custom fields need indexable schema |

The filter expression language itself is identical — same grammar, same operators. The difference is in how fields are referenced and how schemas are set up.

---

## 11. Key Properties vs Custom Fields

**Key properties** are built-in system fields. Not all support filtering even when marked indexable.

Key properties that support filtering (by data store type):

**Generic/Custom search**: `category`, `create_time`, `hashtag`, `language_code`, `update_time`, `uri`

**Media search**: `media_available_time`, `media_content_index`, `media_content_rating`, `media_country_of_origin`, `media_duration`, `media_expire_time`, `media_filter_tag`, `media_hash_tags`, `media_in_languages`, `media_live_event_end_time`, `media_live_event_start_time`, `media_production_year`, `media_type`

**Cannot filter on**: `title` (even if marked indexable)

**Custom struct_data fields**: any field you define in the schema with `indexable: true` can be used in filters (up to 50 fields max).

---

## 12. Filter Timing (Pre-filter vs Post-filter)

The docs describe filtering as "restrict your search to a specific set of documents," suggesting **pre-filtering** (documents are excluded before ranking). However, our experiment found a behavioral nuance:

**Query relevance is still required.** Filters narrow the candidate set, but documents must still be semantically matched by the query. A filter alone cannot conjure documents that the query wouldn't surface — it can only remove documents from the results that the query DID surface.

This is practically a pre-filter on the index, combined with relevance scoring. If the query is too narrow to match filtered documents, you get 0 results even though the documents exist and match the filter.

**Workaround**: Use broad/generic queries when you need filter-driven retrieval (our experiments use phrases like "employee handbook policy" that are broadly relevant to the corpus).

---

## 13. Comparison: VAIS Filter Syntax vs GFS Filter Syntax

| Feature | VAIS (Discovery Engine) | GFS (Google File Search) |
|---------|------------------------|--------------------------|
| String equality | `field: ANY("val")` | `key = "value"` |
| String inequality | `NOT field: ANY("val")` | `key != "value"` |
| Numeric comparison | `field >= 2` | `key >= 2` |
| OR | `field: ANY("a") OR field: ANY("b")` | `key = "a" OR key = "b"` |
| AND | `expr1 AND expr2` | `expr1 AND expr2` |
| Multi-value match | `field: ANY("a", "b")` | `key = "a" OR key = "b"` |
| String list membership | **NOT SUPPORTED** | `string_list_value` native |
| Wildcards / substring | **NO** | **NO** |
| Negation | `NOT` / `-` prefix | `!=` operator |
| Schema required | YES (indexable fields) | NO (auto-indexed) |
| Field reference | Bare key name | Bare key name |
| Prefix gotcha | `custom_metadata.key` → silent empty | N/A |
| Range queries | `IN(10i, 100e)` | Not available |
| Geolocation | `GEO_DISTANCE()` | Not available |
| Datetime | ISO 8601 comparisons | Not available |

---

## 14. Known Limitations and Gotchas (Summary)

1. **No `!=` operator** — must use `NOT field: ANY("val")` instead
2. **No substring/wildcard matching** — exact match only via ANY()
3. **No string list membership** — `ANY("bob@co.com")` won't match within `"bob@co.com,carol@co.com"`. Must denormalize.
4. **Wrong field prefix silently fails** — `custom_metadata.field` returns empty, no error
5. **Query relevance required** — filters alone can't retrieve documents; query must be semantically relevant
6. **Schema required before upload** — no schema = no filtering (data stored but not indexed)
7. **Max 50 indexable fields** per data store
8. **`=` fails for struct_data strings** — must use `ANY()` syntax
9. **CHUNKS mode: result.document is None** — extract doc ID from chunk.name path
10. **title key property not filterable** — even when marked indexable
11. **Indexing latency** — ~60-270s before new documents are filterable
12. **Boolean values are quoted strings** — `= "true"` not `= true`

---

## 15. Sources

### Official Documentation
- [Filter search metadata](https://docs.cloud.google.com/generative-ai-app-builder/docs/filter-search-metadata) — main filter reference with EBNF grammar
- [Parse and chunk documents](https://docs.cloud.google.com/generative-ai-app-builder/docs/parse-chunk-documents) — chunking behavior
- [Prepare data](https://docs.cloud.google.com/generative-ai-app-builder/docs/prepare-data) — structData/jsonData metadata format

### Our Verified Experiments
- `python-services/experiments/vertex_ai_search_experiment.py` — 8/8 filter tests (ANY, AND, OR, numeric, UUID, nonexistent)
- `python-services/experiments/vertex_ai_search_mixed_metadata_experiment.py` — 6/6 mixed schema tests
- `python-services/experiments/vais_product_gaps_experiment.py` — negation, lists, boost, chunk limits
- `.claude-data/projects/-workspaces-test-mvp/memory/gfs-metadata.md` — GFS filter comparison

### Previous Research
- `.claude/research/vais-metadata-update/whiteboard.md` — product comparison (note: line 111 incorrectly claims VAIS has "no OR" — OR is verified working)
