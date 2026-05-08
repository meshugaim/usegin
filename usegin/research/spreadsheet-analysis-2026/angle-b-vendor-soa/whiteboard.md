# Angle B — Agent-vendor SOA for spreadsheet analysis (2025–2026)

## Top — the click

**Anthropic's `code_execution_20260120` tool is the leverageable answer.** It's a hosted Python sandbox (Python 3.11, 5 GiB RAM, 5 GiB disk, pandas + openpyxl + xlsxwriter pre-installed) that the same Claude model we already pay for can invoke as a server-side tool — one extra entry in the `tools` array of the `messages.create` call we already make. Files come in via the existing Files API (`container_upload` content block), and pricing is generous for our scale (1,550 free container-hours per org per month, then $0.05/hr/container; **free** when bundled with `web_search` / `web_fetch`). Every other vendor that solved "agent does true xlsx analysis" in 2025 ships the same shape — sandboxed Python with pandas — under different packaging: OpenAI Code Interpreter, Glean Data Analysis, Microsoft Copilot Python-in-Excel, Notion Workers. The market has converged on one answer, and Anthropic's version is the cheapest seam for us because we are already inside their model.

## Middle — the survey

### Comparison table

| Vendor | Shape | Sandbox model | File ingestion | File-size limits | Available as | 2025–26 deltas | Quality signal |
|---|---|---|---|---|---|---|---|
| **Anthropic Code Execution** | Hosted Python+Bash sandbox, agent writes pandas/openpyxl code | Container per workspace, isolated, no internet, persists 30 days, REPL state in `_20260120` | Files API → `container_upload` block; CSV/xlsx/json/xml/images/text | 500 MB single file, 100 GB org (Files API); container 5 GiB RAM / 5 GiB disk | Anthropic API, Azure AI Foundry. **Not** on Bedrock or Vertex. | `_20260120` adds REPL persistence + programmatic tool calling from inside sandbox. `_20250825` adds bash + filesystem (Aug 2025). | Prod-grade; powers Claude.ai's "create-and-edit-files" + Claude-for-Excel add-in (Opus 4.6, Feb 2026) |
| **OpenAI Code Interpreter** | Hosted Python sandbox, agent writes code | Container per session, ~1 hr active TTL | Files API → file attachment; csv/xlsx/docx/pptx | 1 GB/file via Files API; up to 1,000 rows/sheet auto-summarized in Responses API | Responses API (`tools: [{type:"code_interpreter"}]`), Assistants API | xlsx/csv added as native Responses-API input types (Feb 2026); ChatGPT for Excel GA May 2026 (GPT-5.5) | Mature; ~3 yrs in market |
| **Google Gemini / Vertex AI Search** | Hybrid: VAIS does Markdown-table extraction (what we ship today) + Gemini reasons over chunks; no sandboxed code path in VAIS | No sandbox in the search product; Gemini Workspace's Sheets "Help me analyze" runs against live Sheets, not arbitrary xlsx | VAIS parses xlsx GA; Workspace reads Drive xlsx | 20 MB AI Studio, 50 MB Workspace; ~1M token context (≈200–300K cells) | Vertex AI Search (we use this), Gemini API, Workspace Sheets sidebar | XLSX parsing went GA in VAIS 2025; "Help me analyze" promoted to GA in Sheets 2025 | What we already ship — search-grade, not analysis-grade |
| **Glean Data Analysis** | Sandboxed Python + iterative agent loop ("Analyze data" Action) | Per-user Python sandbox; ephemeral | Indexed files OR direct upload; xls/xlsx/csv/json | **5 files × 64 MB each per query** | Glean Assistant (closed product); also has structured-query agents into BigQuery / Salesforce / Jira / Databricks via Conversational Analytics API + Databricks Genie | Major 2025 push: structured query agents over real DBs (not just files); Databricks Genie partnership Q4 2025 | The closest analog to "Effi over your work data" — same scope, different go-to-market |
| **Microsoft Copilot in Excel** | Python-in-Excel + "Analyze data" + new "Edit with Copilot" Python mode | Microsoft-hosted Python (Anaconda) inside the Excel cloud runtime | Native — runs against the open workbook | Workbook size = Excel limits | Excel 365 add-in; Microsoft 365 Copilot license required | April 2026: Python-from-Copilot GA, multi-step Plan mode, GPT-5.5 + **Claude Opus 4.7** as model options | Strongest on the in-spreadsheet UX; not API-accessible for our pipeline |
| **Notion AI / Workers** | "Workers" = JS or Python functions over Notion DB; AI calls workers as tools | Notion-hosted infrastructure | Notion databases natively; CSV import per-column type-mapped | Notion DB limits | Closed product (Notion AI add-on) | Workers shipped 2026; AI agent platform Apr 2026; context 50 pages (Jan 2026) | Database-native (their tables ARE Notion DBs); doesn't map to ad-hoc xlsx ingestion |
| **Box AI / Box Agent** | Document-Q&A agent + file generation | Box-hosted | Files in Box | n/a | Box product, A2A protocol agents (2025) | Spreadsheet querying still listed as "coming soon" as of early 2026 | Trails the field on tabular-data Q&A |
| **Julius AI** | Chat-with-your-data: upload → agent runs Python in sandbox → returns charts | Hosted Python | Direct upload; xlsx/csv | Generous (consumer-grade) | Closed B2C/SMB product | $10M seed mid-2025; chat-driven, file-based | Niche but well-reviewed for the "no-code analyst" persona |
| **Quadratic** | Spreadsheet UI where each cell can be Python/SQL/JS, AI assists | Browser+server hybrid | xlsx/csv/parquet/PDF/images, plus live Postgres/MySQL/Snowflake | n/a | Closed product | Active 2025; AI-cell pattern | Not a fit for backend pipeline; relevant as UX inspiration |
| **Hex** | Collaborative notebooks with AI assistants over live DB connections | Hosted Python+SQL | Direct DB connections, files | Enterprise-tier limits | Closed product | Already mature; 2025 added more agent tooling | Wrong shape — analyst-facing notebook product, not an agent API |

### Per-vendor notes (notable bits)

- **Anthropic Code Execution.** The doc-grade summary: tool name `code_execution`, current type `code_execution_20250825` (universal) and `code_execution_20260120` (Opus 4.5+/Sonnet 4.5+; adds REPL persistence). Files API uses beta header `files-api-2025-04-14`. Containers are workspace-scoped, expire 30 days after creation, **no internet access** (good for security, but means we can't have the sandbox call back into VAIS or our own API — we have to pass data in upfront). The pre-installed library list includes `pandas`, `numpy`, `openpyxl`, `xlsxwriter`, `xlrd`, `pyarrow`, `matplotlib`, `seaborn`, `scipy`, `statsmodels`, `python-pptx`, `python-docx`, `pypdf`, `pdfplumber`, `tabula-py`, `reportlab`, `sqlite`, `ripgrep` — i.e. everything we'd reach for. **Free when paired with `web_search_20260209` or `web_fetch_20260209`** in the same request, otherwise execution time is metered (1,550 hr/org/month free, then $0.05/hr).

- **OpenAI Code Interpreter.** Same shape, slightly different packaging. Now exposed in the Responses API as a first-class tool; xlsx/csv added as native Responses-API input types in Feb 2026. Pricing: $0.03 per session (1 GB container, 1-hour active TTL); from March 31 2026, billing model changes to $0.03 per 20-min session per 1 GB container. Mature, but irrelevant to us unless we add OpenAI as a model provider — we're a Claude shop.

- **Google Vertex AI Search (what we already ship).** XLSX parsing is GA. There is **no** code-execution / sandbox path inside VAIS itself — it does retrieval over Markdown-extracted tables, exactly what our spike confirmed. For analytical questions, Google's solution is either (a) pull the chunks and let the LLM reason over them (status quo), or (b) use Vertex AI Agent Builder with a separate code-exec tool wired up. There is no "free upgrade to analysis" inside VAIS.

- **Glean.** This is the most-direct competitor: enterprise agent over indexed work data, with a Python-sandbox "Analyze data" Action when the file is structured. They also shipped structured-data agents over BigQuery / Salesforce / Jira / Databricks in 2025 — natural-language → SQL with a conversational layer. Worth knowing as the SOA for "do what Effi does, plus actual analysis." Not adoptable (closed product), but is the design reference.

- **Microsoft Copilot in Excel.** Notable for two reasons: (1) April 2026 GA of Python-from-Copilot in Excel, with reasoning/plan mode; (2) **Microsoft now offers Claude Opus 4.7 as a model option inside Excel Copilot.** Confirms that the "agent + sandboxed Python over a workbook" design is the industry default and that Anthropic models are first-class in someone else's xlsx product.

- **Notion Workers.** Different shape — AI agent calls custom JS/Python *functions* (not a free-form sandbox) registered against a database. Closer to a function-calling pattern than to Code Interpreter. Interesting precedent for "let the agent run a deterministic worker" as opposed to "let the agent freestyle pandas," but doesn't match our needs.

- **Box AI.** Spreadsheet querying still listed as "coming soon" as of early 2026 — they trail the field. Skip.

- **Julius AI / Quadratic / Hex.** Consumer- or analyst-facing products, not infra we can lift. Their existence is a market signal: "chat with your spreadsheet" is now a category with VC money and competition. None of them shows up as an API we'd integrate.

## Bottom — open ends

### What couldn't be fully verified from public docs

- **Claude code-execution xlsx file-size ceiling in practice.** Docs list 5 GiB container disk and 500 MB Files-API upload limit, and pre-installed openpyxl/pandas. We have not wire-tested how a 50 MB workbook performs (load time, memory peak with `pd.read_excel`). Worth a one-shot probe before committing to it as the production path.
- **End-to-end latency.** No public number for "user → Claude → code-exec → result" round-trip. Our spike measured 220–669 ms for VAIS retrieval; sandbox spin-up + pandas load is almost certainly an order of magnitude slower. Need a wire-test.
- **Cost at our scale.** 1,550 free hours/month sounds generous, but execution time is billed when files are pre-loaded *even if the tool isn't invoked* (per docs, "If files are included in the request, execution time is billed even if the tool is not invoked, due to files being preloaded onto the container"). We'd want to model the cost of a workspace where every email-attachment xlsx triggers a container regardless of whether the user asks an analytical question.
- **No-internet sandbox limitation.** The container has no outbound network. That means the agent can't query VAIS *from inside* the sandbox to fetch additional context — we'd have to pass everything in upfront via Files API or text. This shapes how the analytical loop integrates with our current canon-fetch plumbing.

### Wire-tests worth running before deciding

1. Upload our spike's `large_transactions.xlsx` (5K rows, 168 KB) via Files API + invoke `code_execution_20260120` with a Claude prompt like "what's the total amount by status?". Measure: (a) round-trip latency, (b) tokens consumed, (c) container-hours billed.
2. Repeat with a 50 MB workbook to find the ceiling.
3. Try the same with `code_execution_20250825` (no REPL persistence) to confirm whether the simpler tool version suffices for our analysis surface.

### Dilemmas (z026 candidates)

- **Sandbox vs. in-process.** Anthropic's sandbox is the path of least resistance, but it commits us to round-tripping every analytical question through Anthropic infrastructure, paying per-container-hour, and accepting a network hop we don't have today. Angle C (in-process libraries — DuckDB, polars, in-Python pandas in our existing python-services) is a real alternative. The decision isn't about which is technically capable; it's about where we want analysis code to *live*.
- **Status quo (VAIS chunks + LLM reasoning) is probably enough for the current B2B-spreadsheet shapes** the spike characterized. The question "is true analysis a justified product surface" was deferred in the spike (Rung 6). Adopting Anthropic's tool buys capability we may not need at current customer scale; deferring it costs nothing if we choose the in-process path later.

### Friction zettels

None — public docs were sufficient and load fast. No `dx zettel add` filed.

### Sources

- Anthropic code-execution docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- Anthropic agent-API capabilities (Sep 2025 announcement): https://www.anthropic.com/news/agent-capabilities-api
- Claude file creation / "Code Interpreter" review: https://simonwillison.net/2025/Sep/9/claude-code-interpreter/
- Claude for Excel (Feb 2026, Opus 4.6): https://support.claude.com/en/articles/12650343-use-claude-for-excel
- OpenAI Responses API xlsx support: https://community.openai.com/t/responses-api-now-has-expanded-file-input-types-docx-pptx-csv-xlsx/1375013
- OpenAI ChatGPT for Excel: https://openai.com/index/chatgpt-for-excel/
- OpenAI pricing (code interpreter $0.03/session): https://openai.com/api/pricing/
- Glean Data Analysis: https://docs.glean.com/administration/assistant/data-analysis/about-data-analysis
- Glean structured-data agents 2025: https://www.glean.com/blog/structured-data-spotlight-2025
- Glean × Databricks Genie: https://www.glean.com/blog/glean-databricks-genie-announce
- Vertex AI Search xlsx GA: https://docs.cloud.google.com/generative-ai-app-builder/docs/release-notes
- Microsoft Copilot Python-in-Excel (April 2026): https://techcommunity.microsoft.com/blog/excelblog/whats-new-in-excel-april-2026/4502696
- Microsoft Copilot Python intro: https://techcommunity.microsoft.com/blog/excelblog/introducing-copilot-support-for-python-in-excel-advanced-data-analysis-using-nat/3928120
- Notion 3.2 release (Workers, Jan 2026): https://www.notion.com/releases/2026-01-20
- Notion AI features 2026: https://fazm.ai/blog/notion-ai-features-2026
- Box AI for Hubs (xlsx "coming soon"): https://community.box.com/intelligent-content-management-43/box-ai-for-hubs-faq-and-resource-guide-3945
- Julius AI: https://julius.ai/
- Quadratic vs Julius comparison: https://medium.com/data-science-collective/quadratic-vs-julius-ai-the-smart-spreadsheet-tool-that-actually-delivers-129b652b9f07
