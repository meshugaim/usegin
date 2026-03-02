---
name: figma-diff-workflow
description: Workflow for mapping differences between Figma designs and the live app.
---

# Figma Diff

Map differences from Figma designs to the app. Direction: **Figma → App** (documenting what's different).

For implementing changes from app to match Figma, use `/figma-apply` instead.

## ⚠️ CRITICAL: Before You Start

### 1. Login Required

**You MUST authenticate into the app before taking any screenshots.** Unauthenticated screenshots are useless - most pages redirect to sign-in or show empty states.

```
1. Navigate to http://localhost:3000/sign-in
2. Enter a valid email and complete OTP auth
3. Verify you see actual content (workspaces, projects, etc.)
4. ONLY THEN proceed with taking screenshots
```

If you cannot authenticate, STOP and ask the user for credentials or a test account.

### 2. Screenshot Specific Elements, Not Full Pages

**Screenshots must show the EXACT element being compared, not the entire page.**

- ✅ Correct: Screenshot of the workspace card component only
- ✅ Correct: Screenshot of the header navigation section
- ❌ Wrong: Full page screenshot when comparing a button style
- ❌ Wrong: Full page screenshot when comparing a card layout

**Exception:** Layout diffs that compare overall page structure CAN use full-page screenshots.

For Figma: Use the specific `nodeId` of the component, not the page frame.
For App: Use the `element` and `ref` params to capture specific elements from the snapshot.

---

## Source of Truth

```
tools/figma/figma-diff/comparisons/manifest.json  # Frames to compare (status, node IDs, routes)
tools/figma/figma-diff/comparisons/diffs.json     # Logged differences
```

Screenshots are stored at:
```
nextjs-app/public/screenshots/figma/diff/
├── figma/    # Figma design screenshots
└── app/      # App screenshots
```

Start by reading manifest.json to find frames with `status: not_started`.

## Tools

| Tool | File Key | Purpose |
|------|----------|---------|
| `mcp__figma-personal__*` | `figma_file_personal` in manifest | Design data, downloading images |
| `mcp__figma-browser__*` | `figma_file_team` in manifest | Designer comments |
| `playwright-cli` | N/A | App screenshots, navigation |

Use **figma-personal** for `get_figma_data` and `download_figma_images`.
Use **figma-browser** for `figma_get_comments`.
Use **playwright-cli** for app navigation and screenshots.

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
```bash
bunx playwright-cli goto http://localhost:3000/<app_route>
bunx playwright-cli snapshot
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
  nodes=[{"nodeId": "<element_node>", "fileName": "<diff-id>-<desc>.png"}],
  localPath="/workspaces/test-mvp/nextjs-app/public/screenshots/figma/diff/figma"
)
```

**Capture App screenshot:**
```bash
bunx playwright-cli screenshot <ref> --filename nextjs-app/public/screenshots/figma/diff/app/<diff-id>-<desc>.png
```

**Verify screenshots exist:**
```bash
ls nextjs-app/public/screenshots/figma/diff/figma/
ls nextjs-app/public/screenshots/figma/diff/app/
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
  "figma_image": "figma/<diff-id>-<desc>.png",
  "app_image": "app/<diff-id>-<desc>.png",
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
git add tools/figma/figma-diff/comparisons/
git commit -m "figma-diff: map diffs for <frame-id>

Part of: ENG-241"
```

## Rate Limits

Figma API has aggressive limits. On 429 errors:
- Wait 2-3 minutes
- Work on app screenshots while waiting
- Use `depth=2` or `depth=3`, not higher

## Screenshot Path Convention

Screenshots are stored at `nextjs-app/public/screenshots/figma/diff/`:
```
figma/diff/
├── figma/<diff-id>-<desc>.png   # From Figma MCP
└── app/<diff-id>-<desc>.png     # From Playwright
```

In `diffs.json`, store paths relative to `figma/diff/`:
```json
"figma_image": "figma/feature-001-plan-usage.png",
"app_image": "app/feature-001-projects.png"
```

The figma-diff app symlinks to this directory and serves images.

## Verification

View diffs at `http://localhost:5555`. Click a diff - both images should display.

## Don't

- Take ANY screenshots before authenticating into the app
- Create diffs without reading comments first
- Create diffs without checking if feature exists in codebase
- Log diffs without screenshots
- Screenshot full pages instead of specific elements (unless it's a layout diff)
- Export Figma page frames when you need a specific component node
