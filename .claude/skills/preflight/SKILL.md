---
name: preflight
description: Run pre-deployment preflight checks before pushing to staging or production. Triggered by "/preflight", "preflight check", "ready to push to staging?", "can we deploy?", "verify before pushing", or "check before promoting".
---

# Preflight

Run pre-deployment checks and diagnose any blockers before pushing to staging or production.

## When to Use

- User says "/preflight"
- User asks about pushing to staging or production
- User asks "are we ready to deploy?"
- User mentions verifying, checking, or validating before a promotion
- Before any `git push` to staging or production

## Steps

### 1. Run preflight

```bash
preflight
```

This checks CI status, Railway deployments, Supabase migration drift, and commit drift across branches. Read the full output.

### 2. If CI failures exist, diagnose them

```bash
ci-logs --failed --failures-only
```

After fetching logs, summarize:
- **What failed** — which test(s), what error
- **Is it related to pending changes?** — compare the failure against the commits waiting to deploy
- **Is it pre-existing?** — did this test fail before the pending changes were added?

### 3. Present findings

Report to the user:
- **GO / NO-GO** — from preflight's own verdict
- **Pending migrations** — count and whether they've reached the target branch
- **CI failures** — what broke and whether it's blocking or pre-existing
- **Commit drift** — how many commits are waiting, brief summary of what's in them
- **Next steps** — concrete actions to resolve any blockers

Keep it concise. The user can ask for details on anything.
