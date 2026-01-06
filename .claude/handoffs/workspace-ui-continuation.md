# Handoff: Workspace New UI - Continuation

## Context

We refactored the external LLM's workspace UI implementation to follow our patterns:
- Feature toggle aware (`newUI === true` only)
- Uses Effi design tokens
- Restored legacy code path for `newUI === false`

**Files modified:**
- `app/workspaces/[workspaceId]/layout.tsx` - conditionally applies sidebar
- `app/workspaces/[workspaceId]/workspace-detail-client.tsx` - split into `NewUIContent` / `LegacyUIContent`
- `components/workspace-sidebar.tsx` - fixed hardcoded values, added settings/signout

**Full context:** See `.claude/handoffs/workspace-ui-refactor.md`

---

## Remaining Tasks

### 1. Add "Back to Workspaces" in new UI

**Problem:** The new UI main content area has no way to navigate back to `/workspaces`.

**Location:** `app/workspaces/[workspaceId]/workspace-detail-client.tsx` → `NewUIContent` component

**Requirement:** Add a back link/button in the **top right corner** of the main content area (not sidebar). Should link to `/workspaces`.

**Reference:** The legacy UI has this in the header:
```tsx
<Link href="/workspaces" className="flex items-center gap-1 ...">
  <ArrowLeft className="h-4 w-4" />
  <span className="text-sm">Back</span>
</Link>
```

Style with Effi tokens (`text-effi-gray-text`, `hover:text-effi-deep-denim`, `font-effi`).

---

### 2. Fix missing logo icon in collapsed sidebar

**Problem:** When sidebar is collapsed, the logo icon should still be visible. Currently it's hidden.

**Location:** `components/workspace-sidebar.tsx` → Header section (lines ~52-82)

**Current behavior:** When `isCollapsed === true`, the entire logo Link is hidden:
```tsx
<Link ... className={cn("...", isCollapsed ? "hidden" : "")}>
```

**Expected:** Logo icon should remain visible when collapsed, just without the "AskEffi" text. Similar to how other collapsed items show just the icon.

**Fix approach:** Don't hide the entire Link when collapsed. Instead, only hide the text span.

---

## Rules Reminder

- Only modify `newUI === true` code paths
- Don't touch legacy UI
- Use existing Effi tokens and patterns
- No commits (per user request)
