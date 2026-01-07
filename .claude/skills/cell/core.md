# Cell Core Principles

Shared by spawner and workers.

## Source of Truth

**Linear is the shared state.**
- Sub-issues for slices
- Parent descriptions for big picture + handoff context
- Git commits as progress signal
- No local todo lists or markdown tracking

## Development Practices

**Trunk-based:**
- Push to main ASAP - don't accumulate local commits
- Small commits, frequent pushes
- Feature toggles for risky/incomplete work
- Autosync enabled

**TDD is non-negotiable:**
- Tests before implementation
- Watch tests fail first
- Minimal code to pass
- Backend + frontend both need tests

**Linting and coverage:**
- Run linter/typecheck before pushing
- Run coverage after implementation
- Report coverage in Linear
- No pushing code that fails lint

**Feature toggles when:**
- Breaking change
- Incomplete work to prod
- Gradual rollout
- Easy rollback needed

## Commit Discipline

Default: commit. When in doubt, commit.

Commit after:
- Completing a slice
- Tests passing
- Fixing a bug
- Before something risky

## Quality Processes

Triggered by spawner, executed by workers:

**Code review:** Always. Spawner assigns to worker after implementation.

**CI awareness:** Spawner monitors. If CI fails, assigns fix.

**Retro:** After feature completion. What worked, what didn't, improvements.

**Self-retro:** Spawner can retro its own session via worker.

**System improvement:**
- Add missing tools/skills
- Improve existing based on friction
- **Retire** unused - simplify, don't just grow
