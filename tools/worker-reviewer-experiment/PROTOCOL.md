# Worker-Reviewer Protocol v0.3

## Overview

A tight TDD loop where:
1. Worker proposes failing tests (with order)
2. Reviewer approves the test plan
3. Worker implements one test at a time
4. Reviewer approves each step → commit
5. Repeat until all tests pass

**Architecture:** Reviewer is the main agent, worker is a sub-agent spawned via Task tool.

---

## The Example Task

Build a CLI tool: `md2html` - converts markdown files to HTML.

**Acceptance criteria:**
1. Takes a markdown file path as input
2. Outputs HTML to stdout (or to file with `-o` flag)
3. Handles: headings, paragraphs, bold, italic, links, code blocks, lists
4. Has `--help` flag
5. Exits with code 0 on success, 1 on error

---

## The Two Phases

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: TEST PLAN                                              │
│                                                                 │
│   Both agents receive the spec                                  │
│      ↓                                                          │
│   Worker proposes: [test1, test2, test3, ...] with order        │
│      ↓                                                          │
│   Reviewer: approve (or feedback → worker revises)              │
│      ↓                                                          │
│   Approved plan = THE CONTRACT                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: IMPLEMENTATION (tight loop)                            │
│                                                                 │
│   For each test in approved order:                              │
│      Worker: implement just enough to pass this test            │
│      Worker: run ALL tests, submit results                      │
│      Reviewer: check (quality, minimal, no regressions)         │
│         ↓                                                       │
│      If approved: commit, advance to next test                  │
│      If feedback: worker fixes, resubmit                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
workspace/
├── spec.md                 # The slice spec (input)
├── state.json              # Machine state (hook-managed)
├── events.jsonl            # Append-only event log (hook-managed)
├── test-plan.md            # Approved test plan (agent-written, YAML frontmatter)
├── submission.md           # Worker's current submission (agent-written, YAML frontmatter)
└── src/                    # Code artifacts
    ├── md2html.ts          # Implementation
    └── md2html.test.ts     # Tests
```

**File format rationale:**
- **MD + YAML frontmatter** for agent-written files (`submission.md`, `test-plan.md`) - natural for agents, structured data in frontmatter
- **JSON/JSONL** for machine state (`state.json`, `events.jsonl`) - hooks manage these, not agents

---

## State Machine

```
┌──────────────┐
│  plan:draft  │ ←── Worker proposing tests
└──────┬───────┘
       │ worker submits plan
       ▼
┌──────────────┐
│ plan:review  │ ←── Reviewer evaluating plan
└──────┬───────┘
       │ approved          │ feedback
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ impl:working │    │  plan:draft  │ (back to drafting)
└──────┬───────┘    └──────────────┘
       │ worker submits
       ▼
┌──────────────┐
│ impl:review  │ ←── Reviewer checking implementation
└──────┬───────┘
       │ approved          │ feedback
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   commit     │    │ impl:working │ (back to working)
└──────┬───────┘    └──────────────┘
       │
       ▼
  More tests? ──yes──→ impl:working (next test)
       │
       no
       ▼
┌──────────────┐
│   complete   │
└──────────────┘
```

---

## Schemas

### `state.json`

```json
{
  "phase": "plan:draft",
  "currentTestIndex": null,
  "totalTests": null,
  "startedAt": "2026-01-22T10:00:00Z"
}
```

**Phase values:** `plan:draft`, `plan:review`, `impl:working`, `impl:review`, `complete`

After plan approved:
```json
{
  "phase": "impl:working",
  "currentTestIndex": 0,
  "totalTests": 5,
  "startedAt": "2026-01-22T10:00:00Z"
}
```

---

### `test-plan.md` (Phase 1 output)

Worker proposes, reviewer approves. Once approved, this is immutable.

```markdown
---
tests:
  - index: 0
    name: shows help with --help flag
    description: Running md2html --help should print usage info and exit 0
    acceptanceCriteria: ["4"]
  - index: 1
    name: exits with error for missing file
    description: Running md2html nonexistent.md should exit 1 with error message
    acceptanceCriteria: ["5"]
  - index: 2
    name: converts headings
    description: "# Heading → <h1>Heading</h1>, ## → <h2>, etc."
    acceptanceCriteria: ["3"]
  - index: 3
    name: converts paragraphs
    description: Plain text lines become <p> tags
    acceptanceCriteria: ["3"]
  - index: 4
    name: outputs to file with -o flag
    description: md2html input.md -o output.html writes to file
    acceptanceCriteria: ["2"]
---

## Rationale

Starting with CLI basics (help, errors) before parsing. Parsing in order of complexity.

## Test Details

### 0. shows help with --help flag
Running `md2html --help` should print usage info and exit 0.

### 1. exits with error for missing file
Running `md2html nonexistent.md` should exit 1 with error message.

...
```
```

---

### `submission.md` (Worker → Reviewer)

#### During Phase 1 (proposing test plan):

```markdown
---
phase: plan
iteration: 1
testPlan:
  tests:
    - index: 0
      name: shows help with --help flag
      description: Running md2html --help should print usage info and exit 0
      acceptanceCriteria: ["4"]
    # ... more tests
---

## Rationale

Starting with CLI basics before parsing logic.

## Questions for Reviewer

- Should I include edge cases like empty files?
```

#### During Phase 2 (implementation):

```markdown
---
phase: impl
iteration: 3
targetTest:
  index: 2
  name: converts headings
testResults:
  - index: 0
    name: shows help with --help flag
    status: pass
  - index: 1
    name: exits with error for missing file
    status: pass
  - index: 2
    name: converts headings
    status: pass
  - index: 3
    name: converts paragraphs
    status: fail
  - index: 4
    name: outputs to file with -o flag
    status: fail
filesChanged:
  - path: src/md2html.ts
    action: modified
---

## Summary

Implemented heading parsing with regex for h1-h6.

## Notes

Used simple regex, may need refinement for edge cases.
```

**Required frontmatter fields (impl phase):**
- `phase`: "impl"
- `iteration`: number
- `targetTest`: { index, name }
- `testResults`: array with status of ALL tests
- `filesChanged`: array of { path, action }

---

## Event Log (`events.jsonl`)

Full visibility into the loop.

```jsonl
{"ts":"...","actor":"reviewer","event":"session-started","spec":"md2html CLI"}
{"ts":"...","actor":"reviewer","event":"worker-spawned","phase":"plan","instruction":"Propose test plan"}
{"ts":"...","actor":"worker","event":"plan-submitted","testCount":5}
{"ts":"...","actor":"hook","event":"validation-passed","file":"submission.json"}
{"ts":"...","actor":"reviewer","event":"plan-approved","testCount":5}
{"ts":"...","actor":"reviewer","event":"worker-spawned","phase":"impl","testIndex":0,"testName":"shows help"}
{"ts":"...","actor":"worker","event":"impl-submitted","testIndex":0,"passingTests":1,"totalTests":5}
{"ts":"...","actor":"hook","event":"validation-passed","file":"submission.json"}
{"ts":"...","actor":"reviewer","event":"impl-approved","testIndex":0}
{"ts":"...","actor":"reviewer","event":"committed","testIndex":0,"message":"test: shows help with --help flag"}
{"ts":"...","actor":"reviewer","event":"worker-spawned","phase":"impl","testIndex":1,"testName":"exits with error"}
...
{"ts":"...","actor":"reviewer","event":"session-complete","totalTests":5,"totalIterations":7}
```

---

## Hook Behavior

### On `submission.md` write:

**Validates:**
1. Valid YAML frontmatter (parseable)
2. Required fields present based on phase
3. Types are correct
4. If `phase: impl`:
   - `targetTest.index` matches `state.currentTestIndex`
   - `testResults` includes all tests from approved plan
   - Target test status should be "pass" (otherwise why submit?)

**On validation failure - verbose error:**

```
❌ submission.md validation failed:

Problem: testResults missing entry for test index 3

Your testResults:
  0: pass ✓
  1: pass ✓
  2: pass ✓
  3: ??? ← MISSING
  4: fail ✓

You must include status for ALL 5 tests. Example:

---
testResults:
  - index: 0
    name: shows help with --help flag
    status: pass
  - index: 1
    ...
---

Fix and retry.
```

**On validation success:**
- Append event to `events.jsonl`
- Update `state.phase` to review phase
- Allow write

---

## Spawning Workers with CRUN

The reviewer uses `crun` to spawn workers. The key feature is `--note-to-self` (`-n`): a reminder that displays when the worker completes, helping the reviewer remember what to do next.

### Usage Pattern

```bash
crun "<worker prompt>" -n "<what to do when worker returns>"
```

### Example: Spawning for Test Plan

```bash
crun "You are a WORKER. Read workspace/spec.md and propose a test plan. Write to workspace/submission.md with YAML frontmatter." \
  -n "Worker finished. Read submission.md, evaluate test plan. If good: approve → write test-plan.md → spawn for test[0]. If not: provide feedback, re-spawn worker."
```

### Example: Spawning for Implementation

```bash
crun "You are a WORKER. Implement test[2]: 'converts headings'. Write minimal code to pass this test. Run all tests and submit results to workspace/submission.md." \
  -n "Worker finished test[2]. Check: (1) test[2] passes? (2) no regressions? (3) code minimal? If yes: commit 'test(md2html): converts headings' → spawn for test[3]. If no: provide feedback, re-spawn."
```

### Why This Works

1. **Note is written before spawning** - reviewer decides upfront what comes next
2. **Note displays after worker returns** - reviewer sees exactly where it is
3. **Explicit next steps** - no ambiguity about the sequence

---

## Agent Prompts (Outline)

### Reviewer Agent

```markdown
You are the REVIEWER. You own quality and orchestrate the loop.

## Your Role
- Evaluate worker proposals and implementations
- Provide specific, actionable feedback
- Approve when quality bar is met
- Commit approved work
- Use crun with --note-to-self to track your place in the sequence

## Phase 1: Test Plan
1. Spawn worker with crun to propose test plan
2. When worker returns, read note-to-self
3. Evaluate: Are tests comprehensive? Is order logical?
4. Approve → write test-plan.md → spawn for test[0]
   OR provide feedback → re-spawn worker

## Phase 2: Implementation
For each test in approved order:
1. Spawn worker with crun to implement test[currentIndex]
2. Include in note-to-self: what to check, what to do if approved
3. When worker returns, read note-to-self
4. Evaluate submission:
   - Does target test pass?
   - Is implementation minimal (no over-engineering)?
   - Any regressions (other tests still pass)?
   - Code quality acceptable?
5. Approve → commit → spawn for next test (note-to-self tells you which)
   OR feedback → re-spawn worker

## Spawning Workers
Use crun command via Bash tool:
- Always include -n with explicit next steps
- Prompt should include: the spec, current phase, which test, any feedback
```

### Worker Agent

```markdown
You are the WORKER. You implement what the reviewer asks.

You were spawned by a reviewer using crun. Do your work, then exit.
The reviewer will evaluate your submission when you're done.

## Your Role
- Propose high-quality test plans
- Implement clean, minimal code
- Be honest in self-assessment
- Follow TDD strictly

## Phase 1: Test Plan
- Read workspace/spec.md
- Design tests that cover all acceptance criteria
- Order tests logically (simplest first, dependencies respected)
- Write submission.md with YAML frontmatter containing the test plan

## Phase 2: Implementation
- Focus on ONE test at a time (the one specified in your prompt)
- Implement minimal code to make that test pass
- Run ALL tests, report full status in submission.md
- Write submission.md with YAML frontmatter

## Important
- Hook validates your submission - if rejected, read error and fix
- Never implement more than needed for current test
- Report honestly if something isn't working
- When done, just exit - reviewer handles next steps
```

---

## Commit Convention

Each approved test implementation = one commit.

Format:
```
test(md2html): <test name>

Implements test: <test description>

Part of: ENG-XXX
```

Example:
```
test(md2html): converts headings

Implements test: # Heading → <h1>Heading</h1>, ## → <h2>, etc.

Part of: ENG-456
```

---

## Hook Configuration

The validation hook is registered in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun tools/worker-reviewer-experiment/hooks/validate-submission.ts"
          }
        ]
      }
    ]
  }
}
```

**Hook location:** `tools/worker-reviewer-experiment/hooks/validate-submission.ts`

**What it does:**
- Intercepts all Write tool calls
- Only validates files in `tools/worker-reviewer-experiment/workspace/`
- Validates `submission.md` and `test-plan.md` YAML frontmatter
- Blocks invalid writes with verbose error messages
- Updates `state.json` and appends to `events.jsonl` on valid writes

**Testing the hook:**
```bash
bun tools/worker-reviewer-experiment/hooks/test-hook.ts
```

---

## Next Steps

1. [x] Define protocol and schemas
2. [x] Build the validation hook
3. [x] Create spec.md for md2html task
4. [ ] Write full reviewer agent prompt
5. [ ] Write full worker agent prompt
6. [ ] Test the full loop
