---
name: feature-toggles
description: Guide for implementing feature toggles. Triggered by "add feature toggle", "gate this feature", "toggle for", or when discussing gradual rollouts.
---

# Feature Toggles

User-scoped feature toggle system using localStorage. Allows gradual rollout and easy rollback of experimental features.

## Architecture

### Frontend (localStorage)
- Storage key: `feature_flags` (JSON array of enabled flag names)
- UI: Hidden page at `/toggles` with toggle switches
- API: Flags included in chat requests as `feature_flags: string[]`

### Backend
- Request models accept `feature_flags: list[str] = []`
- Services check for specific flags before enabling new behavior

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
    result = transform(msg)
    if "new_feature" in flags:  # Or this
        # ...
```

## Adding a New Toggle

### 1. Define the flag

```typescript
// nextjs-app/app/toggles/page.tsx
const AVAILABLE_FLAGS = [
    {
        name: "my_feature",
        label: "My Feature",
        description: "Description shown to users",
    },
    // ... existing flags
] as const
```

### 2. Check flag in backend

```python
# At the highest appropriate entry point
if "my_feature" in request.feature_flags:
    # New behavior
else:
    # Existing behavior
```

### 3. Test both paths

Ensure tests cover both flag enabled and disabled states.

## Utilities

```typescript
// nextjs-app/lib/feature-flags.ts
import { getEnabledFlags, toggleFeature, clearAllFlags } from "@/lib/feature-flags"

// Get currently enabled flags
const flags = getEnabledFlags()  // string[]

// Toggle a specific flag
toggleFeature("my_feature", true)   // enable
toggleFeature("my_feature", false)  // disable

// Clear all flags
clearAllFlags()
```

## When to Use Toggles

| Use toggle | Don't need toggle |
|------------|-------------------|
| Risky behavior change | Additive feature (new route/page) |
| Gradual rollout needed | Bug fix |
| Easy rollback required | Refactoring (same behavior) |
| A/B testing | Database migration (use migration strategy) |

## Related

- ENG-483: Feature toggle system implementation
- `/toggles` page for user self-service
