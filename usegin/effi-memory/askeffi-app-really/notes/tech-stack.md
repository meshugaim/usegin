---
topic: tech-stack
moc: product
updated: 2026-05-08
conflict_pending: false
---

# Technology stack & infrastructure

What Effi runs on. For what Effi *does* with this stack, see [product](product.md). For data-source-specific OAuth + auth detail, see [data-sources](data-sources.md). For security posture + subprocessors, see [compliance](compliance.md).

## Current — as of 2026-05-08

### Frontend

| Layer | Tech | Detail |
|---|---|---|
| Framework | **Next.js (TypeScript)** | All browser-to-DB traffic proxied through the Next.js server — Supabase URL + anon key are server-side-only env vars |
| Auth proxy | Next.js server | Browser never touches Supabase directly |
| Linter / formatter | **Biome** (recommended-plus baseline) | Plus ESLint rules (auth-route exposure; bans client-side `/api/v1/…` fetches) |
| Type system | TypeScript with `noUncheckedIndexedAccess` | 104 sites fixed in `effi-cli` alone |
| Server actions | Typed; unified `ActionResult<T>` envelope; ESLint rule prevents regressing to client-side fetch |
| E2E tests | **Playwright** — browser-integration suite; `AppDriver` POC wraps Playwright CLI as subprocess for agent-usable E2E |
| Package manager | **Bun** |
| CLI | `effi-cli` (TypeScript) — `auth`, `link`, `ask`, `project`, `files`, `reports`, `anchor`, `meetings show`, `plan list` |

**Frontend hardening** (fathom:8e530d5b + attachment:c1670611):
- All Supabase tables `public` → `authenticated`; DB-level auth enforced.
- `pg_tap` tests in CI: no public tables, RLS enabled everywhere, RLS policies require auth.
- ESLint rules prevent accidental authenticated-route exposure.
- **Cloudflare Turnstile** CAPTCHA for bot protection.

### Backend

| Layer | Tech | Detail |
|---|---|---|
| Language | **Python** | All LLM calls + agent logic |
| Auth validation | Asymmetric JWT (ES256) via JWKS | Python independently verifies user cookies via Supabase-signed public key |
| Agent runtime | **Anthropic Claude Agent SDK** | Bumped 0.1.61 → 0.1.65 in week of 2026-04-18. `STRICT_TOOLS_ALLOWLIST_KWARGS` pattern: `tools=[]`, `disallowed_tools=[…]`, `permission_mode="dontAsk"` across all four agent runners |
| Scheduled worker | Python polling worker | 1-minute tick. **Per-fire wall-clock cap = 10 min** (raised from 3 min on 2026-05-08 after Guy's *"Loose ends"* report timed out twice in production) |
| Web framework | **FastAPI** referenced once indirectly (internal email-splitter inspector). Not explicitly confirmed for main API server — see Gap G-6 |
| Package structure | Topical subpackages (10-slice reorg week 2026-04-18): `identity/`, `observability/`, `bootstrap/`, `meetings/`, `retry/`, `usage/`, `sync/`, `connectors/`, `chat/`, `file_search/`, `gfs_admin/`, `sharepoint/`, `vais/admin/`, `project_context/`, `assessments/` |
| Package manager | **uv** |

**Agent-surface lockdown:** Claude Code harness tools (`Cron*`, `RemoteTrigger`, `EnterWorktree`, `ScheduleWakeup`, `ToolSearch`) stripped from the model's visible tool list in all four runners (chat / assessment / risk / report-agent). Fixed week of 2026-04-25. — attachment:223abc60.

### Database

| Component | Detail |
|---|---|
| Provider | **Supabase** (PostgreSQL on AWS, US region) |
| Auth | Supabase Auth — passwordless OTP, no self-registration, pre-invited only |
| Session tokens | ES256 JWT via JWKS; access ~1 hr; refresh ~30 days |
| Tenant isolation | RLS on **68/69 user-data tables** (CI-enforced; `pg_tap` blocks regressions) |
| Sensitive ops | `SECURITY DEFINER` RPCs (e.g. `fetch_anchored_run`, `claim_*` locked to `service_role`) |
| File uploads | Capped at **25 MB**; downloads use time-limited signed URLs (1-hour expiry) |
| Bulk export | None; API responses capped at 1,000 rows |
| Key tables | `data_items`, `gfs_sync_items`, `slack_installs`, `slack_channel_bindings`, `scheduled_reports`, `scheduled_report_runs`, `drive_files`, `drive_folder_scopes`, `inbound_emails`, `email_attachments`, `sharepoint_files` |

### Search / AI / LLM pipeline

| Component | Detail | Source |
|---|---|---|
| **Semantic search** | **Vertex AI Search (VAIS)** — nicknamed *"VICE"* in testing | fathom:76851fa9; production-week reports |
| **Previous backend** | GFS (Google File Search) + Gemini — **retired**. Tool-call latency was 7-17s | fathom:76851fa9 |
| **VAIS performance** | Retrieval = milliseconds; sync = ~3 minutes per file (Long Running Operations) | fathom:76851fa9 |
| **Indexing pipeline** | `data_items` → `gfs_sync_items` → VAIS. Used for SharePoint, Drive, Fathom meetings, scheduled-report runs | attachment:80d51643 |
| **LLM provider** | **Anthropic** (Claude). SOC 2 Type II subprocessor | attachment:c1670611 |
| **Model context** | Anthropic retired 1M-context beta on `claude-sonnet-4` + `claude-sonnet-4-5` on **2026-04-30**; recommended migration to `claude-sonnet-4-6` (1M GA at same price) | gmail:c423881c, gmail:38bd394b |
| **Search strategy** | Lihu 2026-04-29 to Chandra: *"we do both semantic keyword search and also essentially agentic search over data that we have in the database"* | fathom:0c6d9496 |
| **Pre-RAG optimisation** (planned) | Run semantic search on raw user query before calling Effi to provide a *"head start"* | fathom:9ddb6732 |

### Hosting & deployment

| Component | Provider | Region | Cert |
|---|---|---|---|
| Application | **Railway** | **EU** (Europe) | SOC 2 Type II |
| Database + auth | **Supabase** | **US** (AWS) | SOC 2 Type II |
| AI services | **Google Cloud** (Vertex AI) | Region not in indexed data | ISO 27001, SOC 2/3 |
| Secrets | Env vars in Railway (never in source) | — | — |
| Internal networking | Railway's private network for backend API (not publicly accessible) | — | — |
| Encryption in transit | TLS on all external connections | — | — |
| Encryption at rest | AES-256 (cloud-provider defaults) | — | — |

**Data residency split:** *"Supabase in US; Railway in EU → flag if EU-only is required"* (entity 439c10d6). EU Railway location described as *"a key advantage"* for non-US customers wanting to avoid Patriot Act subpoenas — fathom:accdc8ef.

### CI/CD & code quality

| Control | Detail |
|---|---|
| **DB security CI** | `pg_tap` tests enforce: RLS coverage, no public tables, auth required — **blocking on every push to main** — attachment:c1670611 |
| **E2E tests** | Playwright; global-setup requires explicit `ws` transport for `supabase-js@2.105.3` realtime-js on Node 20 — attachment:80d51643 |
| **Frontend lint** | ESLint + Biome (recommended-plus) |
| **Python lint** | `RET504`, `SIM115`, `SIM108`, logging f-strings, `exc_info`, `RUF100`/`RUF059` families |
| **Dep caching** | `actions/cache` for Bun; `uv` cache for Python |
| **Test selection** | `tach` for Python (import-graph-aware); slow-test markers (225 Python unit tests tagged; 470 Next.js slow tests skipped under `SKIP_SLOW=1` on pre-push; CI runs full suite) |
| **Security audit step** | Blocking in CI; runs on PRs against the database-checks workflow |
| **Pre-push hooks** | Test selection + workspace-lockfile guard + `db-checks` pipeline |

### Monitoring & observability

| Tool | Purpose |
|---|---|
| **Sentry** | Error monitoring across all layers; OTP-verify errors grouped; chat errors enriched |
| `anybodyhome` (internal CLI) | Queries Sentry spans, classifies active prod users (chat / sessions / other), emits green/yellow/red deploy-safety signal |
| **Chat-stream observability** | Byte-level telemetry on SSE handler; correlation ID browser → proxy → Python |
| **Admin VAIS table** | Sortable columns, 8 status badges, force-resync, per-row error reasons |
| **Scheduled-report live progress** | SSE on run page: tool-call count, last action, ~15s heartbeat (keeps Railway edge proxy from dropping idle connection) |

### Key vendors / subprocessors

From security posture v1.1 (2026-04-04, attachment:c1670611):

| Vendor | Role | Cert |
|---|---|---|
| **Supabase, Inc.** | DB + auth + file storage | SOC 2 Type II |
| **Railway Corp.** | Application hosting | SOC 2 Type II |
| **Anthropic, PBC** | AI services (Claude) | SOC 2 Type II |
| **Google LLC** | AI search (Vertex AI), cloud storage | ISO 27001, SOC 2/3 |
| **Sentry** (Functional Software, Inc.) | Error monitoring | SOC 2 Type II |
| **Resend** (Plus Five Five, Inc.) | Transactional email — scheduled-report delivery | SOC 2 Type II |
| **Unified.to** | OAuth broker — Drive / Linear / Fathom (and earlier exploration for SharePoint) | *"Security assessment on file"* — **NOT SOC 2** — see Conflict D |
| **Mailgun** (Sinch) | Inbound email routing to `[project]@mail.askeffi.ai` | SOC 2 Type II |
| **Cloudflare, Inc.** | Bot protection (Turnstile CAPTCHA) | SOC 2 Type II |

**Note on Unified.to:** AskEffi uses Unified's direct API (not MCP) for speed. Per security posture: *"AskEffi never possesses or stores Google OAuth tokens"* — Unified manages them. **However, see Conflict A** — Unified itself told AskEffi the shared-credentials path is not production-supported and migration to AskEffi's own GCP credentials started 2026-05-02→05-08.

### Internal dev tooling — how AskEffi builds AskEffi

| Tool | Role |
|---|---|
| **Claude Code** | Primary coding assistant; engineers connect it directly to AskEffi (dogfooding). Guy 2026-05-05: *"my engineers didn't even want to log in. They just connected Claude directly to our system"* — fathom:94cf41e0 |
| **Fathom** | Team uses Fathom for own meeting recording; transcripts flow into the team's own AskEffi project |
| **Notion** | Mentioned as PM tool with Claude Code as the only "seat": *"we're using Notion in the backend, but the only seat we have on Notion is actually cloud code sitting on Notion"* — fathom:6e8a4867 (Feb 2026) |
| **Linear** | Task tracking. CI references issue IDs in commits. AskEffi has 1 Linear seat used by Claude Code — see [data-sources](data-sources.md) |
| **Resend** | Transactional email. Lihu + Nitsan on Resend marketing list — confirmed active user |

- Source for whole picture: attachment:c1670611 (security posture 2026-04-07), attachment:80d51643 (production-week 2026-05-02→05-08), attachment:223abc60 (week 04-25→05-01), attachment:0f530be9 (week 04-18→04-24), attachment:b897a1d6 (week 04-04→04-10), fathom:8e530d5b (security-hardening meeting), fathom:76851fa9 / 40e89e82 (VAIS-vs-GFS bake-off), fathom:0c6d9496 (Lihu / Chandra 2026-04-29).
- Last verified: 2026-05-08

---

## History

```
2025-12-12 — Guy: "currently we are running on Railway." — fathom:bd5ef290
2026-01-11 — Supabase newsletter received by nitsan@askeffi.ai (PostgREST v14, metrics API). — gmail:99407b2b
2026-01-29 — Mailgun account verified (Oria signed up); Resend confirmed active. — gmail:2fc92877 / 186eb887
2026-02-06 — Lihu activates "STORAGE integrations" on Unified.to; discovery call initiated. — gmail:43977aaf
2026-02-12 — Lihu / Unified.to discovery call confirms: (a) Drive scopes likely need CASA; (b) Unified recommends direct API over MCP; (c) integration plan covers Drive + Linear + Fathom. — gmail:f01ab6b8
2026-02-26 — Guy confirms team uses Claude Code as primary dev environment; Notion as PM tool with Claude Code as the seat. — fathom:6e8a4867
2026-02-26 — Resend MCP 2.0 announced; Resend confirmed active. — gmail:43b7cf7c
~2026-02-early — Email integration architecture finalised: per-project addresses, Mailgun routing, allowlist (project members or replies to known threads). — gmail:9206b79b
~2026-03-early — **Security hardening sweep**: Supabase tables `public` → `authenticated`; browser-to-DB rerouted through Next.js proxy; asymmetric JWT verification added to Python server; pg_tap CI integration. — fathom:8e530d5b
2026-03-08 — Supabase Logs Drains (Datadog / Grafana Loki / Sentry / Axiom) on Pro plan. — gmail:f83bef45
2026-03-11 — Anuj Kumar interview: team discusses dev workflow — Claude Code primary, skills system for planning vs. coding vs. review. — fathom:9004899b
2026-04-04→10 — **SharePoint v3 rewrite** (push subscriptions → pull-model worker; tree picker; sites first-class; `data_items` hub; vais/ subpackage). Security: CVE upgrades; `search_path` pinned on 57 SECURITY DEFINER functions; Permissions-Policy header; Microsoft Graph signed client-state token verification; security audit blocking in CI. Subprocessors as versioned legal doc. — attachment:b897a1d6
2026-04-07 — Security posture v1.1 published (external audience). Subprocessor list: Railway / Supabase / Anthropic / Google-Vertex / Sentry / Resend / Unified.to / Mailgun / Cloudflare. — attachment:c1670611
~2026-04-early — **VAIS vs. GFS bake-off**: Vertex wins on retrieval (milliseconds vs. 7-17s); VAIS query-wording sensitivity flagged as issue. Decision: proceed with Vertex rollout (incl. Drive). Oria removes production feature toggles for unified data tab / Drive / Linear / search tools / mobile compat. — fathom:76851fa9 / 40e89e82
2026-04-18→24 — Python backend reorganised into 10 topical subpackages; `vais/admin/` confirmed in structure. Claude Agent SDK 0.1.61 → 0.1.65. `tach` adopted (import-graph-aware test selection); 225 Python + 470 Next.js slow tests tagged. Drive integration hidden from non-test-users pending Google verification. — attachment:0f530be9
2026-04-25→05-01 — **Scheduled Reports shipped** (Python polling worker, cadence picker, Resend delivery, run history). Agent-surface lockdown via STRICT_TOOLS_ALLOWLIST_KWARGS. **Slack shipped** (workspace OAuth + per-project channel binding; separate Customer-Slack vs. UseGin-internal-Slack apps). Linear-connect 401 fixed (Next.js caller missing service-role bearer). — attachment:223abc60
2026-04-29 — Lihu to Chandra: Supabase + vector DB; both semantic-keyword search and agentic search. — fathom:0c6d9496
2026-04-30 — **Anthropic 1M-context beta retired** on `claude-sonnet-4` + `claude-sonnet-4-5`. Migration to `claude-sonnet-4-6` recommended (1M GA same price). — gmail:c423881c, gmail:38bd394b
2026-05-02→05-08 — Scheduled Reports → first-class: delivered runs in VAIS canon; recipients-v2; test-fire button; SSE live progress; per-fire cap 3→10 min. Server-actions migration: every client-island fetch to /api/v1 → typed server action; ESLint bans old shape. **Drive OAuth migration started** — Unified.to shared GCP client → AskEffi's own GCP-registered client (Unified told AskEffi shared-credentials is not production-supported). Fathom integration card scoped to connector identity. .xlsx added to upload allowlist. — attachment:80d51643
2026-05-06 — Guy's *"Loose ends"* scheduled report timed out twice on the 3-min cap → cap raised to 10 min. — attachment:80d51643
```

---

## Conflicts to flag

**A — Drive OAuth ownership: Unified.to vs. own credentials.**
- Security posture 2026-04-07 (attachment:c1670611): *"Token delegation: OAuth tokens are managed entirely by our integration partner (Unified.to). AskEffi never possesses or stores Google OAuth tokens."*
- Production-week 2026-05-02→05-08 (attachment:80d51643): *"Work started on migrating Google Drive OAuth from Unified.to's shared client to our own GCP-registered client (Unified told us the shared-credentials path is not supported in production)."*

**Resolution:** April security posture was accurate at write-time but Unified.to itself flagged the shared-credentials path as non-production-supported. Migration in backlog, **not yet complete.** **Current state: Unified.to shared credentials in production; migration to own GCP credentials pending.** Security posture is now out-of-date on this claim.

**B — Railway *"on GCP/AWS"* but in EU.**
- Security posture (attachment:c1670611): *"Application hosting: Railway (on GCP/AWS)."*
- Multiple meetings: *"Supabase in US; Railway in EU"* — entity 439c10d6 / fathom:accdc8ef.

**Resolution:** Both true — Railway runs on GCP/AWS infra but deploys the application in EU regions. The security posture's *"on GCP/AWS"* describes Railway's underlying infrastructure, not the deployment region. The EU deployment is accurate and confirmed separately. Not contradictory but the phrasing obscures the EU location that matters for data residency.

**C — Anthropic model version in production (post-2026-04-30).**
- Anthropic email: recommended migrating from `claude-sonnet-4` / `-4-5` → `claude-sonnet-4-6` before 2026-04-30 or requests >200K tokens would fail.
- **No indexed source confirms what model string AskEffi's production system currently uses post-deadline.**

**Risk:** if AskEffi didn't migrate and uses >200K context windows, requests may be failing silently. The 2026-05-02→05-08 production week doesn't mention LLM model-string changes.

**D — Unified.to certification gap.** Unified.to listed in the security-posture subprocessor table as *"Security assessment on file"* — **notably absent the SOC 2 Type II certification that all other subprocessors carry.** Unified marketing claims *"strong security posture with our real-time Passthrough solution"* but does not claim SOC 2. **Unified.to is the weakest link in the subprocessor chain compliance-wise.**

---

## Gaps

**G-1 — Exact Anthropic model string in production.** Indexed data doesn't confirm what `claude-*` model string is currently deployed post-2026-04-30 1M-context-beta retirement. Long-context prompts on the wrong string would fail silently.

**G-2 — Specific Next.js version.** Confirmed Next.js + TypeScript; version (v14, v15, etc.) not specified.

**G-3 — Specific GCP region for Vertex AI Search.** Multiple sources confirm Vertex; **no region** (`us-central1`, `europe-west1`, etc.) in indexed data.

**G-4 — Specific Railway region.** Confirmed *"EU"*; **exact region** (`europe-west`, specific city) not in indexed data.

**G-5 — Drive OAuth migration status.** As of 2026-05-08 *"started"* on migrating to own GCP credentials; in backlog, *"no user-visible change yet."* No completion date or current production state confirmed.

**G-6 — Python web framework.** FastAPI referenced once indirectly (internal email-splitter inspector). **Not explicitly confirmed as the framework powering the main Python API server.** No *"we use FastAPI"* / *"we use Flask"* statement.

**G-7 — Supabase plan tier and cost.** Lihu was asked to raise an API plan cap to ~$200/month (early 2026 meeting, entity 439c10d6); no current Supabase plan, Railway plan cost, or Anthropic API monthly spend confirmed.

**G-8 — Claude Agent SDK current version.** 2026-04-18 report shows 0.1.61 → 0.1.65; **no subsequent report confirms the version after that.** With 966 commits in week 2026-05-02→05-08, may have moved.

**G-9 — Whether Notion is still actively used.** Guy Feb 2026: *"the only seat we have on Notion is actually cloud code sitting on Notion."* Linear is the confirmed task-management tool. Whether Notion is still used or effectively replaced is unclear.

**G-10 — SSE / streaming infrastructure.** Production report confirms SSE for live scheduled-report progress + Railway edge-proxy heartbeat (~15s). Whether Railway runs edge workers, a standard server process, or another configuration for SSE is not specified.

**G-11 — `data_items` and `gfs_sync_items` schemas.** Central to the VAIS canon pipeline; full column schemas not in indexed data.

**G-12 — Python server: single process or multiple workers.** Scheduled-reports worker described as *"polling worker"* that *"ticks every minute"*; relationship to the main Python API server process is not explicit.

---

## See also
- [data-sources](data-sources.md) — per-source OAuth scope, sync model, internal/external toggle
- [product](product.md) — what the user sees on top of this stack
- [compliance](compliance.md) — security posture v1.1 + subprocessor list + RLS-as-floor / tools-as-ceiling architectural finding
- [financials](financials.md) — Anthropic API depletion events, Pilot bookkeeping, Carta plan
