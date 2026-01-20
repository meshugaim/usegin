---
name: team-retro
description: Analyze completed team work and propose improvements. Triggered by "retro this team", "team retro", or when spawner assigns retro after implementation.
---

# Team Retro

You've been assigned to analyze a completed teamwork execution and propose improvements.

## Required Input: Spec Issue ID

**The spawner must provide the spec issue ID.** This is the parent issue that was given to the spawner. You'll analyze all teams (planning + implementation) that worked on it.

```bash
crun "Use the team-retro skill. Retro spec ENG-XXX"
```

**If no spec ID was provided:** Ask the spawner for it.

## Scope

The entire teamwork execution:
- Planning team (created slices from spec)
- All implementation teams (one per slice)
- The spawner's orchestration

## Process

### 1. Gather Context

**Team workspaces** (primary source):
```bash
# Planning team
cat .claude/teams/ENG-XXX/events.jsonl
cat .claude/teams/ENG-XXX/progress.md

# Implementation teams (find slice IDs first)
plan show ENG-XXX  # See sub-issues
cat .claude/teams/ENG-YYY/events.jsonl  # For each slice
```

**Linear:**
- `plan show ENG-XXX` - spec and its slices
- Check completion status of all slices

**Git:**
- `git log --oneline --grep="ENG-XXX"` - commits for this spec

**Sessions** (if needed for deep analysis):
- Session IDs are in each team's `state.json`

### 2. Analyze

**Two pillars to assess:**

| Pillar | Key Questions |
|--------|---------------|
| **Code Quality** | TDD followed? Commits small and focused? Tests meaningful? Code follows patterns? |
| **Operational Smoothness** | All slices completed? Workers efficient? Stuck situations handled well? Retries needed? |

**What went well:**
- Smooth execution areas
- Good TDD discipline
- Effective reviewer feedback
- Quick stuck resolution

**What didn't:**
- Friction points
- TDD violations (implementation before tests)
- Vague feedback causing churn
- Late stuck detection
- Excessive retries or expert consultations

**Teamwork skill adherence:**
- Did reviewer follow `reviewer.md`?
- Did worker follow `worker.md`?
- Did expert advise only (not implement)?

### 3. Propose Improvements

**Concrete and actionable:**
```
Update reviewer prompt to require test verification
- Why: Reviewer accepted code without running tests
- How: Add explicit "run bun test" step to buildImplReviewerPrompt in crun.ts
```

**Not vague:**
```
❌ "Improve feedback quality"
✓ "Add feedback template to reviewer.md: what's wrong, where, how to fix"
```

### 4. Output

Post to the spec issue in Linear:

```
## Retro: ENG-XXX

### Summary
[1-2 sentences on overall execution - success/partial/failed, key observations]

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
   - Target: [file/skill to modify]

2. **[title]**
   - Why: [reason]
   - How: [approach]
   - Target: [file/skill to modify]

### Action Items
- [ ] [specific task]
- [ ] [specific task]
```

## Types of Improvements

**Skills:**
- `spawner.md`, `reviewer.md`, `worker.md`, `domain-expert.md`
- `planning-team.md`, `impl-team.md`

**CLI:**
- `tools/team/` - team CLI
- `crun.ts` - agent spawning prompts

**Workflow:**
- Process changes
- Different sequencing
- Automation opportunities

## Signaling

When done:
1. Post analysis to spec issue
2. Create sub-issues for approved improvements
3. Exit cleanly

## See Also

- `teamwork` skill - The system being analyzed
- `cell-retro` skill - Simpler retro for cell pattern
