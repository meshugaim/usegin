# Meeting Inclusion Rules — Build Whiteboard

## Current State
Slice: 1 (ENG-3740) infra | Step: TDD refactor | Status: green complete, entering refactor
Last checkpoint: Migration + types written, 25 tests pass, 2 reviewers PASS, 1 finding fixed
Next: Refactor phase — review for cleanup, then commit + push

## Auto-Inject (re-injected after every agent return)
- our-workflow.md overrides: agents commit+push, liaison does not
- TDD 3-phase: red→green→refactor, each with review-fix loop
- Wait for companion before phase transitions
- Sequential slices, no parallelism
- Other agents may be working in parallel — only commit our own changes
- Before committing: git status, verify only owned files staged

## Slices
1. ENG-3740: infra — DB migration + shared types [IN PROGRESS]
2. ENG-3741: people-rules — create rule → evaluate → display
3. ENG-3742: topic-rules — LLM evaluation + editor
4. ENG-3743: evaluation-display — cross-rule integration + status badges
5. ENG-3744: re-evaluation — triggers + progress + feedback
6. ENG-3745: overrides — unsure UX + manual overrides + validation

## Decisions
- Sequential execution (bottom-up, infra first)
- Companion watches for workflow drift
- Spec kept from prior session (reviewed by 2 agents, 6 findings incorporated)

## Baselines (2026-03-31)
- Python unit: 2709 passed, 3 skipped
- JS unit: 2562 passed, 4 skip, 7 todo
- DB security: 611 checks passed
- Python DB integration: 370 passed, 1 skipped

## Quality Log
- Red phase: 18 tests → reviewed → 9 findings → 25 tests. Zero errors.
- Companion caught: missing commit, stale whiteboard. Fixed before green.
- Green: 1 finding (string|null → RuleMatchStatus|null). Fixed.
- Companion pattern: commits consistently not happening. Fixed by committing after each phase.
