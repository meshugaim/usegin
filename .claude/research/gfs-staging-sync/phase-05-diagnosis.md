# Phase 5: Diagnosis — Batch Queue Starvation Bug

## Summary

This phase synthesized findings from Phases 1-4 and direct staging DB queries to identify the systemic root cause of the email sync degradation.

## The Batch Starvation Mechanism

### Code Path

`sync_worker.py:454-467` (email sync query):
```python
self.supabase.table("inbound_emails")
    .select(...)
    .eq("status", "classified")
    .in_("gfs_sync_status", [GfsSyncStatus.PENDING, GfsSyncStatus.FAILED])
    .not_.is_("project_id", "null")
    .not_.is_("storage_path", "null")
    .order("created_at")
    .limit(BATCH_SIZE)  # BATCH_SIZE = 10
    .execute()
```

`sync_worker.py:476-479` (retry skip):
```python
failure_count = self._get_email_failure_count(email_id)
if failure_count >= MAX_RETRY_COUNT:  # MAX_RETRY_COUNT = 5
    logger.warning(f"{email_prefix} Max retries exceeded: failures={failure_count}")
    continue  # <-- skips but doesn't remove from future queries
```

The same pattern exists for file sync at `sync_worker.py:160-189`.

### What Happens

1. Query fetches 10 oldest items with `gfs_sync_status IN ('pending', 'failed')`, ordered by `created_at`
2. Failed items with `failure_count >= 5` are skipped via `continue`
3. But they remain in `failed` status — the query will fetch them again next cycle
4. Newer `pending` items sit beyond position 10 in `created_at` order and are never fetched

### Proof from Staging DB

**Query 1:** Email ordering shows failed items block pending items
```
gfs_sync_status | earliest                     | latest                       | cnt
failed          | 2026-02-21 14:11:53.083964   | 2026-02-21 14:11:53.083964   | 14
pending         | 2026-02-21 14:14:53.665025   | 2026-02-21 14:17:26.792075   | 50
```

**Query 2:** 10 of 14 failed emails have `failure_count = 5` (MAX_RETRY_COUNT):
```
id         | subject                                 | failure_count
3c63b11c   | RE: PSW-2026-0847 - A913 Grade 65...    | 5
041d3c5b   | Harbor View Tower - Below-Grade...      | 5
4e8d9b1c   | RE: Harbor View Tower - Cold Weather...  | 5
a521622f   | RE: RE: Harbor View Tower - Cold...      | 5
506f45ca   | SCHEDULED DOWNTIME: Harbor View BIM...   | 5
11447036   | RE: RE: PSW-2026-0847 - A913 Grade...    | 5
65a0ab47   | Harbor View Tower - BIM Clash...         | 5
5560d0c8   | PSW-2026-0847 - A913 Grade 65...        | 5
4b67a081   | RE: RE: Harbor View Tower - BIM...       | 5
97d428e8   | Harbor View Tower - Cold Weather...      | 3  (not yet maxed)
```

10 items with failure_count=5 ≥ BATCH_SIZE of 10 → complete starvation.

**Query 3:** All 50 pending emails have zero events (never attempted):
```
All 15 sampled pending emails: failure_count=0, start_count=0, last_event=null
```

**Query 4:** Worker eligibility confirmed — 50 pending emails all meet criteria:
```
status=classified, gfs_sync_status=pending, has_project=true, has_storage_path=true → 50 rows
```

### Fix Options

**Option A (Recommended): Add terminal status**
- Add `exhausted` to the `gfs_sync_status` enum
- When `failure_count >= MAX_RETRY_COUNT`, transition to `exhausted` instead of staying in `failed`
- Worker query naturally excludes `exhausted` items
- Admin dashboard can show exhausted items for manual intervention

**Option B: Filter in query**
- Add `.lt("sync_retry_count", MAX_RETRY_COUNT)` to the query
- Requires `sync_retry_count` to be accurately maintained (currently 0 on all items)
- Simpler but relies on counter accuracy

**Option C: Exclude from query after max retries**
- After detecting max retries in the loop, immediately update status to a terminal state
- Prevents re-fetching in subsequent cycles
- Same as Option A but triggered in the loop instead of via event

## Relationship to Other Findings

The batch starvation bug **amplifies** the Harbor View failures:
1. Harbor View seed data created 14 emails with missing storage objects
2. These fail fast (404), hitting MAX_RETRY_COUNT in ~5 cycles
3. Once maxed out, they permanently block all other email processing
4. Without the starvation bug, the 50 pending emails would still be processed despite the 14 failures

The `text_extraction_service.py` key bug (F1) is **independent** — it affects PDF text extraction, not the sync worker's batch processing. Whether it contributes to the file import timeouts is unverified.

## Sources

- `sync_worker.py:160-189` (file sync batch processing)
- `sync_worker.py:454-479` (email sync batch processing)
- Staging Supabase queries via `mcp__supabase-staging__execute_sql` (2026-02-21)
- Phase 3b data (`phase-03b-staging-db-state.md`)
