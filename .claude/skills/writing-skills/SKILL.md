---
name: writing-skills
description: This skill writes Claude Code skills interactively. Triggered by "let's write a skill", "new skill for X", "create a skill", or "skill for X".
---

# Writing Skills

Build skills collaboratively through brain-dump, discussion, and iterative refinement.

**Reference:** See `writing-specs` skill for a mature example of this workflow.

## Workflow

### 1. Brain Dump

User describes what they want. Don't write yet - just listen and gather context.

### 2. Questionnaire

Use `AskUserQuestion` to clarify:

| Question | Purpose |
|----------|---------|
| Suggested name? | `kebab-case` for folder name |
| Trigger phrases? | When should this skill activate? |
| Core workflow? | What steps does it perform? |
| Tools needed? | MCP servers, bash commands, etc. |
| Similar to existing skill? | Reference for style/structure |

### 3. Propose Structure

Present outline of the skill content. Get approval or adjust.

### 4. Write Incrementally

Create `.claude/skills/<name>/SKILL.md`. For each section:

| Step | Action |
|------|--------|
| 1 | Write section to file |
| 2 | Commit and push to `main` |
| 3 | PAUSE - get feedback via `AskUserQuestion` |
| 4 | Apply changes if needed, commit and push |
| 5 | Next section when approved |

**Feedback questions:**

| Question | Options |
|----------|---------|
| Feedback on this section? | "Looks good", "Needs changes" |
| Other thoughts? | "No", "Yes" |
| Next section? | List from outline + "Done" |

## Style Guide

| Do | Don't |
|----|-------|
| Concise | Verbose |
| Tables over prose | Walls of text |
| Actionable steps | Vague guidance |
| Specific examples | Abstract descriptions |
| TL;DR at the top | Bury the key points |
