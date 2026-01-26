---
description: Start an autonomous Ralph loop for long-running tasks
---

# Ralph Loop

Read the skill documentation first:

$READ:.claude/skills/ralph-loop/SKILL.md

## Setup

Before starting, fetch the latest official documentation for current best practices:

Use WebFetch to get: https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/ralph-wiggum/README.md

Review the docs, then help the user craft their Ralph loop prompt and start with:

```bash
/ralph-loop "<prompt>" --max-iterations <n> --completion-promise "<text>"
```
