---
name: analyzing-sessions
description: Analyze Claude Code sessions for retrospective improvements. Triggered by "analyze this session", "retro on session", or "what could be improved".
---

# Analyzing Sessions

Analyze a Claude Code session to identify friction points and propose improvements.

## Workflow

### Step 1: Parse the Session

```bash
bun session-parser/src/cli.ts <session.jsonl> --tool-input --subagents
```

### Step 2: Identify Issues

Look for:

**Friction Points:**
- Multiple similar tool calls (searching/guessing)
- Failed approaches that had to be retried
- Long outputs that weren't used
- Subagents spawned but abandoned

**Skill Gaps:**
- Domain patterns Claude didn't know
- Missing guidance that would have helped

### Step 3: Propose Improvements

For each issue, determine:
- **Type:** skill-refinement | new-skill | skill-deprecation | claude-md | tooling
- **Confidence:** high | medium | low
- **What to change** and why

### Step 4: Create Proposals (CI only)

In CI, for HIGH or MEDIUM confidence proposals, use the `creating-retro-proposals` skill to create proposal branches.

Read: `.claude/skills/creating-retro-proposals/SKILL.md`

Skip LOW confidence proposals - just note them in output.

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

## Proposals Created (CI only)
- `retro/proposals/<id>-<slug>` - [description]

## Low-Confidence Observations
- [observations not turned into proposals]
```

## Session File Location

Sessions live in `~/.claude/projects/<project-hash>/`:
- Main session: `<uuid>.jsonl`
- Subagents: `agent-*.jsonl`

Use `--list-files` to find related files:
```bash
bun session-parser/src/cli.ts <session.jsonl> --list-files
```
