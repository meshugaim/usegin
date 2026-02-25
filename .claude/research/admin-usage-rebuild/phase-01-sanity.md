# Phase 01: Admin Usage Page Sanity Check

**Date:** 2026-02-25
**Environment:** Local (localhost:63000, Supabase local)
**Tested as:** owner@test.local (admin)

---

## 1. Page Structure

The `/admin/usage` page has three sections:

1. **KPI Cards** -- Exchanges (count), Error Rate, Median Latency, Total Cost
2. **Conversations Table** -- One row per `agent_usage` record. Columns: Status, Time, User, Project, Model, Turns, Tools, Duration, Cost
3. **Tool Breakdown Table** -- Aggregated tool call stats (tool name, call count, errors, P50/P95 latency)

Clicking a row navigates to `/admin/usage/[id]` which shows:
- **Conversation Header** -- metadata (user, project, model, duration, cost, turns, tokens, Sentry trace link)
- **Waterfall Timeline** -- Turn-by-turn breakdown with tool calls nested under each turn

---

## 2. Data Hierarchy

The page treats each `agent_usage` row as a "conversation" (the code calls them "conversations" throughout).

**Database schema:**
```
agent_usage (1) --< turns (N) --< tool_observations (M)
```

**Data flow:**
- `agent_usage` is created early (before streaming) via `UsageService.create_early()`, then finalized with stats from the SDK's `ResultMessage`
- `turns` rows are written incrementally during streaming (one per `AssistantMessage` from the SDK)
- `tool_observations` rows are written after each turn completes

---

## 3. Current Local Data

### agent_usage (4 rows)

| ID (short) | num_turns (agent_usage) | Actual turns (DB) | Duration | Cost |
|---|---|---|---|---|
| bd8e0a17 | 2 | **3** | 10.5s | $0.01 |
| 07f2e92a | 3 | **5** | 11.1s | $0.04 |
| 5a93db73 | 1 | 1 | 3.6s | $0.04 |
| 43b3c24c | 1 | 1 | 3.6s | $0.04 |

### turns (10 rows)

All turns have unique `(agent_usage_id, turn_index)` pairs -- no duplicates in the DB.

### tool_observations (3 rows)

- 2x `mcp__file_search__search_files` (in conversation 07f2e92a, turns 1 and 3)
- 1x `mcp__data_browse__list_data_summary` (in conversation bd8e0a17, turn 1)

---

## 4. Key Findings

### Finding 1: `num_turns` Mismatch (agent_usage vs actual turns table)

**The `agent_usage.num_turns` field does NOT match the actual number of rows in the `turns` table.** This is the most significant discrepancy.

| Conversation | `agent_usage.num_turns` | Actual `turns` rows | Discrepancy |
|---|---|---|---|
| bd8e0a17 | 2 | 3 | +1 extra turn in DB |
| 07f2e92a | 3 | 5 | +2 extra turns in DB |

**Root cause:** Two independent counting mechanisms:
- `agent_usage.num_turns` comes from `ResultMessage.num_turns` (the Claude SDK's internal count)
- The `turns` table gets one row per `AssistantMessage` emitted by the SDK

The SDK's `num_turns` likely counts "user message -> assistant response" cycles (agentic loops), while the `turns` table records every `AssistantMessage`, which includes intermediate responses within a single agentic turn (e.g., the assistant says "let me search" -> calls a tool -> gets result -> responds).

**Impact on UI:**
- The **conversations list table** shows the SDK's `num_turns` (e.g., "2" and "3")
- The **detail page header** also shows the SDK's `num_turns` ("Turns: 2" and "Turns: 3")
- The **waterfall timeline** on the detail page shows the actual turn rows from DB (3 and 5 turns respectively)
- This creates a visible contradiction: header says "Turns: 2" but the timeline shows TURN 0, TURN 1, TURN 2

### Finding 2: No Duplicate Turns in the Database

The `UNIQUE (agent_usage_id, turn_index)` constraint is working correctly. There are zero duplicate turn rows.

The user report of "duplicate turns" may actually be referring to the fact that what appears as a single user-facing turn (one question -> one answer) is broken into multiple internal turns in the waterfall, which looks like duplicates but is actually the correct agentic loop structure.

### Finding 3: The UI Correctly Renders What's in the DB

The detail page waterfall faithfully renders all turn rows from the `turns` table. For conversation 07f2e92a:
- TURN 0: "I'll search through the project files..." (369ms, no tools)
- TURN 1: (no text) (3.0s, 1 tool: mcp__file_search__search_files)
- TURN 2: "Let me try another search approach:" (350ms, no tools)
- TURN 3: (no text) (4.7s, 1 tool: mcp__file_search__search_files)
- TURN 4: "I'm encountering an issue accessing the project files..." (37ms, no tools)

This is 5 AssistantMessages but only 3 SDK turns (user -> assistant agentic loop iterations).

### Finding 4: Console Errors Are Benign

Only error: `ERR_CONNECTION_REFUSED` on `localhost:8969/stream` (Sentry Spotlight not running). No app errors.

---

## 5. Terminology Confusion

The page uses "Conversations" but the data model is really "Exchanges" (one `agent_usage` row = one user message -> one full response, which may involve multiple SDK round-trips).

The KPI cards label says "Exchanges" which is correct, but the table section and detail page say "Conversations" / "Conversation Detail" which is misleading -- these are not full chat conversations, they are individual message exchanges.

---

## 6. Screenshots

- List page: `.playwright-cli/page-2026-02-25T17-41-29-755Z.png`
- Detail (2-turn/3-actual): `.playwright-cli/page-2026-02-25T17-41-51-765Z.png`
- Detail (3-turn/5-actual): `.playwright-cli/page-2026-02-25T17-42-44-253Z.png`

---

## 7. Summary of Issues

| # | Issue | Severity | Type |
|---|---|---|---|
| 1 | `num_turns` in header contradicts actual waterfall turns | Medium | Data inconsistency |
| 2 | "Conversation" terminology is misleading (these are exchanges) | Low | UX/naming |
| 3 | No clear labeling of what a "turn" means (SDK turn vs AssistantMessage) | Low | UX/naming |
