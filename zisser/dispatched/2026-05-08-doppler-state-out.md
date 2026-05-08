---
date: 2026-05-08
charter: zisser/dispatched/2026-05-08-doppler-state.md
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
audit_mode: read-only against Doppler dashboard, Railway, code
authored_by: general-purpose sub-agent (no persona, no skills loaded)
masking: names + presence only — no secret values shown
---

# Doppler — ground-truth audit, 2026-05-08

## 0. Methodology

Read-only against three live systems and the repo:

- `doppler` CLI (authenticated as user-CLI token `codespaces-brocoli`, last seen 2026-05-08T09:30Z) — `projects`, `configs`, `secrets --only-names`, `activity`. **No write commands issued.** `doppler service-accounts` and `doppler integrations` are NOT subcommands in this CLI version (3.75.3) — they are dashboard-only. Service-account / integration sections below are inferred from observable behavior + activity log, not direct API.
- `railway` CLI (4.42.1, via `tools/bin/railway` wrapper) — `variables --json -e {production,staging} -s {nextjs-app,python-services}`. No env switch, no writes.
- `gh secret list` — **403, integration lacks `secrets:read`**. CI section reconstructed from workflow YAML references alone.
- Ripgrep over `nextjs-app/`, `python-services/`, `scripts/`, `tools/`, `.devcontainer/`, `.github/workflows/`, root configs.

---

## 1. Doppler dashboard reality

### 1a. Projects (3)

| Project | Created | Status |
|---|---|---|
| `dev-env` | 2025-12-21 | Pre-migration source. Still live. Last activity 2026-05-08T09:29Z (a fetch). Last write 2026-05-05T12:03Z. |
| `effi` | 2026-05-06 | Migration target. Active. Last fetch 2026-05-08T09:29Z (fetched by this audit). |
| `example-project` | 2025-12-21 | Doppler default scaffold. No fetches ever. Inert. |

### 1b. `effi` configs (12 total — 9 root + 3 personal-overlay placeholders)

Configs grouped by environment branch, all under project `effi`:

| Environment | Config | Root | Locked | Initial fetch | Notes |
|---|---|---|---|---|---|
| dev | `dev` | yes | yes | 2026-05-06T14:02Z | App-class secrets for local devcontainer + python tests |
| dev | `dev_personal` | no | yes | (never fetched) | Per-user overlay placeholder; no secrets populated |
| rnd | `rnd` | yes | yes | 2026-05-06T14:02Z | Shared dev-keyboard tooling |
| rnd | `rnd_oria` | no | no | 2026-05-06T14:02Z | Oria's personal overlay |
| rnd | `rnd_nitsan` | no | no | 2026-05-06T14:02Z | Nitsan's personal overlay |
| rnd | `rnd_personal` | no | yes | (never fetched) | Template / unused placeholder |
| testing | `testing` | yes | yes | 2026-05-06T14:02Z | Local + browser-integration test runs |
| testing | `testing_gh_ci` | no | no | 2026-05-06T15:43Z | GitHub-Actions-shaped config (NOT actually consumed by CI — see §5) |
| testing | `testing_personal` | no | yes | (never fetched) | Unused placeholder |
| stg | `stg` | yes | yes | 2026-05-06T14:02Z | Has values, but not consumed by Railway-staging — see §6 |
| prod | `prod` | yes | yes | 2026-05-06T14:02Z | Has values, but not consumed by Railway-production — see §6 |
| devops | `devops` | yes | yes | 2026-05-06T14:02Z | Owner-grade keys, intentionally NOT loaded into default shell |
| devops | `devops_personal` | no | yes | (never fetched) | Unused placeholder |

### 1c. Secrets per `effi` config (names only, masked)

`DOPPLER_CONFIG`, `DOPPLER_ENVIRONMENT`, `DOPPLER_PROJECT` are auto-populated by Doppler in every config and omitted from the lists below.

| Config | Secret count (excl. Doppler-meta) | Names |
|---|---:|---|
| `effi/dev` | 20 | APP_ANTHROPIC_API_KEY · INBOUND_EMAIL_DOMAIN · MAILGUN_API_KEY · MAILGUN_WEBHOOK_SIGNING_KEY · NEXT_PUBLIC_SENTRY_DSN · NEXT_PUBLIC_TURNSTILE_SITE_KEY · RESEND_API_KEY · SENTRY_AUTH_TOKEN · SENTRY_DSN · SLACK_BOT_TOKEN · SLACK_CLIENT_ID · SLACK_CLIENT_SECRET · SLACK_SIGNING_SECRET · SUPABASE_DB_PASSWORD · TOKEN_ENCRYPTION_KEY · TURNSTILE_SECRET_KEY · UNIFIED_API_KEY · UNIFIED_WEBHOOK_SECRET · UNIFIED_WORKSPACE_ID |
| `effi/stg` | 20 | (identical name-set to `effi/dev`) |
| `effi/prod` | 20 | (identical name-set to `effi/dev`) |
| `effi/rnd` | 6 | CLOUDFLARE_TUNNEL_TOKEN · CONTEXT7_API_KEY · FIGMA_API_KEY · LINEAR_API_KEY · USEGIN_SLACK_APP_TOKEN · USEGIN_SLACK_BOT_TOKEN |
| `effi/rnd_oria` | 9 | (rnd 6) + ATUIN_KEY · ATUIN_PASSWORD · FIGMA_PERSONAL_API_KEY |
| `effi/rnd_nitsan` | 7 | (rnd 6) + FIGMA_NITSAN_API_KEY |
| `effi/testing` | 9 | APP_ANTHROPIC_API_KEY · CLAUDE_CODE_OAUTH_TOKEN · GEMINI_API_KEY_DEV · INBOUND_EMAIL_DOMAIN · NEXT_PUBLIC_SENTRY_DSN · NO_BUDGET_KEY · RESEND_API_KEY · SENTRY_AUTH_TOKEN · SENTRY_DSN |
| `effi/testing_gh_ci` | 9 | (identical name-set to `effi/testing`) |
| `effi/devops` | 3 | GCP_SERVICE_ACCOUNT_JSON · SUPABASE_ACCESS_TOKEN · SUPABASE_DB_PASSWORD_STAGING |
| `effi/dev_personal`, `effi/rnd_personal`, `effi/testing_personal`, `effi/devops_personal` | 0 (only Doppler-meta) | empty placeholders, never fetched |

### 1d. `dev-env` configs (legacy source, 3)

| Config | Secret count | Last fetch |
|---|---:|---|
| `dev-env/dev` | 39 | 2026-05-08T09:29Z (this audit's fetch — actual last *application* fetch is older) |
| `dev-env/dev_personal` | 41 | 2026-05-06T14:01Z |
| `dev-env/ci` | 15 | 2026-05-06T14:01Z |

`dev-env/dev` is a strict superset of every `effi/*` name-set combined, plus three retired secrets confirmed dropped per migration plan (`SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING`) and one DevOps key now isolated (`SUPABASE_ACCESS_TOKEN`).

Last *write* to `dev-env`: 2026-05-05T12:03:40Z (the day before migration). Since 2026-05-06 the project has been read-only.

### 1e. Service accounts

CLI does not expose `service-accounts`. From the activity log + `doppler-migrate.ts` source:

| Token | Project access | State |
|---|---|---|
| `zisser-bootstrap-2026-05` | `effi` (write, used during migration) | Per `notes/2026-05-06-doppler-migration-done.md`: still active, scheduled for revocation post-Railway swap. **Cannot verify from CLI** — dashboard-only check. |
| `codespaces-brocoli` (current CLI session) | `dev-env` + `effi` (read) | Active, last seen 2026-05-08T09:30Z |
| Older CLI tokens | various | Activity log shows multiple "Created/Revoked an auth token for the Doppler CLI" events 2026-02 → 2026-05; not enumerable from CLI |

### 1f. Integrations

CLI does not expose `integrations`. Indirect evidence:

- **Railway**: `railpack.json` (both services) makes no Doppler reference. Railway env vars (§4) appear pasted-direct, not Doppler-synced. The migration plan's Q-D ("Where do stg/prod values live today?") was never formally answered to "Doppler integration"; observed Railway state is consistent with "Railway-native env vars."
- **GitHub**: workflows have no `doppler` step (§5); CI uses `${{ secrets.* }}` directly.
- Conclusion: **no Doppler integrations are wired today.** `effi/stg` and `effi/prod` exist but are not the read-source for any production workload.

---

## 2. Code consumers — every Doppler-tracked secret name, by consumer file

Aggregated from rg over `nextjs-app/`, `python-services/`, `scripts/`, `tools/`, `.devcontainer/`, `.github/workflows/`. Excludes `node_modules`, `.next/`, `.venv/`, tests, zettels, persona docs.

### 2a. App-class (in `effi/{dev,stg,prod}`)

| Secret | Primary consumers (file:line if singular, else representative) | Files |
|---|---|---:|
| `APP_ANTHROPIC_API_KEY` | `python-services/agent_api/agent/auth.py`; `agent/sync_worker.py`; `bootstrap/config.py` | 19 |
| `INBOUND_EMAIL_DOMAIN` | `nextjs-app/app/api/webhooks/mailgun/*`; `python-services/agent_api/email/*` | 10 |
| `MAILGUN_API_KEY` | `python-services/experiments/email_threading_experiment.py` (only consumer) + `scripts/doppler-migrate.ts` (manifest) | 2 |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | `nextjs-app/app/api/webhooks/mailgun/*`; `nextjs-app/lib/env.ts` | 9 |
| `NEXT_PUBLIC_SENTRY_DSN` | `nextjs-app/sentry.*.config.ts`; instrumentation files | 13 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `nextjs-app/components/turnstile/*`; `nextjs-app/lib/env.ts` | 6 |
| `RESEND_API_KEY` | `nextjs-app/lib/email/*`; `nextjs-app/lib/env.ts` | 11 |
| `SENTRY_AUTH_TOKEN` | `nextjs-app/sentry.*.config.ts`; `python-services/agent_api/sentry_config.py`; `tools/sentry-cli/*` | 10 |
| `SENTRY_DSN` | `python-services/agent_api/sentry_config.py`; `tools/sentry-cli/*` | 11 |
| `SLACK_BOT_TOKEN` | None outside `scripts/doppler-migrate.ts` manifest. **NO PRODUCT CODE READS THIS** | 1 |
| `SLACK_CLIENT_ID` | `nextjs-app/app/api/integrations/slack/oauth/*`; `nextjs-app/lib/env.ts` | 6 |
| `SLACK_CLIENT_SECRET` | (same Slack OAuth path) | 5 |
| `SLACK_SIGNING_SECRET` | `nextjs-app/app/api/integrations/slack/events/route.ts`; `nextjs-app/lib/env.ts` | 6 |
| `SUPABASE_DB_PASSWORD` | `tools/preflight/src/checks/supabase.ts` (preflight only) + migration manifest | 2 |
| `TOKEN_ENCRYPTION_KEY` | `nextjs-app/lib/token-crypto.ts`; `nextjs-app/lib/env.ts`; `nextjs-app/scripts/backfill-slack-token-encryption.ts` | 9 |
| `TURNSTILE_SECRET_KEY` | `nextjs-app/lib/services/turnstile.ts`; `nextjs-app/lib/env.ts` | 4 |
| `UNIFIED_API_KEY` | `python-services/agent_api/connectors/unified_client.py`; `python-services/agent_api/sharepoint/graph.py`; `tools/unified-cli/*`; many connectors | 32 |
| `UNIFIED_WEBHOOK_SECRET` | `nextjs-app/app/api/webhooks/unified/*`; `python-services/agent_api/connectors/unified_client.py` | 15 |
| `UNIFIED_WORKSPACE_ID` | (same Unified paths) | 15 |

### 2b. R&D class (in `effi/rnd` + per-user overlays)

| Secret | Consumer | Files |
|---|---|---:|
| `LINEAR_API_KEY` | `tools/plan-cli/src/commands/*.ts` (every command file: checkout, watch, list, reorder, show, close, create, labels, browse, history, search, push, update, start) — 14 files | 19 |
| `FIGMA_API_KEY` | `tools/figma/*` (only) | small |
| `FIGMA_PERSONAL_API_KEY` | Only referenced by `scripts/doppler-migrate.ts` manifest. **No code consumer** (migration kept it on personal overlay; consumer is the Figma desktop tool, not repo code) | 1 |
| `FIGMA_NITSAN_API_KEY` | Only referenced by `scripts/doppler-migrate.ts` manifest. **No code consumer** | 1 |
| `CLOUDFLARE_TUNNEL_TOKEN` | Only referenced by manifest. Consumed by tunnel daemon outside repo | 1 |
| `CONTEXT7_API_KEY` | Used by Claude Code for the context7 MCP server (consumed by `claude-ci-agent.yml` via `secrets.CONTEXT7_API_KEY` — GH-side); no `process.env.CONTEXT7_API_KEY` in repo | manifest only |
| `USEGIN_SLACK_BOT_TOKEN` | `tools/dx/src/slack/config.ts` (canonical reader); `tools/dx/src/slack/whoami.ts`; `tools/dx/src/slack/index.ts` | ~5 |
| `USEGIN_SLACK_APP_TOKEN` | `usegin/research/dev-channel-slack-prior-art/probes/*` (R&D probes for socket-mode) | 5 |
| `ATUIN_KEY`, `ATUIN_PASSWORD` | No repo consumer. Consumed by the `atuin` shell-history daemon (external tool) | 0 |

### 2c. Testing class (in `effi/testing` + `effi/testing_gh_ci`)

| Secret | Consumer | Files |
|---|---|---:|
| `CLAUDE_CODE_OAUTH_TOKEN` | `.github/workflows/{claude,claude-code-review,claude-ci-agent,debug-runner,e2e-tests,external-service-tests,python-integration-tests,retro-analysis}.yml` (8 workflows) — pulled from `secrets.CLAUDE_CODE_OAUTH_TOKEN` (GH), NOT from Doppler | 32 |
| `GEMINI_API_KEY_DEV` | `python-services/agent_api/agent/config.py`; many `python-services/experiments/*.py`; CI workflows | 54 |
| `NO_BUDGET_KEY` | `python-services/agent_api/*`; `.github/workflows/python-integration-tests.yml` (`secrets.NO_BUDGET_KEY`) | 3 |
| (other testing-class secrets are duplicates of app-class names: `APP_ANTHROPIC_API_KEY`, `INBOUND_EMAIL_DOMAIN`, `RESEND_API_KEY`, `SENTRY_*`) | | |

### 2d. DevOps class (in `effi/devops`)

| Secret | Consumer | Files |
|---|---|---:|
| `GCP_SERVICE_ACCOUNT_JSON` | `python-services/agent_api/bootstrap/gcp_credentials.py`; `python-services/agent_api/vais/config.py`; many VAIS experiments; `.github/workflows/external-service-tests.yml` | 22 |
| `SUPABASE_ACCESS_TOKEN` | Only `python-services/experiments/*` (latency analysis spikes) — production code does NOT read this | 15 |
| `SUPABASE_DB_PASSWORD_STAGING` | `tools/preflight/src/checks/supabase.ts`; `.github/workflows/external-service-tests.yml`-adjacent | 3 |

### 2e. Special / non-Doppler

| Secret | Where it actually comes from | Consumer | Files |
|---|---|---|---:|
| `INTERNAL_RPC_SECRET` | **Railway only** (both services, prod + stg). NOT in any Doppler config. Local dev: synthesized by `scripts/set-env-lib/set-env.ts` (`LOCAL_INTERNAL_RPC_SECRET`) | `nextjs-app/lib/internal-rpc/sign.ts`; `python-services/agent_api/internal_rpc/verify.py`; `tools/e2e/*` | 22 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Railway only** for stg/prod. Local: hard-coded in `scripts/set-env-lib/set-env.ts` (`LOCAL_SUPABASE_*`). NOT in Doppler | nextjs-app + python-services widely | many |
| `GEMINI_API_KEY` | **Railway production only** (Railway-side rename of `GEMINI_API_KEY_DEV`). Code reads `GEMINI_API_KEY_DEV`/`_STAGING` and falls back | `python-services/agent_api/agent/config.py` | 31 |
| `GEMINI_API_KEY_STAGING` | **Railway staging only** | (same) | 5 |
| `EFFI_USER_WORKSPACES_BASE` | **Railway only** | `python-services/agent_api/agent/workspace.py` | small |
| `UNIFIED_ENV` | **Railway only** | `python-services/agent_api/connectors/unified_client.py` | small |
| `VAIS_GCP_PROJECT`, `VAIS_GCS_BUCKET` | **Railway only** | `python-services/agent_api/vais/config.py` (with code defaults) | several |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_DEMO_WORKSPACE_ID`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `WEBHOOK_PUBLIC_URL`, `PYTHON_API_PRIVATE_URL`, `RAILWAY_SERVICE_NEXTJS_APP_URL` | **Railway only** (deploy-shape vars) | nextjs-app various | many |

---

## 3. Devcontainer shell injection — what loads into a fresh shell

Trace of `.devcontainer/doppler-wrapper.sh` end-to-end:

### 3a. Entry conditions

The wrapper is sourced by every interactive bash login (devcontainer default). Two paths:

1. **`DOPPLER_PROJECT` already set** (subshell of `doppler run`, or Claude Code sandbox where `DOPPLER_PROJECT` is set in `settings.local.json` env block) → just `set -a; . /tmp/.doppler-env-cache; set +a` and stop. The cache file is the SoT in this path.
2. **`DOPPLER_PROJECT` not set** + container/Codespaces detected → run `scripts/ensure-auth.sh` (interactive `doppler login` / `gh auth login` if needed), then download + merge configs into the cache, then `exec bash`.

### 3b. Configs merged (bottom-up precedence: per-user > rnd > dev)

```
doppler secrets download --no-file --format=env --project effi --config dev    >> $CACHE
doppler secrets download --no-file --format=env --project effi --config rnd    >> $CACHE
doppler secrets download --no-file --format=env --project effi --config rnd_${LIVE_USER}  >> $CACHE   # only if config exists
```

`$LIVE_USER` is read from `dx identify --json | jq -r '.user'`. For the team:
- `oria` → loads `effi/rnd_oria` (9 R&D secrets including ATUIN + FIGMA_PERSONAL).
- `nitsan` → loads `effi/rnd_nitsan` (7 secrets including FIGMA_NITSAN).
- `lihu` → no `effi/rnd_lihu` config exists; only `dev` + `rnd` load. (Detected: `doppler configs --project effi --json | jq -e '.[] | select(.name=="rnd_lihu")'` returns no match.)

### 3c. Configs intentionally NOT merged

- `effi/devops` — owner-grade keys; reachable only via `tools/devops-run/devops-run --recover` (Shamir 2-of-3, currently a skeleton — Shamir calls stubbed pending `ssss` apt install).
- `effi/stg`, `effi/prod` — server-only.
- `effi/testing*` — only loaded by GitHub Actions (in theory; see §5 — actually CI doesn't pull from Doppler at all).

### 3d. End-state: what's in `process.env` after fresh shell (for live user `oria`)

26 named app+rnd-overlay secrets, plus the 3 Doppler-meta names. Names only:

```
APP_ANTHROPIC_API_KEY · INBOUND_EMAIL_DOMAIN · MAILGUN_API_KEY ·
MAILGUN_WEBHOOK_SIGNING_KEY · NEXT_PUBLIC_SENTRY_DSN ·
NEXT_PUBLIC_TURNSTILE_SITE_KEY · RESEND_API_KEY · SENTRY_AUTH_TOKEN ·
SENTRY_DSN · SLACK_BOT_TOKEN · SLACK_CLIENT_ID · SLACK_CLIENT_SECRET ·
SLACK_SIGNING_SECRET · SUPABASE_DB_PASSWORD · TOKEN_ENCRYPTION_KEY ·
TURNSTILE_SECRET_KEY · UNIFIED_API_KEY · UNIFIED_WEBHOOK_SECRET ·
UNIFIED_WORKSPACE_ID                                                  (effi/dev — 19)

CLOUDFLARE_TUNNEL_TOKEN · CONTEXT7_API_KEY · FIGMA_API_KEY ·
LINEAR_API_KEY · USEGIN_SLACK_APP_TOKEN · USEGIN_SLACK_BOT_TOKEN     (effi/rnd — 6)

ATUIN_KEY · ATUIN_PASSWORD · FIGMA_PERSONAL_API_KEY                  (effi/rnd_oria — 3 net new)
                                                                      (FIGMA_API_KEY overlay-overrides
                                                                       the rnd-class one if both set)
```

DevOps secrets (`SUPABASE_ACCESS_TOKEN`, `GCP_SERVICE_ACCOUNT_JSON`, `SUPABASE_DB_PASSWORD_STAGING`) are absent. The boundary test at `tests/external/doppler-no-devops-in-default-shell.test.ts` is the standing assertion that this stays absent.

### 3e. Secondary consumers of the same cache

- `BASH_ENV=/tmp/.doppler-bash-env` is created by the wrapper so non-interactive shells (e.g. Claude Code sandbox calling out to bash) can `set -a; . /tmp/.doppler-env-cache; set +a` without invoking the Doppler CLI.
- `scripts/container.sh::cmd_tmux` (line 202) runs `ensure-auth.sh && exec doppler run -- bash -c "tmux ..."` — this path uses `doppler run` directly (single config, project default `effi`/`dev` from `doppler.yaml`), NOT the merged cache.

---

## 4. Railway — environments, vars, source

`doppler.yaml` repo root: `setup: project: effi, config: dev`. Both Railway services have `railpack.json` configs that do NOT mention Doppler — vars are pasted into Railway directly.

### 4a. nextjs-app service

| Env | Var count | Names (excl. `RAILWAY_*` deploy-shape) |
|---|---:|---|
| production | 13 | INBOUND_EMAIL_DOMAIN · INTERNAL_RPC_SECRET · MAILGUN_WEBHOOK_SIGNING_KEY · NEXT_PUBLIC_DEMO_WORKSPACE_ID · NEXT_PUBLIC_LANDING_URL · NEXT_PUBLIC_SENTRY_DSN · NEXT_PUBLIC_SENTRY_ENVIRONMENT · NEXT_PUBLIC_SITE_URL · NEXT_PUBLIC_TURNSTILE_SITE_KEY · PYTHON_API_PRIVATE_URL · RESEND_API_KEY · SENTRY_AUTH_TOKEN · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY · SUPABASE_URL · TURNSTILE_SECRET_KEY · UNIFIED_WEBHOOK_SECRET · WEBHOOK_PUBLIC_URL |
| staging | +3 | (production set) + SLACK_CLIENT_ID · SLACK_CLIENT_SECRET · SLACK_SIGNING_SECRET · RAILWAY_SERVICE_STORYBOOK_URL |

Notable: **production nextjs-app has no Slack secrets**, staging does.

### 4b. python-services service

| Env | Var count | Names (excl. `RAILWAY_*`) |
|---|---:|---|
| production | 19 | APP_ANTHROPIC_API_KEY · CLAUDE_CODE_OAUTH_TOKEN · EFFI_USER_WORKSPACES_BASE · GCP_SERVICE_ACCOUNT_JSON · GEMINI_API_KEY · INTERNAL_RPC_SECRET · NEXT_PUBLIC_SITE_URL · RESEND_API_KEY · SENTRY_AUTH_TOKEN · SENTRY_DSN · SENTRY_ENVIRONMENT · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY · SUPABASE_URL · UNIFIED_API_KEY · UNIFIED_ENV · UNIFIED_WEBHOOK_SECRET · UNIFIED_WORKSPACE_ID · VAIS_GCP_PROJECT · VAIS_GCS_BUCKET |
| staging | same shape | identical, but `GEMINI_API_KEY` → `GEMINI_API_KEY_STAGING` (different name, not value) |

### 4c. Source — pasted-direct, NOT Doppler-synced

Three pieces of evidence:
- No Doppler integration mention in either `railpack.json`, `nextjs-app/railway.json`, or any `.github/workflows/*.yml`.
- `effi/{stg,prod}` configs were created 2026-05-06 with placeholder `TODO_FROM_RAILWAY` values per `notes/2026-05-06-doppler-migration-done.md`. Railway is the source today.
- Var name shapes diverge from `effi/{stg,prod}`:
  - Railway has `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `INTERNAL_RPC_SECRET`, `GEMINI_API_KEY_STAGING`, `EFFI_USER_WORKSPACES_BASE`, `VAIS_GCP_PROJECT`, `VAIS_GCS_BUCKET`, `UNIFIED_ENV`, `WEBHOOK_PUBLIC_URL`, `NEXT_PUBLIC_DEMO_WORKSPACE_ID`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `PYTHON_API_PRIVATE_URL`, `SENTRY_ENVIRONMENT`, `CLAUDE_CODE_OAUTH_TOKEN`. None of these exist in `effi/{stg,prod}`.
  - `effi/{stg,prod}` has `SUPABASE_DB_PASSWORD`, `MAILGUN_API_KEY`, `SLACK_BOT_TOKEN`, `TOKEN_ENCRYPTION_KEY`. None in Railway prod for nextjs-app.

Verdict: **Railway and Doppler are completely independent today.** `effi/{stg,prod}` is a name-shadow of `effi/dev`, populated with placeholders per the migration plan but never read by anything.

---

## 5. CI — what GitHub Actions actually pull

`.github/workflows/` has 20 YAML files. **None invoke `doppler` or set `DOPPLER_TOKEN`.** All secret references are `${{ secrets.<NAME> }}` direct from GitHub Actions repo secrets.

`gh secret list` against this repo returns 403 (integration lacks `secrets:read`), so the actual GitHub-side secret list cannot be enumerated. Reconstructed from workflow YAML references:

| Secret name (GitHub Actions) | Consuming workflow(s) |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | claude.yml · claude-ci-agent.yml · claude-code-review.yml · debug-runner.yml · e2e-tests.yml · external-service-tests.yml · python-integration-tests.yml · retro-analysis.yml |
| `APP_ANTHROPIC_API_KEY` | debug-runner.yml · e2e-tests.yml · external-service-tests.yml · python-integration-tests.yml |
| `GEMINI_API_KEY_DEV` | debug-runner.yml · e2e-tests.yml · external-service-tests.yml · python-integration-tests.yml |
| `NO_BUDGET_KEY` | python-integration-tests.yml |
| `CONTEXT7_API_KEY` | claude-ci-agent.yml |
| `GCP_SERVICE_ACCOUNT_JSON` | external-service-tests.yml (3 jobs) |
| `SENTRY_AUTH_TOKEN` | external-service-tests.yml · sentry-releases.yml |
| `SENTRY_DSN` | external-service-tests.yml |
| `NEXT_PUBLIC_SENTRY_DSN` | external-service-tests.yml |

Doppler config `effi/testing_gh_ci` was created 2026-05-06 with the same name-set CI references — but **nothing wires it to GitHub Actions**. It's a dormant mirror, not a source.

---

## 6. Drift vs `notes/2026-05-06-doppler-migration-done.md`

The notes file claims the migration ran, with these specific commitments:

| Claim in notes | Reality 2026-05-08 | Drift |
|---|---|---|
| 9 configs (dev, rnd, rnd_oria, rnd_nitsan, testing, testing_gh_ci, devops, stg, prod) | 12 configs — the 9 named **plus** 3 inert `*_personal` placeholders (dev_personal, rnd_personal, testing_personal, devops_personal — that's 4, but rnd_oria + rnd_nitsan are real) | Minor — placeholders not in the brief, but harmless; never fetched |
| 41 real values copied from `dev-env`, plus 38 placeholders for stg/prod | Cannot verify "real vs placeholder" without reading values (against charter). Activity log shows ~70+ writes on 2026-05-06, consistent. `effi/{stg,prod}` show 20 named secrets each = 40 total, vs the 38-placeholder claim. | Minor count mismatch (40 vs 38) — within rounding |
| Devcontainer wrapper merges App + R&D + personal overlay; DevOps boundary held | Confirmed by reading wrapper. `effi/devops` not in the merge list. | None |
| `dev-env` untouched, live rollback intact | Last write to `dev-env/dev` was 2026-05-05T12:03Z (day before migration). 2026-05-06 onwards: read-only. | None |
| Bootstrap SA token `zisser-bootstrap-2026-05` still active | Cannot verify from CLI (no `service-accounts` subcommand). Activity log doesn't show a revocation event. **Likely still active**, per notes' own framing ("revoke when you're confident"). | Open — token rotation has not happened |
| Commits c459970a5 + 32f4011f7 | (out of audit scope per charter — but file paths in those commits match `scripts/doppler-migrate.ts` + `.devcontainer/doppler-wrapper.sh` + `doppler.yaml` referencing project `effi`) | None |
| Step 3 "Railway swap" — point Railway integration at `effi`, OR paste real values into Doppler stg/prod, OR keep Railway-native and leave Doppler placeholders | **Outcome: option (c) by default-no-action.** Railway is unchanged; `effi/{stg,prod}` are unconsumed schema-only shadows. | **Material drift from intent if (a) or (b) was the goal; conformant with (c).** |
| Step 4 "Revoke bootstrap SA token" | Not done (per above) | Open |
| Step 5 "Decommission `dev-env`" — wait ~1 week | 2 days elapsed, project still live, still being read for fallback | Pending by design |
| `SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING` dropped | Confirmed absent from every `effi/*` config. Still present in `dev-env/dev` and `dev-env/dev_personal`. | None |
| Notes-for-Slack-agent: 5 Slack tokens land in `effi/{dev,rnd}` after fresh shell | Confirmed: `SLACK_BOT_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` in `effi/dev`; `USEGIN_SLACK_BOT_TOKEN`, `USEGIN_SLACK_APP_TOKEN` in `effi/rnd`. | None |
| `tests/external/doppler-no-devops-in-default-shell.test.ts` "goes green once a shell starts under the new wrapper" | Wrapper is in place; test would now pass against a fresh shell. Cannot run from this audit (read-only) but the boundary configs match. | None |
| The 4 deferred questions (A–D) | A–D unresolved per the notes' own log. No subsequent activity in Doppler to indicate any of them moved. | Open by design |

---

## 7. Stranded items

### 7a. Secrets in Doppler with NO repo consumer

| Secret | Where | Why stranded |
|---|---|---|
| `SLACK_BOT_TOKEN` (in `effi/{dev,stg,prod}`) | Migrated from `dev-env/dev` per migration plan. Only reference in repo is `scripts/doppler-migrate.ts` manifest. **No `process.env.SLACK_BOT_TOKEN`** in nextjs-app/python-services/tools. The Slack OAuth path in `nextjs-app/app/api/integrations/slack/oauth/*` reads per-workspace tokens from the database, not env. | Likely a vestige — the team-Slack bot uses `USEGIN_SLACK_BOT_TOKEN` (separate); `SLACK_BOT_TOKEN` may be left over from an earlier integration shape |
| `MAILGUN_API_KEY` (in `effi/{dev,stg,prod}`) | Only consumer is `python-services/experiments/email_threading_experiment.py` (an experiment). Production mailgun outbound uses Resend; mailgun is inbound-only and the inbound path uses `MAILGUN_WEBHOOK_SIGNING_KEY`, not the API key. | Production code does NOT read this; stays in dev for the experiment script |
| `FIGMA_PERSONAL_API_KEY` (in `effi/rnd_oria`) | No `process.env.FIGMA_PERSONAL_API_KEY` lookup in repo. Consumed by Figma desktop CLI tooling outside repo. | By design — personal-only |
| `FIGMA_NITSAN_API_KEY` (in `effi/rnd_nitsan`) | Same — no repo lookup | By design |
| `ATUIN_KEY`, `ATUIN_PASSWORD` (in `effi/rnd_oria`) | Consumed by `atuin` shell-history daemon (sets up via env at shell init), no `process.env.ATUIN_*` lookup in repo code | By design — daemon-consumed |
| `CLOUDFLARE_TUNNEL_TOKEN` (in `effi/rnd*`) | No repo lookup. Consumed by `cloudflared` daemon outside repo | By design |
| `CONTEXT7_API_KEY` (in `effi/rnd*`) | Consumed by `claude-ci-agent.yml` from GH secrets, not Doppler. No repo `process.env` reader. | Stranded for repo agents (Claude Code uses the env var via `claude` CLI MCP config, not via repo code) |
| `effi/testing_gh_ci` config | Built to mirror CI's needs but CI does not pull from Doppler | Dormant mirror — see §5 |
| `SUPABASE_DB_PASSWORD` (in `effi/{dev,stg,prod}`) | Only consumer is `tools/preflight/src/checks/supabase.ts` | Used by preflight only |

### 7b. Secrets expected by code but missing from Doppler

| Secret | Where expected | Where it actually comes from |
|---|---|---|
| `INTERNAL_RPC_SECRET` | nextjs-app + python-services prod paths (`lib/internal-rpc/sign.ts`, `agent_api/internal_rpc/verify.py`) | Railway env (both services, both envs); local synthesized by `scripts/set-env-lib/set-env.ts` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Both services, prod + stg | Railway env; local hard-coded in `scripts/set-env-lib/set-env.ts` |
| `GEMINI_API_KEY` | `python-services/agent_api/agent/config.py` (production) | Railway production env (rename of `GEMINI_API_KEY_DEV`) |
| `GEMINI_API_KEY_STAGING` | (same file) | Railway staging env |
| `EFFI_USER_WORKSPACES_BASE` | `python-services/agent_api/agent/workspace.py` | Railway env (with code default) |
| `UNIFIED_ENV` | `python-services/agent_api/connectors/unified_client.py` | Railway env (with code default `"Production"`) |
| `VAIS_GCP_PROJECT`, `VAIS_GCS_BUCKET` | `python-services/agent_api/vais/config.py` | Railway env (with code defaults) |
| `WEBHOOK_PUBLIC_URL`, `PYTHON_API_PRIVATE_URL`, `NEXT_PUBLIC_*_URL`, `NEXT_PUBLIC_DEMO_WORKSPACE_ID`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ENVIRONMENT` | nextjs/python production paths | Railway env (deploy-shape) |

### 7c. Secrets in Railway but not in code AND not in Doppler

None observed. Every Railway-only var has a code consumer.

### 7d. CI/GH-secret references with no repo `process.env` consumer

- `CONTEXT7_API_KEY` — consumed by Claude Code's `~/.claude/mcp_servers.json` or equivalent MCP config (outside repo); GH workflow injects but no `process.env.CONTEXT7_API_KEY` in repo TS/JS/PY.

---

## 8. Two-line summary

**Doppler today is a clean dev-shell secrets layer:** the `effi` project (12 configs) reliably feeds the devcontainer with App + R&D + per-user-overlay merging; `dev-env` is read-only fallback; the DevOps boundary is enforced by the wrapper not loading `effi/devops` and by a standing test.

**The migration is ~70% landed:** dev-side cutover is complete (boundary held, configs populated, wrapper repointed, schema-drift script in place); Railway swap (`effi/stg`, `effi/prod` carry placeholders, Railway env vars are pasted-direct and unsynced), CI cutover (`effi/testing_gh_ci` exists but workflows still pull from GitHub Actions repo secrets), bootstrap-SA-token revocation, and `dev-env` decommission are all open.

---

## Appendix — files touched (read-only) and references

- `/workspaces/test-mvp/.devcontainer/doppler-wrapper.sh`
- `/workspaces/test-mvp/scripts/ensure-auth.sh`
- `/workspaces/test-mvp/scripts/container.sh`
- `/workspaces/test-mvp/scripts/check-doppler-schema.ts`
- `/workspaces/test-mvp/scripts/doppler-migrate.ts`
- `/workspaces/test-mvp/scripts/set-env-lib/set-env.ts`
- `/workspaces/test-mvp/doppler.yaml`
- `/workspaces/test-mvp/tools/devops-run/devops-run`, `tools/devops-run/README.md`
- `/workspaces/test-mvp/tools/dx/src/slack/{config,whoami,index}.ts`
- `/workspaces/test-mvp/tools/plan-cli/src/commands/*.ts` (LINEAR_API_KEY consumers)
- `/workspaces/test-mvp/tests/external/doppler-no-devops-in-default-shell.test.ts`
- `/workspaces/test-mvp/.github/workflows/*.yml` (all 20)
- `/workspaces/test-mvp/nextjs-app/lib/env.ts`, `nextjs-app/types/process-env.d.ts`
- `/workspaces/test-mvp/python-services/agent_api/bootstrap/config.py`, `internal_rpc/verify.py`, `connectors/unified_client.py`, `vais/config.py`, `agent/{config,auth,workspace}.py`

Live snapshots cached under `/tmp/dop-state/` for cross-checking (effi-{dev,stg,prod,rnd,rnd_oria,rnd_nitsan,testing,testing_gh_ci,devops}.txt; devenv-{dev,dev_personal,ci}.txt; rw-{production,staging}-{nextjs-app,python-services}.json).

## Appendix — disclosed exposure during audit

While extracting Railway python-services var names, one early `railway variables --kv` call streamed the multi-line `GCP_SERVICE_ACCOUNT_JSON` value (including `private_key`) into a tmp file and into terminal output for the python-services prod + staging environments. Re-extraction was then done via `railway variables --json | jq -r 'keys[]'`, and the exposing files were deleted. The values were never written to the audit output. Action item for caller: this audit's session transcript briefly contained a real GCP service-account private key — treat the transcript itself as sensitive.
