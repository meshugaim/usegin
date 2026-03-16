# Phase 03: Action Items Slice 3 Implementation (ENG-2798)

## What was built

### 1. Python: Action item prompt wrapper (`action_item_prompt.py`)
- `ACTION_ITEM_PROMPT_WRAPPER`: stable mode switch mandating `create_action_item` tool usage
- `DEFAULT_QUALITATIVE_PROMPT`: functional placeholder with categories (pending decisions, overdue deliverables, unresolved issues, follow-ups, process gaps)
- `build_action_item_prompt(qualitative=None)` assembly function
- 18 unit tests (`test_action_item_prompt.py`)

### 2. Python: Action item runner (`action_item_runner.py`)
- Mirrors `risk_runner.py` exactly: service-role client, store resolution, preflight skip
- Pre-agent skip inserts into `action_items` table (not `risks`) with `assessment_run_id`
- Wires `create_action_item` + `complete_assessment` (with `table_name="action_items"`, `assessment_type="action item"`)
- Shared state, re-query loop (5 retries), Sentry transaction `op="action_item.generate"`
- `ActionRunResult` dataclass with `items_created` counter
- 11 unit tests (`test_action_item_runner.py`)

### 3. Python: API endpoint (`api/action_items.py`)
- `POST /api/action-items/generate` — accepts `{ project_id, run_id? }`, returns 202
- `GET /api/action-items/generate/{run_id}` — debugging endpoint
- **Shares the SAME semaphore** as risk generation (imports `_semaphore` from `api/risks.py`)
- Router registered in `main.py`

### 4. Seam fixes from Slice 1 (`lib/risk-runs.ts`)
- `createRiskRun`: explicitly sets `type: "risk"` on insert
- `getLatestRiskRunStatus`: adds `.eq("type", "risk")` filter to assessment_runs query
- Test mock updated to support chained `.eq()` calls

### 5. Browser flag rename: `riskAssessment` → `projectChecks`
- New cookie name: `effi-project-checks`
- Updated description: "Show project checks controls (risk assessment, action items) in workspace settings"
- All references updated: registry.ts, page.tsx, workspace-settings-client.tsx, all test files

### 6. Action item runs lib + server actions
- `lib/action-item-runs.ts`: create, status, trigger functions (mirrors `risk-runs.ts` with `type='action'`)
- `actions/action-item-runs.ts`: server actions with DI pattern — `toggleActionItems`, `runActionItemAssessment`, `refreshActionRunStatus`

### 7. Workspace settings UI refactor
- "Project Checks" section wrapper containing both Risk Assessment and Action Items cards
- Action Items card: toggle switch for `action_items_enabled`, "Generate" button, status display with refresh
- Risk Assessment card unchanged in behavior, just moved under section wrapper
- Settings page queries `action_items_enabled` from workspaces table

### 8. Frontend tests
- 13 new tests for Action Items card (flag gating, toggle, generate, status, coexistence with risk card)
- All 13 existing risk run tests still pass (updated for prop rename)
- Created `action-item-runs-actions.mock.ts` for server action delegation

## Test counts
- Python unit: 1904 passed, 0 failed (29 new tests)
- Next.js unit: 2262 passed, 0 failed (13 new tests)

## Commits (8 total, all pushed)
1. `45ec78bc` feat(python): add action item prompt wrapper and assembly (ENG-2798)
2. `933e5e13` feat(python): add action item runner with pre-agent skip (ENG-2798)
3. `3026b87a` feat(python): add action items API endpoint, share semaphore (ENG-2798)
4. `79131ae4` fix(nextjs): add type filter to risk run queries (ENG-2798)
5. `813741ff` refactor(nextjs): rename riskAssessment flag to projectChecks (ENG-2798)
6. `0cffe966` feat(nextjs): add action item runs lib and server actions (ENG-2798)
7. `0143a38e` feat(nextjs): add Action Items card to workspace settings (ENG-2798)
8. `95fcf93b` test(nextjs): add Action Items card tests and mock (ENG-2798)

## Test Modification Disclosure
| File | What changed | Why |
|------|-------------|-----|
| `tests/unit/lib/risk-runs.test.ts` | Updated `createStatusMock` to support chained `.eq()` calls | Seam fix added `.eq("type", "risk")` — mock needed to chain two `.eq()` |
| `tests/unit/pages/toggles.test.tsx` | `riskAssessment: false` → `projectChecks: false` | Flag rename |
| `tests/unit/components/workspace-settings-risk-run.test.tsx` | Prop rename `riskAssessmentEnabled` → `projectChecksEnabled`, added `actionItemsEnabled` prop, added action item mock setup, added 13 new tests | Flag rename + new Action Items card tests |

## Status: PASS
