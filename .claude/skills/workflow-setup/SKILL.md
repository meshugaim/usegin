---
name: workflow-setup
description: Interactive workflow setup. Triggered by "let's set up workflow", "workflow setup", "configure workflow", or at the start of complex work.
---

# Workflow Setup

Configure workflow reminders to guide how we work together. These reminders surface at key moments (session start, end of turn) to keep consistent practices.

## Quick Start with Presets

Presets are JSON files that define workflow reminders. They can live in two locations:

1. **Repo presets**: `.claude/workflow-presets/` (relative to repo root) - version-controlled, shared across team
2. **User presets**: `~/.claude/workflow-presets/` - personal, machine-specific

**Precedence:** Repo presets override user presets with the same name. This allows teams to share presets while users can customize locally.

### Available Presets

| Preset | Reminder |
|--------|----------|
| `tdd` | Write tests first, then implement |
| `commit-often` | Commit after each change, push frequently |
| `coverage` | Run and report coverage before completing |
| `verify` | Verify your work compiles/runs before finishing |
| `update-plan` | Update Linear issue with progress |
| `ask-often` | Ask before decisions, confirm assumptions, pause for review |
| `checkpoints` | Check in at breakpoints, share reasoning |
| `autonomous` | Work autonomously, update Linear on outcomes |
| `fire-and-forget` | Full autonomy, exit when done |
| `spawn-reviewers` | Spawn code reviewers after worker commits land |
| `trigger-retro` | Trigger retro worker after feature completion |
| `quality-gates` | Ensure tests pass and coverage reported before closing |
| `review-after-push` | Consider triggering code review after risky changes |
| `retro-on-complete` | Trigger retro after feature completion |
| `ask-when-blocked` | Surface blockers to user, don't spin |

### Combined Presets

Combined presets include multiple reminders:

```json
// implementation.json - bundles common implementation practices
{
  "name": "implementation",
  "includes": ["tdd", "commit-often", "coverage", "verify", "update-plan"]
}

// spawner.json - for cell spawner sessions
{
  "name": "spawner",
  "includes": ["autonomous", "update-plan", "spawn-reviewers", "trigger-retro", "quality-gates"]
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

For interactive sessions, interview the user about preferences using `AskUserQuestion`. The interview has five categories:

1. **Autonomy level** - How involved should the user be?
2. **Frequency** - How often should reminders appear?
3. **Cell pattern** - Should we use spawner/workers?
4. **Quality triggers** - When to review/retro?
5. **Custom reminders** - User-defined nudges

### Interview Flow

Use `AskUserQuestion` with these categories. You can ask multiple questions in one call:

```typescript
// Example AskUserQuestion call structure
{
  questions: [
    {
      header: "Autonomy",
      question: "How involved do you want to be in decisions?",
      options: [
        { label: "Micro-manage", description: "Ask before each action" },
        { label: "Collaborate", description: "Check in at checkpoints" },
        { label: "Delegate", description: "Work autonomously, update on outcomes" },
        { label: "Fire-and-forget", description: "Full autonomy, exit when done" }
      ],
      multiSelect: false
    },
    {
      header: "Frequency",
      question: "How often should reminders appear?",
      options: [
        { label: "Light (20%)", description: "Occasional nudges" },
        { label: "Medium (50%)", description: "Regular reminders" },
        { label: "Heavy (100%)", description: "Every turn" }
      ],
      multiSelect: false
    }
  ]
}
```

### Category 1: Autonomy Level

Ask about involvement level first - this shapes everything else:

```
← More involved                    More autonomous →
micro-manage    collaborate    delegate    fire-and-forget
every step      checkpoints    outcomes    trust fully
```

| Level | Claude behavior |
|-------|-----------------|
| **Micro-manage** | Ask before each action, confirm assumptions, pause often |
| **Collaborate** | Check in at checkpoints, share reasoning, pause for review |
| **Delegate** | Work autonomously, update on outcomes, pause only if blocked |
| **Fire-and-forget** | Full autonomy, update Linear, exit when done |

This affects:
- How often to ask vs decide
- Whether to use cell pattern (spawner + workers)
- How much to pause for review

### Category 2: Frequency

Ask how often reminders should surface. This sets the `--frequency` flag for `workflow add`:

| Option | Frequency | When to use |
|--------|-----------|-------------|
| Light (20%) | 0.2 | Background nudges, experienced users |
| Medium (50%) | 0.5 | Balanced, learning workflows |
| Heavy (100%) | 1.0 | Critical practices, new patterns |

**AskUserQuestion format:**
```typescript
{
  header: "Frequency",
  question: "How often should reminders appear?",
  options: [
    { label: "Light (20%)", description: "Occasional nudges, won't interrupt flow" },
    { label: "Medium (50%) (Recommended)", description: "Regular reminders at key moments" },
    { label: "Heavy (100%)", description: "Every turn, for critical practices" }
  ],
  multiSelect: false
}
```

### Category 3: Cell Pattern

For complex/long work, ask about spawner/worker pattern. Only ask if autonomy is "delegate" or "fire-and-forget".

**When to suggest cell:**
- Work exceeds single context
- Multi-file implementation
- User wants hands-off execution
- Parallel work identified

**AskUserQuestion format:**
```typescript
{
  header: "Cell pattern",
  question: "Should we use spawner/worker pattern for this work?",
  options: [
    { label: "Yes", description: "Orchestrate workers for complex/parallel work" },
    { label: "No (Recommended)", description: "Single session, simpler workflow" }
  ],
  multiSelect: false
}
```

If yes, follow up with:
```typescript
{
  header: "Workers",
  question: "How should workers be organized?",
  options: [
    { label: "Sequential", description: "One at a time, ordered slices" },
    { label: "Parallel", description: "Multiple workers, independent tasks" }
  ],
  multiSelect: false
}
```

If using cell, spawner orchestrates - see [cell skill](../cell/SKILL.md).

### Category 4: Quality Triggers

Ask about when to trigger quality processes. Use multiSelect since these aren't mutually exclusive:

**AskUserQuestion format:**
```typescript
{
  header: "Quality",
  question: "When should quality checks trigger?",
  options: [
    { label: "Review after risky pushes", description: "Spawn reviewer after complex changes" },
    { label: "Retro on completion", description: "Trigger retro after feature done" },
    { label: "Ask when blocked", description: "Surface blockers instead of spinning" },
    { label: "None", description: "Skip quality triggers" }
  ],
  multiSelect: true
}
```

Maps to presets:
- "Review after risky pushes" → `review-after-push`
- "Retro on completion" → `retro-on-complete`
- "Ask when blocked" → `ask-when-blocked`

### Category 5: Custom Reminders

Allow user to add specific text reminders. After the structured questions, offer:

**AskUserQuestion format:**
```typescript
{
  header: "Custom",
  question: "Any custom reminders to add?",
  options: [
    { label: "Yes", description: "Add specific text reminders" },
    { label: "No", description: "Use selected presets only" }
  ],
  multiSelect: false
}
```

If "Yes", ask follow-up in plain text:
> What reminders would you like? (One per line, or comma-separated)

Add each as a custom reminder via `workflow add "reminder text"`.

### Example Questions by Task Type

**For implementation tasks:**
- Autonomy, Frequency, Quality triggers

**For complex/long work:**
- Autonomy, Frequency, Cell pattern, Quality triggers

**For quick fixes:**
- Skip interview, use sensible defaults

Use `AskUserQuestion` with relevant categories for the task at hand.

## After Setup

1. Run `workflow clear` to reset
2. Run `workflow add` for each reminder
3. Show final list with `workflow list`
4. Confirm configuration
5. Run `workflow unblock-stop -n 1` to allow one stop without blocking

**Important:** Always use `-n 1` for `unblock-stop`, not larger values. This ensures you review each stop point before continuing, maintaining the collaborative rhythm.

## Creating New Presets

Add a JSON file to either location:
- **Repo (shared)**: `.claude/workflow-presets/my-preset.json`
- **User (personal)**: `~/.claude/workflow-presets/my-preset.json`

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

**Tip:** Add team-wide presets to `.claude/workflow-presets/` in your repo and commit them. They'll be available in all environments and shared with collaborators.

## How Reminders Surface

- **SessionStart hook**: Reminders injected at start of session
- **Stop hook**: Reminders shown when agent finishes turn

This keeps practices consistent throughout the work.
