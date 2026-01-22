---
name: worker-reviewer
description: TDD loop with tight worker-reviewer coordination
triggers: ["/wr", "/worker-reviewer"]
hooks:
  PreToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "bun tools/worker-reviewer-experiment/hooks/validate-submission.ts"
---

# Worker-Reviewer TDD Loop

A tight coordination loop for test-driven development where:
1. Worker proposes failing tests (with order)
2. Reviewer approves the test plan
3. Worker implements one test at a time
4. Reviewer approves each step → commit
5. Repeat until all tests pass

## Architecture

- **Reviewer**: Main agent that orchestrates the loop
- **Worker**: Sub-agent spawned via `crun` to do implementation work
- **Hook**: Validates submissions, updates state, logs events

## Usage

### Start a new session

```
/wr start <workspace-path>
```

This initializes a workspace with:
- `spec.md` - Your task specification (you provide this)
- `state.json` - Loop state tracking
- `events.jsonl` - Event log for visibility

### Example

```bash
# Create workspace and spec
mkdir -p my-project/workspace
cat > my-project/workspace/spec.md << 'EOF'
# My Task

Build a CLI that does X.

## Acceptance Criteria
1. Does X
2. Does Y
EOF

# Start the loop
/wr start my-project/workspace
```

## Protocol

See `tools/worker-reviewer-experiment/PROTOCOL.md` for full details.

### Two Phases

**Phase 1: Test Plan**
- Worker reads spec, proposes tests with order
- Reviewer evaluates and approves (or provides feedback)
- Approved plan becomes the contract

**Phase 2: Implementation (tight loop)**
- Worker implements ONE test at a time
- Runs ALL tests, reports full status
- Reviewer checks: test passes? minimal code? no regressions?
- On approval: commit, advance to next test
- On feedback: worker fixes, resubmits

### Files

| File | Purpose |
|------|---------|
| `spec.md` | Task specification (input) |
| `state.json` | Current phase and test index |
| `events.jsonl` | Audit log of all events |
| `test-plan.md` | Approved test plan |
| `submission.md` | Worker's current submission |

## Commands

When this skill is active, the following are available:

- **Start Phase 1**: Spawn worker to propose test plan
- **Approve Plan**: Write `test-plan.md`, transition to impl phase
- **Spawn for Test N**: Use `crun` with note-to-self
- **Approve & Commit**: Commit the implementation, advance to next test

## Spawning Workers with CRUN

Use `crun` with `--note-to-self` to maintain context:

```bash
crun "Implement test[2]: 'converts headings'. Write minimal code." \
  -n "Check submission.md: test[2] passes? no regressions? If yes: commit, spawn for test[3]."
```

The note displays when the worker returns, reminding you what to do next.
