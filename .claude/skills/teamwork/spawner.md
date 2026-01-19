# Spawner

The spawner orchestrates autonomous feature implementation by coordinating planning and implementation teams.

## Overview

The spawner is the top-level orchestrator in the teamwork system. It receives a spec issue from a human and manages the complete implementation workflow:

1. Spawns planning team to break spec into vertical slices
2. Reviews proposed slices for quality
3. Spawns implementation teams sequentially to implement each slice
4. Monitors progress and handles failures through retry logic
5. Reports completion to human

**Key principle:** The spawner maintains state in Linear and uses the `team` CLI for all orchestration actions.

## Workflow Steps

### 1. Receive Spec

The spawner starts when a human provides a spec issue:

```bash
# Human invokes teamwork skill with spec issue
/teamwork ENG-1250
```

**Actions:**
- Read spec issue from Linear: `plan show <issue-id>`
- Verify spec has required sections (Overview, Requirements, Acceptance Criteria)
- Record spec issue ID for tracking

**Observability:**
- Log: "Starting teamwork workflow for ENG-1250"
- Log: Spec title and summary

### 2. Start Planning

Spawn planning team to create vertical slices:

```bash
team plan <spec-issue-id>
```

**What happens:**
- Creates workspace at `.claude/teams/<spec-issue-id>/`
- Spawns reviewer agent (planning team lead)
- Reviewer spawns worker to analyze spec and propose slices
- Worker creates slice proposals with acceptance criteria
- Reviewer reviews and provides feedback until approved
- Worker creates Linear sub-issues for each slice

**Wait for completion:**
- Planning team workspace will have `state.json` with `"phase": "complete"`
- Check Linear for created sub-issues

**Observability:**
- Log: "Planning team spawned for ENG-1250"
- Log: "Planning team completed, created N slices"

### 3. Review Slices

Review the slices created by planning team:

```bash
plan list | grep "parent: <spec-issue-id>"
```

**Quality checks:**
- Are slices truly vertical (end-to-end functionality)?
- Are acceptance criteria clear and testable?
- Is ordering correct (dependencies respected)?
- Are independence markers present for future parallelization?

**Human involvement:**
- Spawner can proceed automatically if slices look good
- If uncertain, ask human to review: "Planning team created N slices. Should I proceed with implementation?"

**Observability:**
- Log: "Reviewing N slices from planning team"
- Log each slice: "ENG-1251: Slice 1 - Basic auth flow"

### 4. Implement Slices

For each slice, spawn implementation team **sequentially** (parallel implementation is future work):

```bash
for slice in slices:
  team impl <slice-issue-id>
```

**For each slice:**

1. **Spawn implementation team:**
   ```bash
   team impl <slice-issue-id>
   ```

2. **Monitor progress:**
   - Check workspace state: `.claude/teams/<slice-issue-id>/state.json`
   - Check Linear status: `plan show <slice-issue-id>`
   - Watch for phase transitions: `planning_tests` → `implementing` → `verifying` → `complete`

3. **Handle completion:**
   - Verify tests pass
   - Verify code committed and pushed
   - Mark slice as complete in Linear: `plan close <slice-issue-id>`

4. **Handle failure:**
   - See "Retry Logic" section below

**Observability:**
- Log: "Starting implementation of slice 1/N: ENG-1251"
- Log: "Slice 1 complete, moving to slice 2"
- Log: "All N slices complete"

### 5. Monitor Progress

Throughout the workflow, monitor health and context:

**Context monitoring:**
```bash
cctx --percent  # Own context usage
team health     # All team agents' context
```

**Progress tracking:**
```bash
team status              # All active teams
plan show <spec-issue>   # Parent issue with sub-issues
```

**Observability:**
- Log context usage periodically: "Spawner context: 45%"
- Log when approaching limits: "Spawner context: 85%, considering handoff"

## Retry Logic

When implementation team fails, retry up to 3 attempts per slice:

**Failure detection:**
- Implementation team workspace has `state.json` with `"status": "failed"`
- Or: team exits without marking slice complete in Linear
- Or: tests fail after implementation claims completion

**Retry process:**

```
Attempt 1: Normal implementation team
  └─> FAIL

Attempt 2: Fresh team with failure summary
  Input: "Previous attempt failed with: <summary>. Insights: <what went wrong>"
  └─> FAIL

Attempt 3: Fresh team with both failure summaries
  Input: "Attempts 1 & 2 failed:
    - Attempt 1: <summary>
    - Attempt 2: <summary>
    Insights: <patterns, common issues>"
  └─> FAIL

Escalate to human: "Slice ENG-123 failed after 3 attempts. Details: <full context>"
```

**Creating failure summary:**

1. Read implementation team workspace:
   - `progress.md` - append-only log of what happened
   - `events.jsonl` - structured events
   - Session output if available

2. Analyze:
   - What was attempted?
   - What specific errors occurred?
   - Where did team get stuck?
   - What patterns emerged? (e.g., "kept retrying same approach")

3. Extract insights:
   - Root cause if identifiable
   - Approaches that didn't work
   - Potential solutions to try

4. Format summary (keep concise):
   ```
   Failure Summary - Attempt N:

   Goal: <what slice was trying to accomplish>

   What happened:
   - Step 1: <what was tried>
   - Step 2: <where it failed>

   Error: <specific error message>

   Analysis: <why it failed>

   Insights for next attempt:
   - Try approach X instead of Y
   - Watch out for Z
   ```

**Observability:**
- Log: "Slice ENG-123 failed on attempt 1/3"
- Log: "Creating failure summary from team workspace"
- Log: "Spawning retry attempt 2/3 with failure context"
- Log: "Slice ENG-123 failed after 3 attempts, escalating to human"

## Context Monitoring

The spawner must manage its own context and avoid running out mid-workflow.

**Check context regularly:**
```bash
cctx --percent
```

**Thresholds:**
- **< 70%**: Continue normally
- **70-85%**: Be mindful, wrap up current slice before continuing
- **> 85%**: Prepare for handoff

**Handoff process:**

When context exceeds 85%:

1. **Complete current slice** (don't interrupt mid-implementation)

2. **Update Linear:**
   - Update spec issue description with progress:
     ```
     ## Progress (Updated <timestamp>)

     Completed: ENG-1251, ENG-1252
     In Progress: ENG-1253
     Remaining: ENG-1254, ENG-1255

     Current status: Implementation team working on slice 3
     Next: Continue with slice 4 after slice 3 completes
     ```

3. **Commit all work** - ensure nothing uncommitted

4. **Exit with clear state:**
   - Print: "Spawner context at 87%. Recommend fresh spawner to continue."
   - Print: "Resume with: /teamwork ENG-1250 --resume"
   - Human can spawn fresh agent that reads Linear state and continues

**Observability:**
- Log: "Context at 75%, wrapping up current slice"
- Log: "Context at 88%, preparing handoff"
- Log: "Handoff prepared, state saved in Linear"

## State Management

All state lives in Linear - the spawner is stateless between runs.

**Reading state:**
```bash
plan show <spec-issue-id>        # Get spec and progress notes
plan list | grep <spec-issue-id> # Get all sub-issues (slices)
plan show <slice-issue-id>       # Get slice status
```

**Writing state:**
```bash
plan start <issue-id>               # Mark in progress
plan close <issue-id>               # Mark complete
plan update <issue-id> \
  --description-file progress.md    # Update with progress notes
```

**State to track:**
- Which slices are complete (Linear status)
- Which slice is currently being implemented (Linear "In Progress")
- Any failures/retries (in spec issue description)
- Overall progress (in spec issue description)

**Example progress notes in spec issue:**

```markdown
## Implementation Progress

**Status:** 3/5 slices complete

| Slice | Status | Attempts | Notes |
|-------|--------|----------|-------|
| ENG-1251 | ✅ Done | 1 | Clean implementation |
| ENG-1252 | ✅ Done | 1 | Clean implementation |
| ENG-1253 | ✅ Done | 2 | Retry due to test flakiness |
| ENG-1254 | 🔄 In Progress | 1 | Implementation team active |
| ENG-1255 | ⏳ Pending | - | Waiting for ENG-1254 |

**Last updated:** 2024-01-15 14:30 UTC
**Current:** Implementing slice 4 (ENG-1254)
```

**Observability:**
- Log: "Reading state from Linear"
- Log: "Updated spec issue with progress"

## Error Handling

**Planning team fails:**
- Review workspace logs
- If stuck on spec clarity: escalate to human for spec clarification
- If technical issue: spawn fresh planning team with note about previous failure
- Max 2 attempts, then escalate

**Implementation team fails:**
- Follow retry logic (up to 3 attempts)
- Pass failure summaries between attempts
- Escalate after 3 failed attempts

**Unexpected errors:**
- Log full error context
- Save state to Linear
- Escalate to human with details

**Observability:**
- All errors logged with context
- Error logs include: what was being attempted, what failed, current state

## Quality Standards

The spawner upholds quality standards throughout:

**Exemplary code:**
- Review slice quality during "Review Slices" step
- Implementation teams enforce via their reviewer agents
- Spawner verifies tests pass before marking slice complete

**Observability:**
- Every major action logged
- State transitions recorded
- Errors include full context
- Progress visible in Linear at all times

## Communication Patterns

**With human:**
- Report progress after each slice
- Ask for help when stuck (after retries exhausted)
- Provide clear status updates

**With teams:**
- Clear instructions when spawning
- Provide failure context for retries
- Don't interrupt mid-slice

**Example spawner output:**

```
Starting teamwork workflow for ENG-1250: Auth system redesign

Phase 1: Planning
✓ Planning team spawned
✓ Planning complete - created 5 slices

Phase 2: Implementation
→ Implementing slice 1/5: Basic auth flow (ENG-1251)
  ✓ Tests written and approved
  ✓ Implementation complete
  ✓ All tests passing
  ✓ Slice 1 complete

→ Implementing slice 2/5: Session management (ENG-1252)
  ✓ Tests written and approved
  ⚠ Implementation failed (timeout connecting to Redis)
  → Retry attempt 1/3 with failure summary
  ✓ Implementation complete
  ✓ All tests passing
  ✓ Slice 2 complete

→ Implementing slice 3/5: Password reset flow (ENG-1253)
  [In progress...]
```

## Tools Reference

**CLI commands:**
```bash
team plan <issue-id>      # Spawn planning team
team impl <issue-id>      # Spawn implementation team
team status               # Check active teams
team health               # Context health
```

**Linear commands:**
```bash
plan show <issue-id>      # Get issue details
plan list                 # List issues
plan start <issue-id>     # Mark in progress
plan close <issue-id>     # Mark complete
plan update <issue-id>    # Update issue
```

**Context commands:**
```bash
cctx --percent            # Own context usage
cctx <session-id>         # Subagent context
```

## See Also

- [planning-team.md](planning-team.md) - Planning team workflow
- [impl-team.md](impl-team.md) - Implementation team workflow
- [reviewer.md](reviewer.md) - Reviewer behavior
- [worker.md](worker.md) - Worker behavior
- [domain-expert.md](domain-expert.md) - Expert consultation
