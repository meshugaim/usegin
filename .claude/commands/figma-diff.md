---
description: Map differences from Figma designs to the app (Figma → App direction)
---

# Figma Diff

You are oriented on the Figma-to-app diff mapping project. This command loads context only - wait for user instructions before taking action.

**Direction:** Figma → App (documenting what's different)

For implementing changes from app to match Figma, use `/figma-apply` instead.

## Workflow Reference

!`cat .claude/skills/figma-diff-workflow/SKILL.md`

## Current State

### Manifest (frames to compare)

!`cat tools/figma/figma-diff/comparisons/manifest.json`

### Diffs (logged differences)

!`cat tools/figma/figma-diff/comparisons/diffs.json`

## Tools Available

| MCP | Purpose | Example |
|-----|---------|---------|
| `figma-personal` | Design data, images | `get_figma_data`, `download_figma_images` |
| `figma-browser` | Designer comments | `figma_get_comments` |
| `playwright` | App navigation, screenshots | `browser_navigate`, `browser_snapshot`, `browser_take_screenshot` |

**File keys** (from manifest): `figma_file_personal` for design data, `figma_file_team` for comments.

## Screenshot Paths

Save screenshots to the `figma/diff/` subdirectory:

- **Figma screenshots:** `nextjs-app/public/screenshots/figma/diff/figma/<id>-<desc>.png`
- **App screenshots:** Use Playwright filename `figma/diff/app/<id>-<desc>.png`

## Linear Context

!`plan show 800 --tree 2>/dev/null || echo "Run 'plan show 800' for Linear context"`

---

Context loaded. Awaiting instructions.
