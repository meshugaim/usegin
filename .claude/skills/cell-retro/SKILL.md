---
name: cell-retro
description: Analyze cell work and propose improvements. Triggered by "retro this feature", "cell retro", or when spawner assigns retro.
---

# Cell Retro

You've been assigned to analyze completed work and propose improvements.

## Required Input: Session ID

**The spawner must provide a session ID.** Without it, you can only analyze Linear issues and git history—you cannot see the actual workflow, decisions, or friction points.

The spawner should invoke you with:
```bash
crun "Use the cell-retro skill. Retro session <session-id>"
```

For self-retros, spawners pass their own session:
```bash
crun "Use the cell-retro skill. Retro session $CLAUDE_SESSION_ID"
```

**If no session ID was provided:** Ask the spawner for it, or note in your analysis that transcript review was not possible.

## Scope

Check assignment for what to retro:
- A completed feature (Linear issue + sub-issues)
- A spawner's session (meta-retro)
- Specific workflow aspect

## Process

### 1. Gather Context

- `session <id>` - **primary source** - the session transcript shows actual workflow
- `plan show <issue-id>` - the feature and its graph
- `git log --oneline --since="X days ago"` - commits

### 2. Analyze

**What went well:**
- Smooth execution areas
- Good patterns used
- Effective tooling

**What didn't:**
- Friction points
- Repeated attempts/confusion
- Wasted context
- Slow progress areas

**Skill adherence check:**
- If a skill was invoked during the session, verify the worker followed the skill's guidance
- Note any deviations from the skill's prescribed process
- Assess whether deviations were justified or led to issues

**Tool utilization check:**
- If a tool was used, assess whether it was used to its fullest potential
- Was the tool's full capability leveraged (flags, options, advanced features)?
- Identify cases where a tool was underutilized—could have solved problems faster or more completely

**What could improve:**
- Missing tools or skills
- Existing tools that could be better
- Workflow changes
- Things to retire (unused, redundant)

### 3. Propose Improvements

For each improvement:

**Concrete and actionable:**
```
Add --lean flag to crun for minimal MCP spawning
- Why: Workers often don't need web search, Figma, etc.
- How: Check MCP config, add flag to disable non-essential
```

**Not vague:**
```
❌ "Make things faster"
✓ "Cache plan show results to avoid repeated API calls"
```

### 4. Output

Post to Linear issue or create sub-issues:

```
## Retro: ENG-XXX

### Summary
[1-2 sentences on overall execution]

### What Went Well
- [item]
- [item]

### Friction Points
- [item with detail]
- [item with detail]

### Proposed Improvements

1. **[title]**
   - Why: [reason]
   - How: [approach]

2. **[title]**
   - Why: [reason]
   - How: [approach]

### Retirement Candidates
- [tool/skill that seems unused or redundant]
```

## Types of Improvements

**Tools:**
- Missing CLI that would help
- Existing CLI that needs flags/features
- Compose existing tools differently

**Skills:**
- Missing guidance for a pattern
- Existing skill needs updating
- Placeholder skill for emerging pattern

**Workflow:**
- Process change
- Different sequencing
- Automation opportunity

**Retirement:**
- Unused tool/skill
- Redundant (covered by something else)
- Outdated pattern

## Signaling

When done:
1. Post analysis
2. Create sub-issues for approved improvements
3. Update Linear
4. Exit cleanly
