# Slack integration — end-to-end demo recipe

> **Coming back from vacation? Read `CLOSE.md` first** — six management-shape decisions waiting for you (~5 min). Then come back here.

**Audience:** Lihu (returning from vacation), Tom, anyone who wants to see Slack work end-to-end on their own machine.

**Goal:** prove both surfaces work — UseGin-Slack (`dx slack send #usegin "hi"` lands in our team Slack) and AskEffi-Slack (a customer admin connects their Slack workspace, picks a channel, the binding shows in their project Integrations tab).

The code is already on `main`. This doc is just the human-only steps + smoke commands. Each `[X]` checkbox below should pass before declaring the demo green.

---

## Phase 0 — One-time secrets you need

Generate the encryption key once. Same value for staging + production.

```bash
openssl rand -base64 32
# → e.g.  9X8Pd...zQ8=
```

Paste into Doppler (and Railway sealed env if Doppler doesn't sync there) for both `staging` and `production`:

- `TOKEN_ENCRYPTION_KEY` — the 32 random bytes you just generated.

Until this is set, the Slack OAuth callback **refuses to write** the bot token. That's the z091 quality gate firing as designed (see `nextjs-app/lib/token-crypto.ts` `loadKey()`).

- [ ] `TOKEN_ENCRYPTION_KEY` set in Doppler for staging
- [ ] `TOKEN_ENCRYPTION_KEY` set in Doppler for production

---

## Phase 1 — UseGin-Slack (the team's Gin-mediated surface)

This is the smaller demo. About 10 minutes.

### 1a. Register the UseGin Slack app

At https://api.slack.com/apps → "Create New App" → "From scratch":

- **App Name:** `UseGin` (or `UseGin-dev` for a sandbox install)
- **Workspace:** AskEffi team Slack

Then in the app config:

**OAuth & Permissions → Scopes → Bot Token Scopes** (add all of these — generous now so future slices don't re-scope):

- `chat:write`
- `channels:read`
- `channels:history`
- `groups:read`
- `groups:history`
- `im:history`
- `mpim:history`
- `app_mentions:read`
- `reactions:write`
- `users:read`

**Install App → Install to Workspace.** Copy the `Bot User OAuth Token` (starts with `xoxb-`).

- [ ] App registered
- [ ] Bot scopes added
- [ ] Installed on AskEffi team Slack
- [ ] `xoxb-…` token copied

### 1b. Set the bot token in Doppler

```bash
doppler secrets set USEGIN_SLACK_BOT_TOKEN="xoxb-…"
# (in whichever Doppler project/config the team uses for `dx`)
```

- [ ] `USEGIN_SLACK_BOT_TOKEN` set

### 1c. Create the `#usegin` channel

In Slack, create a public channel `#usegin` and `/invite @UseGin`. This is Gin's outbox per z091 / D's whiteboard. Per `project_zettel_no_privacy`, no privacy tier — full team visibility by design.

- [ ] `#usegin` created
- [ ] `@UseGin` invited

### 1d. Smoke test the four CLI surfaces

```bash
# bot identity (should print workspace name + scopes)
doppler run -- dx slack whoami

# post to outbox (defaults to #usegin)
doppler run -- dx slack post "hi from Gin — ENG-5408 D4 demo"
# ↑ verify: ENG-5408 renders as a clickable Linear link in Slack

# post to a specific channel
doppler run -- dx slack send "#engineering" "Gin says hi"

# read recent messages
doppler run -- dx slack read "#usegin" --since 1d

# poll mentions queue
doppler run -- dx slack inbox --since 1d
```

**Expected:**

- [ ] `whoami` prints workspace, bot user id, scopes (no `xoxb-…` leakage; only a token mask).
- [ ] `post` puts a message in `#usegin` with `ENG-5408` rendered as a clickable Linear link.
- [ ] `send` posts to `#engineering`.
- [ ] `read` returns messages, JSON-pipeable on `--json`.
- [ ] `inbox` lists `@usegin` mentions (or "no mentions" if none yet).

That's UseGin-Slack done. The other half of the demo is below.

---

## Phase 2 — AskEffi-Slack (the customer-facing surface)

This is the bigger demo: an admin connects Slack, picks a channel, sees it bound in a project. About 15 minutes.

### 2a. Register the AskEffi-Slack Slack app

**DISTINCT app from UseGin** — different `app_id`, different scope surface, different review track per `usegin/research/slack-integration/auth-identity-cardinality/whiteboard.md`.

At https://api.slack.com/apps → "Create New App" → "From scratch":

- **App Name:** `AskEffi-Slack` (or `AskEffi-Slack-staging` for a sandbox)
- **Workspace:** anything (review submission later picks customer workspaces; for now install on AskEffi team)

**OAuth & Permissions:**

- **Redirect URL:** `${NEXT_PUBLIC_SITE_URL}/api/slack/callback`
  (locally: `http://localhost:3000/api/slack/callback`; staging: the actual staging URL)
- **Bot Token Scopes** (per C1 + R2 lean: read-only at MVP, no DM scopes):
  - `channels:read`
  - `channels:history`
  - `groups:read`
  - `groups:history`
  - `users:read`
  - `team:read`
  - **NOT** `im:*` / `mpim:*` (G's RLS-leak posture)
  - `commands` is optional (we're not using slash commands at MVP, but cheap to add)

**Event Subscriptions** (per C5 — required for lifecycle handling):

- Turn on Event Subscriptions.
- **Request URL:** `${NEXT_PUBLIC_SITE_URL}/api/slack/events` — Slack will ping it once with a `url_verification` challenge; our route returns the challenge in plain text so it should verify on save.
- **Subscribe to bot events:**
  - `app_uninstalled` — admin removed the app → we mark install revoked + delete bindings.
  - `tokens_revoked` — tokens invalidated → we mark install revoked, preserve bindings (so customer can reconnect without losing config).
  - `channel_rename` — STRICT-BREAK per CF9 (RLS-leak vector if we silently followed the id) → we delete bindings for the renamed channel id.

From "Basic Information → App Credentials" copy:
- `Client ID` and `Client Secret` (for OAuth callback).
- `Signing Secret` (for Events route signature verification).

- [ ] App registered
- [ ] Distinct from UseGin (different `app_id`)
- [ ] Redirect URL configured
- [ ] Bot scopes added
- [ ] No DM scopes
- [ ] `Client ID` + `Client Secret` copied

### 2b. Set OAuth credentials in Doppler

```bash
doppler secrets set SLACK_CLIENT_ID="…"
doppler secrets set SLACK_CLIENT_SECRET="…"
doppler secrets set SLACK_SIGNING_SECRET="…"   # required by Events route

# Optional but recommended — strict-app filter for cross-app installs:
doppler secrets set SLACK_CLIENT_APP_ID="A0XXXXXXX"   # AskEffi-Slack's app_id
```

(You already set `TOKEN_ENCRYPTION_KEY` in Phase 0.)

- [ ] `SLACK_CLIENT_ID` set
- [ ] `SLACK_CLIENT_SECRET` set
- [ ] `SLACK_SIGNING_SECRET` set
- [ ] `SLACK_CLIENT_APP_ID` set (optional)

### 2c. Run the dev server (or open staging)

```bash
just agent-dev   # or your usual `just dev`
# or use staging
```

### 2d. Demo the customer flow

1. **Sign in as a workspace owner** (an admin — not a member-only user).
2. Go to **Workspace Settings → Integrations**.
3. Click **"Connect Slack"** on the Slack card. → redirects to Slack's OAuth approve page.
4. Approve. → redirects back to `/workspaces/<id>/settings#integrations` with `?slack=connected`.
5. The Slack card now shows **"Connected"** + the team name.
6. Open any **project** owned by this workspace.
7. Go to the project's **Integrations** tab.
8. Find the **Slack** card. Click **"Bind a channel"**.
9. The picker modal opens, listing channels the bot can see (public + private-the-bot's-in; no DMs).
10. Pick a channel → click **"Bind channel"**. Modal closes.
11. The card now shows **"#channel-name"** with an "Unbind" button.
12. Click "Bind another channel" → repeat for a second channel (cardinality is N:1 per R3).
13. Click "Unbind" on one → it disappears from the list.

**Expected:**

- [ ] OAuth round-trip completes; `slack_installs` row exists in DB.
- [ ] Bot token is **encrypted in DB** (`bot_token_encrypted` starts with `v1:`).
- [ ] Channel picker filters out DMs.
- [ ] Bind round-trip writes a `slack_channel_bindings` row.
- [ ] Two channels can bind to one project (N:1 schema).
- [ ] Unbind removes the row.
- [ ] No `xoxb-` raw token appears anywhere in logs.

### 2e. Verify the encryption is real

```bash
psql … -c "select id, substring(bot_token_encrypted, 1, 3) as prefix
           from slack_installs limit 1;"
# → prefix should be 'v1:'
```

If the prefix is `xox` instead of `v1:`, encryption-on-write is broken. (Should not happen — z091 quality gate refuses raw writes.)

- [ ] DB column shows `v1:` prefix

### 2f. Run the backfill (no-op first time)

```bash
cd nextjs-app && bun scripts/backfill-slack-token-encryption.ts --dry-run
# → expected: already_encrypted=N updated=0 raw_legacy=0
```

- [ ] Backfill reports `raw_legacy=0` (everything written today is already encrypted)

---

## Phase 3 — When something looks wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `dx slack whoami` exit code 2 | `USEGIN_SLACK_BOT_TOKEN` not in env | `doppler run --` prefix; or set the secret. |
| `dx slack whoami` returns `invalid_auth` | Token revoked / scopes changed | Re-install app; copy fresh `xoxb-…`; update Doppler. |
| OAuth callback says "encryption_unavailable" | `TOKEN_ENCRYPTION_KEY` not set | Phase 0. |
| Slack `conversations.history` says "ratelimited" | Hit the May-2025 ToS throttle | Marketplace listing accelerates the rate-limit (see `usegin/research/slack-marketplace/review-blockers.md` A1). |
| Channel picker shows "Slack install token is in a legacy format" | Backfill leak (a row escaped encrypt-on-write) | Run Phase 2f backfill, then reconnect that workspace. |
| Bind says "already_bound" | Customer is binding a channel that's already attached to another AskEffi tenant | This is the reverse-direction lock from H — by design. |

---

## What's intentionally NOT in this demo

- **Effi answering questions about Slack messages.** That's C4 (Events API ingestion + sync worker → data items). Future slice.
- **Slack-to-Effi bidirectional / `@Effi mention`.** R2 lean is read-only at MVP.
- **Marketplace listing.** Required for >5 customer workspaces (May-2025 ToS); see `usegin/research/slack-marketplace/submission-checklist.md`.
- ~~**Lifecycle: channel rename / archive / `tokens_revoked` / `app_uninstalled`.**~~ ✓ C5 wired (commit `833f0e159`): `channel_rename` strict-breaks bindings, `app_uninstalled` revokes + deletes, `tokens_revoked` revokes + preserves bindings. `channel_archive` / `channel_deleted` still deferred (soft-deactivate vs hard-delete dilemma — defer until a customer hits it).
- **Encryption key rotation.** Recommended cadence proposed in `usegin/research/token-encryption/recommendation.md`; not automated yet.

---

## Pointers

- Round entry: `usegin/research/slack-integration/RESUME.md`
- Synthesis: `usegin/research/slack-integration/SYNTHESIS.md`
- Recommendations (5 z026-shape decisions for Lihu): `usegin/research/slack-integration/recommendation.md`
- Per-angle whiteboards: `usegin/research/slack-integration/<angle>/whiteboard.md`
- Marketplace prep: `usegin/research/slack-marketplace/`
- Token encryption: `usegin/research/token-encryption/recommendation.md`
- For Tom (handoff if Lihu's session unavailable): `usegin/research/slack-integration/FOR-TOM.md`
- Audits across the autonomous-vibe run: `usegin/comptroller/audits/`
