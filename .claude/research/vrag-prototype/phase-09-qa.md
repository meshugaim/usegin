# Phase 09 QA: VRAG AIP-160 Filter System

**Date:** 2026-02-26
**Verdict: PASS**

---

## Code Review

### 1. Parser (`aip160_parser.py`) — PASS

- Tokenizer handles: quoted strings, all 6 comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`), AND/OR (case-insensitive), numeric (int/float/negative), identifiers.
- Parser enforces strict `KEY OP VALUE (LOGIC KEY OP VALUE)*` grammar.
- Errors: `AIP160ParseError` (syntax) and `AIP160FilterError` (semantic) are distinct, both include position info.
- Edge cases covered: empty string, whitespace-only, trailing junk, dangling logic operator, `==` (rejected), number-as-key (rejected).
- `apply_filters` has two paths: AND-only (chained Supabase methods) and mixed AND/OR (PostgREST `.or_()` string). AND/OR grouping logic is correct — consecutive AND comparisons are wrapped in `and()` blocks, separated by OR at the top level.
- Boolean coercion accepts `1/0/true/false` (string and numeric), rejects everything else.
- Array columns (`text_array`) use `.contains()` for `=` and `.not_.contains()` for `!=`, reject range operators.
- Operator validation blocks range ops on text/boolean/uuid/text_array columns.

### 2. Filter Keys (`FILTER_KEYS` dict in `aip160_parser.py`) — PASS

- **21 keys present** (verified programmatically). All 5 column types represented: text (9), numeric (3), boolean (2), text_array (3), uuid (4).
- `email_id` polymorphic mapping correct: `{"email": "id", "email_attachment": "parent_email_id"}`. Requires `entity_type` to resolve; errors clearly if missing or wrong.
- Entity-type scoping is correct per the design doc: universal keys (entity_type, access_level, date_epoch) cover all 3 types; file keys exclude email; email keys include email_attachment; attachment_id and parent_email_id are email_attachment-only.

### 3. Search Service (`search_service.py`) — PASS

- Parser + builder integrated correctly at lines 87-91.
- `parse_aip160(filter)` → `apply_filters(q, expression, entity_type=entity_type)` — entity_type is threaded through from the request.
- Both `AIP160ParseError` and `AIP160FilterError` are caught and returned as `error` in the response (not raised as 500s).
- Filter is applied after project_id, deleted_at, rag_file_id null checks, and before the Vertex RAG call. Correct ordering.

### 4. Routes / Upload (`routes.py`) — PASS

- Upload endpoint accepts 12 optional metadata Form fields: `mime_type`, `date_epoch`, `sender`, `subject`, `thread_id`, `recipients`, `cc_addresses`, `has_attachments`, `attachment_count`, `is_reply`, `parent_email_id`, plus derives `file_extension`, `sender_domain`, `recipient_domains`, `size_bytes` automatically.
- Derived fields: `file_extension` from filename, `sender_domain` from `@`-split, `recipient_domains` from addresses, `size_bytes` from content length. All correct.
- Comma-separated array parsing for recipients/cc_addresses is correct (split + strip + filter empty).
- `VragSearchRequest` model has `filter: str | None = Field(None, ...)` with AIP-160 syntax description.

### 5. UI (`rag-search-panel.tsx`) — PASS

- Filter input field with placeholder example (`sender = "alice@co.com" AND date_epoch >= 1704067200`).
- Collapsible "Filter syntax help" section documents operators, file keys, email keys, and 4 examples.
- Filter passed as `filter: filter.trim() || undefined` — empty string becomes no filter. Correct.
- Error display renders `result.error` in a red box when present.

### 6. Migration (`20260226181056_vrag_filter_columns.sql`) — PASS

- 15 new columns added to `vrag_prototype.files`: `file_extension` (TEXT), `mime_type` (TEXT), `size_bytes` (BIGINT), `date_epoch` (DOUBLE PRECISION), `sender` (TEXT), `sender_domain` (TEXT), `thread_id` (TEXT), `recipients` (TEXT[]), `recipient_domains` (TEXT[]), `cc_addresses` (TEXT[]), `subject` (TEXT), `has_attachments` (BOOLEAN), `attachment_count` (INTEGER), `is_reply` (BOOLEAN), `parent_email_id` (UUID).
- All nullable — correct for entity-type-specific fields.
- 5 partial indexes on high-cardinality filter columns (sender, date_epoch, mime_type, file_extension, parent_email_id), all with `WHERE deleted_at IS NULL AND col IS NOT NULL`. Good index design.
- Column types match filter key types: TEXT → text, BIGINT/DOUBLE PRECISION/INTEGER → numeric, BOOLEAN → boolean, TEXT[] → text_array, UUID → uuid.

---

## Runtime Tests

### Unit Tests — 57/57 PASS

- `test_aip160_parser.py` (22 tests): All parsing happy/error paths pass.
- `test_apply_filters.py` (35 tests): Boolean coercion, column resolution, entity validation, operator validation, method mapping, OR path, empty expression — all pass.
- Full suite: 1333 passed, 3 skipped (none related to VRAG).

### API Runtime Tests — 7/7 PASS

| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | `filename = "semantic"` | Parse OK, no chunks | `success:true, error:null` |
| 2 | `invalid_key = "x"` | Error: unknown key | `error: "Unknown filter key: 'invalid_key'"` |
| 3 | `filename = "semantic" AND entity_type = "file"` | Compound AND parse OK | `success:true, error:null` |
| 4 | `sender = "alice" OR sender = "bob"` | OR parse OK | `success:true, error:null` |
| 5 | `sender "alice"` (syntax error) | Parse error with position | `error: "...Expected operator...at position 7"` |
| 6 | `sender > "alice"` (range on text) | Semantic error | `error: "Range operator '>'...Use = or !="` |
| 7 | No filter (null) | Bypass filter, reach Vertex | Reaches Vertex (GCP auth error = expected in test env) |

---

## Isolation Check — PASS

- `aip160_parser.py` imports only: `re`, `dataclasses`, `typing` (stdlib). Zero external dependencies. Zero GFS imports.
- `search_service.py` imports from `agent_api.vrag.aip160_parser` and `agent_api.logging_utils` only. No GFS modules.
- All VRAG code is within `agent_api/vrag/`. No cross-contamination with production GFS modules (`agent_api/services/`, `agent_api/google_file_search/`).
- Tests import only from `agent_api.vrag.aip160_parser`. Mock-based, no DB or GCP dependencies.

---

## Minor Observations (Non-Blocking)

1. **`filter_keys.py` does not exist as a separate file** — the FILTER_KEYS dict is defined inline in `aip160_parser.py`. This is fine for the prototype scope; extraction can happen if the registry grows.
2. **No parenthesized grouping** — `(A OR B) AND C` is not supported. The parser handles flat `A AND B OR C` with implicit AND-binding. Documented limitation, acceptable for prototype.
3. **`boolean_as_string`** — `has_attachments = "true"` parses as string `"true"` at the parser level, then `_coerce_boolean` handles it at the apply level. Works correctly but is a two-hop coercion.

---

## Verdict: **PASS**

All 21 filter keys present and correctly typed. Parser handles all AIP-160 cases (equality, range, AND, OR, mixed). Supabase query builder integration is correct for both AND-only and OR paths. Upload accepts metadata. UI exposes filter with help text. Migration columns match filter key definitions. 57/57 unit tests pass. 7/7 runtime API tests pass. Full isolation from production GFS modules confirmed.
