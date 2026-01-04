---
name: figma-comparison
description: Compare Figma designs to the live app. Triggered by "compare figma", "keep comparing", or "figma diff".
---

# Figma Comparison

Compare Figma designs to the live app, find meaningful differences, and create actionable recommendations.

## Philosophy

### Classification Types

| Type | What It Means |
|------|---------------|
| `css` | Colors, fonts, spacing, borders, shadows |
| `layout` | Grid, positioning, element order, alignment |
| `component` | Component design (chat bubble shape, card styling) |
| `ux` | Interaction/flow differs from Figma |
| `feature` | Feature in Figma doesn't exist in app |

### The Core Process

For each difference you find:

1. **Check Figma comments** - Designer may have noted "this needs to change" → mark `wontfix`, don't implement
2. **Check codebase** - Understand WHY it differs. Is the feature built? Is it a CSS oversight?
3. **Create recommendation** - Be specific: file, line, what to change. Or explain why not actionable.

### Statuses

- `new` - Just identified
- `acknowledged` - Reviewed, not acting yet
- `in_progress` - Being fixed
- `wontfix` - Intentional or awaiting Figma change
- `resolved` - App matches Figma

## Data Locations

```
figma-app/
├── comparisons/
│   ├── manifest.json    # Frames to compare, status
│   └── diffs.json       # Comparison results
└── public/screenshots/
    ├── figma/           # Figma exports
    └── app/             # App screenshots
```

Figma file: `jkd27vp0cgfg7CLBRvfeC3` (AskEffie)

## Workflow

### 1. Orient

```bash
cat figma-app/comparisons/manifest.json
```

Pick a frame with `status: not_started`. If manifest is empty, read `.claude/handoffs/figma-populate-manifest.md`.

### 2. Load Both Views

**Figma:** Use `mcp__figma__get_figma_data` with the frame's `figma_node`.

**Comments:** Use `mcp__figma-browser__figma_get_comments` to get designer discussions.

**App:** Use `mcp__playwright__browser_navigate` to the `app_route`, then `browser_snapshot`.

For Playwright usage details, see the `closed-loop-web-development` skill.

### 3. Analyze (The Critical Step)

**DO NOT auto-create diffs.** Carefully compare:

- Layout and structure
- Component by component
- Styling details
- Missing features

**For each potential difference, ask:**
1. Is this actually different?
2. Is it intentional? (check Figma comments)
3. Is it worth tracking?
4. What's the root cause? (check codebase)

**Check the codebase** - Find the component file. Understand why it looks the way it does.

### 4. Create Diffs (Only for Real Differences)

For each meaningful difference:

**Take specific screenshots** (element-level, not full page):
- Figma: `mcp__figma__download_figma_images` with specific node
- App: `mcp__playwright__browser_take_screenshot` with element ref

**Create diff entry:**

```json
{
  "id": "dashboard-sidebar-001",
  "frame_id": "dashboard",
  "parent_id": null,
  "component": "Sidebar > Icons",
  "description": "Icons are 24px in Figma, 20px in app",
  "type": "css",
  "status": "new",
  "recommendation": "Update src/components/Sidebar.tsx:45 - change h-5 w-5 to h-6 w-6",
  "figma_comments": [],
  "figma_image": "figma/dashboard-sidebar-001.png",
  "app_image": "app/dashboard-sidebar-001.png",
  "linear_issue": null,
  "created_at": "2026-01-04"
}
```

**Good recommendations include:** file path, line number, specific change.

**If not actionable:** Explain why (e.g., "Awaiting Figma update per chris.baum comment", "Blocked on feature ENG-XXX").

### 5. Save & Update Status

- Add diffs to `figma-app/comparisons/diffs.json`
- Update frame status in manifest (`in_progress` or `complete`)
- Zero diffs is valid if app matches Figma

## What NOT To Do

- Don't auto-create diffs for every element
- Don't screenshot full pages for component-level diffs
- Don't ignore Figma comments
- Don't skip codebase verification
- Don't create duplicates (check existing diffs first)

## References

- **Manifest population:** `.claude/handoffs/figma-populate-manifest.md`
- **Starting comparisons:** `.claude/handoffs/figma-start-comparing.md`
- **Playwright usage:** `.claude/skills/closed-loop-web-development/SKILL.md`
- **Linear tracking:** ENG-800
