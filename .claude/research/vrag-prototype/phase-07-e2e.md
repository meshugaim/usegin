# Phase 07 — E2E Test Results

**Date:** 2026-02-26
**Environment:** Local (Supabase local, GCP ADC → effi-vertex-experiment / us-west1)

## Server Startup

| Component | Port | Status | Notes |
|-----------|------|--------|-------|
| VRAG Python API | 58100 | PASS | Starts in ~3s. Note: justfile uses `--reload-dirs` (invalid), correct flag is `--reload-dir` |
| VRAG Next.js UI | 63100 | PASS | First boot hit Turbopack panic (Next.js 16.1.0 known issue), auto-recovered on second attempt (cache cleared) |

## API Endpoint Tests

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/health` | GET | PASS (200) | `{"status":"healthy","service":"vrag-prototype"}` |
| `/` (root) | GET | PASS (200) | `{"service":"VRAG Prototype API","version":"0.1.0","status":"running"}` |
| `/api/vrag/files/{project_id}` | GET | PASS (200) | Returns file list (empty when no files) |
| `/api/vrag/search` | POST | PASS (200) | Returns chunks or "No corpus for this project" |
| `/api/vrag/corpus` | POST | PASS (200) | Created corpus `vrag-bbbbbbbb` on Vertex RAG Engine |
| `/api/vrag/upload` | POST | PASS (200) | Uploaded file, created version, stored in Supabase Storage |
| `/api/vrag/upload` (invalid ext) | POST | PASS (200) | Correct rejection: "Unsupported file type: .py" |
| `/api/vrag/files/{file_id}` | DELETE | PASS (200) | Marks file for deletion via sync_events |

## Next.js UI Tests

| Page | Status | Notes |
|------|--------|-------|
| `/admin/rag` | PASS (200) | Returns HTML (~27KB), server-rendered shell |
| `/admin/rag/search` | PASS (200) | Returns HTML (~27KB), server-rendered shell |

Note: VRAG content loads client-side via React. Curl only sees the SSR shell, which is expected.

## Full Chain Test

Tested the complete lifecycle with `project_id = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`:

1. **Create corpus** — PASS. Created `projects/768786717495/locations/us-west1/ragCorpora/8031044035508436992`
2. **Upload file** — PASS. Uploaded `vrag-test-file.txt` (232 bytes), got `file_id=05952d5a`, `version_id=d9dfd6d9`, `sync_status=pending`
3. **Sync worker** — PASS. Enabled via `VRAG_SYNC_WORKER_ENABLED=true`. Synced in ~7.3s. `sync_status` → `synced`, `rag_file_id=5642184660575414816`
4. **Search** — PASS. Query "artificial intelligence" returned 1 chunk:
   - Text: full document content
   - Score: 0.324
   - Source: `vrag-test-file.txt:05952d5a`
   - `rag_file_ids_used`: correctly scoped to synced file
5. **Delete** — PASS. File marked for deletion via `sync_events` table

## Issues Found

### Bug: `--reload-dirs` flag in justfile (Severity: Low)
The `vrag-api` recipe uses `--reload-dirs agent_api` but uvicorn expects `--reload-dir` (singular). The server fails to start with the justfile command as-is.

**Location:** `/workspaces/test-mvp/justfile:110`
**Fix:** Change `--reload-dirs` to `--reload-dir`

### Flaky: Turbopack Panic on Next.js 16.1.0 (Severity: Low)
First `bun run dev` on port 63100 crashed with a Turbopack internal error (`ProjectContainer::new`). Second attempt succeeded after Turbopack auto-cleared its cache. This is a known Next.js 16 issue, not VRAG-specific.

## Summary

All 8 API endpoints respond correctly. The full upload-sync-search chain works end-to-end when GCP ADC is configured. The sync worker processes pending files and the search returns correctly scoped chunks with relevance scores. The Next.js UI pages load successfully.

**Verdict: PASS** — All critical paths functional. One minor justfile typo to fix.
