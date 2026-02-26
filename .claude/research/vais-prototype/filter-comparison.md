# VAIS Prototype vs Production `semantic_search` — Filter Comparison

**Date:** 2026-02-26
**Files compared:**
- Production tool: `python-services/agent_api/agent/file_search_tool.py` (semantic_search tool definition)
- Production backend: `python-services/agent_api/agent/multi_store_query_service.py` (query execution)
- VAIS search API: `python-services/agent_api/api/vais.py` (REST endpoint)
- VAIS search service: `python-services/agent_api/vais/search_service.py` (search execution)
- VAIS types: `python-services/agent_api/vais/types.py` (VaisSearchRequest)
- VAIS UI: `nextjs-app/app/admin/vais/search/vais-search-playground.tsx`

---

## Parameter Comparison

| Parameter | Production `semantic_search` | VAIS Prototype | Status | Notes |
|---|---|---|---|---|
| `query` | Required. Natural language search query. | Required (`VaisSearchRequest.query`, min 1 / max 1000 chars). | **Supported** | Both require semantically meaningful queries. VAIS adds length validation. |
| `entity_type` | Optional. `"file"`, `"email"`, `"email_attachment"`, or a list of those. Omit = all types. | Optional (`VaisSearchRequest.entity_type`). Same values: `"file"`, `"email"`, `"email_attachment"`, or list. | **Supported** | UI only exposes single-select (dropdown), not multi-select list. API accepts lists. |
| `filter` | Optional. AIP-160 syntax metadata filter. Operators: `=`, `!=`, `<`, `>`, `<=`, `>=`, `AND`, `OR`. Rich set of per-entity-type keys (see below). | Optional (`VaisSearchRequest.filter`). Free-text, passed as `user_filter` to `build_access_filter()`. Uses VAIS `ANY()` syntax, not AIP-160 `=`. | **Partial** | Different filter syntax (see "Filter Syntax Gap" below). Different available keys. |
| `num_results` | Not exposed. Hardcoded to top-5 source chunks in response formatting. | Optional (`VaisSearchRequest.num_results`), 1-50, default 10. | **VAIS exceeds production** | VAIS is more flexible. Production returns whatever GFS/Gemini grounding provides (typically ~5). |
| `access_level` | Not a separate parameter. Must be expressed inside `filter` (e.g., `access_level = "internal"`). | First-class parameter (`VaisSearchRequest.access_level`). `"internal"` or `"external"`. Auto-injected into filter. | **VAIS exceeds production** | VAIS promotes access_level to a structured parameter instead of requiring raw filter syntax. |
| `project_id` | Implicit. The MCP server is instantiated per-project with pre-bound store IDs. Agent never passes project_id. | Path parameter in REST URL (`/projects/{project_id}/search`). Auto-injected as `project_id: ANY("{project_id}")` filter. | **Equivalent** | Both scope to project. Production does it via pre-bound stores; VAIS does it via metadata filter. |

---

## Filter Syntax Gap (Most Significant Difference)

### Production (GFS via Gemini FileSearch)
- **Syntax:** AIP-160 — `key = "value"`, `key != "value"`, `key >= 123`, `AND`, `OR`
- **Operators:** `=`, `!=`, `<`, `>`, `<=`, `>=`
- **Combinators:** `AND`, `OR`
- **String quoting:** Double-quoted values

### VAIS Prototype (Discovery Engine SearchRequest)
- **Syntax:** VAIS/Discovery Engine — `key: ANY("value1", "value2")`, numeric comparisons use `>=`, `<=`
- **Operators:** `ANY()` for string matching; standard numeric comparisons
- **Combinators:** `AND`, `OR`
- **String quoting:** Double-quoted values inside `ANY()`

### Impact
The `semantic_search` tool's description teaches the LLM AIP-160 syntax (`sender = "alice@company.com"`). If VAIS replaces GFS, either:
1. The tool description must change to teach `ANY()` syntax, **or**
2. A translation layer converts AIP-160 expressions to VAIS `ANY()` syntax at query time.

---

## Filter Keys Gap

### Production `semantic_search` — Available Keys by Entity Type

**email:** `entity_type`, `email_id`, `sender`, `sender_domain`, `date_epoch`, `thread_id`, `recipients`, `recipient_domains`, `cc_addresses`, `subject`, `has_attachments`, `attachment_count`, `access_level`, `is_reply`

**email_attachment:** `entity_type`, `attachment_id`, `filename`, `file_extension`, `mime_type`, `size_bytes`, `email_id`, `sender`, `sender_domain`, `date_epoch`, `thread_id`, `recipients`, `recipient_domains`, `cc_addresses`, `subject`, `has_attachments`, `attachment_count`, `access_level`, `is_reply`

**file:** `entity_type`, `file_id`, `filename`, `file_extension`, `mime_type`, `access_level`, `date_epoch`, `size_bytes`

### VAIS Prototype — Available Metadata Keys

Only what is set during document upload in `vais.py`:
- `project_id`
- `access_level`
- `entity_type`
- `file_id` (= document UUID)
- `file_name`
- `file_type`

### Missing in VAIS
- All email-specific keys: `email_id`, `sender`, `sender_domain`, `date_epoch`, `thread_id`, `recipients`, `recipient_domains`, `cc_addresses`, `subject`, `has_attachments`, `attachment_count`, `is_reply`
- File-specific keys: `file_extension`, `mime_type`, `size_bytes`, `filename` (VAIS has `file_name` not `filename`)
- Attachment-specific keys: `attachment_id`

---

## Store Architecture Difference

### Production (GFS)
- Multiple stores per project: separate stores for internal files, external files, internal email, external email, drive files
- `entity_type` parameter routes to the correct subset of stores (`MultiStoreQueryService._select_store_ids`)
- `access_level` is implicit in the store (internal vs external store)
- Entity-type filter injection: email stores hold both emails and attachments, so `entity_type = "email"` or `entity_type = "attachment"` is auto-injected

### VAIS Prototype
- Single DataStore + Engine per project (all entity types and access levels in one store)
- Filtering done entirely via VAIS metadata filters (`project_id`, `access_level`, `entity_type` as `ANY()` clauses)
- No store-level routing needed

### Impact
VAIS's single-store model is simpler (one engine, one search call) but puts more load on the metadata filtering system. Production's multi-store model uses store selection as a coarse first filter, then metadata for fine-grained filtering within a store.

---

## Response Format Difference

### Production
- Returns a **synthesized answer** (Gemini generates a natural-language response grounded in the chunks)
- Plus up to 5 **source citations** (title + text preview from grounding chunks)
- Response is a single text blob formatted for the LLM agent

### VAIS Prototype
- Returns **raw chunks** with content, relevance_score, document_id, chunk_id, source_file, metadata
- No synthesized answer — the caller (UI or future MCP tool) gets raw retrieval results
- Includes `relevance_score` (0-1) which production does not expose

### Impact
To use VAIS as a drop-in replacement for `semantic_search`, a synthesis step would need to be added (e.g., pass retrieved chunks to an LLM for answer generation). Alternatively, the raw-chunk approach could be used directly if the consuming agent can handle it.

---

## Context Window (Adjacent Chunks)

### Production
No adjacent chunk retrieval. GFS returns only the matched grounding chunks.

### VAIS Prototype
`search_service.py` accepts `num_previous_chunks` (default 1) and `num_next_chunks` (default 1) for surrounding context. However, the API endpoint does **not** expose these parameters — they use the defaults.

---

## UI Coverage

The search playground (`vais-search-playground.tsx`) exposes:
- **query** - text input
- **entity_type** - dropdown (single-select only: All / File / Email / Email Attachment)
- **access_level** - dropdown (All / Internal / External)
- **num_results** - number input (1-50)
- **filter** - free-text input for raw VAIS filter expressions

All parameters from `VaisSearchRequest` are represented in the UI.

---

## Summary of Gaps

1. **Filter syntax mismatch** — Production uses AIP-160 (`=`), VAIS uses `ANY()`. Needs translation layer or tool description change.
2. **Missing metadata keys** — VAIS only has 6 keys vs production's 14+ (email) / 8 (file). Email metadata is entirely absent.
3. **No synthesized answer** — VAIS returns raw chunks; production returns LLM-generated answers with citations.
4. **Multi-select entity_type in UI** — API supports lists but UI is single-select only.
5. **Adjacent chunk context not exposed** — `num_previous_chunks`/`num_next_chunks` hardcoded to defaults in the API layer.
