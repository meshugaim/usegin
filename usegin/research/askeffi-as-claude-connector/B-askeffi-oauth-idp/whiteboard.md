---
poll: B — AskEffi as OAuth 2.1 Authorization Server
date: 2026-05-08
charter: design (not build) what it would take for AskEffi to issue OAuth tokens to third-party MCP clients (claude.ai), so a user can connect their AskEffi account and Claude can act on their behalf.
status: whiteboard landed
---

# AskEffi as the OAuth 2.1 AS for an MCP connector

## Top — the click

**Stand up an OAuth 2.1 authorization server as a Next.js route group at `/oauth/*` (issuer = `https://app.askeffi.ai`), backed by a small Postgres schema (`oauth_clients`, `oauth_authorization_codes`, `oauth_refresh_tokens`, `oauth_consents`) and the in-process [`oidc-provider`](https://github.com/panva/node-oidc-provider) library (MIT, OpenID-certified, RFCs 7591 / 8414 / 7636 / 7009 / 9728 covered). Issue opaque, audience-bound access tokens (15-min TTL) and rotated refresh tokens (30-day TTL) — opaque, not JWT, so revocation is honest and we don't take on signing-key custody. Map every issued token to `auth.users.id` via a server-side lookup and run downstream MCP tool calls under that user's RLS scope using `supabase.auth.admin.createSession`-style impersonation through the service-role client (the same pattern we already use in `nextjs-app/lib/supabase-admin.ts`). The user-facing consent screen lives at `/oauth/consent` and is the only AskEffi-branded surface a Claude user sees during connect; everything else is the Supabase magic-link login they already know.**

This beats WorkOS AuthKit (the obvious buy option) on three axes: no new subprocessor on the DPA (`docs/security/reports/2026-04-02-subprocessor-inventory.md` is currently AWS-free and AuthKit-free — we'd burn the "no new vendor" simplicity for ~2 weeks of save), full token-shape control (we want opaque + audience-bound, AuthKit issues JWTs we'd have to accept), and zero per-MAU cost overlap with Supabase Auth (AuthKit's free tier ends at 1M MAUs but we'd be paying for the same user twice in the meantime). It loses on ~1 week of integration time and one custom-built consent screen — both cheap. **Build, don't buy.**

## Middle — the body

### End-to-end flow (text diagram)

```
User in claude.ai                AskEffi (Next.js)              Supabase Auth
─────────────────                ─────────────────              ─────────────
1. clicks "Connect AskEffi"
2. claude.ai POSTs MCP req
   → mcp.askeffi.ai/mcp
   (no token)                    ┐
                                 │ 401 + WWW-Authenticate:
                                 │   Bearer resource="…",
                                 │   resource_metadata=
                                 │   "https://mcp.askeffi.ai/
                                 │    .well-known/
                                 │    oauth-protected-resource"
3. claude.ai GETs PRM            ┐
   /.well-known/                 │ {
   oauth-protected-resource      │   "resource":"https://mcp.askeffi.ai",
                                 │   "authorization_servers":[
                                 │     "https://app.askeffi.ai"
                                 │   ],
                                 │   "scopes_supported":[
                                 │     "mcp:read","mcp:write"
                                 │   ]
                                 │ }
4. claude.ai GETs AS metadata    ┐
   app.askeffi.ai/.well-known/   │ AS metadata JSON, including
   oauth-authorization-server    │ registration_endpoint,
                                 │ authorization_endpoint,
                                 │ token_endpoint, revocation_endpoint
5. claude.ai POSTs DCR
   /oauth/register
   { redirect_uris:[             ┐
     "https://claude.ai/         │ 201 { client_id, client_secret,
     api/mcp/auth_callback/…"]   │ … } — row written to
     client_name:"Claude" }      │ oauth_clients
6. claude.ai redirects user to
   /oauth/authorize?
     client_id=…
     &response_type=code
     &code_challenge=…
     &resource=https://
       mcp.askeffi.ai
     &scope=mcp:read mcp:write
     &state=…
7. AskEffi: is the user logged in?    ┐
                                      │ if no Supabase session cookie →
                                      │ redirect to /sign-in?next=/oauth/
                                      │ authorize?…
   → user does Supabase magic-link → ─┼─→ Supabase Auth issues session
                                      │   cookie (existing flow,
                                      │   unchanged)
   → /oauth/consent shown:           ┐
     "Claude wants to access         │ user clicks Allow
     your AskEffi account.           │ → AskEffi writes
     It will: read projects,         │   oauth_authorization_codes row
     send messages."                 │   bound to (user_id, client_id,
                                     │   resource, code_challenge,
                                     │   scopes)
                                     │ → 302 to claude.ai redirect_uri
                                     │   ?code=…&state=…
8. claude.ai POSTs /oauth/token
   { grant_type:"authorization_code",
     code,
     code_verifier,
     resource:"https://mcp.askeffi.ai",
     client_id, client_secret }      ┐ AskEffi validates PKCE,
                                     │ resource match, client creds,
                                     │ issues opaque access_token
                                     │ (15-min, row in
                                     │ oauth_access_tokens) +
                                     │ refresh_token (30-day, row in
                                     │ oauth_refresh_tokens) →
                                     │ 200 { access_token,
                                     │ refresh_token, expires_in,
                                     │ token_type:"Bearer" }
9. claude.ai → mcp.askeffi.ai/mcp
   Authorization: Bearer …          ┐ MCP server (handled in Poll A)
                                    │ resolves token → user_id →
                                    │ runs tool with that user's
                                    │ RLS scope
```

### Build vs buy matrix

|  | **Build (oidc-provider, in-process Next.js)** | **Buy: WorkOS AuthKit (Standalone Connect)** | **Buy: Auth0 (Custom AS)** | **Build: roll own with `oauth4webapi`** |
|---|---|---|---|---|
| Time to first token | ~10 working days (lib + 4 tables + consent UI + tests) | ~3 days (drop-in, "Standalone Connect" lets us keep Supabase Auth as the user IdP) | ~5 days, but heavier integration shape | ~20+ days (every RFC implemented by hand) |
| Control over token shape | Total — opaque, audience-bound, our TTLs | Limited — AuthKit issues JWTs in their shape; we accept them | Configurable but constrained | Total |
| Ongoing cost | $0 (Postgres rows) | Free ≤1M MAU, then $2500/M MAU above; MCP-specific tier unclear | $$ at scale; "Custom AS" is paid tier only | $0 |
| New subprocessor on DPA | None | **+WorkOS** — adds a row to `docs/security/reports/2026-04-02-subprocessor-inventory.md`, customer-questionnaire pain | **+Okta/Auth0** | None |
| Vendor lock | None | High — moving off AuthKit means re-issuing every connector token | High — Auth0's custom-DB and rules are sticky | None |
| Compliance posture | We own audit logs, revocation, retention | They own it, we co-sign in DPA | Same as WorkOS | We own it (by hand) |
| Maintenance burden | One library, well-maintained but single-maintainer (Filip Skokan, OpenID-certified) | They patch CVEs | They patch CVEs | High — every spec change is on us |
| MCP-spec churn risk | Med — we follow `oidc-provider` releases; community keeps up with MCP | Low — WorkOS markets MCP-first | Med | High |
| Reversibility | High — opaque tokens, swap implementation behind discovery URLs | Low — token shape leaks into MCP server validation | Low | High |

**Pick: build with `oidc-provider`.** The case for WorkOS is real (3-day TTFT vs 10), but every other column favors build. The deciding line: *adding a new authentication subprocessor while we're still pre-revenue* is a free-tier promise we'd cash today and pay back forever. We've already written one custom security boundary (token_crypto helper, recommended in `usegin/research/token-encryption/recommendation.md`); a second is the same shape.

The `oauth4webapi` "from scratch" option exists but is a bad bet — it's a *client* library; we'd be writing the AS endpoints by hand against the RFCs. The ~10-day savings from `oidc-provider` over `oauth4webapi` is the entire rationale; do not re-litigate.

### Schema deltas (DDL sketch)

Lives in a new migration `supabase/migrations/<ts>_oauth_authorization_server.sql`. Five tables. All RLS-locked to **service-role only** — every read/write goes through Next.js server code; no user-direct access; no anon access.

```sql
-- Registered OAuth clients (Claude.ai, Cursor, future MCP clients).
-- Created via DCR (RFC 7591), so row-creation is the registration endpoint.
create table oauth_clients (
  client_id text primary key,                       -- random 32-byte url-safe
  client_secret_hash text not null,                 -- sha256(secret); secret returned ONCE on register
  client_name text not null,                        -- "Claude" — shown on consent
  redirect_uris text[] not null,                    -- exact-match validation
  grant_types text[] not null default
    '{authorization_code,refresh_token}',
  token_endpoint_auth_method text not null default
    'client_secret_post',
  scope text,                                       -- space-separated default scopes
  client_uri text,                                  -- shown on consent
  logo_uri text,                                    -- shown on consent (CSP-validated)
  software_statement text,                          -- optional JWT (RFC 7591 §2.3)
  registered_at timestamptz not null default now(),
  registered_via text not null default 'dcr'        -- 'dcr' | 'admin' | 'preregistered'
);

-- Short-lived authorization codes (PKCE flow). Single-use, ~10-min TTL.
create table oauth_authorization_codes (
  code_hash text primary key,                       -- sha256(code); code never stored raw
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,                       -- locked at issue time
  resource text not null,                           -- RFC 8707 audience
  scope text not null,                              -- granted scopes (post-consent)
  code_challenge text not null,                     -- PKCE
  code_challenge_method text not null,              -- 'S256'
  expires_at timestamptz not null,                  -- now() + 10min
  consumed_at timestamptz                           -- single-use enforcement
);
create index on oauth_authorization_codes (expires_at);

-- Long-lived refresh tokens. Rotated on each use (RFC 8414 + OAuth 2.1 §4.3.1).
create table oauth_refresh_tokens (
  token_hash text primary key,                      -- sha256(token)
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,                           -- audience
  scope text not null,
  parent_token_hash text                            -- chain for theft detection
    references oauth_refresh_tokens(token_hash),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,                  -- now() + 30d
  revoked_at timestamptz,
  revoked_reason text                               -- 'rotated' | 'user' | 'admin' | 'theft_detected' | 'password_change'
);
create index on oauth_refresh_tokens (user_id, client_id) where revoked_at is null;

-- Optional: persist access tokens too. Argument FOR: revocation works, audit trails.
-- Argument AGAINST: write-on-every-issue. We persist; row count stays small (15-min TTL).
create table oauth_access_tokens (
  token_hash text primary key,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  scope text not null,
  parent_refresh_token_hash text references oauth_refresh_tokens(token_hash),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,                  -- now() + 15min
  revoked_at timestamptz
);
create index on oauth_access_tokens (token_hash) where revoked_at is null and expires_at > now();
-- Periodic cleanup job: delete where expires_at < now() - interval '7 days'.

-- User's record of "I let X connect to my AskEffi". Source of truth for the
-- /settings/connections UI ("disconnect Claude" → revoke all tokens).
create table oauth_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  scope text not null,                              -- last-granted scope set
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, client_id)
);

-- All tables: RLS on, no policies → service-role only. The /oauth/* routes
-- use the supabase-admin client (`nextjs-app/lib/supabase-admin.ts`).
alter table oauth_clients enable row level security;
alter table oauth_authorization_codes enable row level security;
alter table oauth_refresh_tokens enable row level security;
alter table oauth_access_tokens enable row level security;
alter table oauth_consents enable row level security;
```

**On token storage:** access tokens stored hashed (sha256). The actual opaque token never lives in the DB. This means leaking a Postgres dump doesn't leak active tokens, only token *fingerprints*. Same shape as our existing pattern (cf. `feedback_dont_infer_signing_from_apikeys` memory — keys are a separate token class; treat ours the same).

**On encryption:** *no need for app-side AES-GCM here* (unlike `slack_installs.bot_token_encrypted`). We're storing hashes, not recoverable tokens. The `usegin/research/token-encryption/recommendation.md` posture only applies when we need to *decrypt* (third-party tokens we proxy through). We never decrypt here — we compare hashes on lookup.

### Where each endpoint lives (Next.js route file paths)

| Endpoint | Path | What it does |
|---|---|---|
| AS metadata | `nextjs-app/app/.well-known/oauth-authorization-server/route.ts` | Static JSON. `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `jwks_uri` (empty — opaque tokens), `scopes_supported`, `response_types_supported:["code"]`, `code_challenge_methods_supported:["S256"]`. |
| PRM | `nextjs-app/app/.well-known/oauth-protected-resource/route.ts` | Static JSON pointing at `https://app.askeffi.ai` as the AS. Note: the *MCP server* under `mcp.askeffi.ai` (Poll A) also serves its own PRM; this one covers app.askeffi.ai if anyone discovers it. |
| Discovery — also at MCP host | served by Poll A's MCP server, same JSON | |
| DCR | `nextjs-app/app/oauth/register/route.ts` | POST handler. Validates `redirect_uris` (HTTPS + exact-match domain to `client_uri` host), inserts row, returns `client_id` + `client_secret`. **Open registration** (no initial access token), rate-limited per IP. |
| Authorize | `nextjs-app/app/oauth/authorize/page.tsx` (server component) + `actions.ts` | Reads query params, validates `client_id` / `redirect_uri` / `code_challenge` / `resource`, checks Supabase session (middleware redirects to `/sign-in?next=…` if absent), renders consent screen, on user-Allow inserts `oauth_authorization_codes` row and 302s. |
| Token | `nextjs-app/app/oauth/token/route.ts` | POST handler. Three branches: `authorization_code` (validate code + PKCE + resource, mint), `refresh_token` (validate, rotate, mint, mark parent rotated), `client_credentials` (initially: not supported — return `unsupported_grant_type`). |
| Revoke (RFC 7009) | `nextjs-app/app/oauth/revoke/route.ts` | POST handler. Authenticated by client. Marks token row revoked. |
| Introspect (RFC 7662, optional) | `nextjs-app/app/oauth/introspect/route.ts` | Internal — Poll A's MCP server hits this to validate inbound tokens. |
| User-facing connections page | `nextjs-app/app/settings/connections/page.tsx` | Lists `oauth_consents` rows for the user; "Disconnect" → revokes all live tokens for that `(user_id, client_id)`. |

All `/oauth/*` routes go on `noAuthRoutes` in `nextjs-app/lib/supabase/route-lists.ts` *except* `/oauth/authorize` (which needs the Supabase session) and `/oauth/consent` (same). The middleware in `nextjs-app/lib/supabase/middleware.ts` already handles redirect-to-sign-in for unauthenticated requests on protected routes — we reuse that path.

### Consent UX (text wireframe)

```
┌──────────────────────────────────────────────────────────┐
│ AskEffi                                          ✕ Cancel│
├──────────────────────────────────────────────────────────┤
│                                                          │
│   [Claude logo]   Claude wants to connect to AskEffi     │
│                                                          │
│   Signed in as:   nitsan@askeffi.ai                      │
│                   (not you? sign out)                    │
│                                                          │
│   Claude will be able to:                                │
│   ✓  Read your projects, files, and chat history         │
│   ✓  Send messages to Effi on your behalf                │
│   ✓  Search across your connected data sources           │
│                                                          │
│   It cannot:                                             │
│   ✗  Manage workspace billing or members                 │
│   ✗  Connect new data sources                            │
│   ✗  Delete projects or files                            │
│                                                          │
│   You can disconnect at any time from                    │
│   Settings → Connections.                                │
│                                                          │
│           [ Cancel ]      [  Allow access  ]             │
│                                                          │
│   Connecting via OAuth — claude.ai never sees            │
│   your AskEffi password.                                 │
└──────────────────────────────────────────────────────────┘
```

The scope copy is placeholder — Poll D owns the actual scope-set design. The shape (✓ can / ✗ cannot, "you can disconnect anytime", "claude.ai never sees your password") is load-bearing and shouldn't change between scope iterations. The `client_name`, `client_uri`, `logo_uri` come from the `oauth_clients` row (DCR-supplied, validated at registration time).

### Refresh / revoke flows

**Refresh (claude.ai → us, every ~15 min):**
1. POST `/oauth/token` with `grant_type=refresh_token`, `refresh_token=…`, `resource=…`, client creds.
2. We look up `token_hash`, validate not revoked, not expired, resource matches.
3. Mint new access + new refresh.
4. Mark old refresh `revoked_at=now(), revoked_reason='rotated'`, set new refresh's `parent_token_hash` to old.
5. **Theft detection:** if a request arrives with a refresh token that's *already* `revoked_reason='rotated'` (i.e., used twice), we revoke the entire chain — every descendant of the same root — and force the user to re-consent. This is the OAuth 2.1 §4.3.1 contract.

**Revoke — three triggers, all converge on the same `revoke(reason)` helper in `nextjs-app/lib/oauth/server.ts`:**
1. **User-initiated** ("Disconnect Claude" in `/settings/connections`): revoke all live tokens where `(user_id, client_id)` matches; `reason='user'`. Idempotent.
2. **Client-initiated** (claude.ai POSTs `/oauth/revoke`): revoke the specific token; `reason='client'`. RFC 7009 says we MUST always 200 even if token unknown.
3. **Server-initiated:**
   - On password change / email change: hook the existing Supabase auth-event webhook (we already listen via `nextjs-app/app/api/webhooks/`); revoke all tokens for that user; `reason='password_change'`.
   - Theft detection (above): `reason='theft_detected'`.
   - Admin: `reason='admin'`.

### Mapping OAuth token → `auth.users.id` → RLS

This is the load-bearing seam. The MCP server (Poll A) receives `Authorization: Bearer <opaque>`. It:

1. Calls `/oauth/introspect` (or — equivalent and faster — calls a server-side helper that hits `oauth_access_tokens` directly). Returns `{ active: true, user_id, client_id, scope, resource }`.
2. With that `user_id`, the MCP tool needs to act *as that user* against Supabase — so RLS gates kick in correctly (matches `project_tools_filter_access_level` + `project_rls_floor_tool_ceiling` memories: tools layer their own filters above RLS, but RLS must still gate "can this user SELECT at all").
3. We have **two viable paths** to "act as user_id" against Supabase:
   - **(a) `supabase.auth.admin.generateLink` → `verifyOtp`** to mint a real Supabase session for the user, use the resulting access_token in a normal `createClient`. Heavy: every MCP call mints a Supabase session. Cf. `reference_supabase_auth_signing` — we *can't* mint Supabase JWTs locally because they're ES256/JWKS asymmetric, so this is the path to a real session.
   - **(b) Service-role client + every query carries `where user_id = $1`** explicitly, bypassing RLS. Lighter and faster, but moves the access-control bar from "RLS enforces" to "every tool author gets it right".

   **Recommendation: (a) for read paths that already have RLS policies; (b) only for write paths the MCP scope explicitly permits and where the tool wraps a service-role mutation we already trust** (cf. `nextjs-app/lib/action-item-runs.ts`, `risk-runs.ts` — same pattern). Default = (a). This is a Poll D / Poll C call to refine; the *design* here is "the MCP server talks to AskEffi as the user, not as an admin".

4. Sentry tagging: every MCP-tool span gets `Sentry.setUser({ id: user_id })`, matching what `nextjs-app/lib/supabase/middleware.ts:170-173` already does for web sessions.

## Bottom — the open ends

### Dilemmas (z026 shape — for synthesizer)

**z026/B-1 — Build vs buy: the WorkOS pull is real.**
*Decided:* build with `oidc-provider`.
*Because:* +0 subprocessors, +0 token-shape constraint, +0 vendor lock; cost is ~7 dev-days vs WorkOS's 3.
*Price:* one Filip-Skokan-shaped single-maintainer dependency (`node-oidc-provider` is OpenID-certified and MIT but solo-maintained — a real fragility). Acceptable: the spec churn is in MCP land, not OAuth 2.1 land, and we can swap implementations behind our `/oauth/*` discovery URLs since tokens are opaque.
*Risk:* if MCP's auth profile diverges fast (it's still draft), `oidc-provider` may lag. Mitigation: track upstream, contribute back when needed.
*Alternatives rejected:* Auth0 (paid + subprocessor), `oauth4webapi` from scratch (we'd pay 2× the cost for 0× the gain), Supabase Auth's own AS features (don't exist — verified).

**z026/B-2 — Token shape: opaque vs JWT.**
*Decided:* opaque, audience-bound, 15-min TTL access + 30-day rotated refresh.
*Because:* JWTs lock us into signing-key custody and make revocation a lie (we'd need a denylist anyway, at which point opaque is honest). Opaque tokens cost one DB read per MCP request — at expected scale this is invisible noise.
*Price:* every MCP-tool call goes through Postgres (`oauth_access_tokens` lookup). Mitigate with an in-process LRU cache keyed on token_hash, TTL=60s, invalidated on revoke webhook.
*Risk:* if MCP traffic explodes 1000×, the DB hit becomes real. Cache fixes it long before that.
*Alternatives rejected:* JWT with JWKS (signing-key custody we don't want), JWT-with-denylist (worst of both worlds).

**z026/B-3 — Where the AS lives: Next.js vs separate FastAPI.**
*Decided:* Next.js, `nextjs-app/app/oauth/*`.
*Because:* the AS needs the Supabase session cookie to verify "user is logged in for consent". That cookie is already correctly handled in Next.js middleware. Moving the AS to FastAPI means re-implementing Supabase cookie auth there (we explicitly don't — Python is internal-only; cf. `project_python_api_internal_only`).
*Price:* `oidc-provider` is a Node lib mounted in Next.js — we ship a small Express/Hono adapter inside an API route. ~50 LoC of glue.
*Risk:* MCP traffic goes through Next.js → Vercel/Railway scaling profile (already proven for our existing API surface).
*Alternatives rejected:* FastAPI with hand-rolled OAuth (re-implements Supabase cookie verification), edge runtime (oidc-provider needs Node APIs, not edge-compat).

**z026/B-4 — DCR open vs gated.**
*Decided:* open with rate-limit + admin-pinning option.
*Because:* the MCP spec strongly recommends DCR; gating it (initial-access-token) breaks "user pastes URL into Claude → it works" — the entire UX of remote MCP. But un-rate-limited open DCR is a confused-deputy farm.
*Price:* one new rate-limit rule + a small "verified clients" allowlist for the discovery page (so when Claude/Cursor/etc register, we mark them trusted on consent).
*Risk:* spam registrations bloat `oauth_clients`. Mitigate: GC unused clients (no tokens issued in 30d) on a cron.
*Alternatives rejected:* gated DCR (kills MCP UX), no DCR (kills MCP spec compliance).

**z026/B-5 — Refresh token storage on Anthropic's side.**
*Decided:* not our problem to design — but we MUST issue refresh tokens in a shape that Anthropic's storage expects (opaque string, returned in `refresh_token` field of token response). Confirm with Poll A.
*Because:* per MCP spec / RFC 9728, the *client* (Anthropic) holds refresh tokens and re-presents them. Their storage posture is theirs; ours starts when they POST `/oauth/token` with `grant_type=refresh_token`.
*Price:* zero on our side beyond rotating + theft-detecting.
*Risk:* if Anthropic's token storage ever leaks, our users get pwned across every connector. Mitigate: short access-token TTL (15min), prompt user re-consent on refresh failure.
*Alternatives rejected:* not issuing refresh tokens (would force re-consent every 15min — broken UX).

### Wire-probes needed (Poll-A overlap, flagged for synthesizer)

1. **What does claude.ai actually send during DCR?** Does it support `software_statement`? Does it send `client_name` we should display verbatim? Probe by setting up a throwaway AS and adding it to claude.ai's connector flow. (Poll A territory; B-side ask: log the registration body and freeze the consent-display contract.)
2. **Which Resource Indicator URL does claude.ai use?** Does it use `https://mcp.askeffi.ai`, `https://mcp.askeffi.ai/mcp`, or something else? Affects our PRM `resource` field exact-match validation.
3. **Does claude.ai cache AS metadata?** If yes, what's the TTL? Affects how we roll out new endpoints.
4. **Does Supabase Auth's webhook fire on email change *and* password change *and* magic-link reuse?** We need all three to propagate revocation. Probe staging.
5. **Does `oidc-provider` v9 support audience-restricted opaque tokens out of the box, or do we need an adapter?** Read the changelog; if needed, the adapter is small (it's the storage layer it asks us to wire ourselves anyway).
6. **Cookie-domain alignment:** Supabase session cookies live on `app.askeffi.ai`. The AS (issuer) is also `app.askeffi.ai`. The MCP server is `mcp.askeffi.ai`. This is correct, but verify our cookie `Domain` attribute hasn't been broadened to `.askeffi.ai` (it shouldn't be, but check).

### Friction zettels (capture-worthy)

- **z-friction-B1: "Supabase doesn't act as an outbound OAuth AS."** Confirmed via docs read 2026-05-08. Worth a zettel because future-Gin will reach for "just use Supabase Auth" and it's not there. Cite this whiteboard.
- **z-friction-B2: "We can't mint Supabase user-JWTs locally."** Re-states `reference_supabase_auth_signing` in the connector context: when MCP tools need to act as a user, we either generate a real session via admin API or use service-role + explicit `user_id` filter. There is no third option.
- **z-friction-B3: "Next.js noAuthRoutes + middleware shape works for OAuth endpoints."** Reviewed `nextjs-app/lib/supabase/middleware.ts`; confirmed `/oauth/register`, `/oauth/token`, `/oauth/revoke`, `/oauth/introspect`, `/.well-known/*` belong on `noAuthRoutes`, while `/oauth/authorize` and `/oauth/consent` deliberately stay protected.
- **z-friction-B4: "Token-encryption posture doesn't apply to AS-issued tokens."** Our prior recommendation (`usegin/research/token-encryption/recommendation.md`) is for tokens we *consume* and must decrypt. Tokens we *issue* are stored hashed — different threat model, different remedy. Worth a zettel so the next reader doesn't reach for `token_crypto.encrypt` on `oauth_access_tokens`.

### What I deliberately did not design

- **Scope set:** Poll D's job. I used `mcp:read` / `mcp:write` as placeholders.
- **MCP server contract / tool shape:** Poll A and Poll C.
- **Marketplace listing UX:** Poll E.
- **Distinction between user-tier (internal vs external):** out of scope for the AS itself; the *token* carries `user_id`, the MCP server resolves access tier per-call against `project_users` like the rest of the app does.

### Sources cited

- MCP authorization spec, 2025-06-18 — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization (fetched 2026-05-08)
- RFC 7591 (DCR) — https://datatracker.ietf.org/doc/html/rfc7591
- RFC 8414 (AS Metadata) — https://datatracker.ietf.org/doc/html/rfc8414
- RFC 9728 (PRM) — https://datatracker.ietf.org/doc/html/rfc9728
- RFC 8707 (Resource Indicators) — referenced via MCP spec
- OAuth 2.1 draft — draft-ietf-oauth-v2-1-13
- `node-oidc-provider` repo — https://github.com/panva/node-oidc-provider (MIT, OpenID-certified)
- WorkOS AuthKit MCP docs — https://workos.com/docs/authkit/mcp (Standalone Connect mode)
- Internal: `usegin/research/token-encryption/recommendation.md`
- Internal: `nextjs-app/lib/supabase/middleware.ts`
- Internal: `nextjs-app/lib/supabase-admin.ts`, `lib/action-item-runs.ts`, `lib/risk-runs.ts` (service-role write patterns we'd echo)
- Memory: `project_python_api_internal_only`, `reference_supabase_auth_signing`, `project_tools_filter_access_level`, `project_rls_floor_tool_ceiling`
