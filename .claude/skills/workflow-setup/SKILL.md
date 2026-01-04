---
name: workflow-setup
description: Interactive workflow setup. Triggered by "let's set up workflow", "workflow setup", "configure workflow", or at the start of complex work.
---

# Workflow Setup

Configure workflow reminders to guide how we work together. These reminders surface at key moments (session start, end of turn) to keep consistent practices.

## Quick Start with Presets

Presets live in `~/.claude/workflow-presets/` as JSON files. Use them for consistent workflows across sessions.

### Available Presets

| Preset | Reminder |
|--------|----------|
| `tdd` | Write tests first, then implement |
| `commit-often` | Commit after each change, push frequently |
| `coverage` | Run and report coverage before completing |
| `verify` | Verify your work compiles/runs before finishing |
| `update-plan` | Update Linear issue with progress |

### Combined Presets

Combined presets include multiple reminders:

```json
// implementation.json - bundles common implementation practices
{
  "name": "implementation",
  "includes": ["tdd", "commit-often", "coverage", "verify", "update-plan"]
}
```

### Using Presets with crun

When spawning workers with `crun`, use `--remind` to load presets:

```bash
# Single preset
crun --remind tdd -n "Tests added" "Add tests for auth module"

# Multiple presets
crun --remind tdd,commit-often -n "Feature complete" "Implement login flow"

# Combined preset (expands to all included)
crun --remind implementation -n "Done" "Build the feature"
```

The reminders are injected at session start and displayed again when the agent finishes (via Stop hook).

## Interactive Setup

For interactive sessions, interview the user about preferences. Keep it quick - a few questions max.

### Example Categories

**Testing**
- TDD (tests first)
- Tests after implementation
- No tests for this task

**Commits**
- After each change
- At logical checkpoints
- End of task only

**Review**
- Pause after each change
- Review when complete
- No review needed

**Custom**
- Let user add specific reminders

Use `AskUserQuestion` with relevant categories for the task at hand.

## After Setup

1. Run `workflow clear` to reset
2. Run `workflow add` for each reminder
3. Show final list with `workflow list`
4. Confirm configuration

## Creating New Presets

Add a JSON file to `~/.claude/workflow-presets/`:

```json
// Simple preset
{
  "name": "my-preset",
  "reminder": "The reminder text shown to agent"
}

// Combined preset
{
  "name": "my-bundle",
  "includes": ["tdd", "commit-often", "my-preset"]
}
```

## How Reminders Surface

- **SessionStart hook**: Reminders injected at start of session
- **Stop hook**: Reminders shown when agent finishes turn

This keeps practices consistent throughout the work.
