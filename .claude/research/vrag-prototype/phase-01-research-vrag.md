# Phase 01: Vertex RAG Engine SDK Surface & Existing Experiments

**Date:** 2026-02-26
**Purpose:** Map the `vertexai.rag` SDK surface from existing experiments and reliability research to inform the VRAG prototype (ENG-2098).

---

## 1. Existing Experiments Inventory

### Experiment A: `vertex_rag_experiment.py` (ENG-1475)

**Location:** `/workspaces/test-mvp/python-services/experiments/vertex_rag_experiment.py`
**Status:** Verified 2026-02-08 on `google-cloud-aiplatform==1.136.0`, us-west1.

Comprehensive 10-phase evaluation of Vertex RAG Engine vs GFS. Covers corpus CRUD, file upload, raw chunk retrieval, metadata filtering, Gemini integration, reranking, hybrid search, file deletion, and latency benchmarks.

**SDK calls used:**
- `vertexai.init(project=..., location=...)`
- `rag.create_corpus(display_name=...)`
- `rag.list_corpora()`
- `rag.get_corpus(name=...)`
- `rag.upload_file(corpus_name=..., path=..., display_name=..., description=...)`
- `rag.list_files(corpus_name=...)`
- `rag.retrieval_query(rag_resources=..., text=..., rag_retrieval_config=...)`
- `rag.delete_file(name=...)`
- `rag.delete_corpus(name=...)` (in cleanup)
- `rag.RagResource(rag_corpus=..., rag_file_ids=[...])`
- `rag.RagRetrievalConfig(top_k=..., filter=..., ranking=...)`
- `rag.Filter(metadata_filter=...)`
- `rag.Ranking(llm_ranker=..., rank_service=...)`
- `rag.LlmRanker(model_name=...)`
- `rag.RankService(model_name=...)`
- `rag.Retrieval(source=rag.VertexRagStore(...))`
- `Tool.from_retrieval(retrieval=...)` (Gemini integration)

### Experiment B: `vertex_reliability_file_id_filtering.py` (ENG-2060)

**Location:** `/workspaces/test-mvp/python-services/experiments/vertex_reliability_file_id_filtering.py`
**Status:** Verified 2026-02-25.

Tests `rag_file_ids` filtering for scoped queries. Four tests: basic filtering, exclusion verification, scale limits, performance impact.

**SDK calls used:**
- `rag.retrieval_query(...)` with `RagResource(rag_corpus=..., rag_file_ids=[...])`
- `rag.upload_file(corpus_name=..., path=..., display_name=...)`
- `rag.get_file(name=...)`
- `rag.delete_file(name=...)`
- `rag.list_files(corpus_name=...)`

---

## 2. ENG-2060 Reliability Research Findings

**Location:** `/workspaces/test-mvp/.claude/research/vertex-rag-reliability/`
**Scope:** Does Vertex RAG Engine share GFS's 5 reliability failure modes?

### Final Verdicts

| Question | GFS | Vertex RAG | Verdict |
|----------|-----|-----------|---------|
| Q1: Concurrency | Silent infinite hangs | Queue, all complete (40/40) | GOOD |
| Q2: Text volume | 20-60% failure at 3-6M | 0% failure at 6M (.txt + .pdf, 24/24) | STRONG |
| Q3: Operation status | `done` never transitions | Fast exceptions with clear messages (4/4 adversarial) | GOOD |
| Q4: Extraction visibility | Total black box | Partial (100 chunks max via retrieval_query) | PARTIAL |
| Q5: Format support | .docx hangs, PDF import 0/48 | .txt/.pdf/.docx/.pptx work, .xlsx rejected clearly | GOOD |

### Verified Workaround: Supabase Pre-Filter + rag_file_ids

Since Vertex RAG metadata filtering is broken (proto-level vaporware, never shipped), the verified pattern is:

```
1. Supabase: SELECT rag_file_id FROM project_files WHERE entity_type='email' AND project_id=?
2. Vertex RAG: retrieval_query(query, rag_file_ids=[...ids from step 1...])
```

**rag_file_ids experiment results (Phase 6):**
- Filtering works correctly -- zero leakage across all tests
- Exclusion proven at text level (marker content in File A never returned when scoped to File B)
- No ID limit found up to 1000 IDs
- No performance penalty (scoped queries as fast or faster than unscoped)
- Invalid/deleted IDs silently ignored (no errors, 0 results for those IDs)
- Duplicate IDs deduplicated automatically

**Critical gotcha:** Must pass **bare numeric file ID** (e.g., `5641426399407997742`), NOT the full resource path. Full paths produce `InvalidArgument('Incorrect rag file id format ...')`. Extract with `resource_name.split("/")[-1]`.

---

## 3. SDK Surface Map

### Import Paths

```python
import vertexai
from vertexai import rag

# For Gemini integration (deprecated June 2025, removal June 2026):
from vertexai.generative_models import GenerativeModel, Tool

# Low-level API (for file status monitoring):
from google.cloud.aiplatform_v1beta1 import VertexRagDataServiceClient
from google.cloud.aiplatform_v1beta1 import VertexRagServiceClient
```

### `vertexai.init()`

```python
vertexai.init(project="effi-vertex-experiment", location="us-west1")
```
- Must be called before any `rag.*` operations.
- Reads from `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` env vars typically.

### `rag.create_corpus()`

```python
corpus = rag.create_corpus(display_name="my-corpus-name")
```

- **Params:** `display_name` (str, required). Optional: `description`, `embedding_model_config`, `vector_db` (for Pinecone/Weaviate).
- **Return:** `RagCorpus` object with `.name` (resource path: `projects/P/locations/L/ragCorpora/ID`), `.display_name`.
- **Timing:** ~15 seconds.
- **Default config:** Uses `text-embedding-005` embedding model, `RagManagedDb` (KNN/Spanner) backend.

### `rag.get_corpus()`

```python
corpus = rag.get_corpus(name="projects/P/locations/L/ragCorpora/ID")
```
- **Params:** `name` (str, full resource path).
- **Return:** `RagCorpus`.

### `rag.list_corpora()`

```python
corpora = list(rag.list_corpora())
```
- **Return:** Iterator of `RagCorpus` objects.

### `rag.delete_corpus()`

```python
rag.delete_corpus(name="projects/P/locations/L/ragCorpora/ID")
```
- **Params:** `name` (str, full resource path).
- Used in experiment cleanup phases. Works without force flag.

### `rag.upload_file()`

```python
response = rag.upload_file(
    corpus_name="projects/P/locations/L/ragCorpora/ID",
    path="/path/to/local/file.txt",
    display_name="my-file-name",
    description="optional description",
)
```

- **Params:**
  - `corpus_name` (str, required) -- full corpus resource path
  - `path` (str, required) -- local file path
  - `display_name` (str, optional) -- human-readable name
  - `description` (str, optional)
  - Does NOT accept `custom_metadata` (broken, never shipped)
- **Return:** `RagFile` with `.name` (resource path: `projects/P/locations/L/ragCorpora/C/ragFiles/FILE_ID`), `.display_name`, `.description`.
- **rag_file_id extraction:** `response.name.split("/")[-1]` gives the bare numeric ID.
- **Timing:** ~5-9s for small files, scales linearly (~9 bytes/ms). 6M chars = ~55s.
- **Behavior:** Synchronous and blocking. Waits for full upload + chunking + embedding. Success = file is ACTIVE. Failure = raises `RuntimeError` with gRPC `INVALID_ARGUMENT` (code 3) and descriptive message.
- **Supported formats:** .txt, .pdf, .docx, .pptx. NOT .xlsx, .mp4, unknown extensions.
- **No deduplication:** Same file uploaded N times creates N separate entries.
- **SDK design flaw:** High-level SDK strips `file_status`, `size_bytes`, `create_time`, `rag_file_type` from response. Use low-level `VertexRagDataServiceClient.get_rag_file()` for those fields.

### `rag.get_file()`

```python
f = rag.get_file(name="projects/P/locations/L/ragCorpora/C/ragFiles/FILE_ID")
```
- **Return:** `RagFile` (same stripped dataclass: `.name`, `.display_name`, `.description` only).
- **Limitation:** `.state` always returns `UNKNOWN`/`STATE_UNSPECIFIED` because the high-level SDK doesn't expose the file state enum.

### `rag.list_files()`

```python
files = list(rag.list_files(corpus_name="projects/P/locations/L/ragCorpora/ID"))
```
- **Return:** Iterator of `RagFile` objects.

### `rag.delete_file()`

```python
rag.delete_file(name="projects/P/locations/L/ragCorpora/C/ragFiles/FILE_ID")
```
- **Params:** `name` (str, full resource path).
- Works without force flag (unlike GFS which requires `DeleteDocumentConfig(force=True)`).
- Failed/adversarial uploads don't create zombie files (no cleanup needed).

### `rag.retrieval_query()`

```python
response = rag.retrieval_query(
    rag_resources=[
        rag.RagResource(
            rag_corpus="projects/P/locations/L/ragCorpora/ID",
            rag_file_ids=["5641438470694175467", "5641440341255965279"],  # optional scoping
        )
    ],
    text="What are the key findings?",
    rag_retrieval_config=rag.RagRetrievalConfig(
        top_k=10,           # max 100, default 10
        filter=rag.Filter(metadata_filter='key = "value"'),  # BROKEN (no data indexed)
        ranking=rag.Ranking(
            llm_ranker=rag.LlmRanker(model_name="gemini-2.5-flash"),
            # OR: rank_service=rag.RankService(model_name="semantic-ranker-512@latest"),
        ),
    ),
)
```

- **Params:**
  - `rag_resources` (list of `RagResource`) -- each specifies a corpus and optionally `rag_file_ids` for scoping
  - `text` (str) -- the query
  - `rag_retrieval_config` (`RagRetrievalConfig`) -- controls `top_k`, `filter`, `ranking`
- **rag_file_ids:** List of **bare numeric file IDs** (NOT full resource paths). Scopes search to only those files.
- **top_k:** Max 100. `top_k=101` raises `InvalidArgument('Exceeded the maximum number of contexts to retrieve.')`.
- **Response shape:**
  ```python
  response.contexts.contexts  # list of chunk objects
  ```
  Each chunk has:
  - `.text` (str) -- full chunk text (~4,800 chars default)
  - `.score` (float) -- semantic similarity score (0.0-1.0)
  - `.source_uri` (str) -- set to file's `display_name` (NOT a resource path)
  - `.source_display_name` (str) -- same as `source_uri`
  - `.chunk.text` (str) -- redundant, same as top-level `.text`
  - `.chunk.page_span` -- `first_page`/`last_page` (empty for .txt, populated for PDFs)
  - **NOT available:** chunk index, byte offset, chunk ID, creation time, embedding vector, section/heading context
- **Latency:** ~1.0-1.8s per query (no significant impact from rag_file_ids count).
- **Metadata filter:** The `Filter(metadata_filter=...)` syntax is validated (CEL expressions) but always returns 0 results because the write path never indexes metadata. Broken on both `upload_file()` and `import_files()` paths. Confirmed broken on SDK 1.139.0.

### Reranking

Two reranking options, both verified working:

```python
# Option 1: LLM-based reranking
rag.Ranking(llm_ranker=rag.LlmRanker(model_name="gemini-2.5-flash"))

# Option 2: Semantic reranking
rag.Ranking(rank_service=rag.RankService(model_name="semantic-ranker-512@latest"))
```

Not available in GFS. Both produce different orderings than default.

### Gemini Integration (for reference, not needed for raw chunk retrieval)

```python
from vertexai.generative_models import GenerativeModel, Tool

rag_tool = Tool.from_retrieval(
    retrieval=rag.Retrieval(
        source=rag.VertexRagStore(
            rag_resources=[rag.RagResource(rag_corpus=corpus_name)],
            rag_retrieval_config=rag.RagRetrievalConfig(top_k=5),
        ),
    )
)
model = GenerativeModel(model_name="gemini-2.5-flash", tools=[rag_tool])
response = model.generate_content("query")
```

---

## 4. GCP Auth Setup

### Required Configuration

```bash
# Environment variables
export GOOGLE_CLOUD_PROJECT=effi-vertex-experiment
export GOOGLE_CLOUD_LOCATION=us-west1

# ADC (Application Default Credentials)
gcloud auth login --no-launch-browser
gcloud auth application-default login --no-launch-browser
gcloud config set project effi-vertex-experiment
gcloud auth application-default set-quota-project effi-vertex-experiment

# Enable APIs (one-time)
gcloud services enable aiplatform.googleapis.com --project=effi-vertex-experiment
```

### Key Details

- **Auth method:** GCP IAM via Application Default Credentials (ADC). NOT an API key (that's GFS only).
- **ADC location:** `~/.config/gcloud/application_default_credentials.json`
- **ADC does NOT persist across container rebuilds.** Must re-extract from gcloud user session (`credentials.db`) after rebuild. The gcloud user auth does persist.
- **Project:** `effi-vertex-experiment` (project number: `768786717495`)
- **Region:** `us-west1`. Avoid `us-central1` and `us-east4` (restricted to allowlisted projects).
- **Python SDK requirement:** Must use `uv run python3` (google-auth is only in the uv venv, not system Python).

---

## 5. Python Dependencies

From `/workspaces/test-mvp/python-services/pyproject.toml`:

```toml
"google-genai>=1.62.0",              # GFS SDK (google-genai, Gemini API key auth)
"google-cloud-aiplatform>=1.136.0",  # Vertex RAG SDK (vertexai.rag, GCP IAM auth)
"google-cloud-discoveryengine>=0.16.0",  # Vertex AI Search SDK (VAIS, separate product)
```

The VRAG prototype needs `google-cloud-aiplatform>=1.136.0` which is already a production dependency. No new packages needed.

The `vertexai` module is part of `google-cloud-aiplatform`. Import path: `from vertexai import rag`.

---

## 6. Key Gotchas & Limitations

1. **Metadata filtering is broken.** Proto definitions exist but write path never indexes metadata. Confirmed broken on SDK 1.139.0 (Feb 2026). Workaround: Supabase pre-filter + `rag_file_ids`.

2. **rag_file_ids require bare numeric IDs.** `resource_name.split("/")[-1]` -- NOT the full resource path. Full paths produce `InvalidArgument`.

3. **High-level SDK strips critical fields.** `rag.get_file()` returns only `.name`, `.display_name`, `.description`. No `file_status`, `size_bytes`, `create_time`. Use `VertexRagDataServiceClient.get_rag_file()` for monitoring.

4. **top_k max is 100.** Hard limit across both high-level and low-level APIs. No chunk listing API exists. Files under ~480K chars (<100 chunks) are fully enumerable via `retrieval_query()`.

5. **source_uri = display_name.** Chunk `source_uri` is the file's `display_name` string, NOT a resource path. Must maintain a `display_name -> rag_file_resource_name` mapping.

6. **No heading-aware chunking.** Chunks have no section/heading context. Default chunk size is ~4,800 chars. Layout Parser improves chunk boundaries but does NOT add heading text to chunks.

7. **upload_file() is synchronous.** Blocks until file is fully processed (chunked + embedded). ~5-9s for small files, ~55s for 6M chars. Concurrent uploads are queued server-side (serial, ~12s/MB).

8. **`vertexai.generative_models` is deprecated** (June 2025, removal June 2026). `vertexai.rag` is NOT deprecated. Migration: keep `vertexai.rag` for RAG ops, switch to `google-genai` for model calls.

9. **No deduplication.** Uploading the same file N times creates N separate entries. Must track externally.

10. **Region restriction.** `us-central1` and `us-east4` are restricted. Use `us-west1`.

---

## 7. Existing Corpus Resources

Two corpora created for experiments:

| Corpus | Resource Name | Purpose |
|--------|--------------|---------|
| reliability-experiment-2060 | `projects/768786717495/locations/us-west1/ragCorpora/2842897264777625600` | Main reliability testing (48 files) |
| reliability-concurrent-2060 | `projects/768786717495/locations/us-west1/ragCorpora/6301661778598166528` | Concurrency testing (40 files) |

---

## 8. Summary: What We Know Works for the VRAG Prototype

The core VRAG prototype loop is fully supported:

1. **Create corpus:** `rag.create_corpus(display_name=...)` -- ~15s, returns resource path
2. **Upload files:** `rag.upload_file(corpus_name=..., path=..., display_name=...)` -- synchronous, reliable, returns `rag_file_id` via `.name.split("/")[-1]`
3. **Query with scoping:** `rag.retrieval_query(rag_resources=[RagResource(rag_corpus=..., rag_file_ids=[...])], text=..., rag_retrieval_config=RagRetrievalConfig(top_k=...))` -- returns raw chunks with text + score + source
4. **Delete files:** `rag.delete_file(name=...)` -- clean, no force flag
5. **Delete corpus:** `rag.delete_corpus(name=...)` -- for cleanup

Metadata filtering must be handled externally (Supabase pre-filter + `rag_file_ids`). This is the verified production pattern.
