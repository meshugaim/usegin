# Phase 4: UI Validation & Staging Database State

## Summary

This phase attempted browser-based UI testing of GFS functionality on staging (`https://staging.askeffi.ai`) and supplemented with direct database queries via Supabase MCP to build a comprehensive picture of GFS health on staging. The browser test was limited by expired auth tokens (magic link flow requires human interaction), but the database investigation revealed significant findings about active GFS failures.

## Browser Test Results

### What Worked (Unauthenticated)
- **Staging app is live**: `https://staging.askeffi.ai` responded successfully
- **Sign-in page loads**: Correct redirect to `/sign-in`, page renders with email input and "Send magic link" button
- **No console errors**: Zero browser console errors on the sign-in page
- **Page title correct**: Shows `[STG] AskEffi` (staging indicator present)

### What Could Not Be Tested (Auth Required)
- File upload flow
- File search / chat with file context
- Project file listing with sync status indicators
- GFS admin dashboard
- Any authenticated page (workspace, project, chat)

**Blocker**: The `staging-auth.json` file exists but tokens are expired. Staging uses magic link authentication which requires a human to receive and paste the link. Per the `app-sanity-test` skill protocol, expired auth state must NOT be loaded to avoid rate-limiting the Supabase auth endpoint.

## Database Investigation (via Supabase MCP)

### Project Files GFS Sync Status

| Status | Count | Notes |
|--------|-------|-------|
| synced | 32 | Most files synced successfully |
| pending | 3 | New files awaiting sync (in "new proj" project) |
| failed | 3 | Stuck files -- 2 in Harbor View, 1 in New Project 1 |
| processing | 1 | Currently being synced (in "new proj") |

**Overall file sync health: 82% synced (32/39 active files).**

### Project File Versions Sync Status

| Status | Count | Notes |
|--------|-------|-------|
| synced | 34 | Healthy |
| deleted | 19 | Expected (old versions cleaned up) |
| pending | 10 | Waiting for sync worker |
| failed | 3 | Stuck |

Failed version errors:
1. **elevator-installation-guide.pdf** -- "Import operation timed out after 600s" (Harbor View Development)
2. **board-meeting-minutes-jan-2026.docx** -- "Import operation timed out after 600s" (Harbor View Development)
3. **retro.md** -- "403 PERMISSION_DENIED. You do not have permission to access the file search store `project-internal-082e67d6`" (My first project)

### Inbound Emails GFS Sync Status

| Status | Count | Notes |
|--------|-------|-------|
| pending | 52 | Massive backlog -- 50 in Harbor View Development alone |
| synced | 21 | Working |
| failed | 14 | All 14 in Harbor View Development, all failed today |
| excluded | 7 | Intentionally skipped |

**Email sync health: POOR. 52 pending + 14 failed = 66 emails not synced. Only 21 synced (22%).**

### Drive Files GFS Sync Status

| Status | Count | Notes |
|--------|-------|-------|
| synced | 4 | Healthy |
| excluded | 2 | Intentionally excluded |
| awaiting_confirmation | 1 | Waiting for user approval |

**Drive sync health: Good. 4/7 synced, rest are expected non-synced states.**

### Active Failure Patterns

#### Pattern 1: GFS Import Timeout (File Sync)

**Affected files:**
- `elevator-installation-guide.pdf` (Harbor View Development)
- `board-meeting-minutes-jan-2026.docx` (Harbor View Development)

**Error**: "Sync timed out after 300s" / "Import operation timed out after 600s"

**Behavior**: These two files are in a retry loop. The sync worker keeps attempting them every ~10 minutes:
- elevator-installation-guide.pdf: 6+ attempts in the last 2 hours, all timing out at ~665-680 seconds
- board-meeting-minutes-jan-2026.docx: 6+ attempts in the last 2 hours, all timing out at ~625-680 seconds

These are Office files (.docx, .pdf) that use the 3-step workaround path (File API upload -> wait for ACTIVE -> import into store). The import is hanging, suggesting a Google API issue with these specific files rather than a configuration problem.

#### Pattern 2: Supabase Storage 404 (Email Sync)

**Affected**: All 14 failed emails in Harbor View Development

**Error**: `{'statusCode': 404, 'error': not_found, 'message': Object not found}`

**Analysis**: The failed emails have `storage_path` values like `queue/c394221e-...json` and `has_body = true`. The error occurs very quickly (duration_ms: 300-700ms), suggesting the sync worker tries to download the email JSON from Supabase Storage but the object doesn't exist at that path. This could mean:
- The email JSON files were stored in a `queue/` path but were moved or deleted after classification
- There's a path mismatch between where emails are stored and where the sync worker looks

#### Pattern 3: Permission Denied (Orphaned Store Reference)

**Affected**: `retro.md` in "My first project" (project_id: 082e67d6)

**Error**: "403 PERMISSION_DENIED. You do not have permission to access the file search store `project-internal-082e67d6`"

**Analysis**: This is the classic Bug #009 pattern -- the store was created with a different API key than the one staging is currently using. The store ID in the database (`project-internal-082e67d6-unptnrycj3pa`) references a Google store that the staging key cannot access, likely created when the production key was used on staging.

#### Pattern 4: Harbor View Development -- Missing External Stores

The Harbor View Development project (project_id: `a0b1c2d3`) has 4 store records:
- internal/file: Has `google_store_id` (working)
- internal/email: Has `google_store_id` (working)
- **external/file: `google_store_id` = NULL** (broken)
- **external/email: `google_store_id` = NULL** (broken)

External stores were never provisioned in Google. Any external-access-level files or emails would fail to sync because there's no GFS store to sync them to.

#### Pattern 5: Pending Email Backlog (50 emails)

50 emails in Harbor View Development are stuck in `pending` status. Combined with the 14 failed emails (404 errors), this suggests the sync worker may be processing the failed batch repeatedly, consuming batch capacity, and never getting to the pending ones. Or the pending ones are also hitting the same 404 issue and getting retried.

### Project-Level Health Summary

| Project | Files Synced | Files Failed | Files Pending | Email Health |
|---------|-------------|-------------|--------------|--------------|
| testing the gfs admin | 5/5 | 0 | 0 | N/A |
| AskEffi - Perform Media | 4/4 | 0 | 0 | N/A |
| b | 3/3 | 0 | 0 | Has email store |
| P1 | 3/3 | 0 | 0 | N/A |
| new proj | 0/4 | 0 | 3 + 1 processing | N/A |
| **Harbor View Development** | **0/2** | **2** | **0** | **14 failed, 50 pending** |
| New Project 1 | 0/1 | 1 (PERMISSION_DENIED) | 0 | N/A |
| All others (14 projects) | 17/17 | 0 | 0 | Healthy |

### Working vs Broken

**What works on staging:**
- GFS store creation (most projects have valid Google store IDs)
- File sync for text files (.txt, .md, .pdf -- standard path)
- Small office file sync (some .docx files synced successfully in other projects)
- Drive file sync (4 synced)
- The sync worker is running and processing (events being generated today)

**What is broken on staging:**
- Large office file imports timing out (elevator-installation-guide.pdf, board-meeting-minutes-jan-2026.docx)
- Email sync for Harbor View -- 404 on storage paths
- 1 orphaned store reference (Bug #009 recurrence for project 082e67d6)
- Harbor View external stores never provisioned (NULL google_store_id)
- Pending email backlog growing (50 emails not being processed)

## Correlation with Previous Phases

### Phase 2 Finding F2 (text_extraction_service.py bug)
The `text_extraction_service.py` bug (using production key on staging) would affect PDF text extraction. The `elevator-installation-guide.pdf` timeout could be related -- if text extraction is hitting the production GCP project, the resulting File API file would be in the wrong project, and the import into the staging GFS store would fail or hang.

### Phase 2 Finding F3 (production key on staging Railway)
The permission denied error for `project-internal-082e67d6` confirms that at some point, a store was created with the wrong key. This aligns with the known `GEMINI_API_KEY` = production key being present on staging Railway.

### Phase 1 Open Question 3 (orphaned stores)
Confirmed: At least one store (`project-internal-082e67d6`) is orphaned -- the database has a store ID that doesn't exist (or is inaccessible) under the current staging key.

## Recommendations

1. **Immediate**: Fix the `text_extraction_service.py` bug (Phase 3 recommendation). This may resolve the office file timeout issue if the text extraction is creating files in the wrong GCP project.

2. **Immediate**: Run the admin GFS reconciliation tool (`/api/admin/gfs/reconcile`) on staging to get a full cross-reference of orphaned stores and missing documents.

3. **Short-term**: Investigate the email sync 404 errors -- check if the `queue/` storage path is correct or if email JSONs are being stored elsewhere after classification.

4. **Short-term**: Delete the orphaned store record for project `082e67d6` and let the sync worker recreate it with the correct staging key (same fix as Bug #009).

5. **Short-term**: Provision the missing external stores for Harbor View Development (or investigate why they have NULL google_store_ids).

6. **Medium-term**: Add monitoring/alerting for the sync worker -- the current state (files stuck in retry loops for hours, growing email backlogs) would not be visible without manual database inspection.

## Limitations

This phase could not complete full UI testing because:
1. Staging auth tokens were expired and magic link flow requires human interaction
2. No automated auth mechanism exists for staging (unlike local, which has `pw-auth.ts`)
3. Browser-based testing of file upload, file search results, and sync status UI was not possible

A follow-up UI test with fresh auth credentials would verify:
- Whether file upload UI shows sync status correctly
- Whether file search returns results for synced files
- Whether the chat correctly uses file context from GFS
- Whether sync errors are surfaced to users

## Sources

- Supabase staging MCP: `execute_sql` queries on `project_files`, `project_file_versions`, `project_file_search_stores`, `inbound_emails`, `email_sync_events`, `file_sync_events`, `drive_files`, `projects`
- Browser testing via `playwright-cli` against `https://staging.askeffi.ai`
- Previous phases: phase-01-architecture.md, phase-02-staging-keys.md, phase-03-key-audit.md
