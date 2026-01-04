---
name: figma-comparison
description: Compare Figma designs to the live app. Triggered by "compare figma", "keep comparing", or "figma diff".
---

# Figma Comparison

Compare Figma designs to the live app. Every diff requires full context and screenshots.

## Source of Truth

```
figma-app/comparisons/manifest.json  # Frames to compare (status, node IDs, routes)
figma-app/comparisons/diffs.json     # Logged differences
figma-app/public/screenshots/        # figma/ and app/ subdirs
```

Start by reading manifest.json to find frames with `status: not_started`.

## Two Figma MCPs

| MCP | File Key | Purpose |
|-----|----------|---------|
| `mcp__figma-personal__*` | `figma_file_personal` in manifest | Design data, downloading images |
| `mcp__figma-browser__*` | `figma_file_team` in manifest | Designer comments |

Use **personal** for `get_figma_data` and `download_figma_images`.
Use **team** for `figma_get_comments`.

## Workflow Per Frame

### 1. Gather Context First

Before identifying any diffs, you need full context:

**Load Figma design:**
```
mcp__figma-personal__get_figma_data(fileKey="<figma_file_personal>", nodeId="<figma_node>", depth=3)
```

**Read designer comments:**
```
mcp__figma-browser__figma_get_comments(file_key="<figma_file_team>")
```

**Load app view:**
```
mcp__playwright__browser_navigate(url="http://localhost:3000/<app_route>")
mcp__playwright__browser_snapshot()
```

**Check codebase** for relevant components - understand WHY things look the way they do.

### 2. Identify Differences (With Context)

Only after you have full context, identify differences. For each potential diff, ask:

1. **What does Figma show?** - Be specific about the element
2. **What does the app show?** - Or is it missing entirely?
3. **What do comments say?** - Designer may have noted "this will change" → don't log it
4. **What does the code show?** - Is there a technical reason? CSS constraint? Feature not built?

Focus on high-level differences (layout, missing features, UX patterns). Skip small CSS tweaks.

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
```
mcp__playwright__browser_take_screenshot(
  filename="app/<diff-id>-<desc>-app.png",
  element="<human description>",
  ref="<ref from snapshot>"
)
```

**Verify screenshots exist:**
```bash
ls figma-app/public/screenshots/figma/
ls figma-app/public/screenshots/app/
```

If app screenshots missing, copy from Docker:
```bash
docker ps | grep playwright
docker cp <container>:/tmp/playwright-output/app/ figma-app/public/screenshots/
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

### 5. Update Manifest

Set frame status to `completed` and add notes about diffs logged.

## Rate Limits

Figma API has aggressive limits. On 429 errors:
- Wait 2-3 minutes
- Work on app screenshots while waiting
- Use `depth=2` or `depth=3`, not higher

## Verification

View diffs at `http://localhost:5555`. Click a diff - both images should display.

## Don't

- Create diffs without reading comments first
- Create diffs without checking if feature exists in codebase
- Log diffs without screenshots
- Screenshot full pages instead of specific elements
