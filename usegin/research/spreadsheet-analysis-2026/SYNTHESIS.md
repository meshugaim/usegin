# SYNTHESIS — spreadsheet-analysis-2026

Cross-cut across A/B/C/D whiteboards. Question: what does "true spreadsheet analysis" require beyond VAIS-native semantic-search-over-chunks (shipped 2026-05-07), and has someone solved it more simply during this time?

## Top — the click

**Yes, someone solved it — three someones, the same way — and there's a fourth path that sidesteps all three.** The 2025–26 industry answer to "agent does true xlsx analysis" is *sandboxed Python with pandas+openpyxl*. Anthropic, OpenAI, and Google all shipped the same shape under different packaging (Anthropic `code_execution_20260120`; OpenAI Code Interpreter; Vertex AI Agent Engine Code Execution). Microsoft Copilot for Excel even ships Claude Opus 4.7 as a model option — Anthropic's models are first-class inside someone else's xlsx product. The market converged.

The fourth path is **DuckDB + the `excel` extension**, in our own Python container, ~80 LOC. SQL covers all 7 ENG-1346 patterns; the SQL-only surface dodges the Python-sandbox tenancy question entirely.

**ENG-1346's 2024-era plan (question-classifier → templated-pandas-codegen → home-grown sandbox → result-interpreter) is strictly dominated by both DuckDB and any of the three vendor sandboxes.** Don't ship it. The 7 patterns it identified are still the right capability list; the architecture it proposed is no longer the right way to deliver them.

The hidden cheap win that dominates any longer-horizon investment: **a system-prompt change that teaches the agent to recognize aggregation/rank/breakdown/variance shape and either route to a real path or refuse with a specific reason.** Today the agent silently confabulates totals from the 3-of-50 chunks it sees. Fixing that is hours of work, independent of the long-horizon path.

## Middle — what actually changed since Jan 2026

| Surface | Shipped during this time | Relevance to us |
|---|---|---|
| Anthropic `code_execution_20260120` | One tool entry, hosted pandas/openpyxl/xlsxwriter, 1,550 free hr/org/month then $0.05/hr, **free** when bundled with web_search/web_fetch | We're already on Anthropic — cheapest seam |
| Vertex AI Agent Engine Code Execution | Billable Jan 28 2026, pandas==2.2.3 + openpyxl==3.1.5 pre-installed, $0.0864/vCPU-hr + $0.0090/GB-hr, 50/100 free | We're already on VAIS — fits Google-stack story |
| OpenAI Code Interpreter | xlsx native input in Responses API (Feb 2026), $0.03/session | Irrelevant unless we add OpenAI |
| Microsoft Copilot for Excel | Python-from-Copilot GA April 2026; Claude Opus 4.7 as model option | UX inspiration only — not API-accessible |
| VAIS itself | Renamed "Agent Search", added MCP server, dense reciprocal rank — **no SQL or aggregation** | What we ship today; unchanged on xlsx capability |
| Vertex Conversational Analytics API | Preview Feb 2026; full NL→SQL→answer over **BigQuery only** | Wrong shape — would force per-tenant BQ ETL for ad-hoc xlsx |
| DuckDB excel extension | Already mature; `INSTALL excel; LOAD excel; SELECT * FROM read_xlsx(...)` | Sidesteps all three sandboxes |

## The failure-mode picture (Angle A)

9 classes; ~70% of B2B asks fall into 4 of them — **whole-table aggregation**, **filter+rank**, **conditional-row-count / categorical breakdown**, **cross-row arithmetic** — all of which fail today, and the most damaging mode is failure-as-success (LLM sums the 3 chunks it sees and confidently reports "total"). The remaining 5 classes (chunk-boundary multi-row, cross-sheet joins, formula awareness, layout awareness, freshness/version) are smaller buckets but together cover the "weird real attachments" tail.

The list of capability gaps maps cleanly onto either DuckDB's SQL surface or any-of-three sandboxes: aggregation/filter/rank/breakdown/joins are SQL-trivial; formula-awareness and non-tabular-layout are weaker for DuckDB and stronger for pandas+openpyxl in a sandbox.

## The decision (z026 shape)

**Decision needed:** Which compute path do we adopt for "true analysis", and when?

**Options:**

| | A. DuckDB in our container | B. Anthropic code_execution | C. Vertex Agent Engine | D. Status quo + refuse |
|---|---|---|---|---|
| Lines of code | ~80 | ~50 | ~80 (ADK-side) | ~10 (system prompt) |
| Data tenancy | Stays in our container | Customer xlsx briefly on Anthropic infra | Customer xlsx on Google (already true via VAIS) | Stays put |
| Cost shape | Existing CPU/RAM | $0.05/hr/container after free tier | $0.0864/vCPU-hr after free tier | $0 |
| Capability ceiling | SQL — covers ENG-1346's 7 patterns + joins | Full pandas + openpyxl (formulas, layouts) | Same as B | None — refuses honestly |
| Agent-loop uniformity | Same loop, new tool | Different runtime for analytics | Different runtime; ADK handoff | No change |
| Lock-in | None | Anthropic API (already there) | Vertex (already there) | None |
| Risk | DuckDB struggles on non-tabular layouts | No internet → file handoff via Files API | File-handoff details unverified (wire-probe needed) | Feels small |

**Lean: A + D, in that order.**

- D first, this week: system-prompt change that catches "confident-wrong" before it ships any harm. ~10 LOC, hours of work, dominates the harm-reduction. Independent of which long-horizon path wins.
- A next, ~1-day spike → ship: DuckDB tool. SQL-only surface keeps tenancy in our container, dodges the Python-sandbox-on-someone-else's-infra question, and covers the 4 high-prevalence failure classes. Wire-test on the spike's existing fixtures + design-partner file.
- B/C deferred: only justified if we measure prevalence of formula-awareness (class 7) or non-tabular-layouts (class 8) high enough to need pandas. Do that with a JSONL-mining pass before committing.

**Why this lean:**
- D is free harm-reduction — confident-wrong is worse than honest refusal, and the fix is a system-prompt edit.
- A is strictly simpler than ENG-1346, strictly more capable than the status quo, and doesn't burn the customer-data-tenancy budget. SQL-as-the-LLM-output is also more debuggable than pandas — Conversational Analytics API's design (return SQL + result + summary) is the right pattern even at our scale.
- B/C are the right answer if-and-when the data says so. They're not the wrong answer; they're the un-measured answer.

**Price:**
- D: hours.
- A: 1-day spike + 1-2 days to ship (plus an entry in the tool registry, prompt design, smoke test).
- The deferred B/C cost is intellectual, not implementation: we have to commit to measuring prevalence (class 7+8) before the question can be re-opened sharply.

**Risk:**
- A's biggest risk is that customer attachments are non-tabular at higher rates than the spike fixtures. The mitigation is the JSONL-mining pass + the design-partner file run. Both are cheap.
- D's risk is that the agent's refusal logic over-fires (refuses lookups it could answer) — but the failure mode of over-refusal is much milder than confident-wrong.

**For you to weigh:**
- The tenancy question is the one place A vs B/C diverges in a way the data can't resolve. If our security/compliance posture wants spreadsheet bytes to stay in our container, A is the answer regardless of capability. If we're indifferent, the capability ceiling argues for B/C eventually.
- Measuring prevalence of class 7+8 (formulas, layouts) requires either mining the conversations JSONL store for real Effi xlsx sessions or running the taxonomy against the original design-partner file. Either is a half-day. Want me to dispatch that next?

## Bottom — open ends and follow-ups

### Wire-probes worth running before committing path A

1. DuckDB on the spike's `vendor_invoices.xlsx` and `multi_sheet_quarterly.xlsx`: confirm `INSTALL excel; LOAD excel; SELECT SUM(amount) WHERE status='Overdue'` works as predicted. ~1 hour.
2. DuckDB on the design-partner workbook (the file that triggered ENG-5822): does the SQL path handle whatever shape that workbook has? ~half day.
3. JSONL-mining pass: among real Effi sessions where the user attached an xlsx, what fraction asked aggregation/rank/breakdown/variance vs lookup vs other? Settles the prevalence question for paths A vs B/C. ~half day.

### Open questions the synthesis can't resolve

- Customer-data tenancy posture for path B/C — security/compliance owns this call.
- Whether class 7 (formulas) and class 8 (non-tabular layouts) bite at >30% of real customer files — depends on JSONL-mining or first-party data we don't have here.
- Whether "the user uploaded a workbook" and "talk to your warehouse" are one product surface or two — Conversational Analytics API serves the second; we're discussing the first; conflating them shapes the answer wrongly.

### What to do with ENG-1346

The 7 patterns are still right; the architecture (classifier → template-codegen → home-grown sandbox → interpreter) is dominated. Suggest: re-scope ENG-1346 to "validate 7 patterns against real customer questions", drop the architecture portion, and let path A or B/C deliver the actual capability. Net delta: keep the research, retire the build plan.

### Pointers to whiteboards

- `angle-a-failure-modes/whiteboard.md` — taxonomy + prevalence weighting
- `angle-b-vendor-soa/whiteboard.md` — vendor comparison + Anthropic deep-dive
- `angle-c-in-process/whiteboard.md` — DuckDB integration sketch + library ranking
- `angle-d-vais-vertex/whiteboard.md` — what changed in Google's stack since Jan 2026

### Friction zettels captured this round

None. All four whiteboards report no blockers — public docs sufficient, repo files readable, web search productive.
