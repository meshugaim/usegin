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

## Quick Start

**As spawner:** Read [spawner.md](spawner.md) for orchestration patterns.

**As worker:** Read [worker.md](worker.md) for execution guidance.

**Both roles:** [core.md](core.md) has shared principles (TDD, commits, Linear, quality).

## See Also

- [code-review skill](../code-review/SKILL.md) - for review assignments
- [cell-retro skill](../cell-retro/SKILL.md) - for retro assignments
