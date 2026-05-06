---
authored_by: Zisser
date: 2026-05-06
status: spawning
context: |
  Oria created Doppler project `effi` with 6 envs (rnd, dev, testing, stg,
  prod, devops). Personals ON for rnd/dev/testing/devops; OFF for stg/prod.
  He's about to send a Service Account token (Admin role on project `effi`,
  workspace AskEffi). Live `dev-env` stays untouched — parallel-build cutover.

  Source plan: zisser/plans/2026-05-05-doppler-three-group-reorg.md
  Live inventory: that plan's table, lines 46–85.
related:
  - zisser/plans/2026-05-05-doppler-three-group-reorg.md
  - zisser/inbox/2026-05-05-fecli-doppler-bootstrap.md
---

# Doppler migration — team dispatch

## Token-independent prep (running NOW, parallel)

| Agent | Charter | Output | Stop condition |
|---|---|---|---|
| Wes-A | Write `scripts/doppler-migrate.ts` (Bun) — dry-run-default, `--apply` flag, reads `dev-env/{dev,dev_personal,ci}`, writes `effi/{dev,rnd,testing,devops}` per the mapping below | committed script, dry-run output lists every secret in `source/key → target/key` form | shellcheck/typecheck clean; dry-run prints full mapping; **does NOT execute against effi** |
| Explore-B | Enumerate every consumer of `dev-env` Doppler project across repo | `zisser/notes/2026-05-06-doppler-consumer-map.md` — file:line + proposed re-point diff per consumer | doc covers `.devcontainer/`, `scripts/`, `justfile`, `.github/workflows/`, `tools/` |
| Wes-C | `tools/devops-run/` skeleton (bash wrapper: `--recover`, `--setup-shares`, `--verify-share`); `tests/external/no-devops-in-default-shell.test.ts` (boundary assertion) | both committed; test red against current main (DevOps keys still in default env) | shellcheck-clean; test runs and fails for the right reason; `ssss` apt-install deferred to ceremony day |
| Wes-D | Land `docs/security/doppler-shape.md` — env shape, key→env mapping, runbook pointers | committed doc, replaces ad-hoc Doppler refs | matches reality of `effi` project + plan |

## Token arrival — fire sequence (sequential)

1. **Wes-E**: execute `doppler-migrate.ts --apply` with token in env. Verifies post-write with `--only-names` diff per env.
2. **Wes-F**: repoint devcontainer wrapper + scripts per Explore-B's map. Single commit.
3. **Smoke test**: fresh devcontainer; `just dev` boots; `just agent-dev` boots; `plan list`, `tunnel start`, `effi ask` all green.
4. **Brief on Oria's desk**: 4 deferred Qs distilled, Railway swap one-pager, ceremony invite draft.

## Source → target mapping (Wes-A reads this)

```
# App-class — source: dev-env/dev — target: effi/dev (root)
APP_ANTHROPIC_API_KEY, RESEND_API_KEY, MAILGUN_API_KEY, MAILGUN_WEBHOOK_SIGNING_KEY,
NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_AUTH_TOKEN,
NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY,
TOKEN_ENCRYPTION_KEY,
SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET,
UNIFIED_API_KEY, UNIFIED_WEBHOOK_SECRET, UNIFIED_WORKSPACE_ID,
SUPABASE_DB_PASSWORD, INBOUND_EMAIL_DOMAIN

# R&D shared — source: dev-env/dev — target: effi/rnd (root)
LINEAR_API_KEY, FIGMA_API_KEY, CONTEXT7_API_KEY,
USEGIN_SLACK_BOT_TOKEN, USEGIN_SLACK_APP_TOKEN,
CLOUDFLARE_TUNNEL_TOKEN

# R&D personal — source: dev-env/dev_personal — target: effi/rnd_oria (auto on Oria's first login)
FIGMA_PERSONAL_API_KEY, ATUIN_KEY, ATUIN_PASSWORD

# R&D personal — target: effi/rnd_nitsan
FIGMA_NITSAN_API_KEY

# Testing — source: dev-env/ci — target: effi/testing (root)
NO_BUDGET_KEY, GEMINI_API_KEY_DEV, CLAUDE_CODE_OAUTH_TOKEN

# DevOps — source: dev-env/dev — target: effi/devops (root). Conservative classification.
SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD_STAGING, GCP_SERVICE_ACCOUNT_JSON

# Stg / Prod — schema only (no values from dev-env). Wes-A creates the keys with
# placeholder string "TODO_FROM_RAILWAY" so the schema exists; Oria fills on Railway swap.

# Stale-pending-Oria-check — DO NOT migrate (drop):
SLACK_USER_TOKEN, SENTRY_PASSWORD, ORIA_RAILWAY_STAGING
```

## Boundary discipline (every Wes — bind in their charter)

- **Read-only on `dev-env`.** Never write, never delete.
- **Write only on `effi`.** Token is project-scoped.
- Doppler activity log captures everything → forensic trail.
- After cutover smoke-test passes, **first action** is reminding Oria to revoke + re-mint the bootstrap token.
