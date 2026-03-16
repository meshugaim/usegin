# Phase 04: Action Items Slice 4 Implementation (ENG-2799)

## What was built

### 1. Data Layer: Workspace type + action-items.ts query module
- Added `action_items_enabled: boolean` to the `Workspace` interface in `workspace-core.ts`
- Updated ALL workspace queries (getWorkspaces, getWorkspace, createWorkspace, createPersonalWorkspace) to select and map `action_items_enabled`
- Created `nextjs-app/lib/action-items.ts` mirroring `risks.ts`:
  - `ProjectActionItem` type (id, project_id, title, description, priority)
  - `ActionItemPrompt` type (id, prompt) for auto-send
  - `getProjectIdsForActionItemFetch()` — same access filtering as risks
  - `getLatestActionItemsForProjects()` — bulk fetch, dedup by project_id
  - `getActionItemById()` — single fetch for chat auto-send

### 2. Layout + Context Wiring
- Added `actionItems: Record<string, ProjectActionItem>` to `WorkspaceData` context type
- Layout fetches action items in parallel when `action_items_enabled` is true
- Uses same `riskProjectIds` for access filtering (same rules)

### 3. ProjectCard UI: ActionItemDisplay Component
- New `ActionItemDisplay` component in `project-card.tsx`
- Priority badge pill: high (red-100/red-700), medium (amber-100/amber-700), low (gray-100/gray-700)
- Background tint matching priority color
- Click opens `/projects/[id]/chat?actionItemId=xxx` in new tab
- Tooltip with description + priority + "Click to discuss with Effi"
- `getPriorityStyles()` helper exported for testing
- Display priority: risk > action item > skipped > description

### 4. workspace-detail-client Wiring
- Reads `actionItems` from context
- Passes `actionItem` and `actionItemsEnabled` to each `ProjectCard`

### 5. Backend Chat: action_item_id + Context Injection
- Added `action_item_id: UUID | None` to `ChatRequest` model
- 400 error when both `risk_id` and `action_item_id` are provided
- `ActionItemContext` dataclass in agent config
- `_fetch_action_item()` function (RLS-enforced, same pattern as `_fetch_risk`)
- System prompt injection:
  ```
  # ACTION ITEM CONTEXT
  You are entering a conversation about a specific action item...
  ## Action Item: {title}
  ## Background Analysis
  {context}
  ```
- Logging for action_item_id injection

### 6. Frontend Chat: actionItemId Pipeline
- `useChat` hook: accepts `actionItemId`, includes in POST body as `action_item_id`
- `ChatInterface`: accepts `actionItemId`, one-shot auto-send on mount
- `ChatSection`: pass-through prop
- `ProjectHomeClient`: state management for `activeActionItemId`, cleared on "New Chat"
- `chat/page.tsx`: extracts `actionItemId` from URL search params

### 7. Unit Tests
- **Frontend (15 tests)**: access filtering, bulk fetch, single fetch, priority styles
- **Backend (12 tests)**: context injection (7), mutual exclusivity (5)
- **Test mock updates (9 files)**: added `actionItems: {}` to all workspace data mocks

## Test counts
- Next.js unit: 2277 passed, 0 failed (15 new + 9 mock updates)
- Python unit: 1916 passed, 0 failed (12 new)

## Commits (8 total, all pushed)
1. `ab2973e6` feat(nextjs): add action_items_enabled to Workspace type + action-items query module
2. `7e82245d` feat(nextjs): wire action items through layout and context provider
3. `011d8285` feat(nextjs): add ActionItemDisplay component to project cards
4. `cd53338e` feat(nextjs): pass action items to ProjectCard from workspace detail
5. `18d1942b` feat(python): add action_item_id to chat with context injection
6. `1c8f64c0` feat(nextjs): wire actionItemId through chat pipeline
7. `78e6adaf` test: add action item unit tests for frontend and backend
8. `796b5226` fix(tests): add actionItems to workspace data mocks

## Critical constraints verified
- Existing risk display behavior is UNCHANGED
- Risk display takes priority when both exist on a card
- RiskDisplay component and skippedAssessment display are UNCHANGED
- Chat risk_id flow is UNCHANGED — action_item_id is parallel
- Auto-send is one-shot (shared autoSendFiredRef guard)
- No existing test assertions were deleted or weakened

## Test modification disclosure
| File | Change |
|------|--------|
| workspace-detail.mocks.ts | Added `actionItems: {}` to mock return |
| workspace-data-provider.test.tsx | Added `action_items_enabled` to Workspace, `actionItems` to context |
| workspace-health-filter-flow.test.tsx | Added `action_items_enabled` to Workspace, `actionItems` to context |
| settings-button.test.tsx | Added `actionItems: {}` to mock |
| visibility-rules.test.tsx | Added `actionItems: {}` to mock |
| workspace-persistence.test.tsx | Added `actionItems: {}` to mock |
| avatar-helpers.test.tsx | Added `actionItems: {}` to mock |
| role-badges.test.tsx | Added `actionItems: {}` to mock |
| unassigned-projects.test.tsx | Added `actionItems: {}` to mock |
| agent_driver.py | Added `with_action_item()` and `action_item` to build/build_config |

Status: PASS
