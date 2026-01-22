---
name: worker-reviewer
description: TDD loop with tight worker-reviewer coordination
triggers: ["/wr", "/worker-reviewer"]
---

# Worker-Reviewer TDD Loop

You are the **REVIEWER**. You orchestrate a tight TDD loop by spawning worker sub-agents.

## Your Responsibilities

1. **Quality gate** - Only approve work that meets the bar
2. **Orchestration** - Spawn workers, track progress, commit approved work
3. **Feedback** - Give specific, actionable feedback when work needs revision

## Workspace

Default workspace: `tools/worker-reviewer-experiment/workspace/`

Key files:
- `spec.md` - The task specification
- `state.json` - Current phase and test index (hook-managed)
- `submission.md` - Worker's current submission
- `test-plan.md` - Approved test plan (written by you after approval)
- `src/` - Implementation code

## Getting Started

1. Read `state.json` to see current phase
2. Read `spec.md` to understand the task
3. Follow the phase-specific instructions below

---

## Phase 1: Test Plan

**Goal:** Get an approved test plan that covers all acceptance criteria.

### State: `plan:draft`

Spawn a worker to propose tests:

```bash
WORKSPACE="tools/worker-reviewer-experiment/workspace"

crun "$(cat << 'PROMPT'
You are a WORKER in a TDD loop. Your task: propose a test plan.

## Workspace
All files are in: tools/worker-reviewer-experiment/workspace/

## Your Task
Read tools/worker-reviewer-experiment/workspace/spec.md and propose tests that cover all acceptance criteria.

## Output Format
Write to tools/worker-reviewer-experiment/workspace/submission.md with this YAML frontmatter:

---
phase: plan
iteration: 1
testPlan:
  tests:
    - index: 0
      name: <short test name>
      description: <what the test verifies>
      acceptanceCriteria: ["1", "2"]  # which AC items this covers
    - index: 1
      ...
---

## Rationale

<explain your test ordering strategy>

## Questions for Reviewer

<any clarifications needed>

## Guidelines
- Order tests from simplest to most complex
- Each test should be independently verifiable
- Map every acceptance criterion to at least one test
- Prefer more small tests over fewer large ones
PROMPT
)" -n "Worker finished proposing test plan. Read submission.md. Evaluate: comprehensive? logical order? If good: approve by writing test-plan.md and spawning for test[0]. If not: provide feedback and re-spawn worker."
```

### State: `plan:review`

After worker submits, evaluate `submission.md`:

**Checklist:**
- [ ] All acceptance criteria mapped to tests?
- [ ] Order is logical (simple → complex, dependencies respected)?
- [ ] Test names are clear and specific?
- [ ] No redundant tests?

**If approved:**
1. Copy the test plan to `test-plan.md` (same format as submission)
2. Spawn worker for test[0]

**If needs work:**
Re-spawn worker with specific feedback.

---

## Phase 2: Implementation

**Goal:** Implement one test at a time, commit after each approval.

### State: `impl:working`

Spawn a worker to implement the current test:

```bash
WORKSPACE="tools/worker-reviewer-experiment/workspace"
TEST_INDEX=$(jq -r '.currentTestIndex' "$WORKSPACE/state.json")
TEST_NAME=$(yq ".tests[$TEST_INDEX].name" "$WORKSPACE/test-plan.md")

crun "$(cat << PROMPT
You are a WORKER in a TDD loop. Your task: implement test[$TEST_INDEX].

## Workspace
All files are in: tools/worker-reviewer-experiment/workspace/

## Current Test
Index: $TEST_INDEX
Name: $TEST_NAME

## Your Task
1. Write the test in $WORKSPACE/src/md2html.test.ts
2. Write minimal implementation in $WORKSPACE/src/md2html.ts to make it pass
3. Run ALL tests with: bun test $WORKSPACE/src/
4. Submit results to $WORKSPACE/submission.md

## Output Format
Write to $WORKSPACE/submission.md with this YAML frontmatter:

---
phase: impl
iteration: 1
targetTest:
  index: $TEST_INDEX
  name: "$TEST_NAME"
testResults:
  - index: 0
    name: <test name>
    status: pass|fail
  - index: 1
    ...
filesChanged:
  - path: src/md2html.ts
    action: created|modified
  - path: src/md2html.test.ts
    action: created|modified
---

## Summary

<what you implemented>

## Notes

<any concerns or edge cases>

## Rules
- Implement ONLY what's needed for this test
- Do NOT implement future tests
- ALL previous tests must still pass (no regressions)
- Be honest about test results
PROMPT
)" -n "Worker finished test[$TEST_INDEX]. Check submission.md: (1) target test passes? (2) no regressions? (3) code minimal? If yes: commit with 'test(md2html): $TEST_NAME' and spawn for next test. If no: feedback and re-spawn."
```

### State: `impl:review`

After worker submits, evaluate `submission.md`:

**Checklist:**
- [ ] Target test passes?
- [ ] No regressions (all previous tests still pass)?
- [ ] Implementation is minimal (no over-engineering)?
- [ ] Code quality acceptable?

**If approved:**
1. Stage and commit the changes:
   ```bash
   git add tools/worker-reviewer-experiment/workspace/src/
   git commit -m "test(md2html): <test name>

   Implements: <test description>

   Part of: ENG-1334"
   ```
2. If more tests remain, spawn worker for next test
3. If all tests done, celebrate completion

**If needs work:**
Re-spawn worker with specific feedback about what to fix.

---

## State Machine Reference

```
plan:draft  →  plan:review  →  impl:working  →  impl:review  →  (commit)
     ↑              │                ↑               │              │
     └──(feedback)──┘                └──(feedback)───┘              │
                                                                    ↓
                                     impl:working (next test) ←─────┘
                                            │
                                            ↓ (all tests done)
                                        complete
```

---

## Quick Reference

| Phase | You Do |
|-------|--------|
| `plan:draft` | Spawn worker to propose tests |
| `plan:review` | Evaluate plan, approve or feedback |
| `impl:working` | Spawn worker to implement current test |
| `impl:review` | Check work, commit or feedback |
| `complete` | Done! |

---

## Troubleshooting

**Hook rejected my write:**
Read the error message carefully - it tells you exactly what's wrong with the submission format.

**Worker seems stuck:**
Check if there are issues with the test or implementation. Provide clearer guidance in your next spawn.

**State seems wrong:**
Check `state.json` and `events.jsonl` for the full history of what happened.
