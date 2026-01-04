---
description: load figma comparison context and continue mapping diffs
---

# Figma Comparison Project

You are working on comparing Figma designs to the live app implementation.

## Workflow (from skill)

!`cat .claude/skills/figma-comparison/SKILL.md`

## Current State

### Manifest (frames to compare)

!`cat figma-app/comparisons/manifest.json`

### Diffs (logged differences)

!`cat figma-app/comparisons/diffs.json`

## File Keys

- **Personal file** (for design data): Use `figma_file_personal` from manifest above
- **Team file** (for comments): Use `figma_file_team` from manifest above

## Your Task

1. **Orient**: Check which frames have `status: not_started` in the manifest
2. **Pick one**: Start with the first not_started frame
3. **Gather context**: Load Figma, comments, app view, AND check codebase
4. **Map diffs**: Only after full context, identify and document differences
5. **Screenshot**: Every diff needs both figma and app screenshots
6. **Update**: Modify diffs.json, update manifest status, link Linear issues
7. **Commit**: Small commits with `Part of: ENG-241`

## Linear Context

!`plan show 241 --tree 2>/dev/null || echo "Run 'plan show 241' for Linear context"`

Ready to continue. Which frame should we work on next?
