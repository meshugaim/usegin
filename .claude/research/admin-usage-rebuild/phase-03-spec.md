# Phase 03: Implementation Spec — Admin Usage Page Rebuild

Conversation-first rebuild of `/admin/usage`. Replaces agent_usage-per-row list with conversation-grouped view. Five implementation slices, each independently shippable.

## Context

| Doc | Purpose |
|-----|---------|
| `phase-01-research.md` | Architecture deep-dive, file inventory, schema, root cause |
| `phase-01-sanity.md` | Manual testing of current page, data validation |
| `phase-02-design.md` | Full design: SQL view, component hierarchy, server actions, edge cases |

**Read those first.** This spec assumes familiarity with the design.

---

## Data Model Recap

```
agent_usage (1 per user-message exchange)
  └── turns (1 per Claude API call/response within exchange)
       └── tool_observations (1 per MCP tool call within turn)
```

Conversations are implicit: multiple `agent_usage` rows sharing the same `claude_session_id`. Orphan rows (NULL session_id) are self-grouped via `COALESCE(claude_session_id, id::text)`.

---

## Linear Issues

| Slice | Issue | Title |
|-------|-------|-------|
| Parent | ENG-2074 | feat: rebuild /admin/usage -- conversation-first |
| 1 | ENG-2075 | db: create conversation_summary SQL VIEW |
| 2 | ENG-2076 | server-actions: conversation-level data fetching |
| 3 | ENG-2077 | ui: conversation-grouped list page |
| 4 | ENG-2078 | ui: conversation detail page + exchange drill-down |
| 5 | ENG-2079 | ui: turn tool-call marking in exchange rows |

---

## Slice 1: DB Migration — `conversation_summary` VIEW

**Goal:** Create a SQL VIEW that groups `agent_usage` by `claude_session_id` and exposes conversation-level aggregates. All downstream slices depend on this.

### What to build

A single migration file creating the `conversation_summary` VIEW.

```bash
bunx supabase migration new create_conversation_summary_view
```

### VIEW definition (starting point — verify against current schema)

```sql
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
  COALESCE(au.claude_session_id, au.id::text) AS conversation_id,
  (ARRAY_AGG(au.user_id ORDER BY au.created_at))[1] AS user_id,
  (ARRAY_AGG(au.project_id ORDER BY au.created_at))[1] AS project_id,
  (ARRAY_AGG(au.organization_id ORDER BY au.created_at))[1] AS organization_id,
  (ARRAY_AGG(au.model ORDER BY au.created_at DESC))[1] AS model,
  COUNT(*)::int AS exchange_count,
  SUM(au.num_turns)::int AS total_turns,
  SUM(COALESCE(au.cost_usd, 0))::numeric(10,6) AS total_cost_usd,
  AVG(au.duration_ms)::int AS avg_duration_ms,
  MAX(au.duration_ms)::int AS max_duration_ms,
  SUM(au.input_tokens)::int AS total_input_tokens,
  SUM(au.output_tokens)::int AS total_output_tokens,
  BOOL_OR(au.is_error) AS has_error,
  COUNT(*) FILTER (WHERE au.is_error)::int AS error_count,
  BOOL_OR(au.duration_ms IS NULL) AS has_incomplete,
  MIN(au.created_at) AS first_exchange_at,
  MAX(au.created_at) AS last_exchange_at
FROM agent_usage au
GROUP BY COALESCE(au.claude_session_id, au.id::text);
```

### Constraints

- No RLS needed — queried via service-role `getSupabaseAdmin()` client
- Verify existing indexes support efficient GROUP BY: `idx_agent_usage_claude_session_id` already exists
- After creating, run `bunx supabase gen types typescript --local` to regenerate types

### Validation

- `bunx supabase migration up` applies cleanly
- `SELECT * FROM conversation_summary LIMIT 5` returns expected groupings
- Orphan rows (NULL `claude_session_id`) appear as individual conversations
- Type generation succeeds and includes `conversation_summary` in `Database["public"]["Views"]`

### Key files

| File | Role |
|------|------|
| `supabase/migrations/` | New migration goes here (CLI-generated timestamp) |
| `supabase/migrations/20251202000001_create_agent_usage_table.sql` | Source table schema |
| `supabase/migrations/20260221132457_make_claude_session_id_nullable.sql` | NULL session_id context |

---

## Slice 2: Server Actions — New/Modified Data Fetching

**Goal:** Replace `getUsageStats` and `getConversations` with conversation-level equivalents; add `getConversationOverview` for the detail page. Depends on Slice 1.

### Actions to create/modify

| Action | Change | Queries |
|--------|--------|---------|
| `getConversationStats` | REPLACE `getUsageStats` | Aggregate over `conversation_summary` view |
| `getConversationsList` | REPLACE `getConversations` | Paginated query on `conversation_summary` + tool stats + user emails |
| `getConversationOverview` | NEW | Fetch all exchanges for a conversation_id with turns + tools |
| `getToolBreakdown` | KEEP | No changes |
| `getProjectOptions` | KEEP | No changes |
| `getConversationDetail` | KEEP | Single exchange detail (waterfall page) |

### `getConversationStats(range, projectId)`

Replaces the current approach (fetch all `agent_usage` rows, compute percentiles in JS) with SQL aggregation over the view.

Key changes:
- Query `conversation_summary` filtered by `first_exchange_at` range and `project_id`
- Use SQL `PERCENTILE_CONT` for median/P95 of `avg_duration_ms`
- Count conversations (not exchanges) for the primary KPI
- Comparison period: same approach as current, but over the view

Return type changes:
- `PeriodStats.total` becomes total conversations (not exchanges)
- Add `totalExchanges` field for secondary display
- Keep `errors`, `errorRate`, `medianDuration`, `p95Duration`, `totalCost`

### `getConversationsList(range, projectId, sort, dir, page)`

Replaces the current N+1 query pattern with a single paginated view query.

Key changes:
- Query `conversation_summary` directly with `LIMIT/OFFSET`
- Sort columns map to view columns: `first_exchange_at`, `total_turns`, `avg_duration_ms`, `max_duration_ms`, `total_cost_usd`, `exchange_count`
- Tool stats: secondary query — fetch `agent_usage` IDs for the page's conversations, then `turns` -> `tool_observations` (same as current but scoped to conversation IDs, not individual usage IDs)
- User emails: batch `Promise.all` on unique `user_id` values (already done, keep the pattern)
- Project names: batch query on unique `project_id` values (already done, keep the pattern)

Return type changes:
- `ConversationRow` -> `ConversationSummaryRow` with conversation-level fields (see design doc section 8)
- `ConversationsPage.conversations` field type changes accordingly

### `getConversationOverview(conversationId)`

New action for the conversation detail page.

**UUID branching logic:**
- If `conversationId` matches UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`), it's an orphan — fetch single `agent_usage` row by `id`
- Otherwise, it's a `claude_session_id` — fetch all `agent_usage` rows with that session ID

For each `agent_usage` row, fetch:
- `turns` ordered by `turn_index`
- `tool_observations` for those turns

Return type: `ConversationOverview` (see design doc section 8)

### New types to add

See `phase-02-design.md` section 8 for full type definitions:
- `ConversationSummaryRow`
- `ConversationOverview`
- `ExchangeSummary`
- Modified `PeriodStats` (add `totalConversations`)

### Sort column mapping

| Current | New |
|---------|-----|
| `created_at` | `first_exchange_at` |
| `num_turns` | `total_turns` |
| `duration_ms` | `max_duration_ms` (default) |
| `cost_usd` | `total_cost_usd` |
| (new) | `exchange_count` |
| (new) | `avg_duration_ms` |

### Key files

| File | Role |
|------|------|
| `nextjs-app/app/actions/admin-usage.ts` | All server actions live here |
| `nextjs-app/lib/supabase-admin.ts` | `getSupabaseAdmin()` — service-role client |
| `nextjs-app/lib/supabase/types.ts` | `AdminClient` branded type |

### Validation

- All existing tests still pass (no tests for server actions currently — verify with `bun test`)
- Manual test: call `getConversationsList` from page and verify conversation grouping matches expectations
- Orphan rows appear as single-exchange conversations
- Sort on all new columns works
- `getConversationOverview` returns correct data for both UUID (orphan) and session ID paths

---

## Slice 3: Conversation List Page — Replace Exchange List with Conversation List

**Goal:** Modify the list page to show conversations (grouped) instead of individual exchanges. Depends on Slice 2.

### Components to modify

| Component | File | Changes |
|-----------|------|---------|
| `UsagePageClient` | `components/admin/usage/usage-page-client.tsx` | Update prop types, change `handleRowClick` to navigate to `/admin/usage/c/{conversationId}` |
| `KpiCards` | `components/admin/usage/kpi-cards.tsx` | "Exchanges" label -> "Conversations", add secondary "X exchanges" display |
| `ConversationsTable` | `components/admin/usage/conversations-table.tsx` | New columns (Exchanges, Avg Duration, Max Duration), new sort options, update row key |
| `ConversationRowComponent` | `components/admin/usage/conversation-row.tsx` | Rewrite for `ConversationSummaryRow` shape — show exchange count, avg/max duration, conversation cost |
| `utils.ts` | `components/admin/usage/utils.ts` | Add `formatExchangeCount()` helper |

### List page route

| File | Changes |
|------|---------|
| `app/admin/usage/page.tsx` | Call `getConversationStats` instead of `getUsageStats`, `getConversationsList` instead of `getConversations` |

### Table column changes

| Current | New |
|---------|-----|
| Status | Status (green/red/amber/hollow based on `has_error` + `has_incomplete`) |
| Time | Time (`first_exchange_at`) |
| User | User (same) |
| Project | Project (same) |
| Model | Model (most recent model, badge hint if mixed) |
| Turns | Exchanges (count) + Turns (total) |
| Tools | Tools (same secondary query) |
| Duration | Avg / Max duration |
| Cost | Cost (conversation total) |

### Row click target change

Current: `router.push('/admin/usage/${id}')` (agent_usage UUID)
New: `router.push('/admin/usage/c/${conversationId}')` (conversation_id from view)

### Status logic change

Current (`deriveStatus`): checks single row's `durationMs`, `isError`, `failedToolCalls`
New: checks `has_error`, `has_incomplete`, `error_count` from `ConversationSummaryRow`

### Key files

| File | Role |
|------|------|
| `nextjs-app/app/admin/usage/page.tsx` | Server component entry point |
| `nextjs-app/components/admin/usage/usage-page-client.tsx` | Client wrapper |
| `nextjs-app/components/admin/usage/conversations-table.tsx` | Table + pagination |
| `nextjs-app/components/admin/usage/conversation-row.tsx` | Individual row (rewrite) |
| `nextjs-app/components/admin/usage/kpi-cards.tsx` | KPI cards |
| `nextjs-app/components/admin/usage/utils.ts` | Formatting helpers |

### Validation

- List page loads and shows conversation-grouped rows
- Pagination works (25 per page)
- All sort columns work
- Row click navigates to `/admin/usage/c/{conversationId}`
- KPIs show conversation-level stats
- Orphan rows appear as single-exchange conversations
- `bun run build` passes (no type errors)

---

## Slice 4: Conversation Detail Page — New Route + Components

**Goal:** Create the intermediate drill-down page at `/admin/usage/c/[conversationId]`. Depends on Slice 2.

### New route

```
nextjs-app/app/admin/usage/c/[conversationId]/page.tsx
```

Server component that:
1. Verifies admin access (same pattern as existing pages)
2. Calls `getConversationOverview(conversationId)`
3. Renders `ConversationDetailPage`

### New components

All in `nextjs-app/components/admin/usage/conversation/`:

| Component | Purpose |
|-----------|---------|
| `conversation-detail-page.tsx` | Client wrapper. Receives `ConversationOverview` data. Renders header + exchange list. |
| `conversation-overview-header.tsx` | Conversation metadata: user, project, model, total cost, avg/max duration, time range, total tokens. Similar structure to existing `conversation-header.tsx` but for conversation-level aggregates. |
| `exchange-list.tsx` | Ordered list of `ExchangeSummary` items. Each rendered as `ExchangeRow`. If > 20 exchanges, paginate with "Load more". |
| `exchange-row.tsx` | Single exchange: model badge, cost, duration, turn count, error status. Expandable to show turns inline. "View waterfall" link to existing `/admin/usage/{agent_usage_id}` detail page. |

### UX flow

```
/admin/usage                    → Click conversation row
/admin/usage/c/{conversationId} → See header + list of exchanges
                                → Expand exchange to see turns inline
                                → Click "View waterfall" on exchange
/admin/usage/{agent_usage_id}   → Existing waterfall detail page (unchanged)
```

### Back navigation

- Header: "Back to Usage" link -> `/admin/usage` (preserves existing query params via `searchParams`)
- Exchange waterfall link: "Back to Conversation" link -> `/admin/usage/c/{conversationId}`

### Turn display within exchange rows

When an exchange row is expanded, show turns as a simple list (not the full waterfall):
- Turn index, text preview (truncated), duration, tool call count
- Tool calls marked with name + status (see Slice 5)
- This is a lightweight preview; full waterfall is on the existing detail page

### Key files

| File | Role |
|------|------|
| `nextjs-app/app/admin/usage/c/[conversationId]/page.tsx` | New route |
| `nextjs-app/components/admin/usage/conversation/*.tsx` | New components (4 files) |
| `nextjs-app/app/actions/admin-usage.ts` | `getConversationOverview` (from Slice 2) |
| `nextjs-app/app/admin/usage/[id]/page.tsx` | Existing detail page — add "Back to conversation" link |

### Validation

- Navigate to `/admin/usage/c/{session_id}` — see conversation with multiple exchanges
- Navigate to `/admin/usage/c/{uuid}` — see orphan single-exchange conversation
- Expand exchange rows to see turns inline
- "View waterfall" links work
- Back navigation works
- `bun run build` passes

---

## Slice 5: Turn Tool-Call Marking

**Goal:** In the conversation detail page (Slice 4), display tool_observations info on turns within exchange rows. Depends on Slice 4.

### What to show

When a turn has `tool_observations`:
- Tool name badge (e.g., "semantic_search")
- Status: success (green) or error (red) with error message tooltip
- Duration of each tool call
- Result count (if available)

### Where it appears

In `exchange-row.tsx` expanded state, each turn's tool calls are listed below the turn summary. This uses the `ExchangeSummary.turns[].toolCalls` data already fetched by `getConversationOverview`.

### Visual treatment

- Tool calls render as compact rows under each turn
- Tool name in monospace, status dot, duration right-aligned
- Error tool calls: red text, error message on hover/tooltip
- Multiple tool calls in a turn: stacked vertically, ordered by `sequence`

### Components to create/modify

| Component | Action | Notes |
|-----------|--------|-------|
| `exchange-row.tsx` | MODIFY | Add tool-call display in expanded turn list |
| (optional) `turn-tool-badge.tsx` | NEW | Reusable tool badge component if needed |

### Key files

| File | Role |
|------|------|
| `nextjs-app/components/admin/usage/conversation/exchange-row.tsx` | Where tool display goes |
| `nextjs-app/app/actions/admin-usage.ts` | `ToolObservationRow` type definition |

### Validation

- Turns with tool calls show tool name + status
- Error tool calls are visually distinct
- Turns without tool calls show nothing extra
- Hover/click on error tool call shows error message

---

## Cleanup (post-implementation)

After all slices ship:
1. Remove old `getUsageStats` and `getConversations` functions from `admin-usage.ts`
2. Remove old `ConversationRow` type (replaced by `ConversationSummaryRow`)
3. Remove unused imports
4. Verify no dead code with `bun run build`

---

## What is NOT changing

- The `conversations` table — unrelated, used for JSONL persistence
- Python write path — no backend changes
- Waterfall detail page (`/admin/usage/[id]`) — kept as-is for single exchange analysis
- `tool-breakdown-table.tsx` — global tool stats unchanged
- RLS policies — view queried via service-role
- The 7 existing detail components (`detail/*.tsx`) — all kept

---

## Dependency graph

```
Slice 1 (DB migration)
  └── Slice 2 (Server actions)
        ├── Slice 3 (List page)
        └── Slice 4 (Detail page)
              └── Slice 5 (Tool-call marking)
```

Slices 3 and 4 can run in parallel after Slice 2 completes.
