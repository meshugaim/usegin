# Angle C — In-process spreadsheet analysis: off-the-shelf options (2026)

## Top — the click

**The simplest viable path is DuckDB-on-xlsx behind an LLM tool-call.** DuckDB
1.2+ ships a first-party `excel` extension; `INSTALL excel; LOAD excel;` then
`SELECT * FROM read_xlsx('foo.xlsx', sheet='Sheet2')` is the entire surface
area. Wire it into AskEffi as **one Python tool**: `query_xlsx(gcs_uri, sql)`
that streams the file from GCS to a tmp path, runs DuckDB SQL, returns rows
+ schema as JSON. The LLM (Sonnet 4.5+ already in our agent loop) writes the
SQL — no homegrown classifier, no template library, no sandbox. We get
aggregation, filter+rank, joins, multi-sheet, and the 7 ENG-1346 patterns for
free, in one Python tool the size of `agent_api/file_search/`.

This is materially simpler than ENG-1346's homegrown 5-component plan and
strictly more capable: the LLM-writes-SQL path subsumes the templated-pandas
path, because every templated pandas pattern compiles to a SQL query the LLM
can write directly. Security comes from DuckDB's SQL-only surface (no
arbitrary Python eval) — we never need a Python sandbox if we never let the
LLM emit Python.

## Middle — the options

| # | Option | What it does | Integration cost | Ops/$ cost | Failure modes | Simplicity |
|---|---|---|---|---|---|---|
| 1 | **DuckDB + excel ext.** | SQL over xlsx/csv, multi-sheet, joins across sheets/files, in-process | ~80 LOC: one tool, one SQL prompt, GCS-to-tmp shim | $0 license; CPU/RAM in our existing Railway container | Float artifacts pass through; merged cells / non-tabular layouts confuse the reader; in-memory bound on huge files | **1 (best)** |
| 2 | **Polars `read_excel` + LLM-writes-Polars** | DataFrame ops via fastexcel/calamine engine | ~120 LOC; needs `arbitrary_python_eval` of Polars expressions | $0 license; same container | Same as DuckDB on extraction; **but** Polars expressions are Python — back to sandbox question | 3 |
| 3 | **Pandas + sandboxed exec (E2B/Modal)** | LLM emits arbitrary pandas, runs in remote sandbox | ~200+ LOC: file upload to sandbox, exec API, result marshalling | E2B ~$0.083/hr/sandbox; cold-start 80ms, warm reuse needed; new vendor | Sandbox flakes, network IO, file-size copy cost, vendor lock-in | 5 |
| 4 | **Claude code-execution tool (Anthropic-hosted)** | Files API upload → Claude runs pandas/openpyxl in Anthropic's sandbox | ~50 LOC: Files API + tool block; **but** requires direct Anthropic SDK for this tenant's calls | Free tool calls (token costs only); 1GB RAM / 5GB disk / no internet | Anthropic-hosted only — won't run on our self-hosted Vertex/Gemini path; tenant-isolation question for customer data | 2 (if we accept Anthropic-hosting) |
| 5 | **Vanna / LangChain SQL-Agent** | Text-to-SQL framework on top of DuckDB | ~150 LOC; framework drag, Vanna wants its own training corpus | $0 OSS; framework deps | Vanna's "train on your schema" loop is a maintenance burden for ad-hoc xlsx; LangChain agent loops wrap our existing agent loop awkwardly | 4 |
| 6 | **MCP Excel servers (haris-musa, negokaz)** | MCP tools for read/write/format Excel | ~30 LOC to mount; **but** these are read+write+format toolkits, not analytics — they expose `get_cell`, `set_formula`, not `aggregate` | $0 OSS | Wrong shape: granular cell-level tools, not an analytics surface; LLM ends up writing per-cell loops | 6 (worst fit) |
| 7 | **LlamaIndex PandasQueryEngine / pandasai** | Pre-built "ask your dataframe" wrappers | ~40 LOC | $0 OSS | LlamaIndex docs explicitly warn: "not recommended for production without heavy sandboxing" — uses `eval()` on LLM output | 7 (security smell) |

### Top option — DuckDB integration sketch

```python
# python-services/agent_api/spreadsheet/duckdb_query.py
import duckdb, tempfile
from google.cloud import storage

def query_xlsx(gcs_uri: str, sql: str) -> dict:
    """LLM-callable tool. SQL must reference table 'sheet' or read_xlsx(...) directly."""
    with tempfile.NamedTemporaryFile(suffix=".xlsx") as f:
        storage.Client().download_blob_to_file(gcs_uri, f)
        f.flush()
        con = duckdb.connect()
        con.execute("INSTALL excel; LOAD excel;")
        # Two-step: first list sheets so the LLM can target one
        sheets = con.execute(
            f"SELECT * FROM read_xlsx_metadata('{f.name}')"
        ).fetchall()
        # Substitute placeholder filename if the LLM used :file
        sql = sql.replace(":file", f"'{f.name}'")
        rows = con.execute(sql).fetchdf()
        return {"sheets": sheets, "columns": list(rows.columns),
                "rows": rows.head(500).to_dict("records"),
                "row_count": len(rows)}
```

Tool prompt to the agent: *"You have `query_xlsx(gcs_uri, sql)`. The xlsx is
exposed as `read_xlsx(:file, sheet='<name>')`. Available sheets are listed
in the first response. Write SQL. Return at most 500 rows."*

That's the whole thing. Two-shot interaction (list sheets → write SQL) covers
the multi-sheet case from the VAIS spike. Joins across sheets:
`SELECT a.*, b.amount FROM read_xlsx(:file, sheet='Invoices') a JOIN
read_xlsx(:file, sheet='Vendors') b USING (vendor_id)`. The 7 ENG-1346
patterns are all expressible in SQL the model already writes well.

### Runner-up — Claude code-execution tool

If the team is willing to route the analytics tool-call to Anthropic's
code-execution sandbox specifically (rather than our normal Vertex path),
this is **arguably even simpler**: ~50 lines, zero sandbox infra to run,
pandas+openpyxl pre-installed, 1GB RAM. The cost: it's Anthropic-hosted
sandbox with no internet, so the file has to be uploaded via Files API and
results piped back through tool output. For AskEffi's customer-data
isolation story this is a non-trivial tenancy question — every customer's
xlsx briefly lives on Anthropic infrastructure. DuckDB-in-our-container
sidesteps that. If the tenancy story is OK, this is a 1-day spike.

### Why not the rest, briefly

- **Polars** is a peer to DuckDB on extraction speed (both use calamine
  under the hood) but expressions are Python — that drags us back into
  "do we sandbox Python?" DuckDB's SQL-only surface is the simplification.
- **Pandas + E2B/Modal** is the ENG-1346 "Rung 6" plan with a vendor
  instead of homegrown. Better than building it, but still strictly more
  ops than DuckDB if SQL covers the queries.
- **Vanna / LangChain** add framework debt — Vanna's training-corpus model
  fits a fixed warehouse, not "user just attached a workbook 30s ago".
- **MCP Excel servers** are the wrong shape (cell-level read/write, not
  analytics).
- **LlamaIndex PandasQueryEngine / pandasai** are insecure-by-default
  (LLM-emitted-Python via `eval`); LlamaIndex's own docs say so.

## Bottom — open ends

**What I didn't verify:**
- DuckDB excel extension's behavior on the same edge cases the VAIS
  spike found (merged cells, embedded charts, non-tabular layouts, very
  sparse workbooks). The spike's 5K-row case was tabular; if customer
  spreadsheets are 30%+ non-tabular, the SQL story degrades and the
  Pandas-in-sandbox story gets relatively better.
- DuckDB's xlsx file-size ceiling. Public docs are silent on it.
  ENG-1346 left "very large datasets" as an open question; same here
  for the SQL path.
- Whether `read_xlsx_metadata(...)` exists exactly as I wrote it — it's
  in newer extension builds but I didn't run it locally. Verify on the
  spike.
- Formula handling: DuckDB extension defaults read computed values
  (the same place openpyxl `data_only=True` gets to). Untested by me;
  ENG-1346's mock data was static.
- Multi-file joins (xlsx + csv + a Supabase table) work in DuckDB
  trivially via attached databases — but I haven't sketched how
  AskEffi's project-scoped Supabase access plays with that.

**What would change the ranking:**
- If the tenancy/data-handling cost of Anthropic-hosted code-execution
  is acceptable for customer xlsx, option 4 leapfrogs option 1: less
  code to maintain, no DuckDB extension to track.
- If we discover most customer "spreadsheet questions" are actually
  *non*-tabular workbook layouts (header blocks, summary rows, multi-
  table sheets), DuckDB-only will struggle and we'll want pandas with
  layout-detection. The VAIS spike already flagged this in scope, but
  didn't measure it on real customer files.
- If aggregation on huge files (10–100MB xlsx) is in scope, DuckDB's
  in-memory model may push us toward streaming or convert-to-parquet-
  on-ingest, which is a real architecture choice (probably orthogonal
  to which library we pick).

**Dilemma (z026-shaped):** *the analytics surface and the agent's tool
loop are the same surface*. Picking DuckDB means the LLM writes SQL
inside our existing tool-loop; picking Claude code-execution means the
analytics tool-call lives in a different runtime than the rest of our
tools (which currently run in our Python service). The "uniformity of
the agent loop" and "least new infra" points argue for DuckDB; the
"least code we own" point argues for Claude code-execution. The
synthesizer should pick.

**Friction zettel candidate:** the DuckDB docs site at
duckdb.org/docs/extensions/excel returns a redirect-only page to
WebFetch — twice. Real content is at `/docs/current/core_extensions/
excel.html` and `/docs/stable/core_extensions/excel.html`, but the
canonical short URL doesn't redirect server-side for the fetcher.
Worth a small zettel on "WebFetch lands on docs landing pages, not
the documentation itself; reach for WebSearch first".

---

## Sources

- [DuckDB Excel Extension: How to Read & Import XLSX Files (MotherDuck blog)](https://motherduck.com/blog/duckdb-excel-extension/)
- [Excel Import — DuckDB current docs](https://duckdb.org/docs/current/guides/file_formats/excel_import)
- [Where's the read_excel() function in DuckDB? (Reid, Medium)](https://medium.com/data-science-collective/wheres-the-read-excel-function-in-duckdb-d76bab1e2b85)
- [duckdb/duckdb-excel (GitHub)](https://github.com/duckdb/duckdb-excel)
- [Polars `read_excel` reference](https://docs.pola.rs/py-polars/html/reference/api/polars.read_excel.html)
- [Polars Excel user guide](https://docs.pola.rs/user-guide/io/excel/)
- [Anthropic Code execution tool docs](https://docs.claude.com/en/docs/agents-and-tools/tool-use/code-execution-tool)
- [E2B code-interpreter (PyPI)](https://pypi.org/project/e2b-code-interpreter/)
- [E2B / Cloud for AI Agents (e2b.dev)](https://e2b.dev/)
- [Vanna AI (GitHub)](https://github.com/vanna-ai/vanna)
- [LangChain SQL agent + DuckDB tutorial (MotherDuck)](https://motherduck.com/blog/langchain-sql-agent-duckdb-motherduck/)
- [excel-mcp-server, haris-musa (GitHub)](https://github.com/haris-musa/excel-mcp-server)
- [excel-mcp-server, negokaz (GitHub)](https://github.com/negokaz/excel-mcp-server)
- [LlamaIndex PandasQueryEngine docs](https://docs.llamaindex.ai/en/stable/examples/query_engine/pandas_query_engine/)
- [Anthropic xlsx skill](https://claude-plugins.dev/skills/@anthropics/skills/xlsx)
- AskEffi internal: `experiments/vais-xlsx-spike/FINDINGS.md`, Linear ENG-1346
