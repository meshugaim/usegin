---
authored_by: Zisser
date: 2026-05-05
status: research-pass complete — approval-ready (Oria reads once, Y/N, then we execute)
input: lihu/chat 2026-05-05
related:
  - zisser/inbox/2026-05-05-fecli-doppler-bootstrap.md (the FECLI thread that
    surfaced the "secret in Doppler" question; this plan is the prerequisite)
  - zisser/inbox/2026-05-01-casa-demo-video-and-sleeper-deploy.md (first
    mention of "Doppler personal" as a separate place)
  - zisser/dispatched/2026-05-05-doppler-reorg-deep-research.md (charter that
    drove this research pass)
---

# Doppler reorganization — three groups (App / R&D / DevOps)

## What Oria wants (verbatim summary)

Three groups in Doppler:

1. **App** — app secrets / app envars; the runtime stuff Next.js and
   python-services need to boot.
2. **R&D** — everything experiments/dev need at the keyboard so it's
   easy to use `gcloud` CLI, Linear API, Figma API, Slack probes, etc.
3. **DevOps** — owner-grade. Secrets we hand Claude when we want him to
   act *as an owner*: create apps, delete apps, see the credit card.
   This group must be **rotatable / deletable** and accessed through a
   **single, smart, one-entry-point** path — "bring the key" only when
   needed, not always-on in the shell.

Oria's confirmed answer on key-holder policy (the load-bearing Q in v1):
**armageddon-key 3-dev split** (Oria, Lihu, Nitsan), Shamir Secret Sharing
**2-of-3**, one share per dev in their personal vault, reconstructed
ceremoniously into a single shell for each DevOps action. Trust model: the
three trust each other; the friction is the ritual, not the trust.

## Current state — live ground truth (sampled 2026-05-05)

Pulled directly from Doppler with `doppler secrets --only-names`. **One
project (`dev-env`) with three configs (`dev`, `dev_personal`, `ci`),
everything mixed.** Owner-grade keys sit alongside app runtime keys
alongside dev tooling.

### Live secret inventory

| Name | Group (proposed) | Current configs | Why | Known consumers (rg over repo + workflows) |
|---|---|---|---|---|
| `APP_ANTHROPIC_API_KEY` | **App** | dev, dev_personal, ci | Next.js + python-services runtime LLM key | python-services tests/integration/claude/*, agent_api/bootstrap, GH workflows (claude.yml, claude-ci-agent.yml) |
| `CLAUDE_CODE_OAUTH_TOKEN` | **App** | ci | Used by Claude bot in workflows + e2e tests | .github/workflows/claude.yml, claude-ci-agent.yml; tests/e2e/tests/* |
| `RESEND_API_KEY` | **App** | dev, dev_personal, ci | Outbound email — app sends transactional mail | nextjs-app/lib/email.ts, lib/env.ts, scripts/set-env-lib |
| `INBOUND_EMAIL_DOMAIN` | **App** | dev, dev_personal, ci | App config for email parsing | nextjs-app/lib/services/project-email.ts, lib/env.ts |
| `MAILGUN_API_KEY` | **App** | dev, dev_personal | App outbound provider for inbound email replies | tools/bin/mailgun-send, python-services/experiments/email_threading_experiment.py |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | **App** | dev, dev_personal | Verifies inbound email webhook signatures | nextjs-app/app/api/webhooks/mailgun/inbound/route.ts, tests, integrations doc |
| `NEXT_PUBLIC_SENTRY_DSN` | **App** | dev, dev_personal, ci | Public DSN, baked into client bundle | nextjs-app/sentry.server.config.ts, Dockerfile ARG/ENV, set-env.ts, GH workflows |
| `SENTRY_DSN` | **App** | dev, dev_personal, ci | Server-side Sentry DSN | python-services/agent_api/bootstrap/config.py, set-env.ts, GH workflows |
| `SENTRY_AUTH_TOKEN` | **App** | dev, dev_personal, ci | Source-map upload at Next build time | nextjs-app/Dockerfile build, GH workflows nextjs-build/docker-build, sentry-releases.yml |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **App** | dev, dev_personal | Cloudflare Turnstile (CAPTCHA) public site key | nextjs-app/app/embed/demo-signup, app/demo, Dockerfile ARG/ENV |
| `TURNSTILE_SECRET_KEY` | **App** | dev, dev_personal | Server-side Turnstile verification | nextjs-app/lib/services/turnstile.ts |
| `TOKEN_ENCRYPTION_KEY` | **App** | dev, dev_personal | App-side AES key for stored OAuth tokens | usegin/research/token-encryption/, audits, lib (active production secret) |
| `SLACK_CLIENT_ID` | **App** | dev, dev_personal | App-side Slack OAuth (workspace-Slack feature) | nextjs-app/app/actions/workspace-slack.ts, usegin/research/slack-* |
| `SLACK_CLIENT_SECRET` | **App** | dev, dev_personal | App-side Slack OAuth secret | usegin/research/slack-marketplace, experiments/slack-direct |
| `SLACK_SIGNING_SECRET` | **App** | dev, dev_personal | Slack webhook signature verification | usegin/comptroller/audits, security-questionnaire, experiments/slack-direct |
| `SLACK_USER_TOKEN` | **App or R&D — see ↑** | dev, dev_personal | Unclear scope — no consumer found in code | **0 consumers in current tree.** Possibly stale; needs Oria to identify origin |
| `UNIFIED_API_KEY` | **App** | dev, dev_personal | unified.to API key — server-side integrations | tests/e2e, experiments/{fathom,slack,unified}-*, tools/e2e |
| `UNIFIED_WEBHOOK_SECRET` | **App** | dev, dev_personal | Verifies unified.to webhooks | tests/e2e/tests/webhook-proxy-*, tools/e2e, scripts/set-env-lib |
| `UNIFIED_WORKSPACE_ID` | **App** | dev, dev_personal | unified.to workspace identifier (less sensitive) | docs/specs/{slack,fathom}-integration, experiments, tools/e2e |
| `SUPABASE_DB_PASSWORD` | **App** | dev, dev_personal | Local/dev DB password | tools/preflight/src/checks/supabase.ts |
| `LINEAR_API_KEY` | **R&D (shared)** | dev, dev_personal | Team Linear PAT — used by `plan` CLI, agent tooling | tools/dx/src/slack/config.ts, tools/plan-cli/tests/*, experiments/unified-integration |
| `FIGMA_API_KEY` | **R&D (shared)** | dev, dev_personal | Team Figma key | (no code consumers in main tree — used by Figma CLI/figma-* skills) |
| `FIGMA_PERSONAL_API_KEY` | **R&D (per-human, oria)** | dev, dev_personal | Oria-personal Figma | (skill-side use) |
| `FIGMA_NITSAN_API_KEY` | **R&D (per-human, nitsan)** | dev_personal only | Nitsan-personal Figma | (skill-side use) — already shows the per-human pattern in flight |
| `CONTEXT7_API_KEY` | **R&D (shared)** | dev, dev_personal | Context7 docs MCP | GH workflow claude-code-review.yml uses it; otherwise dev tooling |
| `GEMINI_API_KEY_DEV` | **R&D (shared)** | dev, dev_personal, ci | Gemini API for dev experiments + tests | tests/e2e, tools/e2e/src/lib/services.ts, GH workflow secrets |
| `NO_BUDGET_KEY` | **R&D (shared)** | dev, dev_personal, ci | Anthropic "no budget" override — testing only | python-services/tests/integration/claude/test_sdk_error_sentry.py, GH workflows |
| `ATUIN_KEY` | **R&D (per-human)** | dev, dev_personal | Atuin shell-history sync | (no repo consumers; shell-side tool) |
| `ATUIN_PASSWORD` | **R&D (per-human)** | dev, dev_personal | Atuin sync password | (no repo consumers; shell-side tool) |
| `CLOUDFLARE_TUNNEL_TOKEN` | **R&D (shared)** | dev, dev_personal | Named tunnel for local webhook testing | tools/bin/tunnel, docs/integrations/dev-tunnel.md |
| `USEGIN_SLACK_BOT_TOKEN` | **R&D (shared)** | dev, dev_personal | Internal Gin/usegin Slack bot — dev-team Slack only | tools/dx/src/slack/, usegin/comptroller/audits, usegin/research/dev-channel-slack-prior-art |
| `USEGIN_SLACK_APP_TOKEN` | **R&D (shared)** | dev, dev_personal | Internal usegin Slack app-level token | same as above |
| `SENTRY_PASSWORD` | **R&D (shared)** | dev, dev_personal | Likely web-login password for sentry.io UI (legacy / shared) | (no code consumers) — **needs Oria to confirm origin** |
| `ORIA_RAILWAY_STAGING` | **DevOps (per-human, oria)** | dev_personal only | Oria-personal Railway token, staging-scoped | (no code consumers) — used out-of-band by Oria |
| `GCP_SERVICE_ACCOUNT_JSON` | **DevOps** ⚠ | dev, dev_personal, ci | Currently `effi-vais-worker` SA. Role scope TBD — if it has owner/editor on the GCP project, owner-grade. Tests + CI use it. | docs/setup/vais-gcp-*, tests/e2e/vais-*, python-services/tests/integration/vais/*, GH workflows |
| `SUPABASE_ACCESS_TOKEN` | **DevOps** | dev, dev_personal | Full Supabase Management API token (workspace-grade) | scripts/set-env*, scripts/list-storage-files.ts, experiments/talon, ONA_SETUP, SUPABASE.md |
| `SUPABASE_DB_PASSWORD_STAGING` | **DevOps** | dev, dev_personal, ci | Staging DB root password | tools/preflight/src/checks/supabase.ts |
| `DOPPLER_PROJECT` / `DOPPLER_CONFIG` / `DOPPLER_ENVIRONMENT` | **(Doppler-internal)** | all | Self-referential; will change per project after migration | doppler-wrapper.sh, ensure-auth.sh |

### Consumer-mapping highlights (what I learned that shifted the plan)

- **GitHub Actions secrets are a parallel surface, not Doppler-synced.**
  Workflows reference `secrets.APP_ANTHROPIC_API_KEY`,
  `secrets.CLAUDE_CODE_OAUTH_TOKEN`, `secrets.CONTEXT7_API_KEY`,
  `secrets.GCP_SERVICE_ACCOUNT_JSON`, `secrets.GEMINI_API_KEY_DEV`,
  `secrets.GITHUB_TOKEN` (auto), `secrets.NEXT_PUBLIC_SENTRY_DSN`,
  `secrets.NO_BUDGET_KEY`, `secrets.SENTRY_AUTH_TOKEN`,
  `secrets.SENTRY_DSN`. These are stored in `gh secret` at the
  org/repo level, *not* read live from Doppler. **A Doppler reorg does
  not move them.** When we rotate any of these for the DevOps split,
  we have to rotate in BOTH Doppler and GH. (Today only `GCP_*` and
  `SUPABASE_*_STAGING` are owner-grade in the GH set; the rest are
  app-grade.)
- **Railway pulls from Doppler via service tokens (no `RAILWAY_TOKEN`
  in repo).** `nextjs-app/railway.json` has no env block — env comes
  from the Railway dashboard. The Railway↔Doppler integration uses a
  per-environment service token that lives in Railway; swapping
  Doppler projects requires updating those tokens dashboard-side.
  This is an Oria-only step (login required).
- **No Stripe keys in current Doppler.** Did not find `STRIPE_*`
  anywhere in `dev-env/*`. Either we don't take payments yet, or the
  Stripe key lives only in Oria's personal vault. **Needs Oria to
  confirm.**
- **No Railway admin token in current Doppler.** `ORIA_RAILWAY_STAGING`
  exists in `dev_personal` but is staging-scoped. A prod-admin Railway
  token is not visible. **Needs Oria to confirm.**
- **`GCP_SERVICE_ACCOUNT_JSON` ambiguity.** The variable name is
  generic; the SA on the file is `effi-vais-worker` per the docs. The
  scope of that SA on the GCP project (Editor? Owner? specific roles?)
  decides whether it's R&D-grade or DevOps-grade. **Needs Oria to
  check IAM bindings or to defer to: "if it has any role beyond the
  vais-worker scope, treat as DevOps; else R&D".** Default classification
  in this plan: **DevOps** (conservative).
- **`SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING`,
  `FIGMA_NITSAN_API_KEY`** have **zero code consumers** in the repo.
  They're either dashboard-only or stale. Inventory step has to surface
  this so we don't blindly copy stale secrets across.

## Proposed Doppler shape

### Three Doppler **projects** (not three configs in one project)

Doppler's access-control unit is a project (when paired with the
service-token model). Splitting into projects gives us per-group tokens,
per-group audit logs, and per-group access lists in the dashboard.

```
askeffi-app          — runtime app secrets (replaces today's app-side vars in dev-env)
  └─ dev / stg / prd

askeffi-rnd          — R&D / dev tooling (replaces today's R&D vars in dev-env)
  └─ shared          (one config — these are dev-machine-grade, no env split)
  └─ oria            (personal overlay — inherits shared, overrides per-human keys)
  └─ lihu
  └─ nitsan

askeffi-devops       — owner-grade; rotated; one-entry-point
  └─ rotating        (the active set; rotated on a schedule + on-event)
  └─ break-glass     (emergency / manual-only; never CLI-piped automatically)
```

### Why three projects, not three configs

- **Token blast radius.** A service token in Doppler is project+config
  scoped. With one project, an "R&D-only" token would still need
  config-name discipline; with three projects, a leaked R&D token can't
  read App/DevOps even if someone fat-fingers a `--project` flag.
- **Audit + dashboard clarity.** `askeffi-devops` becomes a place we
  *visit*, not a place we *live in*. Different muscle memory.
- **Personal configs** (Doppler feature: a per-user overlay config that
  inherits from a base) — useful for R&D where each dev has their own
  Linear PAT or Anthropic key (`FIGMA_NITSAN_API_KEY` shape, already
  in flight today).

### Access path per group

| Group | Default access | Mechanism |
|---|---|---|
| **App** | Server-side: Railway service token reads `askeffi-app/{stg,prd}` directly. Local dev: `doppler-wrapper.sh` injects `askeffi-app/dev`. | Existing pattern; just point at the new project. |
| **R&D** | Always-on in the devcontainer shell, layered on App/dev. `doppler-wrapper.sh` runs two `doppler secrets download` calls (App + R&D, with R&D overlaying personal config) and merges. | Same wrapper, two project flags + per-human config selection. |
| **DevOps** | **NOT in the default shell.** Accessed via `devops-run -- <cmd>` (new wrapper). Two-stage flow: `--recover` reconstructs the Doppler service token from 2-of-3 Shamir shares into a single shell session; from inside that shell, `doppler run --project askeffi-devops --config rotating -- <cmd>` works. Shell exits → token gone from env. | New wrapper; uses `ssss-combine` (Debian package `ssss`). |

## The armageddon-key mechanism (Oria's confirmed answer)

### Shape

- **Single underlying secret**: a Doppler **service token** for
  `askeffi-devops/rotating`, generated once by Oria in the dashboard.
  High-entropy, never typed by a human.
- **Split**: `ssss-split -t 2 -n 3 -w "askeffi-devops"` produces three
  base16-encoded shares. Threshold 2 — any two devs reconstruct.
- **Distribution**: at first-time setup, each dev runs
  `setup-armageddon-share` once on their own laptop:
  - The script hands them ONE share (printed to stdout once,
    *not* logged anywhere, *not* written to disk).
  - Dev pastes that share into their personal vault entry titled
    "AskEffi DevOps share — <dev-name> — 2026-05".
  - Script confirms ("paste back the share to verify"), then exits.
- **Why 2-of-3, not 3-of-3**: 3-of-3 means any one dev unavailable =
  org locked out of own infra. 2-of-3 keeps continuity if one is on
  vacation. The trust model (3 named devs who trust each other)
  supports threshold 2. (Zisser called this; surface to Oria only
  if a strong reason to flip.)
- **Tooling**: Debian `ssss` package, available from the standard
  Ubuntu universe repo (verified `apt-cache show ssss` shows v0.5-5).
  Add `ssss` to `.devcontainer/Dockerfile`'s `apt-get install` line —
  one line, puts the binary alongside `doppler` on every fresh
  devcontainer. (Alternative: `shamirs-secret-sharing` npm. Rejected
  — adds a runtime dependency to the wrapper, and apt-installed
  binaries align with `doppler` itself's distribution shape.)

### `devops-run` wrapper UX

Two commands, deliberately separated to make the ceremony visible:

```
$ devops-run --recover
You are about to reconstruct the AskEffi DevOps token.
This requires 2 of 3 shares. The reconstructed token lives in this
shell only — exit the shell or wait 15 minutes and it's gone.

Share #1 (paste, then Enter): ********
Share #2 (paste, then Enter): ********
✓ Token reconstructed. Opening DevOps shell.
  Type `exit` (or Ctrl-D) to close. Auto-closes in 15:00.

devops$ doppler run --project askeffi-devops --config rotating -- railway whoami
... whatever you need ...
devops$ exit
✓ DevOps shell closed. Token wiped from env.
$
```

```
$ devops-run -- railway whoami
Error: no DEVOPS_TOKEN in env. Run `devops-run --recover` first.
$
```

Implementation notes:
- `--recover` does NOT cache the token to disk. Token lives in env
  vars of the spawned shell, dies with the shell.
- `--recover` SHOULD set a SIGALRM at 15min that runs `exit 0` on the
  shell. Simple `read -t 900` loop or `bash -c 'sleep 900 && kill -INT
  $PARENT'` background — pick the simpler in implementation.
- Token reconstruction uses `ssss-combine -t 2`. Shares accepted via
  stdin paste OR `--share-file <path>` for vault-export workflow.
- Wrapper source: `tools/devops-run/`. Charter: short, single-file,
  bash. NOT installed by default — added via apt-package + a copied
  bin script in `.devcontainer/post-create.sh`.

### Three runbooks

#### 1. First-time armageddon-key setup (one-time, all 3 devs)

**Pre-req**: `askeffi-devops/rotating` Doppler config exists with
all DevOps secrets populated. Oria has minted a service token for
that config (Doppler dashboard → Access → Service Tokens → Generate;
note the token — only shown once).

```
# Same Zoom or async-but-same-week.
# All 3 devs at terminal. Doppler service token in Oria's clipboard ONCE.

# Oria runs:
$ devops-run --setup-shares
Paste DevOps service token (input hidden): ********
Splitting into 3 shares with threshold 2...
✓ 3 shares generated. Distribute as follows:

  Share for ORIA  →  ssss-split:1-<base16>
  Share for LIHU  →  ssss-split:2-<base16>
  Share for NITSAN →  ssss-split:3-<base16>

Press Enter to clear screen and exit.

# Each dev:
# 1. Open personal vault (1Password / Bitwarden / etc).
# 2. Create entry: "AskEffi DevOps share — <name> — 2026-05".
# 3. Paste their share line into the secret field.
# 4. Save.

# Verification (each dev, separately, on their own machine):
$ devops-run --verify-share
Paste your share to verify it's well-formed: ********
✓ Share parses correctly. (Does NOT verify reconstruction — that needs 2 shares.)

# Joint verification (any 2 of 3):
$ devops-run --recover
... reconstruct, run `doppler me` from inside, confirm token works ...
$ exit
```

**Rollback**: if any share fails to land in a vault, Oria re-mints the
service token in Doppler dashboard (revokes the old one), re-splits,
re-distributes. The `--setup-shares` flow takes ~5 minutes.

#### 2. Routine `devops-run` use (any 2 of 3 devs)

```
# Two devs co-located OR one paste-relays the other's share via signal.
# Action requires DevOps creds — say, "create a new Railway service".

# Dev A:
$ devops-run --recover
Share #1: <pastes own share>
Share #2: <Dev B sends theirs via Signal/WhatsApp/in person>
✓ Token reconstructed. Opening DevOps shell. Auto-closes 15:00.

devops$ doppler run --project askeffi-devops --config rotating -- railway up
... action runs ...
devops$ exit
✓ Token wiped.

# Dev B (independently): deletes the share message from Signal after Dev A confirms exit.
```

**Rule**: never write the second dev's share to disk on Dev A's machine.
Paste-in-stdin only. Wrapper enforces this by rejecting `--share-file`
when `--recover` is invoked unless the file is on tmpfs/RAM.

#### 3. Quarterly rotation (any 2 + the third within 24h)

```
# Cadence: every 90 days OR after any leak/suspicion OR after offboarding.
# Driven by a calendar reminder in Oria's calendar — owner-grade is owner-cadenced.

# Step 1 (any 2 devs, normal --recover flow):
$ devops-run --recover
... reconstruct token ...
devops$ doppler service-tokens revoke <old-token-slug> --project askeffi-devops --config rotating
devops$ doppler service-tokens create --project askeffi-devops --config rotating --name "rotating-<YYYY-MM>"
... copy the new token (shown once) ...
devops$ devops-run --setup-shares
... paste new token, generate 3 new shares ...
devops$ exit

# Step 2 (each dev within 24h):
# 1. Open vault, REPLACE the share in "AskEffi DevOps share — <name>".
# 2. Verify with `devops-run --verify-share`.
# 3. **Delete the OLD share entry from vault history** (vault-specific:
#    1Password "Item History" → delete; Bitwarden lacks history, just save over).

# Step 3 (the rotating dev pair):
# Joint test reconstruction with two new shares to confirm it works
# before the 24h window closes.
```

**Failure case**: if the 24h window passes and one dev hasn't replaced
their share, the other two CAN still reconstruct (2-of-3) but the
third dev is now locked out. Recovery: re-run setup-shares with 2-dev
quorum, share the new triplet over a secure channel.

## Migration — eight steps

Each safely reversible until step 6.

1. **Inventory verified.** This plan's table IS step 1's deliverable.
   Oria reads, line-edits classifications she disagrees with, then we
   freeze.
2. **Create the three projects empty** in Doppler dashboard. Oria
   manual (login required). One commit on main: this plan with
   "Created" stamps next to each project name.
3. **Copy** (don't move) the App-class secrets to `askeffi-app/dev`,
   then `stg`, then `prd` (mirroring whatever is currently set in
   Railway's per-env Doppler config — which is in `dev-env/dev` for
   dev only; stg/prd live elsewhere or in Railway's own env vars; see
   ↑ Q-D below). Verify with `--only-names` diff.
4. **Repoint the devcontainer wrapper** to read `askeffi-app/dev`
   first. Smoke test: `just dev` boots; `just agent-dev` boots; the
   same features work end-to-end. Rollback = revert the
   `doppler-wrapper.sh` change.
5. **Repeat 3–4 for R&D** → `askeffi-rnd/shared` + per-human overlays.
   Smoke test: `plan list` works (LINEAR_API_KEY), `tunnel start`
   works (CLOUDFLARE_TUNNEL_TOKEN), `effi ask` works
   (CONTEXT7_API_KEY).
6. **Move** (not copy) DevOps secrets to `askeffi-devops/rotating`.
   Same turn:
   - Rotate the most-sensitive ones: `SUPABASE_ACCESS_TOKEN`,
     `GCP_SERVICE_ACCOUNT_JSON` (re-mint the SA key in GCP, distribute
     new JSON), `SUPABASE_DB_PASSWORD_STAGING`.
   - Add the `devops-run` wrapper + the `ssss` apt install line.
   - Run first-time setup-shares (runbook 1).
   - Update `gh secret set` for `GCP_SERVICE_ACCOUNT_JSON` and
     `SUPABASE_DB_PASSWORD_STAGING` (the GH-actions copies that won't
     be Doppler-synced).
7. **Decommission `dev-env/dev`** — once everything's working from the
   three projects for ~1 week, delete the old config. Keep the project
   shell in place for one more week, then archive. **Stale-secret
   cleanup also lands here**: drop `SLACK_USER_TOKEN`,
   `SENTRY_PASSWORD` (if Oria confirms they're stale), and
   `ORIA_RAILWAY_STAGING` (move to Oria's personal vault if still in
   use).
8. **Document** in `docs/security/doppler-shape.md` (new) and update
   `scripts/ensure-auth.sh` + `.devcontainer/doppler-wrapper.sh`
   comments. Add the `devops-run` wrapper to `tools/devops-run/`.

## What changes for Claude / Gin

- **Default shell**: App + R&D in env. Same as today, minus owner-grade.
- **When Gin needs DevOps**: charter says "this requires `devops-run`".
  Gin parks the request into `zisser/dispatched/<file>.md` with a
  one-line ask and continues the rest of the run without it. Oria
  picks up the parked ask, does the `--recover` ceremony with a
  second dev, runs the action, and notifies Gin.
- **Charters change shape**: an explicit `decision-rights` line —
  "may DevOps-escalate? Y/N" — becomes part of every Wes/Gin spawn
  whose work is owner-grade. Plays nicely with Auftragstaktik.
- **No "trusted-Gin" tier**: explicitly NOT giving Gin its own DevOps
  token. The armageddon ceremony is the gate; one human is enough to
  start it but two are required to use it. Gin does not hold a share.

## Risk register

Ranked by (blast-radius × likelihood). Each has a stated mitigation.

| # | Risk | Blast | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | **Step 6 leaves Railway with stale env mid-deploy** (DevOps secrets moved before Railway service tokens swapped) | Prod outage | Med | Step 4's verified-rollback path; never start step 6 until step 4 has been stable in stg+prd for 48h. Railway service-token swap is a single dashboard action — rehearse in a test Railway service first. |
| R2 | **Wrong-secret-in-wrong-group ships** (App reads DevOps key by accident or vice-versa) | Owner-grade leak in app bundle | Low-med | The classification table in this doc is line-edited by Oria before any move. Step 4 smoke test catches App-missing; a deliberate "DevOps key NOT in App env" assertion lands in `tests/external/` to catch the inverse. |
| R3 | **Two devs lose shares simultaneously** | Org locked out of own infra | Very low | Pre-shared escrow: each dev's vault has a 1Password emergency-access designate (their spouse / a personal lawyer) AND the share is replicated across the dev's vault export backup. Recovery procedure documented in `docs/security/doppler-shape.md` step 7. |
| R4 | **`devops-run --recover` shell stays open and a malicious process reads its env** | Owner-grade leak | Low | 15-min hard timeout (SIGALRM-driven `exit`). Wrapper prints countdown at 13min, 14min. No way to extend without re-running `--recover`. |
| R5 | **One dev loses share** (vault password forgotten, etc.) | Reconstruct still works (2-of-3) but rotation needed | Low | Runbook 3 covers this — other 2 reconstruct, re-split, re-distribute. ~30min total. |
| R6 | **GitHub Actions secrets drift from Doppler** (we rotate Doppler but forget GH) | CI breaks on next push, owner-grade keys stay valid in GH after Doppler revoke | Med | Step 6's checklist includes `gh secret set` for every owner-grade key. Add a `tools/preflight/` check that compares GH secret presence vs expected set (names only, no values). |
| R7 | **Migration ordering breaks CI** (R&D moves first, a `.github/workflow` reading R&D-class via the old `dev-env` path breaks) | CI red on main | Med | Workflow refs are static — listed above (`secrets.CONTEXT7_API_KEY`, `secrets.GEMINI_API_KEY_DEV`, `secrets.NO_BUDGET_KEY`). Confirmed those are stored in `gh secret`, not pulled from Doppler. Migration does not touch them. |
| R8 | **Personal-config + team-key collision** (e.g. someone overrides `LINEAR_API_KEY` in their personal config and we don't notice) | Confusing CLI behavior | Low | Doppler dashboard shows config-overlay state; per-human overlays land only for keys explicitly named per-human (`FIGMA_NITSAN_API_KEY` shape). Pattern is enforced by the inventory table — shared keys never appear in personal configs. |
| R9 | **The ENV cache file leaks DevOps secrets** (`/tmp/.doppler-env-cache`) | Owner-grade leak | Low | `doppler-wrapper.sh` only reads `askeffi-app` + `askeffi-rnd`. DevOps is reached via `devops-run --recover` exclusively, which writes nothing to disk. Add a `grep -E "DEVOPS|ARMAGEDDON"` assertion against the cache file in `scripts/ensure-auth.sh` that exits 1 if anything matches. |
| R10 | **First autonomous Gin run hits a DevOps wall and halts forever** | Stalled work, friction | Med | Charters specify DevOps requirements upfront; Gin parks via `zisser/dispatched/` with a one-line ask and continues the rest of the run. The discipline lives in the `charter` skill (already exists). |

## Acceptance criteria (Oria ticks after execution)

- [ ] All App secrets from the table land in `askeffi-app/{dev,stg,prd}`
      and the devcontainer + Railway boot fine; `just dev` works,
      `just agent-dev` works, prod sanity test passes.
- [ ] All R&D secrets in `askeffi-rnd/shared` (+ per-human overlays for
      `FIGMA_PERSONAL_API_KEY`, `FIGMA_NITSAN_API_KEY`,
      `ATUIN_KEY`/`ATUIN_PASSWORD`).
- [ ] DevOps secrets in `askeffi-devops/rotating`. `doppler secrets
      --project askeffi-devops --config rotating --only-names` matches
      the DevOps row of the inventory table.
- [ ] DevOps secrets accessible **only** via `devops-run --recover`
      after share reconstruction. Verified by: open a fresh shell,
      `echo $SUPABASE_ACCESS_TOKEN` is empty.
- [ ] `dev-env/dev` archived; old `--project dev-env` paths removed
      from `scripts/ensure-auth.sh` and `.devcontainer/doppler-wrapper.sh`.
- [ ] Three armageddon shares distributed; setup script
      (`tools/devops-run/setup-shares`) exists and is committed;
      routine-use runbook tested by 2 devs without help.
- [ ] `tests/external/` assertion exists that no DevOps-grade key is
      readable in the default shell.
- [ ] `docs/security/doppler-shape.md` exists and matches reality.
- [ ] GitHub Actions secrets aligned: `GCP_SERVICE_ACCOUNT_JSON`,
      `SUPABASE_DB_PASSWORD_STAGING` rotated in `gh secret` to match
      the new Doppler values.
- [ ] Calendar reminder for quarterly rotation set in Oria's calendar.

## Decisions Zisser took (no Oria input needed)

| # | Decision | Rationale |
|---|---|---|
| 1 | Project names: `askeffi-app` / `askeffi-rnd` / `askeffi-devops` | Conventional; matches existing `dev-env` naming style. |
| 2 | R&D = one `shared` config for team-minted keys (`LINEAR_API_KEY`, `FIGMA_API_KEY`, `GEMINI_API_KEY_DEV`, `CONTEXT7_API_KEY`, `USEGIN_SLACK_*`, `CLOUDFLARE_TUNNEL_TOKEN`); per-human overlay only for keys literally tied to one human's account (`FIGMA_PERSONAL_API_KEY`, `FIGMA_NITSAN_API_KEY`, `ATUIN_*`). | "Shared brain" team (memory: `project_zettel_no_privacy`); shared default. Per-human only where the upstream account is per-human. |
| 3 | `devops-run` = two-stage `--recover` (open DevOps shell with 15-min timeout) then normal `doppler run` from inside. | Friction without fight. Reconstruction IS the ceremony; a single-step command would tempt single-dev reconstruction. |
| 4 | Shamir threshold = **2-of-3**. | 3-of-3 means any one dev unavailable = locked out of own infra. Trust model (3 named devs who trust each other) supports threshold 2. |
| 5 | `ssss` Debian package via apt (one line in `.devcontainer/Dockerfile`), not `shamirs-secret-sharing` npm. | Puts the binary alongside `doppler` itself; no Node-runtime dependency in the wrapper; widely-audited C implementation. |
| 6 | Rotation cadence: **on-event** (offboard / leak / suspicion) + **quarterly baseline**. NOT after every use — kills the wrapper's usability. | On-event covers the actual risk; quarterly catches drift; per-use is theater + breaks the "bring the key" UX. |
| 7 | Migration window: **sliced** — App → R&D → DevOps over ~1 week, each step a single commit + Ron review, verified rollback before next step. | One-shot risks a prod outage we can't recover from before Monday. |
| 8 | Token swaps: Wes-via-Zisser for everything code-side (`scripts/`, `.devcontainer/`, `.github/workflows/`); Oria does the dashboard-only Doppler-project-creation + Railway service-token issuance steps. | Plays to each role's actual access. |
| 9 | FECLI bootstrap lands in **R&D**, per-human. The goal is "save the team's OTP-per-env time", not "let Gin act as a named human in production". | If Gin needs to act as a named human for an owner-grade thing, that's a `devops-run` job, not a FECLI-as-human job. |
| 10 | DevOps shell auto-timeout default = **15 minutes**. | Long enough for any single owner-grade action; short enough that walking away from a laptop doesn't become a leak vector. Configurable via `--timeout 30m` if needed. |
| 11 | `SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING` flagged as stale-pending-Oria-check; if Oria can't recall the use case, they get dropped at step 7. | Zero code consumers found. Carrying stale secrets across a reorg propagates the problem. |
| 12 | `GCP_SERVICE_ACCOUNT_JSON` defaults to **DevOps** classification in absence of Oria check on actual IAM bindings. | Conservative — easier to demote later (move to R&D) than to discover post-leak that an owner-grade SA was in every devcontainer. |

## ↑ Questions that genuinely need Oria

Trimmed to only what changes the plan if you answer differently.

### ↑ Q-A. `GCP_SERVICE_ACCOUNT_JSON` actual IAM scope?

The variable is named generically; the SA on file is `effi-vais-worker`.
What IAM roles does it hold on the GCP project? Two cases:

- **(i) Workspace-scoped only** (Discovery Engine User, VAIS-related
  permissions): classify as **R&D**. Lives in default shell. No
  rotation in step 6.
- **(ii) Editor / Owner / SecretManager Admin / etc.**: stays
  **DevOps**. Rotated in step 6 (re-mint key in GCP, redistribute new
  JSON to Doppler + GH Actions secret).

I defaulted to (ii) for safety. If you can run `gcloud projects
get-iam-policy <project> --filter='bindings.members:effi-vais-worker'`
or just confirm "it's only got vais roles", we move it.

### ↑ Q-B. Stale secrets — `SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING`?

Zero code consumers in repo for all three. Plan: drop at step 7 if you
confirm they're stale; keep + classify if you say "yeah, X uses that
out of band". 30-second answer per key is fine.

### ↑ Q-C. Owner-grade keys NOT currently in Doppler that should land in `askeffi-devops`?

The "30-second brain dump" ask from v1 is still open. Specifically
candidates I expect but didn't see:

- **Stripe live keys** — does AskEffi take payments yet? If yes, where
  do those keys live today?
- **Railway prod admin token** — the `ORIA_RAILWAY_STAGING` is staging.
  Is there a prod equivalent in your personal vault?
- **Domain registrar admin** (askeffi.ai) — usually not a "secret" but
  a "what owner-grade access gives you." Where does that live? In your
  personal vault, presumably — let's note it in the doppler-shape doc
  as "lives outside Doppler intentionally".
- **GCP owner-role SA** (separate from `effi-vais-worker`) — does one
  exist?

If any of these exist, they go into `askeffi-devops/rotating` at step 6
and get rotated as part of the same ceremony.

### ↑ Q-D. Where are stg/prd App secrets today?

Step 3 says "copy App-class secrets to `askeffi-app/{dev,stg,prd}`",
but my live inventory only sees `dev-env/dev` (the dev devcontainer's
config). I assume Railway has its own per-environment Doppler config
or its own env vars dashboard-side. Confirm one of:

- **(i)** Railway pulls staging/prod from a different Doppler config
  (`dev-env/staging`?, `dev-env/prod`?) that I can't see from this
  token's scope. Step 3's stg/prd copy is a Doppler-internal copy.
- **(ii)** Railway has env vars set directly in its dashboard (no
  Doppler integration for stg/prd). Step 3's stg/prd copy is a
  manual paste-from-Railway-dashboard-into-new-Doppler-project.

Affects the manual ceremony cost of step 3 (case ii is much heavier).

## What I'm NOT doing without answers

- Not creating Doppler projects (irreversible-ish; clutters the
  workplace).
- Not touching live secrets.
- Not editing `scripts/ensure-auth.sh` or `doppler-wrapper.sh`.
- Not dispatching Wes — execution waits on Oria's Y/N + the four
  questions above.

## Once Oria approves

Dispatch shape (one Wes per coherent step, per
`feedback_small_charter_steps`):

- Step 1 (inventory) — already done by this research pass.
- Step 2 (create projects) — Oria manual, dashboard.
- Step 3a (copy App → askeffi-app/dev) — Wes, single commit, Ron review.
- Step 3b (Railway dashboard work for stg/prd) — Oria manual.
- Step 4 (repoint wrapper) — Wes, single commit, Ron review, smoke test.
- Step 5 (R&D copy + repoint) — Wes, single commit, Ron review.
- Step 6 (DevOps move + rotate + `devops-run` wrapper + `ssss` install
  + share distribution ceremony) — Wes for code; Oria + Lihu + Nitsan
  for ceremony. Bracketed by `security` skill consult.
- Step 7 (decommission) — Oria manual + Wes diff to remove old fallback
  paths in scripts.
- Step 8 (docs) — Wes; lands in `docs/security/doppler-shape.md`.

## Appendix: surprises from this research pass

- **`FIGMA_NITSAN_API_KEY` already in `dev_personal` only.** The
  per-human pattern this plan proposes is already in flight, just
  ad-hoc. The reorg formalizes what's already organically happening.
- **`dev_personal` is currently a superset of `dev`.** Originally I
  expected it to be an "only-deltas" overlay. It's a full copy with
  the personal additions on top. Doppler config inheritance (`INHERITS`
  column) was empty for both — they're standalone configs, not
  overlay/base. Personal-overlay-via-inheritance is something we get
  to enable as part of the reorg, not something we already have.
- **GitHub Actions has `secrets.GCP_SERVICE_ACCOUNT_JSON`,
  `secrets.SENTRY_AUTH_TOKEN`, etc. as a parallel store.** This wasn't
  obvious to me before and shifts the rotation runbook. R6 in the
  risk register exists because of this finding.
- **No Stripe / no prod-Railway-admin / no separate GCP-owner-SA in
  current Doppler.** Either we don't have these yet, or they live in
  Oria's personal vault. Q-C surfaces this.
- **`SUPABASE_DB_PASSWORD_STAGING` is in `ci` config too.** That's
  owner-grade in CI. Once moved to DevOps, GH Actions still needs it
  (it's a `secrets.SUPABASE_DB_PASSWORD_STAGING` reference in
  workflows? — actually I didn't see this in the workflow grep; need
  to double-check whether CI tests actually use this env var or
  whether it's just present-but-unused). Adding to ↑ Q-list mentally
  but not as a blocker — worst case it's an unused variable.
