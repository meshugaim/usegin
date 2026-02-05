---
name: feature-toggles
description: Guide for implementing feature toggles. Triggered by "add feature toggle", "gate this feature", "toggle for", or when discussing gradual rollouts.
---

# Feature Toggles

Two types of feature toggles for different use cases.

## Toggle Types

| Type | Storage | Scope | SSR | Use Case |
|------|---------|-------|-----|----------|
| **Browser Flags** | Individual cookies | Per-browser | Yes | UI toggles (avoids hydration flash) |
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
| UI change that needs SSR (no flash) | Browser Flag |
| Feature passed to Python backend | Browser Flag (with `backendFlag`) |
| System-wide rollout controlled by admins | Database |
| Middleware/server-side gating | Database or Browser Flag |

## 1. Browser Flags

SSR-friendly flags stored in cookies, available on both server and client. No hydration mismatch.

### Single File: The Registry

All browser flags are defined in **one file**: `nextjs-app/lib/browser-flags/registry.ts`

```typescript
export const BROWSER_FLAGS = {
  clientPool: {
    cookie: "effi-clientPool",
    label: "Client Pool",
    description: "Enable client pool for conversation management",
    backendFlag: "clientPool",  // Optional: pass to Python backend
  },
  preciseTime: {
    cookie: "effi-precise-time",
    label: "Precise Time",
    description: "Show precise timestamps instead of relative time",
  },
  emailIntegration: {
    cookie: "effi-email-integration",
    label: "Email Integration",
    description: "Enable email integration features",
  },
} as const satisfies Record<string, BrowserFlagConfig>;
```

### Adding a New Browser Flag

**One step** - add an entry to `BROWSER_FLAGS` in the registry:

```typescript
// In nextjs-app/lib/browser-flags/registry.ts
export const BROWSER_FLAGS = {
  // ... existing flags ...
  myNewFlag: {
    cookie: "effi-my-new-flag",
    label: "My New Flag",
    description: "What this flag does",
    backendFlag: "myNewFlag",  // Optional: if backend needs it
  },
} as const satisfies Record<string, BrowserFlagConfig>;
```

That's it! The flag is automatically:
- Available in the `/toggles` UI
- Testable via `globalThis.__mockBrowserFlags.myNewFlag`
- Usable via the generic or named functions

### Usage

```typescript
// Client-side - generic API
import { isFlagEnabled, toggleFlag } from "@/lib/browser-flags";

if (isFlagEnabled("preciseTime")) { ... }
toggleFlag("preciseTime", true);

// Client-side - named wrappers (for common flags)
import { isPreciseTimeEnabled, togglePreciseTime } from "@/lib/browser-flags";

if (isPreciseTimeEnabled()) { ... }
togglePreciseTime(true);

// Server-side (Server Components, Server Actions)
import { isFlagEnabledServer, getAllFlagsServer } from "@/lib/browser-flags";

const isEnabled = await isFlagEnabledServer("emailIntegration");
const allFlags = await getAllFlagsServer();

// Server-side - named wrappers
import { isEmailIntegrationEnabledServer } from "@/lib/browser-flags";

if (await isEmailIntegrationEnabledServer()) { ... }
```

### Backend Flags

Flags with `backendFlag` configured are automatically passed to the Python backend:

```typescript
import { getBackendFlags } from "@/lib/browser-flags";

const flags = getBackendFlags();  // ["clientPool"] if clientPool is enabled
// These are sent in the request body to Python services
```

### Module Structure

- `nextjs-app/lib/browser-flags/registry.ts` - Flag definitions (single source of truth)
- `nextjs-app/lib/browser-flags/client.ts` - Client-side functions
- `nextjs-app/lib/browser-flags/server.ts` - Server-side functions
- `nextjs-app/lib/browser-flags/index.ts` - Re-exports everything

Import from `@/lib/browser-flags` for the cleanest API.

## 2. Database Toggles

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

## Testing

Browser flags are automatically mocked in unit tests via `tests/setup.ts`:

```typescript
// In your test file, override specific flags:
beforeEach(() => {
  globalThis.__mockBrowserFlags.emailIntegration = true;
});

// All flags default to false
// No need to add per-flag mock setup when adding new flags
```

## Related

- `/toggles` page for toggle management
- Current browser flags: `clientPool`, `preciseTime`, `emailIntegration`
- Current DB toggles: `terms_acceptance_required`
