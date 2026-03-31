# Meeting Inclusion Rules — Build Whiteboard

## Current State
Slice: 2 (ENG-3741) people-rules | Step: DONE | Status: closed
Last checkpoint: ENG-3741 closed, all tests green
Next: Start Slice 3 (ENG-3742) — topic rules

## Auto-Inject (re-injected after every agent return)
- our-workflow.md overrides: agents commit+push, liaison does not
- TDD 3-phase: red→green→refactor, each with review-fix loop
- Wait for companion before phase transitions
- Sequential slices, no parallelism
- Other agents may be working in parallel — only commit our own changes
- Before committing: git status, verify only owned files staged

## Slices
1. ENG-3740: infra — DB migration + shared types [DONE ✓]
2. ENG-3741: people-rules — create rule → evaluate → display [DONE ✓]
3. ENG-3742: topic-rules — LLM evaluation + editor
4. ENG-3743: evaluation-display — cross-rule integration + status badges
5. ENG-3744: re-evaluation — triggers + progress + feedback
6. ENG-3745: overrides — unsure UX + manual overrides + validation

## Decisions
- Sequential execution (bottom-up, infra first)
- Companion watches for workflow drift
- Spec kept from prior session (reviewed by 2 agents, 6 findings incorporated)

## Baselines (2026-03-31, Slice 2 start)
- Python unit: 2713 passed, 3 skipped (+4 from parallel work)
- JS unit: 2555 passed, 4 skip, 7 todo (-7 from parallel work)
- Python DB integration: 395 passed, 1 skipped (includes Slice 1's 25 tests)

## Slice 2 Steps
1. GFS transition helper extraction (refactor)
2. People rule evaluator (evaluate_people_rule)
3. Rule CRUD API endpoints
4. Replace evaluate_scoping endpoint
5. Old code removal + DROP TABLE
6. Frontend (server actions + people rule editor UI)

## Quality Log
- Red phase: 18 tests → reviewed → 9 findings → 25 tests. Zero errors.
- Companion caught: missing commit, stale whiteboard. Fixed before green.
- Green: 1 finding (string|null → RuleMatchStatus|null). Fixed.
- Companion pattern: commits consistently not happening. Fixed by committing after each phase.
