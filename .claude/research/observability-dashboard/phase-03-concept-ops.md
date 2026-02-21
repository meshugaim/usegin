# Phase 03 — Ops-Focused Observability Dashboard Concept

> Design date: 2026-02-21
> Perspective: SRE/ops — paged at 2am, needs to answer "is the system healthy?" in under 10 seconds.
> Data sources: `agent_usage` + `turns` + `tool_observations` (FK chain, admin-only RLS)

---

## Design Philosophy

This dashboard exists to answer three questions, in order:

1. **Is the system healthy right now?** (< 5 seconds to answer)
2. **What is broken?** (< 30 seconds to identify the failing component)
3. **Why is it broken?** (< 5 minutes to get to root cause inputs/errors)

Everything that does not serve these three questions is decoration and must be cut. The ops person at 2am does not care about cost trends or token distributions. They care about error rates, latency spikes, and which tool is failing.

### Core Principles

- **Red means broken.** If nothing is red, go back to sleep. The entire dashboard should be scannable for red in a single glance.
- **Comparison is king.** A number without context is noise. Every metric shows "now vs. recent baseline" so deviations jump out.
- **Fewer pages, deeper drill-down.** Three pages, not five. The ops workflow is linear: health check -> broken thing -> root cause.
- **URL-encode everything.** Every filter state, every time range, every expanded row. Shareable links for incident handoffs.

---

## 1. Page Structure

Three pages, optimized for the ops workflow:

| Page | Purpose | When you use it |
|------|---------|-----------------|
| **Health** | System-wide golden signals. "Is anything on fire?" | First page load, every time. |
| **Tools** | Per-tool RED metrics grid. "Which tool is the problem?" | When Health page shows elevated errors or latency. |
| **Forensics** | Specific failing conversations and tool calls. "What exactly failed and why?" | When you know which tool/time window to investigate. |

This is NOT the same as the Phase 02 research recommendation of 4 pages (Overview / Conversations / Conversation Detail / Tools). That structure serves product analytics. This structure serves incident response. The difference:

- Product analytics: "How is the product performing over time?" (browsing, exploring)
- Ops: "Is something broken right now and what do I do about it?" (triaging, diagnosing)

We optimize for the ops path. Product analytics can be served later by the same data with different views.

---

## 2. Routes

```
/admin/observability                → redirects to /admin/observability/health
/admin/observability/health         → Health overview (golden signals)
/admin/observability/tools          → Per-tool RED grid
/admin/observability/tools/[tool]   → Single-tool deep dive (optional, can be inline)
/admin/observability/forensics      → Error investigation table with drill-down
/admin/observability/forensics/[id] → Single conversation trace view
```

**URL query params (global, all pages):**

```
?range=1h|6h|24h|7d|30d|custom
&from=2026-02-21T00:00:00Z     (only with range=custom)
&to=2026-02-21T06:00:00Z       (only with range=custom)
&project=<uuid>                  (optional, filters to single project)
&errors=all|only|none            (default: all)
```

**Additional params per page:**

- Tools: `&tool=semantic_search` (highlight/filter specific tool)
- Forensics: `&tool=semantic_search&sort=duration_ms&dir=desc`

---

## 3. Health Overview (`/admin/observability/health`)

### Purpose

Answer "Is the system healthy?" in one glance. If everything is green, the ops person closes the tab. If something is red, they click through to Tools or Forensics.

### Information Hierarchy

```
[Global Filter Bar]                                    [Last updated: 2:03 AM]
─────────────────────────────────────────────────────────────────────────────

[Status Banner]  DEGRADED — tool error rate 12.3% (threshold: 5%)
─────────────────────────────────────────────────────────────────────────────

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  ERROR RATE  │ │   P95 LAT    │ │   TRAFFIC    │ │  TOOL CALLS  │
│    4.2%      │ │   3.8s       │ │   847/hr     │ │   2,341/hr   │
│   ▲ +1.8pp   │ │   ▲ +0.9s    │ │   ▼ -12%     │ │   ▼ -8%      │
│  ~~~~~~~~    │ │  ~~~~~~~~    │ │  ~~~~~~~~    │ │  ~~~~~~~~    │
│  (sparkline) │ │  (sparkline) │ │  (sparkline) │ │  (sparkline) │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

[Error Rate + Traffic Over Time]          [Latency Distribution Over Time]
 Full-width line chart                     P50 (blue) / P95 (orange) lines
 Error rate (red area) overlaid            Threshold line at SLO boundary
 on traffic volume (gray area)             Annotations for deploy events

┌─────────────────────────────────┐  ┌────────────────────────────────┐
│  WORST TOOLS (by error rate)    │  │  SLOWEST TOOLS (by P95)        │
│                                 │  │                                │
│  1. execute_sql     23.1% err   │  │  1. semantic_search    6.8s    │
│  2. browse_emails    8.4% err   │  │  2. browse_files       4.2s   │
│  3. semantic_search  3.2% err   │  │  3. browse_emails      2.1s   │
│                                 │  │                                │
│  [View all tools →]             │  │  [View all tools →]            │
└─────────────────────────────────┘  └────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  RECENT ERRORS (last 10)                                            │
│                                                                     │
│  2:01 AM  execute_sql     "relation not found"       proj_abc  →   │
│  1:58 AM  semantic_search "timeout after 30s"        proj_def  →   │
│  1:52 AM  browse_emails   "authentication failed"    proj_ghi  →   │
│  ...                                                                │
│  [View all errors →]                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| # | Component | Data Source | Purpose |
|---|-----------|-------------|---------|
| 1 | **Status Banner** | Computed from KPIs vs. thresholds | Single-line system status. GREEN/YELLOW/RED. Only visible when degraded — absence means healthy. |
| 2 | **Error Rate Card** | `tool_observations WHERE error IS NOT NULL / total` | The #1 ops signal. Red background above 5% threshold. Delta vs. same hour yesterday. Sparkline (24h). |
| 3 | **P95 Latency Card** | `P95(agent_usage.duration_ms)` over window | Second most important. Orange above 5s threshold. Delta vs. same hour yesterday. Sparkline (24h). |
| 4 | **Traffic Card** | `COUNT(agent_usage)` per hour | Context for error rate. Dropping traffic can indicate upstream failures. Delta vs. same hour yesterday. |
| 5 | **Tool Call Volume Card** | `COUNT(tool_observations)` per hour | Tool-specific throughput. Delta vs. same hour yesterday. |
| 6 | **Error Rate + Traffic Chart** | Time-bucketed counts from `agent_usage` + `tool_observations` | Full-width. Area chart with error rate (red) overlaid on traffic (gray). Makes error spikes visually obvious against traffic context. |
| 7 | **Latency Distribution Chart** | `agent_usage.duration_ms` bucketed over time | P50 and P95 as separate lines. When the gap between P50 and P95 widens, something is causing bimodal latency (likely one slow tool). |
| 8 | **Worst Tools Table** | `tool_observations` grouped by `tool_name`, error rate DESC | Top 3 tools by error rate. Clickable to Tools page filtered to that tool. Shows: tool name, error count, total calls, error rate. |
| 9 | **Slowest Tools Table** | `tool_observations` grouped by `tool_name`, P95 duration DESC | Top 3 tools by P95 latency. Clickable to Tools page. Shows: tool name, P95, P50, call count. |
| 10 | **Recent Errors Feed** | `tool_observations WHERE error IS NOT NULL ORDER BY created_at DESC LIMIT 10` | Live error feed. Each row: timestamp, tool name, truncated error message, project. Clickable to Forensics page filtered to that conversation. |

### Threshold Logic

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Tool error rate | < 2% | 2-5% | > 5% |
| P95 latency | < 3s | 3-6s | > 6s |
| Traffic (vs. baseline) | within 30% | 30-60% drop | > 60% drop |

These thresholds are hardcoded for v1. Configurable thresholds are a v2 feature.

### Time Comparisons

Every KPI card shows a delta comparison. The comparison period depends on the selected time range:

| Selected range | Compare to |
|---------------|------------|
| 1h | Same hour yesterday |
| 6h | Same 6h window yesterday |
| 24h | Previous 24h |
| 7d | Previous 7d |
| 30d | Previous 30d |

This is the single most important ops feature. An error rate of 4% means nothing without knowing yesterday's was 1.2%. The delta (+2.8pp) and the sparkline together tell the story.

---

## 4. Tools RED Grid (`/admin/observability/tools`)

### Purpose

Answer "Which tool is the problem?" using the RED method (Rate, Errors, Duration) applied per tool. This is a small-multiples grid where every tool gets identical treatment, making cross-tool comparison instant.

### Information Hierarchy

```
[Global Filter Bar]                                    [Last updated: 2:03 AM]
─────────────────────────────────────────────────────────────────────────────

┌─ TOOL HEALTH GRID ──────────────────────────────────────────────────────┐
│                                                                          │
│  Sort: [Error Rate ▼]  [Latency]  [Volume]  [Alphabetical]             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  semantic_search                                    [DEGRADED]  │    │
│  │                                                                  │    │
│  │  Rate        Errors       P50        P95        Error Rate      │    │
│  │  142/hr      18/hr        1.2s       6.8s       12.7%           │    │
│  │  ▼ -8%       ▲ +340%      ▲ +0.3s    ▲ +2.1s    ▲ +9.4pp       │    │
│  │                                                                  │    │
│  │  [~~ rate sparkline ~~]  [~~ error sparkline ~~]  [~~ P95 ~~]  │    │
│  │                                                                  │    │
│  │  [Expand: Recent errors ▼]                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  browse_emails                                        [HEALTHY] │    │
│  │                                                                  │    │
│  │  Rate        Errors       P50        P95        Error Rate      │    │
│  │  89/hr       1/hr         0.8s       2.1s       1.1%            │    │
│  │  ▲ +12%      — 0%         — +0.0s    ▼ -0.2s    — 0pp           │    │
│  │                                                                  │    │
│  │  [~~ rate sparkline ~~]  [~~ error sparkline ~~]  [~~ P95 ~~]  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  browse_files                                         [HEALTHY] │    │
│  │  ...                                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  execute_sql                                        [DEGRADED]  │    │
│  │  ...                                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

[Expanded: semantic_search recent errors]
┌──────────────────────────────────────────────────────────────────────────┐
│  Time       Duration   Error                        Input (truncated)    │
│  2:01 AM    6.8s       "timeout after 30s"          {query: "Q4 rev...  │
│  1:43 AM    6.2s       "timeout after 30s"          {query: "budget...  │
│  1:38 AM    0.4s       "store not found: abc123"    {query: "email ...  │
│  [View in Forensics →]                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Components

| # | Component | Data Source | Purpose |
|---|-----------|-------------|---------|
| 1 | **Sort Controls** | Client-side sort of tool cards | Sort grid by worst-first (error rate), slowest-first (P95), busiest-first (volume), or alphabetical. Default: error rate DESC. |
| 2 | **Tool Card (one per tool)** | `tool_observations` grouped by `tool_name` | The core unit. Each card shows the 5 RED metrics for one tool: call rate, error count, P50, P95, error rate. Each with delta vs. comparison period and sparkline. Status badge (HEALTHY/DEGRADED/DOWN) computed from thresholds. |
| 3 | **Expandable Error Detail** | `tool_observations WHERE tool_name = X AND error IS NOT NULL` | Expand a tool card to see its 10 most recent errors. Each row: timestamp, duration, truncated error text, truncated tool_input. Click-through to Forensics. |
| 4 | **Tool Sparklines (3 per card)** | Time-bucketed aggregates | Three mini sparklines per card: call rate over time, error rate over time, P95 over time. These show whether the problem is getting worse or recovering. |

### Per-Tool Metrics (the 5 RED columns)

| Metric | Computation | Why it matters |
|--------|------------|----------------|
| **Rate** | `COUNT(tool_observations WHERE tool_name = X) / hours` | Is this tool being used? Zero rate might mean an upstream issue. |
| **Errors** | `COUNT(tool_observations WHERE tool_name = X AND error IS NOT NULL) / hours` | Absolute error volume. |
| **P50** | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)` | Typical user experience. |
| **P95** | `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)` | Tail latency — the experience of 1 in 20 users. |
| **Error Rate** | `errors / rate * 100` | The percentage that matters most. A tool with 2 errors/hr at 200 calls/hr (1%) is fine. 2 errors/hr at 10 calls/hr (20%) is a crisis. |

### Per-Tool Thresholds

| Tool | P95 Yellow | P95 Red | Error Rate Yellow | Error Rate Red |
|------|-----------|---------|-------------------|----------------|
| `semantic_search` | 4s | 8s | 3% | 10% |
| `browse_emails` | 3s | 6s | 3% | 10% |
| `browse_files` | 3s | 6s | 3% | 10% |
| `execute_sql` | 2s | 5s | 5% | 15% |
| _(default)_ | 3s | 6s | 3% | 10% |

Known context: GFS queries run 6-8s for multi-store users (4 sequential Gemini calls). This is expected, not a bug. The `semantic_search` thresholds account for this.

### Sort Behavior

Default sort: **Error rate DESC** (worst tools float to top). This is the ops-critical default — the broken tool should always be the first card you see. Ties broken by P95 DESC.

Alternative sorts available via toggle buttons:
- **Latency** — P95 DESC (find the slow tool)
- **Volume** — Rate DESC (find the busiest tool)
- **Alphabetical** — tool_name ASC (for reference)

---

## 5. Forensics (`/admin/observability/forensics`)

### Purpose

Answer "Why is it broken?" by showing specific failing conversations, their tool calls, inputs, and error messages. This is where the ops person finds the exact error text to search in logs or Sentry.

### Information Hierarchy

```
[Global Filter Bar]  [Tool: semantic_search ▼]  [Errors only ✓]
─────────────────────────────────────────────────────────────────────────────

SHOWING: 47 conversations with tool errors in last 1h
─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────┐
│  CONVERSATIONS WITH ERRORS                                              │
│                                                                         │
│  Time      User     Project    Turns  Tool Errs  Duration  Status      │
│  ──────────────────────────────────────────────────────────────────     │
│  2:01 AM   alice    acme-corp  3      2          8.4s      ERROR   ▶   │
│  1:58 AM   bob      widgets    5      1          12.1s     ERROR   ▶   │
│  1:52 AM   carol    acme-corp  2      1          3.2s      ERROR   ▶   │
│  1:47 AM   alice    acme-corp  4      3          15.6s     ERROR   ▶   │
│  ...                                                                    │
│                                                                         │
│  [← Prev]  Page 1 of 5  [Next →]                                      │
└─────────────────────────────────────────────────────────────────────────┘

[Expanded row: conversation at 2:01 AM]
┌─────────────────────────────────────────────────────────────────────────┐
│  CONVERSATION TRACE  (agent_usage_id: abc-123)                          │
│  User: alice@acme.com | Project: acme-corp | Model: sonnet              │
│  Total duration: 8.4s | Turns: 3 | Cost: $0.0042                      │
│  Sentry: abc123def456  [Open in Sentry →]                              │
│                                                                         │
│  Turn 0 ─────────────────────────────────── 0ms ────── 2,100ms         │
│  │ "What were Q4 revenue numbers?"                                      │
│  │                                                                      │
│  │ ├─ semantic_search ────── 450ms ──────── 2,050ms   [ERROR]          │
│  │ │  Input: {query: "Q4 revenue numbers", project_id: "..."}          │
│  │ │  Error: "timeout after 30s"                                        │
│  │ │  Duration: 1,600ms                                                 │
│  │ │                                                                    │
│  │ └─ semantic_search ────── 2,100ms ───── 2,100ms    [OK]             │
│  │    Input: {query: "Q4 revenue", project_id: "..."}                  │
│  │    Results: 4 | Duration: 850ms                                      │
│  │                                                                      │
│  Turn 1 ─────────────────────────────────── 2,100ms ── 5,200ms         │
│  │ (continued response with tool results)                               │
│  │                                                                      │
│  │ └─ browse_files ──────── 2,300ms ───── 3,100ms     [OK]             │
│  │    Input: {path: "/financials/q4-summary.xlsx"}                      │
│  │    Results: 1 | Duration: 800ms                                      │
│  │                                                                      │
│  Turn 2 ─────────────────────────────────── 5,200ms ── 8,400ms         │
│  │ "Based on the documents, Q4 revenue was..."                          │
│  │ (no tool calls)                                                      │
│                                                                         │
│  [Copy trace ID]  [Open in Sentry →]  [View raw JSON]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| # | Component | Data Source | Purpose |
|---|-----------|-------------|---------|
| 1 | **Filter Bar (extended)** | URL params | Adds tool filter and error-only toggle to the global filters. Tool filter is a multi-select of all observed tool_name values. |
| 2 | **Results Summary** | Aggregated count | "Showing N conversations with errors in last Xh" — sets expectations and confirms filters are working. |
| 3 | **Conversations Table** | `agent_usage` LEFT JOIN `turns` LEFT JOIN `tool_observations` | Sortable table of conversations. Columns: timestamp, user (email or ID), project name, turn count, tool error count, total duration, status badge. Default sort: created_at DESC. |
| 4 | **Expandable Conversation Trace** | Lazy-loaded on expand: full JOIN chain for that agent_usage_id | The trace waterfall. Shows every turn as a horizontal segment, nested tool calls within each turn. Each tool call shows: tool_name, duration bar, status (OK/ERROR), truncated input, result_count or error text. Error tool calls highlighted in red. |
| 5 | **Tool Call Detail Panel** | `tool_observations` single row | Click a tool call in the trace to see full `tool_input` JSON (pretty-printed, scrollable), full error text (not truncated), result_count, duration_ms. |
| 6 | **Sentry Link** | `turns.sentry_trace_id` | Direct link to Sentry trace view. Shown per-turn (each turn has its own trace ID). |
| 7 | **Pagination** | Offset-based | 20 conversations per page. Offset + limit in URL params for shareability. |

### Conversation Table Columns

| Column | Source | Sort | Notes |
|--------|--------|------|-------|
| Time | `agent_usage.created_at` | Yes (default: DESC) | Formatted as relative ("2m ago") with full timestamp on hover. |
| User | `agent_usage.user_id` -> lookup | No | Show email if available, otherwise truncated UUID. |
| Project | `agent_usage.project_id` -> lookup | Yes | Project name. NULL = "Dashboard chat". |
| Turns | `agent_usage.num_turns` | Yes | Turn count. |
| Tool Errors | `COUNT(tool_observations WHERE error IS NOT NULL)` for that agent_usage_id | Yes | Number of failed tool calls. Red badge if > 0. |
| Duration | `agent_usage.duration_ms` | Yes | Formatted as "8.4s" or "1m 23s". Color-coded: green < 3s, yellow 3-6s, red > 6s. |
| Status | `agent_usage.is_error` | Yes | Badge: ERROR (red) or OK (green). |
| Expand | — | — | Chevron icon. Click to load trace waterfall. |

### Trace Waterfall Design

The expanded trace view is the forensic tool. It answers: "What sequence of events led to this error?"

**Structure:**
- Each turn is a horizontal lane (labeled "Turn 0", "Turn 1", etc.)
- Within each turn, tool calls are shown as nested bars
- Bar width is proportional to duration (relative to total conversation duration)
- Color: green = success, red = error, gray = no tool calls
- Clicking a tool call bar opens a detail panel below it showing full input/output

**Key detail for each tool call:**
- `tool_name` (bold)
- `duration_ms` (as formatted string)
- Status badge: OK (with result_count) or ERROR (with truncated error)
- `tool_input` (collapsed by default, expandable to full JSON)
- `error` text (full, not truncated, if present)
- Timestamp

**Turn metadata shown:**
- `turn_index`
- `text_preview` (first ~200 chars of assistant response)
- `thinking_preview` (if present, collapsed by default)
- `tool_call_count`
- `duration_ms`
- `sentry_trace_id` (as clickable Sentry link)

---

## 6. Forensics: Single Conversation Page (`/admin/observability/forensics/[id]`)

### Purpose

Full-page view of a single conversation trace. Used when the inline expansion is not enough (complex multi-turn conversations with many tool calls) or when sharing a direct link during incident response.

### Components

| # | Component | Data Source | Purpose |
|---|-----------|-------------|---------|
| 1 | **Conversation Header** | `agent_usage` row | Summary bar: user, project, model, total duration, total cost, turn count, is_error, auth_mode, created_at. |
| 2 | **Full Trace Waterfall** | All `turns` + `tool_observations` for this agent_usage_id | Same as the expandable version but full-width, with more room for detail. All tool calls expanded by default. |
| 3 | **Turn Detail Panels** | Per-turn data | Each turn shows: text_preview, thinking_preview, tool calls with full input/output, duration breakdown. |
| 4 | **Error Summary** | Aggregated from tool_observations | If any tool calls errored: highlighted section at top showing all errors with their inputs. This is the "incident context" block — copy-paste into a Slack thread. |
| 5 | **External Links** | Computed | "Open in Sentry" (per turn via sentry_trace_id), "View conversation" (if claude_session_id available, link to conversations table). |
| 6 | **Raw Data Toggle** | Full JSON | Toggle to see raw agent_usage + turns + tool_observations JSON. For the engineer who wants to write a custom query. |

---

## 7. Ops-Specific Features

### 7.1. Time Comparison (This Period vs. Baseline)

Every KPI card and every tool card shows a delta against a baseline period. This is the #1 feature that separates an ops dashboard from a product dashboard.

**Implementation:**

Each data query runs twice: once for the current window, once for the comparison window. The comparison window is always the same duration, shifted back by the appropriate amount.

```
Current: last 1h (now - 1h to now)
Compare: same hour yesterday (now - 25h to now - 24h)
```

The delta is shown as:
- Absolute change: "+1.8pp" (percentage points for rates), "+0.9s" (for latency)
- Direction arrow: up-arrow (red for errors/latency, green for traffic) or down-arrow (green for errors/latency, red for traffic)
- Color: red if the change is bad, green if good, gray if neutral (< 5% change)

**Inverted polarity:** Error rate going UP is bad (red arrow). Traffic going DOWN is bad (red arrow). Latency going UP is bad (red arrow). The color logic must account for which direction is "bad" per metric.

### 7.2. Status Banner with Threshold Evaluation

The Health page shows a status banner at the top that evaluates all golden signals against thresholds:

- **HEALTHY** (green, hidden by default) — all metrics within green thresholds
- **DEGRADED** (yellow) — any metric in yellow zone, none in red
- **CRITICAL** (red) — any metric in red zone

The banner shows which metric(s) triggered the alert state:
```
DEGRADED — tool error rate 12.3% (threshold: 5%) | P95 latency 7.2s (threshold: 6s)
```

This is the "page-glance" feature. You open the page, see red banner, know immediately what is wrong.

### 7.3. P95 vs. P50 Gap Detection

When the gap between P95 and P50 latency exceeds 3x, the latency chart highlights this region. A 3x+ gap means a subset of requests is dramatically slower than typical — usually one specific tool or one specific project.

Visual: the area between the P50 and P95 lines fills with a semi-transparent orange when the ratio exceeds 3x. This makes bimodal latency distributions jump out.

### 7.4. Error Clustering

On the Forensics page, errors are grouped by error message pattern (first 100 chars of the error text). This prevents the table from being a wall of identical errors.

Display: "timeout after 30s" (23 occurrences in last 1h) — click to expand and see individual instances.

### 7.5. Auto-Refresh

All pages auto-refresh every 30 seconds when the selected time range includes "now" (i.e., any non-custom range or a custom range whose `to` is empty/current).

Visual indicator: a subtle progress bar under the header that fills over 30 seconds, then resets on refresh. "Last updated: 2:03:45 AM" text updates on each refresh.

Manual refresh button always available.

### 7.6. Stale Data Warning

If the most recent `agent_usage.created_at` is older than expected for the current traffic level (e.g., no new data in 10+ minutes during business hours), show a warning banner:

```
WARNING — No new data in 14 minutes. Last conversation: 1:49 AM.
Possible causes: pipeline down, no traffic, or write failures.
```

### 7.7. Quick Copy for Incident Response

Every relevant identifier has a copy button:
- `agent_usage.id` (conversation ID)
- `turns.sentry_trace_id` (Sentry link)
- `tool_observations.error` (full error text)
- `tool_observations.tool_input` (full JSON)
- Page URL with all filter state (for sharing in Slack)

---

## 8. Global Filter Bar

Present on every page. Positioned below the sticky header, above all content.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [1h] [6h] [24h] [7d] [30d] [Custom ...]   │  Project: [All ▼]       │
│                                              │  Errors: [All ▼]        │
│                                              │  [Clear filters]        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Time range presets** are toggle buttons (not a dropdown). The most common ops ranges are 1h and 6h. Default: 1h.

**Project filter** is a dropdown populated from `SELECT DISTINCT project_id FROM agent_usage` joined with project names. Shows "All" by default.

**Error filter**: All / Errors only / Successes only. "Errors only" is the most common ops filter.

**Active filter indicator**: Badge count on the filter bar showing how many non-default filters are active. "Clear filters" resets to defaults.

All filter state is URL-encoded. Changing a filter updates the URL and triggers a re-fetch of all page data.

---

## 9. ASCII Wireframes

### 9.1. Health Page

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Admin    [Activity icon] Observability    [Health] [Tools] [Forensics]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  [1h] [6h] [24h] [7d] [30d]  │  Project: [All ▼]  Errors: [All ▼]  [Clear]│
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚠ DEGRADED — tool error rate 12.3% (threshold: 5%)          Updated 2:03a │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ ERROR RATE  │  │  P95 LAT    │  │  TRAFFIC    │  │ TOOL CALLS  │        │
│  │   4.2%      │  │   3.8s      │  │   847/hr    │  │  2,341/hr   │        │
│  │  ▲ +1.8pp   │  │  ▲ +0.9s    │  │  ▼ -12%     │  │  ▼ -8%      │        │
│  │  ~~~~~~~~~  │  │  ~~~~~~~~~  │  │  ~~~~~~~~~  │  │  ~~~~~~~~~  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  Error Rate & Traffic                                             │      │
│  │      ╭──╮                                                         │      │
│  │  ───╯    ╰────╮    ╭──────  ← error rate (red)                   │      │
│  │               ╰────╯                                              │      │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← traffic volume (gray)            │      │
│  │  12am    3am    6am    9am    12pm    3pm    6pm    9pm    now    │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  Latency (P50 / P95)                                              │      │
│  │                    ╭──╮                                            │      │
│  │  ─────────────────╯    ╰──────  ← P95 (orange)                   │      │
│  │  ─────────────────────────────  ← P50 (blue, steady)             │      │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  ← 6s threshold (dashed red)       │      │
│  │  12am    3am    6am    9am    12pm    3pm    6pm    9pm    now    │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐          │
│  │  Worst Tools (error rate)   │  │  Slowest Tools (P95)         │          │
│  │                             │  │                              │          │
│  │  1. execute_sql     23.1%   │  │  1. semantic_search   6.8s   │          │
│  │  2. browse_emails    8.4%   │  │  2. browse_files      4.2s   │          │
│  │  3. semantic_search  3.2%   │  │  3. browse_emails     2.1s   │          │
│  │                             │  │                              │          │
│  │  [View all tools →]         │  │  [View all tools →]          │          │
│  └─────────────────────────────┘  └──────────────────────────────┘          │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  Recent Errors                                                    │      │
│  │                                                                   │      │
│  │  2:01a  execute_sql      "relation 'foo' not found"    acme  →   │      │
│  │  1:58a  semantic_search  "timeout after 30s"           widg  →   │      │
│  │  1:52a  browse_emails    "auth failed"                 acme  →   │      │
│  │  1:47a  semantic_search  "timeout after 30s"           acme  →   │      │
│  │  1:41a  execute_sql      "permission denied for..."    beta  →   │      │
│  │                                                                   │      │
│  │  [View all errors →]                                              │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2. Tools RED Grid

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Admin    [Activity icon] Observability    [Health] [Tools] [Forensics]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  [1h] [6h] [24h] [7d] [30d]  │  Project: [All ▼]  Errors: [All ▼]  [Clear]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Sort: [●Error Rate] [○Latency] [○Volume] [○A-Z]                           │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  semantic_search                                      [DEGRADED] │      │
│  │                                                                   │      │
│  │  Rate         Errors       P50         P95        Error Rate     │      │
│  │  142/hr       18/hr        1.2s        6.8s       12.7%          │      │
│  │  ▼-8%         ▲+340%       ▲+0.3s      ▲+2.1s     ▲+9.4pp       │      │
│  │                                                                   │      │
│  │  rate ~~~~~~~~   errors ~~~~~~~~   P95 ~~~~~~~~                  │      │
│  │                                                                   │      │
│  │  ▶ Recent errors (18)                                            │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  execute_sql                                          [DEGRADED] │      │
│  │                                                                   │      │
│  │  Rate         Errors       P50         P95        Error Rate     │      │
│  │  34/hr        8/hr         0.3s        1.8s       23.5%          │      │
│  │  ▲+5%         ▲+700%       —           ▲+0.6s     ▲+21pp         │      │
│  │                                                                   │      │
│  │  rate ~~~~~~~~   errors ~~~~~~~~   P95 ~~~~~~~~                  │      │
│  │                                                                   │      │
│  │  ▶ Recent errors (8)                                             │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  browse_emails                                         [HEALTHY] │      │
│  │                                                                   │      │
│  │  Rate         Errors       P50         P95        Error Rate     │      │
│  │  89/hr        1/hr         0.8s        2.1s       1.1%           │      │
│  │  ▲+12%        —            —           ▼-0.2s     —              │      │
│  │                                                                   │      │
│  │  rate ~~~~~~~~   errors ~~~~~~~~   P95 ~~~~~~~~                  │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  browse_files                                          [HEALTHY] │      │
│  │                                                                   │      │
│  │  Rate         Errors       P50         P95        Error Rate     │      │
│  │  67/hr        0/hr         0.9s        3.1s       0.0%           │      │
│  │  ▲+3%         —            —           ▼-0.4s     —              │      │
│  │                                                                   │      │
│  │  rate ~~~~~~~~   errors ~~~~~~~~   P95 ~~~~~~~~                  │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

[Expanded: semantic_search recent errors]
┌───────────────────────────────────────────────────────────────────────────┐
│  Time      Duration  Error                        Input (truncated)      │
│  ─────────────────────────────────────────────────────────────────────   │
│  2:01a     6.8s      timeout after 30s            {query:"Q4 rev..."}   │
│  1:43a     6.2s      timeout after 30s            {query:"budget..."}   │
│  1:38a     0.4s      store not found: abc123      {query:"email ..."}   │
│  1:22a     5.9s      timeout after 30s            {query:"projec..."}   │
│  ...                                                                     │
│  [View all in Forensics →]                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

### 9.3. Forensics Page

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Admin    [Activity icon] Observability    [Health] [Tools] [Forensics]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  [1h] [6h] [24h] [7d] [30d]  │  Project: [All ▼]  Tool: [All ▼]          │
│                                │  Errors: [●Errors only]     [Clear]        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  47 conversations with tool errors in last 1h                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Time ▼   User       Project     Turns  Errs  Duration   Status  │     │
│  │  ──────────────────────────────────────────────────────────────── │     │
│  │ ▼2:01a    alice      acme-corp   3      2     8.4s       ERROR   │     │
│  │  ──────────────────────────────────────────────────────────────── │     │
│  │  │ TRACE  agent_usage: abc-123        Sentry: def456 [Open →]    │     │
│  │  │ Model: sonnet  Cost: $0.0042  Auth: oauth                     │     │
│  │  │                                                                │     │
│  │  │ Turn 0 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░  2,100ms       │     │
│  │  │ │ "What were Q4 revenue numbers?"                              │     │
│  │  │ │                                                              │     │
│  │  │ │ ├ semantic_search ▬▬▬▬▬▬▬▬▬▓▓▓  1,600ms  [ERROR]          │     │
│  │  │ │ │ Error: "timeout after 30s"                                 │     │
│  │  │ │ │ Input: {query: "Q4 revenue numbers"} [Copy] [Expand]      │     │
│  │  │ │ │                                                            │     │
│  │  │ │ └ semantic_search ▬▬▬▬▬░  850ms  [OK] 4 results            │     │
│  │  │ │   Input: {query: "Q4 revenue"} [Copy] [Expand]              │     │
│  │  │ │                                                              │     │
│  │  │ Turn 1 ░░░░░░░░░░░░░░░░░░░░▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  3,100ms       │     │
│  │  │ │                                                              │     │
│  │  │ │ └ browse_files ▬▬▬▬░  800ms  [OK] 1 result                 │     │
│  │  │ │                                                              │     │
│  │  │ Turn 2 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▬▬▬▬▬▬  3,200ms       │     │
│  │  │   "Based on the documents..."  (no tools)                      │     │
│  │  │                                                                │     │
│  │  │ [Copy trace ID]  [Open full page →]  [View raw JSON]          │     │
│  │  ──────────────────────────────────────────────────────────────── │     │
│  │  1:58a    bob        widgets     5      1     12.1s      ERROR   │     │
│  │  1:52a    carol      acme-corp   2      1     3.2s       ERROR   │     │
│  │  1:47a    alice      acme-corp   4      3     15.6s      ERROR   │     │
│  │  1:41a    dave       beta-inc    1      1     2.8s       ERROR   │     │
│  │  ...                                                              │     │
│  │                                                                   │     │
│  │  [← Prev]           Page 1 of 3           [Next →]               │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.4. Single Conversation Page (`/admin/observability/forensics/[id]`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Forensics    Conversation abc-123                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  SUMMARY                                                           │     │
│  │                                                                    │     │
│  │  User: alice@acme.com [Copy]      Project: acme-corp               │     │
│  │  Model: sonnet                    Auth: oauth                      │     │
│  │  Duration: 8.4s                   Cost: $0.0042                    │     │
│  │  Turns: 3                         Tool calls: 3 (2 errors)        │     │
│  │  Started: 2026-02-21 02:01:14Z    Sentry: def456 [Open →]        │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  ERRORS (2)                                                [Copy all]│    │
│  │                                                                    │     │
│  │  1. semantic_search — "timeout after 30s"                          │     │
│  │     Turn 0, seq 0 | Duration: 1,600ms                             │     │
│  │     Input: {query: "Q4 revenue numbers", project_id: "p-123"}     │     │
│  │                                                                    │     │
│  │  (Remaining tool calls succeeded)                                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  TRACE WATERFALL                                                   │     │
│  │                                                                    │     │
│  │  0s        2s        4s        6s        8s                       │     │
│  │  |─────────|─────────|─────────|─────────|                        │     │
│  │                                                                    │     │
│  │  Turn 0 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░  2,100ms           │     │
│  │  │                                                                │     │
│  │  │ semantic_search ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  1,600ms  ERROR            │     │
│  │  │ ┌──────────────────────────────────────────────────────┐       │     │
│  │  │ │ Error: timeout after 30s                             │       │     │
│  │  │ │ Input: {                                             │       │     │
│  │  │ │   "query": "Q4 revenue numbers",                    │       │     │
│  │  │ │   "project_id": "p-123"                             │       │     │
│  │  │ │ }                                                    │       │     │
│  │  │ └──────────────────────────────────────────────────────┘       │     │
│  │  │                                                                │     │
│  │  │ semantic_search ▬▬▬▬▬▬▬▬▬░  850ms  OK (4 results)            │     │
│  │  │ ▶ Input/Output...                                              │     │
│  │  │                                                                │     │
│  │  Turn 1 ░░░░░░░░░░░░░░░░░░░░▬▬▬▬▬▬▬▬▬▬▬▬▬▬  3,100ms           │     │
│  │  │                                                                │     │
│  │  │ browse_files ▬▬▬▬▬▬░  800ms  OK (1 result)                   │     │
│  │  │ ▶ Input/Output...                                              │     │
│  │  │                                                                │     │
│  │  Turn 2 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░▬▬▬▬▬▬▬  3,200ms           │     │
│  │    "Based on the documents, Q4 revenue was..."                    │     │
│  │    (no tool calls)                                                │     │
│  │                                                                    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  [Copy trace ID]  [View raw JSON ▶]                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Component Inventory (Complete)

### Shared Components (all pages)

| Component | File (suggested) | Purpose |
|-----------|-----------------|---------|
| `ObservabilityHeader` | `components/admin/observability/header.tsx` | Sticky header with back nav, page title, tab navigation (Health/Tools/Forensics). |
| `FilterBar` | `components/admin/observability/filter-bar.tsx` | Time range toggles, project dropdown, error filter. URL-synced. |
| `TimeRangeToggle` | `components/admin/observability/time-range-toggle.tsx` | Button group: 1h, 6h, 24h, 7d, 30d, Custom. |
| `StatusBadge` | `components/admin/observability/status-badge.tsx` | Colored pill: HEALTHY (green), DEGRADED (yellow), ERROR (red), OK (green outline). |
| `CopyButton` | `components/admin/observability/copy-button.tsx` | Click-to-copy with toast confirmation. Used everywhere. |
| `LastUpdated` | `components/admin/observability/last-updated.tsx` | "Updated 2:03 AM" with auto-refresh progress bar. |

### Health Page Components

| Component | File | Purpose |
|-----------|------|---------|
| `StatusBanner` | `components/admin/observability/health/status-banner.tsx` | Full-width alert bar. Hidden when healthy. Shows which metrics are degraded/critical. |
| `KpiCard` | `components/admin/observability/health/kpi-card.tsx` | Reusable: large number, label, delta, sparkline, color accent. Used 4x on health page. |
| `ErrorTrafficChart` | `components/admin/observability/health/error-traffic-chart.tsx` | recharts ComposedChart: area (traffic) + line (error rate). Full-width. |
| `LatencyChart` | `components/admin/observability/health/latency-chart.tsx` | recharts LineChart: P50 + P95 lines + threshold reference line. Full-width. |
| `WorstToolsTable` | `components/admin/observability/health/worst-tools-table.tsx` | Top 3 tools by error rate. Minimal table with click-through. |
| `SlowestToolsTable` | `components/admin/observability/health/slowest-tools-table.tsx` | Top 3 tools by P95. Minimal table with click-through. |
| `RecentErrorsFeed` | `components/admin/observability/health/recent-errors-feed.tsx` | Last 10 tool errors. Timestamp + tool + error + project. Click-through to Forensics. |

### Tools Page Components

| Component | File | Purpose |
|-----------|------|---------|
| `SortControls` | `components/admin/observability/tools/sort-controls.tsx` | Radio button group: Error Rate, Latency, Volume, A-Z. |
| `ToolCard` | `components/admin/observability/tools/tool-card.tsx` | Per-tool RED card. 5 metrics, each with delta + sparkline. Expandable error detail. Status badge. |
| `ToolSparkline` | `components/admin/observability/tools/tool-sparkline.tsx` | Tiny recharts LineChart, no axes. Used 3x per ToolCard. |
| `ToolErrorDetail` | `components/admin/observability/tools/tool-error-detail.tsx` | Expandable section: recent errors for one tool. Table of timestamp, duration, error, input. |

### Forensics Page Components

| Component | File | Purpose |
|-----------|------|---------|
| `ForensicsFilterBar` | `components/admin/observability/forensics/filter-bar.tsx` | Extends base FilterBar with tool multi-select. |
| `ResultsSummary` | `components/admin/observability/forensics/results-summary.tsx` | "47 conversations with tool errors in last 1h" |
| `ConversationsTable` | `components/admin/observability/forensics/conversations-table.tsx` | Sortable table with expandable rows. Columns: time, user, project, turns, errors, duration, status. |
| `ConversationTrace` | `components/admin/observability/forensics/conversation-trace.tsx` | Expandable inline trace. Turn lanes with nested tool call bars. |
| `ToolCallBar` | `components/admin/observability/forensics/tool-call-bar.tsx` | Single tool call in the waterfall. Bar width = duration. Color = status. Expandable input/output. |
| `ToolCallDetail` | `components/admin/observability/forensics/tool-call-detail.tsx` | Expanded panel: full tool_input JSON, full error text, duration, result_count. Copy buttons. |
| `SentryLink` | `components/admin/observability/forensics/sentry-link.tsx` | External link to Sentry trace. Uses sentry_trace_id. |
| `ConversationHeader` | `components/admin/observability/forensics/conversation-header.tsx` | Summary bar for single conversation page: user, project, model, cost, duration, auth_mode. |
| `ErrorSummaryBlock` | `components/admin/observability/forensics/error-summary-block.tsx` | Highlighted block listing all errors in a conversation. Copy-paste friendly for incident channels. |
| `RawDataToggle` | `components/admin/observability/forensics/raw-data-toggle.tsx` | Toggle to show raw JSON for the conversation (agent_usage + turns + tool_observations). |

---

## 11. Data Queries (Key SQL Patterns)

These are the core queries the server actions will need. All go through the admin Supabase client (AuthClient with RLS — admin-only SELECT).

### Health Page Queries

```sql
-- KPI: Error rate (tool level)
SELECT
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  COUNT(*) AS total_count,
  ROUND(COUNT(*) FILTER (WHERE error IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS error_rate
FROM tool_observations
WHERE created_at >= :window_start AND created_at < :window_end;

-- KPI: P95 latency (conversation level)
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
FROM agent_usage
WHERE created_at >= :window_start AND created_at < :window_end
  AND duration_ms IS NOT NULL;

-- KPI: Traffic (conversations per hour)
SELECT COUNT(*) AS total,
  COUNT(*) / GREATEST(EXTRACT(EPOCH FROM (:window_end - :window_start)) / 3600, 1) AS per_hour
FROM agent_usage
WHERE created_at >= :window_start AND created_at < :window_end;

-- Time-bucketed error rate + traffic for chart
SELECT
  date_trunc('hour', created_at) AS bucket,  -- or 5min/15min depending on range
  COUNT(*) AS traffic,
  COUNT(*) FILTER (WHERE is_error) AS errors
FROM agent_usage
WHERE created_at >= :window_start AND created_at < :window_end
GROUP BY bucket ORDER BY bucket;

-- Worst tools by error rate
SELECT
  tool_name,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  ROUND(COUNT(*) FILTER (WHERE error IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS error_rate,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM tool_observations
WHERE created_at >= :window_start AND created_at < :window_end
GROUP BY tool_name
ORDER BY error_rate DESC
LIMIT 3;

-- Recent errors feed
SELECT
  to2.created_at, to2.tool_name, to2.error, to2.duration_ms,
  to2.tool_input, au.project_id, au.id AS agent_usage_id
FROM tool_observations to2
JOIN turns t ON t.id = to2.turn_id
JOIN agent_usage au ON au.id = t.agent_usage_id
WHERE to2.error IS NOT NULL
  AND to2.created_at >= :window_start AND to2.created_at < :window_end
ORDER BY to2.created_at DESC
LIMIT 10;
```

### Tools Page Queries

```sql
-- Per-tool RED metrics
SELECT
  tool_name,
  COUNT(*) AS total_calls,
  COUNT(*) / GREATEST(EXTRACT(EPOCH FROM (:window_end - :window_start)) / 3600, 1) AS calls_per_hour,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  ROUND(COUNT(*) FILTER (WHERE error IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS error_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM tool_observations
WHERE created_at >= :window_start AND created_at < :window_end
GROUP BY tool_name;

-- Per-tool time-bucketed sparkline data
SELECT
  tool_name,
  date_trunc('hour', created_at) AS bucket,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS errors,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM tool_observations
WHERE created_at >= :window_start AND created_at < :window_end
GROUP BY tool_name, bucket
ORDER BY tool_name, bucket;
```

### Forensics Page Queries

```sql
-- Conversations with error counts
SELECT
  au.id, au.created_at, au.user_id, au.project_id,
  au.num_turns, au.duration_ms, au.is_error, au.model, au.cost_usd, au.auth_mode,
  COUNT(to2.id) FILTER (WHERE to2.error IS NOT NULL) AS tool_error_count
FROM agent_usage au
LEFT JOIN turns t ON t.agent_usage_id = au.id
LEFT JOIN tool_observations to2 ON to2.turn_id = t.id
WHERE au.created_at >= :window_start AND au.created_at < :window_end
  AND (:errors_only = false OR au.is_error = true OR EXISTS (
    SELECT 1 FROM tool_observations to3
    JOIN turns t2 ON t2.id = to3.turn_id
    WHERE t2.agent_usage_id = au.id AND to3.error IS NOT NULL
  ))
GROUP BY au.id
ORDER BY au.created_at DESC
LIMIT 20 OFFSET :offset;

-- Single conversation trace (lazy-loaded on expand)
SELECT
  t.id AS turn_id, t.turn_index, t.text_preview, t.thinking_preview,
  t.tool_call_count, t.duration_ms AS turn_duration_ms, t.sentry_trace_id,
  to2.id AS tool_obs_id, to2.sequence, to2.tool_name, to2.tool_input,
  to2.result_count, to2.error, to2.duration_ms AS tool_duration_ms
FROM turns t
LEFT JOIN tool_observations to2 ON to2.turn_id = t.id
WHERE t.agent_usage_id = :agent_usage_id
ORDER BY t.turn_index, to2.sequence;
```

---

## 12. What This Design Deliberately Excludes

These are features from the Phase 02 research that are intentionally deferred because they serve product analytics, not ops:

| Feature | Why deferred |
|---------|-------------|
| Cost trends / token distribution charts | Not an ops signal. Cost anomalies are better caught by billing alerts. |
| User-level analytics (top users, usage patterns) | Product metric, not ops metric. |
| Model breakdown (haiku vs. sonnet distribution) | Interesting but doesn't answer "is something broken?" |
| Conversation browsing (non-error) | The ops dashboard shows errors. Browsing all conversations is a product analytics need. |
| Week-over-week overlay charts | The delta indicators on KPI cards serve this need more efficiently. Full overlays are a v2 feature. |
| Custom query builder | Ops engineers who need ad-hoc queries use Supabase Studio directly. |
| Evaluation scores / quality metrics | Not available in the data model. Future feature. |
| Real-time streaming (WebSocket/SSE) | 30-second polling is sufficient for ops. Real-time streaming adds complexity without meaningful ops benefit. |

---

## 13. Implementation Notes

### Data Fetching Pattern

Follow the existing admin pattern: server component (page.tsx) calls server actions, passes data as props to client components.

```
page.tsx (server) → server action (admin check + Supabase query) → client component (charts + tables)
```

For the Forensics page expandable rows, the trace data is loaded via a separate server action call triggered by the client component when the user clicks expand. This is the "lazy-load details on demand" pattern.

### Bucket Size Selection

The time-series charts need appropriate bucket sizes:

| Time range | Bucket size | Approx. data points |
|-----------|-------------|---------------------|
| 1h | 5 minutes | 12 |
| 6h | 15 minutes | 24 |
| 24h | 1 hour | 24 |
| 7d | 6 hours | 28 |
| 30d | 1 day | 30 |

Target: 12-30 data points per chart. More than that is visual noise; fewer loses resolution.

### Performance Considerations

- **Health page**: 6 queries (4 KPIs current + 4 KPIs comparison + 2 charts + 2 tables + 1 feed = ~9 queries). Run in parallel with `Promise.all`. Target: < 500ms total.
- **Tools page**: 2 queries (per-tool aggregates + per-tool sparkline data). Target: < 300ms.
- **Forensics page**: 1 query for the table, lazy-load traces. Target: < 200ms for initial table, < 100ms per trace expansion.
- **Index coverage**: All queries filter on `created_at` (indexed on all 3 tables). The `tool_name` column on `tool_observations` is not indexed — may need an index if per-tool queries are slow. Monitor and add if needed.

### Missing Index (Potential)

```sql
CREATE INDEX idx_tool_observations_tool_name ON tool_observations(tool_name);
```

Not strictly necessary for v1 (the table will be small initially), but should be added if the Tools page queries exceed 200ms.

### Navigation Integration

1. Add card to `adminPages` array in `/admin/page.tsx`:
```tsx
{
  title: "Observability",
  description: "System health, tool performance, error investigation",
  href: "/admin/observability/health",
  icon: Activity,  // from lucide-react
  gradient: "from-rose-600 to-orange-600",
}
```

2. Add petal to `petals` array in `admin-fab.tsx`:
```tsx
{ route: "/admin/observability/health", icon: Activity, label: "Observability" }
```
