---
description: Build UX enhancements under newUX toggle
---

# UX Development Mode

Build enhanced UX under the `newUX` toggle by referencing `figma-design-oria` branch and Figma designs.

## Toggle System

All work goes under the `newUX` cookie toggle (layered on `newUI`):

```typescript
const newUI = await isNewUIEnabledServer();
const newUX = await isNewUXEnabledServer();

// Three-way conditional
className={newUX ? "newux-style" : newUI ? "newui-style" : "old-style"}
```

Enable at `/toggles` or via cookie `effi-new-ux=true`.

## Reference Branch

```bash
# See what changed
git diff --stat main..origin/figma-design-oria

# View specific file
git show origin/figma-design-oria:nextjs-app/path/to/file.tsx
```

### Key files on figma-design-oria

| Area | Files |
|------|-------|
| Layouts | `app/projects/[projectId]/layout.tsx`, `app/workspaces/[workspaceId]/layout.tsx` |
| Project views | `app/projects/[projectId]/page.tsx`, `project-home-client.tsx` |
| Files page | `app/projects/[projectId]/files/page.tsx`, `project-files-client.tsx` |
| Chat | `app/projects/[projectId]/chat/page.tsx` |
| Settings | `app/projects/[projectId]/settings/page.tsx` |

## Figma Reference

Use `mcp__figma-personal__*` tools. File key: `A0DV8pRwHWgs9EF07sVYxG`

Page mapping: `tools/figma/page-mapping.json`

## What to build?
