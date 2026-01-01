---
name: pushing-db-migrations-to-production
description: Manual skill for pushing database migrations to production Supabase. Only use when explicitly requested via slash command. Migrations are normally auto-applied when pushing to the production branch.
---

# Pushing DB Migrations to Production (Manual)

Manually push local Supabase migrations to the production database.

**Note:** Migrations are automatically applied when pushing to the `production` branch. This skill is only needed for manual/out-of-band migration pushes (e.g., troubleshooting, emergency fixes).

## Prerequisites

- `SUPABASE_DB_PASSWORD` env var must be set

## Connection

Uses the Supabase connection pooler (direct connection blocked by IPv6):

```
postgresql://postgres.becbrfnfxrgezhtkrsrm:$SUPABASE_DB_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

## Steps

### 1. Dry run first (required)

Always start with a dry run to see what will be applied:

```bash
bunx supabase db push --dry-run --db-url "postgresql://postgres.becbrfnfxrgezhtkrsrm:$SUPABASE_DB_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

### 2. Confirm with user

After showing the dry run output, **ask the user to confirm** before proceeding.

### 3. Push for real

Only after user confirmation:

```bash
bunx supabase db push --db-url "postgresql://postgres.becbrfnfxrgezhtkrsrm:$SUPABASE_DB_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

## Troubleshooting

- If connection fails, verify `SUPABASE_DB_PASSWORD` is set: `echo $SUPABASE_DB_PASSWORD`
- Project ref: `becbrfnfxrgezhtkrsrm`
