---
description: Create implementation plans to make the app match Figma (App → Figma direction)
---

# Figma Apply

You are oriented on the Figma implementation project. This command loads context only - wait for user instructions before taking action.

**Direction:** App → Figma (creating implementation plans)

For documenting differences without implementation plans, use `/figma-diff` instead.

## Prerequisites

Before browsing the app, ensure the **new UI toggle is enabled**:
1. Navigate to `http://localhost:3000/toggles`
2. Enable "New UI Design" toggle
3. Focus on `/workspaces` routes (not legacy `/projects`)

## Workflow Reference

!`cat .claude/skills/figma-apply-workflow/SKILL.md`

## Current State

### Manifest (pages to implement)

!`cat tools/figma/figma-apply/comparisons/manifest.json`

### Diffs (implementation plans)

!`cat tools/figma/figma-apply/comparisons/diffs.json`

## Tools Available

- `mcp__figma-personal__*` - Fetch Figma design data and download images
- `mcp__figma-browser__*` - Read comments and browse team files
- `playwright-cli` - Browse app and capture screenshots (via Bash)

**File keys** (from manifest): `figma_file_personal` for design data, `figma_file_team` for comments.

## Screenshot Paths

Save screenshots to the `figma/apply/` subdirectory:

- **Figma screenshots:** `nextjs-app/public/screenshots/figma/apply/figma/<id>-<desc>.png`
- **App screenshots:** Use Playwright filename `figma/apply/app/<id>-<desc>.png`

## Key Differences from figma-diff

| Aspect | figma-diff | figma-apply |
|--------|------------|-------------|
| Direction | Figma → App | App → Figma |
| Organized by | Figma frames | App routes |
| Output | Discrepancy docs | Implementation plans |
| Goal | Map gaps | Close gaps |

## Linear Context

!`plan show 800 --tree 2>/dev/null || echo "Run 'plan show 800' for Linear context"`
