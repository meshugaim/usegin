# Security Hardening Phase 2 — Build Whiteboard

**Linear:** ENG-3960 (parent)
**Investigation:** `docs/security/reports/2026-03-31-phase2-investigation-spikes.md`
**Branch:** main

## Slices

### Slice 1: Linear callback hardening
- **Issue:** ENG-4168
- **Status:** DONE
- **What:** Add CSRF state + user access check to `/api/linear/callback` (same pattern as Drive/Fathom)
- **Template:** Drive callback at `nextjs-app/app/api/drive/callback/route.ts`, Fathom callback at `nextjs-app/app/api/fathom/callback/route.ts`
- **Root cause:** `get_linear_auth_url()` in `unified_client.py` doesn't accept a state param

### Slice 2: OAuth revocation detection
- **Issue:** ENG-4169
- **Status:** DONE
- **Sub-steps:** auth error classification (27 tests) + connection error marking (10 tests)
- **What:** Classify auth errors in UnifiedClient, mark connections as error, surface in frontend
- **Key files:** `unified_client.py`, `sync_worker.py`, `fathom_sync_service.py`, connection tables

### Slice 3: Storage blob cleanup
- **Issue:** ENG-4171
- **Status:** DONE
- **What:** _cleanup_storage_blob in sync worker — emails + user-files buckets. 15 tests.
- **What:** Clean up orphaned blobs (emails, user-files buckets) on disconnect + VAIS DataStore/Engine deletion
- **Key files:** `sync_worker.py`, `drive_sync_service.py` (template), `vais/store_lifecycle.py`

## Decisions
- Defer service-role narrowing (DPA-5 REVIEW items) — marginal security benefit, needs RLS policy work
- Sequential slices, per our-workflow.md

## Summary
- **62 new security tests**, zero regressions
- All 3 slices: Red → Green → Test Integrity Review → Close
- Companion watched throughout

## Deferred
- Service-role narrowing (DPA-5 REVIEW items) — needs new RLS policies, marginal security benefit
- VAIS DataStore/Engine cleanup — needs LRO handling, separate from blob cleanup
- error_message columns on meeting_connections/linear_connections — enhancement, core detection works without

## Retro
- Process ran smoothly — TDD red/green/review cycle worked well
- Workers occasionally committed files from parallel builds — need stronger guardrails in prompts
- Investigation spikes → liaison build was the right pattern for this work
