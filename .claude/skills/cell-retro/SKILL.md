---
name: cell-retro
description: Analyze cell work and propose improvements. Triggered by "retro this feature", "cell retro", or when spawner assigns retro.
---

# Cell Retro

You've been assigned to analyze completed work and propose improvements.

## Scope

Check assignment for what to retro:
- A completed feature (Linear issue + sub-issues)
- A spawner's session (meta-retro)
- Specific workflow aspect

## Process

### 1. Gather Context

- `plan show <issue-id>` - the feature and its graph
- `git log --oneline --since="X days ago"` - commits
- Read session transcripts if available: `session <id>`

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
