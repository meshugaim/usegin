# Schema Migration Research

## 1. How ENG-2098 Created a Separate Schema (vrag_prototype)

### Migration: `20260226112339_vrag_prototype.sql`

The vrag_prototype migration creates a **separate PostgreSQL schema** (`CREATE SCHEMA IF NOT EXISTS vrag_prototype`) rather than putting tables in the `public` schema. This is the only non-system custom schema in the codebase.

**Contrast with VAIS prototype** (`20260226110953_vais_prototype.sql`): The VAIS migration does NOT create a separate schema. It creates tables (`vais_stores`, `vais_documents`, `vais_document_versions`, `vais_sync_events`) directly in the `public` schema, with an independent enum (`vais_sync_status`). Both prototypes were created the same day.

### vrag_prototype Schema Pattern

**Schema creation and grants:**
```sql
CREATE SCHEMA IF NOT EXISTS vrag_prototype;
GRANT USAGE ON SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vrag_prototype TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA vrag_prototype TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vrag_prototype
    GRANT ALL ON ROUTINES TO authenticated, service_role;
```

**Cross-schema references to `public.projects`:**
```sql
-- FK references use fully-qualified public.projects(id)
project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
```

**Reusing public schema types:**
```sql
-- Reuses existing enums from public schema
sync_status public.gfs_sync_status NOT NULL DEFAULT 'pending'
event_type public.gfs_sync_event_type NOT NULL
```

**Reusing public schema functions:**
```sql
EXECUTE FUNCTION public.update_updated_at_column();
```

**RLS approach:** RLS is enabled on all 4 tables (`corpora`, `files`, `file_versions`, `sync_events`) but NO user-facing policies are created. All access goes through service_role (which bypasses RLS). This is simpler than the VAIS prototype which has full member/owner RLS policies.

**PostgREST exposure:** The schema is registered in `supabase/config.toml`:
```toml
schemas = ["public", "storage", "graphql_public", "vrag_prototype"]
```

**Test environment gap:** The test `.env.test` has:
```
PGRST_DB_SCHEMAS=public,storage,graphql_public
```
This means `vrag_prototype` schema is NOT exposed via PostgREST in test containers. Any test querying `vrag_prototype` tables through the Supabase client would fail silently (tables not found). To fix: add `vrag_prototype` to `PGRST_DB_SCHEMAS` in `tests/shared/supabase/.env.test`.

### Tables Created

| Table | Schema | FK to public | RLS | User Policies |
|-------|--------|-------------|-----|---------------|
| `vais_stores` | public | `projects(id)` | Yes | member read, owner write |
| `vais_documents` | public | `projects(id)` | Yes | member read, owner write |
| `vais_document_versions` | public | via `vais_documents` | Yes | via parent join |
| `vais_sync_events` | public | via `vais_documents` | Yes | via parent join |
| `vrag_prototype.corpora` | vrag_prototype | `public.projects(id)` | Yes | None (service-role only) |
| `vrag_prototype.files` | vrag_prototype | `public.projects(id)` | Yes | None (service-role only) |
| `vrag_prototype.file_versions` | vrag_prototype | via `files` | Yes | None (service-role only) |
| `vrag_prototype.sync_events` | vrag_prototype | via `files` | Yes | None (service-role only) |

### Storage

The vrag_prototype migration also creates a storage bucket: `INSERT INTO storage.buckets (id, name, public) VALUES ('vrag-files', 'vrag-files', false)`.

---

## 2. Schema Validation Tests

### Test Inventory

There are **7 schema test files** across the codebase:

| File | What It Tests |
|------|---------------|
| `nextjs-app/tests/integration/drive/schema.test.ts` | Drive integration tables: constraints, FKs, multi-folder, SET NULL behavior |
| `nextjs-app/tests/integration/inbound-emails/schema.test.ts` | Inbound emails: columns, defaults, CHECK constraints, FKs |
| `nextjs-app/tests/integration/email-allowlist/entries-schema.test.ts` | Allowlist entries: RLS policies, pattern CHECK, unique index |
| `nextjs-app/tests/integration/email-allowlist/candidates-schema.test.ts` | Allowlist candidates: partial unique index, status constraint, RLS |
| `nextjs-app/tests/integration/workspaces/workspace-tier-schema.test.ts` | Workspace tiers: tier column, project_limit, user_tier_settings table |
| `nextjs-app/tests/integration/admin-invitations/terms-schema.test.ts` | Legal documents: document types, active versions, user assignments |
| `python-services/tests/integration/db/test_terms_schema.py` | Legal documents (Python): tables exist, seed data, unique constraints, RPCs |

### What These Tests Check

All schema tests follow the same pattern:
1. **Table existence** -- query table with `.select("*").limit(1)`, assert no error
2. **Column existence** -- select specific columns, assert no error (if column missing, Supabase returns error)
3. **Default values** -- insert row without optional fields, verify defaults
4. **CHECK constraints** -- insert invalid values, assert constraint violation error
5. **Unique constraints** -- insert duplicate, assert unique violation
6. **FK constraints** -- insert with invalid FK, assert foreign key violation
7. **RLS policies** -- query as different user roles, verify access control

### Do They Hardcode Table Names?

**Yes, every test hardcodes table names** as strings in `.from("table_name")` calls. Example:
```ts
await supabase.from("drive_connections").select("*").limit(1);
await supabase.from("drive_folder_scopes").select("*").limit(1);
```

However, these tests **only validate the specific tables they were written for**. There is NO global schema inventory test that checks "all tables in the database must be X" or fails when new tables appear.

### Would Adding a New Schema Break Them?

**No, existing tests would NOT break.** Reasons:

1. **No global table enumeration** -- no test queries `information_schema.tables` or `pg_catalog.pg_tables` for a complete list. Each test only queries its own tables.

2. **Test container reset drops only `public` schema** -- both `nextjs-app/tests/integration/setup.ts` and `python-services/tests/integration/db/conftest.py` reset the database by:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
   A separate schema like `vrag_prototype` would be re-created by migrations (which run all `.sql` files), but would NOT be dropped during reset if it survived from a previous run. This is fine -- migrations use `IF NOT EXISTS`.

3. **PostgREST schema exposure** -- the test environment only exposes `public,storage,graphql_public` via `PGRST_DB_SCHEMAS`. Tables in `vrag_prototype` are invisible to the Supabase client in tests unless `.env.test` is updated.

4. **The `db-checks` tool** (`tools/db-checks/`) does query `information_schema` for tables/columns/policies, but its tests use fixture data, not the live database. It's a code analysis tool, not a schema validation test.

### Key Risk for New Schema

The main risk is **not breakage but invisibility**: if you add `vais_prototype` (or similar) as a separate schema and write tests for it, the tests will fail because PostgREST won't expose those tables unless you add the schema to:
- `supabase/config.toml` `schemas` array (local dev) -- already done for `vrag_prototype`
- `tests/shared/supabase/.env.test` `PGRST_DB_SCHEMAS` (test containers) -- NOT done for `vrag_prototype`

### Supabase Client Schema Selection

When querying a non-public schema via the Supabase JS/Python client, you must specify the schema:
```ts
const { data } = await supabase.schema("vrag_prototype").from("corpora").select("*");
```
Without `.schema()`, the client defaults to `public` and won't find the table.
