---
name: cell
description: Autonomous agent workflow with spawner + workers. Triggered by "use cell pattern", "spawn workers", "orchestrate agents", or for long-running/complex implementations.
---

# Cell Pattern

Autonomous workflow where one Claude (spawner) orchestrates worker Claudes.

**When to use:**
- Long-running work (exceeds single context)
- Complex features (multi-slice)
- Hands-off execution
- Human focuses on workflow design, AI handles the rest

## Roles

**Spawner:** Orchestrates. Ensures things happen, doesn't do them directly.

**Workers:** Execute assignments. Implement, review, retro, improve tools.

Workers are uniform - differentiation via context and skills, not type.

## Known Gap: `crun` cannot run inside Claude Code

`crun` wraps `claude -p`, which launches a new Claude Code process. But Claude Code sets the `CLAUDECODE` env var, and new instances refuse to start when they detect it — "nested sessions share runtime resources and will crash all active sessions." This means **`crun` cannot work when the spawner is itself a Claude Code session** (which it almost always is).

**Workaround:** Use the `Agent` tool with `isolation: "worktree"` instead. This spawns subagents within the same process and avoids the nested-session check. However, Agent-managed worktrees provide weaker isolation — workers may commit directly to main instead of their worktree branch. Mitigate by ensuring zero file overlap between workers.

**Status:** Open. See skill lab retros for details.

## Quick Start

**As spawner:** Read [spawner.md](spawner.md) for orchestration patterns.

**As worker:** Read [worker.md](worker.md) for execution guidance.

**Both roles:** [core.md](core.md) has shared principles (TDD, commits, Linear, quality).

## See Also

- [workflow-setup skill](../workflow-setup/SKILL.md) - configure autonomy level and workflow preferences
- [code-review skill](../code-review/SKILL.md) - for review assignments
- [cell-retro skill](../cell-retro/SKILL.md) - for retro assignments
