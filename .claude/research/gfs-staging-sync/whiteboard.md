# GFS Staging Sync Issues — Final Diagnosis

## Driving Question
Why is GFS not syncing properly on staging?

## Answer
**Multiple overlapping issues, with one systemic bug that explains the worst symptoms.**

The GFS sync pipeline on staging is partially working (34 files synced successfully), but severely degraded for emails (76% failure rate). The primary issue is a **batch queue starvation bug** in the sync worker that causes failed items to permanently block pending items from being processed. This is compounded by Harbor View demo data issues and a key configuration bug in `text_extraction_service.py`.

---

## Root Causes (Priority Order)

### 1. CRITICAL: Batch Queue Starvation Bug
**Location:** `sync_worker.py:164-189` (files) and `sync_worker.py:456-479` (emails)

The worker queries `pending` + `failed` items ordered by `created_at` with `LIMIT 10`. Items that hit `MAX_RETRY_COUNT` (5) are skipped via `continue` but never removed from the query results. They permanently occupy batch slots, blocking newer pending items behind them.

**Proof on staging:**
- 14 Harbor View emails: `gfs_sync_status = 'failed'`, `created_at = 14:11` — 10 of 14 have `failure_count = 5`
- 50 pending emails: `created_at = 14:14–14:17` — zero events, never attempted
- The 10 maxed-out failed emails fill the batch every cycle, get skipped, and the 50 pending emails are never fetched

**Fix:** Either exclude items with `failure_count >= MAX_RETRY_COUNT` from the query (add a `gfs_sync_status` transition to a terminal `exhausted` state), or filter in the query (add `sync_retry_count < MAX_RETRY_COUNT` to the WHERE clause).

### 2. HIGH: Harbor View Demo Data — Email Content Missing from Storage
**Impact:** 14 emails permanently failing with 404 "Object not found"

All 14 failed emails on project `a0b1c2d3` were bulk-inserted at `14:11:53` (seed data). The `storage_path` column is populated, but the actual objects don't exist in Supabase Storage. The sync worker downloads email JSON from storage → 404.

**Fix:** Either upload the email content to storage to match the `storage_path` values, or delete the failed email records and re-seed properly.

### 3. HIGH: `text_extraction_service.py` Key Bug
**Location:** `text_extraction_service.py:314`

```python
# BUG: bypasses get_gemini_api_key()
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_DEV")
```

On staging, `GEMINI_API_KEY` resolves to the **production** key (`AIzaSyCZ3A...`). PDF text extraction uploads files to the production GCP project instead of staging. This is a cross-environment contamination issue.

**Fix:** Replace with `from agent_api.agent.config import get_gemini_api_key; api_key = get_gemini_api_key()`.

Only production code path with this bug (confirmed by full codebase audit — Phase 3).

### 4. MEDIUM: External Stores Not Provisioned
Harbor View project has 4 store rows (internal file, internal email, external file, external email). The 2 external stores have `NULL google_store_id` — created in DB but never provisioned in GCP. `ensure_project_store()` should handle this on first use (it checks for NULL and creates), but if no external content exists yet, they remain NULL. Not a bug per se, just orphaned pre-provisioning.

### 5. MEDIUM: File Import Timeouts
Two files on Harbor View (`elevator-installation-guide.pdf`, `board-meeting-minutes-jan-2026.docx`) timing out after 300s in the GFS import poll loop. Worker retrying repeatedly (~6 attempts today, ~10min apart). This is either a staging GCP quota issue, or these files are genuinely too large for the import timeout.

### 6. LOW: Staging Railway Env Var Trap
Staging has `GEMINI_API_KEY` set to the production value. This is unused by correct code (`get_gemini_api_key()` reads `GEMINI_API_KEY_STAGING`), but it's a trap for any code that reads `GEMINI_API_KEY` directly (like the `text_extraction_service.py` bug above, or future code).

**Fix:** Remove `GEMINI_API_KEY` from staging Railway environment, or set it to an invalid sentinel value.

### 7. LOW: Startup Validation Gap
`agent_api/config.py` only validates `GEMINI_API_KEY` exists at startup, not `GEMINI_API_KEY_STAGING`. A missing staging key won't surface until runtime.

---

## Current State Summary

| Content Type | Total | Synced | Failed | Pending (stuck) | Health |
|---|---|---|---|---|---|
| Files | 47 | 34 | 3 | 10 | 72% |
| Emails | 94 | 21 | 14 | 52 | 22% |
| Drive | 9 | 4 | 0 | 0 | 100% |

## Evidence Trail
- `phase-01-architecture.md` — Full sync pipeline architecture
- `phase-02-staging-keys.md` — API key inventory and `text_extraction_service.py` bug
- `phase-03-key-audit.md` — Full codebase audit (1 bug found)
- `phase-03b-staging-db-state.md` — Staging database health snapshot
- `phase-04-ui-validation.md` — UI test results (auth-blocked, DB analysis)

## Recommended Fix Priority
1. **Fix batch starvation** — systemic, blocks all pending items (files + emails)
2. **Fix `text_extraction_service.py` key bug** — 1-line fix, prevents cross-env contamination
3. **Clean up Harbor View data** — delete orphaned failed emails, retry or re-seed
4. **Remove `GEMINI_API_KEY` from staging Railway** — eliminate the trap
5. **Add startup validation for `GEMINI_API_KEY_STAGING`** — defense in depth

## Confidence: HIGH
All findings are backed by code reading + staging DB queries. The batch starvation mechanism is provably demonstrated by the data (14 failed emails with `created_at` before 50 pending emails, all pending have zero events). The `text_extraction_service.py` bug is confirmed by code + Railway env var values.
