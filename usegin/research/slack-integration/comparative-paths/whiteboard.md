# Whiteboard — F: comparative-paths (Unified.to vs direct Slack)

## Top — the click

**Unified.to is a viable v0 ONLY for surface C (customer-channel ↔ project as read-only message ingestion).** It is **not viable** for surfaces D (UseGin-Slack — Gin reads/writes as the team's task surface) or any feature that needs reactions, files, Slack Connect, slash commands, interactive Block-Kit, or sub-second event latency. The connector is documented as `Channel (list, get) | Message (CRUD) | Employee (list, get) | Passthrough` — that's it. No first-class reactions, no files, no native event-stream guarantee for new messages with the fidelity Slack's Events API gives you (Unified.to webhooks are polling-derived in the messaging category, not event-mirrored — Unified docs do not list a `message.created` real-time event guarantee).

**Build-twice verdict: ESCAPE, not hedge.**
- Unified.to for v0 of surface C only — buys us ~2 weeks of OAuth + token + webhook plumbing we don't write — and even then we'll outgrow it the moment a customer asks "why don't reactions sync?" or "why isn't my Slack-Connect channel listed?"
- Direct Slack (Bolt-TS in nextjs-app, mirroring our SharePoint-shaped OAuth callback at `nextjs-app/app/api/sharepoint/callback/route.ts`) is the only viable path for D. We will write it anyway. Once it exists, surface C migrates onto it and Unified.to-for-Slack gets retired before we hit Unified's ceiling.
- The one caveat that could flip this to KNOWLEDGE-only: if Unified's `Passthrough` is genuinely a transparent proxy to Slack's Web API (auth + rate-limit + delivery handled by them, scope set by us), we get most of direct-Slack's surface area while keeping their OAuth + token store. Worth a 30-minute spike before committing — see Bottom.
- Hedge is wrong shape: Unified.to billing is per-API-call ($1/1k after the included envelope), so keeping both in prod for the same customers means paying twice for the same traffic. Hedge only makes sense for vendor-failure insurance, not for ergonomics.
- A/B is wrong shape: the team's surface (D) and the customer's surface (C) have different requirements, not different ergonomics for the same surface. The split below isn't an A/B; it's two different products that happen to talk to Slack.

## Middle — the body

### Comparison matrix

| Dimension | Unified.to | Direct Slack | Tradeoff |
|---|---|---|---|
| **Time-to-MVP (read-only ingestion)** | ~3-5 days. OAuth flow + webhook handler already exists in our codebase (`nextjs-app/app/api/webhooks/unified/route.ts`, `nextjs-app/app/api/fathom/callback/route.ts`). Adding a connector_id is a config + a callback route clone. | ~10-15 days. New OAuth callback (mirror SharePoint shape at `nextjs-app/app/api/sharepoint/callback/route.ts`), new Events API endpoint with signing-secret verification, new token store, backfill via `conversations.history`. | Unified buys ~1 dev-week if and only if the connector covers what we need. |
| **Time-to-MVP (read-write, threads, Block-Kit)** | Not supported / unclear. `Message.create` exists but Block-Kit, ephemeral, interactive, slash commands, modals are **not in the unified messaging model**. | Same ~10-15 days for OAuth + Events + first command; Block-Kit + interactivity adds another ~5-7 days. | Direct is the only path for D. Unified does not cover the surface. |
| **OAuth/install flow code we own** | Minimal. Unified hosts the consent UI per provider; we redirect to a Unified URL with `connection_id`-bearing return (Fathom precedent). Our callback writes one row to `meeting_connections`-shape table and we're done. ~120 lines (see fathom callback). | Full ownership. We host `/oauth/install` → `https://slack.com/oauth/v2/authorize?client_id=…&scope=…` → callback that calls `oauth.v2.access`, gets `xoxb-…` bot token + `team.id`, encrypts and stores. ~250-400 lines incl. CSRF state + per-workspace upsert + reinstall handling. | Direct is more code but is a known-shape we've written 4 times (drive, sharepoint, linear, fathom-meta). Not net-new architecture. |
| **Token storage we own** | None for the OAuth tokens themselves — Unified holds them. We store `unified_connection_id` (UUID). | Full. `xoxb-` bot token per workspace, `xoxp-` user token if any user-scope, refresh tokens if rotation enabled. Encrypted at rest. Plus `team_id`, `bot_user_id`, install metadata. | Unified shifts a meaningful blast-radius surface to a subprocessor. Both pro (one less secret to leak) and con (their breach = our token compromise). |
| **Webhook plumbing we own** | Already built. `app/api/webhooks/unified/route.ts` — HMAC verify on `JSON.stringify(data) + nonce`, internal-RPC sign, forward to Python. Adding Slack means: subscribe in Unified.to console + handle the new event types in Python. | Full. Two endpoints: `/api/slack/events` (URL-verify challenge, 3-second ack, signing-secret verify on `v0:{ts}:{body}`), `/api/slack/interactivity` for Block-Kit. Plus retry-aware idempotency keying (Slack retries on `x-slack-retry-num`). | Direct webhooks are well-documented but require strict 3-second 2xx — must ack first, process async. Our existing Unified handler doesn't have that constraint. |
| **Rate-limit handling we own** | Unified absorbs it (their problem to spread calls under Slack's limits). We just pay per call ($1/1k). | Tier 2-3 mostly: `conversations.list` Tier 2 (~20/min/workspace/method), `conversations.history`/`.replies` got new non-Marketplace caps from May-2025. Backfill-heavy workloads hit walls. We need 429-aware retry-after logic. | Direct: real, painful at scale. Unified: invisible until you blow your call budget and pay overage at $1/1k. For a busy customer Slack with 50k messages/month, naive backfill = $50/customer just in Unified API calls. |
| **Slack-feature coverage** | **Channel (list, get) only — no create, no archive listening.** Message CRUD. Members via HRIS. **No reactions, no files, no Slack Connect (shared external channels) listed, no slash commands, no Block-Kit, no modals, no app-home, no socket-mode.** | All of it. Everything Slack ships, including Slack Connect, file uploads via `files.upload`, reactions (`reactions.add`/`reactions.removed` events), slash commands, Block-Kit, modals, app-home tabs, scheduled messages, canvases. | This is the killer. Surface D *requires* slash commands or app-home or modals — Gin needs an interactive entry point. Unified can't provide it. Surface C eventually wants reactions ("which messages did the team thumbs-up?" = signal). |
| **Per-Slack-API-version drift exposure** | Unified absorbs it. They've eaten the May-2025 `conversations.history` non-Marketplace clampdown for us. | Ours. We live on Slack's deprecation cadence (recent: token rotation rollout, granular bot/user scope split, marketplace-only history limits). | Unified is genuinely insulating here. Not free — they ship breaking changes too — but one-vendor instead of two. |
| **Lock-in cost (cost to migrate off)** | Medium-high. `unified_connection_id` foreign keys leak across `meeting_connections`, ingestion code reads Unified's normalized shape (not Slack's native). Migration = re-OAuth every customer (Slack tokens are per-app; you can't transfer them out of Unified to us) + rewrite ingestion shape + dual-write window. Estimate ~3-4 weeks for the C surface alone. | Zero — we own the install. | This is what makes Unified an ESCAPE, not a HEDGE. The exit cost grows monotonically with #connections. |
| **Cost per workspace per month** | Variable on traffic. At their `Grow` tier $750/mo for 750k calls — for a customer with 1 active channel + 50k msg/mo backfilled once + ongoing event polling, ballpark 5-15k API calls/customer/mo. So Slack alone fits maybe 50-150 customers in the Grow envelope, then $1/1k overage. | Free from Slack. We only pay our own infra. | At small N (<10 customers) Unified looks cheap; at N=50+ direct is cheaper. The crossover depends on per-customer message volume. |
| **Build-twice complexity (do they share code?)** | Almost nothing shareable. The OAuth callback shape is different (we redirect to Unified vs to Slack), the webhook signature scheme is different (Unified HMAC over `JSON.stringify(data)+nonce` vs Slack's `v0:{ts}:{body}`), the message normalization is different (Unified flat vs Slack threaded with `thread_ts`/`parent_user_id`). Even the token storage shape diverges. | — | "Build twice" is genuinely two builds. The only shared layer is downstream — once messages land as `data_items`, indexing/RLS doesn't care which path delivered them. |
| **Slack distribution review (customer-facing)** | Unified hosts ONE Slack app (theirs); customers install Unified's app, not ours. **No review for us.** But: the consent screen says "Unified.to" — a brand-trust hit some customers will care about. | We must publish our own Slack app. **Submission to Slack Marketplace required for public listing**, ~2-6 week review (per community reports — Slack docs vague). Unlisted/dev distribution works without review, capped at ~10 workspaces typically. | Surface C at scale = we'll need our own listing eventually anyway. Unified defers the review, doesn't eliminate it. |
| **Multi-workspace install model** | Unified handles multiple `connection_id`s per customer transparently. | One Slack OAuth = one bot in one workspace (per `reference_fathom_per_recorder_scoping` analog: same gotcha class). For a customer with multiple Slack workspaces, we need N installs and our DB needs `(askeffi_workspace_id, slack_team_id)` cardinality. | Same shape on both — Unified just hides it behind their UUID. The DB question (`workspace_id` ↔ `slack_team_id`) is angle H's. |
| **Debug-ability when something breaks** | Two failure boundaries: Slack→Unified, Unified→us. When a customer says "messages aren't syncing" we have to ask Unified support and wait. Their logs aren't ours. | One boundary: Slack→us. We see request/response, signing failures, retries in our own Sentry. | Direct wins decisively here. Operational pain at 3 AM is non-trivial. |
| **Subprocessor / DPA / compliance impact** | **Adds Unified.to as a subprocessor.** Customer DPAs need updating. SOC2-conscious customers (we have some) may push back. | No new subprocessor. | Per `reference_security_reports`: subprocessor list is a real customer-facing artifact, not a fig leaf. Adding one for a single integration is friction. |

### Citations

- Unified.to Slack connector capability: `unified.to/integrations/slack` — fetched 2026-04-27. "MESSAGING Channel (list, get) | MESSAGING Message (get, list, create, update, remove) | HRIS Employee (list, get) | Passthrough (get, post, put, patch, delete)". `Slack (bot)` listed as a separate variant.
- Unified.to messaging model: `docs.unified.to/messaging/overview` — three primary objects (Channel, Message, Event); messages threaded via `parent_id`. Webhook event types not listed in overview.
- Unified.to pricing: `unified.to/pricing` — Grow $750/mo (750k calls), Pro $1,250/mo (1.25M calls), Scale $3k/mo (6M calls), $1/1k overage on Grow/Pro, $0.50/1k on Scale. Connections unlimited; only call volume meters.
- Slack Web API rate limits: `docs.slack.dev/apis/web-api/rate-limits` — Tier 1 (1+/min), Tier 2 (20+/min, e.g. `conversations.list`), Tier 3 (50+/min), Tier 4 (100+/min). `conversations.history` and `.replies` hit new non-Marketplace caps from May 29 2025.
- Slack Events API: `docs.slack.dev/apis/events-api` — 3-second ack, retry at 0/1min/5min, signing-secret verification, `message.{channels,groups,im,mpim}` events.
- Slack OAuth v2: `docs.slack.dev/authentication/installing-with-oauth` — `oauth.v2.access` returns `access_token` (`xoxb-`), `bot_user_id`, `team.id`; granular bot vs user scope split required.
- Our existing Unified webhook: `nextjs-app/app/api/webhooks/unified/route.ts` (lines 81-237).
- Our existing Unified OAuth callback shape: `nextjs-app/app/api/fathom/callback/route.ts` (lines 29-176).
- Our SharePoint direct callback shape (analog for Slack-direct): `nextjs-app/app/api/sharepoint/callback/route.ts`.
- Per-recorder OAuth gotcha (transfers to Slack): `feedback_fathom_per_recorder_scoping`.

### Build-twice meta-call rationale (ESCAPE)

We frame "build twice" not as parallel-forever, but as **sequential with a planned migration**:

1. **Now → +2 weeks: Unified-mediated surface C only.** OAuth callback clone of Fathom's (`/api/slack/callback` → writes `unified_connection_id` into a new `slack_channel_bindings` row). Webhook subscription via Unified console. Use the existing `/api/webhooks/unified` handler with a new event-type branch. Read-only message ingestion → `data_items`. **No D, no E, no reactions, no Block-Kit.** This buys us a working customer-facing v0 fast and validates the data-model in C with real customer messages.
2. **In parallel → +3 weeks: direct Slack for surface D.** Bolt-TS in nextjs-app (we're TS-heavy and the OAuth callback lives there anyway). New `/api/slack/install`, `/api/slack/oauth/callback`, `/api/slack/events`, `/api/slack/interactivity`. Token storage in a new `slack_installations` table keyed by `(askeffi_workspace_id, slack_team_id)`. This is where Gin lives — slash commands, app-home, Block-Kit modals, message-action shortcuts.
3. **Then: migrate C onto direct.** Once the direct stack is proven on D, port C over to it. Drop the Unified Slack subscription. The migration is a re-install per customer (unavoidable — Slack tokens don't transfer between apps) coordinated with a UI nudge.

The "twice" buys: **knowledge of both paths**, fast customer-facing v0, AND a forced cleanup deadline. We don't keep Unified-Slack as a hedge; we use it as scaffolding while we build the load-bearing wall.

**Caveat — the spike that could collapse this to one-and-a-half builds:** Unified's `Passthrough (get, post, put, patch, delete)` action *might* be a transparent proxy to Slack's Web API with their auth/rate-limit out front. If yes, we could stay on Unified longer and use `Passthrough` for reactions/files/Block-Kit while keeping their OAuth. Worth a 30-min experiment before committing to the migration. If `Passthrough` is what it sounds like, ESCAPE downgrades to KNOWLEDGE.

## Bottom — the open ends

### Dilemmas in z026 shape

**z026-D1: Do we publish our own Slack app to Marketplace, ever?**
- *Decision needed:* Yes-now, yes-later, or never (rely on Unified's listing forever).
- *Options:*
  - (a) Submit to Marketplace once direct-Slack ships → ~2-6 wk review, customer-facing app review obligations, but full brand control.
  - (b) Stay unlisted/dev distribution → capped at ~10 workspaces, fine for surface D (just our team) but blocks scaled C.
  - (c) Keep customer-facing C on Unified.to forever, only do direct for D → permanent two-codepath state, permanent subprocessor footprint.
- *Lean:* (a), but only after direct-Slack is validated on D for ~1 month.
- *Why:* Marketplace review is a one-time tax. Permanent two-codepath is an every-bug tax.
- *Price:* 2-6 wk review timeline + initial security questionnaire. Mitigated because we're already doing SOC2 work (`reference_security_reports`).
- *Risk:* App rejected for some Slack-specific reason we haven't anticipated → fall back to (c) anyway.
- *For Lihu to weigh:* timing of the Marketplace push. Want it to overlap with org→workspace migration finish (`project_org_to_workspace_migration`) so the install model is stable when Slack reviewers poke at it.

**z026-D2: Bolt-TS or Bolt-Python?**
- *Decision needed:* Which SDK for the direct-Slack path.
- *Options:*
  - (a) Bolt-TS in `nextjs-app/` — co-located with OAuth callback, Webhook handlers in same Next.js routes, TypeScript type-share with frontend. Risk: Next.js Edge runtime is hostile to long-lived sockets (Socket Mode), but we'd use HTTP Events API anyway.
  - (b) Bolt-Python in `python-services/` — co-located with the agent and the indexing pipeline. Risk: OAuth callback still has to live in Next.js (URL-public surface), so we end up with cross-service plumbing on every install.
  - (c) Raw Web API + raw signing-secret verify — no Bolt at all. Lighter, mirrors how we did `webhooks/unified`. Risk: re-implementing rate-limit retry, retry-num idempotency, etc.
- *Lean:* (a) for now, with a note to revisit if Gin's slash-command latency becomes a problem (Python-side might be lower hop count to the LLM).
- *Why:* OAuth callback already wants to live in Next.js (per Fathom precedent — service-role write to Supabase). Keeping Slack code co-located reduces cross-process plumbing.
- *Price:* Bolt-TS adds ~MB to Next.js bundle if we're not careful with imports. Mitigated by `barrel/no-server-in-barrel` rules.
- *Risk:* Next.js routes have a 60s timeout; long Slack interactivity flows that need >60s have to defer. Bolt-Python in a long-running FastAPI process avoids this.
- *For Lihu to weigh:* if Gin-mediated Slack flows are LLM-streaming-heavy, Python-side may genuinely be the right hop. Defer if unsure.

**z026-D3: Migration trigger — what tells us C should leave Unified?**
- *Decision needed:* Concrete signal that flips C off Unified.
- *Options:*
  - (a) Customer count threshold (e.g. when N=20 active Slack-connected customers).
  - (b) Feature ask threshold (e.g. first reaction-sync request).
  - (c) Cost threshold (e.g. when Unified bill > $X/mo for Slack alone).
  - (d) Time threshold (e.g. 90 days after direct-Slack ships on D, regardless).
- *Lean:* (b) OR (d) whichever first. Feature asks are honest demand; (d) is a forcing function so we don't drift forever.
- *Why:* Without an explicit trigger, we'll keep Unified-C alive past its expiration date because migration is painful. Pre-commit the trigger now.
- *Price:* Saying "yes" to a customer ask we'd have wanted to defer.
- *Risk:* Trigger fires before direct-Slack is solid on D — we'd be migrating onto an unproven runway.
- *For Lihu to weigh:* whether to hard-code (d) at a specific date or keep it as a cultural reminder.

### Friction zettels captured

None this round — Unified.to docs were findable, Slack docs were authoritative, and the Slack-via-Unified ceiling fell out of one page on `unified.to/integrations/slack`. No surprising friction worth a zettel beyond what's already in `reference_fathom_per_recorder_scoping` (which directly applies to Slack and is cited above).

### Things I couldn't tell from the sources alone

- **Whether Unified's `Passthrough` is a true Slack Web API proxy with their auth in front**, or just a generic HTTP forwarder. This single fact swings the build-twice verdict from ESCAPE toward KNOWLEDGE-only. Recommend a 30-min spike with their sandbox before commit.
- **Whether Unified.to publishes a Slack `message.created` real-time webhook event or polls.** Their generic webhook docs cover the signing scheme but the messaging-overview page lists "Events" as a separate domain object you "update", which reads polling-shaped, not push-shaped. If polling, latency for surface D is dead-on-arrival even if the API surface were complete.
- **Slack Marketplace review timeline as of 2026.** Community reports range 2-6 wk; Slack's own page on requirements 404'd during this round. Synthesizer should pull a fresh data point or treat it as a parameter.
