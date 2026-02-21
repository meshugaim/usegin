# Phase 03 — Concept: Langfuse-Inspired Conversation Observability Dashboard

> Design date: 2026-02-21
> Author: Claude (Phase 3 — Design)
> Inspiration: Langfuse Session > Trace > Observation hierarchy
> Data model: agent_usage (Session) > turns (Trace) > tool_observations (Span)

---

## 1. Page Structure

Langfuse organizes around three hierarchical levels — Session, Trace, Observation — with a dashboard overview on top. We mirror this exactly, translating to our domain language: Conversation, Turn, Tool Call.

| Page | Route | Purpose | Langfuse Analog |
|------|-------|---------|-----------------|
| **Overview** | `/admin/observability` | Health-at-a-glance: 5 KPI cards, volume/latency/cost time-series, error trend | Langfuse Dashboard |
| **Conversations** | `/admin/observability/conversations` | Paginated, filterable, sortable table of all conversations with inline metrics | Langfuse Sessions list |
| **Conversation Detail** | `/admin/observability/conversations/[id]` | The hero page. Waterfall timeline of turns and nested tool calls. Full forensics. | Langfuse Trace detail view |
| **Tools** | `/admin/observability/tools` | Per-tool RED metrics (Rate, Error, Duration). Table of all tools with sparklines. | Langfuse (custom — no direct analog, but maps to Datadog RED pattern) |

The hierarchy follows Shneiderman's mantra: Overview first (dashboard), zoom and filter (conversations list), details on demand (conversation detail). The tools page is a cross-cutting analytical view that slices data by tool rather than by conversation.

### Why four pages, not one

Each page has a single clear purpose. The overview answers "is the system healthy?" The conversations list answers "which conversations should I look at?" The conversation detail answers "what happened in this conversation?" The tools page answers "which tools are misbehaving?" A mega-dashboard that tries to answer all four questions simultaneously creates cognitive overload and slow page loads.

---

## 2. Components Per Page

### 2.1 Overview (`/admin/observability`)

```
Data source: agent_usage (aggregated), turns (aggregated), tool_observations (aggregated)
Queries: All use time-windowed aggregations with optional project/org filter.
```

| # | Component | Data Source | Query Pattern |
|---|-----------|-------------|---------------|
| 1 | **KPI Card: Total Conversations** | `agent_usage` | `COUNT(*) WHERE created_at BETWEEN ...` with delta vs. previous period |
| 2 | **KPI Card: Error Rate** | `agent_usage` | `COUNT(is_error=true) / COUNT(*) * 100` with delta |
| 3 | **KPI Card: P50 Latency** | `agent_usage` | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)` with sparkline |
| 4 | **KPI Card: Tool Calls / Day** | `tool_observations` | `COUNT(*) / days_in_range` with delta |
| 5 | **KPI Card: Total Cost** | `agent_usage` | `SUM(cost_usd)` with delta vs. previous period |
| 6 | **Volume Time-Series** | `agent_usage` | `COUNT(*) GROUP BY date_trunc('hour', created_at)` — line chart |
| 7 | **Latency Time-Series** | `agent_usage` | `P50, P95 GROUP BY date_trunc('hour', created_at)` — dual line chart |
| 8 | **Cost Time-Series** | `agent_usage` | `SUM(cost_usd) GROUP BY date_trunc('day', created_at)` — bar chart |
| 9 | **Error Trend** | `agent_usage` | `error_count / total GROUP BY date_trunc('hour', created_at)` — area chart |
| 10 | **Top Tools by Error Count** | `tool_observations` | `COUNT(error IS NOT NULL) GROUP BY tool_name ORDER BY count DESC LIMIT 5` — horizontal bar |
| 11 | **Model Distribution** | `agent_usage` | `COUNT(*) GROUP BY model` — donut chart |
| 12 | **Global Filter Bar** | — | Time range (presets + custom), project filter, org filter |

### 2.2 Conversations List (`/admin/observability/conversations`)

```
Data source: agent_usage LEFT JOIN (turns aggregated) LEFT JOIN (tool_observations aggregated)
Primary query: Paginated list with inline aggregations.
```

| # | Component | Data Source | Query Pattern |
|---|-----------|-------------|---------------|
| 1 | **Global Filter Bar** | — | Time range, project, org, model, error status, auth_mode, search (claude_session_id) |
| 2 | **Results Count + Pagination** | `agent_usage` | `COUNT(*)` with current filters |
| 3 | **Conversation Table** | `agent_usage` + aggregated joins | See Section 3 for column design |
| 4 | **Sort Controls** | — | Column headers are clickable sort toggles (follows existing SortableHeader pattern) |

**Primary query** (server action):
```sql
SELECT
  au.id,
  au.claude_session_id,
  au.user_id,
  au.project_id,
  au.organization_id,
  au.model,
  au.input_tokens,
  au.output_tokens,
  au.cache_read_input_tokens,
  au.cost_usd,
  au.duration_ms,
  au.num_turns,
  au.is_error,
  au.auth_mode,
  au.created_at,
  -- Inline aggregations via lateral joins or subqueries
  (SELECT COUNT(*) FROM turns t WHERE t.agent_usage_id = au.id) AS actual_turn_count,
  (SELECT COUNT(*) FROM tool_observations to2
   JOIN turns t ON t.id = to2.turn_id
   WHERE t.agent_usage_id = au.id) AS total_tool_calls,
  (SELECT COUNT(*) FROM tool_observations to2
   JOIN turns t ON t.id = to2.turn_id
   WHERE t.agent_usage_id = au.id AND to2.error IS NOT NULL) AS failed_tool_calls
FROM agent_usage au
WHERE au.created_at BETWEEN $start AND $end
  AND ($project_id IS NULL OR au.project_id = $project_id)
  AND ($is_error IS NULL OR au.is_error = $is_error)
ORDER BY au.created_at DESC
LIMIT 50 OFFSET $offset;
```

### 2.3 Conversation Detail (`/admin/observability/conversations/[id]`)

This is the most important page. 80% of debugging time is spent here.

```
Data source: Single agent_usage row + all turns + all tool_observations (nested)
Queries: One fetch for the conversation, one for turns+tools (joined).
```

| # | Component | Data Source | Query Pattern |
|---|-----------|-------------|---------------|
| 1 | **Breadcrumb** | URL params | `Observability > Conversations > conv_abc123` |
| 2 | **Conversation Header** | `agent_usage` | Single row by ID: user, project, model, cost, duration, error status, timestamps |
| 3 | **Metadata Cards Row** | `agent_usage` | 4 inline cards: Duration, Token Usage (in/out/cache), Cost, Model |
| 4 | **Waterfall Timeline** | `turns` + `tool_observations` | Full nested view — see Section 4 for detailed design |
| 5 | **Turn Detail Panel** | `turns` (selected) | Expandable: text_preview, thinking_preview, duration, tool count, sentry link |
| 6 | **Tool Call Detail Panel** | `tool_observations` (selected) | Expandable: tool_input JSON, result_count, error, duration |
| 7 | **Sentry Link** | `turns.sentry_trace_id` | External link to Sentry trace (when available) |

**Primary query** (single fetch — returns the full tree):
```sql
-- Conversation metadata
SELECT * FROM agent_usage WHERE id = $conversation_id;

-- Turns with nested tool observations (one query, assembled client-side)
SELECT
  t.id AS turn_id,
  t.turn_index,
  t.text_preview,
  t.thinking_preview,
  t.tool_call_count,
  t.duration_ms AS turn_duration_ms,
  t.sentry_trace_id,
  t.created_at AS turn_created_at,
  to2.id AS tool_id,
  to2.sequence AS tool_sequence,
  to2.tool_name,
  to2.tool_input,
  to2.result_count,
  to2.error AS tool_error,
  to2.duration_ms AS tool_duration_ms,
  to2.created_at AS tool_created_at
FROM turns t
LEFT JOIN tool_observations to2 ON to2.turn_id = t.id
WHERE t.agent_usage_id = $conversation_id
ORDER BY t.turn_index ASC, to2.sequence ASC;
```

**Client-side assembly**: The flat SQL result is grouped into a nested structure:
```typescript
type ConversationTree = {
  conversation: AgentUsage;
  turns: Array<{
    turn: Turn;
    toolCalls: ToolObservation[];
  }>;
};
```

### 2.4 Tools Analytics (`/admin/observability/tools`)

```
Data source: tool_observations (aggregated by tool_name), joined to turns + agent_usage for time filtering.
```

| # | Component | Data Source | Query Pattern |
|---|-----------|-------------|---------------|
| 1 | **Global Filter Bar** | — | Time range, project filter |
| 2 | **KPI Row** | `tool_observations` | Total tool calls, unique tools, error rate, P50 latency |
| 3 | **Tools Table** | `tool_observations` aggregated | One row per tool_name: call count, error count, error rate, P50 duration, P95 duration, avg result_count |
| 4 | **Latency Distribution** | `tool_observations` | P50/P95 per tool — grouped bar chart |
| 5 | **Error Heatmap (v2)** | `tool_observations` | Deferred — tools x time buckets, color = error rate |

---

## 3. Conversation List Design

This is the Langfuse Sessions list analog. The goal: make each row scannable at a glance so an admin can spot problematic conversations without clicking into them.

### 3.1 Columns

| Column | Width | Content | Align | Sort | Why |
|--------|-------|---------|-------|------|-----|
| **Status** | 40px | Colored dot: green (ok), red (error), amber (partial error — has failed tools but conversation succeeded) | Center | Yes | Instant visual triage. Eyes go here first. |
| **Time** | 120px | Relative time ("3m ago", "2h ago") with full timestamp on hover tooltip | Left | Yes (default: desc) | When did this happen? Most recent first. |
| **User** | 140px | User email or truncated user_id with tooltip. Monospace for UUIDs. | Left | Yes | Who was this? |
| **Project** | 120px | Project name or truncated project_id. Badge-style. | Left | Yes | Which project context? |
| **Model** | 80px | Badge: "sonnet", "haiku", "opus" with model-specific color | Center | Yes | Quick model identification. |
| **Turns** | 60px | Number with visual weight: `1` in gray, `5+` in bold | Right | Yes | Conversation depth indicator. |
| **Tool Calls** | 80px | `{success}/{total}` e.g. "12/14". Red text if any failures. | Right | Yes | Tool usage density + error signal. |
| **Duration** | 90px | Formatted: "1.2s", "45.3s", "2m 12s". Red if > P95 threshold. | Right | Yes | Performance signal. |
| **Cost** | 80px | `$0.0042` — formatted to significant digits. | Right | Yes | Spend tracking. |
| **Tokens** | 100px | `{in}+{out}` compact format: "1.2k+0.8k". Cache icon if cache_read > 0. | Right | Yes | Token consumption pattern. |
| **Auth** | 60px | Tiny badge: "key" or "oauth". Gray if null. | Center | Yes | Auth mode identification. |

### 3.2 Inline Visual Signals (What Makes Rows Scannable)

Inspired by Langfuse's trace list, every row should communicate health without clicking:

1. **Status dot** (leftmost) — Color-coded traffic light:
   - Green filled circle: `is_error=false` AND no tool errors
   - Amber filled circle: `is_error=false` BUT has tool errors (partial failure)
   - Red filled circle: `is_error=true` (conversation-level error)
   - Gray ring (outline only): In-progress / no duration yet (stream incomplete)

2. **Duration heat** — Duration text changes color based on percentile:
   - Normal (< P75): default text color
   - Slow (P75-P95): amber-500
   - Very slow (> P95): red-500
   This mimics Langfuse's latency coloring where slow traces visually pop.

3. **Tool call fraction** — `12/14` format where denominator = total, numerator = successful. If any failed, the fraction turns red and the failed count gets a small `(2 failed)` subscript.

4. **Cache indicator** — A small snowflake icon (Lucide: `Snowflake`) next to tokens when `cache_read_input_tokens > 0`. Indicates cache was used — important for cost analysis.

### 3.3 Filters

Horizontal filter bar at the top (below header, above table). Follows the existing admin pattern with some additions:

| Filter | Type | Options | URL Param |
|--------|------|---------|-----------|
| **Time Range** | Select with presets | Last 1h, 6h, 24h, 7d, 30d, Custom | `?range=24h` or `?from=...&to=...` |
| **Project** | Select (searchable) | All projects + specific project IDs | `?project=uuid` |
| **Organization** | Select (searchable) | All orgs + specific org IDs | `?org=uuid` |
| **Model** | Multi-select | haiku, sonnet, opus (dynamic from data) | `?model=sonnet` |
| **Status** | Toggle group | All / Errors only / Success only | `?status=error` |
| **Auth Mode** | Toggle group | All / API Key / OAuth | `?auth=oauth` |
| **Search** | Text input | Searches claude_session_id | `?q=session_abc` |

All filter state is URL-encoded. Every filtered view is shareable by copying the URL.

### 3.4 Sorting

Default: `created_at DESC` (most recent first). All columns are sortable by clicking the header (re-using the existing `SortableHeader` pattern from `user-overview-table.tsx`).

URL-encoded: `?sort=duration_ms&dir=desc`

### 3.5 Pagination

Cursor-based pagination using `created_at` + `id` for stable ordering. 50 rows per page. "Previous / Next" buttons with total count displayed. Follows the existing admin table pagination pattern.

URL-encoded: `?page=2`

---

## 4. Conversation Detail / Trace View

This is the most critical page. It is our analog to Langfuse's trace detail view — the nested tree of observations with timing bars.

### 4.1 Layout: Three Zones

```
+------------------------------------------------------------------+
|  BREADCRUMB: Observability > Conversations > conv_abc123         |
+------------------------------------------------------------------+
|                                                                   |
|  ZONE 1: Conversation Header + Metadata Cards                    |
|  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            |
|  │ Duration │ │  Tokens  │ │   Cost   │ │  Model   │            |
|  │  12.4s   │ │ 2.1k in  │ │ $0.0089  │ │  sonnet  │            |
|  │          │ │ 1.4k out │ │          │ │          │            |
|  └──────────┘ └──────────┘ └──────────┘ └──────────┘            |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
|  ZONE 2: Waterfall Timeline (full width)                         |
|  See Section 4.2 for detailed design                             |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
|  ZONE 3: Detail Panel (appears when a turn or tool is selected)  |
|  See Section 4.4 for detailed design                             |
|                                                                   |
+------------------------------------------------------------------+
```

### 4.2 Waterfall Timeline Design

The waterfall is a vertical list of rows. Each row represents either a **turn** or a **tool call** nested under a turn. Horizontal timing bars show duration proportional to the total conversation duration.

**Visual structure:**

```
                                    TIME AXIS (0ms ────────── 12,400ms)
                                    |         |         |         |
TURN 0  [Assistant]                 |=========|         |         |
  "I'll search for that info..."    |████████ |         |         |   820ms
  [T] semantic_search               |  ██████ |         |         |   450ms  OK  3 results
  [T] browse_emails                 |  ████   |         |         |   320ms  OK  7 results
                                    |         |         |         |
TURN 1  [Assistant]                 |         |=========|         |
  "Based on the search results..."  |         |████████████      |   3,200ms
  [T] semantic_search               |         | ████████|         |   1,800ms  OK  5 results
  [T] execute_sql                   |         |     ████|         |   680ms  ERROR
                                    |         |         |         |
TURN 2  [Assistant]                 |         |         |=========|
  "Here's what I found..."          |         |         |████████ |   2,100ms
                                    |         |         |         |
```

**Key design decisions:**

1. **Proportional timing bars**: Each bar's width is proportional to its `duration_ms` relative to the total conversation `duration_ms`. This gives an instant visual sense of where time was spent — exactly like Langfuse's trace view.

2. **Two-level nesting only**: Turns are top-level rows; tool calls are indented underneath. We don't have deeper nesting in our data model (unlike Langfuse which supports arbitrary depth). This simplicity is an advantage.

3. **Turn rows show**:
   - Turn index badge (`T0`, `T1`, `T2`)
   - Truncated text_preview (first ~80 chars, single line, ellipsis)
   - Timing bar (filled, blue for success / red for error turns)
   - Duration label right-aligned
   - Tool call count badge
   - Expand/collapse chevron

4. **Tool call rows show** (indented under parent turn):
   - Tool icon (`[T]` badge or Lucide wrench icon)
   - `tool_name` in monospace
   - Timing bar (filled, teal for success / red for error)
   - Duration label right-aligned
   - Status badge: `OK` (green) or `ERROR` (red)
   - `result_count` label if present (e.g. "3 results")
   - Click to expand tool_input JSON in detail panel

5. **Color coding for timing bars**:
   - Turn bars: `blue-500` (success), `red-500` (error)
   - Tool bars: `teal-500` (success), `red-500` (error), `amber-500` (slow — > P95)
   - Background track: `zinc-100` (light) / `zinc-800` (dark)

6. **Time axis**: A light horizontal rule at the top with tick marks at 25%, 50%, 75%, 100% of total duration. Labels show actual millisecond values. This gives context for the proportional bars below.

### 4.3 Waterfall Interaction Model

- **Default state**: All turns expanded (showing their tool calls). The full tree is visible.
- **Collapse a turn**: Click the chevron to hide tool calls under that turn. The turn row stays visible with its timing bar and summary.
- **Click a turn row**: Highlights the turn and opens the Turn Detail Panel (Zone 3) below the waterfall, showing full text_preview, thinking_preview, sentry link.
- **Click a tool call row**: Highlights the tool call and opens the Tool Detail Panel (Zone 3), showing the full `tool_input` JSON (syntax-highlighted), `error` text, `result_count`, and duration breakdown.
- **Hover a timing bar**: Tooltip shows exact start time, duration, and percentage of total conversation time.

### 4.4 Detail Panel Design (Zone 3)

The detail panel is a card that appears below the waterfall when a turn or tool call is selected. It slides in with a subtle animation. It has a close button (X) and a tab bar if multiple detail types are relevant.

**Turn Detail Panel:**
```
+------------------------------------------------------------------+
|  Turn 1                                               [X] Close  |
+------------------------------------------------------------------+
|  Duration: 3,200ms    Tool Calls: 2    Created: 2026-02-21 14:32 |
|                                                                   |
|  [Tab: Response] [Tab: Thinking] [Tab: Sentry]                   |
|                                                                   |
|  Response:                                                        |
|  "Based on the search results, I found three relevant documents  |
|   that discuss the quarterly projections. The first document..."  |
|   (full text_preview, up to 200 chars)                           |
|                                                                   |
+------------------------------------------------------------------+
```

**Tool Call Detail Panel:**
```
+------------------------------------------------------------------+
|  semantic_search  (Turn 1, Seq 0)                     [X] Close  |
+------------------------------------------------------------------+
|  Duration: 1,800ms    Results: 5    Status: OK                   |
|                                                                   |
|  [Tab: Input] [Tab: Error]                                       |
|                                                                   |
|  Input:                                                           |
|  {                                                                |
|    "query": "quarterly revenue projections Q3 2026",             |
|    "project_id": "abc-123-def",                                  |
|    "max_results": 10                                             |
|  }                                                                |
|                                                                   |
+------------------------------------------------------------------+
```

For errored tool calls, the Error tab is shown by default with red-tinted background:
```
+------------------------------------------------------------------+
|  execute_sql  (Turn 1, Seq 1)                         [X] Close  |
+------------------------------------------------------------------+
|  Duration: 680ms    Results: --    Status: ERROR                 |
|                                                                   |
|  [Tab: Input] [Tab: Error (active)]                              |
|                                                                   |
|  Error:                                                           |
|  ┌─────────────────────────────────────────────────────────────┐ |
|  │  relation "nonexistent_table" does not exist                │ |
|  │  LINE 1: SELECT * FROM nonexistent_table WHERE id = $1      │ |
|  └─────────────────────────────────────────────────────────────┘ |
|                                                                   |
+------------------------------------------------------------------+
```

### 4.5 Conversation Header Design

At the top of the detail page, before the waterfall, a compact header card shows conversation-level metadata:

```
+------------------------------------------------------------------+
|                                                                   |
|  [<-] Back to Conversations                                      |
|                                                                   |
|  Conversation  abc123-def456-...        [Copy ID]    [Sentry ->] |
|  ─────────────────────────────────────────────────────────────── |
|  User: jane@company.com      Project: Acme Q3 Report             |
|  Started: Feb 21, 2026 14:30:42 UTC                              |
|  Auth: OAuth                 Session: claude_sess_xyz789          |
|                                                                   |
|  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐        |
|  │ Duration │ │   Tokens     │ │   Cost   │ │  Model   │        |
|  │          │ │              │ │          │ │          │        |
|  │  12.4s   │ │  2,140 in   │ │ $0.0089  │ │  sonnet  │        |
|  │          │ │  1,380 out  │ │          │ │          │        |
|  │          │ │   820 cache │ │          │ │          │        |
|  └──────────┘ └──────────────┘ └──────────┘ └──────────┘        |
|                                                                   |
+------------------------------------------------------------------+
```

The four metadata cards use the shadcn Card component with subtle borders:
- **Duration**: `duration_ms` formatted. Red tint if `is_error`.
- **Tokens**: Stacked lines: input, output, cache_read. Cache line only shown if > 0.
- **Cost**: `cost_usd` formatted to significant digits. Shows `--` if null.
- **Model**: Model name as a colored badge (blue for sonnet, purple for opus, green for haiku).

---

## 5. Interaction Model

### 5.1 Click Paths

```
OVERVIEW (/admin/observability)
  |
  ├── Click KPI card ──────────> CONVERSATIONS (pre-filtered)
  │   e.g. "Error Rate" card -> /conversations?status=error
  │   e.g. "Total Cost" card -> /conversations?sort=cost_usd&dir=desc
  |
  ├── Click "View all" link ──> CONVERSATIONS (unfiltered)
  |
  └── Click tool in            TOOLS
      "Top Error Tools" ──────> /tools?tool=semantic_search
```

```
CONVERSATIONS (/admin/observability/conversations)
  |
  ├── Click conversation row ──> CONVERSATION DETAIL
  │                               /conversations/[id]
  |
  ├── Apply filter ────────────> Same page, URL updates
  |
  └── Click column header ─────> Same page, sort updates
```

```
CONVERSATION DETAIL (/admin/observability/conversations/[id])
  |
  ├── Click turn row ──────────> Detail panel opens (below waterfall)
  │                               Shows text_preview, thinking_preview
  │                               Tabs: Response | Thinking | Sentry
  |
  ├── Click tool call row ─────> Detail panel opens (below waterfall)
  │                               Shows tool_input JSON, error, result_count
  │                               Tabs: Input | Error
  |
  ├── Click Sentry link ──────> External: opens Sentry trace in new tab
  │   (on turn with sentry_trace_id)
  |
  ├── Click breadcrumb ────────> Navigate back to conversations list
  │   "Conversations"
  |
  └── Click [<-] Back ─────────> Navigate back to conversations list
```

```
TOOLS (/admin/observability/tools)
  |
  ├── Click tool row ──────────> CONVERSATIONS (pre-filtered by tool)
  │                               /conversations?tool=semantic_search
  │                               (shows only conversations that used this tool)
  |
  └── Apply time range ────────> Same page, URL updates
```

### 5.2 Keyboard Navigation (Progressive Enhancement)

- `Esc`: Close detail panel
- `Up/Down` arrows: Navigate between turns in the waterfall
- `Enter`: Open detail panel for selected turn/tool
- `[` / `]`: Previous / Next conversation (when in detail view)

### 5.3 URL State Encoding

Every view state is in the URL so that links are shareable:

| Page | URL Params |
|------|-----------|
| Overview | `?range=24h&project=uuid` |
| Conversations | `?range=24h&project=uuid&model=sonnet&status=error&sort=duration_ms&dir=desc&page=2&q=session_xyz` |
| Conversation Detail | Path param: `[id]`. Selected item: `?selected=turn_0` or `?selected=tool_abc123` |
| Tools | `?range=24h&project=uuid` |

---

## 6. ASCII Wireframes

### 6.1 Overview Page

```
+======================================================================+
|  [<- Admin]   Observability                              [v] 24h     |
|               Conversation Analytics                                  |
+======================================================================+
|                                                                       |
|  [Filter: Time Range v] [Filter: Project v] [Filter: Org v] [Clear] |
|                                                                       |
|  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   |
|  │ Conversations│ │ Error Rate  │ │ P50 Latency │ │ Total Cost  │   |
|  │     342      │ │    3.2%     │ │    4.2s     │ │   $12.84    │   |
|  │   +12% ^^^^^ │ │  -0.5% vvv │ │  +0.8s ^^^^ │ │  +18% ^^^^  │   |
|  │   (vs 7d ago)│ │   (vs 7d)  │ │  sparkline  │ │  (vs 7d)   │   |
|  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   |
|                                                                       |
|  ┌───────────────────────────────────────────────────────────────┐   |
|  │  Conversation Volume                                          │   |
|  │  ·                                                            │   |
|  │  ·    ·        ·                                              │   |
|  │  · ·  · ·   ·  ·  ·      ·                                   │   |
|  │  ····· ···  ·· ···· ···  · ··  ·                              │   |
|  │  ··········  ······· ······ ···· ·                             │   |
|  │  ──────────────────────────────────── time                    │   |
|  └───────────────────────────────────────────────────────────────┘   |
|                                                                       |
|  ┌─────────────────────────────┐ ┌─────────────────────────────┐    |
|  │  Latency (P50 / P95)       │ │  Error Trend                │    |
|  │                             │ │                             │    |
|  │  --- P50                    │ │  ████                       │    |
|  │  ··· P95                    │ │  ████ ██                    │    |
|  │       ···                   │ │  ████ ████ ██              │    |
|  │  ---···---···               │ │  ─────────────── time      │    |
|  │  ──────────── time          │ │                             │    |
|  └─────────────────────────────┘ └─────────────────────────────┘    |
|                                                                       |
|  ┌─────────────────────────────┐ ┌─────────────────────────────┐    |
|  │  Top Error Tools            │ │  Model Distribution         │    |
|  │                             │ │                             │    |
|  │  semantic_search ████████ 8 │ │       ┌───┐                │    |
|  │  execute_sql     █████  5   │ │      /sonnet\              │    |
|  │  browse_emails   ███    3   │ │     | 68%  |              │    |
|  │  file_upload     ██     2   │ │      \haiku/              │    |
|  │  send_email      █      1   │ │       └───┘                │    |
|  └─────────────────────────────┘ └─────────────────────────────┘    |
|                                                                       |
|  [View all conversations ->]                                         |
+======================================================================+
```

### 6.2 Conversations List Page

```
+======================================================================+
|  [<- Admin]   Observability > Conversations              [v] 24h     |
+======================================================================+
|                                                                       |
|  ┌────────────────────────────────────────────────────────────────┐  |
|  │ [Time: Last 24h v] [Project: All v] [Model: All v]           │  |
|  │ [Status: All / Errors / Success]  [Auth: All / Key / OAuth]  │  |
|  │ [Search: claude_session_id...              ]    [Clear All]   │  |
|  └────────────────────────────────────────────────────────────────┘  |
|                                                                       |
|  Showing 1-50 of 342 conversations                                   |
|                                                                       |
|  ┌──┬───────────┬──────────────┬──────────┬───────┬──────┬───────┐  |
|  │St│ Time    v │ User         │ Project  │ Model │Turns │Tools  │  |
|  │  │           │              │          │       │      │       │  |
|  │  │           │              │          │       │      │       │  |
|  │  │ Duration  │ Cost         │ Tokens   │ Auth  │      │       │  |
|  ├──┼───────────┼──────────────┼──────────┼───────┼──────┼───────┤  |
|  │● │ 3m ago    │ jane@co.com  │ Acme Q3  │sonnet │  5   │ 12/14 │  |
|  │  │ 12.4s     │ $0.0089      │ 2.1k+1.4k│ oauth │      │       │  |
|  ├──┼───────────┼──────────────┼──────────┼───────┼──────┼───────┤  |
|  │● │ 15m ago   │ bob@co.com   │ Budget   │haiku  │  2   │  4/4  │  |
|  │  │ 3.1s      │ $0.0012      │ 0.8k+0.3k│ key  │      │       │  |
|  ├──┼───────────┼──────────────┼──────────┼───────┼──────┼───────┤  |
|  │● │ 22m ago   │ alice@co.com │ Legal    │sonnet │  8   │ 6/9   │  |
|  │  │ 45.3s     │ $0.0234      │ 5.2k+3.1k│ oauth │      │       │  |
|  ├──┼───────────┼──────────────┼──────────┼───────┼──────┼───────┤  |
|  │● │ 1h ago    │ dave@co.com  │ Acme Q3  │sonnet │  1   │  0/0  │  |
|  │  │ 1.2s      │ $0.0003      │ 0.2k+0.1k│ oauth │      │       │  |
|  └──┴───────────┴──────────────┴──────────┴───────┴──────┴───────┘  |
|                                                                       |
|  Legend: ● OK   ● Error   ● Partial (tool errors)   ○ Incomplete    |
|                                                                       |
|  [<- Previous]                Page 1 of 7              [Next ->]     |
+======================================================================+
```

**Row design note**: Each conversation occupies two visual lines within one table row. The first line has the primary identifiers (time, user, project, model, turns, tools). The second line has the secondary metrics (duration, cost, tokens, auth). This two-line layout keeps the table narrow enough to avoid horizontal scrolling while showing all the inline metrics that make rows scannable.

### 6.3 Conversation Detail Page (The Hero Page)

```
+======================================================================+
|  [<- Conversations]   Observability > Conversations > abc123...      |
+======================================================================+
|                                                                       |
|  Conversation abc123-def456-7890                    [Copy ID] [->S]  |
|  User: jane@company.com     Project: Acme Q3 Report                  |
|  Started: Feb 21, 2026 14:30:42 UTC     Auth: OAuth                  |
|  Session: claude_sess_xyz789                                         |
|                                                                       |
|  ┌──────────┐ ┌───────────────┐ ┌──────────┐ ┌──────────────┐       |
|  │ Duration │ │    Tokens     │ │   Cost   │ │    Model     │       |
|  │  12.4s   │ │  2,140 in    │ │ $0.0089  │ │   sonnet     │       |
|  │          │ │  1,380 out   │ │          │ │              │       |
|  │          │ │    820 cache │ │          │ │              │       |
|  └──────────┘ └───────────────┘ └──────────┘ └──────────────┘       |
|                                                                       |
|  ═══════════════════ WATERFALL TIMELINE ═════════════════════════    |
|                                                                       |
|  TIME AXIS   0s        3s        6s        9s       12.4s            |
|              |─────────|─────────|─────────|─────────|               |
|                                                                       |
|  v TURN 0   [Assistant]                                    820ms     |
|    "I'll search for that information in your..."                     |
|    ┌────────────────────────────────────────┐                        |
|    │████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│                       |
|    └────────────────────────────────────────┘                        |
|      [T] semantic_search                            450ms    OK  3   |
|      ┌────────────────────────────────────────┐                      |
|      │░░██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│                     |
|      └────────────────────────────────────────┘                      |
|      [T] browse_emails                              320ms    OK  7   |
|      ┌────────────────────────────────────────┐                      |
|      │░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│                     |
|      └────────────────────────────────────────┘                      |
|                                                                       |
|  v TURN 1   [Assistant]                                  3,200ms     |
|    "Based on the search results, I found..."                         |
|    ┌────────────────────────────────────────┐                        |
|    │░░░░░░░░████████████████████░░░░░░░░░░░░│                       |
|    └────────────────────────────────────────┘                        |
|      [T] semantic_search                          1,800ms    OK  5   |
|      ┌────────────────────────────────────────┐                      |
|      │░░░░░░░░░████████████████░░░░░░░░░░░░░░│                     |
|      └────────────────────────────────────────┘                      |
|      [T] execute_sql                                680ms   ERR  --  |
|      ┌────────────────────────────────────────┐                      |
|      │░░░░░░░░░░░░░░░░░░████░░░░░░░░░░░░░░░░│  <-- RED BAR         |
|      └────────────────────────────────────────┘                      |
|                                                                       |
|  v TURN 2   [Assistant]                                  2,100ms     |
|    "Here's a summary of the quarterly..."                            |
|    ┌────────────────────────────────────────┐                        |
|    │░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░│                       |
|    └────────────────────────────────────────┘                        |
|    (no tool calls)                                                    |
|                                                                       |
|  ═══════════════════ DETAIL PANEL ══════════════════════════════    |
|                                                                       |
|  ┌────────────────────────────────────────────────────────────────┐  |
|  │  execute_sql  (Turn 1, Seq 1)                      [X] Close │  |
|  │──────────────────────────────────────────────────────────────│  |
|  │  Duration: 680ms    Results: --    Status: ERROR              │  |
|  │                                                               │  |
|  │  [Input]  [Error]                                             │  |
|  │                                                               │  |
|  │  ┌─ Error ──────────────────────────────────────────────────┐│  |
|  │  │  relation "nonexistent_table" does not exist             ││  |
|  │  │  LINE 1: SELECT * FROM nonexistent_table WHERE id = $1   ││  |
|  │  └─────────────────────────────────────────────────────────┘│  |
|  │                                                               │  |
|  │  ┌─ Input JSON ────────────────────────────────────────────┐ │  |
|  │  │  {                                                       │ │  |
|  │  │    "query": "SELECT * FROM nonexistent_table ...",       │ │  |
|  │  │    "project_id": "abc-123-def"                           │ │  |
|  │  │  }                                                       │ │  |
|  │  └─────────────────────────────────────────────────────────┘ │  |
|  └────────────────────────────────────────────────────────────────┘  |
|                                                                       |
+======================================================================+
```

### 6.4 Tools Analytics Page

```
+======================================================================+
|  [<- Admin]   Observability > Tools                      [v] 7d      |
+======================================================================+
|                                                                       |
|  [Filter: Time Range v] [Filter: Project v]              [Clear]     |
|                                                                       |
|  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   |
|  │ Total Calls │ │ Unique Tools│ │ Error Rate  │ │ P50 Latency │   |
|  │   1,847     │ │     12      │ │    4.1%     │ │   380ms     │   |
|  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   |
|                                                                       |
|  ┌────────────────────────────────────────────────────────────────┐  |
|  │ Tool               │ Calls │ Errors │ Rate  │ P50   │ P95    │  |
|  ├────────────────────┼───────┼────────┼───────┼───────┼────────┤  |
|  │ semantic_search     │   682 │     8  │ 1.2%  │ 420ms │ 1.8s  │  |
|  │ ^^^^^ sparkline     │       │        │       │       │        │  |
|  ├────────────────────┼───────┼────────┼───────┼───────┼────────┤  |
|  │ browse_emails       │   445 │    12  │ 2.7%  │ 310ms │ 890ms │  |
|  │ ^^^^ sparkline      │       │        │       │       │        │  |
|  ├────────────────────┼───────┼────────┼───────┼───────┼────────┤  |
|  │ execute_sql         │   234 │    32  │ 13.7% │ 180ms │ 2.1s  │  |
|  │ ^^^ sparkline       │       │        │ (RED) │       │ (RED) │  |
|  ├────────────────────┼───────┼────────┼───────┼───────┼────────┤  |
|  │ file_upload         │   189 │     5  │ 2.6%  │ 890ms │ 3.2s  │  |
|  │ ^^ sparkline        │       │        │       │       │        │  |
|  ├────────────────────┼───────┼────────┼───────┼───────┼────────┤  |
|  │ send_email          │    97 │    18  │ 18.6% │ 220ms │ 1.1s  │  |
|  │ ^ sparkline         │       │        │ (RED) │       │        │  |
|  └────────────────────┴───────┴────────┴───────┴───────┴────────┘  |
|                                                                       |
|  ┌───────────────────────────────────────────────────────────────┐   |
|  │  Tool Latency Comparison (P50 / P95)                          │   |
|  │                                                                │   |
|  │  semantic_search  ████████ | ██████████████████               │   |
|  │  browse_emails    ██████   | ████████████                     │   |
|  │  execute_sql      ████     | ██████████████████████           │   |
|  │  file_upload      ████████████ | ██████████████████████████████│   |
|  │  send_email       █████    | █████████████                    │   |
|  │                                                                │   |
|  │  Legend: ████ P50    | ████ P95                                │   |
|  └───────────────────────────────────────────────────────────────┘   |
|                                                                       |
+======================================================================+
```

---

## 7. Routes

### 7.1 Next.js File Structure

```
nextjs-app/app/admin/observability/
  page.tsx                          # Overview — redirect or render overview
  layout.tsx                        # NOT USED — follow existing admin pattern (no shared layout)
  conversations/
    page.tsx                        # Conversations list
    [id]/
      page.tsx                      # Conversation detail (waterfall)
  tools/
    page.tsx                        # Tools analytics
```

### 7.2 Route Table

| Route | File | Type | Purpose |
|-------|------|------|---------|
| `/admin/observability` | `app/admin/observability/page.tsx` | Server Component | Overview dashboard with KPIs and charts |
| `/admin/observability/conversations` | `app/admin/observability/conversations/page.tsx` | Server Component (initial fetch) + Client Component (table) | Filterable conversations list |
| `/admin/observability/conversations/[id]` | `app/admin/observability/conversations/[id]/page.tsx` | Server Component (fetch) + Client Component (waterfall) | Conversation detail with waterfall timeline |
| `/admin/observability/tools` | `app/admin/observability/tools/page.tsx` | Server Component (fetch) + Client Component (table + charts) | Per-tool RED metrics |

### 7.3 Server Actions

```
nextjs-app/app/actions/admin-observability.ts
```

| Action | Purpose | Query Pattern |
|--------|---------|---------------|
| `getObservabilityOverview(range, filters)` | KPI cards + chart data for overview | Aggregated queries on all 3 tables |
| `getConversations(range, filters, sort, page)` | Paginated conversation list with inline metrics | `agent_usage` + correlated subqueries |
| `getConversationDetail(id)` | Full conversation tree (metadata + turns + tools) | `agent_usage` + `turns` + `tool_observations` JOIN |
| `getToolsAnalytics(range, filters)` | Per-tool aggregations | `tool_observations` grouped by `tool_name` |
| `getConversationCount(range, filters)` | Total count for pagination | `COUNT(*)` on `agent_usage` |

### 7.4 Component Files

```
nextjs-app/components/admin/observability/
  overview/
    kpi-cards.tsx                    # 4 KPI stat cards with deltas + sparklines
    volume-chart.tsx                 # Conversation volume time-series (recharts)
    latency-chart.tsx                # P50/P95 latency time-series (recharts)
    cost-chart.tsx                   # Cost bar chart (recharts)
    error-trend.tsx                  # Error rate area chart (recharts)
    top-error-tools.tsx              # Horizontal bar: top 5 error-prone tools
    model-distribution.tsx           # Donut chart: model usage breakdown
  conversations/
    conversations-table.tsx          # Main table with sort, filter, pagination
    conversation-row.tsx             # Single row component with two-line layout
    conversation-filters.tsx         # Filter bar component
    status-dot.tsx                   # Color-coded status indicator
  detail/
    conversation-header.tsx          # Metadata header with 4 metric cards
    waterfall-timeline.tsx           # The hero component: nested turn/tool timeline
    waterfall-turn-row.tsx           # Single turn row with timing bar
    waterfall-tool-row.tsx           # Single tool call row with timing bar (indented)
    timing-bar.tsx                   # Proportional horizontal bar component
    detail-panel.tsx                 # Expandable detail panel (turn or tool)
    turn-detail.tsx                  # Turn detail content (text, thinking, sentry)
    tool-detail.tsx                  # Tool detail content (input JSON, error)
    time-axis.tsx                    # Horizontal time scale with tick marks
  tools/
    tools-table.tsx                  # Per-tool metrics table with sparklines
    tool-latency-chart.tsx           # Grouped bar chart: P50/P95 per tool
  shared/
    filter-bar.tsx                   # Reusable filter bar (time range, project, etc.)
    time-range-select.tsx            # Time range preset selector
    metric-card.tsx                  # Reusable KPI card (value + delta + sparkline)
    sparkline.tsx                    # Tiny inline chart for table cells and KPI cards
```

### 7.5 Integration Points

To integrate the new dashboard into the existing admin hub:

1. **Admin hub card** — Add to `adminPages` array in `/admin/page.tsx`:
```typescript
{
  title: "Observability",
  description: "Conversation analytics, tool performance, cost tracking",
  href: "/admin/observability",
  icon: Activity,  // from lucide-react
  gradient: "from-violet-600 to-indigo-600",
}
```

2. **Admin FAB petal** — Add to `petals` array in `admin-fab.tsx`:
```typescript
{ route: "/admin/observability", icon: Activity, label: "Observability" }
```

3. **Chart library** — Install recharts:
```bash
cd nextjs-app && bun add recharts
```

---

## 8. Design Principles Summary

These principles guided every decision above:

1. **Conversation-first**: The primary navigational entity is the conversation (agent_usage), not individual API calls. Users think "what happened in that conversation?" not "show me turn #3."

2. **Scannable rows**: Every conversation table row communicates health through status dots, duration heat coloring, and tool call fractions — no clicking required to triage.

3. **Proportional timing**: The waterfall view uses proportional bar widths so that long operations visually dominate. You can spot where time was spent at a glance, exactly like Langfuse's trace view.

4. **Progressive disclosure**: Overview shows KPIs. Conversations list shows inline metrics. Conversation detail shows the full tree. Tool detail shows raw JSON. Each click reveals more depth.

5. **Lazy loading**: The conversations list does NOT fetch tool_input JSONB. The conversation detail fetches turns and tools but does NOT render full JSON until a tool call is clicked. This keeps page loads fast.

6. **URL-encoded state**: Every filter, sort, page, and selection is in the URL. Debug sessions are shareable by pasting a link.

7. **Follow existing patterns**: Admin guard pattern, gradient background, sticky header, server component fetch + client component render, shadcn/ui components, Lucide icons. No architectural novelty — just good dashboard design on proven patterns.

8. **Two-level nesting only**: Our data model has exactly two nesting levels (turns contain tool calls). We don't pretend to support arbitrary depth. This makes the waterfall implementation straightforward and the visual design clean.
