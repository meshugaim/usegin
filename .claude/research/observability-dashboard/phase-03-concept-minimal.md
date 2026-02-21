# Phase 03 — Minimal Dashboard Concept

> Design date: 2026-02-21
> Philosophy: Every component must earn its place. If a number can replace a chart, use the number. If two pages can merge, merge them.

---

## Reality Check

Before designing anything, here is what we are actually working with:

- **714 exchanges** across **33 users** and **44 projects** over ~2 months
- The `turns` and `tool_observations` tables exist as migrations but are **not yet deployed to production** — they have zero rows
- There is **no charting library** installed
- The audience is **2-3 admins** who check this occasionally, not a 24/7 SRE team

This is not Datadog. This is a small internal tool for a small team. The Phase 02 research recommended 4 pages, waterfall trace views, sparklines on KPI cards, heatmaps, and breadcrumb scope navigation. That is over-engineered for 714 rows and 3 users.

**The right v1 is embarrassingly simple.**

---

## 1. Page Structure: Two Pages, Not Four

The Phase 02 research proposed:
```
/admin/observability/overview
/admin/observability/conversations
/admin/observability/conversations/[id]
/admin/observability/tools
/admin/observability/tools/[name]
```

That is five routes. Here is what we actually need:

| Route | What it does |
|-------|-------------|
| `/admin/usage` | Everything. KPIs + recent exchanges table + tool breakdown. |
| `/admin/usage/[id]` | Single exchange detail: turns + tool calls. |

Two routes. One is a list with summary stats. The other is a detail view.

**Why not four pages?**

- **Overview vs. Conversations list**: These are the same page. The "overview" is just 4 stat cards above a table. Putting them on separate pages means the admin clicks Overview, reads numbers, then clicks Conversations to actually do anything. Merge them.
- **Tools analytics page**: With ~10 distinct tool names and a few hundred observations, a dedicated page is premature. A simple "Top tools" table section on the main page is enough. If it outgrows that, split later.
- **Tool detail page (`/tools/[name]`)**: A page per tool name is unjustified when you have <1000 tool calls total. Filter the main table by tool name instead.

**Why `/admin/usage` not `/admin/observability`?**

"Observability" is jargon. The existing admin pages are named for what they do: "User Management", "Chat Management", "GFS Admin", "Drive Sync". This page shows usage data. Call it "Usage".

---

## 2. Page 1: `/admin/usage` — The Main Page

### Components (top to bottom)

#### 2a. Time range selector

A row of preset buttons: **24h | 7d | 30d | All**. No custom date picker. No calendar widget.

- Default: **7d**
- URL param: `?range=7d`
- Affects all data on the page

**Why no custom range?** With 714 total rows, you do not need to slice by "Feb 3 9am to Feb 5 2pm." Presets cover it. Add custom range when someone asks for it.

**Why no project/user filter on v1?** The table has columns for these. The admin can visually scan or Cmd-F. Adding filter dropdowns means building a filter bar, managing URL state for multiple params, fetching distinct project/user lists, and handling empty states. That is a lot of UI for 33 users. Add it in v2 when the table gets long enough to need it.

#### 2b. Four stat cards

One row of four cards. Each shows a single number with a label and a subtle secondary line for context.

| Card | Primary value | Secondary line | Query |
|------|--------------|----------------|-------|
| **Exchanges** | Count in period | e.g. "12 today" | `COUNT(*) FROM agent_usage WHERE created_at >= $range_start` |
| **Error rate** | Percentage | e.g. "3 errors" (absolute count) | `COUNT(*) FILTER (WHERE is_error) / COUNT(*)` from `agent_usage` |
| **Median latency** | Duration in seconds | e.g. "P95: 8.2s" | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)` from `agent_usage` |
| **Total cost** | USD amount | e.g. "$1.24 today" | `SUM(cost_usd) FROM agent_usage WHERE created_at >= $range_start` |

**What I am cutting from stat cards:**

- **Sparklines**: Requires recharts. A sparkline over 7 days with ~100 data points is noise, not signal. A number is clearer.
- **Delta indicators (arrows, percentages)**: Requires computing previous-period values and comparison logic. "Up 12% vs. last week" is useless when your total volume is 50/week and variance is random. Add deltas when volume is high enough for trends to be meaningful.
- **Fifth KPI (tool calls/day)**: Four is enough. Tool call volume is visible in the tool breakdown table below.

**Why these four?** They answer the four questions an admin actually has:
1. How much is the system being used? (Exchanges)
2. Is anything broken? (Error rate)
3. Is it fast enough? (Latency)
4. How much is it costing? (Cost)

#### 2c. Recent exchanges table

A sortable table showing the most recent exchanges. This is the main content of the page.

| Column | Source | Notes |
|--------|--------|-------|
| Time | `agent_usage.created_at` | Relative ("2h ago") with tooltip for absolute |
| User | `agent_usage.user_id` join to `auth.users.email` | Truncated email |
| Project | `agent_usage.project_id` join to `projects.name` | Nullable |
| Model | `agent_usage.model` | Badge: "sonnet", "haiku" |
| Turns | `agent_usage.num_turns` | Number |
| Duration | `agent_usage.duration_ms` | Formatted: "3.2s" |
| Cost | `agent_usage.cost_usd` | Formatted: "$0.012" |
| Status | `agent_usage.is_error` | Green dot or red dot |

- Default sort: most recent first
- Sortable columns: Time, Duration, Cost, Turns
- Page size: 25 rows
- Pagination: simple Prev/Next (no page numbers)
- Row click: navigates to `/admin/usage/[id]`

**What I am cutting from the table:**

- **Expandable rows**: Nice UX but doubles the client-side complexity (state management for expanded rows, lazy-loading turn data, accordion animations). A click-through to the detail page is simpler and the team is 3 people who can handle one extra click.
- **Search/filter bar**: See "Why no project/user filter" above. Cmd-F works.
- **Inline sparklines per row**: Over-engineered. The table already shows the numbers.
- **Token columns (input_tokens, output_tokens, cache_read)**: Too many columns. Cost covers the financial impact. Token breakdown belongs on the detail page.

#### 2d. Tool breakdown table

A simple summary table below the exchanges table. Shows tool usage aggregated over the selected time range.

| Column | Value | Notes |
|--------|-------|-------|
| Tool | `tool_observations.tool_name` | Grouped |
| Calls | `COUNT(*)` | Total invocations |
| Errors | `COUNT(*) FILTER (WHERE error IS NOT NULL)` | With percentage |
| Median ms | `PERCENTILE_CONT(0.5)` on `duration_ms` | |
| P95 ms | `PERCENTILE_CONT(0.95)` on `duration_ms` | |

- Sorted by call count descending (most-used tools first)
- No pagination (expect <20 distinct tool names)
- No click-through (v1)

**Why not a separate Tools page?** This table is 5 columns and <20 rows. It does not need its own page. It sits at the bottom of the main page with a section heading.

**Note:** This section will be empty until `tool_observations` is deployed and populated. Show a placeholder message: "No tool data yet. Tool observations are recorded after the next deployment."

---

## 3. Page 2: `/admin/usage/[id]` — Exchange Detail

Shows everything about a single exchange. The admin lands here by clicking a row in the table.

### Components (top to bottom)

#### 3a. Exchange header

A metadata bar showing the exchange-level information:

```
[Back to Usage]

Exchange abc123...
User: alice@example.com | Project: Acme Corp | Model: sonnet
Duration: 4.2s | Cost: $0.034 | Turns: 3 | Status: OK
Created: Feb 21, 2026 10:42 AM UTC
```

This is a simple `dl` (description list) or a row of key-value pairs. No card, no gradient badge. Just information.

#### 3b. Turns list

A vertical list of turns, each showing:

```
Turn 0                                          1.2s
  "Here is what I found about your question..."
  Tools: semantic_search (320ms), browse_emails (180ms)

Turn 1                                          2.8s
  "Based on the search results..."
  [thinking] "I need to consider the context..."
  Tools: none

Turn 2                                          0.2s
  "Let me know if you need anything else."
  Tools: none
```

For each turn:
- **Turn index** and **duration** (right-aligned)
- **text_preview** (first ~200 chars, already truncated in DB)
- **thinking_preview** (if present, in a muted/italic style)
- **Tool calls** listed inline with duration

If the user clicks a tool call, expand it inline to show:
- `tool_input` (JSONB, rendered as formatted JSON in a `<pre>` block)
- `result_count`
- `error` (if any, in red)
- `duration_ms`

**What I am cutting from the detail view:**

- **Waterfall/Gantt chart**: The Phase 02 research recommended horizontal timeline bars showing parallel execution. This requires a charting library, complex layout math, and careful responsive design. For a page that gets viewed maybe 5 times a day by 3 people, a simple vertical list with durations is sufficient. The admin can see "Turn 0 took 1.2s, semantic_search took 320ms of that" without a visual timeline.
- **Sentry trace link**: `sentry_trace_id` exists on turns but linking to Sentry requires knowing the Sentry org/project URL and constructing the right deep link. Defer to v2 — for now, the admin can copy the trace ID and paste it into Sentry manually if needed.
- **Breadcrumb navigation**: With only two pages, breadcrumbs are unnecessary. A "Back to Usage" link is sufficient.
- **Token breakdown (input/output/cache)**: Show these as simple key-value pairs in the exchange header. No visualization needed.

#### 3c. Token breakdown (in exchange header or as a small section)

Simple key-value display:

```
Tokens
  Input: 12,450 | Output: 1,230 | Cache read: 8,900 | Cache creation: 0
```

No donut chart. No bar chart. Just numbers with labels.

---

## 4. Interaction Model

The interaction is **two levels deep** with one-click navigation:

```
/admin          (hub)     -- card click -->  /admin/usage        (list + stats)
/admin/usage    (list)    -- row click  -->  /admin/usage/[id]   (detail)
/admin/usage/[id] (detail) -- back link -->  /admin/usage        (list)
```

State management:
- **Time range**: URL search param `?range=7d`. Preserved on back navigation.
- **Sort**: URL search params `?sort=created_at&dir=desc`. Preserved on back navigation.
- **Page**: URL search param `?page=1`. Reset when changing range/sort.
- **Expanded tool calls**: Client state only (not in URL). Acceptable because this is ephemeral detail-on-demand.

No global filter bar. No project selector. No user selector. The table shows these as columns. Visual scanning works for 33 users.

---

## 5. What I Am Cutting (and Why)

| Feature | Phase 02 proposed | This concept | Why cut |
|---------|-------------------|-------------|---------|
| 4-5 separate pages | Overview, Conversations, Conv Detail, Tools, Tool Detail | 2 pages | 714 rows, 3 admins. Fewer pages = less navigation, less code, faster to build. |
| recharts installation | Multiple chart types | Zero charts | No charting library needed for v1. Numbers in cards and tables communicate the same data without the dependency, bundle size, or visual complexity. |
| Sparklines on KPI cards | 7-30 day mini-trends | Plain numbers | Volume too low for trend lines to be meaningful. A sparkline over 50 data points is noise. |
| Delta indicators | "+12% vs. last week" | None | Variance at this volume is random, not signal. Deltas become useful at thousands of exchanges/week. |
| Waterfall trace view | Horizontal timeline bars | Vertical list with durations | Requires charting library and complex layout. A list with "320ms" next to each tool call communicates the same information. |
| Custom date range picker | Calendar widget | Preset buttons only (24h/7d/30d/All) | Not needed for 714 rows over 2 months. |
| Project/user filter dropdowns | Multi-select filter bar | None (use table columns + visual scan) | 33 users, 44 projects. The table is scannable. Filtering adds URL state management, dropdown components, and empty state handling. |
| Expandable table rows | Inline turn/tool preview | Click-through to detail page | Simpler implementation. One extra click is acceptable for 3 users. |
| Tool detail page | Per-tool page with call history | Section on main page | <20 tool names, <1000 calls. A section, not a page. |
| Heatmap visualizations | Latency distribution over time | P50/P95 numbers in tool table | Heatmaps need a charting library and significant implementation effort. Two percentile numbers convey the same information for this volume. |
| Breadcrumb navigation | Full scope breadcrumbs | Back link | Two pages. Breadcrumbs are overhead. |
| Real-time updates | Supabase channels / polling | Manual refresh (page reload) | Admins check this a few times a day. Real-time updates are engineering cost with no user value. |
| Comparison views | Week-over-week overlays | None | Volume too low for meaningful comparison. |
| Display density control | Compact/regular/relaxed | Single density | 3 users. Pick one good density and ship. |
| "Last updated" indicator | Timestamp + staleness banner | None (data is fetched on page load) | Server-rendered page. Data is always fresh on load. |

---

## 6. ASCII Wireframes

### Page 1: `/admin/usage`

```
+------------------------------------------------------------------+
| [< Admin]  [Usage icon]  Usage                                   |
|                           Agent usage and tool analytics          |
+------------------------------------------------------------------+
|                                                                    |
|  [24h] [7d*] [30d] [All]                          (* = selected) |
|                                                                    |
|  +-------------+ +-------------+ +-------------+ +-------------+  |
|  | Exchanges   | | Error Rate  | | Median Lat. | | Total Cost  |  |
|  |    142      | |    2.1%     | |    3.4s     | |   $18.72    |  |
|  | 18 today    | | 3 errors    | | P95: 8.2s   | | $2.10 today |  |
|  +-------------+ +-------------+ +-------------+ +-------------+  |
|                                                                    |
|  Recent Exchanges                                                  |
|  +------+--------+--------+-------+------+------+------+--------+ |
|  | Time | User   | Project| Model | Trns | Dur. | Cost | Status | |
|  +------+--------+--------+-------+------+------+------+--------+ |
|  | 2h   | ali@.. | Acme   | sonnt |   3  | 4.2s | $.03 |   *    | |
|  | 3h   | bob@.. | —      | haiku |   1  | 0.8s | $.00 |   *    | |
|  | 5h   | ali@.. | Beta   | sonnt |   5  | 12s  | $.08 |   !    | |
|  | ...  | ...    | ...    | ...   |  ... | ...  | ...  |  ...   | |
|  +------+--------+--------+-------+------+------+------+--------+ |
|                                                                    |
|  [< Prev]                 Page 1                    [Next >]       |
|                                                                    |
|  Tool Breakdown (7d)                                               |
|  +------------------+-------+--------+----------+---------+        |
|  | Tool             | Calls | Errors | Med. ms  | P95 ms  |        |
|  +------------------+-------+--------+----------+---------+        |
|  | semantic_search   |   89  |  2 (2%)|    320   |   890   |        |
|  | browse_emails     |   45  |  0 (0%)|    180   |   420   |        |
|  | execute_sql       |   23  |  1 (4%)|     95   |   210   |        |
|  | ...              |  ...  |  ...   |    ...   |   ...   |        |
|  +------------------+-------+--------+----------+---------+        |
|                                                                    |
+------------------------------------------------------------------+
```

### Page 2: `/admin/usage/[id]`

```
+------------------------------------------------------------------+
| [< Usage]  [Activity icon]  Exchange Detail                      |
|                              Exchange abc12345...                 |
+------------------------------------------------------------------+
|                                                                    |
|  User: alice@example.com    Project: Acme Corp    Model: sonnet   |
|  Duration: 4.2s    Cost: $0.034    Turns: 3    Status: OK         |
|  Created: Feb 21, 2026 10:42 AM UTC                               |
|                                                                    |
|  Tokens                                                            |
|  Input: 12,450  Output: 1,230  Cache read: 8,900  Cache: 0       |
|                                                                    |
|  -----------------------------------------------------------      |
|                                                                    |
|  Turns                                                             |
|                                                                    |
|  Turn 0                                                   1.2s    |
|  "Here is what I found about your question regarding..."          |
|  +-- semantic_search  320ms  [v expand]                            |
|  +-- browse_emails    180ms  [v expand]                            |
|                                                                    |
|  Turn 1                                                   2.8s    |
|  "Based on the search results, I can see that..."                 |
|  [thinking] "I need to consider the user's context..."            |
|  No tool calls                                                     |
|                                                                    |
|  Turn 2                                                   0.2s    |
|  "Let me know if you need anything else."                         |
|  No tool calls                                                     |
|                                                                    |
|  -----------------------------------------------------------      |
|                                                                    |
|  (Expanded tool call - inline)                                     |
|  semantic_search                              320ms  OK            |
|  Input:                                                            |
|    {                                                               |
|      "query": "quarterly revenue report",                          |
|      "project_id": "abc-123",                                      |
|      "limit": 10                                                   |
|    }                                                               |
|  Results: 4                                                        |
|                                                                    |
+------------------------------------------------------------------+
```

---

## 7. Routes

| Route | File | Type | What it does |
|-------|------|------|-------------|
| `/admin/usage` | `app/admin/usage/page.tsx` | Server component | Auth guard, fetch stats + recent exchanges, render page |
| `/admin/usage/[id]` | `app/admin/usage/[id]/page.tsx` | Server component | Auth guard, fetch exchange + turns + tool_observations, render detail |

Supporting files:

| File | Purpose |
|------|---------|
| `app/actions/admin-usage.ts` | Server actions: `getUsageStats()`, `getRecentExchanges()`, `getExchangeDetail()`, `getToolBreakdown()` |
| `components/admin/usage/usage-client.tsx` | Client component: main page with time range toggle, stat cards, table, tool table |
| `components/admin/usage/exchange-detail-client.tsx` | Client component: detail page with turns list and expandable tool calls |

Integration points:
- Add card to `adminPages` array in `app/admin/page.tsx`:
  ```ts
  {
    title: "Usage",
    description: "Agent usage, latency, cost, and tool analytics",
    href: "/admin/usage",
    icon: Activity,  // from lucide-react
    gradient: "from-amber-600 to-orange-600",
  }
  ```
- Add petal to `admin-fab.tsx`:
  ```ts
  { route: "/admin/usage", icon: Activity, label: "Usage" }
  ```

---

## 8. Data Queries

All queries run through Supabase client (AuthClient) with admin RLS. Server actions follow existing pattern.

### `getUsageStats(range: '24h' | '7d' | '30d' | 'all')`

```sql
SELECT
  COUNT(*) as total_exchanges,
  COUNT(*) FILTER (WHERE is_error = true) as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_error = true) / NULLIF(COUNT(*), 0), 1) as error_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
  SUM(cost_usd) as total_cost,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
  SUM(cost_usd) FILTER (WHERE created_at >= CURRENT_DATE) as today_cost
FROM agent_usage
WHERE created_at >= $range_start;
```

Single query, no joins. Returns one row with all stat card data.

### `getRecentExchanges(range, sort, dir, page)`

```sql
SELECT
  au.id,
  au.created_at,
  au.model,
  au.num_turns,
  au.duration_ms,
  au.cost_usd,
  au.is_error,
  u.email as user_email,
  p.name as project_name
FROM agent_usage au
LEFT JOIN auth.users u ON u.id = au.user_id
LEFT JOIN projects p ON p.id = au.project_id
WHERE au.created_at >= $range_start
ORDER BY $sort $dir
LIMIT 25 OFFSET $offset;
```

Note: The join to `auth.users` may require a Supabase RPC function since the admin RLS client cannot directly query `auth.users`. Alternative: store user email denormalized, or use `getSupabaseAdmin()` for this query. Implementation detail to resolve during build.

### `getToolBreakdown(range)`

```sql
SELECT
  tool_name,
  COUNT(*) as call_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL) as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE error IS NOT NULL) / COUNT(*), 1) as error_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms
FROM tool_observations
WHERE created_at >= $range_start
GROUP BY tool_name
ORDER BY call_count DESC;
```

### `getExchangeDetail(id)`

Three queries in parallel:

1. Exchange metadata (agent_usage row + user email + project name)
2. Turns (`SELECT * FROM turns WHERE agent_usage_id = $id ORDER BY turn_index`)
3. Tool observations for all turns (`SELECT * FROM tool_observations WHERE turn_id = ANY($turn_ids) ORDER BY turn_id, sequence`)

Assemble in the server action, pass as a single prop to the client component.

---

## 9. What Triggers Adding Complexity

This concept is deliberately minimal. Here is when to add the deferred features:

| Trigger | What to add |
|---------|-------------|
| >1000 exchanges/week | Delta indicators on stat cards, project/user filter dropdowns |
| >5000 exchanges total | Custom date range picker, search in table |
| Admin asks "what changed this week?" | Week-over-week comparison on stat cards |
| >3 admins using this regularly | Display density control, saved filter presets |
| Tool count >30 or tool calls >10k | Dedicated Tools page split from main page |
| Debugging a slow exchange | Waterfall trace view (install recharts at this point) |
| Need to share specific views | Full URL state encoding for all filters and selections |
| Real-time monitoring need | Polling or Supabase realtime subscription |

---

## 10. Implementation Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Server actions (4 queries) | Small | Follows existing pattern exactly |
| Main page (server component) | Small | Auth guard + data fetch, same as other admin pages |
| Usage client (stat cards + table + tool table) | Medium | Most of the UI work. Table sorting, pagination, time range toggle. |
| Detail page (server component) | Small | Auth guard + 3 parallel queries |
| Exchange detail client (turns list + expandable tools) | Medium | Expandable tool calls need client state |
| Admin hub + FAB integration | Trivial | Two array entries |
| **Total** | **~1-2 days** | No charting library, no complex state management |

Compare to the Phase 02 concept (4+ pages, recharts, sparklines, waterfall, filters): ~5-7 days. This concept is 3-4x less work for 90% of the value.
