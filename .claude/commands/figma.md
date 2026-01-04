---
description: load figma comparison project context
---

# Figma Comparison Project

You are oriented on the Figma-to-app comparison project. This command loads context only - wait for user instructions before taking action.

## Workflow Reference

!`cat .claude/skills/figma-comparison/SKILL.md`

## Current State

### Manifest (frames to compare)

!`cat figma-app/comparisons/manifest.json`

### Diffs (logged differences)

!`cat figma-app/comparisons/diffs.json`

## Tools Available

| MCP | Purpose | Example |
|-----|---------|---------|
| `figma-personal` | Design data, images | `get_figma_data`, `download_figma_images` |
| `figma-browser` | Designer comments | `figma_get_comments` |
| `playwright` | App navigation, screenshots | `browser_navigate`, `browser_snapshot`, `browser_take_screenshot` |

**File keys** (from manifest): `figma_file_personal` for design data, `figma_file_team` for comments.

## Linear Context

!`plan show 800 --tree 2>/dev/null || echo "Run 'plan show 800' for Linear context"`

---

Context loaded. Awaiting instructions.
