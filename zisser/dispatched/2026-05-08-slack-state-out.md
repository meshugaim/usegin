---
date: 2026-05-08
authored_by: general-purpose sub-agent (read-only auditor)
charter: zisser/dispatched/2026-05-08-slack-state.md
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
mode: read-only — no commits, no edits outside this file, no calls to Slack write methods
---

# State-Slack — what Slack-into-Effi actually IS, right now

Auditor's note. Three contexts kept separate throughout: **(C) customer-facing AskEffi-Slack**, **(U) internal UseGin-Slack / `useginslack`**, **(P) POC/spike apps** (`Effi Spike`, `ingest-poc`, `slack-direct`/`slack-unified`). Negative findings are recorded as such. Nothing was registered, installed, or modified in any external system.

---

## 1. Slack apps inventory

Probed via `auth.test`, `bots.info`, `team.info` against tokens already in the live env. Could not call `apps.list` / `apps.permissions.info` (Slack returned `unknown_method` — those are admin-API surfaces this token can't reach).

| Context | App name | App ID | Probe basis | Workspace bound | Status |
|---|---|---|---|---|---|
| **(C)** | `Slack integration for Effi` | `A0B1QH8KLLS` | `bots.info` returned via `SLACK_BOT_TOKEN` (xoxb), `bot_id=B0B23DSG08H`, `bot_user_id=U0B1NF7JQA2` | `T09ND5V6T9S` (askeffiworkspace.slack.com / `AskEffi`, email_domain `askeffi.ai`) | Installed and live in dev token; bot scopes from `x-oauth-scopes` header: `channels:history,channels:read,groups:history,groups:read,users:read,team:read` |
| **(C)** dev OAuth client | (same app) | client_id `9761199231332.11058586666706` | `SLACK_CLIENT_ID` in Doppler `effi/dev` (and the same value in env) | – | Active client_id |
| **(C)** stg/prod OAuth client | (separate app at api.slack.com — different `client_id`) | client_id `9761199231332.11081049680577` | Railway staging vars on `nextjs-app` service | – | client_secret + signing_secret present in Railway *staging only*; **prod has zero Slack vars** |
| **(U)** | `UseGin` / `useginslack` (intended) | unknown — `USEGIN_SLACK_BOT_TOKEN` returns `account_inactive` | auth.test against `USEGIN_SLACK_BOT_TOKEN` failed (`account_inactive`) | unknown — token can't reach a workspace right now | Bot token in Doppler appears stale/disabled. Consumer (`tools/dx/src/slack/`) ships and tests assume it works — see §3. |
| **(P)** `Effi Spike` | `A0B0B7HBATC` | `auth.test` against `USEGIN_SLACK_APP_TOKEN` (xapp-) returned `app_name=Effi Spike, app_id=A0B0B7HBATC` and a working Socket-Mode WebSocket URL | (xapp- tokens are app-level, not workspace-scoped — the Socket-Mode link opened, so the app is connectable) | Live as Socket-Mode app. `_NEEDS-FROM-LIHU.md` notes Lihu "can't do nothing on that app" — admin gap. |
| **(P)** `ingest-poc` (mentioned by name in `_NEEDS-FROM-LIHU.md`, distinct from Effi Spike) | not in any env var | referenced in `_NEEDS-FROM-LIHU.md` § TOP as a Slack app Lihu created 2026-04-28 in `askeffi.slack.com` | askeffi.slack.com | **Credentials not in Doppler / not in env / not in Railway** — top-priority human-blocked item (§9 #1). |
| **(P)** `slack-direct` / `slack-unified` experiments | n/a — Python CLI experiments under `experiments/slack-direct/` and `experiments/slack-unified/` | code only, no current runtime | – | Code present (slice 6 scaffolds, ENG-5420..5425); not wired to current main code paths. |

Redirect URLs configured at api.slack.com — **not directly readable** with the tokens we have. Code-side derives the redirect URI as `${NEXT_PUBLIC_SITE_URL}/api/slack/callback` (callback route + start action both build it this way). Per `_NEEDS-FROM-LIHU.md` § TOP, the `ingest-poc` app needs `https://local-dev.askeffi.ai/api/slack/callback` added — implies it's not configured today.

OAuth scope set per code (`workspace-slack.ts:DEFAULT_BOT_SCOPES`) for **(C)**: `channels:read, channels:history, groups:read, groups:history, users:read, team:read, commands`. `user_scope=""` (bot-only by design). No DM scopes (`im:*`/`mpim:*`) — deliberate RLS-leak posture per ENG-5400/G angle.

Event subscriptions on **(C)** — code handles `app_uninstalled`, `tokens_revoked`, `channel_rename`, `message`. Whether Slack actually subscribes those at the api.slack.com app config is **not directly verifiable** from this env (no admin-API token).

---

## 2. Slack workspaces

| Workspace | URL | Team ID | Domain | Notes |
|---|---|---|---|---|
| `AskEffi` | `https://askeffiworkspace.slack.com/` | `T09ND5V6T9S` | `askeffi.ai` | Where (C) bot `Slack integration for Effi` is currently installed (verified via `auth.test`). Where (P) `ingest-poc` was created (per `_NEEDS-FROM-LIHU.md`). |
| (expected) real AskEffi team | n/a | `T0AUGMX1XNZ` | – | `tools/dx/src/slack/registry.ts:EXPECTED_REAL_TEAM_ID` is hardcoded to this id, "verified live (auth.test) on 2026-05-04". `dx slack smoke` will FAIL the team_id check today because the live token returns `T09ND5V6T9S`, not `T0AUGMX1XNZ`. Either the workspace got recreated, the constant is stale, or the dev token points at the wrong tenant. **Discrepancy.** |

`team.info` against the (C) bot token: `"is_verified": false` — the workspace itself is not Slack-verified.

`conversations.list` (bot view) returns channels in `T09ND5V6T9S` — `related-tech, social, usability, client-discovery, ...` — the bot can SEE them but `is_member: false` for the ones inspected. So: bot is installed but not invited to channels.

---

## 3. Code that handles Slack

### Customer-facing (C) — `nextjs-app/`

| Path | Role |
|---|---|
| `nextjs-app/app/api/slack/callback/route.ts` | OAuth v2 callback — code exchange, state CSRF check, encrypted token write to `slack_installs`. Reads `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `TOKEN_ENCRYPTION_KEY` (via `lib/token-crypto`). |
| `nextjs-app/app/api/slack/events/route.ts` | Events API receiver — signature verification (`SLACK_SIGNING_SECRET`), URL verification, dispatch. Reads `SLACK_SIGNING_SECRET`. |
| `nextjs-app/app/actions/workspace-slack.ts` | OAuth start — builds `slack.com/oauth/v2/authorize` URL, sets CSRF cookie. `getWorkspaceSlackInstallStatus`. Reads `SLACK_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`, optional `SLACK_BOT_SCOPES`, optional `SLACK_CLIENT_APP_ID` (filter for AskEffi-Slack vs UseGin-Slack on a shared `slack_installs` table). |
| `nextjs-app/app/actions/project-slack.ts` | `listSlackChannels` (via Slack `conversations.list` with decrypted bot token), `bindSlackChannel`, `unbindSlackChannel`, `getProjectSlackContext`. |
| `nextjs-app/lib/slack-event-handlers.ts` | Pure handlers: `handleAppUninstalled`, `handleTokensRevoked`, `handleChannelRename`, `handleMessageEvent`, `dispatchSlackEvent`, `stripSlackMrkdwn`. |
| `nextjs-app/lib/slack-event-signature.ts` | HMAC + replay-window verifier (5-min window) for `X-Slack-Signature`. |
| `nextjs-app/lib/slack-token-decrypt.ts` | AES-256-GCM decrypt for `slack_installs.bot_token_encrypted`. AAD `(slack_installs, bot_token_encrypted, id)`. |
| `nextjs-app/lib/services/slack-state.ts` | `ConnectSlackOpts`, `serializeSlackStateOpts` — extracted so `"use server"` files only export async. |
| `nextjs-app/lib/token-crypto.ts` | Generic AES-256-GCM helper used by Slack callback (also used by the rest of the app eventually — z089). |
| `nextjs-app/lib/browser-flags/registry.ts` | Defines the `slackIntegration` browser flag. **Default: `false`** — UI is hidden from customers until the flag flips. ENG-5399 / pilot-trust gate. |
| `nextjs-app/app/projects/[projectId]/config/slack-integration-card.tsx` | Project-config "Connect Slack to this project" card. |
| `nextjs-app/app/projects/[projectId]/config/slack-channel-picker-modal.tsx` | Channel picker (post-install). |
| `nextjs-app/app/projects/[projectId]/config/slack-install-and-bind-modal.tsx` | Unified install+bind flow from project config (ENG-5769 Slice 1). |
| `nextjs-app/app/workspaces/[workspaceId]/settings/slack-integration-card.tsx` | Workspace-settings install card. |
| `nextjs-app/components/icons/slack-icon.tsx` | Icon. |

DB: migrations `20260427182028_slack_installs.sql`, `20260427201822_slack_channel_bindings.sql`, `20260505164013_slack_messages_born_together.sql` (RPC `create_slack_message_with_data_item`), `20260505095942_add_slack_unified_install_modal_toggle.sql`. Tables: `slack_installs`, `slack_channel_bindings`, `slack_messages`. RLS gates writes to workspace-owners.

### Internal (U) — UseGin-Slack — `tools/dx/src/slack/`

| Path | Role |
|---|---|
| `tools/dx/src/slack/config.ts` | Reads `USEGIN_SLACK_BOT_TOKEN` from env. Throws `SlackConfigError` if missing. **No** OAuth client config — UseGin is meant to ship with a single shared bot token. |
| `tools/dx/src/slack/client.ts` | Wraps `@slack/web-api` `WebClient` with the loaded token. |
| `tools/dx/src/slack/whoami.ts` + `commands/whoami.ts` | `dx slack whoami` — calls `auth.test`, prints scopes from `x-oauth-scopes`. (ENG-5408 slice 1.) |
| `tools/dx/src/slack/{post,read,react,inbox,dm,user,channel,channelOps,bookmark,files,links,send}.ts` + `commands/*.ts` | Subsequent UseGin verbs (post / read / inbox / DM / etc.) for `dx slack <verb>`. Supporting tests beside each. |
| `tools/dx/src/slack/registry.ts` | Channel-name constants (`#zisser-out`, `#zisser-alerts`, `#zisser-log`) + `EXPECTED_REAL_TEAM_ID = "T0AUGMX1XNZ"` (used by smoke). |
| `tools/dx/src/slack/smoke.ts` + `commands/smoke.ts` | Post-install verification (auth.test, team_id check, channel-count, presence, round-trip, lihu-lookup). |
| `tools/dx/src/slack/inboxCursor.ts` | Cursor persistence for `dx slack inbox`. |

Python: only test references in `python-services/` (string `"slack"` in test fixtures + scheduled-reports email styling); no live Slack code path in `python-services/`.

### POC (P) — `experiments/` and `oria-crazy-world/`

| Path | Role |
|---|---|
| `experiments/slack-direct/` (Python, slack_sdk) | Slice-6 direct-Slack-Web-API CLI scaffold. Has `lib/`, `slack_cli.py`, tests, vendored `.venv/`. ENG-5420..5425 angle B. |
| `experiments/slack-unified/` (Python) | Slice 1-4 Unified.to-via-Slack CLI. ENG-5420..5423. |
| `oria-crazy-world/ground/oria-crazy-space/slack-ingest-poc/` | Overnight 2026-04-28→29 ingestion POC (Python). Reader → normalizer → JSONL indexer → querier. Writes to `index/messages.jsonl` (parallel store). README explicitly says it does NOT touch `nextjs-app/lib/slack-*`. |
| `oria-crazy-world/ground/oria-crazy-space/poc-reports/2026-04-29-slack-ingest.md`, `whiteboard-slack-ingest.md` | POC outcomes. |

---

## 4. OAuth flow trace — customer clicks "Connect Slack"

End-to-end trace, **(C)** path:

1. Customer is on `/workspaces/<id>/settings` (or the ENG-5769 unified modal in `/projects/<id>/config`). Card is rendered only when the `slackIntegration` browser flag is **on** (`nextjs-app/lib/browser-flags/registry.ts:slackIntegration` — default `false`).
2. Click → calls server action `connectSlackAction(workspaceId, opts?)` in `nextjs-app/app/actions/workspace-slack.ts`.
   - Reads env: `NEXT_PUBLIC_SITE_URL`, `SLACK_CLIENT_ID`, optional `SLACK_BOT_SCOPES`.
   - Verifies user has access to workspace via Supabase RLS check.
   - Generates 32-byte CSRF nonce; sets cookie `slack_oauth_state` (HttpOnly, SameSite=Lax, path=`/api/slack/callback`, 600s).
   - Builds state string `<workspaceId>.<nonce>[.<base64url-opts>]`. Optional 3rd segment encodes `{cb:1, p:<projectId>}` for project-modal flow (ENG-5769).
   - Builds authorize URL: `https://slack.com/oauth/v2/authorize?client_id=...&scope=channels:read,channels:history,groups:read,groups:history,users:read,team:read,commands&user_scope=&redirect_uri=${NEXT_PUBLIC_SITE_URL}/api/slack/callback&state=<state>`.
   - Returns `{ ok: true, data: { authUrl } }`. Browser redirects.
3. User authorizes on slack.com → Slack 302s back to `${NEXT_PUBLIC_SITE_URL}/api/slack/callback?code=&state=`.
4. `nextjs-app/app/api/slack/callback/route.ts` `GET` handler:
   - If `?error=` (user declined) → redirect to workspace settings with `?slack=error&reason=user_declined`.
   - Parses state → `workspaceId.nonce[.opts]`. Validates UUID + format.
   - Reads `slack_oauth_state` cookie; **timing-safe** equality (`crypto.timingSafeEqual`). On mismatch → `?slack=error&reason=invalid_state`.
   - Re-checks workspace access (RLS) via `createClient()`. On miss → `reason=access_denied`.
   - Reads env: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`. On missing → `reason=not_configured`.
   - POSTs to `https://slack.com/api/oauth.v2.access` with `client_id`, `client_secret`, `code`, `redirect_uri=${NEXT_PUBLIC_SITE_URL}/api/slack/callback`. On `!ok` or fetch fail → `reason=exchange_failed`.
   - Looks up existing `slack_installs` row by `(askeffi_workspace_id, slack_team_id, slack_app_id, slack_enterprise_id)` where `revoked_at IS NULL`.
   - **Encrypts the bot token** via `lib/token-crypto.encrypt` with AAD `{table:'slack_installs', column:'bot_token_encrypted', rowId}`. Reads env: `TOKEN_ENCRYPTION_KEY`. On throw → `reason=encryption_unavailable`. No silent fallback to raw write.
   - Update-or-insert. New rows pre-generate `id` (UUID) so AAD binding matches PK. Unique-violation (23505) on the reverse-direction lock surfaces as `reason=already_bound` (cross-tenant lock).
   - Clears CSRF cookie. Redirects to `/workspaces/<id>/settings?slack=connected#integrations` — or, if state opts said `cb=1 p=<pid>`, to `/projects/<pid>/config?slack=connected&continueBinding=1#integrations` (ENG-5769 modal-resume).

Env vars actually read across the round-trip: `NEXT_PUBLIC_SITE_URL`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_BOT_SCOPES` (optional), `SLACK_CLIENT_APP_ID` (optional, used by status reads), `TOKEN_ENCRYPTION_KEY`.

After install: `listSlackChannelsAction` (project-slack.ts) decrypts the bot token and calls `conversations.list`. `bindSlackChannelAction` writes a `slack_channel_bindings` row.

---

## 5. Event ingestion — does code receive `message.*` and write anywhere?

Yes — code is **fully wired**. Whether Slack is **subscribed** to send events to it can't be verified from this env (no admin API token).

Path:

1. Slack POSTs `https://${NEXT_PUBLIC_SITE_URL}/api/slack/events`.
2. `nextjs-app/app/api/slack/events/route.ts:POST` reads raw body (load-bearing for signature), verifies `X-Slack-Signature` + `X-Slack-Request-Timestamp` against `SLACK_SIGNING_SECRET` with 5-min replay window (`lib/slack-event-signature.ts`). Fail → 401 `unauthorized:<reason>`, Sentry-tagged `area=slack, event_outcome=rejected`.
3. `url_verification` envelope → echo `challenge` back as `text/plain`.
4. `event_callback` → `dispatchSlackEvent(admin, envelope)` in `lib/slack-event-handlers.ts`. Always returns 200 (Slack retries on non-200).
5. By inner type:
   - `message` → `handleMessageEvent` (`lib/slack-event-handlers.ts:409`):
     - Filters subtypes: `bot_message, channel_join, channel_leave, channel_topic, channel_purpose, message_changed, message_deleted` (filter set at line 335). `message_changed/_deleted` deliberately deferred to C4.5.
     - Filters bot-without-user posts.
     - Looks up install by `(team_id, app_id, enterprise_id)` to get `bot_user_id` for own-bot guard.
     - Looks up `slack_channel_bindings` for `(install_id, channel_id)`. If unbound → `notes:["channel_not_bound"]` and ack 200 — **silently dropped**, by design.
     - If bound → strips Slack mrkdwn (`stripSlackMrkdwn`, regex-only, NO LLM per CF6) → calls Postgres RPC `create_slack_message_with_data_item`. RPC inserts one row in `slack_messages` + paired row in `data_items` atomically (born-together pattern). Idempotent on `(team_id, channel_id, ts)` partial unique. Concurrent redeliver → `notes:["duplicate"]`.
     - On insert success → `notes:["ingested"]`, `bindingsAffected: 1`.
   - `app_uninstalled` → mark all installs `status='token_revoked'`, set `revoked_at`, **delete** all `slack_channel_bindings` for that install.
   - `tokens_revoked` → mark install revoked but **preserve** bindings for reconnect-UI.
   - `channel_rename` → strict-break — **delete** bindings for the renamed channel id (CF9 RLS-leak vector).
6. Every result Sentry-tagged `area=slack, event_outcome=applied|unhandled|rejected, event_type=...`.

So: ingestion is functional code-side and writes to `data_items` (via the RPC), **only** for channels that have a `slack_channel_bindings` row pointing at a project. Unbound channels are dropped at line 519. No event will land if (a) Slack hasn't been told the events URL, (b) `SLACK_SIGNING_SECRET` is missing/wrong, or (c) no install + binding exist.

`tools/dx` (UseGin) does **not** receive events — `tools/dx/src/slack/` is pull-only via `WebClient` (handoff prose: "today UseGin is pull-only").

---

## 6. Slack secrets in Doppler

Project: `effi`. Probed `--only-names` per config; `get` for the suspicious values. `dev-env` project (separate, generic) also holds working dev tokens.

| Secret | effi/dev | effi/stg | effi/prod | effi/testing | effi/devops | effi/rnd | dev-env |
|---|---|---|---|---|---|---|---|
| `SLACK_BOT_TOKEN` | set | **`TODO_FROM_RAILWAY`** (placeholder) | **`TODO_FROM_RAILWAY`** (placeholder) | – | – | – | set (working xoxb) |
| `SLACK_CLIENT_ID` | `9761199231332.11058586666706` | **`TODO_FROM_RAILWAY`** | **`TODO_FROM_RAILWAY`** | – | – | – | set |
| `SLACK_CLIENT_SECRET` | set | **`TODO_FROM_RAILWAY`** | **`TODO_FROM_RAILWAY`** | – | – | – | – |
| `SLACK_SIGNING_SECRET` | set | **`TODO_FROM_RAILWAY`** | **`TODO_FROM_RAILWAY`** | – | – | – | – |
| `SLACK_USER_TOKEN` | – | – | – | – | – | – | set (xoxp working) |
| `USEGIN_SLACK_APP_TOKEN` | – | – | – | – | – | – | set (xapp- working — Effi Spike) |
| `USEGIN_SLACK_BOT_TOKEN` | – | – | – | – | – | – | set (xoxb — but `auth.test` returns `account_inactive`) |
| `TOKEN_ENCRYPTION_KEY` | present | present | present | MISSING | MISSING | – | – |

Findings:

- **The placeholder strings `TODO_FROM_RAILWAY` are live values in `effi/stg` and `effi/prod`.** If anything in stg/prod tried to read these, it would receive the literal text `TODO_FROM_RAILWAY` and behave as if no Slack secret existed. (Per `_NEEDS-FROM-LIHU.md` § SOON #4 Lihu owns this.)
- The working bot/user/app tokens live only in the *generic* `dev-env` Doppler project — not in `effi/*`. The two projects share the unprefixed `SLACK_*` namespace, which is what ENG-5761 wants to fix by renaming to `ASKEFFI_SLACK_*` / `USEGIN_SLACK_*`.
- `USEGIN_SLACK_BOT_TOKEN` returns `account_inactive` — the bot was disabled or the token was rotated and not refreshed. UseGin CLI work that requires a bot token will fail today unless re-issued.

---

## 7. Railway / staging / production

Read via `railway variables --service nextjs-app --environment {staging,production}`.

| Var | staging | production |
|---|---|---|
| `SLACK_CLIENT_ID` | `9761199231332.11081049680577` (a *different* client_id than `effi/dev`) | **MISSING** |
| `SLACK_CLIENT_SECRET` | set | **MISSING** |
| `SLACK_SIGNING_SECRET` | set | **MISSING** |
| `SLACK_BOT_TOKEN` | not set in nextjs-app vars (token is per-install in DB, not env) | not set |
| `TOKEN_ENCRYPTION_KEY` | **MISSING** | **MISSING** |
| `NEXT_PUBLIC_SITE_URL` | (set elsewhere) | `https://app.askeffi.ai` |

Implications:

- **Production cannot complete a customer Slack OAuth.** `connectSlackAction` would return `error: "Slack integration is not configured (SLACK_CLIENT_ID missing)"`. The callback would return `?slack=error&reason=not_configured`. Even if the client_id existed, every callback would fail at `encrypt()` because `TOKEN_ENCRYPTION_KEY` is missing → `?slack=error&reason=encryption_unavailable`.
- **Staging can start an OAuth round-trip but not finish it.** `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` are present, but `TOKEN_ENCRYPTION_KEY` is missing → encrypt throws → `reason=encryption_unavailable`. Staging is "halfway armed".
- The customer-facing UI is gated by the `slackIntegration` browser flag (default off). In practice, no customer can reach the broken stg/prod paths.
- Staging's `SLACK_CLIENT_ID` (`...11081049680577`) is **different** from `effi/dev`'s (`...11058586666706`). Two different OAuth apps registered at api.slack.com (probably one for each env) — confirmed by the differing client_ids.
- Two-service repo (`nextjs-app` + `python-services`); only `nextjs-app` consumes Slack secrets (verified by `rg`-ing python-services).

---

## 8. Linear tickets (Slack-related, current state)

Source: `plan list --search slack`, `plan get`. Top of tree is ENG-5399 (rd: Slack integration — build it twice).

| ID | Status | Assignee | Title |
|---|---|---|---|
| ENG-5399 | Backlog | – | rd: Slack integration — build it twice (Unified.to vs direct), customer + team surfaces |
| ENG-5409 | **In Progress** | nitsan@askeffi.ai | rd-slack: HANDOFF — first slice toward functional AskEffi-Slack (C) |
| ENG-5408 | **In Progress** | (per assignee=nitsan note: shared API key, not ownership) | rd-slack: HANDOFF — first slice toward functional UseGin-Slack (D) |
| ENG-5760 | **In Progress** | – | dx slack: admin-grade ops + post-install smoke |
| ENG-5761 | Backlog | – | doppler: rename SLACK_CLIENT_ID/SECRET/SIGNING_SECRET → ASKEFFI_SLACK_* (de-conflate UseGin from AskEffi-Slack secrets) |
| ENG-5410 | Backlog | – | rd-slack: z089 — token-encryption posture (decide before more integrations replicate the gap) |
| ENG-5417 | Backlog | – | rd-slack: D3 — start AskEffi-Slack Marketplace listing process (review takes 2-6 wk; ToS clock 2026-03) |
| ENG-5400 | Backlog | – | rd-slack: H — auth-identity-multi-workspace |
| ENG-5401 | Backlog | – | rd-slack: A — unified-platform |
| ENG-5402 | Backlog | – | rd-slack: F — comparative-paths Unified vs direct |
| ENG-5403 | Backlog | – | rd-slack: E — askeffi-slack-team-relation (collapsed: just C dogfooded) |
| ENG-5404 | Backlog | – | rd-slack: C — customer-channel-binding |
| ENG-5405 | Backlog | – | rd-slack: G — risks-failure-modes |
| ENG-5406 | Backlog | – | rd-slack: B — slack-direct-platform |
| ENG-5407 | Backlog | – | rd-slack: D — usegin-slack-team |

Done children of ENG-5409 (the customer-facing slice tree):

| ID | Title |
|---|---|
| ENG-5411 | Done — slack_channel_bindings + Slack-install button UI |
| ENG-5414 | Done — Marketplace-prep listing materials + security questionnaire |
| ENG-5416 | Done — C3 channel picker modal + per-project bind affordance |
| ENG-5769 | Done — slack: modal-from-project (no-install path) Slice 1 |
| ENG-5778 | Done — C4.1 message event handler + data_items persistence |

Per memory note (`feedback_linear_assignee_not_ownership`): assignees default to `nitsan@askeffi.ai` because the Linear API key is shared. Treat as team-owned.

---

## 9. Real-world humans-in-the-loop blockers

Source: `oria-crazy-world/ground/oria-crazy-space/_NEEDS-FROM-LIHU.md`. (Path is in the world repo, not the monorepo; auto-loaded as session-start banner.) Items verbatim, distilled:

1. **TOP — `ingest-poc` Slack app (Lihu created 2026-04-28 in `askeffi.slack.com`).** Add redirect URL `https://local-dev.askeffi.ai/api/slack/callback` at api.slack.com → OAuth & Permissions → Redirect URLs. Then copy `Client ID` + `Client Secret` from Basic Information into chat so Gin writes them to `nextjs-app/.env.local`. Blocks the in-app "Connect Slack" POC end-to-end.
2. **SOON — Effi Spike app `A0B0B7HBATC` admin access.** Lihu said he "can't do nothing on that app" — admin gap (Nitsan? Tom? service account?). Blocks production-app OAuth redirect URL config.
3. **SOON — Railway env vars.** From Doppler dev → Railway: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `TOKEN_ENCRYPTION_KEY`. **Required for staging/prod OAuth UI to work.** Local-dev doesn't need them. (This is the §7 prod-zero-vars and stg-missing-`TOKEN_ENCRYPTION_KEY` finding, expressed as a Lihu task.)
4. **SOON — Marketplace listing (ENG-5417).** Slack ToS clock is 2026-03; review is 2-6 weeks. Six `[LIHU UNKNOWN]` items in `usegin/research/slack-marketplace/security-questionnaire.md`, plus privacy/terms clauses, pricing+support email, and the submission itself.
5. **DECISION (open) — real Effi project vs parallel JSONL store** as the ingest-POC target. Today the POC writes to `oria-crazy-world/ground/oria-crazy-space/slack-ingest-poc/index/`. Decide (a) plug a real Effi project (needs project name + auth) or (b) keep parallel JSONL.

Implicit additional human-in-the-loop blocker (not in the file):
- **`USEGIN_SLACK_BOT_TOKEN` is `account_inactive`.** Whoever administers the UseGin-Slack app needs to re-enable or rotate. Without it, every `dx slack` command fails at config load.
- **`tools/dx/src/slack/registry.ts:EXPECTED_REAL_TEAM_ID = "T0AUGMX1XNZ"`** but live env `T09ND5V6T9S`. `dx slack smoke` will fail team_id check today; needs a human-readable resolution (constant stale, or dev-env wrong tenant).

---

## 10. Two-line summary

Customer-facing AskEffi-Slack is **fully coded and tested in the repo (OAuth start, callback, encrypted tokens, channel binding, message ingestion, lifecycle handlers, RLS) and live-installed in `askeffiworkspace.slack.com` in dev**, but customers can't reach it: the `slackIntegration` browser flag defaults off, staging is missing `TOKEN_ENCRYPTION_KEY`, production has zero Slack vars (and stg/prod Doppler hold literal `TODO_FROM_RAILWAY` placeholders), and the Marketplace listing (Slack-ToS-mandatory at scale) hasn't been submitted.

The customer flow is roughly **70% landed code-side, ~30% landed deploy-side** — the gap is human-blocked: Lihu must (a) plumb stg/prod env vars + `TOKEN_ENCRYPTION_KEY`, (b) finish the `ingest-poc` and Marketplace listing tasks in `_NEEDS-FROM-LIHU.md`, (c) reach Effi-Spike admin, and (d) flip the `slackIntegration` flag on. UseGin-Slack (internal team bot) ships in `tools/dx/src/slack/` but its bot token is currently `account_inactive`, so `dx slack` is dark today.
