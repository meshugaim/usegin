# Phase 1: Heading Preservation Research

## What Is Heading Preservation?

When a large document with hierarchical headings (H1 > H2 > H3) is chunked for search, each chunk normally loses its heading context. A chunk deep in section "3.2.1" becomes just a paragraph with no indication of where it came from.

**`includeAncestorHeadings`** is a Vertex AI Search (Discovery Engine) feature that solves this. When enabled, the chunker prepends the full ancestor heading chain to each chunk's content. A chunk under "Company Overview > Engineering Department > Infrastructure Team" will have all three headings included in its text, so:

1. **Semantic search** finds the chunk more easily (heading terms are part of the indexed content)
2. **LLM context** knows where the chunk sits in the document hierarchy
3. **Source attribution** is richer ("this came from the Infrastructure Team section")

This is the **key differentiator** of VAIS over GFS and Vertex RAG Engine, neither of which preserves heading context in chunks.

## How It Works in the Experiment

**File:** `python-services/experiments/vertex_ai_search_experiment.py`, Phase 7 (lines 1469-1585)

### Setup (Phase 1 of the experiment)

The DataStore is configured with two critical settings:

```python
# Layout parser — improves chunk boundary detection
default_parsing_config=ParsingConfig(
    layout_parsing_config=LayoutParsingConfig()
)

# Layout-based chunking with ancestor heading injection
chunking_config=ChunkingConfig(
    layout_based_chunking_config=LayoutBasedChunkingConfig(
        chunk_size=500,
        include_ancestor_headings=True,  # THE KEY SETTING
    )
)
```

Both are required: the layout parser detects heading structure, and `include_ancestor_headings=True` tells the chunker to prepend them.

### Test Document (doc7: "company-overview-headings")

A markdown document with a 3-level heading hierarchy:

```
# Company Overview              (H1)
  ## Engineering Department     (H2)
    ### Infrastructure Team     (H3) — marker: "Obsidian Telemetry Prism"
    ### Platform Team           (H3) — marker: "Quartz Resonance Fibonacci"
  ## Legal Department           (H2)
    ### Compliance Team         (H3) — marker: "Tungsten Heliograph Meridian"
```

Each H3 section contains a unique marker string for precise verification.

### Phase 7 Test Logic

For each of 3 test cases (Infrastructure, Platform, Compliance):

1. **Query** with semantically relevant text targeting the H3 section (e.g., "cloud deployments Terraform ArgoCD 99.99% uptime")
2. **Search** in CHUNKS mode (no special heading options at query time — headings are baked in at ingestion)
3. **Check marker** — verify the unique marker string appears in top-3 results
4. **Check heading chain** — verify all 3 expected headings (H1, H2, H3) appear in the chunk content
5. **Report coverage** — e.g., "3/3 headings found = FULL ANCESTOR HEADING CHAIN PRESERVED"

### Experiment Results (from findings summary, lines 86-94)

> `includeAncestorHeadings` — **WORKS**. All 3 heading tests pass: markers found, 3/3 ancestor headings present (e.g. Company Overview > Engineering Department > Infrastructure Team). For LARGER documents, the Layout Parser would split at heading boundaries and prepend ancestor headings to each chunk.

Note: The test document was small enough to fit in a single chunk, so headings were trivially present. The real value shows with larger documents where chunks span subsections — each chunk gets its heading chain prepended regardless of where the split occurs.

## Current Production Code State

### VAIS (already has heading preservation configured)

**Config:** `python-services/agent_api/vais/config.py`
```python
CHUNK_SIZE = 500  # tokens
INCLUDE_ANCESTOR_HEADINGS = True  # ALREADY ENABLED
```

**Store creation:** `python-services/agent_api/vais/store_service.py` (line 245-249)
```python
layout_based_chunking_config=LayoutBasedChunkingConfig(
    chunk_size=CHUNK_SIZE,
    include_ancestor_headings=INCLUDE_ANCESTOR_HEADINGS,  # True
)
```

**Search service:** `python-services/agent_api/vais/search_service.py`
- Returns `VaisChunkResult` with `content` (which includes ancestor headings baked into the text), `relevance_score`, `document_id`, `chunk_id`, `source_file`, and `metadata`.
- No special heading extraction at query time — headings are embedded in chunk content at ingestion.
- Supports adjacent chunk context via `num_previous_chunks` / `num_next_chunks`.

**Types:** `python-services/agent_api/vais/types.py`
- `VaisChunkResult` has no dedicated heading field — headings are part of `content`.

### GFS (no heading preservation, never will)

**Multi-store query:** `python-services/agent_api/agent/multi_store_query_service.py`
- Uses `google-genai` SDK with Gemini + FileSearch grounding
- Returns Gemini-generated text, not raw chunks
- No concept of headings, chunks, or document structure
- GFS metadata filtering works but is limited to flat key=value pairs

### VRAG (no heading preservation)

**Search:** `python-services/agent_api/vrag/search_service.py`
- Uses `vertexai.rag.retrieval_query()` for raw chunk retrieval
- Returns `text`, `score`, `source_display_name` — no heading context
- Layout Parser only improves chunk boundaries, does NOT inject headings

## What "Heading Preservation" Means in Practice

When VAIS returns chunks from a document with headings, the `content` field of `VaisChunkResult` looks approximately like:

```
Company Overview > Engineering Department > Infrastructure Team

The infrastructure team manages cloud deployments across AWS, GCP, and Azure.
They maintain 99.99% uptime for production services...
```

The heading chain is **prepended as text** — not structured data. There is no separate `headings` field on the chunk proto. The LLM and search index both see the headings as part of the content.

## What Would Need to Change for Production

### Already Done
- `INCLUDE_ANCESTOR_HEADINGS = True` in config
- Store creation uses the setting
- Search returns chunks with headings baked into content
- DataStores created by the VAIS prototype already have this enabled

### Potential Enhancements (not yet implemented)
1. **Structured heading extraction**: Parse the heading chain out of chunk content into a separate field on `VaisChunkResult` (e.g., `heading_chain: list[str]`). This would let the UI display breadcrumbs like "Company Overview > Engineering > Infrastructure Team" without regex parsing of content.
2. **Heading-aware context presentation**: When presenting chunks to the LLM in chat, format the heading chain as structured context (e.g., "Source: {file_name}, Section: {heading_chain}") rather than relying on the LLM to notice inline headings.
3. **MCP tool integration**: The VAIS search is not yet wired into the MCP tool layer that the chat agent uses (which currently goes through GFS `multi_store_query_service.py`). Integrating VAIS search as an alternative search backend in the MCP tool chain is the main production gap.

## Comparison Table

| Feature | GFS | VRAG | VAIS |
|---|---|---|---|
| Heading preservation | No | No (Layout Parser = boundaries only) | **Yes** (`include_ancestor_headings`) |
| Raw chunk access | No (Gemini grounded) | Yes (`retrieval_query`) | Yes (CHUNKS mode) |
| Metadata filtering | Yes (`metadata_filter`) | Broken | Yes (ANY() syntax) |
| Adjacent chunks | No | No | Yes (`num_previous/next_chunks`) |
| Page span | No | Yes | Yes |
| Setup complexity | Lowest | Medium | Highest |

## Key Files

| File | Purpose |
|---|---|
| `python-services/experiments/vertex_ai_search_experiment.py` | Full VAIS experiment (Phase 7 = headings) |
| `python-services/agent_api/vais/config.py` | VAIS config (`INCLUDE_ANCESTOR_HEADINGS = True`) |
| `python-services/agent_api/vais/store_service.py` | DataStore creation with heading config |
| `python-services/agent_api/vais/search_service.py` | CHUNKS mode search, returns content with headings |
| `python-services/agent_api/vais/types.py` | `VaisChunkResult` model |
| `python-services/agent_api/agent/multi_store_query_service.py` | GFS multi-store (no headings) |
| `python-services/agent_api/vrag/search_service.py` | VRAG search (no headings) |
