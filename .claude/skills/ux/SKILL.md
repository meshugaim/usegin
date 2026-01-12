---
name: ux
description: Build UX enhancements under the newUX toggle. Manages work against Linear (ENG-945). Triggered by "/ux" or UX implementation requests.
---

# UX Development

Build enhanced UX under the `newUX` toggle, tracked in Linear.

---

## Feature Toggle Reference

Three types of feature toggles for different use cases.

### Toggle Types

| Type | Storage | Scope | SSR | Use Case |
|------|---------|-------|-----|----------|
| **localStorage** | Browser `feature_flags` key | Per-browser, client-only | No | API request flags, user opt-in |
| **Cookie** | Individual cookies | Per-browser | Yes | UI toggles (avoids hydration flash) |
| **Database** | `feature_toggles` table | System-wide | Yes | Instant rollback, admin-controlled |

### ⚠️ CRITICAL: Hydration Safety

**NEVER mix localStorage and cookie flags for the same feature.**

If a feature flag affects:

* **Layout, styles, or component selection** → MUST use Cookie or Database
* **Only API parameters or analytics** → Can use localStorage

**Why:** Server renders before client JavaScript runs. localStorage is unavailable on the server, so:

* Server sees: flag = undefined/false
* Client sees: flag = true (from localStorage)
* React detects mismatch → Hydration Error

### Cookie Toggles (for UX work)

SSR-friendly flags available on both server and client. No hydration mismatch.

**Files:**
- `nextjs-app/lib/feature-flags-cookie.ts` - Cookie utilities
- `nextjs-app/lib/feature-flags-server.ts` - Server-side readers

**Client-side:**
```typescript
import { getFeatureFlagFromCookie, setFeatureFlagCookie } from "@/lib/feature-flags-cookie"

setFeatureFlagCookie("my-flag", true)
const enabled = getFeatureFlagFromCookie("my-flag")
```

**Server-side (Server Components, middleware):**
```typescript
import { cookies } from "next/headers"

const cookieStore = await cookies()
const enabled = cookieStore.get("my-flag")?.value === "true"
```

### Layered Toggles (newUI → newUX)

```typescript
// newUI toggle (effi-new-ui cookie)
import { isNewUIEnabled, toggleNewUI } from "@/lib/feature-flags-cookie"
import { isNewUIEnabledServer } from "@/lib/feature-flags-server"

// newUX toggle (effi-new-ux cookie) - layered on newUI
import { isNewUXEnabled, toggleNewUX } from "@/lib/feature-flags-cookie"
import { isNewUXEnabledServer } from "@/lib/feature-flags-server"
```

**Layered dependency:** Enabling newUX auto-enables newUI. Disabling newUI auto-disables newUX.

### Placement Principle

**Place toggles at the highest-level entry point possible.**

| Good | Bad |
|------|-----|
| Check toggle in page.tsx | Scatter checks throughout components |
| Single toggle controls entire feature | Multiple toggles for one feature |

---

## First: Orient on Linear

Check current UX work status:

```bash
plan show 945 --tree
```

**Issue structure:**
- **ENG-945** - ux: design implementation (parent)
  - **ENG-880** - current work (active implementation)
  - **ENG-881** - backlog (queued)
  - **ENG-882** - future (later)

Then ask the user: **"What do you want to implement?"**

## Linear Management

Autonomously manage issues as you work:

### Starting work
```bash
plan start <id>                    # Mark in progress, assign to you
```

### Creating issues
```bash
# Current work
plan create "ux: <title>" --parent 880 --label feature --description "<desc>"

# Backlog
plan create "ux: <title>" --parent 881 --label feature --description "<desc>"

# Future
plan create "ux: <title>" --parent 882 --label feature --description "<desc>"
```

### Completing work
```bash
plan close <id>                    # When done
```

### Deferring work
```bash
plan update <id> --parent 881      # Move to backlog
plan update <id> --parent 882      # Move to future
```

## Toggle System

All work goes under the `newUX` cookie toggle (layered on `newUI`):

```typescript
import { isNewUIEnabledServer, isNewUXEnabledServer } from "@/lib/feature-flags-server";

const newUI = await isNewUIEnabledServer();
const newUX = await isNewUXEnabledServer();

// Three-way conditional
className={newUX ? "newux-style" : newUI ? "newui-style" : "old-style"}
```

Enable at `/toggles` or via cookie `effi-new-ux=true`.

## Reference Sources

### 1. figma-design-oria branch (reference only, NEVER MERGE)

```bash
# See what's different
git diff --stat main..origin/figma-design-oria -- nextjs-app/

# View specific file
git show origin/figma-design-oria:nextjs-app/path/to/file.tsx
```

### 2. Figma designs

Use `mcp__figma-personal__*` tools with page mapping:

```bash
cat tools/figma/page-mapping.json
```

**File key:** `A0DV8pRwHWgs9EF07sVYxG`

| Concept | Figma frames | App routes |
|---------|--------------|------------|
| workspace_view | Active projects overview | /projects |
| project_chat | Single project view | /projects/[id]/chat |
| project_settings | Project Summary | /projects/[id]/settings |

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

## Workflow

1. **Orient** - `plan show 945 --tree` to see current state
2. **Ask** - What does the user want to implement?
3. **Track** - Create or start an issue in Linear
4. **Reference** - Check branch and/or Figma for design
5. **Build** - Implement under `newUX` toggle
6. **Complete** - Close the Linear issue

## Rules

- **NEVER merge figma-design-oria** - reference only
- All styling changes gated by `newUX` flag
- Don't break existing `newUI` behavior
- Keep Linear updated as you work
