# Phase 05: QA Results -- /admin/usage Rebuild

**Date:** 2026-02-25
**Environment:** Local (localhost:63000, sanity instance)
**Auth:** owner@test.local (admin)

---

## 1. Conversation List Page (`/admin/usage`)

### Verdict: PASS (after fixes)

| Check | Result | Notes |
|-------|--------|-------|
| Shows conversations grouped by claude_session_id | PASS | 4 unique sessions = 4 rows |
| No duplicate rows | PASS | 4 DB rows, 4 UI rows |
| Each row shows total cost | PASS | Verified against agent_usage.cost_usd |
| Each row shows exchange count | PASS | "1 msg" for each (all single-exchange conversations) |
| Each row shows duration | PASS | 10.5s, 11.1s, 3.6s, 3.6s match duration_ms |
| Each row shows turns | PASS | 2, 3, 1, 1 match num_turns |
| Each row shows tool stats | PASS (after fix) | Was showing "--" for all rows; now shows "1/1", "2/2" correctly |
| KPI card: Conversations | PASS | 4 total, 3 today |
| KPI card: Error Rate | PASS | 0.0% (no errors) |
| KPI card: Median Latency | PASS | 7.0s = median([3578, 3608, 10469, 11105]) |
| KPI card: Total Cost | PASS | $0.12 = sum of all cost_usd |
| KPI card: P95 | PASS | 11.0s (close to max with 4 samples) |
| Time filter (24h) | PASS | Reduces to 3 conversations, correct KPI recalculation |
| Time filter buttons | PASS | 24h, 7d, 30d, All -- 24h tested, active state shown |
| Project filter | PASS | Combobox present with "All projects" |
| Column sorting | PASS | Time, Exchanges, Turns, Duration, Cost have sort indicators |
| Tool Breakdown table | PASS | Shows correct tool names, call counts, error rates, P50/P95 |

### Data Correctness Verification

| conversation_id | DB cost_usd | UI cost | DB duration_ms | UI duration | DB turns | UI turns |
|----------------|-------------|---------|---------------|------------|----------|----------|
| 90ecb907 | 0.012763 | $0.01 | 10469 | 10.5s | 2 | 2 |
| 159652db | 0.036132 | $0.04 | 11105 | 11.1s | 3 | 3 |
| 3ca06167 | 0.037997 | $0.04 | 3578 | 3.6s | 1 | 1 |
| dca5db76 | 0.037975 | $0.04 | 3608 | 3.6s | 1 | 1 |

All match. Total DB cost: $0.124867, UI shows $0.12 (correct rounding).

---

## 2. Conversation Detail Page (`/admin/usage/c/[conversationId]`)

### Verdict: PASS (after fix -- was 404 before fix)

| Check | Result | Notes |
|-------|--------|-------|
| Row click navigates to detail | PASS (after fix) | Was returning 404 |
| Overview header shows user | PASS | owner@test.local |
| Overview header shows project | PASS | Kitchen Sink |
| Overview header shows model | PASS | sonnet |
| Overview header shows exchanges | PASS | 1 |
| Overview header shows duration | PASS | 10.5s |
| Overview header shows tokens | PASS | 6 in / 255 out |
| Overview header shows cost | PASS | $0.01 |
| Overview header shows time range | PASS | 2h ago |
| Exchanges listed | PASS | "#1 Success sonnet 2 turns 1 tool call 10.5s $0.01" |
| Exchange expandable | PASS | Clicking expands to show turns |
| Turns displayed | PASS | Turn 0 (91ms), Turn 1 (6.6s), Turn 2 (20ms) |
| Turn text previews | PASS | Turn 0 and Turn 2 show text |
| Tool call badges on turns | PASS | Turn 1 shows "1 tool" with mcp__data_browse__list_data_summary details |
| Tool details (name, result, duration) | PASS | "mcp__data_browse__list_data_summary, 1 result, 84ms" |
| "View waterfall" link | PASS | Present, links to correct agent_usage.id |
| Back breadcrumb | PASS | "Usage" links to /admin/usage |

Tested with two different conversations (90ecb907 and dca5db76) -- both load correctly after fix.

---

## 3. Existing Waterfall Page (`/admin/usage/[id]`)

### Verdict: PASS

| Check | Result | Notes |
|-------|--------|-------|
| Direct navigation works | PASS | /admin/usage/bd8e0a17-... loads correctly |
| Navigable from detail page | PASS | "View waterfall" link works |
| Header info correct | PASS | User, Project, Model, Duration, Cost, Turns, Status, Auth |
| Waterfall timeline renders | PASS | 3 turns with time markers 0s-10.5s |
| Turn details correct | PASS | Turn 0 (91ms), Turn 1 (6.6s), Turn 2 (20ms) |
| Tool call display | PASS | Turn 1 shows mcp__data_browse__list_data_summary 84ms OK |
| Sentry trace link | PASS | Links to askeffi.sentry.io |
| Breadcrumb to conversation | PASS | "Conversation" links to /admin/usage/c/90ecb907... |
| Token breakdown | PASS | "6 in, 255 out, 19,057 cache read, 854 cache creation" |

---

## 4. conversation_summary SQL VIEW

### Verdict: PASS

Queried directly via Supabase REST API. Returns correct aggregates:

- 4 rows, each with unique conversation_id matching claude_session_id
- exchange_count, total_turns, total_cost_usd, avg_duration_ms, max_duration_ms all verified against raw agent_usage
- has_error, error_count, has_incomplete flags all correct (false/0/false)
- first_exchange_at and last_exchange_at match created_at (single-exchange conversations)

---

## 5. Edge Cases

| Check | Result | Notes |
|-------|--------|-------|
| Orphan rows (no claude_session_id) | NOT TESTED | No orphan rows in local seed data. Code path exists and was fixed. |

---

## Bugs Found and Fixed

### Bug 1: Conversation detail page 404 (CRITICAL)

**File:** `nextjs-app/app/actions/admin-usage.ts`, function `getConversationOverview`

**Root cause:** The UUID-based orphan detection (`isOrphan = UUID_PATTERN.test(conversationId)`) was wrong. The `conversation_summary` view uses `COALESCE(claude_session_id, id::text)` as `conversation_id`. Since `claude_session_id` values ARE UUIDs, ALL conversation IDs were classified as "orphans" and queried by `agent_usage.id` instead of `agent_usage.claude_session_id`. No rows matched, returning 404.

**Fix:** Changed to try `claude_session_id` first (normal case), then fall back to `id` (orphan case) only when the first query returns empty.

### Bug 2: Tool stats missing on conversation list (MODERATE)

**File:** `nextjs-app/app/actions/admin-usage.ts`, tool stats secondary query in `getConversations`

**Root cause:** Same UUID-based classification bug. All `conversation_id` values were treated as `agent_usage.id` values, but they're actually `claude_session_id` values. Tool observations couldn't be traced back to conversations, so the Tools column showed "--" for all rows.

**Fix:** Query by `claude_session_id` first, then collect unmatched IDs and query by `id` as orphan fallback. Tool stats now show correctly (e.g., "1/1", "2/2").

---

## Console Errors

Only expected error: `Failed to load resource: net::ERR_CONNECTION_REFUSED @ http://localhost:8969/stream` (Sentry Spotlight not running on sanity instance). No application errors.

---

## Summary

**Overall verdict: PASS (after 2 bug fixes)**

The rebuild works correctly. The conversation list shows proper grouping, KPI aggregates match the DB, the detail page renders exchanges and turns with tool call badges, and the existing waterfall page continues to work. Two bugs in UUID-based orphan detection were found and fixed -- both stemmed from the incorrect assumption that `claude_session_id` values would not be UUIDs.
