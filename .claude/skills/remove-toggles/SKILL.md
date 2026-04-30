---
name: remove-toggles
description: Remove feature toggles when a feature is proven stable. Triggered by "remove toggle", "retire toggle", "remove feature flag", "remove browser flag", "make always on", or "roll out feature".
---

# Removing Feature Toggles

Toggles are temporary. This skill covers the complete removal process once a feature is proven stable.

## Toggle Types

Three types are in scope for this skill:

| Type | Scope | Location | Gate |
|------|-------|----------|------|
| **Browser flags** | Per-user (cookie) | `nextjs-app/lib/browser-flags/registry.ts` | Temporary UI/feature scaffolding |
| **Chat tools** | Per-user (cookie) | `nextjs-app/lib/chat-config/registry.ts` | Which tools the chat agent can use |
| **DB toggles** | System-wide | `feature_toggles` table + `python-services/agent_api/feature_toggles/registry.py` | Backend behavior |

Out of scope (not feature toggles): config-column booleans on entity tables (`workspaces.risk_enabled`, etc.), admin system config (`chat_config` K-V), role gates (`admins`).

## Step 0: Inventory and decide

Before editing anything, list every toggle and ask the user per-entry whether to remove it (make always-on) or keep it. Don't act on a single toggle in isolation when the user says "remove toggles" generically — do the inventory pass first.

**Inventory all three registries:**

```bash
grep -E "^\s+[a-zA-Z]+: \{" nextjs-app/lib/browser-flags/registry.ts | sed 's/^[[:space:]]*//;s/: {.*$//'
grep -E "^\s+[a-zA-Z]+: \{" nextjs-app/lib/chat-config/registry.ts | sed 's/^[[:space:]]*//;s/: {.*$//'
grep -E '^\s+"[a-zA-Z_]+": DbToggle' python-services/agent_api/feature_toggles/registry.py | sed 's/^[[:space:]]*//;s/": .*$//;s/^"//'
```

Then call `AskUserQuestion` with one question per unique toggle name. Options: `Remove (always on)` / `Keep as toggle` / `Skip / decide later`. Include a one-line description (what the toggle gates) so the user can decide without reading the registry.

**Duplicates:** a name can appear in both browser flags and chat tools (e.g., `earlyToolUse`, `fathomBrowse`). Ask once; on "Remove", delete from both registries in the same change. Treat the chat-config entry as the permanent home.

**Then for each "Remove" decision:** create a Linear sub-issue under a parent `chore: toggle removal pass YYYY-MM-DD`, and execute the per-type checklist below in a `/worktree-to-main` worktree (one worktree per toggle, one push to main per toggle). Keep "Keep" decisions out of the issue tree — don't track non-actions.

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
- **Chat tools:** No migration needed (cookie-based).
- **DB toggles:** `DELETE FROM feature_toggles WHERE name = '...';` with a comment explaining stability evidence.

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

### Removing a chat tool

A chat tool is being decommissioned (the tool itself goes away), not just always-on'd. If the same name also exists in browser-flags, remove the browser-flag entry too.

- [ ] Remove entry from `nextjs-app/lib/chat-config/registry.ts`
- [ ] Remove the cookie usage and any `isToolEnabled`/`isToolEnabledServer`/`getBackendFlags` call sites
- [ ] If it had `backendFlag`: remove the matching check in `python-services/agent_api`
- [ ] Remove the tool's switch from `nextjs-app/app/admin/chat/admin-chat-client.tsx` (driven by the registry, so deleting the entry is usually enough)
- [ ] Update tests
- [ ] If the same name exists in `lib/browser-flags/registry.ts`: remove it there too (follow the browser-flag checklist)

### Removing a DB toggle

- [ ] Remove `is_feature_enabled('xxx')` checks from Python code
- [ ] Remove `isFeatureEnabled('xxx')` checks from TypeScript code
- [ ] Remove entry from `python-services/agent_api/feature_toggles/registry.py` (the lint test fails otherwise)
- [ ] Remove toggle constant from `feature-toggles-server.ts` if defined there
- [ ] Update tests in both Python and TypeScript
- [ ] Migration: `DELETE FROM feature_toggles WHERE name = 'xxx';`
- [ ] Remove from `seed.sql`
- [ ] Migration comment should explain why it is safe (stability evidence)

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
