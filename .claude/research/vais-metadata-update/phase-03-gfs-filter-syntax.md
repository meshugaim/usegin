# Phase 03: GFS Metadata Filter Syntax — Comprehensive Reference

**Date:** 2026-03-12
**Status:** COMPLETE

## Summary

GFS `metadata_filter` uses a subset of AIP-160 (google.aip.dev/160) filtering syntax. This document consolidates all verified findings from online docs, local experiments, production code, and the AIP-160 spec itself.

---

## 1. AIP-160 Specification (Full Standard)

AIP-160 defines a general-purpose filtering language used across Google APIs. GFS implements a **subset** of it.

### 1.1 AIP-160 Grammar

```
filter     = expression
expression = comparison { logic_op comparison }
comparison = field_name operator value
field_name = IDENT { "." IDENT }       # traversal via dot notation
operator   = "=" | "!=" | "<" | ">" | "<=" | ">="
value      = STRING | NUMBER | BOOL
logic_op   = "AND" | "OR"
```

### 1.2 AIP-160 Operators

| Operator | Category | Description |
|----------|----------|-------------|
| `=` | Comparison | Equals |
| `!=` | Comparison | Not equals |
| `<` | Comparison | Less than |
| `>` | Comparison | Greater than |
| `<=` | Comparison | Less than or equal |
| `>=` | Comparison | Greater than or equal |
| `AND` | Logical | True if both sides are true |
| `OR` | Logical | True if either side is true |
| `NOT` / `-` | Negation | Unary negation (prefix) |
| `:` | HAS | Collection membership / map key existence |

### 1.3 AIP-160 Precedence

**Non-standard:** OR binds tighter than AND, so `a AND b OR c` means `a AND (b OR c)`. This is the opposite of most programming languages.

### 1.4 AIP-160 HAS Operator (`:`)

The `:` (HAS) operator is for **repeated fields** (arrays/lists) and **maps**:

- `r : 42` — true if collection `r` contains value 42
- `r.foo : 42` — true if any element `e` in `r` satisfies `e.foo = 42`
- `m : foo` — true if map `m` contains key "foo"
- `m.foo : *` — true if key "foo" exists in map `m`
- `r : *` — true if field is present (non-empty)

### 1.5 AIP-160 Wildcards

`*` wildcard in string values: `a = "*.foo"` matches strings ending in ".foo".

### 1.6 AIP-160 Functions

Function call syntax `call(arg...)` is allowed for API-specific extensions.

### 1.7 AIP-160 Quoting Rules

- String values: double-quoted (`"value"`)
- Numeric values: bare (`42`, `3.14`, `2.997e9`)
- Boolean values: bare (`true`, `false`)
- Timestamps: RFC-3339 format
- Durations: number + `s` suffix (`20s`, `1.2s`)
- Field names: bare (left side only)

---

## 2. GFS Implementation of AIP-160 (What Actually Works)

GFS implements a **subset** of AIP-160. The following has been empirically verified through experiments and production usage.

### 2.1 Supported Data Types

| GFS Type | Python SDK Type | Description | Verified |
|----------|----------------|-------------|----------|
| `string_value` | `types.CustomMetadata(key=..., string_value=...)` | Single string | Yes (ENG-1458) |
| `numeric_value` | `types.CustomMetadata(key=..., numeric_value=...)` | Integer or float | Yes (ENG-1458) |
| `string_list_value` | `types.CustomMetadata(key=..., string_list_value=types.StringList(values=[...]))` | List of strings | Yes (ENG-1610) |

**No boolean type.** Booleans are encoded as `numeric_value` (1/0).

### 2.2 Supported Operators

| Operator | Type Context | Verified | Source |
|----------|-------------|----------|--------|
| `=` | string, numeric | Yes | `gfs_metadata_filter_experiment.py` scenarios A1-A4, B2 |
| `!=` | string, numeric | Advertised in tool description | Tool definition in `file_search_tool.py` line 198; NOT experimentally verified in an isolated test |
| `>` | numeric | Advertised | Tool description; NOT experimentally verified |
| `<` | numeric | Advertised | Tool description; NOT experimentally verified |
| `>=` | numeric | Yes | `gfs_metadata_filter_experiment.py` scenario B1 |
| `<=` | numeric | Advertised | Tool description; NOT experimentally verified |
| `AND` | compound | Yes | `gfs_metadata_filter_experiment.py` scenarios C1-C3 |
| `OR` | compound | Yes | `gfs_metadata_filter_experiment.py` scenario F1 |
| `:` (HAS) | string_list_value | Yes | `test_gfs_string_list_metadata.py` line 166 |

### 2.3 Verified Working Filter Patterns

All verified via real GFS API calls (google-genai SDK, gemini-2.5-flash):

```python
# Exact string match
metadata_filter='uuid = "abc-123"'

# Exact numeric match
metadata_filter='version = 3'

# Numeric range
metadata_filter='version >= 2'
metadata_filter='date_epoch >= 1706745600 AND date_epoch <= 1706832000'

# Compound AND
metadata_filter='department = "engineering" AND entity_type = "email"'
metadata_filter='department = "engineering" AND version >= 2'
metadata_filter='priority = "high" AND entity_type = "file"'

# OR (multi-value match on same key)
metadata_filter='department = "engineering" OR department = "legal"'

# HAS operator for string_list_value membership
metadata_filter='recipients : "alice@test.com"'

# Non-existent value returns empty (no error)
metadata_filter='uuid = "nonexistent-uuid-00000"'
```

### 2.4 Verified NOT Working

```python
# ANY() syntax — returns 400 INVALID_ARGUMENT
# "rhs must be a value or phrase"
metadata_filter='uuid: ANY("abc", "def")'   # FAILS

# Prefixed key names — returns empty silently (no error)
metadata_filter='custom_metadata.department = "engineering"'   # SILENTLY EMPTY
```

### 2.5 Not Tested / Unknown in GFS

The following AIP-160 features have NOT been empirically verified in GFS:

| Feature | AIP-160 Status | GFS Status |
|---------|---------------|------------|
| `NOT` / `-` negation prefix | Supported | **UNTESTED** |
| `!=` operator | Supported | Advertised in tool but **NOT experimentally verified** |
| Wildcards (`*`) | Supported | **UNTESTED** |
| Parentheses for grouping | Not in AIP-160 | **UNTESTED** |
| Field traversal (`a.b.c`) | Supported | Known broken — `custom_metadata.key` returns empty |
| Timestamps (RFC-3339) | Supported | **UNTESTED** — we use epoch numerics instead |
| Boolean literals | Supported | **UNTESTED** — we use 1/0 numerics |
| Function calls | Extension point | **UNTESTED** |
| `:` on string_value fields | Maps/nested | **UNTESTED** — only verified on string_list_value |
| `>`, `<`, `<=` on numeric | Supported | Advertised but **NOT experimentally verified** (only `>=` and `=` tested) |

### 2.6 String List (`:` HAS) Behavior — Verified Details

From `test_gfs_string_list_metadata.py` (ENG-1610):

1. **Upload:** `types.CustomMetadata(key="recipients", string_list_value=types.StringList(values=["alice@test.com", "bob@test.com"]))`
2. **Round-trip:** `string_list_value.values` persists correctly on the document object
3. **Membership filter:** `recipients : "alice@test.com"` returns the document
4. **Non-matching:** `recipients : "nobody@test.com"` returns empty (no error)
5. **Syntax:** Uses space around `:` — `key : "value"` (consistent with AIP-160)

### 2.7 Mixed Metadata Schemas

From `gfs_mixed_metadata_experiment.py`:

- Documents in the same store can have completely **different metadata key sets**
- Filtering on a key that a document doesn't have silently excludes that document (no error)
- Shared keys work normally across schemas
- Compound filters work across mixed schemas

### 2.8 Key Name Rules

- **Bare key names** only: `department = "engineering"` (correct)
- **No prefix:** `custom_metadata.department = "engineering"` silently returns empty
- Key names are case-sensitive (lowercase convention in our codebase)

---

## 3. VAIS (Vertex AI Search / Discovery Engine) Filter Syntax

VAIS uses a different filter syntax from GFS. Both nominally reference AIP-160 but implement different subsets.

### 3.1 VAIS Filter Operators

| Feature | VAIS Syntax | GFS Syntax |
|---------|------------|------------|
| String equality | `field: ANY("value")` | `field = "value"` |
| Multi-value string match | `field: ANY("v1", "v2")` | `field = "v1" OR field = "v2"` |
| Numeric comparison | `field >= N`, `field <= N` | `field >= N`, `field <= N` |
| Logical AND | `AND` | `AND` |
| Logical OR | `OR` | `OR` |
| String list membership | `field: ANY("value")` (same syntax) | `field : "value"` (HAS operator) |
| Negation | **NOT DOCUMENTED** | `!=` (advertised, untested) |
| Wildcards | **NOT DOCUMENTED** | **UNTESTED** |

### 3.2 VAIS-Specific Requirements

1. **Schema must be defined BEFORE upload** — `SchemaServiceClient.update_schema()` on `default_schema` with `"indexable": true` for each field
2. **Metadata must be present at import time** — `update_document()` post-import stores data but does NOT make it filterable (see phase-01-online-docs.md, phase-07-date-filter-fix.md)
3. **Maximum 50 indexable fields** per DataStore
4. **Query must be semantically relevant** — generic queries return 0 results even with correct filters
5. **Indexing latency:** 22-55s after import (eventual consistency)
6. **`CHUNKS` search mode:** `result.document` is None — must extract doc ID from `chunk.name` path

### 3.3 VAIS Filter Syntax Details

```python
# String equality
filter='field: ANY("value")'

# Multi-value
filter='field: ANY("value1", "value2")'

# Numeric range
filter='field >= 1704067200'
filter='field >= 1704067200 AND field <= 1704153600'

# Compound
filter='project_id: ANY("uuid") AND access_level: ANY("internal")'

# Cross-field OR
filter='entity_type: ANY("email") OR entity_type: ANY("file")'
```

---

## 4. Comparison: GFS vs VAIS Filtering

### 4.1 What GFS Supports That VAIS Doesn't

| Feature | GFS | VAIS |
|---------|-----|------|
| Simple equality syntax (`key = "value"`) | Yes | No — requires `ANY()` |
| `!=` (not equals) | Advertised | Not documented |
| `:` HAS operator for list membership | Yes (verified) | Uses `ANY()` instead |
| No schema pre-registration needed | Correct — schemaless | Requires upfront schema with `indexable: true` |
| Instant metadata availability | Metadata filterable immediately after indexing | 22-55s eventual consistency |
| Metadata update without re-upload | N/A (no update API for metadata) | `update_document()` stores but doesn't index |
| Mixed schemas without declaration | Fully supported | Requires union schema covering all fields |

### 4.2 What VAIS Supports That GFS Doesn't

| Feature | VAIS | GFS |
|---------|------|-----|
| `ANY()` multi-value syntax in one clause | Yes — `field: ANY("v1", "v2")` | No — must use OR: `field = "v1" OR field = "v2"` |
| Heading-aware chunking (`includeAncestorHeadings`) | Yes — preserves H1>H2>H3 chain | No |
| Relevance scores on chunks | Yes (0-1 float) | No (not exposed) |
| Adjacent chunk retrieval (prev/next) | Yes (`num_previous_chunks`, `num_next_chunks`) | No |
| Configurable result count | Yes (1-50) | No (returns what Gemini decides, typically ~5) |
| Raw chunk retrieval without LLM | Yes (`CHUNKS` search mode) | No — always goes through Gemini `generate_content` |
| Document ACLs (`acl_info`) | Yes (requires Google Identity federation) | No |
| Schema validation | Yes — enforced at DataStore level | No — arbitrary key-value pairs |

### 4.3 Shared Capabilities

| Feature | Both Support |
|---------|-------------|
| `AND` compound filters | Yes |
| `OR` compound filters | Yes |
| Numeric range filtering (`>=`, `<=`) | Yes |
| Multiple data types (string, numeric) | Yes |
| Mixed metadata schemas in one store | Yes (VAIS needs union schema) |
| Date filtering via numeric epoch | Yes |
| Filter acts as hard scope (not hint) | Yes |
| Empty result on non-match (no error) | Yes |

---

## 5. Production Code: How Filters Flow Through the System

### 5.1 Tool Description to GFS API

```
User/LLM writes AIP-160 filter string
  --> file_search_tool.py validates via parse_aip160() (catches bad syntax early)
  --> multi_store_query_service.py combines with auto-injected entity_type filter
  --> Passed as metadata_filter to types.FileSearch(metadata_filter=...)
  --> google-genai SDK sends to Gemini API
  --> GFS applies filter server-side before semantic search
```

### 5.2 Auto-Injected Filters

`MultiStoreQueryService` auto-injects `entity_type` filters for email stores because they hold both emails and attachments:

| Tool entity_type | Auto-injected filter |
|-----------------|---------------------|
| `"email"` | `entity_type = "email"` |
| `"email_attachment"` | `entity_type = "attachment"` |
| `"file"` | (none — file stores are unambiguous) |
| `["email", "email_attachment"]` | `entity_type = "email" OR entity_type = "attachment"` |

User filter is combined with AND: `{injection} AND ({user_filter})`

### 5.3 Metadata Keys in Production

**email** (14 keys): `entity_type`, `email_id`, `sender`, `sender_domain`, `date_epoch`, `thread_id`, `recipients` (string_list), `recipient_domains` (string_list), `cc_addresses` (string_list), `subject`, `has_attachments` (numeric 1/0), `attachment_count`, `access_level`, `is_reply` (numeric 1/0)

**email_attachment** (19 keys): All 14 email keys inherited from parent email + `attachment_id`, `filename`, `file_extension`, `mime_type`, `size_bytes`

**file** (8 keys): `entity_type`, `file_id`, `filename`, `file_extension`, `mime_type`, `access_level`, `date_epoch`, `size_bytes`

### 5.4 AIP-160 Parser (`aip160_parser.py`)

The codebase has a full AIP-160 parser that handles:
- Tokenization: KEY, OP, STRING, NUMBER, LOGIC, WS
- Parsing: `KEY OP VALUE { LOGIC KEY OP VALUE }`
- Application: Translates to Supabase PostgREST query builder calls
- Boolean coercion: `has_attachments = 1` -> `has_attachments = true`
- Array containment: `recipients = "bob@co.com"` -> `.contains("recipients", ["bob@co.com"])`
- Mixed AND/OR: Groups AND-connected clauses, combines with `.or_()`

**Not in the parser:** `:` (HAS) operator, `NOT` prefix, parentheses, wildcards, field traversal. These are not needed because the parser translates to Supabase SQL, which has its own containment/negation syntax. The `:` operator is only used in raw GFS filter strings (not in the VRAG/Supabase path).

---

## 6. Confidence Assessment

| Claim | Confidence | Evidence |
|-------|-----------|---------|
| `=` works for strings | **PROVEN** | 4 experiment scenarios (A1-A4) |
| `=` works for numerics | **PROVEN** | Experiment scenario B2 |
| `>=` works for numerics | **PROVEN** | Experiment scenario B1 |
| `AND` compound filters | **PROVEN** | 3 experiment scenarios (C1-C3) |
| `OR` compound filters | **PROVEN** | Experiment scenario F1 |
| `:` HAS for string_list membership | **PROVEN** | Integration test (ENG-1610) |
| `ANY()` does NOT work | **PROVEN** | Experiment returns 400 INVALID_ARGUMENT |
| Bare key names required | **PROVEN** | Prefixed keys return empty silently |
| Mixed metadata schemas | **PROVEN** | 6 scenarios in mixed experiment |
| `!=` works | **ADVERTISED** | In tool description but not experimentally verified |
| `>`, `<`, `<=` work | **ADVERTISED** | In tool description but not experimentally verified |
| `NOT` / `-` negation works | **UNKNOWN** | Never tested |
| Parentheses for grouping | **UNKNOWN** | Never tested |
| Wildcards in values | **UNKNOWN** | Never tested |
| `:` on string_value fields | **UNKNOWN** | Only tested on string_list_value |

---

## Sources

- **AIP-160 specification:** https://google.aip.dev/160
- **Gemini File Search docs:** https://ai.google.dev/gemini-api/docs/file-search
- **Experiment code:** `/workspaces/test-mvp/python-services/experiments/gfs_metadata_filter_experiment.py`
- **Mixed metadata experiment:** `/workspaces/test-mvp/python-services/experiments/gfs_mixed_metadata_experiment.py`
- **String list test:** `/workspaces/test-mvp/python-services/tests/integration/gemini/test_gfs_string_list_metadata.py`
- **Metadata builder:** `/workspaces/test-mvp/python-services/agent_api/gfs_metadata.py`
- **Tool definition:** `/workspaces/test-mvp/python-services/agent_api/agent/file_search_tool.py`
- **Multi-store service:** `/workspaces/test-mvp/python-services/agent_api/agent/multi_store_query_service.py`
- **AIP-160 parser:** `/workspaces/test-mvp/python-services/agent_api/vrag/aip160_parser.py`
- **Filter comparison:** `/workspaces/test-mvp/.claude/research/vais-prototype/filter-comparison.md`
- **Filter design:** `/workspaces/test-mvp/.claude/research/vrag-prototype/phase-09-design-filters.md`
- **Filter research:** `/workspaces/test-mvp/.claude/research/vrag-prototype/phase-09-research-filters.md`
- **GFS findings:** `/workspaces/test-mvp/python-services/experiments/GFS_FINDINGS.md`
- **VAIS metadata update phase 01:** `/workspaces/test-mvp/.claude/research/vais-metadata-update/phase-01-online-docs.md`
- **VAIS date filter fix:** `/workspaces/test-mvp/.claude/research/vais-prototype/phase-07-date-filter-fix.md`
