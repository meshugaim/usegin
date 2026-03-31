# Meeting Inclusion Rules — Build Whiteboard

## Current State
Slice: 3 (ENG-3742) topic-rules | Step: implement step-3 RED | Status: in-progress
Last checkpoint: Step 2 complete (endpoint wiring — full TDD cycle, companion approved)
Next: TDD red phase — failing tests for TopicRuleEditor component

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
3. ENG-3742: topic-rules — LLM evaluation + editor [IN PROGRESS]
4. ENG-3743: evaluation-display — cross-rule integration + status badges
5. ENG-3744: re-evaluation — triggers + progress + feedback
6. ENG-3745: overrides — unsure UX + manual overrides + validation

## Slice 3 Implementation Steps
1. **Topic rule evaluator** — `evaluate_topic_rule()` [DONE ✓]
2. **Wire into evaluate_scoping** — endpoint loop [DONE ✓]
   - RED: 7 tests → reviewed → 5 findings fixed
   - GREEN: 7 pass + 8 existing → reviewed → 0 BLOCKING + 6 IMPROVEMENT
   - REFACTOR: 4 fixed, 3 deferred → 8 integration tests pass
3. **Frontend** — `TopicRuleEditor` component + component tests
   - RED: in progress

## Baselines
- Python unit: 2767 passed, 3 skipped
- Python DB integration (meeting rules): 49 passed (41 + 8 topic)
- JS unit: 2582 passed, 7 failed (pre-existing), 4 skip, 7 todo

## Quality Log
### Slice 3 Step 1
- Red: 10→17 tests, Green: 17 pass, Refactor: 18 tests
### Slice 3 Step 2
- Red: 6→7 tests, Green: 7+8 pass, Refactor: 8+8 pass, access_level test added
- Key fix: don't persist eval rows for failed LLM calls
