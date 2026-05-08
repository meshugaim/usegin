# Angle D — Vertex AI Search + Google's own stack, Jan 2026 → May 2026

## Top — the click

Vertex AI Search itself (renamed "Agent Search" on 2026-04-22, same `discoveryengine.googleapis.com` API) did **not** ship a SQL surface, structured-cell access, or aggregation over chunks. Its xlsx path is still what the spike found: each sheet → Markdown table chunk, retrieved by relevance, no math. The grounded Answer API still synthesizes text from retrieved snippets — it does not compute totals.

What *did* ship since Jan 2026, and what changes the build-vs-adopt call for ENG-1346:

1. **Vertex AI Agent Engine Code Execution** went billable on 2026-01-28. Hardened Python sandbox with `pandas==2.2.3`, `openpyxl==3.1.5`, `XlsxWriter==3.2.0`, `numpy` etc. pre-installed. Pricing is the regular Agent Engine runtime rate — `$0.0864/vCPU-hour` + `$0.0090/GB-hour`, free tier 50 vCPU-hours + 100 GB-hours/month. This is Google's equivalent of Anthropic's code-execution tool / OpenAI's code interpreter, sitting next to (not inside) Vertex AI Search.
2. **Conversational Analytics API** (preview, blog post 2026-02-20) — turn-key NL→SQL→execute→answer over **BigQuery tables only**. Returns SQL text + result DataFrame + Vega-Lite chart + NL summary. Doesn't read VAIS, doesn't read xlsx in place; the data has to land in BQ.
3. **Discovery Engine MCP server** went GA 2026-04-22 at `discoveryengine.googleapis.com/mcp` — wraps the existing search/answer surface as MCP tools. Doesn't add new capabilities, just makes calling them from Claude/ADK/Gemini cheaper to wire.
4. **Layout parser GA for xlsx** — the path our spike already exercised. Confirmed GA, but per-cell typed metadata / JSON-rows are still not exposed; we get a Markdown table.

So the headline finding is: **Google did not obviate Rung 6.** The closest Google offering — Agent Engine Code Execution — is exactly the shape of "build a Python sandbox for the agent." Adopting it means we don't write the sandbox ourselves, but we still need to design the file-handoff, the prompt surface, and the integration with VAIS retrieval. The Conversational Analytics API is the one Google offering that *would* obviate a sandbox — but only if we move spreadsheet data into BigQuery, which is a separate lift and a different product shape (per-workspace tables, schema drift, pricing). VAIS-as-the-search-surface plus Agent-Engine-Code-Execution-as-the-compute-surface is the natural Google-stack path.

## Middle — the survey

| Surface | Shape | Availability | Cost shape | What we'd add |
|---|---|---|---|---|
| **Vertex AI Search / Agent Search retrieval** (current path) | Semantic chunks; Markdown table per sheet for xlsx; no aggregation | GA | Per-query + per-doc indexed | Already in production; nothing |
| **Agent Search Answer API** | Grounded text generation from retrieved chunks; aggregated grounding score | GA | Per-answer charge on top of retrieval | Doesn't compute totals — same shape as our current agent's text answers |
| **Agent Search structured data store (BigQuery / structured JSON)** | Schema-aware semantic retrieval over rows; not SQL execution | GA (auto-sync from BQ in Public Preview) | Standard data-store storage | Per-workspace BQ tables + schema mapping; doesn't fit "user uploads xlsx" |
| **Discovery Engine MCP server** | MCP tools wrapping search + answer | GA (2026-04-22) | Same as underlying APIs | Wire-through if we ever expose VAIS as MCP for Effi |
| **Vertex AI Agent Engine Code Execution** | Hardened Python sandbox, pre-installed pandas/openpyxl/XlsxWriter; no network; limited fs | Billable from 2026-01-28 | $0.0864/vCPU-hour + $0.0090/GB-hour; 50/100 free | File handoff (we pass xlsx bytes), result extraction, prompt design, retrieval-then-compute glue |
| **Gemini built-in `code_execution` tool** | Inline-bytes Python; CSV in, Matplotlib out | GA | Bundled into Gemini token billing | xlsx is **not** in supported MIME list — would need to convert xlsx→csv first; same plumbing problem |
| **Conversational Analytics API** | NL→SQL→execute→answer; returns SQL + result + chart + summary | Preview (2026-02-20) | BigQuery compute (~$6.25/TB scanned); no extra during preview | Per-workspace BQ tables, ETL from xlsx→BQ, schema docs, agent-instructions per data-agent |
| **BigQuery DataFrames + Gemini in BigQuery** | pandas-API over BQ, Gemini-assisted code gen | GA | BQ slot pricing | Same ETL + per-workspace setup; Pythonic but still requires data in BQ |

### Vertex AI Search itself — what didn't change

Going through the 2026 release notes, the structured-data and xlsx-handling story in Agent Search is unchanged from what the spike documented. The notable items are operational, not capability-shaped:

- **2026-04-22 GA**: MCP server, dense reciprocal rank for custom ranking, geodistance ranking, doc-level relevance filter, "Vertex AI Search → Agent Search" rebrand.
- **2026-03-26**: Gemini 3.1 Pro / Gemini 3 Flash for answer generation.
- **2026-02-24 / 2026-01-26**: pricing-model flexibility (configurable subscription ↔ pay-as-you-go).

Nothing in this delta exposes per-cell typed access, lets us push aggregation into the search call, or lets the answer API compute over chunks. The structured-data store path *does* exist — and supports auto-sync from BigQuery in Public Preview — but the query model is still semantic retrieval over rows ("hotel catalog" / "real estate listing" shapes), not SQL. A row-shaped structured store ranks rows by relevance to a natural-language query; it doesn't run `SUM(amount) WHERE status='Overdue'`.

### Vertex AI Agent Engine Code Execution — the real change

This is the only 2026 surface that materially shifts the build-vs-adopt call. The shape:

- Hardened, isolated Python sandbox, no network access, limited filesystem.
- Pre-installed: `pandas==2.2.3`, `openpyxl==3.1.5`, `XlsxWriter==3.2.0` (so xlsx read+write is genuinely first-class), `numpy`, etc.
- Billed at the regular Agent Engine runtime rate of `$0.0864/vCPU-hour` + `$0.0090/GB-hour` from 2026-01-28; 50 vCPU-hours and 100 GB-hours/month free tier per Google Cloud account.
- Sits in Google ADK as a tool — ADK 1.0 GA'd at Cloud Next 2026.
- File-handoff specifics (GCS URI vs inlined bytes vs base64) and execution/memory ceilings were not nailed down by the doc surfaces I could read; the public quickstart redirected and the overview pages didn't enumerate. **Wire-probe needed before committing.**

This is *not* the same thing as Gemini's built-in `code_execution` tool. Gemini's built-in tool runs inline Python with a fixed MIME allow-list (`.csv`, `.txt`, `.py`, `.js`, image types) — **xlsx is not in the list.** A Gemini-built-in code-exec path forces an xlsx→csv conversion step, which collapses sheet boundaries and locale-formatted numbers in ways the spike already showed are lossy. Agent Engine Code Execution is the right surface for our shape because openpyxl is already in the sandbox.

### Conversational Analytics API — escape hatch, different shape

The Feb 2026 Conversational Analytics API is the most full-featured "ask data a question" surface Google has shipped. It's a complete NL→SQL→execute→answer loop; the streamed response gives back the generated SQL (debuggable), a Pandas-shaped result, a Vega-Lite chart spec, and a synthesized text summary. Pricing during preview is just BigQuery compute.

**But the input boundary is BigQuery tables.** It does not read VAIS data stores, does not read xlsx in place, does not handle ad-hoc per-conversation files. Adopting it for our use case (a design partner emails a workbook; the agent should answer questions about it) implies a per-tenant BQ project, an xlsx→BQ ETL, schema discovery / documentation, and a data-agent setup per logical dataset. That's a much bigger architectural change than dropping in a sandbox tool — and probably the wrong shape for "user-uploaded spreadsheet" because the data is heterogeneous and short-lived. It's the right shape if-and-when we want a "talk to your warehouse" product surface, which is a separate product question.

### MCP server — a thin door, not a new room

The Discovery Engine MCP server going GA on 2026-04-22 is operationally interesting (it's the cheapest way to expose VAIS to a Claude or Gemini agent that already speaks MCP) but it's the same retrieval and answer surface as the REST API, no new capabilities. If Effi ever wants to expose its VAIS over MCP to an external agent, this is the door. Doesn't change ENG-1346.

## Bottom — open ends

**What I couldn't verify:**

- **Agent Engine Code Execution file-handoff details.** The overview pages I could fetch didn't enumerate file-input mechanism (GCS URI vs inlined bytes vs base64), execution time ceiling, memory ceiling, or per-call file size limits. The doc surfaces redirected (`google.github.io/adk-docs/.../code-exec-agent-engine/` → `adk.dev/...` 404). Needs a wire-probe before committing the rung.
- **Whether Agent Engine Code Execution can be invoked from inside an ADK agent that *also* has a VAIS retrieval tool**, or whether the orchestration is up to us. Likely yes (both are ADK tools), but the chunks→sandbox handoff pattern needs to be designed.
- **Whether a structured data store from BigQuery returns row JSON or just relevance-ranked rows-as-text.** The docs talk about "semantic search over structured data"; whether the response contains typed columns or just stringified rows wasn't clear. If it returns typed JSON, that's a third path worth a spike — load xlsx as a structured-data-store doc, get typed access without a sandbox.
- **Conversational Analytics API GA date** and post-GA pricing — both unannounced.

**Things we'd want to wire-probe (≤1 day each):**

1. Agent Engine Code Execution end-to-end: stand up the sandbox tool in ADK, hand it `vendor_invoices.xlsx` bytes, ask it to compute `SUM(amount) WHERE status='Overdue'`, capture the response shape and latency. This is the load-bearing experiment for "do we adopt instead of build Rung 6?"
2. Agent Engine Code Execution with retrieved-chunk context: have the agent (a) call VAIS to find the workbook, (b) fetch the original from GCS, (c) hand it to the sandbox tool. Find out where the seams are.
3. Structured-data store with xlsx loaded as JSON-rows: does the search response give typed cells? If yes, this is a fourth surface worth naming.

**Dilemmas (z026 candidates):**

- **Adopt Agent Engine Code Execution vs. build our own sandbox vs. Anthropic/OpenAI's sandboxes (Angle B's territory).** Lean: Agent Engine fits the existing Google-stack story (we're already on VAIS + GCS), pricing is reasonable, openpyxl is pre-installed. Cost: locks us to ADK/Vertex side for the agent runtime if we want best integration; less flexibility than rolling our own. Risk: file-handoff details unverified; preview/limits-discovery friction.
- **Conversational Analytics API for "talk to the warehouse" feature** — separate product question, but worth flagging since Lihu/Oria sometimes conflate "agent reads a spreadsheet the user just uploaded" with "agent answers analytical questions over an organization's data." These are different surfaces; the Google stack treats them differently.

**Friction zettels:** None this round — the Google docs were spotty (overview pages thin on specifics, several redirects to dead pages) but that's documented gap, not session friction worth a zettel.

---

**Sources** (release-note dates checked against the live doc page as of 2026-05-08):

- Agent Search release notes: `https://docs.cloud.google.com/generative-ai-app-builder/docs/release-notes`
- Agent Engine Code Execution overview: `https://docs.cloud.google.com/agent-builder/agent-engine/code-execution/overview`
- Gemini code execution: `https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/code-execution`
- Conversational Analytics API blog (2026-02-20): `https://cloud.google.com/blog/products/data-analytics/build-data-agents-with-conversational-analytics-api`
- Conversational Analytics in BigQuery (preview): `https://cloud.google.com/blog/products/data-analytics/introducing-conversational-analytics-in-bigquery`
- Discovery Engine MCP reference: `https://docs.cloud.google.com/generative-ai-app-builder/docs/reference/mcp`
- Layout parser / parse-and-chunk: `https://docs.cloud.google.com/generative-ai-app-builder/docs/parse-chunk-documents`
- Spike findings (xlsx behavior): `/workspaces/test-mvp/experiments/vais-xlsx-spike/FINDINGS.md`
