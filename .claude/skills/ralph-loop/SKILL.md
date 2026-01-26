---
name: ralph-loop
description: Autonomous development loop for long-running tasks. Triggered by "run ralph", "ralph loop", "let's ralph this", or for autonomous multi-iteration work.
---

# Ralph Loop

Autonomous development loop. When Claude tries to exit, a Stop hook blocks it and re-injects the prompt. Each iteration builds on previous work (files and git history persist).

Named after Ralph Wiggum - embodies persistent iteration despite setbacks.

## Before Starting

Fetch the latest documentation for best practices:

```
WebFetch: https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/ralph-wiggum/README.md
```

## Quick Reference

```bash
/ralph-loop "<task>" --max-iterations 50 --completion-promise "DONE"
/cancel-ralph  # Stop the loop
```

## Critical Rules

1. **Always set `--max-iterations`** - Safety net against infinite loops
2. **Define clear completion criteria** - Vague tasks = endless loops
3. **Only output completion promise when TRUE** - Don't lie to escape

## Prompt Template

```markdown
<task>
[What to build]

Requirements:
- [Requirement 1]
- [Requirement 2]

Success criteria:
- [How to verify completion]
- All tests passing

When complete, output: <promise>COMPLETE</promise>
</task>
```

## When to Use

| Good | Bad |
|------|-----|
| Well-defined tasks | Unclear requirements |
| Auto-verifiable (tests, lint) | Needs human judgment |
| Greenfield work | Production debugging |

## Cost Warning

Loops burn tokens. Set `--max-iterations` conservatively. A 50-iteration loop on a large codebase can cost $50-100+ in API credits.
