# Fix: Restore `is_excluded` filter in claim RPCs (ENG-2030)

## Problem

The GFS sync unification migrations (Steps 1 and 5) redefined the `claim_pending_email_sync` and `claim_pending_attachment_sync` RPCs without carrying forward the `AND is_excluded = false` filter that was originally added in the ENG-2222 migration (`20260304115828_email_exclusion_and_external.sql`).

The Step 5 migration (`20260312024440_standardize_gfs_failure_enums.sql`) was the last to redefine these RPCs. It updated `'failed'` to `'upload_failed'` in the status checks but dropped the `is_excluded` filter lines entirely.

Additionally, `claim_pending_file_sync` never had an `is_excluded` filter despite `project_files` gaining the `is_excluded` column in Step 2 (`20260312012855_add_is_excluded_to_project_files.sql`).

## Root Cause

When the claim RPCs were rewritten in the unification migration, the author copied from a version that predated the ENG-2222 exclusion work, or the merge/rebase lost the filter lines. The result: excluded emails and attachments were being claimed for sync by the worker.

## Fix

Single migration: `20260312133602_restore_is_excluded_filter_in_claim_rpcs.sql`

Three RPCs updated with `CREATE OR REPLACE FUNCTION`:

| RPC | Filter added | Location in WHERE clause |
|-----|-------------|--------------------------|
| `claim_pending_email_sync` | `AND ie.is_excluded = false` | After `gfs_sync_status IN (...)` |
| `claim_pending_attachment_sync` | `AND ea.is_excluded = false` | After `gfs_sync_status IN (...)` |
| `claim_pending_file_sync` | `AND pf.is_excluded = false` | After `gfs_sync_status IN (...)` |

All other logic (retry counting, `excluded` status on max retries, `SKIP LOCKED`, `FOR UPDATE`) preserved exactly as in Step 5.

## Verification

### Integration tests (email-exclusion.test.ts)
- 19/19 pass
- Key tests: "skips excluded emails with pending status", "skips excluded attachments with pending status"
- Deletion RPCs correctly still process excluded items (intentional)

### Python unit tests
- All pass (3 skipped - expected)

## Files Changed

- `supabase/migrations/20260312133602_restore_is_excluded_filter_in_claim_rpcs.sql` (new)

## References

- ENG-2030: This bug fix
- ENG-2222: Original exclusion feature (`20260304115828_email_exclusion_and_external.sql`)
- ENG-2666: Step 5 migration that dropped the filter (`20260312024440_standardize_gfs_failure_enums.sql`)
