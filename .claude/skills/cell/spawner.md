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

## Delegation Philosophy

**Trust skills, don't duplicate them.** Skills contain process details. Your job is to assign work and specify which skill to use - not to paraphrase the skill.

**Anti-pattern - micromanaging:**
```bash
# Don't do this - duplicates what code-review skill already says
crun "Review ENG-123. Focus on:
1. Test quality - are tests meaningful?
2. Error handling
3. Security issues
Post findings to Linear, fix critical issues..."
```

**Pattern - delegate to skill:**
```bash
# Do this - trust the skill
crun "Use the code-review skill. Review ENG-123."
```

Workers read skills. Skills contain the process. Your prompt is just:
1. Which skill to use (for specialized tasks)
2. What the assignment is

**For implementation tasks**, the cell skill as worker includes TDD - don't repeat it:
```bash
crun "Use the cell skill as worker. Implement ENG-456."
```

**For specialized tasks**, name the skill:
```bash
crun "Use the cell-retro skill. Retro ENG-789."
crun "Use the code-review skill. Review ENG-789."
```

## Spawning Workers

**Before spawning:**
1. **Verify minimal MCP state** - Workers inherit your MCP config. Many MCPs = token burn on every worker. Run `/mcp` to check enabled MCPs and disable unnecessary ones before spawning.
2. `plan start <id>` - mark the issue in-progress
3. Check `crun --help` if unsure about available options

**When:**
- New slice ready
- Worker blocked
- Parallel work identified
- Specialized task (review, retro)

## Monitoring

**Primary signal:** Worker responses (crun blocks by default).

**Other signals:** git commits, Linear updates, CI status.

## Decisions

### When to Resume vs Spawn Fresh

**Default: spawn fresh.** Workers are uniform and interchangeable. Linear is the handoff mechanism.

**Resume when:**
- Same worker continuing same task (e.g., "fix the test failure from your implementation")
- Worker blocked then unblocked - continue their work
- Context rebuild would be expensive and previous context is directly relevant

**Spawn fresh when:**
- New task, even on related issue
- Different skill needed (implementation -> review)
- Worker finished their task
- Context exhausted or polluted

```bash
# Fresh worker - default
crun "Use the cell skill as worker. Implement ENG-456."

# Resume - continuing same task
crun --resume <session-id> "Tests are failing. Fix the auth test."
```

**Reviews: always fresh.** Independence matters for review quality. Reviewer shouldn't inherit implementer's assumptions.

**Retros: fresh, but view the session.** Use `session <id>` to analyze transcripts - don't resume into the work session.

**Handling blockers:** Your call. Reassign, spawn fresh, or refocus.

## Running Workers

**Always use `run_in_background: true`** when spawning workers via the Bash tool. This keeps you responsive and lets you monitor progress or spawn additional workers.

```bash
# Single worker - still background it
crun "implement auth"

# Multiple workers - background all
crun "implement auth"
crun "implement logging"
```

**Worker completion:** Claude Code natively notifies you when workers complete via `<bash-notification>`. Use `TaskOutput` to retrieve results. No polling needed - just wait for the notification.

## Isolation

When workers might conflict:

1. **Time separation** - Sequential. Default, simplest.
2. **Same repo parallel** - Different files, no conflict.
3. **Worktrees** - File overlap expected.

```bash
worktree create feature-x
crun --cwd /path/to/feature-x "Use the cell skill as worker. Implement ENG-123."
```

## Context Optimization

- Workers run lean (minimal MCPs) by default
- Spawn fresh when context exhausted
- Handoff via Linear issue description

## Tools

- `crun "prompt"` - run worker (blocks until done)
- `crun --resume <id> "prompt"` - continue session
- `crun --remind <presets> "prompt"` - inject reminders
- `crun --cwd <path> "prompt"` - run in directory
- `crun -n "next step" "prompt"` - note-to-self for workflow continuity
- `worktree create/destroy/list` - isolation
- `session <id>` - view transcript
- `plan show/create/update/start/close` - Linear

**Note-to-self (`-n`):** Use for workflow continuity, not just labels. Describe what happens next:
```bash
# Good - guides next action
crun -n "If passes, close issue and push" "Review ENG-123"
crun -n "Fix issues found, then spawn retro" "Implement feature"

# Bad - just a label, no continuity
crun -n "Review done" "Review ENG-123"
```

## Quality Triggers

You trigger, workers execute:

- **Review:** Assign after risky pushes or at slice end
- **Retro:** After feature completion
- **Self-retro:** Retro your own session via worker. Pass your session ID explicitly (don't rely on shell expansion):
```bash
# Get your session ID first, then pass it directly
crun "Use the cell-retro skill. Retro session <your-session-id>"
```

**After retro:** The retro worker identifies improvements but doesn't implement them. You (spawner) must:
1. Review the retro findings
2. Create issues for actionable improvements (`plan create`)
3. Prioritize and assign work as needed

## Ensuring Quality

Verify workers follow practices:
- Did they run tests?
- Did they report coverage?
- Did lint pass?
- Check Linear updates for coverage notes
