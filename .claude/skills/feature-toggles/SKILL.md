---
name: feature-toggles
description: Guide for implementing feature toggles. Triggered by "add feature toggle", "gate this feature", "toggle for", or when discussing gradual rollouts.
---

# Feature Toggles

## Why Toggles

Feature toggles enable **trunk-based development**:

- Everyone pushes to main
- Main is always ready for production
- Incomplete features integrate continuously while hidden from users

**Deploy != Release.** Code can ship to production before users see it. Toggles separate the act of deploying code from the decision to release a feature.

## The Rule

**Check the toggle only at the feature's entry point.**

Don't scatter toggle checks through the code. A single check at the entry point is sufficient - code can exist and be executable as long as the entry point is hidden from users.

If no clean entry point exists, refactor to create one. This is often a sign of good architectural hygiene anyway.

## Two Backends

Toggles and flags mean the same thing. Two storage options:

| Type | Scope | Location |
|------|-------|----------|
| **Browser flags** | Per-user | Cookies (`nextjs-app/lib/browser-flags/`) |
| **DB toggles** | System-wide | `feature_toggles` table |

**Prefer browser flags.** They're simpler, don't require migrations, and let developers test features individually before global rollout. Use DB toggles only when you need system-wide control independent of user sessions.

Browser flags can be passed to Python backend via REST headers using `backendFlag` configuration.

## Adding a Toggle

**Browser flag:** Add entry to registry at `nextjs-app/lib/browser-flags/registry.ts`. The system auto-wires UI, testing, and server/client access. Include the `checkedBy` array with the file path(s) that will check this flag (relative to `nextjs-app/`, excluding tests).

Always use the generic check functions — `isFlagEnabled("x")` (client) or `isFlagEnabledServer("x")` (server). Never create named wrappers like `isXxxEnabled()`.

**DB toggle:** Always use a migration:

```sql
INSERT INTO feature_toggles (name, enabled, description)
VALUES ('my_feature', false, 'Description');
```

Never insert directly into the database - migrations ensure toggles exist across all environments.

## Retiring Toggles

Toggles are temporary. Once a feature is proven stable in production, retire the toggle.

See the **remove-toggles** skill (`/remove-toggles`) for the complete removal process — checklists per toggle type, removal order, migration patterns, and the Mikado method for large removals.

Leaving stale toggles creates confusion and technical debt.
