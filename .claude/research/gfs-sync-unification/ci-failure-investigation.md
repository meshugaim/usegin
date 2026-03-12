# CI Failure Investigation: 77eb1df5 (Step 7)

**Date:** 2026-03-12
**Commit:** `77eb1df5` — refactor(gfs): extract delete_from_store and check_content_gate helpers
**Failed workflow:** DB Checks (pgTAP + Schema + Security)
**Failed job:** Security (did not reach any test execution)

## Summary

The `77eb1df5` CI failure is **NOT caused by our changes**. It is an infrastructure failure: the GitHub Actions runner could not download the `ScribeMD/docker-cache@0.5.0` action due to a `401 Unauthorized` error from the GitHub API. The job never reached any test execution — it failed during "Set up job" while fetching action dependencies.

## Root Cause

The "Security" job in the `db-checks.yml` workflow uses `ScribeMD/docker-cache@0.5.0` (SHA `fb28c93772363301b8d0a6072ce850224b73f74e`) for Docker image caching. GitHub returned `401 Unauthorized` when the runner tried to download this action's tarball. The runner retried twice (with backoff) and then failed:

```
##[warning]Failed to download action '.../ScribeMD/docker-cache/tarball/fb28c93...'. Error: 401 (Unauthorized).
##[warning]Back off 29.449 seconds before retry.
##[warning]Failed to download action '...'. Error: 401 (Unauthorized).
##[warning]Back off 22.89 seconds before retry.
##[error]Response status code does not indicate success: 401 (Unauthorized).
```

This is a transient GitHub API authentication error or a problem with the `ScribeMD/docker-cache` repository's visibility/access. It is unrelated to any code changes.

## Relationship to Previous CI Failures (Steps 3-4)

Steps 3 and 4 (`0922219e` and `a7c19636`) had **real** schema validation failures: 10 checks failed because 4 source files still referenced `gfs_sync_status` and `gfs_doc_id` on `project_file_versions` after those columns were dropped. Those failures were **fixed in commit `d58846bb`** ("fix(gfs): update stale column references after project_file_versions column drop"), which updated all 14 affected files.

The Step 7 commit (`77eb1df5`) only modifies Python service code (refactoring GFS delete/upload logic) — no migrations, no schema changes.

## Verdict

| Question | Answer |
|----------|--------|
| Is this caused by our changes? | **No.** Infrastructure failure (GitHub API 401). |
| Is this a pre-existing/unrelated failure? | **Yes.** `ScribeMD/docker-cache` download failed — transient GitHub API issue. |
| Does anything need to be fixed in our code? | **No.** |
| Recommended action | Re-run the failed "Security" job, or consider pinning `ScribeMD/docker-cache` to a known-working tag or replacing it if the repo has access issues. |

## Previous Schema Failures (Steps 3-4) — Already Resolved

For reference, `0922219e` and `a7c19636` had 10 schema validation failures in 4 files:

1. `nextjs-app/lib/services/project-stats.ts` — referenced `gfs_sync_status` on `project_file_versions`
2. `nextjs-app/lib/services/project-core.ts` — same
3. `python-services/agent_api/project_file_search_service.py` — referenced `gfs_doc_id` and `gfs_sync_status` on `project_file_versions`
4. `python-services/agent_api/admin_gfs_health.py` — same

All were fixed in `d58846bb` (14 files updated). Current codebase has zero references to dropped columns on `project_file_versions`.
