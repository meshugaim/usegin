---
name: ux
description: Build UX enhancements under the newUX toggle by referencing figma-design-oria branch and Figma designs.
---

# UX Development

Build enhanced UX under the `newUX` toggle by referencing the `figma-design-oria` branch and Figma designs.

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

The `figma-design-oria` branch has UI implementations to reference:

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
| Screenshots | `docs/figma_ss/` |

## Figma Reference

Use `mcp__figma-personal__*` tools with the page mapping:

```bash
cat tools/figma/page-mapping.json
```

**File key:** `A0DV8pRwHWgs9EF07sVYxG` (personal)

### Key concepts in mapping

| Concept | Figma frames | App routes |
|---------|--------------|------------|
| workspace_view | Active projects overview | /projects |
| project_chat | Single project view | /projects/[id]/chat |
| project_settings | Project Summary | /projects/[id]/settings |

## Workflow

1. **Identify what to build** - Check `figma-design-oria` branch for implementations
2. **Reference Figma** - Use page-mapping.json to find relevant frames
3. **Build under newUX** - All styling changes gated by `newUX` flag
4. **Test both states** - Verify toggle on/off behavior

## Implementation Pattern

```tsx
// In page.tsx
import { isNewUIEnabledServer, isNewUXEnabledServer } from "@/lib/feature-flags-server";

export default async function Page() {
  const newUI = await isNewUIEnabledServer();
  const newUX = await isNewUXEnabledServer();

  return (
    <div className={newUX ? "enhanced-layout" : newUI ? "effi-layout" : "legacy-layout"}>
      <Component newUI={newUI} newUX={newUX} />
    </div>
  );
}
```

## Don't

- Modify non-toggled code paths
- Break existing `newUI` behavior
- Copy files wholesale - adapt patterns to work with toggles
