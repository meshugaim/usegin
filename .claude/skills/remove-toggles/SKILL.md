---
name: remove-toggles
description: Remove feature toggles when a feature is proven stable. Triggered by "remove toggle", "retire toggle", "remove feature flag", "remove browser flag", "make always on", or "roll out feature".
---

# Removing Feature Toggles

Toggles are temporary. This skill covers the complete removal process once a feature is proven stable.

## Toggle Types

Three types exist in this project:

| Type | Scope | Location | Gate |
|------|-------|----------|------|
| **Browser flags** | Per-user | Cookies, `nextjs-app/lib/browser-flags/registry.ts` | UI visibility |
| **DB toggles** | System-wide | `feature_toggles` table rows | Backend behavior |
| **Config-column toggles** | Per-entity | Boolean columns on config tables (e.g., `project_email_allowlist_config.enabled`) | Per-entity behavior |

## Prerequisites

Before removing a toggle, confirm:

- **Production stability** -- the feature has been running in production long enough to trust. Cite metrics if available (e.g., "41 syncs, 0 failures over 3 weeks").
- **No rollback scenario** -- there is no anticipated need to disable the feature again.
- **Linear issue** -- the removal is tracked as a Linear issue with the `chore` label.

## Removal Order

Work bottom-up. Each layer is a separate commit. This order is established by 7 completed removals (`content_sync_v2`, `admin_chat_page`, `email_integration`, `workspace_tiers_enabled`, `clientPool`, `projectSummary`, `session_expired_handling`).

### 1. Frontend code

Remove conditional checks. Make behavior unconditional. Delete dead branches (the "off" path).

### 2. Backend code

Same approach in Python services and API routes. Remove `is_feature_enabled()` calls, remove header-based flag checks.

### 3. Tests

- Update tests that checked toggle paths.
- Delete tests for the removed behavior path.
- Update test mocks -- especially `nextjs-app/tests/setup.ts` for browser flags and any `globalThis.__mockBrowserFlags` usage.

### 4. DB migration

The cleanup step. Depends on toggle type:

- **Browser flags:** No migration needed.
- **DB toggles:** `DELETE FROM feature_toggles WHERE name = '...';` with a comment explaining stability evidence.
- **Config columns:** `ALTER TABLE ... DROP COLUMN ...;` or `DROP TABLE` if the table is now empty.
- **Config-column toggles checked by SQL functions:** Update the function with `CREATE OR REPLACE FUNCTION` in the same migration to remove the conditional logic.

Create migrations with `bunx supabase migration new <name>`. Never create migration files manually.

### 5. Seed data

Remove toggle setup from `supabase/seed.sql` if present.

### 6. Docs and skills

Update any skill files, specs, or docs that reference the toggle.

## Per-Type Checklists

### Removing a browser flag

Start with `checkedBy` in the registry — it lists every non-test file that checks this flag. That's your removal checklist.

- [ ] For each file in `checkedBy`: remove the `isFlagEnabled`/`isFlagEnabledServer` call, make behavior unconditional, delete the dead branch
- [ ] Remove entry from `nextjs-app/lib/browser-flags/registry.ts`
- [ ] Update/remove tests that set `globalThis.__mockBrowserFlags.xxx`
- [ ] If flag had `backendFlag` config: remove header passing and backend flag checks

### Removing a DB toggle

- [ ] Remove `is_feature_enabled('xxx')` checks from Python code
- [ ] Remove `isFeatureEnabled('xxx')` checks from TypeScript code
- [ ] Remove toggle constant from `feature-toggles-server.ts` if defined there
- [ ] Update tests in both Python and TypeScript
- [ ] Migration: `DELETE FROM feature_toggles WHERE name = 'xxx';`
- [ ] Remove from `seed.sql`
- [ ] Migration comment should explain why it is safe (stability evidence)

### Removing a config-column toggle

- [ ] Update SQL function(s) that read the column -- remove the conditional, make behavior unconditional
- [ ] Remove service functions for reading/writing the toggle (e.g., `setAllowlistEnabled`)
- [ ] Remove server actions that wrap those service functions
- [ ] Remove UI components (switches, toggles) for the column
- [ ] Update tests at all layers (integration, unit, component)
- [ ] Migration: `ALTER TABLE ... DROP COLUMN ...;` (or `DROP TABLE` if table becomes empty)
- [ ] If dropping a table: also drop associated RLS policies, triggers, indexes (CASCADE handles most)

## Commit Messages

Each commit should explain the "why":

```
chore: remove xxx toggle from frontend

The xxx feature has been stable in production since [date].
[Evidence: N operations, 0 failures / all users migrated / etc.]

Part of: ENG-XXX
```

## Large Removals (Mikado Method)

For toggles touching 10+ files, use the Mikado method (see `/mikado` skill):

1. Create a dependency graph in `docs/mikado/ENG-XXX.md`.
2. Work leaves-first: components -> pages -> layouts -> infrastructure -> docs.
3. For each removal site: hardcode `true` -> run tests -> delete dead code -> run tests -> remove condition -> commit.
4. Risk-assess each site (FULL / INDIRECT / NONE coverage).
5. See `docs/mikado/ENG-1140.md` for the canonical example (newUI/newUX removal, ~40 files).

## Anti-patterns

- **Stale toggles** -- don't leave them. They create confusion and tech debt.
- **No production evidence** -- don't remove a toggle without stability data.
- **Mixed concerns** -- don't combine toggle removal with feature work in the same commits.
- **Skipping migration** -- orphaned DB rows/columns drift across environments. Always clean up the database.
