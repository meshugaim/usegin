# Handoff: Workspace New UI Implementation

## Context

An external LLM created new UI components for `/workspaces/[workspaceId]` based on Figma designs. The implementation works visually but:
- Ignores existing component patterns
- Doesn't respect the feature toggle system
- Created custom components instead of using existing ones
- Has hardcoded values and missing functionality

**Goal**: Rebuild the design using our patterns, only affecting the `newUI === true` code path.

---

## Scope

### IN SCOPE (implement new design here):
- `/workspaces` - workspace list
- `/workspaces/[workspaceId]` - workspace detail with sidebar
- `/workspaces/[workspaceId]/settings` - workspace settings

### OUT OF SCOPE (do not touch):
- `/projects/*` routes - these are separate
- Any `newUI === false` code paths - legacy must remain untouched

---

## Feature Toggle System

### How it works:

1. **Cookie**: `effi-new-ui` stored in browser
2. **Server reads**: `isNewUIEnabledServer()` from `@/lib/feature-flags-server`
3. **Passed to client**: `newUI` prop passed to client components
4. **User controls**: Toggle at `/toggles` page

### Key rule:
**ONLY modify code inside `newUI === true` branches. Never change the `newUI === false` paths.**

### Pattern examples:

```tsx
// Wrapper component switch
if (newUI) {
  return <NewDesignWrapper>{children}</NewDesignWrapper>;
}
return <LegacyWrapper>{children}</LegacyWrapper>;

// Conditional className
className={newUI ? "text-effi-primary" : "text-blue-600"}

// Component variants
<Button variant={newUI ? "effi" : "default"}>

// Conditional rendering
{newUI && <SidebarComponent />}

// Helper functions that branch
function getRoleBadge(role: string, newUI: boolean) {
  if (newUI) {
    return <Badge variant="effi-role">...</Badge>;
  }
  return <span className="...">...</span>;
}
```

---

## Existing Components to USE

### Use these (don't recreate):

| Component | Location | Purpose |
|-----------|----------|---------|
| `Sidebar*` components | `@/components/ui/sidebar.tsx` | Full sidebar system with mobile, context, persistence |
| `Button` | `@/components/ui/button.tsx` | Has `variant="effi"`, `variant="effi-ghost"` etc |
| `Card` | `@/components/ui/card.tsx` | Has `variant="effi"` |
| `Badge` | `@/components/ui/badge.tsx` | Has `variant="effi-role"`, `variant="effi-secondary"` |
| `ParallaxBackground` | `@/components/ui/parallax-background.tsx` | Effi background effect |
| `CreateWorkspaceProjectDialog` | `@/components/create-workspace-project-dialog.tsx` | Project creation |

### Effi design tokens:

```
Colors: text-effi-deep-denim, text-effi-gray-text, text-effi-primary, text-effi-gold
        bg-effi-background, bg-effi-card-fill, border-effi-border
Font:   font-effi
```

---

## What the External LLM Created (to replicate visually, not code-wise)

### Files created/modified:
- `components/workspace-sidebar.tsx` - Custom sidebar (227 lines)
- `components/workspace-layout-client.tsx` - Layout wrapper (43 lines)
- `app/workspaces/[workspaceId]/workspace-detail-client.tsx` - Main content
- `app/workspaces/[workspaceId]/layout.tsx` - Route layout

### Visual design to preserve:
1. **Collapsible sidebar** on left (w-64 expanded, w-20 collapsed)
2. **Logo + toggle button** in header
3. **Projects list** in sidebar with folder icons
4. **Files, Documentation, Integrations** nav items
5. **Search input** in sidebar
6. **"Connect Effi" premium banner** in sidebar
7. **User avatar + info** in sidebar footer
8. **Main content area** with:
   - Usage banner (X of 3 projects, upgrade CTA)
   - "My Active Projects" heading
   - Project cards with icons, descriptions, owner badge, menu

### Issues to fix:
- Hardcoded user name "Guy L" → use actual `userEmail`
- Dead links (`/files`, `#`) → remove or implement
- No mobile support → use existing `ui/sidebar.tsx` which has it
- No Settings/Sign-out → add back
- `UsageBanner` defined inline → extract to component
- Ignores feature toggle → wrap in `newUI` conditionals

---

## Implementation Approach

### Option A: Refactor existing custom components
Keep `workspace-sidebar.tsx` but:
- Add `newUI` prop and conditionals
- Replace hardcoded styles with Effi tokens
- Add mobile support

### Option B (Recommended): Use `ui/sidebar.tsx`
Compose the existing sidebar primitives:
```tsx
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger
} from "@/components/ui/sidebar";
```

Then style with Effi tokens when `newUI === true`.

---

## Files to Modify

1. **`app/workspaces/[workspaceId]/layout.tsx`**
   - Add `newUI` check
   - Only apply sidebar layout when `newUI === true`
   - Legacy: no sidebar, just render children

2. **`app/workspaces/[workspaceId]/page.tsx`**
   - Pass `newUI` prop correctly

3. **`app/workspaces/[workspaceId]/workspace-detail-client.tsx`**
   - Restore legacy code path for `newUI === false`
   - Keep new design for `newUI === true`
   - Fix hardcoded values
   - Extract `UsageBanner` component

4. **`components/workspace-sidebar.tsx`** (or replace)
   - Either refactor to use `ui/sidebar.tsx` primitives
   - Or add `newUI` conditionals and fix issues

5. **`components/workspace-layout-client.tsx`**
   - Add `newUI` prop
   - Only render sidebar wrapper when `newUI === true`

---

## Testing Checklist

- [ ] `/toggles` → turn OFF "New UI Design" → `/workspaces/[id]` shows legacy design
- [ ] `/toggles` → turn ON "New UI Design" → `/workspaces/[id]` shows new sidebar design
- [ ] Legacy design unchanged from before external LLM changes
- [ ] New design visually matches external LLM's implementation
- [ ] Settings link works
- [ ] Sign out works
- [ ] Mobile responsive (sidebar collapses/sheet on mobile)
- [ ] User email displays (not hardcoded "Guy L")
- [ ] Create project dialog works

---

## Reference: Legacy Design (newUI === false)

From git history (`git show 1fd4251:nextjs-app/app/workspaces/[workspaceId]/workspace-detail-client.tsx`):

- Header with back button, workspace name, role badge
- Settings button (owner only)
- User email + sign out
- Two-column grid:
  - Left: Workspace Info card (slug, members, role, created date)
  - Right: Projects card with list
- `ParallaxBackground` wrapper (was used for newUI, plain div for legacy)

---

## Do NOT

- Modify `/projects/*` routes
- Change any `newUI === false` code paths
- Create new custom components when existing ones work
- Hardcode user data
- Remove existing functionality (settings, sign-out, etc.)
- Commit or push (per user request this session)
