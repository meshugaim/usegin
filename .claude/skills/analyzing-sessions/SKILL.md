---
name: analyzing-sessions
description: Analyze Claude Code sessions for retrospective improvements. Triggered by "analyze this session", "retro on session", or "what could be improved".
---

# Analyzing Sessions

Analyze a Claude Code session to identify friction points and propose improvements.

## Usage

```bash
# Parse session first
bun session-parser/src/cli.ts <session.jsonl> --tool-input --subagents
```

## What to Look For

### Friction Points
- Multiple similar tool calls (searching/guessing)
- Failed approaches that had to be retried
- Long outputs that weren't used
- Subagents spawned but abandoned

### Skill Gaps
- Domain patterns Claude didn't know
- Missing guidance that would have helped

## Output Format

```markdown
## Summary
[1-2 sentences: what happened, did it succeed]

## Friction Points
- [point 1]
- [point 2]

## Proposed Improvements
### [Title]
**Type:** skill-refinement | new-skill | claude-md
**Confidence:** high | medium | low
**Description:** [what to change]
```

## Session File Location

Sessions live in `~/.claude/projects/<project-hash>/`:
- Main session: `<uuid>.jsonl`
- Subagents: `agent-*.jsonl`

Use `--list-files` to find related files:
```bash
bun session-parser/src/cli.ts <session.jsonl> --list-files
```
