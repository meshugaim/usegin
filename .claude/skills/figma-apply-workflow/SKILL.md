---
name: figma-apply-workflow
description: Workflow for creating implementation plans to make the app match Figma designs.
---

# Figma Apply

Create implementation plans from app to Figma. Direction: **App → Figma** (implementing what's needed).

For documenting differences without implementation plans, use `/figma-diff` instead.

## ⚠️ CRITICAL: Before You Start

### 1. Login Required

**You MUST authenticate into the app before taking any screenshots.** Unauthenticated screenshots are useless - most pages redirect to sign-in or show empty states.

```
1. Navigate to http://localhost:3000/sign-in
2. Enter a valid email and complete magic link auth
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
tools/figma/figma-apply/comparisons/manifest.json  # App pages to compare (organized by routes)
tools/figma/figma-apply/comparisons/diffs.json     # Implementation plans
```

Screenshots are stored at:
```
nextjs-app/public/screenshots/figma/apply/
├── figma/    # Figma design screenshots
└── app/      # App screenshots
```

Start by reading manifest.json to find pages with `status: not_started`.

## Prerequisites

**Enable new UI toggle** before browsing the app:
1. Navigate to `http://localhost:3000/toggles`
2. Enable "New UI Design" toggle
3. Then navigate to `/workspaces` routes

## Three MCPs

| MCP | Purpose | When to use |
|-----|---------|-------------|
| `figma-personal` | Fetch design data, download images | Getting Figma node structure and screenshots |
| `figma-browser` | Read comments, list projects | Checking designer notes |
| `playwright` | Browse app, take screenshots | Capturing current app state |

## Workflow

### 1. Browse App First

Navigate to the app page with new UI enabled:
```
mcp__playwright__browser_navigate(url="http://localhost:3000/toggles")
# Enable new_ui_design toggle if not already enabled
mcp__playwright__browser_navigate(url="http://localhost:3000/workspaces")
mcp__playwright__browser_snapshot()
```

### 2. Identify Components

Take a snapshot and identify major components on the page:
- Header/navigation
- Main content areas
- Cards/list items
- Modals/dialogs
- Form elements

### 3. Find Corresponding Figma Design

Use the Figma MCP to find the matching design:
```
mcp__figma-personal__get_figma_data(
  fileKey="A0DV8pRwHWgs9EF07sVYxG",
  nodeId="<page_node_from_manifest>"
)
```

### 4. Compare and Capture Screenshots

**Capture App screenshot:**
```
mcp__playwright__browser_take_screenshot(
  filename="figma/apply/app/<impl-id>-<desc>.png",
  element="<human description>",
  ref="<ref from snapshot>"
)
```

**Capture Figma screenshot:**
```
mcp__figma-personal__download_figma_images(
  fileKey="A0DV8pRwHWgs9EF07sVYxG",
  nodes=[{"nodeId": "<element_node>", "fileName": "<impl-id>-<desc>.png"}],
  localPath="/workspaces/test-mvp/nextjs-app/public/screenshots/figma/apply/figma"
)
```

**Verify screenshots exist:**
```bash
ls nextjs-app/public/screenshots/figma/apply/figma/
ls nextjs-app/public/screenshots/figma/apply/app/
```

### 5. Create Implementation Plan

For each significant difference, create an entry in diffs.json:

```json
{
  "id": "impl-001",
  "page_id": "workspaces-list",
  "component_id": "workspace-card",

  "pointers": {
    "figma": {
      "node_url": "https://figma.com/file/A0DV8pRwHWgs9EF07sVYxG?node-id=2003:1400",
      "frame_id": "2003:1400"
    },
    "app": {
      "url": "http://localhost:3000/workspaces",
      "component_path": "nextjs-app/components/workspace-card.tsx",
      "selector": "[data-testid='workspace-card']"
    }
  },

  "images": {
    "figma": "figma/<impl-id>-<desc>.png",
    "app": "app/<impl-id>-<desc>.png"
  },

  "recommendation": "implement",
  "reason": null,

  "implementation_plan": {
    "summary": "Brief description of what needs to change",
    "files_to_modify": [
      "nextjs-app/path/to/file.tsx"
    ],
    "steps": [
      "1. First step with specific details",
      "2. Second step with code hints",
      "3. Third step"
    ],
    "complexity": "low|medium|high",
    "dependencies": []
  },

  "status": "new",
  "linear_issue": null,
  "created_at": "2026-01-05"
}
```

## Diff Schema Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique ID (impl-001, impl-002, etc.) |
| `page_id` | Yes | References manifest page |
| `component_id` | No | Specific component within page |
| `pointers.figma` | Yes | Figma node URL and frame ID |
| `pointers.app` | Yes | App URL, component path, and selector |
| `images` | Yes | Relative paths to screenshots |
| `recommendation` | Yes | Usually "implement", or "skip" with reason |
| `reason` | If skip | Why not implementing |
| `implementation_plan` | Yes | Detailed steps for implementation |
| `status` | Yes | new, in_progress, implemented, verified |
| `linear_issue` | No | Link to Linear issue if created |

## Focus Areas

**Major differences only** - ignore:
- Few pixels padding differences
- Minor color shade variations
- Font weight subtle differences

**Focus on:**
- Layout structure (flex vs grid, arrangement)
- Missing components/features
- Significant visual differences
- Interactive behavior differences
- Navigation/routing differences

## After Each Page

**A. Update manifest.json:**
- Set `status: "in_progress"` or `"completed"`
- Add discovered `figma_node` mappings
- Add `components` array with sub-components

**B. Append to diffs.json:**
- One entry per significant implementation needed
- Include detailed implementation plan

**C. Commit progress:**
```bash
git add tools/figma/figma-apply/comparisons/
git commit -m "figma-apply: implementation plans for <page-id>

Part of: ENG-XXX"
```

## Screenshot Path Convention

Screenshots are stored at `nextjs-app/public/screenshots/figma/apply/`:
```
figma/apply/
├── figma/<impl-id>-<desc>.png   # From Figma MCP
└── app/<impl-id>-<desc>.png     # From Playwright
```

In `diffs.json`, store paths relative to `figma/apply/`:
```json
"images": {
  "figma": "figma/impl-001-workspace-card.png",
  "app": "app/impl-001-workspace-card.png"
}
```

## Implementation Plan Quality

Each plan should be detailed enough for another Claude to implement without additional context:

**Good plan:**
```json
{
  "summary": "Update workspace card grid to 3-column layout",
  "files_to_modify": ["nextjs-app/app/workspaces/workspaces-client.tsx"],
  "steps": [
    "1. Change grid-cols-1 md:grid-cols-2 to grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    "2. Add gap-6 instead of gap-4 for more spacing",
    "3. Update card min-width from 280px to 320px"
  ],
  "complexity": "low",
  "dependencies": []
}
```

**Bad plan:**
```json
{
  "summary": "Fix layout",
  "files_to_modify": ["some file"],
  "steps": ["Make it look like Figma"],
  "complexity": "low",
  "dependencies": []
}
```

## Verification

Before marking complete, verify:
- [ ] You authenticated into the app before taking screenshots
- [ ] Screenshots captured for both Figma and app
- [ ] Screenshots show specific elements, not full pages (unless layout diff)
- [ ] Pointers include valid URLs and paths
- [ ] Implementation plan has specific, actionable steps
- [ ] Complexity is accurately assessed
- [ ] Status updated in manifest.json

## Don't

- Take ANY screenshots before authenticating into the app
- Screenshot full pages instead of specific elements (unless it's a layout diff)
- Export Figma page frames when you need a specific component node
- Create implementation plans without both Figma and app screenshots
- Write vague plans like "make it look like Figma"
