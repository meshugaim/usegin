---
name: deploy
description: Pre-deployment checklist for pushing to production. Triggered by "let's deploy", "deploy to production", "deploy checklist", or "ready to deploy?".
---

# Deploy to Production

Interactive pre-deployment checklist. Gather information, present status clearly, and make a thoughtful decision together with the user.

**Trigger:** "let's deploy", "deploy to production", "deploy checklist", "ready to deploy?"

## Architecture

| Service | Deployment Method |
|---------|-------------------|
| Railway (Next.js + Python) | GitHub integration - push to `main` triggers staging + production |
| Supabase | GitHub integration - migrations applied via `supabase db push` |

**Key insight:** Pushing to `main` deploys to BOTH staging and production on Railway.

## Pre-Deployment Checklist

Run these checks and present a clear summary before any deploy action.

### 1. Git Status

```bash
# Current state
git status
git branch --show-current
git log --oneline -5

# Sync status with remote
git fetch origin
git status -sb
```

**Check for:**
- Uncommitted changes
- Unpushed commits
- Current branch (should be `main`)

### 2. Recent Commits Summary

```bash
# What's being deployed (commits not yet in production)
git log origin/main --oneline -10
```

Present a summary of what changes will be deployed.

### 3. GitHub Actions Status

Use `gh` CLI to check workflow status:

```bash
# Recent workflow runs on main
gh run list --branch main --limit 10

# If any failed, show details
gh run view <run-id>
```

**Key workflows to check:**
- `nextjs-build.yml` - Next.js builds successfully
- `nextjs-unit-tests.yml` - Unit tests pass
- `python-unit-tests.yml` - Python tests pass
- `e2e-tests.yml` - E2E tests pass (if applicable)

### 4. Railway Status

Use Railway MCP or CLI:

```bash
# Check current deployment status
bun railway status

# Recent deployments
bun railway deployment list --limit 5
```

**Check for:**
- Any failed deployments
- Current deployment status
- Pending builds

### 5. Supabase Migrations

Check if there are pending migrations:

```bash
# List local migrations
bunx supabase migration list

# Compare with production (dry run)
bunx supabase db push --dry-run --db-url "postgresql://postgres.becbrfnfxrgezhtkrsrm:$SUPABASE_DB_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

**Note:** Supabase migrations must be pushed separately using the `pushing-db-migrations-to-production` skill.

## Presenting the Summary

After gathering all information, present a clear status report:

```markdown
## Deploy Readiness Report

### Git Status
- Branch: `main`
- Uncommitted changes: None / [list files]
- Unpushed commits: None / [count]
- Sync status: Up to date / Behind by X commits

### Changes to Deploy
[Summary of commits since last deploy]

### CI Status
| Workflow | Status | Run |
|----------|--------|-----|
| Next.js Build | Pass/Fail | [link] |
| Unit Tests | Pass/Fail | [link] |
| E2E Tests | Pass/Fail | [link] |

### Railway
- Current status: [deployed/building/failed]
- Last deployment: [timestamp]

### Supabase
- Pending migrations: None / [list]

### Recommendation
[Go / No-Go with reasoning]
```

## Decision Point

After presenting the summary, ask the user:

| Scenario | Question |
|----------|----------|
| All green | "Everything looks good. Ready to push to main and deploy?" |
| CI failures | "There are CI failures. Want to investigate before deploying?" |
| Pending migrations | "There are pending Supabase migrations. Push those first?" |
| Uncommitted changes | "There are uncommitted changes. Commit or stash first?" |

## Executing the Deploy

If user confirms and everything is ready:

```bash
# Push to main triggers Railway deploy
git push origin main
```

Then monitor:

```bash
# Watch Railway deployment
bun railway logs --build
```

## Future: CLI Companion

This skill is designed to eventually have a CLI companion that:

1. Runs all checks automatically
2. Produces a structured report (JSON/Markdown)
3. Can be integrated into CI or pre-push hooks

The skill documents the checks; the CLI automates them.
