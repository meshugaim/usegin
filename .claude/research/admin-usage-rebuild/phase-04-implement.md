# Phase 04: Implementation Log -- Admin Usage Page Rebuild

**Date:** 2026-02-25
**Parent issue:** ENG-2074
**Session:** ab94c847-f234-4583-91f9-b1c84681a8d9

## Summary

Rebuilt `/admin/usage` from agent_usage-per-row to conversation-first in 5 sequential commits. All slices shipped, built, lint/type-checked, and pushed to main.

## Slices Completed

### Slice 1: ENG-2075 -- DB migration (conversation_summary VIEW)

**Commit:** `3b323052`

- Migration file pre-existed at `supabase/migrations/20260225175937_create_conversation_summary_view.sql`
- Validated: `bunx supabase migration up` applied cleanly
- Verified: `SELECT * FROM conversation_summary LIMIT 5` returned correct groupings
- Orphan rows (NULL `claude_session_id`) appear as individual conversations with UUID conversation_id
- Regenerated Supabase types: `database.types.ts` now includes `conversation_summary` in `Views`
- Fixed: type generation had WARN prefix from Supabase CLI output -- stripped manually

### Slice 2: ENG-2076 -- Server actions

**Commit:** `06d28f30`

Added 3 new server actions + supporting types to `nextjs-app/app/actions/admin-usage.ts`:

1. **`getConversationStats`** -- Replaces `getUsageStats`. Queries `conversation_summary` view for KPI aggregation. Uses `computeConversationPeriodStats` helper that maps view columns to `PeriodStats`.

2. **`getConversationsList`** -- Replaces `getConversations`. Paginated query on `conversation_summary` view with new sort columns (`first_exchange_at`, `total_turns`, `avg_duration_ms`, `max_duration_ms`, `total_cost_usd`, `exchange_count`). Tool stats enrichment via secondary query that handles both UUID (orphan) and session_id conversation IDs.

3. **`getConversationOverview`** -- New. UUID branching: if conversationId is a UUID, fetches single agent_usage by id (orphan); otherwise fetches all rows by claude_session_id. Returns `ConversationOverview` with `ExchangeSummary[]` including turns and tool observations.

New types: `ConversationSummaryRow`, `ConversationSummaryPage`, `ConversationOverview`, `ExchangeSummary`.

**Design decision:** Kept all existing functions and types for backward compatibility. The old `getUsageStats`, `getConversations`, `ConversationRow`, `ConversationsPage` remain in the file. Cleanup pass deferred.

**Type fix:** Initial implementation used `Promise<>[]` for parallel Supabase queries, but Supabase query builders are `PromiseLike`, not `Promise`. Fixed by sequentially awaiting each query.

### Slice 3: ENG-2077 -- Conversation-grouped list page

**Commit:** `4dfeb2db`

Modified 6 files:

- `app/admin/usage/page.tsx` -- Calls `getConversationStats`/`getConversationsList` instead of old functions. Default sort changed from `created_at` to `first_exchange_at`.
- `usage-page-client.tsx` -- Props updated to `ConversationSummaryPage`. Row click navigates to `/admin/usage/c/{conversationId}`.
- `kpi-cards.tsx` -- Label changed from "Exchanges" to "Conversations".
- `conversations-table.tsx` -- New columns: Exchanges (sortable), Turns (sortable). Sort columns updated. Row key is `conversationId`.
- `conversation-row.tsx` -- Rewritten for `ConversationSummaryRow`. Status derives from `hasError`/`hasIncomplete`. Duration shows "avg / max" for multi-exchange conversations.
- `utils.ts` -- Added `formatExchangeCount()` helper.

### Slice 4: ENG-2078 -- Conversation detail page

**Commit:** `018e1fdf`

Created 5 new files + modified 1:

- `app/admin/usage/c/[conversationId]/page.tsx` -- New route. Server component with admin auth check, calls `getConversationOverview`.
- `components/admin/usage/conversation/conversation-detail-page.tsx` -- Client wrapper rendering header + exchange list.
- `components/admin/usage/conversation/conversation-overview-header.tsx` -- 4-column grid: user/project, model/exchanges, duration/tokens, cost/time range. Multi-model indicator ("+N" badge).
- `components/admin/usage/conversation/exchange-list.tsx` -- Paginated exchange list with "Load more" (20 per page).
- `components/admin/usage/conversation/exchange-row.tsx` -- Expandable row showing turns inline. "View waterfall" link to existing `/admin/usage/{id}` page.
- `app/admin/usage/[id]/page.tsx` -- Back navigation now context-aware: links to `/admin/usage/c/{conversationId}` when exchange has a `claude_session_id`.

### Slice 5: ENG-2079 -- Turn tool-call marking

**Commit:** `979ba8e1`

Enhanced tool call display in `exchange-row.tsx`:
- Styled badge rows with background color (red for errors, neutral for success)
- Result count display when available
- Right-aligned duration for scan-friendly layout
- Error messages shown inline with full text accessible via `title` attribute hover
- Status dot (green/red) for quick visual scan

## Deviations from Spec

1. **No separate `turn-tool-badge.tsx` component.** The spec suggested this as optional. The tool display is inline in `exchange-row.tsx` -- simple enough to not warrant extraction. Can be extracted later if reuse is needed.

2. **Old functions kept, not removed.** Spec's cleanup section says to remove old `getUsageStats`/`getConversations` after all slices. Deferred to a separate cleanup commit to keep slices independently shippable.

3. **database.types.ts regenerated.** This file didn't exist before. It's now committed but not imported anywhere -- the Supabase client uses loose typing. A future improvement would wire this into the client creation for full type safety.

4. **Sub-agent spawning failed.** The `claude -p` approach for spawning sub-agents errored due to nested session detection. All implementation was done directly by the liaison.

## Build & Test Status

- `bun run build` passes on all commits
- Individual unit tests pass (home, chat-proxy, middleware, privacy-policy)
- `bun test` (all together) has a pre-existing hang issue unrelated to these changes
- Pre-push hook (lint + types + tests) passed on push

## Commit Log

```
979ba8e1 feat(admin): turn tool-call marking in exchange rows (ENG-2079)
018e1fdf feat(admin): conversation detail page + exchange drill-down (ENG-2078)
4dfeb2db feat(admin): conversation-grouped list page (ENG-2077)
06d28f30 feat(admin): add conversation-level server actions (ENG-2076)
3b323052 feat(db): create conversation_summary SQL VIEW (ENG-2075)
```

## Files Changed (total across all slices)

### New files (9)
- `supabase/migrations/20260225175937_create_conversation_summary_view.sql`
- `nextjs-app/lib/supabase/database.types.ts`
- `nextjs-app/app/admin/usage/c/[conversationId]/page.tsx`
- `nextjs-app/components/admin/usage/conversation/conversation-detail-page.tsx`
- `nextjs-app/components/admin/usage/conversation/conversation-overview-header.tsx`
- `nextjs-app/components/admin/usage/conversation/exchange-list.tsx`
- `nextjs-app/components/admin/usage/conversation/exchange-row.tsx`

### Modified files (7)
- `nextjs-app/app/actions/admin-usage.ts` (+674 lines)
- `nextjs-app/app/admin/usage/page.tsx`
- `nextjs-app/app/admin/usage/[id]/page.tsx`
- `nextjs-app/components/admin/usage/usage-page-client.tsx`
- `nextjs-app/components/admin/usage/kpi-cards.tsx`
- `nextjs-app/components/admin/usage/conversations-table.tsx`
- `nextjs-app/components/admin/usage/conversation-row.tsx`
- `nextjs-app/components/admin/usage/utils.ts`

## Remaining Work

1. **Cleanup pass:** Remove old `getUsageStats`, `getConversations`, `ConversationRow` type, unused imports from `admin-usage.ts`.
2. **Wire database.types.ts:** Connect regenerated types to Supabase client for full type safety on view queries.
3. **Manual QA:** Test full drill-down flow (list -> conversation -> exchange -> waterfall) with real multi-exchange conversations.
