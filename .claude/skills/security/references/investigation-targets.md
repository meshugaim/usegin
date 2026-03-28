# Investigation Targets

Where to look when investigating each security domain. Start with these locations, expand if needed.

This file maps security domains to their concrete locations in the codebase. It should be updated when the architecture changes significantly.

---

## Authentication & Access Control

### Auth Flow (primary documentation)
- `docs/AUTHENTICATION_FLOW.md` — Complete auth flow: OTP, JWT, session management

### Frontend Auth (Next.js)
- `nextjs-app/lib/supabase/middleware.ts` — Session validation, protected/public route definitions, T&C checks
- `nextjs-app/app/auth/callback/route.ts` — OAuth callback handler, PKCE flow
- `nextjs-app/app/auth/sign-out/route.ts` — Sign-out endpoint
- `nextjs-app/lib/supabase/server.ts` — Server-side Supabase client factory
- `nextjs-app/lib/api/v1-auth.ts` — V1 API auth configuration and proxy

### Backend Auth (Python)
- `python-services/agent_api/auth.py` — JWT verification via JWKS, service-role auth, Bearer token extraction, X-User-Id header validation
- `python-services/agent_api/supabase_client.py` — Authenticated Supabase client creation

### Admin Access
- `nextjs-app/lib/services/admin-check.ts` — Admin verification via `admins` table
- `nextjs-app/lib/supabase-admin.ts` — Service-role Supabase client (bypasses RLS), singleton with safety guards
- `nextjs-app/app/admin/` — Admin pages (users, chat, GFS, VAIS, drive, workspaces)

### RLS Policies
- `supabase/migrations/` — grep for `CREATE POLICY`, `ALTER TABLE.*ENABLE ROW LEVEL SECURITY`, `SECURITY DEFINER`
- Key hardening migrations:
  - `20260305140233_harden_security_definer_functions_and_rls_policies.sql` — Security-definer function hardening (ENG-2563)
  - `20260306115743_tighten_permissive_rls_policies.sql` — Permissive policy tightening
  - `20260304121235_tighten_risks_rls_policy.sql` — Risk assessment RLS hardening

### RLS Tests
- `nextjs-app/tests/integration/security/db-hardening.test.ts` — Security-definer guards, RLS INSERT policy tests
- `nextjs-app/tests/integration/projects/rls.test.ts` — Project membership RLS
- `nextjs-app/tests/integration/drive/rls.test.ts` — Drive connection access control
- `nextjs-app/tests/integration/linear/rls.test.ts` — Linear integration access control
- `nextjs-app/tests/integration/risks/rls.test.ts` — Risk assessment RLS
- `supabase/tests/admin_invitations_rls_test.sql` — Admin invitation RLS (pgTAP)
- `supabase/tests/storage_rls_helper_functions_test.sql` — Storage RLS helpers (pgTAP)

### Auth Tests
- `nextjs-app/tests/unit/auth/` — Auth utility unit tests
- `nextjs-app/tests/unit/api/v1-auth*.test.ts` — V1 API auth tests
- `nextjs-app/tests/integration/auth/` — Auth flow integration tests
- `python-services/tests/unit/test_auth.py` — Python backend auth unit tests
- `python-services/tests/integration/claude/test_auth_switching.py` — Auth mode switching

---

## Encryption & Data Protection

### TLS (in transit)
- Handled by Railway (HTTPS) and Supabase (HTTPS endpoints)
- Verify via: check `railway.json` for HTTPS config, Supabase dashboard, and that no HTTP endpoints are exposed
- `nextjs-app/railway.json` — Deployment config

### At-Rest Encryption
- Handled by Supabase (PostgreSQL) — uses AES-256 by default on managed instances
- Verify via: Supabase MCP or platform documentation
- Note: this is infrastructure-level, not application-level. Evidence is typically "inferred" from platform defaults.

### Token Handling
- JWT tokens (RS256) issued by Supabase Auth
- Access token: ~1 hour expiry. Refresh token: ~30 days
- Stored in secure HTTP-only cookies (not accessible via JavaScript)
- `SameSite=Lax` for CSRF protection
- Verify in: `nextjs-app/lib/supabase/middleware.ts`, Supabase auth config

### Key Management
- API keys and secrets stored as environment variables in Railway
- `.env.example` lists all required keys (but not their values)
- GCP credentials bootstrapped via environment variable
- No application-level key rotation implemented (relies on platform defaults)

---

## Subprocessors & External Services

### How to Enumerate
1. Search `python-services/agent_api/` for service client files — each external service typically has a dedicated client or API module
2. Grep codebase for SDK imports: `anthropic`, `@google`, `@sentry`, `resend`, `unified`, `supabase`
3. Search for `fetch(` calls to external domains
4. Check webhook endpoints and OAuth callbacks in `nextjs-app/app/api/`

### Known Services (verify current state, don't trust this list blindly)

| Service | Purpose | Code Location | In DPA? |
|---------|---------|---------------|---------|
| **Anthropic** | AI/LLM engine | `python-services/agent_api/chat_service.py` | Yes |
| **Google (GFS/VAIS)** | File search, indexing | `python-services/agent_api/admin_gfs_service.py`, `admin_vais_service.py` | Yes |
| **Supabase** | Auth, database, storage | Throughout — `lib/supabase/`, `supabase_client.py` | Yes |
| **Railway** | Cloud hosting | `railway.json`, deployment config | Yes |
| **Resend** | Transactional email | `python-services/agent_api/api/email.py` | Yes |
| **Sentry** | Error monitoring | `nextjs-app/sentry.*.config.ts`, `python-services/agent_api/sentry_dsn.py` | Yes |
| **Unified.to** | Integration hub (Drive, Linear, Fathom) | `python-services/agent_api/unified_client.py` | **Check** |
| **Fathom** | Meeting transcripts (via Unified) | `python-services/agent_api/api/fathom.py` | **Check** |

### Integration Points (where customer data crosses service boundaries)
- Drive sync: `python-services/agent_api/api/drive.py` → Unified.to → Google Drive
- Linear sync: `python-services/agent_api/api/linear.py` → Unified.to → Linear
- Fathom sync: `python-services/agent_api/api/fathom.py` → Unified.to → Fathom
- OAuth callbacks: `nextjs-app/app/api/drive/callback/`, `linear/callback/`, `fathom/callback/`
- Webhooks: `nextjs-app/app/api/webhooks/`

---

## Data Handling & Retention

### Personal Data Storage
- User emails → Supabase `auth.users` table
- User names/metadata → Supabase user object
- Customer files → `project_files` table (RLS-filtered)
- Email content → `inbound_emails`, `email_attachments` tables
- Meeting data → Fathom sync tables
- Issue data → Linear sync tables

### Data Deletion
- **Email soft-deletion:** `supabase/migrations/20260211013454_email_deletion_rpc_and_rls.sql` — `delete_inbound_email()` RPC
- **Drive soft-delete:** `supabase/migrations/20260226085914_drive_soft_delete_lifecycle.sql` — audit-trail preserving
- **File deletion:** `nextjs-app/app/api/v1/projects/[projectId]/files/route.ts` — owner-only check
- **Cascade on user deletion:** `ON DELETE CASCADE` foreign key constraints from `auth.users`
- **Exclusion toggles:** Drive exclusion, Linear exclusion, Fathom exclusion — per-item opt-out

### Retention
- Terms & Conditions acceptance: never deleted (audit trail) — `supabase/migrations/20260106000001_create_terms_and_conditions.sql`
- Admin audit log: retained indefinitely — `supabase/migrations/20251211000001_create_admin_audit_log.sql`
- Customer data: retained until agreement termination (per DPA)

---

## Logging & Monitoring

### Sentry (use the CLI, not the MCP)
- **Skill:** Read `.claude/skills/sentry/SKILL.md` for CLI commands (`sentry issues`, `sentry events`, `sentry traces`)
- **Next.js server:** `nextjs-app/sentry.server.config.ts` — release tracking, performance monitoring
- **Next.js edge:** `nextjs-app/sentry.edge.config.ts` — middleware monitoring
- **Python:** `python-services/agent_api/sentry_dsn.py` — DSN resolution
- **User context sync:** `nextjs-app/components/sentry-user-sync.tsx`
- **Testing:** `nextjs-app/app/api/sentry-test/route.ts` (CI-only), `tests/external/sentry.test.ts`

### Audit Logging
- Admin actions: `supabase/migrations/20251211000001_create_admin_audit_log.sql`
- T&C acceptance: `user_terms_acceptance` table with timestamp and version

### Admin Monitoring
- Data summary RPC: `supabase/migrations/20260219135717_get_data_summary.sql`
- GFS health: `python-services/agent_api/admin_gfs_service.py`
- Admin dashboard: `nextjs-app/app/admin/page.tsx`

---

## Network Security

### Private Python API
- Python API accessible only via Railway internal network: `python-services.railway.internal:8080`
- Browser requests proxied through Next.js
- Documentation: `docs/security-private-python.impl-status.md`
- This eliminates direct CORS/CSRF concerns for the Python API

### Public Routes (attack surface)
- Check `nextjs-app/lib/supabase/middleware.ts` for `noAuthRoutes`
- Known public: `/api/webhooks/`, `/api/health/`, `/api/sentry-test/` (CI-only)
- OAuth callbacks: `/api/drive/callback/`, `/api/linear/callback/`, `/api/fathom/callback/`

### CORS/CSRF
- CSRF protection via `SameSite=Lax` cookies (Supabase default)
- No custom CORS configuration needed (Python API is private)

---

## Security Testing

### Dedicated Security Tests
- `nextjs-app/tests/integration/security/db-hardening.test.ts` — Comprehensive security hardening verification:
  - `get_user_by_email` grant revocation
  - `uid = auth.uid()` guards on RLS helper functions
  - Authorization checks on SECURITY DEFINER functions
  - RLS INSERT policy tightening

### RLS Coverage
- Check which tables have RLS enabled: `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` vs `SELECT tablename FROM pg_tables WHERE rowsecurity = true`
- Check for tables WITHOUT RLS that contain user data — these are gaps

### Security-Related Migrations
- grep `supabase/migrations/` for: `SECURITY`, `RLS`, `POLICY`, `GRANT`, `REVOKE`, `DEFINER`
- Track the progression of security hardening over time

---

## Existing Security Documentation

### In-Repo
- `docs/security/AskEffi DPA (01.08.2026).pdf` — Data Processing Addendum
- `docs/security/AskEffi Security Overview (Pilot).pdf` — Customer-facing security overview
- `docs/security-private-python.impl-status.md` — Python API privatization status
- `docs/AUTHENTICATION_FLOW.md` — Authentication architecture
- `docs/plan/system-architecture.md` — System architecture
- `docs/plan/tech-stack-and-architecture.md` — Technology stack

### Legal
- `nextjs-app/content/legal/terms/` — Terms & conditions
- `nextjs-app/content/legal/` — Privacy policy, open-source attribution

### Previous Audits
- `docs/audits/nextjs-test-mock-audit.md` — Test quality audit
- `docs/audits/2025-12-26-frontend-e2e-test-audit.md` — Frontend/E2E test audit (noted RLS test suite skipped)
