# Whiteboard — angle A: unified-platform

## Top — the click

**"Unified 2" is not a thing in our code.** There is exactly one Unified.to in the
codebase: the `unified_python_sdk` (v0.57.40) wrapped by
`python-services/agent_api/connectors/unified_client.py`. No `v2` prefix, no
internal "Unified-2" abstraction. Best read of the user's phrasing: it's
shorthand for **"do the Slack integration via the Unified.to platform we already
use"** — i.e. reuse the Drive/Fathom/Linear paved road, not build a second
abstraction.

**Slack on Unified.to is a paved road for ~70% of what we'd need, and a dirt
path for the last 30%.** Concretely:

- Paved (already in our SDK + already wired through our codebase patterns):
  OAuth via `get_unified_integration_auth(integration_type="slack", scopes=...)`,
  normalized `MessagingChannel` + `MessagingMessage` data shapes, list/get/create
  message ops, **real-time webhooks for channels** (`MESSAGING_CHANNEL`
  ObjectType) and **virtual/polling webhooks for messages**
  (`MESSAGING_MESSAGE`), workspace-level connection records with the same
  reconcile dispatch contract as Drive (`_DISPATCH` in
  `python-services/agent_api/api/internal_webhooks.py:65`).
- Dirt (still on us):
  - **No `MessagingSyncService`** today — every existing connector
    (`drive_sync_service`, `fathom_sync_service`, `email_sync_service`) is a
    file/recording/email pull; we'd be writing the first message-shaped one.
  - **`register_webhooks()` is hard-coded to `STORAGE_FILE`**
    (`unified_client.py:1402,1414`) — it would need a generalization (or a
    parallel `register_messaging_webhooks()`) to subscribe to
    `MESSAGING_CHANNEL` / `MESSAGING_MESSAGE` events.
  - **Webhook dispatch table only knows `google_drive`** (`internal_webhooks.py:65-67`)
    — we'd add a `slack` arm pointing at a new `reconcile_slack_webhook`.
  - **Per-workspace cardinality lock**: a single Unified.to connection = one
    Slack workspace's bot token, same per-recorder gotcha that bit Fathom
    (`reference_fathom_per_recorder_scoping`). Multi-workspace customers
    require N connections.
  - **No data-item mapping for messages** — `gfs_sync_items` is file-shaped;
    `meetings` is recording-shaped. Slack messages don't fit either; that's a
    data-model decision the C/customer-channel-binding angle will own.

**Time-to-MVP estimate (Unified path, customer-channel-binding surface only):**
~1.5–2.5 engineer-weeks to a working "messages from one channel land in the
project as searchable items" demo, assuming the C-angle picks a data-model
shape that's not gold-plated. Most of that is the new `messaging_sync_service`
+ `reconcile_slack_webhook` + UI plumbing, NOT auth/transport — those are
already paved.

**Lock-in cost:** moderate. We're already deeply locked into Unified.to for
Drive/Fathom/Linear/SharePoint (4 integration types, `unified_client.py` is
1530 lines, `cloud_connections.unified_connection_id` is a load-bearing FK).
Adding Slack here doesn't increase the lock-in vector; it amortizes it. The
escape hatch (re-implementing direct against Slack's Web API + Events API)
remains a per-integration rewrite, same cost as escape from any other
Unified-mediated provider.

---

## Middle — the body

### How Fathom flows through Unified.to today (the canonical reference)

**1. OAuth initiation (browser → Next.js → Python → Unified.to):**

- User clicks Connect Fathom in the project config UI.
- `nextjs-app/app/actions/project-fathom.ts:346` — `connectFathomAction`:
  - Mints a 32-byte CSRF nonce, sets it as an httpOnly `fathom_oauth_state`
    cookie scoped to `/api/fathom/callback`.
  - POSTs to Python `/api/fathom/connect` with `{project_id, success_redirect,
    failure_redirect, state}`.
- `python-services/agent_api/api/fathom.py:479` — `POST /fathom/connect`
  calls `unified.get_fathom_auth_url(...)` →
  `unified_client.py:254` → `client.unified.get_unified_integration_auth({
    integration_type: "fathom",
    workspace_id: UNIFIED_WORKSPACE_ID,
    scopes: ["calendar_recording_read"],
    env: UNIFIED_ENV,  // "Production"
    success_redirect, failure_redirect, state })`.
- Returns the Unified.to-hosted OAuth URL; Next.js redirects the browser there.

**2. OAuth callback (Unified.to → Next.js):**

- Unified.to redirects the browser to `nextjs-app/app/api/fathom/callback/route.ts`
  with `?project_id=X&id=<unified_connection_id>&state=...`.
- The callback (`callback/route.ts:29`):
  - Validates `project_id` is a UUID.
  - Validates `state` against the cookie via `crypto.timingSafeEqual` (CSRF C2 — ENG-3749).
  - RLS-checks the user has access to the project.
  - **Two-step upsert** into `meeting_connections` (active row exists? update;
    else insert) — avoids dup-key violations on reconnect (ENG-3749).
  - Stores `unified_connection_id`, `provider="fathom"`, `status="active"`.
  - Clears the state cookie, redirects to `/projects/.../config?fathom=connected`.

**3. Token storage:** Unified.to holds the OAuth tokens. We never see them.
We persist only the `unified_connection_id` — an opaque handle the Python SDK
swaps for tokens at call time. No refresh logic in our codebase.

**4. Sync trigger:**

- Manual: `POST /api/fathom/{project_id}/sync` (`fathom.py:792`) → sync_worker.
- Webhook-driven: Unified.to → `/api/webhooks/unified` (Drive only today;
  Fathom currently uses cron-driven sweep — `test_sync_worker_fathom_sweep.py`).

**5. Data ingestion (`fathom_sync_service.py`):**

- `sync_meetings(connection_id, project_id, unified_connection_id, last_sync_at)`
  paginates `unified.iter_recording_pages(...)` — which itself swaps between
  offset and `updated_gte` cursor pagination to dodge Unified.to's 50-item cap
  and Fathom's 429 boundary (ENG-4875, ENG-5281 — see `unified_client.py:375`).
- For each page: dedupe via `gfs_sync_items.external_id`, insert new
  `meetings` rows + `meeting_participants`, extract `transcript` from
  `recording.raw["transcript"]`.

**6. Indexing:** post-sync, the Python sync worker hands transcripts to the
data-processing pipeline → Vertex AI Search (VAIS). Outside this charter's
scope, but the entry point is `meetings.transcript_text` becoming a VAIS
document.

### Public-edge webhook contract (the seam that matters for Slack)

`nextjs-app/app/api/webhooks/unified/route.ts` is the single public-facing
Unified.to webhook entry. It is **provider-agnostic**:

1. Edge generates a `request_id` (uuid v4) attached to every response.
2. Fail-closed if `UNIFIED_WEBHOOK_SECRET` unset.
3. Body size cap (1 MB), pre- and post-read.
4. `req.text()` to preserve exact bytes (NOT `req.json()` — re-serialization
   would break HMAC parity with Python).
5. Verify Unified.to HMAC-SHA256 over `JSON.stringify(data) + nonce`,
   timing-safe compare.
6. Sign the raw bytes for internal-RPC (HMAC headers via
   `lib/internal-rpc/sign.ts`).
7. Forward to Python `/internal/webhooks/unified` over Railway private network
   with 5s abort timeout.
8. Python re-verifies the Unified.to HMAC (defense-in-depth — sidecar trust
   model, see `internal_webhooks.py:103`), looks up `cloud_connections` by
   `unified_connection_id`, dispatches via `_DISPATCH[provider]`.
9. **Adding a new provider = add one arm to `_DISPATCH`**
   (`internal_webhooks.py:65`). This is the explicit seam contract per the
   ENG-4937/4939/4940 ladder. Slack would land here as
   `_DISPATCH["slack"] = _dispatch_slack_messages`.

### What the Unified.to SDK gives us for Slack specifically

Confirmed against `unified_python_sdk==0.57.40` (file-grep verified, not just
docs):

- **Integration type:** `"slack"` (Unified.to docs page exists at
  `docs.unified.to/integrations/slack`; OAuth2 flow; covers messaging + HR +
  auth + passthrough).
- **OAuth scopes** — the `Permissions` enum in
  `models/shared/property_connection_permissions.py` exposes:
  - `messaging_message_read`, `messaging_message_write`
  - `messaging_channel_read`
  - (no `messaging_channel_write` in the enum — read-only for channel mgmt)
- **Resources:** `client.messaging.list_messaging_channels`,
  `get_messaging_channel`, `list_messaging_messages`, `get_messaging_message`,
  `create_messaging_message`, `patch_messaging_message`, `update_messaging_message`,
  `remove_messaging_message`. (Source: `messaging.py`, `channel.py`, `message.py`.)
- **Webhook ObjectTypes** (`models/shared/webhook.py`):
  - `MESSAGING_CHANNEL` — Unified.to docs: **native (real-time)** for Slack channels.
  - `MESSAGING_MESSAGE` — Unified.to docs: **virtual native (polling)** for Slack messages.
  - i.e. channel CRUD pushes immediately; message events are polled. Implication:
    1-min interval (paid plan minimum, our existing setting) sets the
    customer-visible message-sync latency floor at ~60s.
- **Normalized data shape (`models/shared/messagingmessage.py`):**
  - `id`, `channel_id`, `channels[]`, `parent_id`, `root_message_id`,
    `message_thread_identifier` (threading paved).
  - `author_member`, `mentioned_members[]`, `destination_members[]`,
    `hidden_members[]` (the email-shaped fields exist but Slack uses
    author + mentioned).
  - `message`, `message_html`, `message_markdown` — three rendering options.
  - `attachments[]`, `buttons[]`, `reactions[]`, `subject`, `created_at`,
    `updated_at`, `web_url`, `raw` (provider-native passthrough).
- **Channel shape (`messagingchannel.py`):** `id`, `name`, `description`,
  `is_active`, `is_private`, `members[]`, `parent_id`, `has_subchannels`,
  `web_url`, `raw`.
- **Documented slow fields (per Unified.to docs page):** `members` on channels;
  `author_member`, `mentioned_members`, `message` content on messages. Implies
  selective `fields=` projection at list time (same pattern Fathom uses with
  `ListCalendarRecordingsQueryParamFields`).

### What our codebase already abstracts vs what's still raw

**Abstracted (would Just Work for Slack):**

- OAuth URL minting (`get_<provider>_auth_url` pattern — add `get_slack_auth_url`
  beside `get_fathom_auth_url`/`get_linear_auth_url`/`get_sharepoint_auth_url`,
  ~15 lines).
- Connection lifecycle: `cloud_connections` table + `unified_connection_id`
  FK + soft-delete via `deleted_at IS NULL` — already used by Drive.
  (`meeting_connections` is a Fathom-only table; Slack would likely use
  `cloud_connections` directly if data-shape is uniform, or a parallel
  `messaging_connections` if not — that's a C/data-model angle call.)
- Edge → Python webhook transport (HMAC, internal-RPC, request-id, size cap,
  timing-safe compare) is fully provider-agnostic at
  `nextjs-app/app/api/webhooks/unified/route.ts`.
- `internal_webhooks._DISPATCH` is the documented one-arm-per-provider seam.
- `AuthRevokedException` + 401/`invalid_grant`/`token_expired` detection
  (`unified_client.py:104`) generalizes to Slack token revocation.
- 429 retry + exponential backoff pattern — reusable.
- Pagination dedup + offset/cursor switching pattern — directly applicable
  to `list_messaging_messages`.

**NOT abstracted (we would build):**

- A `messaging_sync_service.py` companion to
  `drive_sync_service`/`fathom_sync_service`/`email_sync_service`. Closest
  analog by data-shape is email (threaded, member-attributed, attachment-
  bearing) — `email_thread_service.py` is probably the lift-and-shift seed.
- A new dispatch arm: `reconcile_slack_webhook(payload, connection_id, project_id)`
  that consumes Unified's normalized webhook event and writes into our
  data-item table (whatever C decides it is).
- A messaging-flavored `register_webhooks` — current
  `unified_client.register_webhooks` (`unified_client.py:1377`) is hard-coded
  to `shared.ObjectType.STORAGE_FILE` and the three CRUD events; Slack needs
  `MESSAGING_CHANNEL` + `MESSAGING_MESSAGE` and likely also `MESSAGE_REACTION`
  if we care about reactions as signal.
- The OAuth callback equivalent (`/api/slack/callback`). The Fathom callback
  (`api/fathom/callback/route.ts`) is the template — UUID validation + CSRF
  cookie + RLS check + two-step upsert. ~150 lines, pure copy-and-substitute
  modulo the table name.

### Existing infra that's notably absent for Slack

- **No `slack` substring anywhere in `nextjs-app/{app,lib}` or
  `python-services/agent_api`** beyond word-boundary false positives. This is
  net-new ground.
- **No spec under `docs/specs/` references Slack.** The only adjacent piece is
  `docs/specs/teams-integration-spike.md` (Microsoft Teams scoping) —
  potentially a near-twin since both ride Unified.to's messaging category;
  worth re-reading before we spec Slack.
- **No experiments/spike in `experiments/` for Slack.** There's
  `experiments/unified-integration/` but its `lib/` only contains
  `connection.py`, `fathom.py`, `linear.py` — no `slack.py`.
- **No `UNIFIED_API_KEY` scope concern documented for messaging.** The
  Unified.to JWT is workspace-scoped, not integration-scoped — adding Slack
  doesn't require a new env var; only a new connector-type entry per
  connection in `cloud_connections`.

---

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1 — Connection table: reuse `cloud_connections` or fork
`messaging_connections`?**
- Lean: reuse `cloud_connections`, add `provider="slack"`. The dispatch contract
  in `internal_webhooks.py:65` already keys on `provider`, and Drive lives there.
- Why: avoids cardinality drift; one place to query "what is connected to this
  project."
- Price: messages are not files; a `gfs_sync_items`-style item table won't fit
  cleanly (no `external_id` + bytes; instead author + thread + content). We'd
  need either a `data_items_messaging` partition or a sibling table linked by
  `connection_id`. **C-angle territory** but the C decision constrains this one.

**D2 — Real-time channels but polled messages: do we accept the ~60s message
latency?**
- For "channel messages sync into project as data items, indexed for Effi"
  (RESUME.md surface 1), 60s is fine — Effi answers questions about discussions,
  not live moderation.
- For UseGin-Slack mediated R/W (RESUME.md surface 2), 60s read-latency means
  Gin sees @-mentions a minute late. Probably tolerable; flag for D-angle.
- Escape: pair Unified.to ingestion with direct Slack Events API for the
  realtime hot path. Doubles the integration cost and is explicitly the
  comparative-paths/F-angle question.

**D3 — Workspace cardinality.** A Unified.to Slack connection = one Slack
workspace's OAuth = bot token in that workspace. If a customer's company runs
multiple Slack workspaces (common for acquisitions), we need N connections
per project — and our current `meeting_connections` schema enforces "one
active connection per provider per project" (Fathom callback's two-step
upsert assumes this). Same shape as the Fathom-per-recorder gotcha
(`reference_fathom_per_recorder_scoping`). H-angle territory but called out
because it sneaks in via the schema, not via the auth flow.

**D4 — Token revocation visibility on Slack.** Today
`_is_auth_revocation_error` matches `401` + `invalid_grant`/`token_expired`/
`revoked` substrings — patterns observed against Google + Fathom. Slack's
revocation language ("token_revoked", "account_inactive",
"invalid_auth") needs verification against actual Unified.to error
shape. Low-cost fix (extend the indicator list) but the test would be a
real revoked Slack token, which means a live spike.

### Gaps I couldn't read

- **Whether Slack-via-Unified covers DMs and group DMs** or only public/private
  channels. The MessagingChannel `is_private` field hints at coverage but
  the docs page didn't enumerate. Real implication if the customer surface
  is "channel ↔ project" — DMs probably aren't in scope, but worth confirming
  before designing the binding UI.
- **Reaction webhook firing semantics.** The `MESSAGING_MESSAGE` ObjectType
  is virtual/polling on Slack per Unified docs; whether reactions delta-fire
  separately or only when a message itself updates is unstated. Affects
  whether reactions are usable signal for Effi (e.g. "what was the team
  excited about last week?").
- **Bot-token vs user-token semantics on Unified.to's Slack OAuth.** Slack's
  own platform distinguishes; Unified.to abstracts but there's likely a
  scope-level toggle or default that determines whether the bot can post as
  itself or only on behalf of a user. Critical for D-angle (Gin posts on
  Lihu's behalf? as a bot?). Not derivable from SDK alone.
- **Unified.to retention / message-history cap.** The `updated_gte` cursor
  pattern works for pagination, but does Unified.to retain messages it has
  already seen, or is each list call a live-fetch from Slack? Affects
  backfill strategy for new connections on long-history channels — same
  pattern that bit us in Fathom (50-item cap → cursor switch).
- **`UNIFIED_ENV` value for Slack.** Production today uses `"Production"`.
  Whether Slack-via-Unified differs by env (sandbox vs prod creds) is
  unverified. Docs say OAuth2; assumption is the same env applies.

### Friction zettels captured

None. The exploration was clean — the Unified.to abstraction did exactly what
the codebase comments promised; the SDK introspection confirmed messaging
support without surprise; the dispatch seam in `internal_webhooks.py` is one
of the cleaner extension points in this codebase. Nothing surprising enough
to zettel.

### What I'd want to know that I can't read from code alone

- A 1-day spike: stand up a Unified.to Slack connection against the team's
  own Slack, register webhooks, observe the actual payload shape Unified
  sends for `MESSAGING_MESSAGE` events vs Slack's native shape. The SDK's
  type hints describe the steady-state read API; the webhook delta payload
  is what we'd actually consume in `reconcile_slack_webhook`, and that's
  not in the SDK.
- Whether Lihu wants Slack-mediated *writes* (Gin posts, replies, threads)
  on Unified.to's path or as a direct Slack Bolt SDK call. The
  `messaging_message_write` scope exists in Unified, and `create_messaging_message`
  works, but writing through a normalized layer means losing native Slack
  features (Block Kit, ephemeral messages, modal submits). D-angle has the
  semantic answer; this angle just notes the technical fork.
