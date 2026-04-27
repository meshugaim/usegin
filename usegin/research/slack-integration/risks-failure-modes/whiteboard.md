# Risks & Failure Modes — Slack Integration (angle G)

Scope: failure-mode catalog specific to **our codebase + ops envelope** (Unified.to-mediated connectors, per-project `*_connections` tables, RLS-gated `gfs_sync_items`, Sentry-only error surface, Railway+Supabase ops). Not a generic best-practices list.

## Top — the click

Three risks the design MUST account for from day one. Each is **cheap-now / expensive-retrofit**.

### 1. `conversations.history` is **1 req/min, 15 msgs/page** for non-Marketplace apps (since May 2025)

Source: docs.slack.dev/apis/web-api/rate-limits + changelog. Internal/Marketplace apps are exempt; everyone else, including the customer-facing AskEffi app *until* it ships through the Slack Marketplace, sits at this floor.

**The math**: a moderately busy channel with 30 days × 200 msgs/day = 6,000 msgs ⇒ 400 pages ⇒ **~6.7 hours of wall-clock backfill, single channel**. A workspace with 50 such channels = ~14 days of continuous polling. A million-message bulk-ingest is physically impossible without Marketplace listing or shifting to Events API push.

**Severity**: catastrophic for the customer-facing surface (C). Time-to-first-useful-state for a new customer goes from minutes to days.
**Likelihood**: certain — not a corner case, it is the steady state.
**Mitigation cost (designed-in)**: cheap. Architect ingestion as **events-first, history-as-cold-backfill**:
  - Events API push (`message.channels`) for the live tail, no polling, fits inside the 30k-deliveries/workspace/hour envelope.
  - `conversations.history` only as a one-shot backfill primer with a budgeted ceiling and a "still-warming-up" UX state surfaced to the user.
  - Marketplace listing is on the critical path for any customer with >1 channel of meaningful volume. Treat as a hard dependency, not a "later".
**Mitigation cost (retrofit)**: expensive. Once the data model assumes "we have everything", switching to a partial-history posture means new UX, new freshness signals, new tests, and undoing optimistic indexing. Same shape as the Fathom per-recorder mistake we just paid for.

### 2. Slack-workspace ↔ AskEffi-project cardinality is N:M, but our `*_connections` shape is 1:1

Pattern from `linear_connections` and `drive_connections`: one `unified_connection_id` per `project_id`, partial-unique index, soft-delete via `disconnected_at`. Channel-binding (surface C) wants 1 Slack channel ↔ 1 AskEffi project, which sounds 1:1 — but:
  - One Slack workspace contains hundreds of channels. If each channel is one project, we install the Slack OAuth **once per workspace** but consume connection rows **per channel-project**. Today's schema would store the same `unified_connection_id` N times, RLS-checked per project. That's fine for reads but creates an **install-fan-out problem on revoke**: admin disconnects in Slack → 1 Unified.to event → we must cascade to N project rows. Today's `disconnect_sync_transitions` (drive) handles 1.
  - One AskEffi workspace may have multiple Slack workspaces (the Fathom-per-recorder analog). The `linear_connections` partial-unique index is on `project_id` alone — fine. But a future "team-wide Slack search" surface is per-AskEffi-workspace and would need a NEW table; bolting it onto `slack_connections` risks `(workspace_id, project_id)` ambiguity.

**Severity**: serious — silent coverage gaps look like bugs to customers, see decision 0015.
**Likelihood**: likely. Multi-Slack-workspace customers exist (acquired companies, agency↔client).
**Mitigation cost (designed-in)**: cheap. Two tables from day one — `slack_workspace_connections` (one per AskEffi-workspace × Slack-team_id, holds the OAuth token / unified_connection_id) and `slack_channel_bindings` (one per channel ↔ project). Keep the install state separate from the binding state.
**Mitigation cost (retrofit)**: expensive. Splitting a one-table schema means data migration on production rows, RLS policy rewrite, and disconnect-cascade rewrite — all on a tenant-isolated path that doesn't tolerate eventual consistency.

### 3. RLS-leakage risk on private/DM channels: a single OAuth scope decides whose-eyes-see-what for the *whole workspace*

The bot token's scope set determines what messages we ingest. `channels:history` = public channels. `groups:history` = private channels the bot is invited to. `im:history` / `mpim:history` = DMs. Inside AskEffi, RLS gates `data_items` by `project_id`. **But the per-channel binding is the only thing keeping HR-only / exec-only channel content out of a salesperson's `#sales` AskEffi project query** — there is no Slack-side ACL we can re-check at query time, only the bot's "yes I'm in this channel" boolean.

Two failure modes:
  - **Over-scoping at install**: customer accepts `groups:history` because the install screen says "needed for private channels you invite the bot to" — but the bot, once invited to `#exec`, ingests it. If a project owner without exec access creates the binding (or the binding is mis-routed by name), the indexer sees content a human shouldn't.
  - **Channel rename/move/archive**: a channel renamed `#hr-only` → `#general-temp` keeps its `id`. Our binding follows the `id`. Now the project owner who bound it last month suddenly has access to a different content stream than they thought they had. Slack notifies via `channel_rename` event — we have to act on it.

**Severity**: catastrophic — this is a customer-trust-breaking RLS leak in the same bug class as ENG-4xxx workspace-tier bleed. SOC2/DPA territory.
**Likelihood**: plausible — not the default path, but achievable via a curious admin and a renamed channel.
**Mitigation cost (designed-in)**: cheap. (a) Default to `channels:history` only; require an explicit "include private channels" toggle that disables auto-bind-by-name. (b) Bind by `(channel_id, channel_name_at_bind_time)` and **break the binding on `channel_rename`**, surfacing a re-confirm UX. (c) Refuse `im:history` / `mpim:history` scopes for surface C — DMs are never project-scoped data.
**Mitigation cost (retrofit)**: expensive — leaked content is in our index, in vector stores, in chat history, possibly in support-team views. Indexing cleanup is hard; trust cleanup is harder.

---

## Middle — the body

### Severity / Likelihood / Mitigation legend
- **Severity**: catastrophic | serious | annoying
- **Likelihood**: likely | plausible | corner-case
- **Mitigation cost**: cheap-if-designed-in | medium | expensive-retrofit

### A. Platform-intrinsic

| # | Failure mode | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| A1 | `conversations.history` 1 req/min × 15 msgs/page (non-Marketplace) makes bulk backfill multi-day | catastrophic | likely | cheap — events-first design, see Top #1 |
| A2 | Tier 2 methods (~20/min) for `conversations.list`, `users.list` — fine in steady state, **catastrophic during a re-list storm** (e.g. workspace-wide reconnect after token rotation) | serious | plausible | medium — tag every Slack call with a tier-aware token-bucket limiter (we don't have one today; httpx clients are bare) |
| A3 | Events API: 30k deliveries/workspace/hour cap; over-cap → `app_rate_limited` event, **no per-event retry**. Busy enterprise workspace can blow this on a flurry of bot-mention spikes | serious | corner-case at MVP, plausible at scale | medium — buffer + aggregate, never fan-out 1:1 to Python; use a queue (Supabase or Railway worker) like `gfs_sync_items` already does |
| A4 | Free-plan workspace **90-day message retention**: backfill stops at ±90d, period | annoying | likely (free-plan customers exist) | cheap — surface explicit "Slack free plan limits backfill to 90 days" UX; do not retry pre-90d |
| A5 | Files: `files.upload` retired Nov 12 2025 → `files.getUploadURLExternal` + `files.completeUploadExternal` two-step; old code patterns break | annoying | corner-case (we'd be writing fresh) | cheap if we never write the old shape |
| A6 | Signing-secret rotation: customer rotates in Slack admin → our endpoint must accept BOTH old + new for the rotation window. Today's webhook (`/api/webhooks/unified`) is single-secret — a Slack-direct equivalent has the same trap | serious | plausible | cheap-designed — store `signing_secret_current` + `signing_secret_previous` with `previous_expires_at`, accept either |
| A7 | Scope deprecation: Slack has done painful migrations (`search:read` → granular `search:read.public/private/im/mpim` Feb 2026; `assistant:write` → `chat:write` Mar 2026). Re-consent flows are user-disruptive | serious | plausible (1-2/year empirically) | medium — runtime scope-introspection (`auth.test`, `apps.permissions.info`) + UX for "re-authorize needed" rather than silent breakage |
| A8 | Workspace-token revocation: admin disconnects → Slack stops accepting our token, future calls 4xx. Today's drive `disconnect_sync_transitions` handles connection-side disconnect; we'd need symmetric handling for **discovered-mid-call revocation** (token fine yesterday, gone today, no event received) | serious | plausible | cheap — already a pattern: classify 4xx-with-`token_revoked` as a soft-disconnect, transition `slack_workspace_connections.status='disconnected'`, fan out to bindings |
| A9 | Slack Connect / shared channels: messages in a shared channel cross org boundaries; **the bot in workspace A can read content authored by a user in workspace B**. RLS implications when AskEffi customer is workspace A and a B-side speaker did not consent | catastrophic | corner-case (shared-channels usage) | medium — detect `is_shared` / `is_ext_shared` on channel metadata; either refuse to bind or surface explicit consent UX. Audit: "is the indexed message authored by an external participant?" |
| A10 | Bot vs user token scope drift: a method works with user token, fails with bot token (or vice-versa). E.g. `search.messages` is user-token only. Easy to write code assuming bot token everywhere | annoying | plausible | cheap-designed — typed token kinds (`BotToken` / `UserToken`) at the call-site; today's `unified_client.py` doesn't model this distinction |
| A11 | App-review process for Slack-Marketplace listing: weeks-to-months, can require security questionnaire equivalent to SOC2 — **and is a hard prerequisite to escape Top #1**. Surprise-review-failures shipped to date have included missing privacy policy, missing data-deletion endpoint, missing in-app uninstall | serious | likely | medium — start the listing process **before** GA; allocate calendar time, not just engineering time |
| A12 | Edited / deleted messages arrive as `message_changed` / `message_deleted` events. Skipping them = stale + cleartext-of-deleted-content lingers in vector store. GDPR/DPA implication | serious | likely (every customer eventually) | cheap-designed — handle alongside primary `message` events; tombstone in `data_items`, re-extract |

### B. Integration-shape (how OUR codebase patterns bite)

| # | Failure mode | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| B1 | **Per-recorder analog → per-installer**: a Slack OAuth = ONE workspace's bot, not coverage of multiple Slack workspaces. Same gotcha as Fathom per-recorder (decision 0015). Customer with 3 Slack workspaces (post-acq, contractor side, etc.) needs 3 installs | serious | likely | cheap-designed — model `slack_workspace_connections` as N-per-AskEffi-workspace from day one |
| B2 | Multi-Slack-workspace install: same `team_id` install can be re-OAuthed by a different admin with broader scopes → token replacement that silently changes ingestion behavior | serious | plausible | cheap — on `(team_id, app_id)` collision, treat as token *update* + log a security event; flag scope deltas |
| B3 | RLS leakage on cross-tier (free / pro / enterprise) bleed: same bug class as workspace-tier prior incidents — RLS policy on `slack_channel_bindings` must use `is_project_owner(project_id, auth.uid())` exactly like `linear_connections`, NOT a homemade variant | catastrophic | plausible (every new connectors table is a fresh chance to mis-write the policy) | cheap-designed — copy the linear_connections RLS pattern verbatim; add a SQL test under `supabase/tests/` |
| B4 | Token storage hygiene: today **we don't store Slack OAuth tokens** when going through Unified.to (Unified holds them). For Slack-direct path, we'd be storing `xoxb-*` bot tokens in our DB. Plaintext is the easy mistake — Linear/Drive avoid it by never holding the secret | catastrophic if leaked | plausible (default path is "TEXT NOT NULL") | medium — pgsodium / KMS envelope encryption from day one; Unified.to path sidesteps this entirely (one of Unified's real values) |
| B5 | Sync-loop / duplicate-message handling: Events API redelivers on >3s response or 5xx. `gfs_sync_items` has idempotency via `(source, external_id)` — but the natural Slack key is `(channel_id, ts)` and a thread reply adds `(channel_id, thread_ts, ts)`. Wrong key → duplicates in vector store | serious | likely | cheap-designed — use `(team_id, channel_id, ts)` as idempotency key, mirror existing `gfs_sync_items` shape |
| B6 | Outbox / idempotency for write-back (Gin posting to Slack on behalf of users — surfaces D & E): retrying a `chat.postMessage` without `client_msg_id` discipline = double-posts. We don't have an outbox pattern in `agent_api/`; Drive sync uses single-shot upserts | serious | likely once write-back ships | medium — outbox table OR client-supplied dedup key; build it with the surface, not after |
| B7 | Webhook signature rotation gap on our side: today `/api/webhooks/unified` is single-secret, fail-closed if unset. A Slack-direct version inherits this shape and would 401 every customer for the rotation window | serious | corner-case at MVP | cheap — see A6 |
| B8 | `unified_connection_id` carries the Slack `team_id` indirectly. If we pivot from Unified.to → direct (or vice-versa), the FK shape is wrong both directions | annoying | plausible (path divergence is angle F's whole question) | medium — model `provider_connection_id` + `provider` columns, not `unified_connection_id`; lets us swap without schema migration |
| B9 | Mailgun-like inbound shape: Slack delivers webhooks with retry on non-2xx within 3s. Our Unified webhook timeout is 5s (`FORWARD_TIMEOUT_MS`). Slack's 3s is **stricter**; the same architecture would need ack-then-process | serious | likely | cheap — ack 200 immediately, enqueue via `gfs_sync_items` for async processing (we already have this pattern for Drive) |

### C. Ops — observability, debuggability, rollback

| # | Failure mode | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| C1 | When the integration breaks for ONE customer, how fast can we tell? Today the answer is "Sentry tag filter on `connection_id`" — works only if every Slack call sets the tag. Easy to forget on a new connector | serious | likely | cheap — connector base class that wraps every API call in a Sentry scope with `team_id, channel_id, integration='slack'`; existing connectors are inconsistent here |
| C2 | "Sync went haywire and indexed a million messages" rollback: today's `gfs_sync_items` has `excluded` status and a sweep RPC (`sweep_blocked_meeting_sync_items`). Vector store cleanup is the hard part — we don't have a "delete-by-source-prefix" primitive across `vais` | catastrophic | plausible (large enterprise channel + bug = 7-figure msg count) | medium — design a batch-delete primitive in `vais/store_lifecycle.py` keyed by `(team_id, channel_id)` BEFORE we ship ingestion |
| C3 | Free-plan retention silently shrinks the index: a message indexed 89 days ago is inaccessible to fresh fetch tomorrow. If we re-fetch to verify, we delete content the customer's Slack no longer has — even though our index is the more-recent truth. Same content-vs-source-of-truth bug as drive deletes | annoying | plausible | medium — never re-verify by upstream presence on free workspaces; treat retention as our advantage, not a bug |
| C4 | Cross-service log correlation: `request_id` flows Next→Python via `x-request-id` (good). For Slack events that arrive event-driven and trigger background work, the `request_id` chain breaks at the queue boundary. Today's drive sync has the same gap | annoying | likely | cheap-designed — propagate `request_id` into `gfs_sync_items.metadata` and re-attach on dequeue |
| C5 | Slack-side incident (Slack itself down) creates a Sentry storm of `upstream_unavailable` 502s, drowning real signal. We've seen this shape before | annoying | corner-case | cheap — Sentry rule: group `slack:5xx` outage events; circuit-break after N consecutive 5xx on the same `team_id`, per `feedback_one_off_errors_no_speculation` we don't auto-extrapolate from a single spike |
| C6 | Auto-disconnect blast radius: if a customer's Slack admin revokes, our `disconnect_sync_transitions` fires for every channel binding ⇒ a single revoke could touch hundreds of `gfs_sync_items` rows. Drive's equivalent is well-tested (`drive_disconnect_sync_transitions`) but Slack's binding fan-out is bigger | serious | plausible | cheap — reuse the drive transition pattern, batch the cascade |
| C7 | Migration replay on dev: cloud devcontainer rebuilds frequently (per CLAUDE.md). Slack OAuth tokens / Unified connection IDs are environment-specific; staging != dev != prod. Easy to commit a fixture token | catastrophic if a real token lands in `seed.sql` | corner-case | cheap — use `xoxb-test-*` placeholder + git pre-commit secret-scan |

---

## Bottom — the open ends (z026-shape dilemmas for spec-writing)

### D1. Marketplace listing: critical-path or "later"?

**Decision needed**: do we commit to a Slack Marketplace listing on day 1, or ship a non-Marketplace customer-facing app and accept the 1-req/min `conversations.history` floor?
**Options**:
  - **(a) Marketplace from day 1** — listing process gates GA; weeks-to-months calendar lag; security questionnaire-shaped review.
  - **(b) Non-Marketplace MVP** — ships fast, but Top #1 says backfill is unusable for any non-trivial channel; product UX must be event-first or it's a lemon.
  - **(c) Internal-app per customer** — each customer creates the app in their own workspace, gives us tokens. Bypasses rate limits. Ops nightmare at scale.
**Lean**: (b) for MVP **with an explicit "events-only, no historical search yet" UX**, (a) on the critical path for GA. Do NOT promise historical search without (a).
**Price of getting it wrong**: building UI around bulk-history-available and discovering at scale that it can't be filled.
**For Lihu to weigh**: timing of Marketplace process vs. first customer commitment.

### D2. Unified.to's "do we even hold tokens" tradeoff vs. Slack-direct

**Decision needed**: Unified.to mediation (today's pattern, no `xoxb-*` in our DB) vs. Slack-direct (we hold encrypted bot tokens).
**Options**:
  - **(a) Unified.to** — token storage problem disappears (B4 sidesteps); rate limits, scope migrations, and signing rotation are partly absorbed by Unified. But Unified's own outage / bug is a single-vendor risk; and Slack's per-app rate limit applies to *Unified's app*, shared across all Unified customers.
  - **(b) Slack-direct** — we own the auth surface, can qualify for Marketplace, can scope-tune. Token storage / rotation / encryption is now ours.
**Lean**: angle F decides this; from risk-G perspective (a) is dramatically lower-risk for MVP, (b) is dramatically lower-ceiling for product depth (e.g. assistant features, search APIs Unified may not expose). Posture: **start (a), explicit fork-to-(b) for surfaces D/E that Unified can't carry**.
**Price**: choosing (a) and discovering we need (b) for surface D's Gin-as-bot pattern → mid-build pivot of the auth/data layer.
**For Lihu to weigh**: how committed are we to surface D's Gin-mediated team R/W? That's the surface that most exposes (a)'s ceiling.

### D3. Channel-rename / channel-archive lifecycle — strict or lenient?

**Decision needed**: when a bound channel is renamed, archived, or deleted, do we (a) **break the binding** and require user re-confirm, (b) **follow by id silently**, or (c) **warn but continue**?
**Options**:
  - **(a) Strict break** — safe but high-friction; every rename = new project setup step.
  - **(b) Silent follow** — convenient but creates the leak in Top #3.
  - **(c) Warn-and-continue** — a middle, but warnings are easy to dismiss.
**Lean**: (a) for **rename of channels containing the substring `private|hr|exec|internal|legal|finance|salary`** (heuristic), (c) otherwise. Or simpler: (a) always — user friction is the right choice over silent leak.
**Price**: getting this wrong = the customer-trust failure of Top #3.
**For Lihu**: do we surface this as a security guarantee in the marketing copy ("AskEffi never silently follows renamed channels")?

### D4. DM / private-channel ingestion — supported or refused?

**Decision needed**: does the customer-facing surface (C) accept `groups:history` / `im:history` scopes at all?
**Options**:
  - **(a) Refuse** — public channels only. Customers will ask for private. We say no.
  - **(b) Accept private channels (groups), refuse DMs (im/mpim)** — middle ground; bot-must-be-invited model is the gate.
  - **(c) Accept all** — maximal capability, maximal blast radius if misbound.
**Lean**: (b) for surface C with explicit per-channel binding (no auto-bind on private channels). (a) for any auto-discovered binding pattern. (c) only for surface D (Gin internal) where the AskEffi-tenant IS the team.
**Price**: customers want (b) or (c); (a) costs deals; (c) costs trust.
**For Lihu**: this is a sales-vs-trust posture call. Worth a doc.

### D5. Backfill ceiling — when does "we tried" become "we stop"?

**Decision needed**: given Top #1's math, what's the per-customer backfill budget?
**Options**:
  - **(a) Budget by msg count** — "first 10k messages per channel, then stop and surface a 'expand backfill' button".
  - **(b) Budget by time** — "last 90 days only, ever; deeper history requires Marketplace + admin export".
  - **(c) Best-effort** — keep polling forever, surface progress.
**Lean**: (b) — aligns with free-tier retention floor (A4); honest with the user; bounds our cost; matches z084's "honor the original date, source the backfill" ethos by NOT pretending we have history we don't.
**Price**: customers expect search-everything; we deliver search-recent. Good UX for the gap is the work.
**For Lihu**: product-shape decision; ties into Marketplace timing (D1).

### D6. Per-customer vs. shared Sentry / observability surface

**Decision needed**: when integrations break for one customer, do we want per-customer dashboards or a single ops surface that filters by `team_id`?
**Lean**: today's pattern is the latter (Sentry + tag filters). For Slack specifically, a `(team_id, channel_id)` health panel in our admin UI would short-circuit support tickets. Cheap to build alongside the connector; expensive to retrofit.
**For Lihu**: low-stakes dilemma but worth deciding before the connector exists rather than after the first incident.

---

## Cross-references

- Decision 0015 (Fathom per-recorder) → B1, the same-shaped mistake we already paid for.
- z084 (backfill once primitive automated) → D5 — the *opposite* trap: don't promise backfill that the platform can't physically deliver.
- `feedback_one_off_errors_no_speculation` → C5: a single 5xx storm is not a circuit-break trigger; characterize before reacting.
- `feedback_dont_jump_to_conclusions` → applies to interpreting count gaps post-launch (Slack analog of Fathom 233-vs-125): cross-cut multiple queries before declaring a sync bug.
- `reference_autosync_concurrent_collisions` → outbox/idempotency thinking in B5/B6.
- ENG-5197 email-splitter (regex-only, no LLM) → applies to Slack message-segment parsing if we ever try to "extract entities from messages": **don't reach for an LLM**; Slack's API gives us threads, mentions, and reactions structurally.
