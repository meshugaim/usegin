---
name: pushing-db-migrations-to-production
description: This skill should be used when pushing database migrations to production Supabase. Triggered by phrases like "push migrations to production", "db push to prod", "push db changes", or "deploy migrations".
---

# Pushing DB Migrations to Production

Push local Supabase migrations to the production database.

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
