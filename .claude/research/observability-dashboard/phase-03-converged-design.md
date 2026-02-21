# Phase 03 — Converged Design: Usage Dashboard

> Design date: 2026-02-21
> Status: Final converged design
> Sources: Minimal concept, Langfuse concept, Ops concept, Director's convergence brief

---

## Design Rationale

Three divergent concepts were produced. This document synthesizes them into one buildable design by cherry-picking the strongest elements from each:

| Element | Source | Why |
|---------|--------|-----|
| 2-page structure (merged overview + list) | Minimal | 714 rows, 3 admins. Separate overview page is a wasted click. |
| "Usage" naming | Minimal | Matches existing admin page naming style ("User Management", "Chat Management"). "Observability" is jargon. |
| Waterfall timeline on detail page | Langfuse | Highest-value single component. Proportional timing bars make "where did time go?" instant. |
| Status dot + tool call fraction + duration heat | Langfuse | Makes table rows scannable without clicking. Zero-cost information density. |
| Delta indicators on KPI cards | Ops | A number without context is noise. "+1.8pp vs. last period" makes error rate actionable. |
| RED metrics in tool breakdown | Ops | Calls, errors, error rate, P50, P95 per tool. The ops concept nailed tool diagnostics. |
| Copy buttons on IDs and errors | Ops | Zero implementation cost, high incident-response value. |
| Sentry trace link on detail page | Langfuse + Ops | Cross-referencing traces is critical. Constructing the URL is trivial. |
| No charts for v1 | Minimal | Charts are noise at 714 rows. Numbers in cards and tables communicate the same data. Add recharts when volume justifies it. |
| No auto-refresh | Minimal | Admins check occasionally, not 24/7 monitoring. Page reload is sufficient. |
| No status banner/thresholds | Minimal | Premature at this scale. Thresholds become meaningful at thousands of events/week. |
| Project filter dropdown | Director | Director added this to minimal's filter design. Worth the cost because projects are the primary scoping dimension. |

---

## 1. Page Structure

Two routes. One is a list with summary stats. The other is a forensics detail view.

| Route | Purpose | What's on it |
|-------|---------|-------------|
| `/admin/usage` | Everything. Main page. | Time range + project filter, 4 KPI cards with deltas, conversations table with inline signals, tool breakdown table. |
| `/admin/usage/[id]` | Conversation forensics. | Conversation header, waterfall timeline with nested tool calls, expandable tool input/output JSON, error display, Sentry link. |

### Why not more pages?

- **No separate overview page**: The "overview" is 4 stat cards above a table. Putting them on a separate page means the admin reads numbers, then navigates away to do anything. Merge them.
- **No dedicated tools page**: With <20 distinct tool names, a section at the bottom of the main page is sufficient. Split when tool count exceeds 30 or tool calls exceed 10k.
- **No separate conversations list vs. overview**: They are the same page. KPIs at top, table below. One page, one fetch, one URL.

### Why `/admin/usage` not `/admin/observability`?

Existing admin pages are named for what they do: "User Management", "Chat Management", "GFS Admin", "Drive Sync". This page shows usage data. "Usage" is clearer than "Observability" for 3 admins who are not SREs.

---

## 2. Page 1: `/admin/usage` — Main Page

### 2.1 Layout (top to bottom)

```
[A] Sticky header (back nav + title)
[B] Filter bar (time range presets + project dropdown)
[C] KPI cards row (4 cards with deltas)
[D] Conversations table (sortable, paginated)
[E] Tool breakdown table (RED metrics per tool)
```

### 2.2 Filter Bar

A horizontal bar below the header with two controls:

| Control | Type | Options | Default | URL Param |
|---------|------|---------|---------|-----------|
| **Time range** | Toggle button group | 24h, 7d, 30d, All | 7d | `?range=7d` |
| **Project** | Select dropdown (searchable) | "All projects" + list from data | All | `?project=<uuid>` |

**What's included:**
- Time range presets: 24h, 7d, 30d, All. Four buttons, no dropdown.
- Project filter: Single select dropdown populated from `SELECT DISTINCT project_id FROM agent_usage` joined with `projects.name`. Searchable for quick selection.
- All filter state is URL-encoded. Every filtered view is shareable by copying the URL.

**What's cut for v1:**
- No custom date picker. With 714 total rows, presets cover every reasonable query.
- No organization filter. Projects are the primary scoping dimension; orgs add complexity without value at this scale.
- No model filter. The table has a model column; visual scan or Cmd-F suffices for 3 admins.
- No error-only toggle. The status column in the table makes errors visible at a glance.
- No search box. Cmd-F in the browser works for 33 users.

### 2.3 KPI Cards (4 cards)

One row of four cards. Each shows a primary value, a delta indicator vs. previous period, and a secondary contextual line. No sparklines (noise at this volume).

```
+--------------------+  +--------------------+  +--------------------+  +--------------------+
| Exchanges          |  | Error Rate         |  | Median Latency     |  | Total Cost         |
|        142         |  |       2.1%         |  |       3.4s         |  |      $18.72        |
|   +23 vs prev      |  |  -0.5pp vs prev    |  |  +0.8s vs prev    |  |  +$4.20 vs prev   |
|   18 today          |  |  3 errors          |  |  P95: 8.2s         |  |  $2.10 today       |
+--------------------+  +--------------------+  +--------------------+  +--------------------+
```

| Card | Primary | Delta | Secondary | Query Source |
|------|---------|-------|-----------|-------------|
| **Exchanges** | `COUNT(*)` in period | Absolute change vs. previous period | Count today | `agent_usage` |
| **Error Rate** | `errors / total * 100` | Percentage point change vs. previous period | Absolute error count | `agent_usage` |
| **Median Latency** | `PERCENTILE_CONT(0.5)` on `duration_ms` | Absolute ms change vs. previous period | P95 value | `agent_usage` |
| **Total Cost** | `SUM(cost_usd)` | Absolute USD change vs. previous period | Cost today | `agent_usage` |

**Delta indicator design (from ops concept):**

Each card shows a delta comparing the current period to the immediately preceding period of equal length:

| Selected range | Current period | Comparison period |
|---------------|---------------|------------------|
| 24h | Last 24h | Previous 24h (24-48h ago) |
| 7d | Last 7d | Previous 7d (7-14d ago) |
| 30d | Last 30d | Previous 30d (30-60d ago) |
| All | All time | No delta shown (nothing to compare) |

Delta formatting:
- Direction: up-arrow or down-arrow character
- Value: absolute change ("+23", "-0.5pp", "+0.8s", "+$4.20")
- Color: Red if the change is bad (errors up, latency up), green if good (errors down, latency down). Cost and exchanges use neutral gray since "more" is not inherently good or bad.
- For "All" range, the delta line is replaced by a secondary context value.

**Why these four questions?**
1. How much is the system being used? (Exchanges)
2. Is anything broken? (Error rate)
3. Is it fast enough? (Latency)
4. How much is it costing? (Cost)

**What's cut from KPI cards:**
- No sparklines. Volume too low for trend lines to be meaningful. A sparkline over 50 data points is noise.
- No fifth KPI (tool calls/day). Four is enough. Tool call volume is visible in the tool breakdown table below.
- No threshold coloring / status badges. Premature at this scale.

### 2.4 Conversations Table

A sortable, paginated table. This is the main content of the page. Single-line rows (not two-line — simpler than Langfuse concept).

**Columns:**

| Column | Width | Content | Source | Align | Sortable | Notes |
|--------|-------|---------|--------|-------|----------|-------|
| **Status** | 40px | Colored dot | `agent_usage.is_error` + tool error presence | Center | No | Green: OK. Red: `is_error=true`. Amber: conversation OK but has tool errors. |
| **Time** | 110px | Relative ("2h ago") | `agent_usage.created_at` | Left | Yes (default: desc) | Full timestamp on hover tooltip. |
| **User** | 140px | Email (truncated) | `agent_usage.user_id` JOIN `auth.users.email` | Left | No | Tooltip for full email. |
| **Project** | 120px | Project name | `agent_usage.project_id` JOIN `projects.name` | Left | No | Shows "--" if null (dashboard chat). |
| **Model** | 80px | Badge | `agent_usage.model` | Center | No | Colored badge: "sonnet" (blue), "haiku" (green), "opus" (purple). |
| **Turns** | 50px | Number | `agent_usage.num_turns` | Right | Yes | |
| **Tools** | 80px | Fraction | Subquery on `tool_observations` | Right | No | `{success}/{total}` e.g. "12/14". Red text if any failures. "--" if no tool data. |
| **Duration** | 90px | Formatted | `agent_usage.duration_ms` | Right | Yes | "3.2s", "1m 12s". Heat coloring: normal (default), amber (> P75), red (> P95). P75/P95 computed from the current page's dataset. |
| **Cost** | 80px | USD | `agent_usage.cost_usd` | Right | Yes | "$0.034". "--" if null. |

**Status dot design (from Langfuse concept):**
- Green filled circle: `is_error=false` AND no tool errors
- Amber filled circle: `is_error=false` BUT has tool errors (partial failure)
- Red filled circle: `is_error=true`
- Gray ring (outline): `duration_ms IS NULL` (stream incomplete / no finalization)

**Duration heat coloring (from Langfuse concept):**
- Default text color: duration < P75 of current result set
- `text-amber-600`: P75 <= duration < P95
- `text-red-600`: duration >= P95

The P75 and P95 thresholds are computed from the current page's filtered dataset (not hardcoded). This means the coloring automatically adapts as usage patterns change.

**Tool call fraction (from Langfuse concept):**
- Format: `{successful}/{total}` e.g. "12/14"
- Red text class if `failed > 0`
- Shows "--" if the `tool_observations` table has no data yet (pre-deployment state)

**Table behavior:**
- Default sort: `created_at DESC` (most recent first)
- Sortable columns: Time, Turns, Duration, Cost. Click header to toggle sort direction. Uses existing `SortableHeader` pattern from `user-overview-table.tsx`.
- Page size: 25 rows
- Pagination: Prev/Next buttons with total count. URL param `?page=1`.
- Row click: navigates to `/admin/usage/[id]`
- URL state: `?sort=created_at&dir=desc&page=1`

**What's cut from the table:**
- No two-line rows (Langfuse proposed this). Single-line is simpler and sufficient.
- No expandable rows inline. Click-through to detail page is simpler. One extra click is acceptable for 3 admins.
- No tokens column. Cost covers financial impact. Token breakdown belongs on detail page.
- No auth mode column. Low signal density for the main table. Visible on detail page.
- No search/filter in the table itself. The filter bar above covers time range and project.

### 2.5 Tool Breakdown Table

A summary table below the conversations table, showing per-tool RED metrics aggregated over the selected time range.

**Section heading:** "Tool Breakdown ({range})" with a subtle separator above.

| Column | Content | Source | Align | Notes |
|--------|---------|--------|-------|-------|
| **Tool** | Tool name | `tool_observations.tool_name` grouped | Left | Monospace font. |
| **Calls** | Total count | `COUNT(*)` | Right | |
| **Errors** | Error count + rate | `COUNT(WHERE error IS NOT NULL)` | Right | Format: "3 (4.2%)". Red text if error rate > 5%. |
| **P50** | Median latency | `PERCENTILE_CONT(0.5)` on `duration_ms` | Right | "320ms" or "1.2s". |
| **P95** | Tail latency | `PERCENTILE_CONT(0.95)` on `duration_ms` | Right | "890ms" or "6.8s". Red text if > 5s. |

**Behavior:**
- Sorted by call count descending (most-used tools first)
- No pagination (expect <20 distinct tool names)
- No click-through for v1
- Responds to time range and project filters

**Empty state:** "No tool data yet. Tool observations are recorded after the next deployment." (The `tool_observations` table exists but may have zero rows until the turns/tools recording is deployed to production.)

---

## 3. Page 2: `/admin/usage/[id]` — Conversation Detail

This is the forensics page. The admin lands here by clicking a row in the conversations table. The waterfall timeline is the hero component.

### 3.1 Layout (top to bottom)

```
[A] Sticky header (back link + title)
[B] Conversation header (metadata + metrics)
[C] Waterfall timeline (turns + nested tool calls)
[D] Inline detail panels (appear when tool calls are expanded)
```

### 3.2 Conversation Header

A metadata section showing conversation-level information. Clean key-value pairs, no heavy cards.

```
[< Back to Usage]

Conversation abc123-def456...                                      [Copy ID]

User: alice@example.com         Project: Acme Corp         Model: sonnet
Duration: 4.2s                  Cost: $0.034               Turns: 3
Status: OK                      Auth: OAuth
Created: Feb 21, 2026 10:42 AM UTC

Tokens: 12,450 in | 1,230 out | 8,900 cache read | 0 cache creation

Sentry: abc123def456...         [Copy]  [Open in Sentry ->]
```

**Copy buttons (from ops concept):**
- Conversation ID: copy button next to the ID
- Sentry trace ID: copy button (if available on any turn, show the first one at conversation level)

**Sentry link construction:**
The Sentry trace link uses the `sentry_trace_id` from the first turn that has one. URL format:
```
https://effi-ai.sentry.io/performance/trace/{sentry_trace_id}/
```
The Sentry org slug is a constant. Show the link only when `sentry_trace_id` is non-null. If no turn has a trace ID, omit the Sentry section entirely.

**Token breakdown:**
Displayed as a single inline row of key-value pairs. No visualization. Cache read line only shown if value > 0.

### 3.3 Waterfall Timeline (Hero Component)

This is the highest-value component in the entire dashboard. It is the Langfuse trace detail view adapted to our two-level data model (turns > tool calls).

#### Visual Structure

```
TIME AXIS   0s          3s          6s          9s         12.4s
            |-----------|-----------|-----------|-----------|

v TURN 0                                                            820ms
  "I'll search for that information in your project..."
  +---------------------------------------------------------+
  |######-----------------------------------------------------|     turn bar
  +---------------------------------------------------------+
    [T] semantic_search                                         450ms  OK  3 results
    +---------------------------------------------------------+
    |--####---------------------------------------------------|     tool bar
    +---------------------------------------------------------+
    [T] browse_emails                                           320ms  OK  7 results
    +---------------------------------------------------------+
    |--###----------------------------------------------------|     tool bar
    +---------------------------------------------------------+

v TURN 1                                                          3,200ms
  "Based on the search results, I found..."
  +---------------------------------------------------------+
  |----------####################-----------------------------|     turn bar
  +---------------------------------------------------------+
    [T] semantic_search                                       1,800ms  OK  5 results
    +---------------------------------------------------------+
    |-----------################------------------------------|     tool bar
    +---------------------------------------------------------+
    [T] execute_sql                                             680ms  ERR
    +---------------------------------------------------------+
    |-------------------####----------------------------------|     tool bar (RED)
    +---------------------------------------------------------+

> TURN 2  (collapsed)                                             2,100ms
  +---------------------------------------------------------+
  |-------------------------------------###################--|     turn bar
  +---------------------------------------------------------+
```

#### Design Decisions

1. **Proportional timing bars**: Each bar's width is proportional to its `duration_ms` relative to the total conversation `duration_ms`. The bar's horizontal position represents its start time relative to conversation start. This gives an instant visual sense of where time was spent.

2. **Two-level nesting only**: Turns are top-level rows. Tool calls are indented underneath their parent turn. Our data model has exactly two levels (no deeper nesting). This makes the implementation straightforward.

3. **Time axis at top**: A light horizontal rule with tick marks at 0%, 25%, 50%, 75%, 100% of total duration. Labels show actual time values (e.g., "0s", "3s", "6s", "9s", "12.4s"). Provides context for all bars below.

4. **Bar positioning**:
   - Turn bars: Start position = turn's inferred start time (cumulative from previous turns), width = `turn.duration_ms / conversation.duration_ms * 100%`.
   - Tool bars: Positioned within their parent turn's time span. Start position based on sequence order within the turn, width = `tool.duration_ms / conversation.duration_ms * 100%`.
   - Since we don't have explicit start timestamps for turns or tools, we estimate:
     - Turn 0 starts at 0ms
     - Turn N starts at sum of all previous turn durations
     - Tool calls within a turn are laid out sequentially based on their `sequence` order
   - This is an approximation. Real start times would require additional instrumentation. The approximation is good enough to show relative proportions, which is the primary value.

5. **Color coding**:
   - Turn bars: `bg-blue-500` (success), `bg-red-500` (error via `is_error`)
   - Tool bars: `bg-teal-500` (success), `bg-red-500` (error)
   - Background track: `bg-zinc-100` dark:`bg-zinc-800`
   - All bars have rounded corners (`rounded-sm`) and a minimum width of 4px so zero-duration items remain clickable.

6. **Turn row content**:
   - Expand/collapse chevron (left edge)
   - Turn index badge: "TURN 0", "TURN 1", etc. (monospace, muted)
   - Truncated `text_preview` (first ~100 chars, single line, ellipsis)
   - Duration label right-aligned
   - Timing bar (full width of timeline area)

7. **Tool call row content** (indented under parent turn):
   - Tool icon: `[T]` badge or Lucide `Wrench` icon
   - `tool_name` in monospace
   - Duration label right-aligned
   - Status: "OK" (green badge) or "ERR" (red badge)
   - `result_count` if present and status is OK (e.g., "3 results")
   - Timing bar (full width of timeline area, positioned within parent)
   - Click to expand inline detail panel

8. **Thinking preview**: If a turn has `thinking_preview`, show it in muted italic below `text_preview`, prefixed with "[thinking]". Collapsed by default; shown when turn is expanded.

#### Interaction Model

- **Default state**: All turns expanded (showing their tool calls). The full tree is visible on page load.
- **Collapse a turn**: Click the chevron to hide tool calls under that turn. The turn row stays visible with its timing bar and summary.
- **Click a tool call row**: Toggles an inline detail panel directly below that tool call row (not in a separate zone). This keeps the context close to the waterfall.
- **Hover a timing bar**: Tooltip shows exact duration and percentage of total conversation time.

#### Tool Call Detail Panel (Inline Expansion)

When a tool call row is clicked, an inline panel expands directly below it within the waterfall. This keeps the forensic context close to the visual timeline.

```
    [T] execute_sql                                             680ms  ERR
    +---------------------------------------------------------+
    |-------------------####----------------------------------|     (red bar)
    +---------------------------------------------------------+
    +-------------------------------------------------------+
    | execute_sql  (Turn 1, Seq 1)              680ms  ERROR |
    |                                                        |
    | Input:                                       [Copy]    |
    | +----------------------------------------------------+ |
    | | {                                                   | |
    | |   "query": "SELECT * FROM nonexistent_table",      | |
    | |   "project_id": "abc-123-def"                      | |
    | | }                                                   | |
    | +----------------------------------------------------+ |
    |                                                        |
    | Error:                                       [Copy]    |
    | +----------------------------------------------------+ |
    | | relation "nonexistent_table" does not exist         | |
    | | LINE 1: SELECT * FROM nonexistent_table WHERE ...   | |
    | +----------------------------------------------------+ |
    |                                                        |
    | Results: --                                            |
    +-------------------------------------------------------+
```

**Panel contents:**
- Tool name + turn/sequence reference
- Duration + status badge
- **Input**: `tool_input` JSONB rendered as formatted JSON in a `<pre>` block with horizontal scroll. Copy button.
- **Error** (if present): Full error text in a red-tinted `<pre>` block. Copy button. Shown prominently above input for error cases.
- **Results**: `result_count` value, or "--" if null.

**Copy buttons** on both the input JSON and error text. These are the most common things an admin copies during incident response.

### 3.4 Sentry Integration

Each turn may have a `sentry_trace_id`. In the waterfall, turns with a trace ID show a small Sentry icon link:

```
v TURN 1                                              3,200ms  [Sentry ->]
```

Clicking opens Sentry in a new tab. The URL is constructed as:
```
https://effi-ai.sentry.io/performance/trace/{sentry_trace_id}/
```

At the conversation level (in the header), the first available `sentry_trace_id` is shown with a copy button and external link. The admin can also copy the raw trace ID to search in Sentry manually.

---

## 4. ASCII Wireframes

### 4.1 Main Page: `/admin/usage`

```
+======================================================================+
|  [< Admin]  [Activity]  Usage                                         |
|                          Agent usage and tool analytics                |
+======================================================================+
|                                                                        |
|  [24h] [7d*] [30d] [All]               Project: [All projects  v]    |
|                                                    (* = selected)      |
|  +-------------------+ +-------------------+ +------------------+ +------------------+
|  | Exchanges         | | Error Rate        | | Median Latency   | | Total Cost       |
|  |       142         | |      2.1%         | |      3.4s        | |     $18.72       |
|  |  ^ +23 vs prev    | | v -0.5pp vs prev  | | ^ +0.8s vs prev  | | ^ +$4.20 vs prev|
|  |  18 today         | | 3 errors          | | P95: 8.2s        | | $2.10 today      |
|  +-------------------+ +-------------------+ +------------------+ +------------------+
|                                                                        |
|  Conversations                                                         |
|  +----+------+----------+---------+-------+------+-------+------+-----+
|  | St | Time | User     | Project | Model | Trns | Tools | Dur. | Cost|
|  +----+------+----------+---------+-------+------+-------+------+-----+
|  | *  | 2h   | ali@e..  | Acme    | snnt  |   3  | 10/12 | 4.2s |$.03|
|  | *  | 3h   | bob@e..  | --      | haik  |   1  |  --   | 0.8s |$.00|
|  | !  | 5h   | ali@e..  | Beta    | snnt  |   5  |  6/9  | 12s  |$.08|
|  | o  | 5h   | car@e..  | Beta    | snnt  |   2  |  3/3  | 3.1s |$.01|
|  | *  | 8h   | dan@e..  | Acme    | haik  |   1  |  2/2  | 1.2s |$.00|
|  | .. | ...  | ...      | ...     | ...   | ...  | ...   | ...  | ...|
|  +----+------+----------+---------+-------+------+-------+------+-----+
|                                                                        |
|  Legend: * OK   ! Error   o Partial (tool errors)   ( ) Incomplete    |
|                                                                        |
|  [< Prev]                    Page 1 of 6                  [Next >]    |
|                                                                        |
|  ---- Tool Breakdown (7d) -----------------------------------------   |
|                                                                        |
|  +--------------------+-------+-----------+--------+--------+          |
|  | Tool               | Calls | Errors    | P50    | P95    |          |
|  +--------------------+-------+-----------+--------+--------+          |
|  | semantic_search    |   89  | 2 (2.2%)  | 320ms  | 890ms  |          |
|  | browse_emails      |   45  | 0 (0.0%)  | 180ms  | 420ms  |          |
|  | execute_sql        |   23  | 1 (4.3%)  |  95ms  | 210ms  |          |
|  | browse_files       |   18  | 0 (0.0%)  | 240ms  | 680ms  |          |
|  | file_upload        |   12  | 3 (25.0%) | 890ms  | 3.2s   |          |
|  +--------------------+-------+-----------+--------+--------+          |
|                                                                        |
+======================================================================+
```

### 4.2 Detail Page: `/admin/usage/[id]`

```
+======================================================================+
|  [< Usage]  [Activity]  Conversation Detail                           |
+======================================================================+
|                                                                        |
|  Conversation abc123-def456-7890...                        [Copy ID]  |
|                                                                        |
|  User: alice@example.com      Project: Acme Corp      Model: sonnet  |
|  Duration: 12.4s              Cost: $0.0089            Turns: 3       |
|  Status: OK                   Auth: OAuth                              |
|  Created: Feb 21, 2026 14:30:42 UTC                                   |
|                                                                        |
|  Tokens: 2,140 in | 1,380 out | 820 cache read                       |
|                                                                        |
|  Sentry: abc123def456   [Copy]  [Open in Sentry ->]                  |
|                                                                        |
|  ====== WATERFALL TIMELINE ==========================================  |
|                                                                        |
|  TIME    0s        3s        6s        9s       12.4s                 |
|          |---------|---------|---------|---------|                     |
|                                                                        |
|  v TURN 0                                                     820ms   |
|    "I'll search for that information in your..."                      |
|    +----------------------------------------------------------+       |
|    |######----------------------------------------------------|       |
|    +----------------------------------------------------------+       |
|      [T] semantic_search                          450ms   OK  3       |
|      +----------------------------------------------------------+     |
|      |--######--------------------------------------------------|     |
|      +----------------------------------------------------------+     |
|      [T] browse_emails                            320ms   OK  7       |
|      +----------------------------------------------------------+     |
|      |--#####---------------------------------------------------|     |
|      +----------------------------------------------------------+     |
|                                                                        |
|  v TURN 1                                                   3,200ms   |
|    "Based on the search results, I found..."                          |
|    +----------------------------------------------------------+       |
|    |----------####################-----------------------------|       |
|    +----------------------------------------------------------+       |
|      [T] semantic_search                        1,800ms   OK  5       |
|      +----------------------------------------------------------+     |
|      |-----------################-------------------------------|     |
|      +----------------------------------------------------------+     |
|      [T] execute_sql                              680ms   ERR         |
|      +----------------------------------------------------------+     |
|      |-------------------#####----------------------------------|  RED |
|      +----------------------------------------------------------+     |
|      +------------------------------------------------------+         |
|      | execute_sql  (Turn 1, Seq 1)            680ms  ERROR |         |
|      |                                                       |         |
|      | Error:                                      [Copy]    |         |
|      | +---------------------------------------------------+ |         |
|      | | relation "nonexistent_table" does not exist       | |         |
|      | | LINE 1: SELECT * FROM nonexistent_table WHERE ... | |         |
|      | +---------------------------------------------------+ |         |
|      |                                                       |         |
|      | Input:                                      [Copy]    |         |
|      | +---------------------------------------------------+ |         |
|      | | {                                                  | |         |
|      | |   "query": "SELECT * FROM nonexistent_table",     | |         |
|      | |   "project_id": "abc-123-def"                     | |         |
|      | | }                                                  | |         |
|      | +---------------------------------------------------+ |         |
|      |                                                       |         |
|      | Results: --                                            |         |
|      +------------------------------------------------------+         |
|                                                                        |
|  v TURN 2                                                   2,100ms   |
|    "Here's a summary of the quarterly revenue..."                     |
|    +----------------------------------------------------------+       |
|    |-------------------------------------####################-|       |
|    +----------------------------------------------------------+       |
|    (no tool calls)                                                     |
|                                                                        |
+======================================================================+
```

---

## 5. Interaction Model

### 5.1 Navigation Flow

```
/admin              (hub)        -- card click -->  /admin/usage          (main page)
/admin/usage        (main page)  -- row click  -->  /admin/usage/[id]     (detail)
/admin/usage/[id]   (detail)     -- back link  -->  /admin/usage          (main page)
```

Two levels deep. No breadcrumbs (two pages + back link is sufficient).

### 5.2 URL State Encoding

All interactive state is URL-encoded so views are shareable:

| Page | State | URL Params |
|------|-------|-----------|
| Main page | Time range | `?range=7d` |
| Main page | Project filter | `?project=<uuid>` |
| Main page | Sort | `?sort=created_at&dir=desc` |
| Main page | Page | `?page=1` |
| Detail page | (none) | Path param `[id]` only |

- Changing time range or project resets page to 1.
- Sort defaults to `created_at DESC` and is preserved on back navigation.
- Expanded tool calls on the detail page are client-state only (not in URL). This is acceptable because it is ephemeral detail-on-demand.

### 5.3 Back Navigation

The detail page has a "Back to Usage" link in the header. Clicking it returns to `/admin/usage` with the previous URL state preserved (the browser's history handles this naturally).

---

## 6. Data Queries

All queries run through the Supabase admin client (AuthClient with admin RLS). Server actions follow the existing pattern: page.tsx (server) calls server action, passes data as props to client component.

### 6.1 `getUsageStats(range, projectId?)`

Returns all KPI card data in two queries (current period + comparison period), run in parallel.

```sql
-- Current period
SELECT
  COUNT(*) AS total_exchanges,
  COUNT(*) FILTER (WHERE is_error = true) AS error_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_error = true) / NULLIF(COUNT(*), 0),
    1
  ) AS error_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  SUM(cost_usd) AS total_cost,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_count,
  SUM(cost_usd) FILTER (WHERE created_at >= CURRENT_DATE) AS today_cost
FROM agent_usage
WHERE created_at >= $range_start
  AND ($project_id IS NULL OR project_id = $project_id);

-- Comparison period (same query with shifted window)
-- $compare_start = $range_start - ($now - $range_start)
-- $compare_end = $range_start
-- Same SELECT ... WHERE created_at >= $compare_start AND created_at < $compare_end
```

Single query per period, no joins. Returns one row per period with all stat card data.

### 6.2 `getConversations(range, projectId?, sort, dir, page)`

Returns paginated conversation list with inline tool metrics.

```sql
SELECT
  au.id,
  au.created_at,
  au.model,
  au.num_turns,
  au.duration_ms,
  au.cost_usd,
  au.is_error,
  au.user_id,
  au.project_id,
  -- Tool call aggregations via lateral subquery
  tool_agg.total_tool_calls,
  tool_agg.failed_tool_calls
FROM agent_usage au
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_tool_calls,
    COUNT(*) FILTER (WHERE to2.error IS NOT NULL) AS failed_tool_calls
  FROM tool_observations to2
  JOIN turns t ON t.id = to2.turn_id
  WHERE t.agent_usage_id = au.id
) tool_agg ON true
WHERE au.created_at >= $range_start
  AND ($project_id IS NULL OR au.project_id = $project_id)
ORDER BY $sort_column $sort_dir
LIMIT 25 OFFSET $offset;

-- Count query (for pagination)
SELECT COUNT(*)
FROM agent_usage
WHERE created_at >= $range_start
  AND ($project_id IS NULL OR project_id = $project_id);
```

**Note on user email and project name joins**: The admin RLS client cannot directly query `auth.users`. Two options:
1. Use `getSupabaseAdmin()` (service-role client) for this query — simplest.
2. Create an RPC function that returns user email for admin callers.

Option 1 is recommended for v1. The server action already runs server-side with admin auth verification.

**Note on duration percentiles for heat coloring**: Compute P75 and P95 from the current result set client-side (25 rows). This is approximate but sufficient. Alternative: add to the count query as a separate percentile computation over the full filtered dataset.

### 6.3 `getToolBreakdown(range, projectId?)`

Returns per-tool RED metrics.

```sql
SELECT
  tool_name,
  COUNT(*) AS call_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE error IS NOT NULL) / NULLIF(COUNT(*), 0),
    1
  ) AS error_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
FROM tool_observations
WHERE created_at >= $range_start
  AND ($project_id IS NULL OR turn_id IN (
    SELECT t.id FROM turns t
    JOIN agent_usage au ON au.id = t.agent_usage_id
    WHERE au.project_id = $project_id
  ))
GROUP BY tool_name
ORDER BY call_count DESC;
```

### 6.4 `getConversationDetail(id)`

Three queries run in parallel via `Promise.all`:

**Query 1 — Conversation metadata:**
```sql
SELECT
  au.*,
  p.name AS project_name
FROM agent_usage au
LEFT JOIN projects p ON p.id = au.project_id
WHERE au.id = $id;
```
(Use admin client to also fetch user email separately from `auth.admin.getUserById()` or equivalent.)

**Query 2 — Turns:**
```sql
SELECT *
FROM turns
WHERE agent_usage_id = $id
ORDER BY turn_index ASC;
```

**Query 3 — Tool observations for all turns:**
```sql
SELECT to2.*
FROM tool_observations to2
JOIN turns t ON t.id = to2.turn_id
WHERE t.agent_usage_id = $id
ORDER BY t.turn_index ASC, to2.sequence ASC;
```

**Client-side assembly** into nested structure:
```typescript
type ConversationDetail = {
  conversation: AgentUsageRow & { project_name: string | null; user_email: string | null };
  turns: Array<{
    turn: TurnRow;
    toolCalls: ToolObservationRow[];
  }>;
};
```

The flat results from queries 2 and 3 are assembled server-side in the server action, grouping tool observations under their parent turns. This single prop is passed to the client component.

---

## 7. What's Cut and What's Deferred

### Cut for v1

| Feature | Source that proposed it | Why cut |
|---------|----------------------|---------|
| Charts (all types) | Langfuse, Ops | No charting library installed. Numbers in cards and tables communicate the same data at 714 rows. Recharts adds bundle size and implementation time for marginal visual value at this volume. |
| Sparklines on KPI cards | Langfuse, Ops | Volume too low for trend lines to be meaningful. A sparkline over 50 data points is noise. |
| Separate overview page | Langfuse, Ops | The "overview" is 4 stat cards. They belong above the table on the same page, not a separate route. |
| Dedicated tools page | Langfuse, Ops | <20 tool names, <1000 calls. A table section is sufficient. |
| Tool detail page (`/tools/[name]`) | Langfuse | <1000 tool calls per tool. Filter the main tool table by name if needed. |
| Auto-refresh / polling | Ops | Admins check a few times a day. Manual page reload is sufficient. |
| Status banner / thresholds | Ops | Premature. Thresholds become meaningful at thousands of events/week. |
| Custom date range picker | Langfuse, Ops | Not needed for 714 rows. Presets cover every reasonable query. |
| Organization filter | Langfuse | Projects are the primary dimension. Orgs add filter bar complexity without value. |
| Model filter | Langfuse | Table has model column. Visual scan suffices for 3 admins. |
| Error-only filter toggle | Ops | Status dot in table makes errors visible. Filtering adds UI complexity. |
| Search box | Langfuse | Cmd-F works for 33 users. |
| Breadcrumbs | Langfuse | Two pages. Back link is sufficient. |
| Expandable table rows | Ops | Click-through to detail page is simpler. Inline expansion doubles client-side state management. |
| Two-line table rows | Langfuse | Single-line is simpler and readable. Tokens, auth mode are on the detail page. |
| Tab navigation (Health/Tools/Forensics) | Ops | One page, no tabs needed. |
| Error clustering | Ops | <1000 errors. Visual scan of error text works. |
| Stale data warning | Ops | Premature. Build when monitoring is 24/7. |
| P95 vs P50 gap detection | Ops | Premature. Both values are shown; admin can compare mentally. |
| Keyboard navigation | Langfuse | Nice but non-essential for 3 admins. |
| Display density control | Phase 02 | Pick one good density and ship. |
| Comparison views | Phase 02 | Delta indicators on KPI cards serve this need. |
| Model distribution donut | Langfuse | Not an actionable metric. |
| Error trend area chart | Langfuse | Error rate number + delta is sufficient. |
| Raw data toggle | Ops | Admin can use Supabase Studio for raw JSON. |
| Detail panel as separate zone below waterfall | Langfuse | Inline expansion keeps context close to the waterfall. Separate zone forces the eye to jump. |

### Escalation Triggers (When to Add Complexity)

These triggers are from the minimal concept. When a trigger fires, add the corresponding feature:

| Trigger | What to add |
|---------|-------------|
| >1,000 exchanges/week | Sparklines on KPI cards. Custom date range picker. |
| >5,000 exchanges total | Search in conversations table. Error-only filter toggle. |
| >3 admins using this regularly | Display density control. Saved filter presets. |
| Tool count >30 or tool calls >10k | Split tool breakdown into dedicated `/admin/usage/tools` page. |
| Admin asks "what changed this week?" | Week-over-week comparison overlay on KPI cards. |
| Need real-time monitoring (SRE use case) | Install recharts. Add time-series charts. Add auto-refresh polling (30s). Add status banner with thresholds. At that point, adopt the ops concept's Health page design. |
| Need to share specific filtered views | Full URL state encoding for all filters and selections. |
| Need incident response workflow | Add error clustering, copy-all-errors button, and error summary block from ops concept. |

---

## 8. File Structure

### Next.js Routes

```
nextjs-app/app/admin/usage/
  page.tsx                              # Main page (server component)
  [id]/
    page.tsx                            # Conversation detail (server component)
```

### Server Actions

```
nextjs-app/app/actions/admin-usage.ts   # All data fetching
```

Server actions exported:
- `getUsageStats(range, projectId?)` — KPI card data (current + comparison)
- `getConversations(range, projectId?, sort, dir, page)` — Paginated table data
- `getConversationCount(range, projectId?)` — Total count for pagination
- `getToolBreakdown(range, projectId?)` — Per-tool RED metrics
- `getConversationDetail(id)` — Full conversation tree

### Client Components

```
nextjs-app/components/admin/usage/
  usage-page-client.tsx                 # Main page orchestrator (filter bar, cards, tables)
  kpi-cards.tsx                         # Row of 4 KPI cards with deltas
  conversations-table.tsx               # Sortable paginated conversation table
  conversation-row.tsx                  # Single row with status dot, heat coloring
  status-dot.tsx                        # Green/amber/red/gray dot
  tool-breakdown-table.tsx              # Per-tool RED metrics table
  filter-bar.tsx                        # Time range toggles + project dropdown

  detail/
    conversation-detail-client.tsx      # Detail page orchestrator
    conversation-header.tsx             # Metadata + tokens + Sentry link
    waterfall-timeline.tsx              # Hero component: the full waterfall
    waterfall-turn-row.tsx              # Turn row with timing bar + expand
    waterfall-tool-row.tsx              # Tool call row with timing bar
    timing-bar.tsx                      # Proportional horizontal bar (reusable)
    time-axis.tsx                       # Top axis with tick marks
    tool-detail-panel.tsx              # Inline expandable: input JSON, error, results
    copy-button.tsx                     # Click-to-copy with toast feedback
```

### Why this structure?

- **Flat, not deeply nested**: One level of nesting (`usage/` and `usage/detail/`). Easy to navigate.
- **One component per concern**: `status-dot.tsx`, `timing-bar.tsx`, `copy-button.tsx` are small, focused, reusable.
- **Server/client split**: `page.tsx` files are server components (auth guard + data fetch). Client components receive data as props. Follows the existing admin page pattern exactly.
- **No shared layout.tsx**: Existing admin pages don't use shared layouts. Each page renders its own header. Follow the pattern.
- **copy-button.tsx lives in the detail directory**: It could be shared, but for v1 it's only used on the detail page. Move to `components/ui/` if other pages need it.

---

## 9. Integration Points

### Admin Hub Card

Add to `adminPages` array in `nextjs-app/app/admin/page.tsx`:

```typescript
{
  title: "Usage",
  description: "Agent usage, latency, cost, and tool analytics",
  href: "/admin/usage",
  icon: Activity,  // from lucide-react (import added at top)
  gradient: "from-amber-600 to-orange-600",
}
```

### Admin FAB Petal

Add to `petals` array in `nextjs-app/components/admin-fab.tsx`:

```typescript
{ route: "/admin/usage", icon: Activity, label: "Usage" }
```

And add `Activity` to the lucide-react imports.

### No New Dependencies

This design does not require installing recharts or any other charting library. All visualizations are pure CSS (timing bars are `div` elements with percentage widths and background colors). The only dependency is the existing shadcn/ui + Lucide + Tailwind stack.

The timing bars in the waterfall use:
```tsx
<div className="relative h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm">
  <div
    className="absolute h-full bg-teal-500 rounded-sm"
    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
  />
</div>
```

No charting library needed.

---

## 10. Waterfall Component — Detailed Technical Design

This section nails down the waterfall because it is the hardest component to build correctly.

### Data Shape (Input Prop)

```typescript
interface WaterfallProps {
  totalDurationMs: number;
  turns: Array<{
    turnIndex: number;
    textPreview: string | null;
    thinkingPreview: string | null;
    durationMs: number;
    sentryTraceId: string | null;
    toolCalls: Array<{
      id: string;
      sequence: number;
      toolName: string;
      toolInput: Record<string, unknown> | null;
      resultCount: number | null;
      error: string | null;
      durationMs: number;
    }>;
  }>;
}
```

### Layout Math

The waterfall area has two logical columns:
1. **Label column** (~250px): Turn/tool name, text preview, status
2. **Timeline column** (remaining width): Timing bars

The timeline column represents 0ms to `totalDurationMs`. All bars are positioned as percentages:

```typescript
function computeTurnPositions(turns: Turn[], totalMs: number) {
  let cumulativeMs = 0;
  return turns.map(turn => {
    const startPct = (cumulativeMs / totalMs) * 100;
    const widthPct = (turn.durationMs / totalMs) * 100;
    cumulativeMs += turn.durationMs;
    return { startPct, widthPct: Math.max(widthPct, 0.5) }; // min 0.5% for visibility
  });
}

function computeToolPositions(
  tools: ToolCall[],
  turnStartMs: number,
  totalMs: number
) {
  let toolCumulativeMs = turnStartMs;
  return tools.map(tool => {
    const startPct = (toolCumulativeMs / totalMs) * 100;
    const widthPct = (tool.durationMs / totalMs) * 100;
    toolCumulativeMs += tool.durationMs;
    return { startPct, widthPct: Math.max(widthPct, 0.5) };
  });
}
```

### Time Axis

The time axis shows 5 tick marks: 0%, 25%, 50%, 75%, 100% of `totalDurationMs`.

```
0s          3.1s         6.2s         9.3s        12.4s
|-----------|-----------|-----------|-----------|
```

Format the labels smartly:
- < 1s: "0ms", "250ms", "500ms", "750ms", "1,000ms"
- 1-60s: "0s", "3.1s", "6.2s", "9.3s", "12.4s"
- > 60s: "0s", "30s", "1:00", "1:30", "2:00"

### Responsive Behavior

The waterfall is full-width within the page container. On narrow screens (< 768px):
- Label column shrinks to ~150px
- Text previews are truncated more aggressively
- Timing bars remain proportional (they scale naturally with container width)

### Accessibility

- Timing bars have `aria-label` with the exact duration and percentage
- Turn rows are keyboard-navigable (tabindex)
- Color coding is supplemented with text labels (not color-only)
- Expand/collapse state is announced via `aria-expanded`

---

## 11. Performance Considerations

### Main Page

The main page makes 4 queries in parallel via `Promise.all`:
1. `getUsageStats` — current period (single row)
2. `getUsageStats` — comparison period (single row)
3. `getConversations` — 25 rows with lateral join
4. `getToolBreakdown` — ~10-20 rows grouped

All filter on `created_at` (indexed). Target: < 500ms total.

### Detail Page

3 queries in parallel:
1. Conversation metadata (single row by PK)
2. Turns for conversation (~1-10 rows)
3. Tool observations for conversation (~0-50 rows)

All use indexed foreign keys. Target: < 200ms total.

### What NOT to Fetch

- **Main page**: Never fetch `tool_input` JSONB. It's only needed on the detail page.
- **Detail page**: Fetch all tool data upfront (the total per conversation is small). No lazy-loading per tool call — the inline expansion just shows data already in memory.
- **Conversations table**: The lateral subquery for tool call fractions adds overhead. If this causes performance issues, consider adding a materialized column `tool_error_count` to `agent_usage` (but defer this optimization until needed).

### Index Coverage

All queries filter on:
- `agent_usage.created_at` — indexed
- `agent_usage.project_id` — indexed
- `turns.agent_usage_id` — check if indexed (should be, as FK)
- `tool_observations.turn_id` — check if indexed (should be, as FK)

No additional indexes needed for v1. If `getToolBreakdown` is slow, consider:
```sql
CREATE INDEX idx_tool_observations_tool_name ON tool_observations(tool_name);
```

---

## 12. Implementation Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Server actions (5 functions) | Small | Follows existing admin-chat.ts pattern. SQL queries are straightforward. |
| Main page server component | Small | Auth guard + 4 parallel queries + prop passing. Identical to admin/chat/page.tsx pattern. |
| Filter bar | Small | Two controls (toggle buttons + select dropdown), URL sync with `useSearchParams`. |
| KPI cards with deltas | Small-Medium | 4 cards, each with primary value + delta computation + secondary line. The delta logic (comparison period calculation) needs care. |
| Conversations table | Medium | Sortable headers (reuse SortableHeader pattern), pagination, status dot, tool fraction, duration heat coloring. Most UI work on the main page. |
| Tool breakdown table | Small | Static table with 5 columns, no pagination, no interactivity. |
| Detail page server component | Small | Auth guard + 3 parallel queries + assembly. |
| Conversation header | Small | Key-value pairs + copy button + Sentry link. |
| Waterfall timeline | **Large** | The hero component. Timing bar positioning math, two-level nesting, expand/collapse, time axis. Most complex component in the entire feature. |
| Tool detail inline panel | Medium | JSON formatting in `<pre>`, error display, copy buttons. |
| Admin hub + FAB integration | Trivial | Two array entries, one import. |
| **Total** | **~3-4 days** | Waterfall is the long pole. Everything else follows existing patterns. |

Compare to:
- Minimal concept (no waterfall): ~1-2 days
- Full Langfuse concept (4 pages + recharts): ~5-7 days
- Full Ops concept (3 pages + recharts + thresholds + auto-refresh): ~7-10 days

This converged design is 3-4 days for ~85% of the value of the full Langfuse concept. The waterfall is worth the investment because it is the only component that transforms debugging from "read numbers and guess" to "see where time went at a glance."

---

## 13. Open Implementation Questions

These should be resolved during the spec/implementation phase, not in design:

1. **User email resolution**: The admin RLS client cannot query `auth.users`. Use `getSupabaseAdmin()` (service-role) for the conversations query, or create an RPC function. Recommend option 1 for simplicity.

2. **Duration heat coloring thresholds**: Compute P75/P95 from the current result set client-side (25 rows) or from the full filtered dataset via a separate query? Client-side is simpler but less accurate. Recommend client-side for v1.

3. **Tool call timing positions**: We don't have start timestamps for tool calls, only durations. The waterfall positions tools sequentially within each turn. If tools actually ran in parallel, this visualization is inaccurate. Note this as a known limitation. Adding start timestamps to `tool_observations` would fix it but requires a migration.

4. **Sentry org slug**: Hardcode `effi-ai` as the Sentry org slug for link construction. If this changes, update the constant. Consider making it an environment variable.

5. **Empty state for tool data**: The `turns` and `tool_observations` tables may have zero rows in production (not yet deployed). The conversations table should show "--" for tool columns, and the tool breakdown section should show the placeholder message.
