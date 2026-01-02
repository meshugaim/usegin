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
# Spawn with clear task (follows by default)
crun spawn "implement ENG-745: crun CLI"

# With issue linking
crun spawn --issue ENG-745 "implement the crun CLI per spec"

# Detach for long-running tasks
crun spawn --detach "implement the full feature"

# Parallel workers
crun spawn --detach --issue ENG-100 "implement auth"
crun spawn --detach --issue ENG-101 "implement logging"
crun list  # see both
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

crun spawn "$(cat /tmp/task.txt)"
```

### Nudging / Checkpoints

Check progress and send guidance:

```bash
# Check progress (short ID works)
session <id> | tail -50

# Kill if needed
crun kill <id>

# Send follow-up to running worker
crun send <id> "checkpoint: self-review, commit working code, push"

# Or resume a stopped session with detailed nudge
cat > /tmp/nudge.txt << 'PROMPT'
Pause and checkpoint.

1. Self-review what you've built
2. Commit AND push what's working
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

# View transcript (short ID works)
session <id>
session <id> | tail -50  # just recent activity

# Tail live output
crun tail <id>
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

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push (may need rebase if other workers pushed)
git pull --rebase origin main && git push origin main
```

## Workflow Example

```bash
# 1. Create issue with spec
plan create "implement feature X" --description "$(cat spec.md)"

# 2. Spawn worker (detach for long tasks)
crun spawn --detach --issue ENG-XXX "implement per spec, TDD, commit often"

# 3. Check progress periodically
crun list
session <id> | tail -50

# 4. Nudge if needed
crun send <id> "checkpoint: self-review, commit and push working code"

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
