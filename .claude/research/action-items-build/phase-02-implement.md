# Phase 02: Action Items Implementation (ENG-2797, Slice 2)

## What was built

### 1. Database migration (`20260316212334_create_action_items_table.sql`)
- `action_items` table with all specified columns and constraints
- CHECK constraints: status enum (new/seen/discussed/dismissed/done), priority enum (high/medium/low), outcome enum (action/clear/skipped), title length <= 100
- Conditional CHECK: action outcome requires description, priority, prompt non-NULL
- FK to `assessment_runs(id)` with ON DELETE SET NULL
- RLS: `get_user_action_item_project_ids()` function (workspace members + project owners)
- SELECT-only policy for authenticated users
- `action_items_enabled` boolean on workspaces (default false)
- DB security checks pass (`bun tools/db-test/src/cli.ts security`)

### 2. Python: `create_action_item_tool.py`
- New MCP tool server factory mirroring `create_risk_tool.py`
- 5 required params: title, description, priority, context, prompt
- Validates non-empty, priority enum, title length
- Rate-limited to 5 per session
- Writes to `action_items` table with outcome='action'
- Mixed-signal guard: checks `state["assessment_completed"]`
- Sets `state["responded"]` and increments `state["count"]`

### 3. Python: `complete_assessment_tool.py` changes
- Added `table_name` parameter (default `"risks"`)
- Row payload adjusted per table (priority for action_items, grade/trend for risks)
- Mixed-signal guard uses dynamic creator tool name
- Sets `state["assessment_completed"]` on success
- Fully backward-compatible: all 63 original tests pass unchanged

### 4. Seed data
- 7 action items across 3 demo projects (Lumina: 2 action + 1 clear, Apex: 2, Harbor: 2)
- 2 action items on visibility test Public Assigned Project
- `action_items_enabled = true` on demo workspace
- Mix of high/medium/low priorities

### 5. Integration tests (19 tests, all pass)
- RLS: owner read, member read, non-member blocked, external blocked
- Service role insert, end user insert blocked
- CHECK constraints: status, priority, outcome, title length
- Conditional CHECK: action requires fields, clear/skipped allows NULLs
- FK: assessment_run_id reference works, invalid UUID rejected
- Workspace: action_items_enabled defaults to false
- All valid status and priority values accepted

### 6. Python unit tests
- `test_create_action_item_tool.py`: 57 tests (schema, validation, rate limit, happy path, error handling, state, mixed-signal)
- `test_complete_assessment_tool.py`: +10 new tests (73 total) for table_name="action_items" behavior

## Test counts
| Suite | Tests | Status |
|-------|-------|--------|
| test_create_action_item_tool.py | 57 | PASS |
| test_complete_assessment_tool.py | 73 (63 original + 10 new) | PASS |
| test_create_risk_tool.py | 86 | PASS (no changes) |
| test_risk_runner.py | 19 | PASS (no changes) |
| Full Python unit suite | 1862 | PASS |
| Integration: action-items/rls.test.ts | 19 | PASS |

## Files changed
- NEW: `supabase/migrations/20260316212334_create_action_items_table.sql`
- NEW: `python-services/agent_api/agent/create_action_item_tool.py`
- NEW: `python-services/tests/unit/test_create_action_item_tool.py`
- NEW: `nextjs-app/tests/integration/action-items/rls.test.ts`
- MODIFIED: `python-services/agent_api/agent/complete_assessment_tool.py`
- MODIFIED: `python-services/tests/unit/test_complete_assessment_tool.py`
- MODIFIED: `supabase/seed.sql`

## Test modification disclosure
- `test_complete_assessment_tool.py`: Added new `TestActionItemsTable` class with 10 tests. No existing tests modified or deleted. The formatter reformatted some existing lines (whitespace only, no behavioral changes).

## Commits (5, all pushed to origin/main)
1. `d497e534` — feat(db): create action_items table with RLS and workspace toggle
2. `802433e4` — feat(python): add create_action_item MCP tool
3. `3994960f` — feat(python): parameterize complete_assessment_tool for action_items
4. `eb10a97a` — feat(seed): add action items seed data
5. `920bd807` — test(python): add unit tests for action item tools
6. `4455c6d7` — test(integration): add action_items RLS and schema tests
