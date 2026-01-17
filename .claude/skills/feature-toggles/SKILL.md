---
name: feature-toggles
description: Guide for implementing feature toggles. Triggered by "add feature toggle", "gate this feature", "toggle for", or when discussing gradual rollouts.
---

# Feature Toggles

Three types of feature toggles for different use cases.

## Toggle Types

| Type | Storage | Scope | SSR | Use Case |
|------|---------|-------|-----|----------|
| **localStorage** | Browser `feature_flags` key | Per-browser, client-only | No | API request flags, user opt-in |
| **Cookie** | Individual cookies | Per-browser | Yes | UI toggles (avoids hydration flash) |
| **Database** | `feature_toggles` table | System-wide | Yes | Instant rollback, admin-controlled |

## ⚠️ CRITICAL: Hydration Safety

**NEVER mix localStorage and cookie flags for the same feature.**

If a feature flag affects:

* **Layout, styles, or component selection** → MUST use Cookie or Database
* **Only API parameters or analytics** → Can use localStorage

**Why:** Server renders before client JavaScript runs. localStorage is unavailable on the server, so:

* Server sees: flag = undefined/false
* Client sees: flag = true (from localStorage)
* React detects mismatch → Hydration Error

**Example bug pattern (NEXTJS-APP-1):**
```tsx
// layout.tsx - WRONG: reads localStorage during hydration
const script = `
  if (localStorage.getItem('flag')) {
    document.documentElement.setAttribute('data-flag', 'true');
  }
`;
// But the toggle system uses cookies!
// Server renders without attribute, client adds it → hydration error
```

**Correct pattern:**
```tsx
// layout.tsx - reads cookie (available to server)
const script = `
  if (document.cookie.includes('flag=true')) {
    document.documentElement.setAttribute('data-flag', 'true');
  }
`;
// Server and client both read from cookie → no mismatch
```

### When to Use Each

| Scenario | Type |
|----------|------|
| User opts into experimental feature | localStorage |
| UI change that needs SSR (no flash) | Cookie |
| System-wide rollout controlled by admins | Database |
| Middleware/server-side gating | Database or Cookie |
| Feature passed to Python backend | localStorage (via request) |

## 1. localStorage Toggles

Per-user flags stored in browser, passed to backend in API requests.

### Files
- `nextjs-app/lib/feature-flags.ts` - Client utilities
- `nextjs-app/app/toggles/toggles-client.tsx` - UI component

### Usage

```typescript
// nextjs-app/lib/feature-flags.ts
import { getEnabledFlags, toggleFeature, isFeatureEnabled } from "@/lib/feature-flags"

// Check if enabled
if (isFeatureEnabled("my_feature")) { ... }

// Get all enabled flags (for API requests)
const flags = getEnabledFlags()  // string[]

// Toggle on/off
toggleFeature("my_feature", true)
toggleFeature("my_feature", false)
```

### Backend Check

```python
# Flags passed in request body
if "my_feature" in request.feature_flags:
    # New behavior
```

## 2. Cookie Toggles

SSR-friendly flags available on both server and client. No hydration mismatch.

### Files
- `nextjs-app/lib/feature-flags-cookie.ts` - Cookie utilities
- `nextjs-app/lib/feature-flags-server.ts` - Server-side readers

### Usage

```typescript
// Client-side
import { getFeatureFlagFromCookie, setFeatureFlagCookie } from "@/lib/feature-flags-cookie"

setFeatureFlagCookie("my-flag", true)
const enabled = getFeatureFlagFromCookie("my-flag")

// Server-side (Server Components, middleware)
import { cookies } from "next/headers"

const cookieStore = await cookies()
const enabled = cookieStore.get("my-flag")?.value === "true"
```

### Example: newUI Toggle

```typescript
// newUI toggle (effi-new-ui cookie)
import { isNewUIEnabled, toggleNewUI } from "@/lib/feature-flags-cookie"
import { isNewUIEnabledServer } from "@/lib/feature-flags-server"

// Client-side
const newUI = isNewUIEnabled();
toggleNewUI(true);

// Server-side
const newUI = await isNewUIEnabledServer();
className={newUI ? "newui-style" : "old-style"}
```

## 3. Database Toggles

System-wide toggles stored in `feature_toggles` table. Admin-controlled via `/toggles` page.

### Files
- `nextjs-app/lib/feature-toggles-server.ts` - Server check
- `nextjs-app/app/actions/feature-toggles.ts` - CRUD actions
- `supabase/migrations/20251222000001_feature_toggles.sql` - Schema

### Schema

```sql
CREATE TABLE feature_toggles (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
);
```

### Usage

```typescript
// Server-side only
import { isFeatureEnabled } from "@/lib/feature-toggles-server"

if (await isFeatureEnabled("my_feature")) {
    // New behavior
}
```

### Adding a New Toggle

```sql
-- In a migration or directly in DB
INSERT INTO feature_toggles (name, enabled, description) VALUES
  ('my_feature', false, 'Description of what this toggles');
```

Admins can then enable/disable via `/toggles` page.

## Placement Principle

**Place toggles at the highest-level entry point possible.**

| Good | Bad |
|------|-----|
| Check toggle in API route handler | Scatter checks throughout service layer |
| Check in service method entry point | Check deep inside helper functions |
| Single toggle controls entire feature | Multiple toggles for one feature |

```python
# GOOD: Toggle at entry point
async def handle_chat_request(request: ChatRequest):
    if "new_feature" in request.feature_flags:
        return await new_chat_flow(request)
    return await existing_chat_flow(request)

# BAD: Toggle scattered in implementation
async def process_message(msg):
    if "new_feature" in flags:  # Don't do this
        # ...
```

## When to Use Toggles

| Use toggle | Don't need toggle |
|------------|-------------------|
| Risky behavior change | Additive feature (new route/page) |
| Gradual rollout needed | Bug fix |
| Easy rollback required | Refactoring (same behavior) |
| A/B testing | Database migration (use migration strategy) |

## Related

- `/toggles` page for toggle management
- Current DB toggles: `terms_acceptance_required`
