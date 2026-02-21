# Phase 02 — Data Structures for Observability Dashboard

> Research complete 2026-02-21. Sources: migration SQL, Python service code, unit tests, agent streaming code.

---

## Table Hierarchy

```
auth.users
  |
  v
agent_usage  (1 per user message exchange)
  |
  v
turns        (1 per Claude API call within that exchange)
  |
  v
tool_observations  (1 per MCP tool call within a turn)
```

There is also a `conversations` table (1 per session) and a `conversations` storage bucket (JSONL files), but those are outside the scope of the observability data model. `agent_usage.claude_session_id` can join to `conversations.claude_session_id` if needed.

---

## 1. `agent_usage` Table

**Migrations:**
- `/workspaces/test-mvp/supabase/migrations/20251202000001_create_agent_usage_table.sql` — CREATE TABLE + indexes
- `/workspaces/test-mvp/supabase/migrations/20251202000003_agent_usage_rls_policies.sql` — RLS policies
- `/workspaces/test-mvp/supabase/migrations/20260119005958_add_auth_mode_to_agent_usage.sql` — adds `auth_mode` column
- `/workspaces/test-mvp/supabase/migrations/20260221132457_make_claude_session_id_nullable.sql` — makes `claude_session_id` nullable for early persistence (ENG-1956)

### Columns

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `claude_session_id` | TEXT | YES | — | SDK session_id. NULL if stream never completed. Made nullable by ENG-1956. |
| `user_id` | UUID | NO | — | FK -> `auth.users(id)` ON DELETE CASCADE |
| `project_id` | UUID | YES | — | FK -> `projects(id)` ON DELETE SET NULL. NULL for dashboard chat. |
| `organization_id` | UUID | YES | — | FK -> `organizations(id)` ON DELETE SET NULL. Denormalized for queries. |
| `user_role` | TEXT | YES | — | User's role in project at time of request |
| `model` | TEXT | NO | — | Model used (e.g. "haiku", "sonnet") |
| `input_tokens` | INT | NO | 0 | From ResultMessage usage |
| `output_tokens` | INT | NO | 0 | From ResultMessage usage |
| `cache_read_input_tokens` | INT | NO | 0 | |
| `cache_creation_input_tokens` | INT | NO | 0 | |
| `cost_usd` | NUMERIC(10,6) | YES | — | From total_cost_usd |
| `duration_ms` | INT | YES | — | Total turn duration |
| `duration_api_ms` | INT | YES | — | API call duration only (may be NULL) |
| `num_turns` | INT | NO | 1 | Turn count in session |
| `is_error` | BOOLEAN | NO | FALSE | Whether the turn errored |
| `auth_mode` | TEXT | YES | — | CHECK: NULL, 'api_key', or 'oauth'. NULL = pooled/historical. |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | |

### Indexes

| Name | Columns |
|------|---------|
| `idx_agent_usage_user_id` | `user_id` |
| `idx_agent_usage_project_id` | `project_id` |
| `idx_agent_usage_organization_id` | `organization_id` |
| `idx_agent_usage_created_at` | `created_at` |
| `idx_agent_usage_claude_session_id` | `claude_session_id` |

### RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| "Admins can read all usage" | SELECT | `is_admin(auth.uid())` |

No INSERT/UPDATE/DELETE policies. Service role writes bypass RLS.

### Write Path

**Service:** `/workspaces/test-mvp/python-services/agent_api/usage_service.py` — `UsageService` (lazy singleton via `get_usage_service()`)

**Two-phase write:**
1. `create_early()` — INSERT before streaming starts. Provides `agent_usage_id` as FK for turns/tool_observations. Only inserts: `user_id`, `model`, `project_id`, `organization_id`, `user_role`. Claude session ID is NOT known yet.
2. `finalize()` — UPDATE after `ResultMessage` arrives. Sets: `claude_session_id`, all token counts, `cost_usd`, `duration_ms`, `duration_api_ms`, `num_turns`, `is_error`, `auth_mode`.

**Called from:** `/workspaces/test-mvp/python-services/agent_api/chat_service.py` — `ChatService.stream_chat_response()` lines 228-294. `create_early()` is awaited. `finalize()` is fire-and-forget via `asyncio.create_task`.

### Read Path

No read endpoints exist yet. The table is only readable by admin users via RLS (Supabase client with admin JWT).

---

## 2. `turns` Table

**Migration:** `/workspaces/test-mvp/supabase/migrations/20260221141206_create_turns_table.sql` (ENG-1924)

### Columns

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `agent_usage_id` | UUID | NO | — | FK -> `agent_usage(id)` ON DELETE CASCADE |
| `turn_index` | INT | NO | — | 0-based index within the exchange |
| `text_preview` | TEXT | YES | — | First ~200 chars of assistant text |
| `thinking_preview` | TEXT | YES | — | First ~200 chars of thinking block |
| `tool_call_count` | INT | NO | 0 | Number of tool calls in this turn |
| `duration_ms` | INT | YES | — | Turn duration (wall time) |
| `sentry_trace_id` | TEXT | YES | — | Sentry trace ID for the parent HTTP request |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | |

### Constraints

| Name | Type | Columns |
|------|------|---------|
| `turns_agent_usage_turn_index_unique` | UNIQUE | `(agent_usage_id, turn_index)` |

### Indexes

| Name | Columns | Notes |
|------|---------|-------|
| `turns_agent_usage_turn_index_unique` | `(agent_usage_id, turn_index)` | Also serves as FK lookup index |
| `idx_turns_created_at` | `created_at` | Time-range queries |

### RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| "Admins can read all turns" | SELECT | `is_admin(auth.uid())` |

No INSERT/UPDATE/DELETE policies. Service role writes bypass RLS.

### Write Path

**Service:** `/workspaces/test-mvp/python-services/agent_api/turns_service.py` — `TurnsService` (lazy singleton via `get_turns_service()`)

**Method:** `record_turn(agent_usage_id, sentry_trace_id, turn_data)` — single INSERT, returns turn UUID.

**Data mapping from agent events:**
```python
{
    "agent_usage_id": agent_usage_id,    # from create_early()
    "turn_index": turn_data["turn_index"],
    "text_preview": turn_data.get("text_preview"),       # first ~200 chars
    "thinking_preview": turn_data.get("thinking_preview"), # first ~200 chars
    "tool_call_count": turn_data.get("tool_call_count", 0),
    "duration_ms": turn_data.get("duration_ms"),
    "sentry_trace_id": sentry_trace_id,  # from sentry_sdk.get_current_span()
}
```

**Called from:** `/workspaces/test-mvp/python-services/agent_api/chat_service.py` — `_persist_turn_and_tools()` (line 42). This is called as a fire-and-forget `asyncio.create_task` when a `turn_complete` event arrives during streaming (line 259-266).

**Event source:** `/workspaces/test-mvp/python-services/agent_api/agent/agent.py` — Turn accumulation logic (line ~433-468). A `turn_complete` event is yielded at each turn boundary (new `AssistantMessage` or `ResultMessage`).

### Read Path

No read endpoints exist yet. The table is only readable by admin users via RLS.

---

## 3. `tool_observations` Table

**Migration:** `/workspaces/test-mvp/supabase/migrations/20260221145644_create_tool_observations_table.sql` (ENG-1921)

### Columns

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `turn_id` | UUID | NO | — | FK -> `turns(id)` ON DELETE CASCADE |
| `sequence` | INT | NO | 0 | Ordering within the turn (parallel calls: 0, 1, 2) |
| `tool_name` | TEXT | NO | — | e.g. "semantic_search", "browse_emails" |
| `tool_input` | JSONB | NO | `'{}'` | Full input parameters |
| `result_count` | INT | YES | — | Number of results returned. NULL if N/A. |
| `error` | TEXT | YES | — | NULL = success. Truncated to 500 chars. |
| `duration_ms` | INT | YES | — | ToolUseBlock -> ToolResultBlock elapsed time |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | |

### Indexes

| Name | Columns | Notes |
|------|---------|-------|
| `idx_tool_observations_turn_id` | `turn_id` | FK lookup: "all tool calls for this turn" |
| `idx_tool_observations_created_at` | `created_at` | Time-range queries |

### RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| "Admins can read all tool_observations" | SELECT | `is_admin(auth.uid())` |

No INSERT/UPDATE/DELETE policies. Service role writes bypass RLS.

### Write Path

**Service:** `/workspaces/test-mvp/python-services/agent_api/tool_observations_service.py` — `ToolObservationsService` (lazy singleton via `get_tool_observations_service()`)

**Method:** `record_tool_observations(turn_id, tool_calls)` — batch INSERT of all tool calls for a turn.

**Data mapping from agent events:**
```python
{
    "turn_id": turn_id,              # from turns_service.record_turn()
    "sequence": tc.get("sequence", 0),
    "tool_name": tc["tool_name"],    # from ToolUseBlock.name
    "tool_input": tc.get("tool_input", {}),  # from ToolUseBlock.input
    "result_count": tc.get("result_count"),   # extracted from ToolResultBlock content
    "error": tc.get("error"),        # from ToolResultBlock if is_error=True, truncated to 500 chars
    "duration_ms": tc.get("duration_ms"),     # ToolUseBlock -> ToolResultBlock elapsed
}
```

**Called from:** `/workspaces/test-mvp/python-services/agent_api/chat_service.py` — `_persist_turn_and_tools()` (line 43-44). Sequential after `record_turn()` because it needs the `turn_id`. The parent `_persist_turn_and_tools` task is fire-and-forget from the streaming loop.

**Event source:** `/workspaces/test-mvp/python-services/agent_api/agent/agent.py`:
- Tool calls are accumulated in `_pending_tool_calls` dict (keyed by `tool_use_id`) starting at line ~485.
- `ToolUseBlock` starts tracking (name, input, sequence, start_time).
- `ToolResultBlock` completes tracking (duration_ms, error, result_count).
- Helper functions: `_extract_error()` (line 82) and `_extract_result_count()` (line 103).

### Read Path

No read endpoints exist yet. The table is only readable by admin users via RLS.

---

## 4. `tool_call_details` View

**Status: DOES NOT EXIST.**

No migration creates this view. No SQL file defines it. The only reference is in the whiteboard (`/workspaces/test-mvp/.claude/research/observability-dashboard/whiteboard.md`) which mentions it as a planned data source. There is no ENG-1930 spec file in the codebase.

The view was likely planned as part of ENG-1919 (the parent epic) but was never implemented because the raw tables provide sufficient query capability. A useful definition would be:

```sql
-- Hypothetical tool_call_details view (not yet created)
CREATE VIEW tool_call_details AS
SELECT
  to2.id,
  to2.turn_id,
  to2.sequence,
  to2.tool_name,
  to2.tool_input,
  to2.result_count,
  to2.error,
  to2.duration_ms AS tool_duration_ms,
  to2.created_at AS tool_created_at,
  t.agent_usage_id,
  t.turn_index,
  t.text_preview,
  t.thinking_preview,
  t.tool_call_count,
  t.duration_ms AS turn_duration_ms,
  t.sentry_trace_id,
  au.user_id,
  au.project_id,
  au.organization_id,
  au.model,
  au.cost_usd,
  au.duration_ms AS exchange_duration_ms,
  au.is_error AS exchange_is_error,
  au.auth_mode,
  au.created_at AS exchange_created_at
FROM tool_observations to2
JOIN turns t ON t.id = to2.turn_id
JOIN agent_usage au ON au.id = t.agent_usage_id;
```

---

## 5. Related Infrastructure

### `conversations` Table (for cross-reference)

**Migration:** `/workspaces/test-mvp/supabase/migrations/20251231000003_create_conversations_table.sql`

Joinable via `agent_usage.claude_session_id = conversations.claude_session_id`. The conversations table holds session-level metadata and references JSONL content in the `conversations` storage bucket.

### `admins` Table

Used by `is_admin()` function in RLS policies. All three observability tables use the same RLS pattern: admin-only SELECT, service-role INSERT (bypasses RLS).

### Flush Endpoint for E2E Tests

`POST /debug/flush-persistence` — waits for all pending fire-and-forget persistence tasks (turns, tool_observations, conversations) to complete. Defined in `/workspaces/test-mvp/python-services/agent_api/api/health.py`. Used by e2e tests to ensure DB writes are done before assertions.

---

## 6. Write Lifecycle (Full Flow)

```
User sends message
       |
       v
ChatService.stream_chat_response()
       |
       |--> UsageService.create_early()              # INSERT agent_usage (minimal row)
       |         returns agent_usage_id               #   user_id, model, project_id, org_id, role
       |
       |--> sentry_sdk.get_current_span().trace_id   # capture sentry_trace_id
       |
       |--> Agent.stream_response() loop:
       |         |
       |         |--> on turn boundary ("turn_complete" event):
       |         |         asyncio.create_task(_persist_turn_and_tools):
       |         |              1. TurnsService.record_turn()        # INSERT turns row
       |         |                    returns turn_id
       |         |              2. ToolObservationsService           # INSERT tool_observations rows
       |         |                    .record_tool_observations()     #   (batch, sequential after turn)
       |         |
       |         |--> on "result" event:
       |                  asyncio.create_task(UsageService.finalize())  # UPDATE agent_usage
       |                       sets: claude_session_id, tokens, cost,
       |                             duration, num_turns, is_error,
       |                             auth_mode
       v
  Stream complete
```

All persistence is fire-and-forget. DB failures are logged but never crash the stream.

---

## 7. What Does NOT Exist Yet

| Item | Status | Notes |
|------|--------|-------|
| `tool_call_details` view | Not created | Would be a denormalized join of all 3 tables |
| API endpoints to read observability data | Not created | No Next.js API routes or Python endpoints read these tables |
| Admin UI for observability | Not created | The `/admin` page has no observability section |
| Aggregation queries/materialized views | Not created | No pre-computed rollups |
| TypeScript types for these tables | Not generated | No `database.types.ts` covering these tables |

---

## 8. Query Patterns for Dashboard

The indexed columns and FK relationships support these query patterns efficiently:

| Query Pattern | How | Index Used |
|---------------|-----|------------|
| Exchanges in time range | `agent_usage WHERE created_at BETWEEN ...` | `idx_agent_usage_created_at` |
| Exchanges by user | `agent_usage WHERE user_id = ...` | `idx_agent_usage_user_id` |
| Exchanges by project | `agent_usage WHERE project_id = ...` | `idx_agent_usage_project_id` |
| Exchanges by org | `agent_usage WHERE organization_id = ...` | `idx_agent_usage_organization_id` |
| Turns for an exchange | `turns WHERE agent_usage_id = ...` | `turns_agent_usage_turn_index_unique` |
| Tool calls for a turn | `tool_observations WHERE turn_id = ...` | `idx_tool_observations_turn_id` |
| All tool calls in time range | `tool_observations WHERE created_at BETWEEN ...` | `idx_tool_observations_created_at` |
| Cross-table drill-down | JOIN chain: `agent_usage -> turns -> tool_observations` | FK indexes |
| Link to Sentry trace | `turns.sentry_trace_id` | Not indexed (low cardinality use) |
| Link to conversation | `agent_usage.claude_session_id = conversations.claude_session_id` | Both indexed |
