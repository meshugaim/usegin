---
name: pushing-db-migrations-to-staging
description: This skill should be used when pushing database migrations to staging Supabase. Triggered by phrases like "push migrations to staging", "db push to staging", "deploy migrations to staging", or "staging db push".
---

# Pushing DB Migrations to Staging

Push local Supabase migrations to the staging database.

## Prerequisites

- `SUPABASE_DB_PASSWORD_STAGING` env var must be set

## Connection

Uses the Supabase connection pooler:

```
postgresql://postgres.jmmnzhmbkqfuogrervmn:$SUPABASE_DB_PASSWORD_STAGING@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

## Steps

### 1. Dry run first (required)

Always start with a dry run to see what will be applied:

```bash
bunx supabase db push --dry-run --db-url "postgresql://postgres.jmmnzhmbkqfuogrervmn:$SUPABASE_DB_PASSWORD_STAGING@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

### 2. Confirm with user

After showing the dry run output, **ask the user to confirm** before proceeding.

### 3. Push for real

Only after user confirmation:

```bash
bunx supabase db push --db-url "postgresql://postgres.jmmnzhmbkqfuogrervmn:$SUPABASE_DB_PASSWORD_STAGING@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

## When to Use This vs MCP

**Use this skill (CLI approach):**
- Keeps local and remote migration timestamps in sync
- Preferred for normal deployments
- Maintains migration history consistency

**Use MCP `apply_migration`:**
- Quick one-off fixes
- When CLI connection fails
- Note: Creates new timestamps, causing drift from local files

## Troubleshooting

- If connection fails, verify `SUPABASE_DB_PASSWORD_STAGING` is set: `echo $SUPABASE_DB_PASSWORD_STAGING`
- Project ref: `jmmnzhmbkqfuogrervmn`
- If "Tenant or user not found", check the pooler region (currently `aws-1-us-east-1`)
