# Phase 01: Research Findings — Admin Usage Page Architecture

## 1. File Inventory

### Page Routes
- `/workspaces/test-mvp/nextjs-app/app/admin/usage/page.tsx` — List page (server component)
- `/workspaces/test-mvp/nextjs-app/app/admin/usage/[id]/page.tsx` — Detail page (server component)

### Server Actions (Data Fetching)
- `/workspaces/test-mvp/nextjs-app/app/actions/admin-usage.ts` — All data fetching for the usage page (5 exported functions)

### Client Components
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/usage-page-client.tsx` — Top-level client wrapper
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/filter-bar.tsx` — Time range + project filter
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/kpi-cards.tsx` — 4 KPI cards (Exchanges, Error Rate, Median Latency, Total Cost)
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/conversations-table.tsx` — Main list table with pagination
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/conversation-row.tsx` — Individual row in the table
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/tool-breakdown-table.tsx` — Aggregate tool stats table
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/status-dot.tsx` — Status indicator
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/utils.ts` — Formatting utilities
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/conversation-detail-client.tsx` — Detail page client wrapper
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/conversation-header.tsx` — Metadata header
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/waterfall-timeline.tsx` — Waterfall chart container
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/waterfall-turn-row.tsx` — Turn row in waterfall
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/waterfall-tool-row.tsx` — Tool call row in waterfall
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/tool-detail-panel.tsx` — Expandable tool detail
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/timing-bar.tsx` — Horizontal bar segment
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/time-axis.tsx` — Timeline axis labels
- `/workspaces/test-mvp/nextjs-app/components/admin/usage/detail/copy-button.tsx` — Clipboard copy button

### DB Migrations
- `/workspaces/test-mvp/supabase/migrations/20251202000001_create_agent_usage_table.sql`
- `/workspaces/test-mvp/supabase/migrations/20251202000003_agent_usage_rls_policies.sql`
- `/workspaces/test-mvp/supabase/migrations/20260119005958_add_auth_mode_to_agent_usage.sql`
- `/workspaces/test-mvp/supabase/migrations/20260221132457_make_claude_session_id_nullable.sql`
- `/workspaces/test-mvp/supabase/migrations/20260221141206_create_turns_table.sql`
- `/workspaces/test-mvp/supabase/migrations/20260221145644_create_tool_observations_table.sql`
- `/workspaces/test-mvp/supabase/migrations/20251231000003_create_conversations_table.sql`

### Python Writers (Backend)
- `/workspaces/test-mvp/python-services/agent_api/usage_service.py` — Writes `agent_usage` (create_early + finalize)
- `/workspaces/test-mvp/python-services/agent_api/turns_service.py` — Writes `turns` (one INSERT per turn)
- `/workspaces/test-mvp/python-services/agent_api/tool_observations_service.py` — Writes `tool_observations` (batch INSERT per turn)
- `/workspaces/test-mvp/python-services/agent_api/chat_service.py` — Orchestrates writes during streaming
- `/workspaces/test-mvp/python-services/agent_api/agent/agent.py` — Generates `turn_complete` events

---

## 2. Database Schema

### `agent_usage` Table (Primary entity today)
```
id UUID PK
claude_session_id TEXT (nullable since ENG-1956)
user_id UUID FK -> auth.users
project_id UUID FK -> projects (nullable)
organization_id UUID FK -> organizations (nullable)
user_role TEXT
model TEXT
input_tokens INT
output_tokens INT
cache_read_input_tokens INT
cache_creation_input_tokens INT
cost_usd NUMERIC(10,6)
duration_ms INT
duration_api_ms INT
num_turns INT (default 1)
is_error BOOLEAN
auth_mode TEXT ('api_key' | 'oauth' | NULL)
created_at TIMESTAMPTZ
```
RLS: Only admins can SELECT. Service role writes.

### `turns` Table
```
id UUID PK
agent_usage_id UUID FK -> agent_usage (CASCADE)
turn_index INT
text_preview TEXT
thinking_preview TEXT
tool_call_count INT (default 0)
duration_ms INT
sentry_trace_id TEXT
created_at TIMESTAMPTZ
UNIQUE (agent_usage_id, turn_index)
```
RLS: Only admins can SELECT. Service role writes.

### `tool_observations` Table
```
id UUID PK
turn_id UUID FK -> turns (CASCADE)
sequence INT (default 0)
tool_name TEXT
tool_input JSONB
result_count INT
error TEXT
duration_ms INT
created_at TIMESTAMPTZ
```
RLS: Only admins can SELECT. Service role writes.

### `conversations` Table (SEPARATE from agent_usage)
```
id UUID PK
claude_session_id TEXT UNIQUE
user_id UUID FK -> auth.users
project_id UUID FK -> projects
organization_id UUID FK -> organizations
storage_path TEXT (path to JSONL in bucket)
message_count INT
total_input_tokens INT
total_output_tokens INT
total_cost_usd NUMERIC(10,6)
is_error BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**Key relationship:** `conversations` and `agent_usage` are linked implicitly via `claude_session_id` but there is NO foreign key between them. They are written independently:
- `agent_usage` is written by `usage_service.py` (create_early before stream, finalize on ResultMessage)
- `conversations` is written by `conversation_service.py` (persist on ResultMessage)

### Data Hierarchy
```
agent_usage (1 per user-message exchange)
  └── turns (1 per Claude API call/response cycle within exchange)
       └── tool_observations (1 per MCP tool call within a turn)
```

There is NO `tool_call_details` table — the whiteboard question was mistaken. Only `tool_observations`.

---

## 3. Current Page Architecture

### List Page (`/admin/usage`)
The server component fetches 4 things in parallel:
1. **`getUsageStats(range, projectId)`** — Fetches ALL `agent_usage` rows in range, computes stats in JS (total, errors, percentiles, cost). Also fetches a comparison period.
2. **`getConversations(range, projectId, sort, dir, page)`** — Paginated `agent_usage` rows (25/page), then 3 sequential follow-up queries:
   - Fetch `turns` for those 25 rows to get turn IDs
   - Fetch `tool_observations` for those turns to compute tool stats per conversation
   - Fetch user emails via `auth.admin.getUserById()` for each unique user
   - Fetch project names
3. **`getToolBreakdown(range, projectId)`** — Either chains agent_usage -> turns -> tool_observations (with project filter) or queries tool_observations directly (no filter)
4. **`getProjectOptions()`** — Gets distinct project_ids from agent_usage

### Detail Page (`/admin/usage/[id]`)
Single server action `getConversationDetail(id)` fetches:
1. `agent_usage` row by ID
2. User email
3. Project name
4. All `turns` ordered by `turn_index`
5. All `tool_observations` for those turns

Renders as a waterfall timeline (turns with tool calls nested inside).

### Client Component Hierarchy
```
UsagePageClient
  ├── FilterBar (range toggle, project dropdown)
  ├── KpiCards (4 stat cards with comparison deltas)
  ├── ConversationsTable
  │     └── ConversationRowComponent (per row, with StatusDot)
  └── ToolBreakdownTable

ConversationDetailClient
  ├── ConversationHeader (metadata grid, Sentry link)
  └── WaterfallTimeline
        └── WaterfallTurnRow (expandable)
              └── WaterfallToolRow (expandable)
                    └── ToolDetailPanel (inline JSON viewer)
```

---

## 4. Current Data Hierarchy

The current page is **agent_usage-first**, NOT conversation-first:
- The list page shows one row per `agent_usage` record
- `agent_usage` represents a single user-message exchange (one user message -> one Claude response, possibly multi-turn with tool use)
- The page labels these as "Conversations" in the UI but they are really "exchanges"
- The actual `conversations` table is NOT used by the usage page at all
- There is no grouping by conversation/session — each `agent_usage` row is independent

The `conversations` table exists but is only used for persisting JSONL chat logs; it's not integrated into the admin usage page.

---

## 5. Root Cause Analysis: "Duplicate Turns"

### DB-level duplicates are impossible
The `turns` table has a `UNIQUE (agent_usage_id, turn_index)` constraint, so two turns with the same index for the same exchange cannot exist in the database.

### The likely "duplicate" sources

**Source 1: `num_turns` on agent_usage disagrees with actual turn rows.**
- `agent_usage.num_turns` comes from `ResultMessage.num_turns` (the Claude SDK's count)
- Actual `turns` rows come from `turn_complete` events emitted during streaming
- These are two independent write paths. If a stream disconnects mid-flight (Railway SSE timeout, client disconnect), `finalize()` may never run (so `num_turns` stays at default 1), or it may finalize with a different count than the actual turn rows written.
- The list page shows `numTurns` from `agent_usage.num_turns` — this is the SDK's count.
- The detail page shows actual turn rows from the `turns` table.
- If the SDK reports 3 turns but only 2 `turn_complete` events fired before disconnect, the numbers disagree.

**Source 2: Multiple agent_usage rows for the same conversation.**
- `conversations` has UNIQUE on `claude_session_id`
- `agent_usage` does NOT have unique on `claude_session_id`
- Each user message in a conversation creates a new `agent_usage` row (via `create_early()`)
- So a conversation with 5 user messages has 5 `agent_usage` rows, each with their own turns
- In the list page, what appears to be "duplicate turns" may actually be multiple agent_usage rows for the same session, each showing similar turn patterns

**Source 3: No deduplication in the getConversations tool stats path.**
In `getConversations()` (lines 409-446 of admin-usage.ts):
- It fetches turns for 25 agent_usage rows
- Then fetches tool_observations for all those turn IDs
- Maps back via `turnToUsage` map
- There is no duplication bug here — the mapping is correct. But if multiple agent_usage rows share the same session, the UI shows them as separate rows that look like duplicates.

### Most likely root cause
**Multiple `agent_usage` rows per conversation session** is the primary source of perceived "duplicates." Since `claude_session_id` is not unique on `agent_usage`, every user message in a multi-exchange conversation creates a new row. The list page shows all of them individually, making it look like duplicated data. This is BY DESIGN in the current schema — each row is a separate exchange — but it's confusing without conversation-level grouping.

---

## 6. Performance Observations

### N+1 Query Pattern in getConversations
For a single page load (25 rows):
1. COUNT query on agent_usage
2. SELECT on agent_usage (25 rows)
3. SELECT on turns (for those 25 agent_usage IDs)
4. SELECT on tool_observations (for all turn IDs)
5. N auth.admin.getUserById() calls (one per unique user)
6. SELECT on projects (for unique project IDs)

Steps 1-2 run in parallel. Steps 3-6 are sequential. The getUserById() calls are particularly slow since they're individual API calls.

### getUsageStats fetches ALL rows
`getUsageStats` fetches every `agent_usage` row in the time range and computes percentiles in JavaScript. For "all" range or "30d" with heavy usage, this could be very expensive. No DB-level aggregation.

### getToolBreakdown fetches ALL tool_observations
Similarly loads all tool observations into memory for JS aggregation.

---

## 7. Key Observations for Rebuild

1. **The `conversations` table exists but is unused by the admin page.** It could serve as the top-level entity if populated correctly, since it has `claude_session_id` UNIQUE.

2. **agent_usage is per-exchange, not per-conversation.** A conversation with N user messages has N agent_usage rows. The rebuild wants conversations as top-level, which means either:
   - Grouping agent_usage rows by claude_session_id
   - Using the existing conversations table
   - Creating a new view

3. **The conversations table lacks turn/tool data.** It only has aggregate token counts. To get turn-level detail, you still need agent_usage -> turns -> tool_observations.

4. **No FK between conversations and agent_usage.** The implicit link is `claude_session_id`. But `agent_usage.claude_session_id` is nullable (NULL = stream never completed), and the column was originally NOT NULL.

5. **`tool_call_details` does not exist.** Only `tool_observations`.

6. **The waterfall timeline in the detail page is well-built.** It correctly sequences turns and nests tool calls. The main issue is the list page's flat agent_usage-per-row model.
