# Restore TypeScript Test Assertions (ENG-2030)

## Findings Restored

### Finding 1: `store_sync_error` visibility test restored
- **File**: `nextjs-app/tests/integration/projects/files-sync.test.ts`
- **What**: Added test `should include gfs_sync_error when sync has a recorded error`
- **How**: Test uploads a file, sets status to `excluded`, inserts a `gfs_sync_events` record with `error_message`, then verifies `getProjectFiles` returns the error in `gfs_sync_error`.

### Finding 2: "Too large for AI search" differentiation restored
- **File**: `nextjs-app/tests/unit/components/project-file-manager.test.tsx`
- **What**: Restored test `shows 'Too large for AI search' for files excluded by content size gate`
- **How**: Added `gfs_sync_error` field to `ProjectFile` type, enriched `getProjectFiles` query to fetch latest error from `gfs_sync_events`, passed `error` prop to `GfsSyncStatusIcon` in `project-file-manager.tsx`, updated test fixture `EXCLUDED_TOO_LARGE_FILE` with `gfs_sync_error`.

### Finding 10: 3 deletion scenario tests restored
- **File**: `nextjs-app/tests/integration/projects/files-sync.test.ts`
- **What**: Restored 3 separate deletion tests (synced, pending, failed)
- **How**: Each test uploads a file, sets its `gfs_sync_status` via admin, calls `deleteProjectFile`, and verifies the status transitions to `pending_deletion` on `project_files`.

### Finding 11: RLS exact count and event_type assertions restored
- **File**: `nextjs-app/tests/integration/drive/rls.test.ts`
- **What**: Restored `toBe(1)` instead of `toBeGreaterThanOrEqual(1)` and added `event_type` assertion
- **How**: Direct assertion fix, no code changes needed.

### Finding 12: RLS INSERT-deny test restored as meaningful assertion
- **File**: `nextjs-app/tests/integration/drive/rls.test.ts`
- **What**: Restored INSERT-deny assertion (test was a no-op)
- **How**: Changed test to verify that non-owner members (`world.member`) cannot INSERT into `gfs_sync_events` for drive entities. The new `gfs_sync_events` RLS policy allows project owners to insert (unlike old `drive_sync_events` which only allowed service role), so the test boundary moved from "owner blocked" to "non-owner blocked".

## Code Changes (to make tests pass)

| File | Change |
|------|--------|
| `nextjs-app/lib/services/project-files/types.ts` | Added `gfs_sync_error?: string \| null` to `ProjectFile` interface |
| `nextjs-app/lib/services/project-files/operations.ts` | Added batch query to `gfs_sync_events` to enrich excluded/failed files with latest `error_message` |
| `nextjs-app/components/project-file-manager.tsx` | Pass `error={file.gfs_sync_error}` to `GfsSyncStatusIcon` |
| `nextjs-app/tests/unit/components/project-file-manager.driver.tsx` | Added `gfs_sync_error` to `EXCLUDED_TOO_LARGE_FILE` fixture |

## Test Results

- Unit tests: 2110 pass, 0 fail
- Integration tests: 556 pass, 2 fail (pre-existing failures in `email-exclusion.test.ts`, unrelated)
- All 5 restored assertions pass
