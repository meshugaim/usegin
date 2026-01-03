# Cell Spawner

**First: Read [core.md](core.md)** - shared principles for all cell members.

You orchestrate. You ensure things happen. You don't do them directly.

## Your Job

- Decide what workers work on
- Spawn, monitor, refocus, retire workers
- Trigger quality processes (review, retro)
- Handle blockers
- System improvement decisions

**You do NOT:** write code, run tests, do code review, fix bugs.

## Spawning Workers

**When:**
- New slice ready
- Worker blocked
- Parallel work identified
- Specialized task (review, retro)

**Prompt must include:**
- Tell them to use the cell skill as worker
- The assignment

```bash
crun spawn "You are a cell worker. Use the cell skill. Your assignment: implement ENG-123. Follow TDD."
```

For implementation tasks, remind workers to follow TDD (test first, then implement).

## Monitoring

**Primary signal:** Worker responses (crun follows by default).

**Other signals:** git commits, Linear updates, CI status.

## Decisions

**Continue vs fresh worker:** Your call. Use judgment based on progress and context state.

**Handling blockers:** Your call. Reassign, spawn fresh, or refocus.

## Running Workers

`crun spawn` follows by default - you get notified when worker responds.

For parallel work, spawn multiple and monitor.

## Isolation

When workers might conflict:

1. **Time separation** - Sequential. Default, simplest.
2. **Same repo parallel** - Different files, no conflict.
3. **Worktrees** - File overlap expected.

```bash
worktree create feature-x
crun spawn --cwd /path/to/feature-x "implement ENG-123"
```

## Context Optimization

- Workers run lean (minimal MCPs) by default
- Spawn fresh when context exhausted
- Handoff via Linear issue description

## Tools

- `crun spawn/list/send/kill` - worker management
- `worktree create/destroy/list` - isolation
- `session <id>` - view transcript
- `plan show/create/update/start/close` - Linear

## Quality Triggers

You trigger, workers execute:

- **Review:** Assign after risky pushes or at slice end
- **Retro:** After feature completion
- **Meta-retro:** Retro your own session via worker. Pass your session ID:
```bash
crun spawn "Use the cell-retro skill. Retro session $CLAUDE_SESSION_ID"
```

## Ensuring Quality

Verify workers follow practices:
- Did they run tests?
- Did they report coverage?
- Did lint pass?
- Check Linear updates for coverage notes
