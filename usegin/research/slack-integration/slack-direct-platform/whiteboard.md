# Whiteboard — angle B: slack-direct-platform

## Top — the click

**Smallest viable Slack-direct stack for AskEffi:** single Slack app (multi-workspace, distributed) using the **HTTP Events API** for ingestion + **Web API** (`conversations.history`/`replies`, `chat.postMessage`, `users.info`) for backfill and writes. **Bolt for Python in `python-services/`** is the right SDK home — that's where the sync workers, retention, file_search, and Fathom-shaped pipelines already live, and Bolt has first-class FastAPI/Starlette adapters. Next.js stays the public skin: it serves the OAuth `/install` and `/callback` routes (mirroring the SharePoint callback pattern), sets a CSRF-state cookie, and persists the install via service-role to Supabase. **Webhooks** (Events API) land on Next.js too (mirroring `app/api/webhooks/unified` and `app/api/webhooks/mailgun`) and are forwarded to Python over the private Railway URL — keeping the "Next.js is the public surface; Python is internal" invariant intact (`PRODUCT.md` line 40).

**The 2025 platform shape forces one decision early:** if AskEffi's customer-facing Slack integration is ever billed as part of a commercial SaaS, **we have to list in the Slack Marketplace** — because as of 2025-05-29, `conversations.history` and `conversations.replies` are throttled to **1 req/min, 15 messages/page** for every non-Marketplace, non-internal install (full enforcement on existing installs by 2026-03-03). That's a backfill-killer. Internal usegin-Slack and AskEffi-dogfood-Slack are unaffected (internal apps keep Tier 3); customer-facing is not viable at scale without Marketplace listing. **Plan to list. Don't fantasize about "we'll just ship as unlisted."**

**Time-to-MVP** for a single workspace, ingestion-only, no Marketplace: ~3–5 days of focused work — OAuth callback + token store, signing-secret middleware, `message.channels` subscription, `conversations.history` backfiller, mapping into `data_items` shape. Marketplace listing is its own multi-week track (review, security questionnaire, OAuth scope justifications) and runs in parallel.

---

## Middle — the body

### Platform overview (citations)

- Slack docs root: `https://docs.slack.dev/` (api.slack.com 302s here as of 2026).
- Three official SDKs: **Bolt for JavaScript**, **Bolt for Python**, **Bolt for Java**, plus the underlying Node Slack SDK and Python Slack SDK ([docs.slack.dev/]()).
- App types: **single-workspace (internal)**, **distributed unlisted**, **distributed Marketplace-listed** ([docs.slack.dev/distribution/]()).
- Token classes: `xoxb-` (bot), `xoxp-` (user), `xapp-` (app-level, only for Socket Mode).

### OAuth 2.0 v2 install flow

`https://docs.slack.dev/authentication/installing-with-oauth`

```
1. GET https://slack.com/oauth/v2/authorize
   ?client_id=...&scope=<bot scopes csv>&user_scope=<optional>
   &redirect_uri=<https callback>&state=<csrf>
2. User consents in Slack UI.
3. Slack redirects: <redirect_uri>?code=<one-time>&state=<csrf>  (code expires in 10 min)
4. POST https://slack.com/api/oauth.v2.access
   client_id, client_secret, code, redirect_uri  →
   {
     ok: true,
     access_token: "xoxb-...",          // bot token
     scope: "channels:history,...",
     bot_user_id: "U...",
     app_id: "A...",
     team: { id: "T...", name: "..." },
     enterprise: { id: "E..." } | null,  // present iff Enterprise Grid
     authed_user: { id, scope, access_token: "xoxp-..." } // if user_scope requested
   }
```

**Scope upgrades are additive** (re-running install with new scopes appends, never downgrades). The only way to remove a scope is full uninstall + reinstall — same shape as Google Drive in our codebase. **Action:** plan a "reconnect" UX from day 1; bot perm changes are inevitable.

**CSRF + state pattern:** mirror `nextjs-app/app/api/sharepoint/callback/route.ts` exactly — `slack_oauth_state` httpOnly cookie, `crypto.timingSafeEqual` comparison, UUID-validated `project_id`, service-role upsert into `cloud_connections` with `provider="slack"`. The SharePoint callback is the canonical analog and it's already battle-tested (ENG-3749).

**Install storage shape (per workspace, per project):**

```
cloud_connections (
  project_id,
  provider="slack",
  unified_connection_id=NULL,           -- not Unified
  -- new columns or sibling table for direct integrations:
  slack_team_id text,
  slack_enterprise_id text NULL,
  slack_bot_user_id text,
  slack_app_id text,
  -- tokens stored encrypted; bot token is per workspace install
  bot_access_token_encrypted bytea,
  user_access_token_encrypted bytea NULL,
  scopes_granted text[],
  installed_by_user_id text,
  status="active"
)
```

The Fathom-per-recorder gotcha applies: **one OAuth = one workspace's bot token, NOT cross-workspace coverage.** A team that runs two Slack workspaces (e.g. company + dev community) needs two installs.

### Scopes inventory (rationale per scope)

Bot-token scopes for the customer-channel-binding (angle C) use case — read messages from a chosen channel, write Effi replies back:

| Scope | Why we'd ask for it | Notes |
|---|---|---|
| `channels:read` | List public channels for the picker UI | Cheap, no message content |
| `groups:read` | List private channels the bot is in | Only channels bot was invited to |
| `im:read`, `mpim:read` | List DMs / group DMs | Skip for v1 (channel-binding only) |
| `channels:history` | Backfill + live read of public channel messages | **Hit by May-2025 throttling for non-Marketplace** |
| `groups:history` | Same for private channels | Same throttle |
| `im:history`, `mpim:history` | DM/group-DM history | Skip v1 |
| `chat:write` | Post Effi replies as the bot user | Required for any write; bot must be IN channel |
| `chat:write.public` | Post in public channels bot is NOT a member of | Optional; bypass invite requirement, riskier UX |
| `users:read` | Resolve `U...` IDs to names for citations | Cheap |
| `users:read.email` | Match Slack users to AskEffi users by email | Often gated by workspace admin approval |
| `reactions:read` | Reactions as signal (e.g. ":pin:" → save to project) | Optional but powerful for UX angle |
| `files:read` | Pull file uploads attached to messages | Required if we ingest shared files |
| `team:read` | Read workspace name/icon for UI | Cheap |

**Granular bot tokens only.** Slack's "classic" app type is deprecated — only granular permissions support Socket Mode AND modern features. We're a 2026-era app, granular by default.

**Admin-approval scopes:** `users:read.email` and any `*:write` scope at the workspace level may require workspace admin to approve install. Marketplace review will probe whether each requested scope is justified — Slack reviewers actively cut excess scopes. Build the scope list to be defensible.

### Events API vs Socket Mode — decision: **Events API (HTTP)**

`https://docs.slack.dev/apis/events-api/` and `https://docs.slack.dev/apis/socket-mode`

| | HTTP Events API | Socket Mode |
|---|---|---|
| Transport | Slack POSTs to your URL | App opens WebSocket to Slack |
| Public URL needed | Yes (we have one — Next.js) | No |
| Marketplace allowed | Yes | **No — single-workspace only** |
| App-level token | No | Yes (`xapp-...`) |
| Distributed apps | Yes | No |
| Connection limits | N/A (push) | 10 concurrent WS per app |
| Reconnects | N/A | Slack forces refresh every few hours |
| Best for | Production multi-tenant SaaS | Local dev, internal-only apps |

**Decision:** customer-facing → HTTP Events API. **Hard constraint:** Socket Mode is forbidden for Marketplace-listed apps, so we can't use it for the customer integration regardless. Internal usegin-Slack could use Socket Mode to skip the public-endpoint dance, but using the same HTTP path keeps one mental model and one piece of infra.

**Events API obligations** (non-negotiable):

1. **URL verification handshake:** first POST has `{type: "url_verification", challenge: "..."}`; respond with the `challenge` string in 200 within 3s.
2. **Sign every request:** verify `x-slack-signature` = `v0=` + HMAC-SHA256 of `v0:<x-slack-request-timestamp>:<raw-body>` keyed with the signing secret. Reject if timestamp is older than ~5 min (replay defense). Bolt does this automatically; if we ever hand-roll a route (e.g. inside Next.js for a webhook proxy), we re-implement it correctly.
3. **3-second 200 response.** Slack retries 3x with backoff (immediate, 1 min, 5 min) on non-200/timeout. Maintain ≥5% success rate per 60min or Slack auto-disables the subscription. **Pattern:** ack first, queue work to the Python worker (Supabase row + `kick_worker()` event — same shape as SharePoint, see `python-services/agent_api/sharepoint/worker.py`).
4. **Events API delivery cap:** 30,000 events per workspace per app per 60 minutes. After that we get an `app_rate_limited` event.

**Event types we care about** (with required scopes):

- `message.channels` (channels:history) — public-channel messages, the main signal
- `message.groups` (groups:history) — private
- `message.im`, `message.mpim` — DMs (later)
- `channel_created`, `channel_archive`, `channel_rename`, `channel_unarchive` (channels:read) — channel lifecycle, drives "channel renamed in Slack → update binding label"
- `member_joined_channel` / `member_left_channel` — bot membership signals (needed to know we lost read access)
- `app_uninstalled`, `tokens_revoked` — must-handle: flip `cloud_connections.status` to `revoked`, stop syncing, surface to UI

### Web API methods we'll actually call

`https://docs.slack.dev/reference/methods/conversations.history`

- `conversations.list` — Tier 2 (~20/min). Channel picker.
- `conversations.history` — Tier 3 (~50/min) for internal/Marketplace; **1/min for unlisted distributed (May-2025 cap)**. `limit` default 100, max 999. Cursor pagination via `response_metadata.next_cursor`. **Returns top-level messages only** — replies via `conversations.replies`.
- `conversations.replies` — same throttling regime as `.history` for unlisted.
- `chat.postMessage` — Special tier: ~1 message/sec/channel. Burst-friendly within a channel, hard ceiling across the workspace at scale.
- `users.info`, `users.list` — Tier 4 (~100/min). Cache aggressively in Supabase.
- `auth.test` — sanity-check a stored token; call on install + on token-refresh failure.

### Rate-limit envelope (what bites us)

`https://docs.slack.dev/apis/web-api/rate-limits`

- **Tier 1 / 1+/min** — rare admin methods, irrelevant.
- **Tier 2 / 20+/min** — `conversations.list`, `users.list`. Fine.
- **Tier 3 / 50+/min** — `conversations.history` (internal/Marketplace).
- **Tier 4 / 100+/min** — `users.info`. Fine.
- **Special** — `chat.postMessage` ≈ 1 msg/sec/channel.
- **Events delivery** — 30k events/workspace/app/60min.

**The one that matters:** for the customer integration, if we list in Marketplace → Tier 3 history is workable (50 calls × 999 msgs ≈ 50k msgs/min/channel theoretical, well under what any real channel produces). If we ship unlisted-distributed → 1 call × 15 msgs = 15 msgs/min, total backfill killer (a 10k-message channel takes ~11 hours).

**Limits are per-app per-workspace per-method.** Multiple workspaces don't share a budget, but a single workspace with 50 channels backfilling concurrently does — implement a per-workspace token-bucket queue in the sync worker, not per-channel.

### Backfill via `conversations.history`

```
backfill(channel_id, oldest=last_synced_ts, latest=now):
    cursor = None
    while True:
        resp = conversations.history(
            channel=channel_id,
            oldest=oldest,         # exclusive unless inclusive=true
            limit=999,             # max
            cursor=cursor,
        )
        for msg in resp.messages:
            persist_message(msg)
            if msg.thread_ts and msg.reply_count > 0:
                backfill_thread(channel_id, msg.thread_ts)
        if not resp.has_more:
            break
        cursor = resp.response_metadata.next_cursor
        respect_rate_limit_headers(resp)   # Retry-After on 429
```

**Threads:** `conversations.history` returns parents only. For each parent with `thread_ts == ts && reply_count > 0`, call `conversations.replies` separately. Treat threads as first-class objects in our data model (parent + reply set) — Effi's citation experience benefits.

**Retention bites backfill:**
- **Slack Free** (post-2024-08): only the last 90 days of messages are accessible; older messages are hidden, and after 1 year they're permanently deleted. **Don't promise "all your Slack history" to customers on free plans.**
- **Pro / Business+ / Enterprise:** higher / configurable retention, but the customer's workspace owner sets the policy — we can't fight a workspace-level "delete after 30 days" rule. Surface the workspace's effective retention in our UI (`team.profile.get` → discovery API for retention is admin-scoped; pragmatic option: just attempt the backfill and report what we got).

### Multi-workspace install model

A distributed app gets installed independently in every workspace. The **app** is one entity (one `client_id`, one signing secret, one set of subscribed events) but each install produces a workspace-scoped `xoxb-` bot token, a `team_id`, and a per-workspace event stream. Slack identifies which install an event belongs to via the `team_id` (and `enterprise_id` for Enterprise Grid) in the event envelope — our Events handler must look up the install row by `(team_id, [enterprise_id])` and load that workspace's bot token before touching the Web API.

**Enterprise Grid** is a separate cardinality layer: one `enterprise_id` contains many `team_id`s, and a single org-wide install can span all of them. Most of our customer base is small/mid teams on standalone workspaces — design for `team_id` as the primary key and let Enterprise Grid be a v2 problem, but **store `enterprise_id` from day 1** (it'll be `null` for non-Grid workspaces) so we don't migrate later.

**This is the Fathom-per-recorder analog.** Per `reference_fathom_per_recorder_scoping`: a single OAuth = one user/recorder's scope. For Slack: a single OAuth = one workspace's bot token. If a customer org runs two Slack workspaces and both should sync into the same AskEffi project, that's two installs and two `cloud_connections` rows with the same `project_id` and different `slack_team_id`s. **Or** workspace ↔ project becomes 1:1 by policy and multi-workspace customers create multiple projects. **Open question for angle C/H to settle.**

### Bolt-Python in python-services — concrete shape

```python
# python-services/agent_api/slack/__init__.py (sketch)
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.starlette.async_handler import AsyncSlackRequestHandler
from slack_bolt.oauth.async_oauth_settings import AsyncOAuthSettings

oauth_settings = AsyncOAuthSettings(
    client_id=env.SLACK_CLIENT_ID,
    client_secret=env.SLACK_CLIENT_SECRET,
    scopes=[
        "channels:read", "channels:history",
        "groups:read",   "groups:history",
        "chat:write", "users:read", "users:read.email", "team:read",
    ],
    installation_store=SupabaseInstallationStore(),  # custom: cloud_connections
    state_store=SupabaseStateStore(),                # short-TTL CSRF state
)

app = AsyncApp(
    signing_secret=env.SLACK_SIGNING_SECRET,
    oauth_settings=oauth_settings,
)

@app.event("message")
async def on_message(event, body, ack):
    await ack()                      # 200 within 3s
    await enqueue_for_sync(body)     # row in slack_messages_inbox + kick_worker()

handler = AsyncSlackRequestHandler(app)  # mounted on FastAPI internal route
```

**Why Bolt-Python over Bolt-JS:**
1. Sync/worker pattern lives in `python-services/agent_api/` — SharePoint, Drive, Fathom, retention, VAIS indexing all run here. Slack ingestion fits naturally next to them, NOT in Next.js (where serverless cold-starts and 10s function-timeout caps fight long-running backfill).
2. Bolt JS has no first-class Next.js App Router adapter (`docs.slack.dev/tools/bolt-js/concepts/receiver`). Available receivers: HttpReceiver, ExpressReceiver, AwsLambdaReceiver, SocketModeReceiver. Running Bolt-JS inside an App-Router route is community-pattern-only; not worth the friction.
3. Bolt-Python ships an installation-store interface we plug Supabase into directly.

**What stays in Next.js:**
- The customer-facing OAuth `/api/slack/install` (build authorize URL, set state cookie, redirect) and `/api/slack/callback` (mirror SharePoint callback exactly: validate state, UUID project_id, RLS access check, upsert `cloud_connections`).
- The webhook proxy at `/api/webhooks/slack` — verify signing secret, then forward the raw body to Python over the private Railway URL with the existing `INTERNAL_RPC_SECRET` shape (`nextjs-app/lib/env.ts` line 28). **Or** — alternative: register the Slack request URL directly against Python (which has no public URL today). Cheapest is to keep the current invariant: public traffic always enters via Next.js.

**New env vars** (mirror `nextjs-app/lib/env.ts` conventions):

```
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_SIGNING_SECRET            # for verifying Events API + Interactivity
SLACK_APP_ID                    # nice-to-have for logs/sentry tagging
# (No SLACK_APP_LEVEL_TOKEN unless we use Socket Mode — we're not.)
```

### Operational obligations beyond OAuth

- **Signing-secret verification on every inbound request**, including interactivity, slash commands, and Events. Reject with 401 if HMAC mismatches OR if `x-slack-request-timestamp` is older than 5 min.
- **`tokens_revoked` and `app_uninstalled` events** must flip the install row to `revoked` and stop the sync worker — otherwise we'll log 401s in a hot loop. (See `python-services/agent_api/sharepoint/subscriptions.py` for the analogous Graph webhook lifecycle handler shape.)
- **Scope re-consent** flow: when we add a new scope, every existing install needs to re-authorize. Build a "your Slack permissions are out of date — reconnect" banner on the project config page from day 1; we will need it.
- **Marketplace review:** if/when we list, expect a security questionnaire (data handling, retention, deletion-on-uninstall, encryption at rest), OAuth scope justification per scope, and reviewer pushback on anything that looks over-scoped. Allow weeks, not days. (Direct doc page intermittently 404s as of the fetch; `docs.slack.dev/distribution/` confirms the three-tier model.)
- **Deletion semantics:** when a user deletes/edits a message in Slack, we get `message_deleted` / `message_changed` events. We must propagate to `data_items` to keep search results truthful. (Email-splitter precedent ENG-5197 chose regex-only, no LLM, for ingestion — same instinct here: ingest the structured event, don't infer from content.)

---

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1. List in Slack Marketplace, or not?**
- Decision needed: yes/no/later for the customer-facing Slack integration.
- Options:
  - (a) **List from day 1.** Forces clean scope hygiene, security posture, deletion semantics. Multi-week review delay.
  - (b) **Ship unlisted, list later.** Ships fast for pilots. Hard cliff: by 2026-03-03, existing unlisted commercial installs are throttled to 1 req/min × 15 msgs for `conversations.history`/`replies`. Backfill-broken for any nontrivial channel.
  - (c) **Ship as "internal only"** for the team-dogfood case (D, E) and defer customer-facing entirely.
- Lean: **(b) for pilot + (a) running in parallel from day 1.** The 2026-03-03 cliff is not negotiable; pretending it isn't there is the trap.
- Price of being wrong: rebuild backfill UX after a customer's import takes 14 hours instead of 3 minutes; or burn 4–6 weeks before the first pilot if we wait for review.
- For Lihu to weigh: how aggressive is the customer rollout timeline relative to Marketplace review?

**D2. Bolt-Python vs raw `slack_sdk` HTTP.**
- Decision needed: take Bolt's batteries-included shape, or roll our own minimal client?
- Options:
  - (a) **Bolt-Python** — OAuth flow, signing-secret middleware, retry/ack, listener pattern. Bigger surface area, more "framework".
  - (b) **`slack_sdk` direct** + hand-rolled FastAPI routes for OAuth + Events. Smaller, every line is ours.
- Lean: **(a) for receive (Events API), (b) for send (Web API calls inside the worker).** Use Bolt only at the edge where signing/OAuth boilerplate is densest; call `slack_sdk.web.AsyncWebClient` directly from the sync worker. Hybrid keeps framework where it earns its keep.
- For Lihu: are we comfortable adding `slack-bolt` + `slack-sdk` as core deps? Both are official, well-maintained.

**D3. Event ingestion path: Next.js → Python proxy, or direct Python public endpoint?**
- Decision needed: keep the "Next.js is the only public surface" invariant, or carve a slack-only public route on Python?
- Options:
  - (a) **Proxy through Next.js** to keep the invariant. Adds one hop, one signing verification on Next.js side, one internal-RPC-signed forward to Python.
  - (b) **Expose Python publicly** for `/slack/events` only (matches what Bolt is built for). Breaks the invariant.
- Lean: **(a)** — invariant earns its keep; the proxy is ~30 lines and it's the same shape as `app/api/webhooks/unified` and `app/api/webhooks/mailgun`. We already do this for Unified.to.
- For Lihu: confirm we want to keep the invariant strict here.

**D4. Workspace ↔ project cardinality.**
- Decision needed: 1 Slack-workspace ↔ 1 AskEffi-project, or 1-to-many in either direction?
- Constraint: a Slack OAuth install is per-workspace (`team_id`). A workspace has many channels. Customer-facing UX is "1 channel ↔ 1 project" (RESUME.md).
- So: **one workspace install** can fan out across **many projects** (each with a different channel pinned). Same `xoxb-` token, different `cloud_connections.project_id` rows. Need a workspace-level "install record" + per-project "channel binding" — angle C and H need to align on the data model. Flagging here so it doesn't fall through the cracks.

**D5. Enterprise Grid support — now, or later?**
- Decision needed: support `enterprise_id` install scope from day 1 or punt?
- Lean: **store the column from day 1, don't implement org-wide install UX until a customer asks.** Free, future-proof.

### Gaps I couldn't close in this round

- **Exact Marketplace review timeline and security questionnaire contents** — direct doc page (`api.slack.com/docs/slack-marketplace`) 404s through the new docs.slack.dev redirect; need a real read of the current submission portal at `api.slack.com/apps`. Worth a 30-min targeted dive before the recommendation locks.
- **Pro/Business+/Enterprise message retention specifics** — Slack help-center page covers Free clearly, paid tiers only generically. For real-customer planning we need to actually pull `team.info` / admin retention API and report whatever we can read at install time.
- **Whether `chat.postMessage` "1 msg/sec/channel" stacks** when Effi answers across many channels in the same workspace — likely yes (per-channel), but worth a 5-min experiment against a free workspace before we promise anything.

### Friction zettels

None captured this round — the docs are well-organized and the SDK story is clean. The one friction-worthy finding (May-2025 throttling forcing Marketplace listing) is loud enough that it lives in D1 above and in the Top — promoting it to a zettel feels like duplication unless we land an actual decision against it.

If a zettel does land later in the round, the title should be along the lines of *"Slack May-2025 ToS update means commercial Slack integrations must Marketplace-list — there is no 'unlisted commercial' path anymore."* — that's the kind of platform-shape change worth preserving in `usegin/zettel/`.
