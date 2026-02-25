# Phase 02: Design — Conversation-Centric Admin Usage Page

## 1. Data Hierarchy

### Layer 1: Conversation (grouped by `claude_session_id`)

Each row in the list table represents one **conversation** — all `agent_usage` rows that share the same `claude_session_id`. This is the primary entity the admin sees.

```
Conversation (claude_session_id)
  ├── agent_usage row 1 (user message #1)
  │     ├── turn 0 (assistant response)
  │     ├── turn 1 (tool call + response)
  │     └── turn 2 (final response)
  ├── agent_usage row 2 (user message #2)
  │     ├── turn 0
  │     └── turn 1
  └── agent_usage row 3 (user message #3)
        └── turn 0
```

### Layer 2: Exchanges (agent_usage rows within a conversation)

Each `agent_usage` row = one user message -> Claude response cycle. Within a conversation drill-down, these are shown as sequential "exchanges."

### Layer 3: Turns within each exchange

Each turn = one Claude API call/response cycle within an exchange (multi-turn tool use loops). Turns that have `tool_observations` rows are marked with tool info (tool name, success/error status, duration).

### Why `claude_session_id` grouping, not the `conversations` table

The `conversations` table is an option, but it has significant limitations:
1. **Not always populated** — only written when a stream completes successfully (`ResultMessage` arrives). Failed/disconnected streams have `agent_usage` rows but no `conversations` row.
2. **Missing turn/tool data** — only has aggregate token counts, no link to turns or tool_observations.
3. **Different write path** — written by `conversation_service.py`, not `usage_service.py`. They can disagree.

Grouping `agent_usage` by `claude_session_id` is more reliable because:
- `agent_usage` is created early (before streaming starts)
- Even failed streams have `agent_usage` rows
- The turns and tool_observations FK chain goes through `agent_usage`, not `conversations`

We can **enrich** with `conversations` data (e.g., `storage_path` for JSONL link, `message_count`) but the primary grouping should be `agent_usage.claude_session_id`.

---

## 2. Aggregation Approach

### Decision: SQL View (DB-level aggregation)

**Recommendation: Create a Postgres VIEW `conversation_summary` that does the grouping and aggregation.**

#### The View

```sql
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
  COALESCE(au.claude_session_id, au.id::text) AS conversation_id,
  -- Use claude_session_id as group key; fall back to agent_usage.id for orphans

  -- Metadata (from first exchange in conversation)
  (ARRAY_AGG(au.user_id ORDER BY au.created_at))[1] AS user_id,
  (ARRAY_AGG(au.project_id ORDER BY au.created_at))[1] AS project_id,
  (ARRAY_AGG(au.organization_id ORDER BY au.created_at))[1] AS organization_id,
  (ARRAY_AGG(au.model ORDER BY au.created_at DESC))[1] AS model,
  -- Use most recent model (conversations can span model changes)

  -- Aggregates
  COUNT(*)::int AS exchange_count,
  SUM(au.num_turns)::int AS total_turns,
  SUM(COALESCE(au.cost_usd, 0))::numeric(10,6) AS total_cost_usd,
  AVG(au.duration_ms)::int AS avg_duration_ms,
  MAX(au.duration_ms)::int AS max_duration_ms,
  SUM(au.input_tokens)::int AS total_input_tokens,
  SUM(au.output_tokens)::int AS total_output_tokens,

  -- Status
  BOOL_OR(au.is_error) AS has_error,
  COUNT(*) FILTER (WHERE au.is_error)::int AS error_count,
  BOOL_OR(au.duration_ms IS NULL) AS has_incomplete,

  -- Time range
  MIN(au.created_at) AS first_exchange_at,
  MAX(au.created_at) AS last_exchange_at

FROM agent_usage au
GROUP BY COALESCE(au.claude_session_id, au.id::text);
```

#### Pros of SQL View

| Factor | SQL View | JS Grouping |
|--------|----------|-------------|
| **Performance** | DB does aggregation, sends fewer rows over wire | Must fetch ALL agent_usage rows, group in JS |
| **Pagination** | `LIMIT/OFFSET` on grouped results works natively | Must fetch all, group, then paginate in JS |
| **Sorting** | `ORDER BY total_cost_usd DESC` works on aggregates | Must compute all aggregates before sorting |
| **Filtering** | `WHERE first_exchange_at >= $1` uses indexes | Post-filter after full scan |
| **KPI stats** | Can wrap view in another aggregate query | Already doing JS aggregation (acceptable) |
| **Consistency** | Single source of truth | Duplicated logic across server actions |
| **Maintenance** | One migration to create, one to change | Changes spread across multiple functions |
| **RLS** | Queried via service-role client; RLS does not apply to this view | Same auth check in every action |
| **Deployment** | Requires migration (auto-applies on staging/prod) | Pure code change, no migration |

#### Cons of SQL View

- Adds a migration (but auto-applies via Supabase GitHub integration)
- View performance depends on underlying indexes (already exist: `idx_agent_usage_claude_session_id`, `idx_agent_usage_created_at`)
- Can't use Supabase client `.from("conversation_summary")` without adding it to types (need `bunx supabase gen types`)

**Verdict: SQL view wins.** The current JS approach fetches all rows and aggregates in memory — it won't scale. Pagination on grouped results is impossible in JS without fetching everything first. The view makes the common case (list page with filters) fast and clean.

#### Tool stats — keep as a secondary query

Tool call counts per conversation require joining through `turns` to `tool_observations`. Including this in the view would make it expensive (triple join + aggregation). Instead:

1. Main query: `SELECT * FROM conversation_summary WHERE ... ORDER BY ... LIMIT 25`
2. Secondary query: For those 25 conversations, fetch tool stats via `agent_usage` -> `turns` -> `tool_observations` (same pattern as today but scoped to the page)

This keeps the view fast for sorting/filtering while still showing tool info.

#### KPI stats — aggregate over the view

```sql
SELECT
  COUNT(*) AS total_conversations,
  COUNT(*) FILTER (WHERE has_error) AS error_conversations,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_duration_ms) AS median_avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_duration_ms) AS p95_avg_duration,
  SUM(total_cost_usd) AS total_cost
FROM conversation_summary
WHERE first_exchange_at >= $1;
```

This replaces the current `getUsageStats` which fetches all rows into JS.

---

## 3. Component Structure

### Current: 17 components

```
List page:
  UsagePageClient → FilterBar, KpiCards, ConversationsTable → ConversationRow, ToolBreakdownTable

Detail page:
  ConversationDetailClient → ConversationHeader, WaterfallTimeline → WaterfallTurnRow → WaterfallToolRow → ToolDetailPanel
```

### Proposed: 18 components (restructured)

Keep most existing components. The detail page waterfall components are well-built and largely reusable. The main changes are to the list page and an intermediate drill-down level.

#### List Page (`/admin/usage`)

```
UsagePageClient                          [MODIFY — update prop types]
  ├── FilterBar                          [KEEP — unchanged]
  ├── KpiCards                           [MODIFY — update labels: "Conversations" not "Exchanges"]
  ├── ConversationsTable                 [MODIFY — columns change, row = conversation not exchange]
  │     └── ConversationRow              [REWRITE — show conversation-level aggregates]
  └── ToolBreakdownTable                 [KEEP — unchanged (already global tool stats)]
```

**ConversationsTable changes:**
- Columns: Status | Time (first exchange) | User | Project | Model | Exchanges | Turns | Avg Duration | Max Duration | Cost
- Row click navigates to `/admin/usage/c/{conversation_id}` (new route)
- Sort on: `first_exchange_at`, `total_turns`, `avg_duration_ms`, `max_duration_ms`, `total_cost_usd`

**ConversationRow changes (rewrite):**
- Status: green (all OK), red (any error), amber (any incomplete), hollow (all incomplete)
- Shows exchange count as "3 msgs" not just a turn count
- Cost is conversation total
- Duration shows avg and max (e.g., "1.2s avg / 4.5s max")

#### Conversation Detail Page (`/admin/usage/c/{conversation_id}`) — **NEW ROUTE**

This is a **new intermediate page** between the list and the current exchange detail.

```
ConversationDetailPage                   [NEW — server component, new route]
  └── ConversationDetailClient           [NEW — client component]
        ├── ConversationHeader           [MODIFY — show conversation-level metadata]
        ├── ExchangeList                 [NEW — list of agent_usage rows in this conversation]
        │     └── ExchangeRow            [NEW — one row per agent_usage, expandable]
        │           ├── ExchangeTurnList [NEW — inline turn list (collapsed by default)]
        │           │     └── TurnRow    [NEW — simplified turn row, not waterfall]
        │           └── (link to full waterfall view)
        └── ConversationToolSummary      [NEW — tool stats for this conversation only]
```

**Drill-down UX flow:**

```
List Page (/admin/usage)
  → Click conversation row
  → Conversation Detail (/admin/usage/c/{conversation_id})
      Shows: header metadata, list of exchanges (agent_usage rows)
      Each exchange: expandable inline to show turns + tool calls
      → Click "View waterfall" on an exchange
      → Exchange Detail (/admin/usage/{agent_usage_id})  [EXISTING page, unchanged]
          Shows: full waterfall timeline for that single exchange
```

#### Existing Detail Page (`/admin/usage/[id]`) — **KEEP AS-IS**

The existing waterfall detail page for a single `agent_usage` row stays unchanged. It becomes the deepest drill-down level. No component changes needed.

#### Component Changes Summary

| Component | Action | Notes |
|-----------|--------|-------|
| `usage-page-client.tsx` | MODIFY | Update prop types for conversation-level data |
| `filter-bar.tsx` | KEEP | No changes needed |
| `kpi-cards.tsx` | MODIFY | Update labels ("Conversations" not "Exchanges"), add new KPIs |
| `conversations-table.tsx` | MODIFY | New columns, new sort options, new route target |
| `conversation-row.tsx` | REWRITE | Conversation-level aggregates instead of exchange-level |
| `tool-breakdown-table.tsx` | KEEP | Already shows global tool stats |
| `status-dot.tsx` | KEEP | Works for conversations too |
| `utils.ts` | MODIFY | Add `formatExchangeCount()` helper |
| `detail/conversation-detail-client.tsx` | KEEP | Rename internally for clarity, but it stays for exchange-level detail |
| `detail/conversation-header.tsx` | KEEP | Used by exchange detail page |
| `detail/waterfall-timeline.tsx` | KEEP | No changes |
| `detail/waterfall-turn-row.tsx` | KEEP | No changes |
| `detail/waterfall-tool-row.tsx` | KEEP | No changes |
| `detail/tool-detail-panel.tsx` | KEEP | No changes |
| `detail/timing-bar.tsx` | KEEP | No changes |
| `detail/time-axis.tsx` | KEEP | No changes |
| `detail/copy-button.tsx` | KEEP | No changes |

#### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `conversation-detail-page.tsx` | `components/admin/usage/conversation/` | Client wrapper for conversation-level detail |
| `conversation-overview-header.tsx` | `components/admin/usage/conversation/` | Header with conversation-level metadata + aggregates |
| `exchange-list.tsx` | `components/admin/usage/conversation/` | List of agent_usage rows in the conversation |
| `exchange-row.tsx` | `components/admin/usage/conversation/` | Single exchange row, expandable to show turns inline |

#### New Route

| Route | File |
|-------|------|
| `/admin/usage/c/[conversationId]` | `nextjs-app/app/admin/usage/c/[conversationId]/page.tsx` |

Using `/c/` prefix to distinguish from the existing `/admin/usage/[id]` which takes an agent_usage UUID. The `conversationId` is a `claude_session_id` string (not a UUID).

---

## 4. Server Actions Changes

### Current: 5 server actions

1. `getUsageStats(range, projectId)` — Fetches all agent_usage rows, computes stats in JS
2. `getConversations(range, projectId, sort, dir, page)` — Paginated agent_usage + N+1 lookups
3. `getToolBreakdown(range, projectId)` — All tool_observations, JS aggregation
4. `getProjectOptions()` — Distinct project IDs
5. `getConversationDetail(id)` — Single agent_usage + turns + tools

### Proposed: 6 server actions

1. **`getConversationStats(range, projectId)`** — REPLACE `getUsageStats`. Aggregates over `conversation_summary` view in SQL.
2. **`getConversationsList(range, projectId, sort, dir, page)`** — REPLACE `getConversations`. Paginated query on `conversation_summary` view + tool stats secondary query + batch user email lookup.
3. **`getToolBreakdown(range, projectId)`** — KEEP. Already correct (global tool stats).
4. **`getProjectOptions()`** — KEEP. Already correct.
5. **`getConversationOverview(conversationId)`** — NEW. For the conversation detail page. Branches on ID format: if `conversationId` is a valid UUID, fetch the single `agent_usage` row by `id` (orphan row whose `claude_session_id` was NULL); otherwise, treat it as a `claude_session_id` and fetch all matching `agent_usage` rows with their turns and tool observations.
6. **`getConversationDetail(id)`** — KEEP. Single exchange detail (waterfall page).

### User email lookup optimization

Replace N individual `auth.admin.getUserById()` calls with a single `auth.admin.listUsers()` filtered query, or batch the unique user IDs. The Supabase admin API supports `listUsers` with pagination — for a page of 25 conversations with likely < 10 unique users, one call suffices.

Alternatively, if we add a `profiles` or `user_emails` cache table (populated by trigger on auth.users), we can join directly in the view. But that's a larger change — defer to a later phase.

**Short-term fix:** Batch `Promise.all` on unique user IDs (already done, but sequentially for some paths). Ensure all paths use the batched approach.

---

## 5. Edge Cases

### 5.1 agent_usage rows without `claude_session_id` (NULL)

Since migration `20260221132457`, `claude_session_id` can be NULL. This happens when:
- Stream started but never completed (no `ResultMessage` arrived)
- Early persistence wrote the row before session ID was available

**Handling:**
- In the SQL view: `COALESCE(claude_session_id, id::text)` — orphan rows become their own "conversation" of 1 exchange
- In the UI: Show these as single-exchange conversations with a visual indicator (e.g., "orphan" badge or hollow status dot)
- In the conversation detail page: If `conversation_id` is a UUID (not a session ID), fetch the single agent_usage row directly
- Sorting/filtering works the same — they just have `exchange_count = 1`

### 5.2 Conversations with only 1 agent_usage row

Common case: user asks one question and leaves. These are valid conversations.

**Handling:**
- Display normally in the list — no special treatment needed
- Exchange count shows "1 msg"
- Conversation detail page shows a single exchange (which can expand to show turns)
- Avg/max duration are the same (just show one value or "1.2s" without avg/max distinction)

### 5.3 Empty turns (agent_usage row with no turn rows in `turns` table)

Happens when:
- Stream died before any `turn_complete` event fired
- Legacy data from before the `turns` table existed (pre-February 2026)

**Handling:**
- In conversation detail: Show the exchange row with metadata (model, cost, duration from agent_usage) but "No turn data recorded" in the expandable section
- In the waterfall page: Already handled — shows "No turn data recorded for this conversation"
- In the list page: No impact — conversation-level aggregates come from agent_usage, not turns

### 5.4 Very large conversations (many exchanges)

A conversation with 50+ user messages (e.g., a long debugging session) would have 50+ agent_usage rows.

**Handling:**
- The conversation detail page should paginate exchanges if > 20 (with "Load more" or pagination)
- The list page is unaffected (aggregation happens in the view)

### 5.5 `conversations` table has a row but no matching agent_usage rows

Theoretically possible if data was manually inserted or if there's a bug in the write path.

**Handling:**
- The view is based on `agent_usage`, so this conversation simply won't appear
- This is acceptable — the admin page is about usage tracking, not conversation persistence
- If needed later, a LEFT JOIN from `conversations` could surface these

### 5.6 Multiple models within a single conversation

A user might start with Haiku and switch to Sonnet mid-conversation.

**Handling:**
- The view uses `(ARRAY_AGG(au.model ORDER BY au.created_at DESC))[1]` — shows the most recent model
- The conversation detail page shows the model per exchange, so the full picture is visible
- The list page model badge shows the dominant/latest model with a visual hint if mixed (e.g., "sonnet +1")

### 5.7 Sorting on `conversation_summary` view

Some sort options need to change:
- `created_at` → `first_exchange_at` (when conversation started)
- `duration_ms` → `avg_duration_ms` or `max_duration_ms` (user choice or default to max)
- `cost_usd` → `total_cost_usd`
- `num_turns` → `total_turns`

New sort option: `exchange_count` (conversations with most back-and-forth)

---

## 6. Migration Plan

### Phase 1: Create the SQL view (migration)

```sql
-- Create conversation_summary view
CREATE OR REPLACE VIEW conversation_summary AS ...;
-- No RLS needed: queried via service-role client (getSupabaseAdmin)
```

### Phase 2: Add new route + components

1. Create `/admin/usage/c/[conversationId]/page.tsx`
2. Create `components/admin/usage/conversation/` directory with new components
3. Add `getConversationOverview()` server action

### Phase 3: Modify list page

1. Replace `getConversations` → `getConversationsList` (queries view)
2. Replace `getUsageStats` → `getConversationStats` (aggregates over view)
3. Update `ConversationsTable` and `ConversationRow` for new data shape
4. Update `KpiCards` labels
5. Change row click target from `/admin/usage/{id}` to `/admin/usage/c/{conversationId}`

### Phase 4: Cleanup

1. Remove unused server action code (old `getConversations`, old `getUsageStats`)
2. Remove unused type exports
3. Regenerate Supabase types (`bunx supabase gen types typescript --local`)

---

## 7. What We Are NOT Changing

- **The `conversations` table** — it stays as-is for JSONL persistence. We don't add a FK to agent_usage.
- **The Python write path** — no backend changes. The view reads existing data.
- **The waterfall detail page** — it works well for single-exchange analysis.
- **The tool_breakdown_table** — global tool stats stay the same.
- **RLS policies** — the view is queried via service-role client, so RLS does not apply.

---

## 8. Type Changes

### New types (add to admin-usage.ts)

```typescript
// Conversation-level row for the list page
export interface ConversationSummaryRow {
  conversationId: string;       // claude_session_id or agent_usage.id for orphans
  userId: string;
  userEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  model: string;
  exchangeCount: number;
  totalTurns: number;
  totalCostUsd: number | null;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  hasError: boolean;
  errorCount: number;
  hasIncomplete: boolean;
  firstExchangeAt: string;
  lastExchangeAt: string;
  totalToolCalls: number | null;
  failedToolCalls: number | null;
}

// For the conversation detail page
export interface ConversationOverview {
  conversationId: string;
  userId: string;
  userEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  organizationId: string | null;
  exchanges: ExchangeSummary[];
  totalCostUsd: number | null;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  firstExchangeAt: string;
  lastExchangeAt: string;
}

export interface ExchangeSummary {
  id: string;                   // agent_usage.id
  model: string;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number;
  isError: boolean;
  authMode: string | null;
  createdAt: string;
  turns: Array<{
    turn: TurnRow;
    toolCalls: ToolObservationRow[];
  }>;
}
```

### Modified types

- `ConversationsPage` → `ConversationsPage` (same name, but `conversations` field type changes to `ConversationSummaryRow[]`)
- `PeriodStats` → Add `totalConversations` field, rename `total` to `totalExchanges` (or keep both)
