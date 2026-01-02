---
name: agent-orchestration-workflow
description: Workflow patterns for managing spawned Claude workers. Triggered by "spawn a worker", "orchestrate agents", or "manage claude workers".
---

# Agent Orchestration Workflow

Patterns for managing spawned Claude workers effectively.

## Principles

| Principle | Practice |
|-----------|----------|
| High-level management | Don't micromanage details |
| Trust but verify | Ask for standards, not line-by-line review |
| Collaborate as equals | Guide, remind, interact - not dictate |
| Sound process | Ensure TDD, meaningful tests, readability |
| Commit often | Small, frequent commits |
| Push often | Don't batch pushes |
| No breaking code | Feature toggles for risky changes |

## Spawning Workers

```bash
# Spawn with clear task
crun spawn "implement ENG-745: crun CLI"

# With issue linking
crun spawn --issue ENG-745 "implement the crun CLI per spec"

# Follow for short tasks
crun spawn --follow "add tests for the auth module"
```

## Guiding Workers

### Initial Prompt

Be clear about:
- What to build (reference spec/issue)
- Process to follow (TDD, commit often)
- Patterns to use (reference existing code)

```bash
cat > /tmp/task.txt << 'PROMPT'
You are implementing ENG-XXX.

Read the spec: `plan show XXX`

Follow TDD:
1. Write failing tests first
2. Implement to make tests pass
3. Commit after each working piece

Use patterns from tools/session/ for CLI structure.
Commit often, push often.
PROMPT

crun spawn "$(cat /tmp/task.txt)"
```

### Nudging / Checkpoints

Kill and resume to send guidance:

```bash
# Check progress
session <worker-session-id>

# Kill if needed
pkill -f "<session-id>"

# Send nudge
cat > /tmp/nudge.txt << 'PROMPT'
Pause and checkpoint.

1. Self-review what you've built
2. Commit what's working
3. List what's incomplete and why

Be honest in your assessment.
PROMPT

cat /tmp/nudge.txt | claude -p -r "<session-id>"
```

### Self-Review Prompt

Ask workers to evaluate their own work:

```
Before continuing:

1. Are test names descriptive?
2. Are test cases meaningful - real scenarios?
3. Any edge cases missing?
4. Code readable?
5. Any shortcuts that need cleanup?

Be honest - if something could be better, say so.
```

## Monitoring

```bash
# List all workers
crun list

# Check specific worker
crun status <id>

# View transcript
session <id>

# Tail live output
crun tail <id>
```

## Workflow Example

```bash
# 1. Create issue with spec
plan create "implement feature X" --description "$(cat spec.md)"

# 2. Spawn worker
crun spawn --issue ENG-XXX "implement per spec, TDD, commit often"

# 3. Check progress periodically
crun list
session <id> | tail -50

# 4. Nudge if needed (kill + resume)
pkill -f "<id>"
echo "checkpoint: self-review, commit working code" | claude -p -r "<id>"

# 5. Review final state
session <id>
git log --oneline -5

# 6. Close issue
plan close XXX
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Micromanage every step | Set direction, let worker figure out details |
| Review code line-by-line | Ask for self-review, check standards |
| Let worker run forever | Periodic checkpoints |
| Batch commits at end | Commit after each working piece |
| Skip pushing | Push after each commit |

## Context Window Management

Workers may run low on context. Signs:
- Slower responses
- Forgetting earlier decisions
- Repeating work

Solution: spawn fresh worker with handoff:

```bash
# Get summary from current worker
echo "summarize what you've done and what's left" | claude -p -r "<old-id>"

# Spawn new worker with context
crun spawn "continuing from <old-id>: <summary>. Next: <remaining work>"
```

## Nesting (Advanced)

Workflow Claude managing worker Claudes:

```
Manager Claude
  └── crun spawn "implement auth"
  └── crun spawn "implement logging"
  └── (monitors both, guides as needed)
  └── (integrates their work)
```

Manager stays high-level, workers handle details.
