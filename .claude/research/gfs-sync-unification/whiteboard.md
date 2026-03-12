# GFS Sync Unification — Whiteboard (COMPLETE)

## Current State
Phase: DONE | Status: all steps complete, verified |
Last checkpoint: Final verification PASS — 1590 Python + 2110 Next.js tests, 0 errors, no stale refs
Build duration: 11 phases, ~15 commits on main

## Phase Map — COMPLETE
| # | Phase | Status | Outcome |
|---|-------|--------|---------|
| 1 | Research/Orient | done | 2 risks identified, both resolved |
| 2 | Commit plan file | done | 3c34916d |
| 3 | Step 0: Seed test data | done | 91 rows/9 tables |
| 4 | Step 1: Fix trigger & claim bugs | done | 7d81fcce — 4 bugs fixed |
| 5 | Step 2: Add is_excluded | done | 7ff02e09 |
| 6 | Step 3: Drop vestigial columns (ENG-2664) | done | 0922219e + d58846bb |
| 7 | Step 4: Python enum adoption | done | a7c19636 — 28 literals |
| 8 | Step 5: Standardize failure enums (ENG-2666) | done | 7f6fb580 |
| 9 | Step 6: Merge event tables (ENG-2665) | done | e6821b03 |
| 10 | Step 7: Extract Python helpers | done | 77eb1df5 |
| 11 | Step 8: Final verification | done | PASS |

## What Was Accomplished
- 3 event tables → 1 polymorphic `gfs_sync_events` with RLS
- 4 trigger/claim bugs fixed (soft-delete leak, excluded file sync, allowlist guards)
- 8 vestigial columns dropped, references cleaned across 18+ files
- 28 string literals → enums in Python
- Failure statuses standardized to `upload_failed`
- 9 claim RPCs unified against single event table
- 2 Python helpers extracted (`delete_from_store`, `check_content_gate`), ~160 lines dedup removed
- 16 new tests added
- 3 Linear sub-issues closed (ENG-2664, ENG-2665, ENG-2666)
- ENG-2667 correctly deferred

## Vertex AI Migration Surface (The Ultimate Goal)
After this unification, migrating to Vertex AI means:
1. Swap the guts of `check_content_gate()` + upload logic
2. Swap the guts of `delete_from_store()`
3. Point at 1 corpus instead of 6 stores
4. Drop the old GFS tables
