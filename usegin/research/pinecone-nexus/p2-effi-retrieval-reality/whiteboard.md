# P2 — Effi Retrieval Reality

Angle: How does Effi retrieve and ground answers TODAY. Mapped from current code on `main` (commit `f88b01291`, 2026-05-05). Migration framing per the workspace-toggle gate in `chat_context.py:178-226` and the parallel sync paths in `sync/sync_worker.py:943,1702`.

## Top — the click

Effi has **two parallel retrieval stacks running today** behind a workspace-level toggle, picked per chat at request time:

1. **GFS path (default):** an in-house multi-store fan-out (`MultiStoreQueryService`, `agent/multi_store_query_service.py`). Per project we maintain up to 6 separate Google File Search stores — `{file, email, drive} × {internal, external}` — each indexed by Gemini. The agent's `search_files` tool fans out a parallel `gemini-2.5-flash` `generate_content(... tools=[FileSearch(...)])` call to N stores via a ThreadPoolExecutor, and Gemini does the grounding + prose synthesis inside each store. We then concatenate the prose answers and merge the grounding chunks. Citations come from Gemini's `grounding_metadata.grounding_chunks` (title + 100-char preview).
2. **VAIS path (target):** a single Vertex AI Search Engine per project (`VaisSearchService` + `VaisQueryService` in `agent_api/vais/`). The tool is `semantic_search`, returns **raw chunks (full content + relevance score) plus a `context` mini-prompt** telling the agent to synthesize and cite. Access control is enforced as an AND filter injected at construction time (`access_level: ANY("external")`) plus a mandatory `project_id` clause, plus AIP-160-to-VAIS translation of any per-query agent filter.

The complexity budget today is overwhelmingly spent on **GFS — both upstream (a 162-experiment hardening saga: per-project bottlenecks, probabilistic STATE_FAILED, `importFile` categorically broken for large PDFs, no dedup, no operation.done signal) and downstream (the multi-store fan-out, per-store metadata-filter injection, drive vs file vs email store routing, role-based store visibility)**. The VAIS path replaces almost all of that with a single search call against a single Engine + one filter expression. The friction left in VAIS is on the *write* side (LRO-resume, per-project DataStore lifecycle, GCS staging) not the read side. **Where it hurts most today is the GFS read path: 6× fan-out latency, "Gemini synthesizes inside the tool" steals citation control from the agent, and the per-store-result merging is just string concatenation.**

Access control is layered: **RLS is the floor** (gates "can the user SELECT this row at all" — must accommodate human curator UIs); **tool-layer filters are the ceiling** (Effi-specific `is_excluded=false` and `access_level` enforcement at the tool boundary). VAIS does this via a query-time filter; GFS does it by *which stores you're handed* (role-based) plus per-store entity_type injection; SQL-backed browse tools (`data_browse`) do it via RLS + explicit `.eq("is_excluded", False)` + `.eq("access_level", ...)` in Python.

## Middle — the body

### 1. The agent loop — what Claude is actually doing

**Entry:** `nextjs-app` `/api/chat/stream` proxies to Python `agent_api/api/chat.py` → `chat/chat_service.py:99-338` (`ChatService.stream_chat_response`). Python is **not publicly reachable** — Railway private network. CLI also hits `/api/v1/*` Next.js routes that proxy.

**Context build:** `chat/chat_context.py:250-443` (`build_chat_context`) does:
- Fetch chat config + project + system prompt in parallel (`asyncio.gather`).
- Resolve search backend via `_resolve_vais_engine(...)` (`chat_context.py:178-226`): checks `workspaces.vais_search_enabled` AND `vais_stores.status='ready'` for this project. Either returns a VAIS `engine_id` *or* falls back to GFS multi-store resolution via `ProjectStoreService.get_accessible_stores`.
- `build_project_tools(...)` in `agent/mcp_builder.py:96-262` constructs the MCP servers:
  - File search: VAIS or GFS, **never both** (mcp_builder.py:154-184).
  - `data_browse_server`, `linear_browse_server`, `fathom_browse_server` always when an authed Supabase client is present and `tool_scope == "internal"`.
  - `github_browse_server` when feature-flagged.
  - `anchored_report_server` only when the chat carries a `report-run` anchor.

**Agent SDK call:** `agent/agent.py:90-298` uses `claude_agent_sdk.ClaudeSDKClient` with:
- `system_prompt = {type:"preset", preset:"claude_code", append: <Effi prompt>}` — i.e. **we're inheriting Claude Code's preset and appending the Effi persona** (`agent/effi_system_prompt.py:16-314`) plus dynamic orchestration guidance from `build_orchestration_prompt(...)` plus project context (name, description, Linear scopes, Fathom meeting count, full project outline tree).
- `allowed_tools` is a strict allowlist built by `build_mcp_config` covering only the wired MCP servers.
- `model` resolved from `chat_config` (haiku per `FILE_SEARCH_INTEGRATION.md:160`).
- `cwd = user_workspace` per-user directory; `resume = session_id` if provided.
- Layer-2 auth fallback: tries primary auth (`oauth` or `api_key`), retries on the other if a fallback-triggering error fires (`agent.py:265-298`).

**Streaming:** `Agent._process_messages` (agent.py:357-521) interleaves StreamEvents and SDK message types — emits `content` deltas, `tool_use` events, `turn_complete` (turn-accumulator boundary), `result` (final `session_id`, `usage`, `cost_usd`). Per-turn span tracking via Sentry: `llm.connect`, `llm.inference`, `llm.thinking`, `llm.content`, `llm.ttft`, `gfs.query`, `gfs.query_single_store`, `vais.search`.

### 2. Retrieval stacks — side by side

| Dimension | GFS (today, default) | VAIS (target, behind toggle) |
|---|---|---|
| **File** | `agent/multi_store_query_service.py` + `agent/file_search_tool.py` | `agent/vais_search_tool.py` + `vais/query_service.py` + `vais/search_service.py` |
| **Backing service** | Google `genai` File Search (Gemini-hosted) | Google Cloud Vertex AI Search / Discovery Engine |
| **Stores per project** | up to 6 (`{file, email, drive} × {internal, external}`) | 1 (DataStore + Engine pair) |
| **Tool name model sees** | `search_files` (or `semantic_search` w/ filters when `use_semantic_search=True`) | `semantic_search` |
| **Tool response shape** | `{answer: prose, sources: [...]}` — Gemini synthesizes inside the tool | `{context: mini-prompt, chunks: [{content, relevance, source, entity_id, entity_type}]}` — agent synthesizes |
| **Chunk content size** | Truncated to 100-char preview (`file_search_tool.py:115`) | Full chunk content (no truncation) |
| **Synthesis location** | Inside the tool (Gemini) | Inside the agent (Claude) |
| **Citations come from** | `grounding_metadata.grounding_chunks` per-store, then merged | `chunk.name` (resource path) + `chunk.document_metadata.struct_data` |
| **Filter syntax (agent-facing)** | AIP-160 (`sender = "alice@co.com"`) — validated by `aip160_parser` before sending | AIP-160 — translated to VAIS `field: ANY("value")` syntax (`query_service.py:46-113`) |
| **Filter syntax (backend)** | GFS native AIP-160-ish | VAIS native (`ANY()` for strings, `>=`/`<=` for numerics) |
| **Per-query mandatory filter** | `entity_type = "..."` injection per-store (multi_store_query_service.py:71-74) | `project_id: ANY("{project_id}")` always (query_service.py:240) |
| **Access control** | By **which stores you get** (role-based via `ProjectStoreService.get_accessible_stores`); external user only sees external stores | Single store + `access_filter='access_level: ANY("external")'` AND'd at construction (query_service.py:131-143) |
| **Concurrency** | 6 parallel calls via ThreadPoolExecutor, merged | 1 call |
| **Latency** | Bound by slowest store (synth + retrieval per store) | Single retrieval, single Sentry span `vais.search` |
| **Retry / failure handling** | Per-store success boolean; if all fail, fail; partial success returns subset | Exponential backoff on 429/500/503/504, fail-fast on 400/404 (query_service.py:32-43, 261-318) |
| **Heading chain** | Not extracted | Markdown heading regex extracts ancestor headings from chunk content (search_service.py:204-234) |

### 3. Citation flow — where do citations actually come from

Effi's user-visible citations are **not provided as structured anchors by the SDK**. They emerge from the model's prose synthesis based on what the tool returned. The "fact-based, cite-with-dates" discipline is enforced almost entirely **in the system prompt** (`effi_system_prompt.py:81-148, 204-225`) — the model is told to cite, given a format template, and given source-authority rules (high/medium/low authority tiers).

- **GFS:** the tool returns Gemini's **already-synthesized prose** ("answer") plus chunk **titles + 100-char previews**. The agent receives `Sources:\n1. <title>\n   Preview: <100 chars>\n...`. The agent then re-synthesizes those into Effi's voice with citations, but the citation grain is **document-level + truncated preview** — the agent doesn't see the full chunk text Gemini grounded on.
- **VAIS:** the tool returns **raw chunk content (full text)** plus per-chunk `{source, entity_type, relevance, content, entity_id}` and a `context` mini-prompt: "The following are relevant excerpts from the user's files. Use these to answer the user's question. Cite source files when possible." (vais_search_tool.py:30-34). Citation grain is **chunk-level with full text + entity_id**.

Anchored deep-link citations (clicking through to a meeting / email / file) are a separate path: `data_browse` MCP tools (`get_email`, `get_meeting`, `get_drive_file`, `get_attachment`, `get_file`, `get_email_thread`, `get_sharepoint_file` in `agent_api/data_browse/`) let the agent fetch full content by ID after `browse_*` enumerated candidates. These do not flow through GFS/VAIS at all — they go straight to Postgres via the user's authed Supabase client.

### 4. Access control — layer by layer

Per memory note `project_rls_floor_tool_ceiling.md` (2026-05-05) and `project_tools_filter_access_level.md`, the canonical mental model is **two-layer**:

| Layer | Mechanism | Where in code | What it gates |
|---|---|---|---|
| **Floor (RLS)** | Postgres Row-Level Security | `supabase/CLAUDE.md` Two-layer access section, every `supabase/migrations/*` table | "Can this user SELECT this row at all" — kept permissive enough that human curator UIs can read excluded/archived rows |
| **Ceiling — VAIS query-side** | AND-filter injected at construction, `access_filter='access_level: ANY("external")'` for external users | `vais/query_service.py:131-167` (`AccessContext.for_role` + `build_vais_query_service`) | Excludes internal-tier docs from external users at the search engine boundary |
| **Ceiling — GFS by-store** | `ProjectStoreService.get_accessible_stores(project_id, role)` returns a tuple `(file, email, drive)` of accessible store-ID lists per role | `agent_api/file_search/project_file_search_service.py` (caller) + `chat_context.py:332-338` | External users only get external stores; the multi-store query service literally never sees internal store IDs for them |
| **Ceiling — SQL browse tools** | RLS + explicit Python filtering | `data_browse/browse_emails.py:157,170,230` (`.eq("is_excluded", False)`); `data_browse/browse_files.py:65-66` (`access_level`); `data_browse/browse_meetings.py:117,149,222,762` | `is_excluded` always filtered in tool code (never RLS); `access_level` filtered as agent-supplied parameter or implicitly via RLS |
| **Audience scope (NEW)** | `tool_scope: "internal" \| "external"` parameter to `build_project_tools` | `agent/mcp_builder.py:103-146,151,196,207,218,229,243` | When an internal report creator generates a report for an external audience, drops `data_browse`/`linear_browse`/`fathom_browse`/`github_browse` entirely — only `file_search` survives. **Load-bearing per the long block-comment in mcp_builder.py:128-146 — RLS does NOT cover internal-creator-external-audience.** |

Tenancy propagation:
- `workspace_id` resolved from `project_data.workspace_id` (`chat_context.py:319`).
- `project_id` always present in VAIS filter as `project_id: ANY("{project_id}")` (`query_service.py:240`); always present in GFS metadata (auto-injected per-store in `_build_metadata_filter`).
- `user_role` (`"owner"`, `"internal"`, `"external"`) flows from `ProjectService.get_project_with_role` → `ProjectContext.user_role` → `build_project_tools(user_role=...)` → either `AccessContext.for_role(role)` (VAIS) or `get_accessible_stores(project_id, role)` (GFS).

### 5. Ingestion / sync pipeline

`agent_api/sync/sync_worker.py` (~3000 lines) polls the `gfs_sync_items` queue and routes each row by `backend` field (`sync_worker.py:943,1702`):

| Source | Connector | Sync entry point | Backend write |
|---|---|---|---|
| Google Drive | OAuth via Google APIs | drive sync poll → `sync_items.py` dispatcher → `gfs_sync_items` rows | GFS `uploadToFileSearchStore` *or* VAIS `vais/upload.py` (GCS staging → JSONL → `importDocuments` LRO) |
| SharePoint | Multi-site Graph API (`sharepoint/`) | sharepoint sync → `gfs_sync_items` | same dual-backend |
| Email | Forward to project inbox + classification rules | `api/email.py` + email pipeline | same dual-backend |
| Fathom | OAuth via Unified.to (`connectors/unified_client.py`) | per-recorder rule-based selection → meeting transcript enrichment → `gfs_sync_items` | same dual-backend |
| Linear | OAuth via Unified.to | linear sync → `gfs_sync_items` | same dual-backend |
| File upload | Direct to project | `api/files.py` → `gfs_sync_items` | same dual-backend |

Per memory `project_sync_worker_architecture.md`: a healthy VAIS-toggle workspace shows `in_gfs=false in_vais=true` rows; LRO-resume (`pending_lro_name`) means a `failure_count=1 → synced` is the **normal** signature of a slow LRO that finished while the worker was waiting.

`vais_prototype/` (in `python-services/experiments/vais_prototype/`) is a **standalone non-production prototype** with its own `vais_documents` table, sync worker, API on port 58200, Next.js UI on 63200. Production VAIS goes through `gfs_sync_items` + `agent_api/vais/service.py`. Don't confuse the two.

### 6. Pain points — evidence with file paths

| Pain | Evidence |
|---|---|
| **GFS upload reliability is structurally broken** at scale: per-GCP-project bottleneck (NOT per-key), probabilistic `STATE_FAILED` for text-heavy PDFs (~60% at 2000 dense pages), `importFile` 0/48 for large PDFs, no dedup. | `python-services/experiments/GFS_FINDINGS.md` — 162-experiment consolidated findings |
| **GFS multi-store fan-out is 6× the cost of a single search.** Every search round-trips to Gemini 6 times for a fully-populated project; merging is just string concatenation. | `agent/multi_store_query_service.py:373-508` |
| **Citation truncation:** GFS path returns 100-char previews; the agent has to re-synthesize without seeing the actual grounded text. | `agent/file_search_tool.py:114-117,313-317` |
| **Synthesis happens inside the tool (GFS)** — Gemini decides what to say; we get prose, not chunks. The Effi prompt then synthesizes again on top of Gemini's synthesis. | `agent/multi_store_query_service.py:289-298` |
| **Two parallel write paths to maintain.** Every connector (Drive, Email, SharePoint, Fathom, Linear, file upload) needs the GFS path + the VAIS path until migration is done. | `sync/sync_worker.py:943,1702` (the two `if backend == "vais":` branches) |
| **Six known production GFS bugs filed** (`docs/bugs/003,004,010,011` etc.): upload timeout, delete non-empty, deleted files remain searchable, sync queue starvation. | `python-services/experiments/GFS_FINDINGS.md` lines 459-461 |
| **System prompt is huge.** `effi_system_prompt.py` ships ~315 lines of identity + 200 lines of orchestration + dynamic project outline (whole project file tree) injected at every chat turn. Inherits from `claude_code` preset on top of that. Token cost per turn before tool calls is non-trivial. | `agent/effi_system_prompt.py`, `chat_context.py:382-407` (outline generation) |
| **Tool response → text → re-parse.** Both GFS and VAIS tool responses are JSON-stringified into a `text` content block (`vais_search_tool.py:231`, `file_search_tool.py:124-128`). The agent reads it as text. We're going through MCP-text-protocol overhead instead of structured tool results. | both files |
| **Two filter-syntax dialects.** Agent emits AIP-160; we then either (a) parse-validate it and pass through to GFS (file_search_tool.py:264-281), or (b) parse it and translate to VAIS `ANY()` syntax (query_service.py:46-113), stripping non-indexable fields. Two surface areas to keep aligned. | `agent_api/vrag/aip160_parser.py` + the two callsites above |
| **`tool_scope` is doing load-bearing audience-scope work that RLS cannot do** — and the original comments described it as "transitional". `mcp_builder.py:128-146` retracts that framing and explicitly names the gap. | `agent/mcp_builder.py:103-146` |

### 7. Cost / latency shape (today)

- **Per-chat-turn fixed cost** before any tool: full Effi system prompt + Claude Code preset + project outline injection + Linear/Fathom context blocks. No measured token count in this round; flagged below.
- **Per `search_files` call (GFS):** 6 parallel `gemini-2.5-flash` `generate_content` calls each with FileSearch tool grounding. Each call's latency is bounded by Gemini retrieval + Gemini synthesis. Sentry span `gfs.query.duration_ms` captured per-call.
- **Per `semantic_search` call (VAIS):** 1 `SearchServiceClient.search` call in CHUNKS mode, retried up to 3× on 429/500/503/504. Sentry span `vais.search.latency_ms` captured.
- **Per turn typical:** the agent often runs 2-3 search passes per the system-prompt orchestration ("don't stop, rephrase, narrow") plus 0-N browse + 0-N retrieve calls. So GFS cost is `~2-3 × 6 = 12-18` Gemini grounding calls per question; VAIS cost is `~2-3` retrieval calls per question.

## Bottom — the open ends

### Open questions / decisions implicit (z026 shape)

1. **Migration progress is binary per workspace, not per project.** The toggle `workspaces.vais_search_enabled` flips a whole workspace at once. There is no per-tenant rollout fraction, no shadow-eval. **Decision implicit:** "we ship VAIS by flipping toggles when we believe it's good enough." Open: how do we know it's good enough for a given workspace? No answer-quality eval harness surfaced in this read. Friction zettel candidate.
2. **System-prompt-as-prose-rules vs structured citations.** Today: every citation discipline is enforced by ~80 lines of natural-language prompting. Adding a structured-citation feature (anchor IDs flowing back from tool results into the rendered answer) would let the prompt shrink and the UI render reliable click-throughs. Implicit decision today: "Claude prose discipline + post-hoc text matching is good enough." Worth surfacing for P3/Sam.
3. **What is `search_files` truncation costing us?** The 100-char preview means the agent often answers from Gemini's prose without reading the actual grounding text. We don't have an eval that quantifies this. The VAIS path doesn't have this problem (full chunks). Open: is the answer-quality delta GFS→VAIS being measured anywhere?
4. **GFS path keeps accumulating hardening complexity.** `experiments/GFS_FINDINGS.md` has 32 experiments + section 10's "Production Upload Policy" with 6 architectural recommendations. If VAIS is the destination, the *cost of every additional GFS hardening commit* should be weighed against migration velocity. (Mark's slot, not mine — flagging.)
5. **`tool_scope` is now permanent infrastructure, not transitional.** The mcp_builder.py:128-146 long-comment is the team retracting an earlier framing. The implicit decision: "RLS is not enough; tool_scope stays until either Custom Access Token Hooks or synthetic external principals exist." Worth a zettel — the *retraction* of "transitional" is itself the lesson.

### Gaps in this read

- **No measured latency or token numbers.** Sentry spans exist (`gfs.query`, `vais.search`, `llm.ttft`, `llm.inference`) but I didn't pull a real distribution from Sentry. P3's Nexus comparison will need that.
- **Did not trace `ProjectStoreService.get_accessible_stores`** in detail — confirmed by name + caller pattern, didn't read the body. The role→stores mapping is a load-bearing access-control hop.
- **Did not verify the actual prose of the GFS path's citation-stripping** in production. Claim that "Gemini synthesizes inside the tool" is from `multi_store_query_service.py:289-298` reading; production behavior could differ if Gemini sometimes returns no synthesis.
- **`workspaces.vais_search_enabled` rollout state across tenants** — didn't query Supabase. P1 (product-and-risk) likely has the customer mix; this side just notes the gate exists.
- **Prototype vs production VAIS code path divergence.** I read the production VAIS in `agent_api/vais/` and noted the prototype lives in `experiments/vais_prototype/`. Did not diff them.
- **No reading of the `vrag/` directory** beyond confirming `aip160_parser` exists. Could have more retrieval-relevant code.
- **`PRODUCT.md`'s claim that `system-architecture.md` "diverged significantly"** is itself a flag — the divergence direction (toward what we have) is what this whiteboard maps, but a head-on diff of design vs reality would be its own document.

### Things I couldn't fully trace in 30 min

- **End-to-end chunk → rendered citation in the UI.** I can see chunks come out of `vais_search_tool.py` formatted as `{source, entity_id, content, ...}` JSON-stringified into a text block. I did not trace how the Next.js chat UI parses the agent's final answer to render citation chips/anchors. The model presumably emits prose with source names; whether structured anchors flow through is not visible from this side.
- **The full lifecycle of a `gfs_sync_items` row across both backends.** `sync_worker.py` is 2937 lines; I only confirmed the two `if backend == "vais":` branches at 943 and 1702. The shape of the dispatch (does VAIS reuse the same retry/backoff envelope as GFS, or has it diverged?) needs a deeper read.
