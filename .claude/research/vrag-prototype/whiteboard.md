# VRAG Prototype — Whiteboard

## Current State
Phase: 10 Debug date_epoch filtering | Status: starting | Iteration: 1
Last checkpoint: User reports date_epoch filter breaks search. Files uploaded via UI don't have date_epoch. Need to reproduce via browser, debug, fix.
Next: Spawn agent to start servers, upload files via browser, test filters, find root cause, fix.

## Auto-Inject (survives compaction — read this every time you re-orient)
Process: Re-read skill (§Pre-Phase Hook) → read whiteboard → note-to-self (§Note-to-Self) → spawn agent → read summary only → update whiteboard
Role: I am the director. I NEVER do work myself — not checking, not reviewing, not fixing, not reading code. Every action = a subagent. If I'm about to do it myself, I stop and delegate. (§Hard Rules, §Role Collapse)
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source. (§Agent Output Protocol)
Verification: Spawn sanity-check agents at phase boundaries AND between phases for continuous confidence. Not just in QA. (§Continuous Verification)

## Problem Statement
User workflow: search with query → gets results → adds `date_epoch > 1700000000` filter → gets 0 results.
Files uploaded via UI don't have `date_epoch` populated → any date filter excludes them (NULL fails all comparisons).
This is a real usability bug: the filter system advertises `date_epoch` but it's never set on uploaded files.

## Likely Root Cause
- `date_epoch` is NULL on all UI-uploaded files
- SQL `date_epoch > X` excludes NULLs (NULL is not > anything)
- Fix: auto-populate `date_epoch` with upload timestamp (epoch seconds) when not explicitly provided

## Plan
1. Start servers, upload a file via browser (playwright), verify it's searchable
2. Add date_epoch filter, confirm it breaks
3. Check DB to confirm date_epoch is NULL
4. Fix: auto-populate date_epoch on upload
5. Backfill existing files
6. Test again
7. Commit

## Ports
- 58100 — VRAG Python API
- 63100 — VRAG Next.js UI

## Quality Log
- Phases 1-9: All PASS
