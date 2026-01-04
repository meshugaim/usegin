---
name: figma-comparison
description: Compare Figma designs to the live app. Triggered by "compare figma", "keep comparing", or "figma diff".
---

# Figma Comparison

Compare Figma designs to the live app. Every diff requires **broad context first**, then screenshots.

## Source of Truth

```
figma-app/comparisons/manifest.json  # Frames to compare (status, node IDs, routes)
figma-app/comparisons/diffs.json     # Logged differences
figma-app/public/screenshots/        # figma/ and app/ subdirs
```

Start by reading manifest.json to find frames with `status: not_started`.

## Three MCPs

| MCP | File Key | Purpose |
|-----|----------|---------|
| `mcp__figma-personal__*` | `figma_file_personal` in manifest | Design data, downloading images |
| `mcp__figma-browser__*` | `figma_file_team` in manifest | Designer comments |
| `mcp__playwright__*` | N/A | App screenshots, navigation |

Use **figma-personal** for `get_figma_data` and `download_figma_images`.
Use **figma-browser** for `figma_get_comments`.
Use **playwright** for app navigation and screenshots.

## Workflow Per Frame

### 1. Gather Broad Context First

**Before identifying ANY differences**, build complete understanding:

**A. Load Figma design:**
```
mcp__figma-personal__get_figma_data(fileKey="<figma_file_personal>", nodeId="<figma_node>", depth=3)
```

**B. Read designer comments:**
```
mcp__figma-browser__figma_get_comments(file_key="<figma_file_team>")
```

**C. Load app view:**
```
mcp__playwright__browser_navigate(url="http://localhost:3000/<app_route>")
mcp__playwright__browser_snapshot()
```

**D. Check the codebase** - This is critical:
- Find the component files for this view (grep/glob for route or component name)
- Read the actual CSS/styles - understand current spacing, colors, layout
- Check if features exist but are hidden/disabled
- Look for TODOs, comments explaining technical constraints
- Check if there's a Linear issue already tracking the gap

Only with this full context can you accurately identify what's a real diff vs intentional deviation.

### 2. Identify Differences (With Context)

Now that you have broad context, identify differences. For each potential diff, ask:

1. **What does Figma show?** - Be specific about the element
2. **What does the app show?** - Or is it missing entirely?
3. **What do designer comments say?** - "this will change" or "placeholder" → don't log
4. **What does the code reveal?** - Is there a technical reason? CSS constraint? Feature not built yet? Existing Linear issue?

Focus on high-level differences (layout, missing features, UX patterns). Skip minor CSS tweaks unless they fundamentally change the design.

### 3. Create Diff with Screenshots

**A diff is only valid if it has:**
- Full description with context
- Figma screenshot of the specific element
- App screenshot of the corresponding area

**Capture Figma screenshot:**
```
mcp__figma-personal__download_figma_images(
  fileKey="<figma_file_personal>",
  nodes=[{"nodeId": "<element_node>", "fileName": "<diff-id>-<desc>-figma.png"}],
  localPath="/workspaces/test-mvp/figma-app/public/screenshots/figma"
)
```

**Capture App screenshot:**

Playwright saves relative to its output directory. Use absolute path to save directly to the app:
```
mcp__playwright__browser_take_screenshot(
  filename="/workspaces/test-mvp/figma-app/public/screenshots/app/<diff-id>-<desc>-app.png",
  element="<human description>",
  ref="<ref from snapshot>"
)
```

**Verify screenshots exist:**
```bash
ls figma-app/public/screenshots/figma/
ls figma-app/public/screenshots/app/
```

If Playwright saved elsewhere, copy to app directory:
```bash
cp /path/to/screenshot.png figma-app/public/screenshots/app/
```

### 4. Log to diffs.json

```json
{
  "id": "feature-001",
  "frame_id": "active-projects-overview",
  "parent_id": null,
  "component": "Plan Usage Indicator",
  "description": "Figma shows 'Using 2 of 3 in Free plan'. App has no plan tracking.",
  "type": "feature",
  "status": "new",
  "recommendation": "Not implemented. Requires backend for plan limits.",
  "figma_comments": ["Designer noted: 'confirm with PM on copy'"],
  "figma_image": "figma/feature-001-plan-usage-figma.png",
  "app_image": "app/feature-001-projects-app.png",
  "linear_issue": null,
  "created_at": "2026-01-04"
}
```

Types: `layout`, `feature`, `ux`, `content`, `css`

### 5. Update Tracking

**A. Update manifest.json:**
- Set frame `status` to `completed`
- Add `notes` about which diffs were logged

**B. Link to Linear when relevant:**
- If a diff relates to an existing issue, set `linear_issue` field
- If a diff warrants a new issue, create via `plan create` and link it
- Use `plan search` to find existing issues before creating duplicates

**C. Commit progress:**
```bash
git add figma-app/comparisons/
git commit -m "figma: map diffs for <frame-id>

Part of: ENG-241"
```

## Rate Limits

Figma API has aggressive limits. On 429 errors:
- Wait 2-3 minutes
- Work on app screenshots while waiting
- Use `depth=2` or `depth=3`, not higher

## Screenshot Path Convention

The app serves from `figma-app/` and expects:
```
figma-app/public/screenshots/
├── figma/<diff-id>-<desc>-figma.png
└── app/<diff-id>-<desc>-app.png
```

In `diffs.json`, store **relative paths** from `public/screenshots/`:
```json
"figma_image": "figma/feature-001-plan-usage-figma.png",
"app_image": "app/feature-001-projects-app.png"
```

The app prepends `public/screenshots/` when loading images.

## Verification

View diffs at `http://localhost:5555`. Click a diff - both images should display.

## Don't

- Create diffs without reading comments first
- Create diffs without checking if feature exists in codebase
- Log diffs without screenshots
- Screenshot full pages instead of specific elements
