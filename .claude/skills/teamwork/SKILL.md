---
name: teamwork
description: Autonomous multi-agent workflow with planning and implementation teams. Triggered by "use teamwork", "autonomous implementation", "spawn teams".
---

# Teamwork

Autonomous workflow where teams of agents implement features from specs.

## Status

**Current implementation:** Slice 1 - Basic skill structure + team workspace creation

### What Works Now

- `team plan <issue-id>` - Creates planning team workspace
- Workspace structure: `.claude/teams/<issue-id>/`
  - `state.json` - Team state
  - `progress.md` - Append-only log
  - `events.jsonl` - Event logging
  - `sessions/` - Session tracking
  - `checkpoints/` - Progress checkpoints

### Coming Soon

- Spawner orchestration
- Planning team (worker + reviewer)
- Implementation team (worker + reviewer + expert)
- Full TDD workflow
- Context management & handoffs

## Quick Start

For now, create a team workspace:

```bash
team plan ENG-XXX
```

This creates the workspace structure for a planning team. Future slices will add:
- Agent spawning and orchestration
- Reviewer/worker/expert behaviors
- Linear integration
- Event logging and metrics

## See Also

- Spec: ENG-1250 - Full teamwork system specification
- `team-retro` skill - Analyze completed team work and propose improvements
- `cell` skill - Simpler spawner/worker pattern
- `writing-specs` skill - Create specs
- `implementing-specs` skill - Interactive implementation
