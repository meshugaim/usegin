---
name: workflow-setup
description: Interactive workflow setup. Triggered by "let's set up workflow", "workflow setup", "configure workflow", or at the start of complex work.
---

# Workflow Setup

Interview the user about their workflow preferences for this session, then populate workflow reminders.

## Purpose

Establish shared understanding of how we'll work together:
- Testing approach (TDD? Tests after?)
- Review cadence (after each change? end of task?)
- Commit frequency
- Quality checks

## Interview Flow

Use `AskUserQuestion` for each topic. Keep it quick - 3-4 questions max.

### Question 1: Testing Approach

| Option | Reminder Added |
|--------|----------------|
| TDD | "Write tests first, then implement" |
| Tests after | "Write tests after implementation" |
| No tests | (none) |

### Question 2: Code Review

| Option | Reminder Added |
|--------|----------------|
| After each change | "Pause for review after each change" |
| After feature complete | "Review when feature is complete" |
| None | (none) |

### Question 3: Commits

| Option | Reminder Added |
|--------|----------------|
| Frequent (per file/change) | "Commit frequently, small changes" |
| Logical chunks | "Commit at logical checkpoints" |
| End of task | "Commit when task is complete" |

### Question 4: Other Reminders (open-ended)

Let user add any custom reminders.

## After Interview

1. Run `workflow clear` to start fresh
2. Run `workflow add` for each selected reminder
3. Show final list with `workflow list`
4. Confirm: "Workflow configured. These reminders will guide our session."

## Quick Setup

If user says "quick" or "default":
- TDD
- Review after feature complete
- Commit at logical checkpoints

## Import Previous

If user says "use previous" or "same as last time":
- Use `workflow import` to pick from recent sessions
