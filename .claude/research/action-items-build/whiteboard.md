## Current State
Phase: 3 Implement Slice 3 | Status: DONE | Iteration: 1
Last checkpoint: Slice 3 implemented — 8 commits, all tests pass, pushed to main
Next: Verify Slice 3 (phase 3r) then Slice 4

## Auto-Inject (survives compaction — read this every time you re-orient)
Priority: Don't regress > Orchestrate > Build. Never sacrifice correctness for velocity.
Process: Re-read skill -> read whiteboard -> note-to-self -> spawn agent -> read summary only -> update whiteboard
Role: I am the director. I NEVER do work myself — not checking, not reviewing, not fixing, not reading code. Every action = a subagent. If I'm about to do it myself, I stop and delegate.
Output: Tell every agent "return <=10 line summary; write details to phase file." I read summaries, never details.
Integrity: After every implementation phase, spawn a test-integrity reviewer.
Verification: After each liaison run, spawn 5 verification agents: (a) code review, (b) compare to spec, (c) regression check, (d) test the code, (e) manual testing.
User mandate: Slow, careful, no regressions. Priority: 1. no regression 2. keep direction 3. complete. User is away.

## Goal
Implement the Action Items check feature (ENG-2764).

## Spec
ENG-2764 in Linear. Full spec at /tmp/ENG-2764.md.

## Linear Sub-Issues
- ENG-2796: Slice 1 — DONE, VERIFIED
- ENG-2797: Slice 2 — DONE, VERIFIED
- ENG-2798: Slice 3 — feat: action item runner, API endpoint, and settings UI
- ENG-2799: Slice 4 — feat: project card display and chat integration

## Slices

### Slice 1: assessment_runs migration (ENG-2796) — DONE, VERIFIED
- 5 commits, all 5 verification checks passed

### Slice 2: Action items table + tools + seed data (ENG-2797) — DONE, VERIFIED
- Table, RLS, tools, seed data all built
- Fix iteration: added 'clear' to VALID_STATUSES, parameterized tool description, migration for risks outcome CHECK
- All verification checks passed after fix

### Slice 3: Action item runner + settings UI (ENG-2798) — DONE
- Runner with pre-agent skip, shared state, re-query loop, prompt wrapper
- API endpoint POST /api/action-items/generate
- `projectChecks` browser flag + section wrapper in settings
- Action Items card (toggle + generate + poll) with server actions
- Seam from Slice 1: add `type='risk'` filter to getLatestRiskRunStatus
- Seam from Slice 1: explicitly set `type: 'risk'` in createRiskRun
- AC: #7, #8, #9, #10, #17

### Slice 4: Project cards + chat integration (ENG-2799) — PENDING

## Phase Map

| Phase | Type | Status | Outcome |
|-------|------|--------|---------|
| 0 | Setup | done | Linear issues created, env smoke-tested |
| 1 | Implement Slice 1 | done | PASS |
| 1r | Verify Slice 1 | done | 5/5 PASS |
| 2 | Implement Slice 2 | done | PASS after fix iteration |
| 2r | Verify Slice 2 | done | 5/5 PASS (after fix for 'clear' status) |
| 3 | Implement Slice 3 | done | PASS — 8 commits, 1904 py + 2262 js tests |
| 3r | Verify Slice 3 | pending | — |
| 4 | Implement Slice 4 | pending | — |
| 4r | Verify Slice 4 | pending | — |
| 5 | Final QA | pending | — |

## Quality Log
| Phase | Iteration | Verdict | Notes |
|-------|-----------|---------|-------|
| 0 | 1 | PASS | Env ready |
| 1 | 1 | PASS | 5 commits, clean |
| 1r | 1 | PASS | 5/5 verification checks |
| 2 | 1 | PASS | Implementation clean |
| 2r | 1 | DEVIATION | complete_assessment missing 'clear' status |
| 2r-fix | 1 | PASS | Fixed VALID_STATUSES, tool description, DB constraint |
| 2r | 2 | PASS | All checks pass after fix |
| 3 | 1 | PASS | 8 commits, 29 new py tests + 13 new js tests, all green |
