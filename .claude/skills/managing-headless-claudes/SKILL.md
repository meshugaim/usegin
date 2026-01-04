---
name: managing-headless-claudes
description: Workflow patterns for managing spawned Claude workers. Triggered by "spawn a worker", "orchestrate agents", or "manage claude workers".
---

# Managing Headless Claudes

Patterns for managing spawned Claude workers effectively.

> **See also:** [multi-turn-headless-claude](../multi-turn-headless-claude/SKILL.md) for technical patterns on running Claude non-interactively with session persistence.

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
# Run worker with clear task (blocks until complete)
crun "implement ENG-745: crun CLI"

# Background for long-running tasks
crun "implement the full feature" &

# With reminder presets
crun --remind tdd,commit-often "implement per spec"

# In specific directory
crun --cwd /path/to/repo "implement the feature"

# Parallel workers (backgrounded)
crun "implement auth" &
crun "implement logging" &
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
1. Write failing tests first - make sure they fail for the RIGHT reason
2. Implement to make tests pass
3. Commit AND push after each working piece

Use patterns from tools/session/ for CLI structure.
Commit often, push often. Don't batch - push after each commit.
PROMPT

crun --prompt-file /tmp/task.txt
```

### Nudging / Checkpoints

Check progress and send guidance:

```bash
# Check progress via session transcript (short ID works)
session <id> | tail -50

# Resume a session with follow-up
crun --resume <session-id> "checkpoint: self-review, commit working code, push"

# Or with detailed nudge from file
cat > /tmp/nudge.txt << 'PROMPT'
Pause and checkpoint.

1. Self-review what you've built
2. Commit AND push what's working
3. List what's incomplete and why

Be honest in your assessment.
PROMPT

crun --resume <session-id> --prompt-file /tmp/nudge.txt
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
# View transcript (short ID works)
session <id>
session <id> | tail -50  # just recent activity

# List recent sessions
session list -n 5 --output id

# Check logs directory
ls ~/.crun/logs/
```

## After Worker Finishes

Workers often don't commit/push at the end. Manager should:

```bash
# Check what worker left uncommitted
git status

# Run tests
bun test  # or appropriate test command

# Commit worker's changes
git add -A && git commit -m "feat: description

Closes: ENG-XXX

Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push (may need rebase if other workers pushed)
git pull --rebase origin main && git push origin main
```

## Workflow Example

```bash
# 1. Create issue with spec
plan create "implement feature X" --description "$(cat spec.md)"

# 2. Run worker (background for long tasks)
crun --remind tdd,commit-often "implement per spec, commit often" &

# 3. Check progress periodically
session <id> | tail -50

# 4. Resume if needed for follow-up
crun --resume <id> "checkpoint: self-review, commit and push working code"

# 5. When done - verify and commit any uncommitted work
git status
bun test
git add -A && git commit -m "..." && git push origin main

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

## Git Conflicts with Parallel Workers

When multiple workers push, you may hit conflicts:

```bash
# Push fails
git push origin main
# ! [rejected] main -> main (fetch first)

# Solution: stash, pull, unstash
git stash
git pull --rebase origin main
git stash pop

# Resolve any conflicts, then push
git push origin main
```

## Context Window Management

Workers may run low on context. Signs:
- Slower responses
- Forgetting earlier decisions
- Repeating work

Solution: spawn fresh worker with handoff:

```bash
# Get summary from current worker
crun --resume <old-id> "summarize what you've done and what's left"

# Spawn new worker with context
crun "continuing from previous session: <summary>. Next: <remaining work>"
```

## Nesting (Advanced)

Workflow Claude managing worker Claudes:

```
Manager Claude
  └── crun "implement auth" &
  └── crun "implement logging" &
  └── (monitors both, guides as needed)
  └── (integrates their work)
```

Manager stays high-level, workers handle details.
