# Angle A — Spreadsheet-analysis failure modes

What classes of analytical questions about B2B email-attachment spreadsheets cannot be answered by the system we just shipped (VAIS extracts each sheet as a Markdown-table chunk, retrieval is semantic over chunk text)? Anchored against `experiments/vais-xlsx-spike/FINDINGS.md` and the 7-pattern prior art in ENG-1346.

## Top — the click

**Semantic-chunk retrieval is a row-finder, not a sheet-reader.** It answers "show me the row about X" well, and it answers nothing else reliably. Every failure class below collapses to one underlying gap: the LLM sees a *subset* of rows (the ones whose text matched the query) and is asked to reason as if it saw the sheet. That illusion holds for lookup ("what's Octopod's invoice number?") and breaks for everything that requires seeing rows the query didn't name — totals, rankings, distributions, "which vendors are overdue", "did Q2 spend exceed Q1", "who's missing from the list". The spike's `OBSERVE` verdict on aggregation isn't one missing feature; it's the boundary of the entire shipped capability. The most-common B2B question shape — *grouped aggregation / filter+rank* — sits squarely on the wrong side of that boundary, so the gap between "we ship XLSX" and "we answer questions about XLSX" is wider than the spike's PASS-heavy table suggests.

A second, smaller observation: the spike's `_START_OF_TABLE_ ... _END_OF_TABLE_` markers and `heading_chain` give the LLM enough provenance to know it is looking at a table-fragment (not a complete sheet), but only if the agent's prompt teaches it to read those markers as "you have a sample, not the whole table". Today it doesn't; the model will confidently sum the 3 rows it sees and call that the total.

## Middle — the taxonomy

Eight failure classes. Each names the capability missing, gives a question grounded in the spike's actual fixtures (or an obvious extension of them), explains *why* semantic-chunk retrieval can't answer it, and a prevalence guess for B2B email-attachment usage.

| # | Class | Capability missing | Worked example | Why chunk-search fails | Prevalence |
|---|---|---|---|---|---|
| 1 | **Whole-table aggregation** | Sum/avg/count/min/max across all rows | "What's the total amount across all 50 invoices?" against `vendor_invoices.xlsx` | Retrieval returns the top-K most-similar chunks, not all of them. Even when the workbook fits in one chunk (small case), the LLM has no stable instruction to "you have all rows; compute over them" vs. "you have a sample". On the 5K-row workbook the chunk doesn't even start at the header. | **Very high** — directly the "Grouped Aggregation" + "Distribution Analysis" patterns from ENG-1346, half of the 7. |
| 2 | **Filter+rank ("which X has most/least Y")** | Sort + top-K + tie-break over rows the query doesn't name | "Which 5 vendors have the largest overdue balances?" or "Which department has the highest headcount?" against `multi_sheet_quarterly.xlsx` | The user's query carries no per-row text to match on (no specific vendor name, no specific department). Semantic search over `# Q3_Headcount` returns the sheet but the agent has no way to *order* what it sees, especially when it sees only some rows. | **Very high** — the "which X has most Y" shape is the canonical management question. ENG-1346 calls this out as "Grouped Aggregation". |
| 3 | **Conditional row count / categorical breakdown** | Count rows matching a predicate; group + percent | "How many invoices are Overdue?" / "What % of headcount is in Engineering?" | Retrieval surfaces *some* Overdue rows because the word matches; the count of returned chunks is not the count of matching rows. The agent will confuse "I see 4 Overdue rows" with "there are 4 Overdue rows". | **Very high** — every status report. ENG-1346 "Distribution Analysis". |
| 4 | **Cross-row arithmetic (variance / progress / pacing)** | Compute derived quantity from pairs/sets of rows, often vs. a baseline | "Did Q2 costs exceed Q1 revenue?" / "Are we behind plan if we sum the first three months and compare to the budget row?" / "Which projects are over budget by >10%?" | Requires reading the *whole* of two distinct row sets and computing on them. Even when both sheets land in one chunk (small workbook), nothing tells the agent it's safe to treat the chunk as authoritative. | **High** — ENG-1346's "Variance Analysis" + "Progress Tracking" + "Timeline Comparison" combine here. The "exceeded budget" question is one of the most common email-thread asks. |
| 5 | **Multi-row reasoning across chunk boundaries** | Reconstruct rows whose context spans two chunks; reason over a row that arrived without its header | "What's the amount on TXN-1004500?" against `large_transactions.xlsx` (5K rows; the spike *did* find the needle, but the chunk started mid-table without the header) | The chunk content is positional: `| TXN-1004500 | Reserve-004 | -2317.85 | EUR | ... |`. Without the header row, the agent has to *guess* which column is amount. Sometimes guesses right, sometimes inverts amount and account. Hard to detect when it goes wrong. | **Medium** — kicks in only on workbooks above the chunk-size threshold; rare for a 50-row invoice list, real for transaction logs and large CRM exports. |
| 6 | **Joins across sheets / files** | Match rows across two tables on a shared key | "For each vendor in `Q1_Revenue`, what did we pay them in `large_transactions`?" / "Cross-reference the contact list with the invoice file — which contacts are also vendors?" | Each sheet is a separate chunk lineage. Retrieval can fetch both sides for *one* named entity, but iterating "for each row in A, look up in B" is N+1 retrieval calls the agent will not perform. | **Low–Medium** for single-attachment threads (one workbook, one question). **Higher** for the "I forwarded you the report and the budget" thread shape. Worth distinguishing single-file from multi-file analytical questions; the latter is rare-and-important. |
| 7 | **Formula awareness / what-the-cell-actually-shows** | Distinguish formula vs. value; respect the user's displayed view | "What does cell B7 show?" when B7 is `=SUM(B2:B6)` and the spike read with `data_only=False` would yield the formula text, not the result. Or: a financial model with a `% Variance` column whose formula references three other sheets. | The spike's caveats explicitly mark formula handling as untested. VAIS's openpyxl path returns *one* of {formula, last cached value} — and the agent has no way to know which it got, or whether the workbook author expects you to recompute on open. | **Low** for invoice/contact/transaction shapes. **Medium** for any "report" or "model" attachment — quarterly review decks, valuation models, capacity plans. The B2B segments where Effi will land design-partner attention skew toward this shape. |
| 8 | **Layout-awareness** (non-uniform sheets) | Recognize header blocks, summary rows, banded/merged cells, sub-tables, sheets that aren't a single rectangular table | A vendor-supplied invoice PDF-converted-to-XLSX with a header block (company info, address) above the line items. A KPI dashboard sheet with `Total: 1,234,567` in an arbitrary cell next to a chart. A merged-cell quarterly summary. | VAIS extracts everything as one Markdown table per sheet. The header block becomes phantom rows; the merged-cell summary becomes a row of mostly-empty pipes. The agent sees nonsense and either confabulates or fails politely. The spike's "out of scope" list flags exactly this shape. | **Medium–High** for vendor-supplied attachments (almost always non-uniform); **Low** for internally-generated reports. Real-world emails skew vendor-supplied. |
| 9 | **Freshness / version awareness** | Know whether two attachments named `Q3_budget.xlsx` differ, and which row the user means | "Did the Q3 number change between the version Sara sent Tuesday and Mark's revised version Friday?" | Retrieval returns chunks; the same row text from two different attachments looks identical. `heading_chain` carries sheet provenance but not file-version provenance in a form the agent reasons over. | **Medium** — common in finance/ops threads where revised attachments fly back and forth. Often invisible because the user phrases it as "the latest budget" and the system silently picks one. |

### Notes on prevalence weighting

Folding prevalence with the ENG-1346 7-pattern frame:

- Patterns 1–4 collapse onto failure classes 1–4 above and represent **~70% of business questions about tabular data** (ENG-1346's framing). All four sit on the failing side of the boundary today.
- Pattern 5 (Correlation) and Pattern 7 (Composite Scoring) live in failure class 4 (cross-row arithmetic) and are higher-end / less common.
- Pattern 6 (Progress Tracking) overlaps classes 4 and 6 (joins, when comparing actual vs. plan across two sheets).

So roughly: of the analytical questions a real B2B user will ask about an attached spreadsheet, **a strong majority fall in classes 1–4 (the aggregation/rank/breakdown/variance group), all of which fail today.** Classes 5–9 are smaller buckets but together cover the "weird real attachments" tail that hurts trust.

### What works today, for the record

These shapes do work, per the spike's PASS rows, and should be acknowledged so the synthesis layer doesn't oversell the gap:

- **Exact-row lookup** ("show me the row for Octopod Logistics") — works.
- **Needle-in-haystack** ("find serial number ZZX-9180-MARMALADE") — works, even at 5K rows.
- **Sheet identity** ("the Q3_Headcount sheet has data about departments") — works via `heading_chain`.
- **"Did this attachment mention X?"** at all — works as long as X is in the chunk text the LLM sees.

These are not nothing. The taxonomy isn't "VAIS is wrong"; it's "VAIS solved retrieval, not analysis, and the user's mental model conflates them."

## Bottom — open ends

### Dilemmas

- **D1 — Honest "I can't" vs. plausible-sounding wrong answer.** The most damaging failure isn't class 1 ("can't aggregate"); it's class 1 *answered as if it were a lookup* — agent sees 4 Overdue rows in the chunk, says "you have 4 overdue invoices", and the user trusts it. The fix shape is split: either (a) the agent learns to refuse aggregation questions on chunked retrieval and say so, or (b) we ship a real analytical path. Refusal is cheap and protects trust; it also makes the product feel small. This is a z026-shaped tradeoff for the synthesis layer.
- **D2 — How much of "spreadsheet analysis" is really table-in-email rather than attachment-XLSX?** A meaningful slice of B2B "spreadsheet" questions originate from tables pasted into email bodies or shared as Google Sheet links. The taxonomy here applies regardless, but the *retrieval path* for those is different (Gmail body extraction, Drive sync). Worth confirming the failure shape is the same before assuming an XLSX-shaped fix solves it.
- **D3 — Do we trust the LLM with a sample?** A philosophically separable question: when retrieval returns 4 of 50 invoice rows, can the LLM legitimately *estimate* totals if explicitly told the sample size? For some questions ("are most of these overdue?") a sampled estimate may be acceptable; for others ("what's the exact total?") it's harmful. The product surface for "estimate ok" vs. "exact required" doesn't exist today.

### Gaps in our knowledge

- **G1 — Real-prevalence data.** The 7-pattern weighting in ENG-1346 was inferred from one Claude session's worth of mock data; we have not measured what fraction of real Effi spreadsheet questions fall into each class. We could mine the conversation JSONL store to find out — explicitly *not* done in this round (Angle A is taxonomy, not measurement). Worth adding to a follow-up.
- **G2 — Attachment-shape distribution.** We don't know what fraction of email-attachment XLSXs are uniform-rectangular tables (where VAIS works well) vs. layout-weird (class 8). The fixtures in the spike are 100% uniform; reality almost certainly isn't. The single design-partner case that triggered this work would be one data point.
- **G3 — Formula prevalence.** Untested. ENG-1346 has no formula examples either. If the design-partner workbook has formulas, class 7 is suddenly load-bearing.
- **G4 — Multi-attachment thread frequency.** Class 6 (joins) prevalence depends entirely on this. We don't have a number.
- **G5 — Chunk-boundary frequency.** The spike found one workbook (5K rows) that crossed the boundary. We don't know VAIS's actual chunk-size policy or how often a "normal" B2B XLSX trips it.

### Things worth validating against real customer data we have but didn't check

- The conversations JSONL store (memory note `reference_effi_session_jsonls.md`) has full SDK transcripts of every Effi chat. A targeted query — sessions where the user attached an XLSX, what did they then ask? — would convert this taxonomy from theory to weighted-by-real-usage. The Angle A charter is taxonomy, so this stays out-of-scope here, but it's the highest-value single follow-up the synthesis layer could pull on before committing a path.
- The design-partner workbook that triggered ENG-5822/ENG-1439 in the first place. If we still have the file, running the 9-class taxonomy against it would tell us which classes actually bite for the live customer.

### Friction zettels

None captured this round — the angle was readable end-to-end against the spike + ENG-1346 + ENG-863 with no blockers.

### One thing the synthesis layer should not skip

The shipped capability is *trust-good* for the cases it covers and *trust-bad* for the cases it doesn't, because the failure mode (class 1 answered confidently) looks identical to success. Whatever path the synthesis picks, the cheap-and-immediate move is teaching the agent to recognize an aggregation/rank/breakdown question and either route it to a real analytical path or refuse with a specific reason. That's a system-prompt change, not a build, and it dominates the value of any longer-horizon investment until the longer-horizon thing actually ships.
