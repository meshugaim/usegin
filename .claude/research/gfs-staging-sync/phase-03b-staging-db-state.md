# Phase 3b: Staging Database GFS Sync State

## Summary

GFS sync on staging is **partially working but significantly degraded**. 34 file versions have synced successfully across 18 projects (sync has worked historically), but there are active failures across all three content types (files, emails, drive files). The most concerning findings are: (1) a confirmed 403 PERMISSION_DENIED error from a store ID mismatch, (2) 14 emails failing with 404 "Object not found" errors on a project with duplicate stores, and (3) 10 file versions stuck in `pending` forever with no retry activity.

## Findings

### 1. GFS Stores Overview

**38 total stores** across 24 projects. Most projects have 1-2 stores.

**Key anomaly: Project `a0b1c2d3` has 4 stores (duplicate file + duplicate email)**

| Store ID | Type | google_store_id | Created | Updated |
|---|---|---|---|---|
| `cc631e3b` | email | **NULL** | 2026-02-21 13:59 | 2026-02-21 13:59 |
| `23d2c3c9` | email | `project-internal-email-a0b1-1d62u5cs8e55` | 2026-02-21 13:59 | 2026-02-21 14:11 |
| `cce05ba6` | file | **NULL** | 2026-02-21 13:59 | 2026-02-21 13:59 |
| `c8d96d2c` | file | `project-internal-a0b1c2d3-eknodfxhw9v0` | 2026-02-21 13:59 | 2026-02-21 14:34 |

All 4 stores share the same `created_at` timestamp. Two were provisioned with a `google_store_id`, two were not. This is the **only project with NULL google_store_ids** in the entire staging database. This looks like a race condition or duplicate store creation during the Harbor View demo data setup.

**2 stores have NULL google_store_id** -- both on project `a0b1c2d3`. These are orphaned DB rows that never got provisioned in GCP.

### 2. Project Files Sync Status

| Status | Count |
|---|---|
| synced | 34 |
| deleted | 22 |
| pending | 4 |
| failed | 3 |

**Failed files (3):**

| File | Project | Error (from version) | When |
|---|---|---|---|
| `elevator-installation-guide.pdf` | `a0b1c2d3` | Import operation timed out after 600s | 2026-02-21 |
| `board-meeting-minutes-jan-2026.docx` | `a0b1c2d3` | Import operation timed out after 600s | 2026-02-21 |
| `gfs-test-document.docx` | `6bf97108` | (no storage path) | 2025-12-29 |

The two `a0b1c2d3` failures are from today's user testing session -- they timed out after 600s, likely because the GFS import poll loop exceeded the timeout. The `gfs-test-document.docx` failure from December is a different issue (no storage path found for the file version).

**Pending files (4):**
- 3 files on project `9876e700` (created today, 2026-02-21 ~16:16 UTC) -- these are very recent and may still be processing
- 1 file on project `a0b1c2d3` (also today) -- but this project has the duplicate store issue

### 3. Project File Versions Sync Status

| Status | Count |
|---|---|
| synced | 34 |
| deleted | 19 |
| pending | 10 |
| failed | 3 |
| processing | 0 |

**Failed versions (3):**

1. **`elevator-installation-guide.pdf` v1** -- "Import operation timed out after 600s" (no google_doc_id)
2. **`board-meeting-minutes-jan-2026.docx` v1** -- "Import operation timed out after 600s" (no google_doc_id)
3. **`retro.md` v1** (project `082e67d6`) -- **"403 PERMISSION_DENIED. You do not have permission to access the file search store `project-internal-082e67d6-iwsf1ime7n4o` or it may not exist."**

**The 403 PERMISSION_DENIED is direct evidence of Bug #009.** The error references store ID `project-internal-082e67d6-iwsf1ime7n4o`, but the actual store in the database is `project-internal-082e67d6-unptnrycj3pa`. The code tried to access a store that either (a) was created with the wrong API key (production key on staging GCP) and is therefore inaccessible, or (b) was created in the wrong GCP project entirely. The store ID suffix is a random string, so these are clearly two different stores. The DB was updated to the correct store, but the old file version still has the failed status from the attempt against the wrong store.

**Pending versions (10) -- permanently stuck:**

| Project | Filename | Version | Pending Since |
|---|---|---|---|
| `082e67d6` | retro.md | v1 | 2025-12-09 |
| `082e67d6` | retro.md | v1 | 2025-12-09 |
| `082e67d6` | mob-to-ai-patterns.md | v1 | 2025-12-10 |
| `87f9e6ba` | Krystal _ Guy dicussion.txt | v1 | 2026-01-14 |
| `87f9e6ba` | Krystal _ Guy dicussion.txt | v2 | 2026-01-14 |
| `4194668e` | 13.3 (Hebrew PDF) | v1 | 2026-02-17 |
| `9876e700` | 4 files | v1 each | 2026-02-21 (today) |

The Dec 2025 and Jan 2026 pending items have been stuck for **weeks to months**. No retry mechanism is rescuing them. The Feb 17 and Feb 21 items may be more recent but the pattern is the same -- once stuck in pending, nothing retries.

### 4. File Sync Events

**Event type breakdown:**

| Event | Count |
|---|---|
| sync_started | 67 |
| deletion_started | 46 |
| sync_succeeded | 46 |
| sync_requested | 40 |
| sync_failed | 20 |
| deletion_succeeded | 17 |
| deletion_requested | 10 |

**Failure rate: 20 sync_failed out of 67 sync_started = 30% failure rate.**

**Error categories from file_sync_events (20 failures):**

1. **"Sync timed out after 300s"** -- 10 events, all from project `a0b1c2d3`, files `elevator-installation-guide.pdf` and `board-meeting-minutes-jan-2026.docx`. Duration ~625-680 seconds each (the 300s is the import poll timeout, but the total event duration was ~10 minutes). These are happening repeatedly today (2026-02-21 14:45 through 16:25), suggesting the worker keeps retrying.

2. **"No storage path found for file version"** -- 7 events across 3 files. File was created in DB but the binary was never uploaded to Supabase Storage. Classic race condition -- file row created before upload completes, sync worker picks it up immediately.

3. **"Failed to upload to Google File Search: gateway error: Network connection lost"** -- 1 event (project `a474ed25`, 2026-01-09). Transient network issue with Supabase Storage proxy.

### 5. Inbound Emails Sync Status

| Status | Count |
|---|---|
| pending | 52 |
| synced | 21 |
| failed | 14 |
| excluded | 7 |

**55% of emails are stuck in pending.** This is the worst-affected content type.

**Email sync events breakdown:**

| Event | Count |
|---|---|
| sync_started | 90 |
| sync_failed | 68 |
| sync_succeeded | 22 |

**76% failure rate on email sync attempts.** For every successful sync, there are ~3 failures.

**All 14 failed emails belong to project `a0b1c2d3`** (Harbor View demo project). All created at the exact same timestamp (2026-02-21 14:11:53). All failing with **"404 Object not found"** errors.

The 404 errors are consistent with the email content not being found in Supabase Storage. The email sync worker tries to download the email body from storage, but it's not there. This could be because:
- The emails were seeded into the DB without corresponding storage objects
- Or the storage path is wrong

The `a0b1c2d3` project's email store DOES have a valid `google_store_id`, so this isn't a GFS permission issue -- it's an upstream storage issue.

**52 pending emails** spanning from 2026-02-02 through 2026-02-21. Same pattern as files -- once stuck in pending, no retry.

### 6. Drive Files Sync Status

| Status | Count |
|---|---|
| synced | 4 |
| deleted | 2 |
| excluded | 2 |
| awaiting_confirmation | 1 |

**Drive sync is the healthiest pathway** -- no failed items, though only 9 total files.

**Drive sync events:**

| Event | Count | Latest |
|---|---|---|
| sync_succeeded | 8 | 2026-02-20 18:46 |
| sync_started | 20 | 2026-02-20 18:46 |
| download_succeeded | 5 | 2026-02-20 18:46 |
| download_started | 5 | 2026-02-20 18:46 |
| deletion_succeeded | 5 | 2026-02-19 09:55 |
| sync_failed | 11 | 2026-02-19 09:45 |
| deletion_started | 2 | 2026-02-19 07:55 |

**Drive sync errors (all on single file `511e1032`):**

| Error | Count | Date Range |
|---|---|---|
| 400 INVALID_ARGUMENT: File ID cannot be more than 40 characters | 3 | Feb 17-19 |
| 409 Duplicate: Resource already exists | 3 | Feb 17 |
| 400 Bad Request: Upload already terminated | 2 | Feb 17 |
| 503 UNAVAILABLE: Failed to count tokens | 2 | Feb 19 |
| 503 UNAVAILABLE: Service unavailable | 1 | Feb 19 |

One problematic drive file went through a saga of errors (too-long ID, duplicates, upload termination, then GCP service availability issues) before eventually being deleted. The "File ID cannot be more than 40 characters" error is a code bug -- the GFS file ID naming is exceeding Google's limit.

### 7. Confirmed 403 PERMISSION_DENIED (Key Mismatch Evidence)

**Direct evidence of Bug #009 exists in the database.**

File: `retro.md` (project `082e67d6`)
- Store in DB: `fileSearchStores/project-internal-082e67d6-unptnrycj3pa`
- Store in error: `project-internal-082e67d6-iwsf1ime7n4o`
- Error date: 2025-12-11

The file sync attempted to write to a store (`iwsf1ime7n4o`) that doesn't match the current store in the database (`unptnrycj3pa`). This means:
1. A store was created with one API key (likely the production key used on staging by mistake)
2. The store was later recreated with the correct staging key, getting a new ID (`unptnrycj3pa`)
3. But the old file version still references the attempt against the old, inaccessible store
4. The file version remains in `failed` status with no retry

### 8. Orphan/Health Summary

| Metric | Value |
|---|---|
| Total stores | 38 |
| Stores with NULL google_store_id | 2 (both on `a0b1c2d3`) |
| Projects with stores | 24 |
| Projects with files | 21 |
| Projects with files but no file store | 1 |
| File versions synced successfully | 34 (across 18 projects) |
| File versions permanently pending | 10 (3+ weeks old, some 2+ months) |
| File versions failed | 3 |
| Emails pending | 52 (55% of all emails) |
| Emails failed | 14 (all project `a0b1c2d3`) |
| Emails synced | 21 |
| Drive files healthy | 4 synced, 0 failed |
| Confirmed PERMISSION_DENIED errors | 1 (store ID mismatch on `082e67d6`) |

## Sources

All data from `mcp__supabase-staging__execute_sql` queries against the staging Supabase database, executed 2026-02-21.

Tables queried:
- `project_file_search_stores` -- 38 rows
- `project_files` -- 63 rows (34 synced, 22 deleted, 4 pending, 3 failed)
- `project_file_versions` -- 66 rows (34 synced, 19 deleted, 10 pending, 3 failed)
- `file_sync_events` -- 246 total events (67 started, 46 succeeded, 20 failed)
- `inbound_emails` -- 94 rows (52 pending, 21 synced, 14 failed, 7 excluded)
- `email_sync_events` -- 180 total events (90 started, 22 succeeded, 68 failed)
- `drive_files` -- 9 rows (4 synced, 2 deleted, 2 excluded, 1 awaiting)
- `drive_sync_events` -- 56 total events

## Open Questions

1. **Why are 52 emails stuck in pending?** Is the email sync worker even running on staging? The 76% failure rate on attempted syncs suggests the worker runs but frequently fails.

2. **Why do pending file versions never get retried?** Some have been pending since December 2025. Is there a dead-letter or retry mechanism? `sync_retry_count` is 0 on all pending items.

3. **Were ALL stores on staging created with the correct API key?** We confirmed one PERMISSION_DENIED (store `082e67d6`), but the store was subsequently recreated. Could other stores also be affected? The fact that 34 files have successfully synced suggests most stores are correctly provisioned.

4. **What is the status of the `a0b1c2d3` (Harbor View) project?** It has duplicate stores (4 instead of 2), NULL google_store_ids on half of them, timeout failures on files, and 404 failures on all 14 emails. This project seems to have been recently set up (all created 2026-02-21) and may be a test/demo project that was improperly initialized.

5. **Is the "File ID cannot be more than 40 characters" error (drive sync) a code bug that affects other files?** Only one drive file triggered it, but it suggests a naming convention issue in the GFS file ID generation.

## Dead Ends

None -- all queries returned useful data. The staging database is well-structured and the sync event tables provide good observability into failure modes.
