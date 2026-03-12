# Fix 7 Remaining Integration Test Failures from GFS Sync Unification

**Date:** 2026-03-12
**Issue:** ENG-2030
**Migration:** `20260312141245_fix_retry_exhausted_and_conditional_deleted_at.sql`

## Root Cause Analysis

### Group 1: `retry_exhausted` vs `excluded` (3 test failures)

**Affected tests:**
- `test_claim_pending_rpcs.py::TestClaimPendingDriveDownload::test_excludes_exhausted_files`
- `test_claim_pending_rpcs.py::TestClaimPendingEmailSync::test_excludes_exhausted_files` (already fixed by prior migration)
- `test_sync_worker_e2e.py` — all retry exhaustion assertions

**Root cause:** The merge migration `20260312030252_merge_gfs_event_tables.sql` redefined all 9 `claim_pending_*` RPCs using `'excluded'::gfs_sync_status` in the exhaustion branch. The prior fix migration `20260312133602_restore_is_excluded_filter_in_claim_rpcs.sql` only corrected 3 of 9 RPCs (file_sync, email_sync, attachment_sync), leaving 6 RPCs still writing `'excluded'`:

1. `claim_pending_file_deletion`
2. `claim_pending_email_deletion`
3. `claim_pending_attachment_deletion`
4. `claim_pending_drive_download`
5. `claim_pending_drive_sync`
6. `claim_pending_drive_deletion`

**Fix:** Replaced `'excluded'::gfs_sync_status` with `'retry_exhausted'::gfs_sync_status` in all 6 remaining RPCs. This matches the original behavior from migration `20260223211952_wire_retry_exhausted_rpcs.sql`.

### Group 2: `deleted_at` set prematurely on emails/attachments (4 test failures)

**Affected tests:**
- `test_email_sync_events.py::TestConditionalDeletedAt::test_email_body_deleted_with_live_attachments_no_deleted_at`
- `test_email_sync_events.py::TestConditionalDeletedAt::test_last_attachment_deleted_cascades_deleted_at_to_email`
- `test_email_sync_events.py::TestConditionalDeletedAt::test_attachment_deleted_with_sibling_alive_no_cascade`
- `test_email_sync_events.py::TestConditionalDeletedAt::test_email_body_deleted_visible_when_deleted_at_null`

**Root cause:** The unified trigger `update_gfs_sync_status()` in `20260312030252` set `deleted_at = NOW()` unconditionally on `deletion_succeeded` for both emails and attachments. The old trigger `update_inbound_email_sync_status()` from `20260211031425_email_deleted_at_conditional.sql` had sibling-aware logic:

- **Email body path:** Only set `deleted_at` if no live attachments exist (`ea.deleted_at IS NULL` check).
- **Attachment path:** After marking the attachment deleted, cascade `deleted_at` to the parent email only if (a) the email is already `gfs_sync_status = 'deleted'` and (b) no live attachments remain.

This prevents emails from vanishing while attachment deletions are still pending.

**Fix:** Restored the conditional logic in the unified trigger:
- Email branch: `deleted_at` uses `NOT EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.inbound_email_id = NEW.entity_id AND ea.deleted_at IS NULL)` check.
- Attachment branch: After the primary UPDATE, a separate cascade UPDATE sets `deleted_at` on the parent email only when it's the last live attachment.

The attachment cascade looks up `inbound_email_id` from `email_attachments` (since `gfs_sync_events` no longer has this column directly).

## Test Results

```
test_claim_pending_rpcs.py: 22 passed
test_email_sync_events.py:  87 passed
test_sync_worker_e2e.py:     8 passed
db security check:         459 checks passed
```
