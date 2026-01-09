---
name: pushing-db-migrations-to-staging
description: Manual skill for pushing database migrations to staging Supabase. Only use when explicitly requested via slash command. Migrations are normally auto-applied when pushing to the staging branch.
---

# Pushing DB Migrations to Staging (Manual)

Manually push local Supabase migrations to the staging database.

**Note:** Migrations are automatically applied when pushing to the `staging` branch. This skill is only needed for manual/out-of-band migration pushes (e.g., troubleshooting, emergency fixes).

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

## NEVER Use MCP for Migrations

**Do NOT use `mcp__supabase-staging__apply_migration` for migrations.**

The MCP tool generates its own timestamps instead of using file names, causing version drift between the database and code. This breaks the GitHub integration which compares DB versions against file names.

**Always use the CLI approach above.** If CLI connection fails:
1. Fix the connection issue (check env vars, network)
2. Ask the user for help
3. Do NOT fall back to MCP

## Troubleshooting

- If connection fails, verify `SUPABASE_DB_PASSWORD_STAGING` is set: `echo $SUPABASE_DB_PASSWORD_STAGING`
- Project ref: `jmmnzhmbkqfuogrervmn`
- If "Tenant or user not found", check the pooler region (currently `aws-1-us-east-1`)
