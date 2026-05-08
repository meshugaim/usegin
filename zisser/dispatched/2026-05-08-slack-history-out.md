---
date: 2026-05-08
charter: zisser/dispatched/2026-05-08-slack-history.md
caller: Zisser (Phase-1 of doppler-and-slack-ground-down)
mode: read-only — substrate (plans/dispatched/inbox/notes/handoff/log/research/zettels)
scope: Slack-into-Effi (customer) AND AskEffi-team-Slack (own workspace) — kept separate
---

# Slack history — what we said Slack-into-Effi should look like

This is the latent picture, distilled from ~2 weeks of plans, dispatches,
zettels, R&D whiteboards, and team conversations. No application code was
opened; siblings cover that. Two flows are kept separate throughout: the
**customer-facing product** (a customer connects their Slack to Effi so
Effi can answer questions about their channels) and the **AskEffi team's
own Slack workspace** (our working environment — Slacker bot, channel
reorg, dev channel).

---

## 1. The customer flow — "I want to connect Slack" → "Effi answers about my Slack"

The shape that the team has converged on. Source-of-truth for the picture
is `usegin/research/slack-integration/recommendation.md` (R1–R5) +
`zisser/plans/2026-05-04-slack-ux-alignment.md` (UX) +
`zisser/plans/2026-05-05-slack-for-effi-app-creation.md` (the runbook for
creating the customer app).

```
1. Workspace admin opens AskEffi → Workspace Settings → Integrations.
   (or: opens any project → Integrations tab → Slack card. Project entry
   point uses a modal that walks workspace install first, then channel
   pick — one continuous flow, no link-out to workspace settings.)

2. Clicks "Connect Slack". Bounces to Slack OAuth consent.
   Customer admin (the workspace owner of THEIR Slack workspace) approves
   the requested scopes.

3. Slack redirects back to .../api/slack/callback?code=...&state=...
   The Next.js callback exchanges code → bot token, encrypts it
   (AES-256-GCM, key in TOKEN_ENCRYPTION_KEY), writes ONE row to
   slack_installs at workspace_id (one install per AskEffi-workspace +
   Slack-team_id pair).

4. Card now shows "Connected — <Slack team name>".

5. Admin opens a project → Integrations tab → Slack card now reads
   "Bind a channel". Clicks. Channel-picker modal opens listing public
   + bot-member private channels (no DMs).

6. Admin picks a channel. The bot auto-joins public channels via
   conversations.join. Private channels: Slack denies app self-join, so
   a human in the channel must `/invite @effi` once. (Captured as a
   future-want to automate; see decisions-open §5.)

7. slack_channel_bindings row written: (slack_install_id, channel_id,
   project_id). Schema is N:1 (multiple channels can feed one project),
   though customer-facing copy reads as 1:1 until ≥30% of pilots ask
   for multi-channel — then the help flips, no schema migration needed.

8. Slack starts pushing message events (HTTP Events API, not Socket
   Mode — Marketplace forbids Socket Mode) to .../api/slack/events.
   The route verifies signing-secret, acks within 3s, dispatches to
   handleMessageEvent, which:
     - filters subtypes (channel_join, channel_leave, bot_message,
       message_changed, message_deleted are dropped; edits/deletes are
       deferred to slice C7)
     - skips messages whose bot_id matches our own bot_user_id (no
       feedback loop)
     - looks up the (slack_install_id, channel_id) → binding; drops
       events for unbound channels with 200 OK
     - calls create_slack_message_with_data_item RPC (born-together
       pattern lifted from the SharePoint precedent at
       supabase/migrations/20260410133824_*) — atomically inserts one
       data_items row + one slack_messages row, idempotent on
       (team_id, channel_id, ts) via partial unique index.

9. The data_items row is access_level='internal'. Slack data is
   internal-only at MVP — no per-message external labeling.

10. Effi indexes the data_item via the existing retrieval pipeline.
    Customer asks "what did we decide about Q3?" — Effi's answer cites
    the bound Slack thread by channel + ts + author.

11. (Future, slice C5) On bind, kick off a bounded backfill —
    conversations.history for last 30/90/all days, capped, throttled
    against Slack's May-2025 ToS limit (1 req/min × 15 msgs/page for
    non-Marketplace apps; lifted once listed). The promise is
    "search-recent-history-plus-everything-since-connect", NOT
    "search-everything".

12. Lifecycle:
    - app_uninstalled → mark install revoked, delete bindings.
    - tokens_revoked → mark install revoked, PRESERVE bindings (so
      reconnect doesn't lose customer config).
    - channel_rename → STRICT-BREAK the binding (don't silently follow
      the renamed channel id; that's an RLS-leak vector — a bound
      #general-temp could be renamed #hr-only).
    - channel_archive / channel_deleted → soft-deactivate vs
      hard-delete still open; deferred until a customer hits it.
    - message edits/deletes → reserved (deleted_at column exists),
      handler shipped with subtypes filtered, real edit/delete logic
      is slice C7.

13. Unbind / reconnect: customer can unbind a channel from the project
    Integrations tab; can disconnect Slack workspace-wide from
    Workspace Settings → Slack card. Either revokes ingestion and
    queues delete of indexed messages.
```

The shape Lihu anchored on 2026-05-04: **workspace-level install, per-project
channel binding, modal-from-project for the no-install case, no
link-out**. The cluster-finding behind this: every prior integration
(Drive, Linear, Fathom, SharePoint) re-asked "is this per-project or
per-workspace?" and answered differently; Slack is the integration that
finally forced the canonical declaration. Drive/Linear/Fathom/SharePoint
all migrate to the same shape later, in their own plans, not in the
Slack plan.

---

## 2. Slack apps we said exist

This list is what the substrate names — not what `api.slack.com` shows
today (siblings cover live state).

| App | What it is | Slack `app_id` (when named) | OAuth client_id | Owner | Status as the substrate describes it |
|---|---|---|---|---|---|
| **`Effi Spike`** | Original customer-facing AskEffi-Slack spike app. The first OAuth client whose creds landed in Doppler `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET`. | not explicitly named | `9761199231332.11011255384930` | AskEffi | Live in Doppler dev/staging/prod as of 2026-05-04. To be **superseded** by `Slack for Effi` (see below). Also installed as a bot user `effi_spike` (U0B098LR8EA) in the team's own workspace, in three channels. Slated for browser-only removal once the real customer app lands. |
| **`ingest-poc`** | Throwaway Slack app used for the overnight slack-ingest POC (2026-04-28 → 04-29). Brown was driven through OAuth paperwork against this one by mistake. | `A0B0GLH05L2` | `10968745065781.11016697005682` | AskEffi (test workspace) | Used only by the parallel-JSONL POC at `oria-crazy-world/ground/oria-crazy-space/slack-ingest-poc/`. Not customer-facing. To be retired with the test workspace. |
| **`Slack for Effi`** (*planned*) | The canonical customer-facing app to be created per `zisser/plans/2026-05-05-slack-for-effi-app-creation.md`. Replaces Effi Spike on the customer surface. Bot display name: `Effi`. Username: `effi`. | TBD — Brown creates | TBD | AskEffi | **Not yet created.** 11-step Brown runbook is ready-to-run, every step still ⬜. Naming is the load-bearing decision: Lihu anchored on `Slack for Effi` (inbound = `<Tool> for Effi`, outbound future = `Effi for <Tool>`). |
| **`UseGin-Slack`** (real workspace) | The team-facing bot ("Slacker") — Gin's voice into our own Slack. CLI-shaped (`dx slack send/read/inbox`), like `plan` for Linear. Distinct from the customer app: different `app_id`, different scope surface, different review track. | `A0B0NPJ3DK6` | (env var: `USEGIN_SLACK_BOT_TOKEN`, `USEGIN_SLACK_APP_TOKEN`, `USEGIN_SLACK_SIGNING_SECRET`) | AskEffi | Code shipped (ENG-5760 — `dx slack` admin-grade ops). Bot token in Doppler points at a **dead workspace** as of 2026-05-05 — Oria's probe returned `account_inactive`. Re-install + Doppler paste pending Lihu (steps A1–A7). |
| **`UseGin-Slack`** (test workspace) | Older sibling install in a test workspace; previously where `dx slack whoami/send/post/read/inbox` was verified live. | `A0B03N3HC4F` | older bot token (xoxb-10968745065781-…) | AskEffi (test workspace) | Slated for retirement with the test workspace. |

### Scopes the substrate names

For **`Slack for Effi`** (customer-facing, read-only at MVP, per
`zisser/plans/2026-05-05-slack-for-effi-app-creation.md` Step 4 +
`usegin/research/slack-marketplace/listing-draft.md`):

```
channels:read       channels:history       channels:join
groups:read         groups:history
users:read          team:read
chat:write          reactions:write        app_mentions:read
links:read
```

(`chat:write` was caught by Lihu as scope-bloat — "why does Effi need
to write?" Read-only at MVP per recommendation R2 lean (c). Marketplace
listing-draft drops `chat:write` from the requested set; the runbook
still lists it. Inconsistency flagged in §6.)

**No** DM scopes (`im:*`, `mpim:*`) — DMs explicitly out of scope. **No**
`commands` at MVP.

For **`UseGin-Slack`**, broader: `chat:write`, `channels:read|history`,
`groups:read|history`, `im:history`, `mpim:history`, `app_mentions:read`,
`reactions:write`, `users:read` — plus the Wes-chartered admin-grade
adds: `channels:manage`, `groups:write`, `channels:join`,
`users:read.email`, `bookmarks:write`, `files:write`, `im:write`.

### Redirect URLs

Customer app (`Slack for Effi`):

```
https://app-staging.askeffi.ai/api/slack/callback   (staging — hostname unconfirmed, ↑Q1 in runbook)
https://app.askeffi.ai/api/slack/callback           (prod — hostname unconfirmed, ↑Q2)
http://localhost:3000/api/slack/callback            (local)
```

Plus events URL: `<host>/api/slack/events`, signing-secret-verified.

Local dev historically used `https://local-dev.askeffi.ai/api/slack/callback`
through a cloudflared tunnel mapping to `:3000`. (Important: `agent-dev`
on `:63000` hard-codes `NEXT_PUBLIC_SITE_URL=http://localhost:63000`
which Slack rejects as non-https — in-app smokes must use `just dev`.)

### Doppler keys (substrate's view; sibling state agent owns the live read)

```
SLACK_CLIENT_ID                  # currently Effi Spike; will be Slack for Effi
SLACK_CLIENT_SECRET              # same
SLACK_SIGNING_SECRET             # same
TOKEN_ENCRYPTION_KEY             # AES-256-GCM key for slack_installs.bot_token_encrypted

USEGIN_SLACK_BOT_TOKEN           # team bot (Slacker)
USEGIN_SLACK_APP_TOKEN           # if/when socket-mode used
USEGIN_SLACK_SIGNING_SECRET      # team bot

SLACK_CLIENT_APP_ID              # optional; strict-app filter for cross-app installs
```

The `ASKEFFI_SLACK_*` rename was proposed (autonomous-ops charter §3) to
disambiguate customer vs team but **deferred** until a second app forces
it.

### Owner

All apps owned by AskEffi. Lihu and Oria are workspace owners + admins
in the team Slack (`is_owner: true, is_admin: true`); Lihu is the only
one who can install apps / approve OAuth on the team workspace.

---

## 3. The internal Slack-for-team workspace reorg

Source: `zisser/plans/2026-05-05-slack-workspace-reorg.md` +
`usegin/research/slack-integration/usegin-slack-team/whiteboard.md` +
`zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md`. This is
the AskEffi team's own Slack as a **working environment**, not the
customer product.

### The desired-state shape

Workspace: `askeffiworkspace.slack.com` (`T09ND5V6T9S`, Pro plan).
(Note: the live UseGin-Slack bot today reports team `askeffi` /
`T0AUGMX1XNZ` — see contradictions §6.)

**13 active channels in two zones, plus one external Connect channel:**

```
TEAM ZONE (humans + tools)
  #all-askeffi        announcements, everyone
  #social             non-work
  #effi-dev           eng technical
  #product            product, design, decisions
  #brand              brand, copy, marketing
  #gtm                GTM, sales, pipeline
  #client-discovery   (renamed from #client-discovery-calls)
  #usability          (renamed from #usability-studies)
  #ocw                OCW (oria-crazy-world)
  #related-tech       adjacent-AI links, tools, papers
  #site-inbound       inbound from marketing site

SLACKER ZONE (Gin's voice into the team — the registry constants in
                tools/dx/src/slack/registry.ts)
  #slacker-out        Brown relays, durable artifacts, "Lihu should see"
  #slacker-alerts     Sentry P1+, watcher-driven, build/deploy alarms
  #slacker-log        append-only daily summaries

EXTERNAL (Slack Connect)
  #unified-askeffi    Unified.to vendor channel (archive when we leave Unified)

ARCHIVED
  #new-channel        Slack-template residue (5 humans, has real history — read first)
  #spike-slack-unified throwaway test
```

### The bot

Slacker (a.k.a. `useginslack`, the UseGin-Slack bot) is **the team-side
agent persona**, distinct from the customer-facing `Effi` bot. The
naming evolved across the substrate:

- `Gin` (early — superseded)
- `UseGin` (current name for the dev agent + DX app, z033)
- `Slacker` (Lihu's anchor 2026-05-05 — UseGin's voice when it speaks
  into Slack; the per-medium persona name)

Channel registry export name stays `ZISSER_CHANNELS` (or
`SLACKER_CHANNELS` — separate decision deferred). Channel string values
become `#slacker-*`.

### Bot inventory

| Bot | What | Status in reorg |
|---|---|---|
| `granola` | Meeting recorder/notes | keep |
| `googledrive` | Drive link previews | keep |
| `inbound` | Site inbound (in `#site-inbound`) | keep |
| `effi_spike` | Customer-app **test** install in team Slack | **remove** (browser, by Lihu, after `Slack for Effi` lands in production) |
| `useginslack` / Slacker | Team-bot (Gin's voice) | **add/install** to real workspace per A1–A7 |

### Membership pattern

- Lihu, Oria — owners + admins, in nearly every channel (Lihu in all).
- Oria currently absent from `#brand`, `#gtm`, `#client-discovery-calls`,
  `#product`, `#related-tech`, `#site-inbound`, `#usability-studies`.
  Reorg proposal adds Oria to `#product` + `#related-tech`
  (eng-adjacent); leaves business channels as-is. Defaulted, ↑Q2.
- Courtney out of `#effi-dev` (intentional, eng/business split).
- Slacker bot in all three Slacker channels + `#all-askeffi`; in
  `#effi-dev` once `effi_spike` is removed.

### Lihu's irreducible click list

The "what you can't autonomous" boundary, captured in the autonomous-ops
charter:

```
A1–A7  Install UseGin-Slack to the real AskEffi workspace, paste new
       xoxb-... into Doppler USEGIN_SLACK_BOT_TOKEN (per env), invite
       bot to a smoke channel.    ~10 min, browser-only.
B1     Remove effi_spike bot     askeffiworkspace.slack.com/apps/manage
                                  (after Slack-for-Effi production install lands)
B2     Install Slacker (UseGin-Slack) bot — same as A1–A7.
B3     Archive #unified-askeffi Connect channel — when we leave Unified.to.
```

Plus the customer-app side: the 11 Brown/Lihu steps in
`zisser/plans/2026-05-05-slack-for-effi-app-creation.md` to register
`Slack for Effi`, set scopes, enable events, write Doppler creds, run
staging smoke, promote to prod.

### CLI shape — Slacker is `dx slack`

Surface (mostly shipped via ENG-5760, Wes 2026-05-04):

```
dx slack whoami | send | post | read | inbox          (originals)
dx slack channel create | invite | join | archive | topic | purpose | bookmark | members
dx slack user find <email-or-handle>
dx slack dm <user-or-email> <message>
dx slack files upload <ch> <path>
dx slack react <ch> <ts> <emoji>
dx slack smoke                                          (post-install gate)
```

Conventions: `--json` everywhere; bot token from
`USEGIN_SLACK_BOT_TOKEN` (Doppler); ENG-NNNN auto-rendered as Linear
links on read + write; `EXPECTED_REAL_TEAM_ID` constant in the registry
file as the disambiguator from the test workspace.

---

## 4. Decisions made (with one-line "why" + source)

| # | Decision | Why | Source path |
|---|---|---|---|
| D-1 | Customer Slack is **read-only at MVP**. | Bidirectional is its own scope/review surface; harden it on team blast radius (Slacker) first, graduate to customer later. | `usegin/research/slack-integration/recommendation.md` R2; `CLOSE.md` D2 |
| D-2 | **Direct Slack** (Bolt-Python in `python-services/`), not Unified.to. | Unified ceiling is hard (no reactions/files/Block-Kit); per-customer migration cost grows; we build direct anyway for D. | recommendation R1; `CLOSE.md` (autonomous run resolved 2026-04-28) |
| D-3 | **Workspace-level OAuth install + per-project channel binding** for Slack — and for every future third-party OAuth integration. | Slack's OAuth is workspace-shaped; channel↔project is intrinsically 1-to-N. Drive/Linear/Fathom/SP migrate to the same shape later. | Lihu anchor 2026-05-04; `zisser/plans/2026-05-04-slack-ux-alignment.md` D1–D7 |
| D-4 | **Modal-from-project** for the no-install path: project Slack card → modal → workspace install → return into modal at channel-pick step. **No link-out** to workspace settings. | Preserves "I'm working on this project" mental context; matches Apr-30 feature-prioritization meeting (Lihu+Oria+Guy). | `zisser/plans/2026-05-04-slack-ux-alignment.md` D4; `zisser/dispatched/2026-05-05-slack-slice1-modal-from-project-wes.md` |
| D-5 | **Schema is N:1** (project ↔ many channels) from day one; **customer-facing copy reads as 1:1** until ≥30% of pilots ask for multi-channel. | Cheap-designed-in / expensive-retrofit; team's own usage already spans ≥3 channels per project. | recommendation R3; `CLOSE.md` D4 |
| D-6 | **Per-message data_items**, idempotent on `(team_id, channel_id, ts)`. Thread-bundling happens at retrieval, not ingestion. | Per-channel rollups break citations + RLS; per-thread breaks per-message access. | SYNTHESIS CF5; `zisser/dispatched/2026-04-29-slack-c4-message-ingestion-wes.md` (shipped via ENG-5778 with `slack_messages` born-together RPC) |
| D-7 | **No LLM in ingestion.** Mrkdwn → plain via regex; helper `stripSlackMrkdwn`. | Email-splitter precedent (ENG-5197). | SYNTHESIS CF6; C4 charter shipped |
| D-8 | **HTTP Events API**, not Socket Mode. | Marketplace forbids Socket Mode; matches public-Next.js / internal-Python invariant. | SYNTHESIS CF4 |
| D-9 | **Webhook ingress via Next.js → Python proxy.** Signing-secret verify on Next.js. | Mirrors `webhooks/unified` and `webhooks/mailgun`. | SYNTHESIS CF8 |
| D-10 | **Channel rename = strict-break the binding.** | RLS-leak vector: a bound `#general-temp` renamed `#hr-only` keeps id and silently re-points indexing. | SYNTHESIS CF9; `DEMO.md` lifecycle row |
| D-11 | **Bot token (`xoxb-`) is the spine.** User tokens (`xoxp-`) only when a feature genuinely cannot be done as bot. | Avoids the Fathom-per-recorder trap; one OAuth = one workspace coverage; survives users leaving. | SYNTHESIS CF2; auth-cardinality whiteboard |
| D-12 | **Multi-Slack-workspace per AskEffi-workspace is normal**, not edge. **Reverse direction is locked** (one Slack workspace cannot feed two AskEffi tenants). | Schema accepts N installs from day one; unique on `(enterprise_id, team_id)` as cross-tenant guard. | SYNTHESIS CF7; auth-cardinality D2 |
| D-13 | **Tokens encrypted at rest** (AES-256-GCM, app-side key in `TOKEN_ENCRYPTION_KEY`). The OAuth callback **refuses** to write raw `xoxb-` (z091 quality gate). | First integration to hold raw provider tokens (Drive/Linear/Fathom proxy via Unified.to). KMS upgrade is later, swappable interface. | z089; `CLOSE.md` D1; `DEMO.md` Phase 0 |
| D-14 | **UseGin-Slack and `Slack for Effi` are SEPARATE Slack apps.** Two app_ids in env from day one. | Different scope surface, different identity in Slack UI (Gin vs Effi), different OAuth client_id, different review track. | auth-cardinality D4; `CLOSE.md` |
| D-15 | **Marketplace listing track starts now** (the moment OAuth flow demos), not "when first customer signs". | May-2025 ToS cliff: 1 req/min × 15 msgs/page on `conversations.history` for non-Marketplace apps; full enforcement 2026-03-03. Review takes 2–6 wk. | recommendation R4; `CLOSE.md` D3; ENG-5417 |
| D-16 | **Events-first ingestion**, **bounded backfill window** (90 days default; 30/90/all options). UI clearly states the freshness floor. | Free-tier Slack only retains 90 days; the throttle math makes "everything" impossible without Marketplace; bounded is the honest UX. | recommendation R5 |
| D-17 | **AskEffi-Slack-on-team-tenant collapses into the customer surface** (E collapses into C). The team is a customer at the integration boundary. | All 5 candidate distinctions (tenant, scope, RLS, write-back, auth) collapse. The genuinely team-flavored want is Gin-mediated R/W (D), separate angle. | SYNTHESIS CF10; `askeffi-slack-team-relation/whiteboard.md` |
| D-18 | **Naming convention.** Customer-facing app: `Slack for Effi`. Bot display name always `Effi`. Inbound integrations: `<Tool> for Effi`. Outbound (future): `Effi for <Tool>`. Internal env-var rename (`SLACK_*` → `SLACK_FOR_EFFI_*`) deferred until a second Slack app forces it. | Lihu anchor 2026-05-05; "go with 'Slack for Effi', note that we want a convention". Three integrations (Drive, Linear, Slack) re-asked the question; this is the canonical answer. | `zisser/notes/2026-05-05-integration-naming-convention.md` |
| D-19 | **Slacker** is the per-medium persona name for UseGin's voice in Slack. Channel string values become `#slacker-*`; export const stays `ZISSER_CHANNELS`. | Lihu anchor 2026-05-05; per-medium persona is clearer than per-agent identity for human team members. | `zisser/plans/2026-05-05-slack-workspace-reorg.md` ↑Q3 default |
| D-20 | The team's `#usegin` (later: `#slacker-*`) outbox is **shared**, not per-engineer. | Mirrors the no-privacy posture of `usegin/zettel/` — full team transparency by design (`project_zettel_no_privacy`). | usegin-slack-team whiteboard D3; `zisser/plans/2026-05-05-slack-workspace-reorg.md` |
| D-21 | **No DM/mpim ingestion** at customer surface, ever. Different consent model. | RLS posture; Marketplace would also push back. | customer-channel-binding "anti-decisions"; listing-draft scopes-not-requested |
| D-22 | **Slack's `data_items.access_level = 'internal'`** for all Slack messages at MVP. External-tier sees zero Slack content. | Slack channels (especially private) almost always contain internal-team chatter; default-internal until per-message labeling exists. | customer-channel-binding RLS section; C4 RPC sets `'internal'` |

---

## 5. Decisions still open (with where it surfaced + why it stalled)

| # | Open question | Where it surfaced | Why it stalled / what it's waiting on |
|---|---|---|---|
| O-1 | **Brown's identity for the `Slack for Effi` runbook** — who is Brown today, and is he a workspace owner of the AskEffi Slack? | `zisser/plans/2026-05-05-slack-for-effi-app-creation.md` ↑Q3 | Lihu must answer before Step 1; Brown protocol assumes a workspace owner is at the keyboard. (Brown is the relay-protocol persona — Lihu pasting messages to a third party — not a fixed person.) |
| O-2 | **Staging hostname** for the customer app's redirect + events URLs (`app-staging.askeffi.ai`?). | runbook ↑Q1 | One Lihu-line answer; Zisser will pre-flight verify but Lihu authoritative. |
| O-3 | **Production hostname** (`app.askeffi.ai`?). | runbook ↑Q2 | Same. |
| O-4 | **Effi logo file path** Brown uploads in Step 3, plus brand color hex. | runbook ↑Q4 + ↑Q5 | Marketing/Lihu fills; pure paperwork. |
| O-5 | **Automate private-channel `/invite @effi`.** Slack denies app self-join on private channels; a human must `/invite @effi` once per bound private channel. Silent-failure mode if forgotten. | `zisser/inbox/2026-05-05-slack-private-channel-invite-automation.md` (Lihu: "note it for us that we'll wanna automate it") | Invisible until C4 ingestion ships and customers bind private channels. Four candidate approaches sketched (UI hint, post-bind detect-and-prompt, slash-command bind-from-Slack, user-OAuth invite-on-behalf-of); D fully removes the manual step but depends on Slack's `groups:write` deprecation status. Not a decision yet. |
| O-6 | **`#new-channel` archive vs rename.** Has 5 humans + real history but never renamed from Slack-template default. | reorg plan §6 ↑Q1 | Default: parent-Zisser reads last 50 messages, proposes a rename in `zisser/inbox/`, doesn't archive yet. |
| O-7 | **Add Oria to `#product` and `#related-tech`?** Eng-adjacent channels currently exclude Oria. | reorg plan §6 ↑Q2 | Default: yes, add (reversible). Lihu nod. |
| O-8 | **Modal flow when workspace install is `errored`** (token revoked) — same modal with reconnect copy, or separate path? | `zisser/plans/2026-05-04-slack-ux-alignment.md` §6 ↑Q3 | Default: same modal, step 1 says "reconnect Slack for {workspace}". Lihu hadn't reviewed at last log. |
| O-9 | **Verb shift to "Bind X" for Drive/Linear/Fathom/SharePoint** — now (cosmetic, while still doing per-project OAuth) or wait until each migrates? | UX-alignment §6 ↑Q4 | Default: wait. Verb-honesty means matching the action; saying "Bind" while doing per-project OAuth would lie. |
| O-10 | **Drive migration spec** — start drafting in parallel with Slack slices 1–4, or after Slack lands? | UX-alignment §6 ↑Q5 | Default: now (parallel) — Drive is the highest-volume, most-expensive migration. |
| O-11 | **Slice 5** (placeholder cards for not-yet-migrated providers in workspace settings) — ship or skip? | UX-alignment §6 ↑Q1 | Default: skip; let users see real cards when each provider migrates. |
| O-12 | **Workspace card "X channels bound across Y projects" summary** (slice 2) — show or omit? | UX-alignment §6 ↑Q2 | Default: show. |
| O-13 | **Enterprise Grid** customers — v1 target or v2? Affects whether install-row model is one-org-row + dynamic team_id (a) or N-rows-at-install (b). | auth-cardinality D1 | Default: N-rows (b) if v1; (a)-stub if v2. Not yet decided. |
| O-14 | **Reverse-direction lock — hard unique vs soft warning.** Should one Slack workspace ever be allowed to feed two AskEffi tenants (holding-company / agency models)? | auth-cardinality D2 | Default: hard unique. Recovery via uninstall+reinstall. |
| O-15 | **Per-user xoxp tokens** — opt-in per feature, or never? | auth-cardinality D3 | Default: opt-in with very strong default-against. Bar to introduce: "this feature CANNOT be done as bot." |
| O-16 | **Marketplace pricing model** ("Free and paid plans" assumed; or just "Free" if AskEffi is currently free-pilot-only?). | listing-draft "Open questions for Lihu" | Lihu confirm; either is changeable post-launch. |
| O-17 | **Privacy policy + terms** must enumerate Slack data fields, retention, deletion procedure for the Marketplace questionnaire. | submission-checklist P3 + P4 | Legal seat, not Gin's. Listed as a pre-submit blocker. |
| O-18 | **Reactions in the `raw` field** at C4 ingest, or wait for C6? | C4 spec Q2 | Lean: capture now (`raw` is opaque, costs nothing). `[ORIA] answer:` field still empty. |
| O-19 | **Failure visibility** when ingestion fails — customer-visible warning, Sentry-only, or defer the UI entirely? | C4 spec Q3 | Lean: Sentry only at C4; revisit at C7. `[ORIA] answer:` empty. |
| O-20 | **Display-name resolution for `<@U…>` mentions** in mrkdwn-stripped text. Wes's C4 v0 collapses to literal `@user`. | C4 charter return Q1 | Defer to C5 (Slack stub-user model). |

---

## 6. Contradictions / drift

Where two sources in the substrate disagree about the same thing.

### C-A — Which Slack workspace is the "real" AskEffi team workspace?

- `zisser/plans/2026-05-05-slack-workspace-reorg.md` (header) says
  `askeffiworkspace.slack.com` (`T09ND5V6T9S`, Pro plan) — claims
  inventory snapshot at `/tmp/slack-inventory/`.
- `zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md`
  sub-Zisser return + `zisser/inbox/2026-05-05-oria-slack-dev-channel-probe.md`
  say the live UseGin-Slack bot reports team `askeffi`/`T0AUGMX1XNZ`.
  As of 2026-05-05/06 the bot returns `account_inactive` from that
  team_id.

Two different `team_id` values for what should be one workspace. The
substrate doesn't reconcile this — could be: (a) reorg plan probed a
different (newer, post-rename) workspace; (b) the UseGin bot's
test-workspace install vs the real-workspace install have different
team_ids and one of the two notes labels theirs wrongly. Sibling state
agent must resolve via `auth.test` against a known token.

### C-B — `chat:write` on the `Slack for Effi` customer app

- `zisser/plans/2026-05-05-slack-for-effi-app-creation.md` Step 4 lists
  `chat:write` (and `reactions:write`) in the requested scope set.
- `usegin/research/slack-marketplace/listing-draft.md`
  "Scope-justification" table **omits** `chat:write` and explicitly
  notes "Same — read-only" under "Scopes deliberately not requested at
  MVP".
- `zisser/dispatched/2026-05-05-slack-arc-close-tikur-and-tests.md` §2
  "scope-bloat" lekach: "**`chat:write` scope was on the runbook
  unnecessarily** — Lihu caught it ('why does Effi need to write
  anything?')".

The runbook hasn't been updated with Lihu's catch. Read-only at MVP
(D-1) means dropping `chat:write` and `reactions:write` from the
requested scope set, plus `app_mentions:read`, plus `links:read` (which
also doesn't appear in the listing-draft).

### C-C — UseGin-Slack outbox channel name

- `tools/dx/src/slack/registry.ts` (per autonomous-ops charter §4
  sketch): `#zisser-out`, `#zisser-alerts`, `#zisser-log`.
- `usegin/research/slack-integration/usegin-slack-team/whiteboard.md`
  (D's whiteboard): `#usegin` as the single shared outbox.
- `DEMO.md` Phase 1c: create `#usegin` and `/invite @UseGin`.
- `zisser/plans/2026-05-05-slack-workspace-reorg.md`: rename to
  `#slacker-out`, `#slacker-alerts`, `#slacker-log`.

Three names in flight (`#zisser-*`, `#usegin`, `#slacker-*`). The
reorg plan is the latest (2026-05-05) with Lihu's "Slacker" anchor.
Channels themselves don't yet exist.

### C-D — Schema rev for `slack_messages` and `data_items`

- C charter angle (Apr-27 R&D): `slack_messages` table with
  `data_item_id` FK; data_items.entity_id as composite string
  `<team_id>:<channel_id>:<ts>`; `access_level='workspace'`.
- Live schema (Wes return 2026-05-05, after charter halt):
  `data_items.entity_id` is `uuid NULL`; `access_level CHECK IN
  ('internal','external')` only — `'workspace'` doesn't exist.
- C4 charter §4 was **revised 2026-05-05** to match the schema (option
  1: born-together pattern, internal access_level, slack_messages.id
  is the entity_id uuid). Shipped via ENG-5778.

Substrate-vs-current-state gap was real; C4 v0 lands on the live shape.
The Apr-27 R&D whiteboards still show the old shape — readers must
prefer the C4 charter and Wes-return as authoritative.

### C-E — Unified.to as a path for customer Slack

- Whiteboard A (`unified-platform`): "Unified is paved-road for ~70% of
  customer ingestion".
- Whiteboard F (`comparative-paths`): "Unified is genuinely two
  different products vs direct Slack" — F's verdict is ESCAPE.
- recommendation R1 lean: **(a) Direct from day one** — skip the
  Unified scaffold. The ESCAPE only beats direct-from-start if calendar
  pressure forces it.
- `usegin/research/slack-integration/CLOSE.md` D2 (resolved): direct,
  read-only, customer surface graduates from Slacker.

Resolved in favor of direct, but the divergence of the angle
whiteboards is preserved in the corpus and a future reader could
mistake Unified for a live option.

### C-F — Cardinality lean (ChannelxProject)

- C whiteboard: 1:1 strict (forbidden N channels → 1 project).
- E whiteboard: N:1 immediately ("the team's own usage spans ≥3
  channels per project").
- recommendation R3 + `CLOSE.md` D4 resolution: **schema is N:1 from
  day one; help docs read 1:1 until ≥30% of pilots ask**.

Resolved; the C-whiteboard's 1:1-strict reading is stale.

### C-G — Modal-from-project flow on errored install

The UX-alignment plan §1 click-path matrix says state (a)
("workspace-not-installed") opens the modal. The Slice 1 charter
(Wes implementation) collapses errored installs to step 2 (channel
picker) because the card's `installed` boolean is just
`slackContext.install !== null`. ↑Q3 in the plan says "modal also when
errored?" with default yes; Wes's slice 1 didn't ship that. So Slice 1
behaves wrong on errored installs until Slice 2 lands an
`installStatus="error"` field. Tracked in the slice-1 return ↑Qs.

---

## 7. The "click" — what is Slack-into-Effi, in plain words?

Slack-into-Effi is two distinct products that share an OAuth shape and
a name.

The **customer product** (`Slack for Effi`) is an inbound data
integration: a customer admin clicks once at the workspace level to
authorize a single Slack app, then per project picks which channels
feed that project. Public channels join automatically; private
channels need a one-time `/invite @effi` from a human in the channel.
From then on, every new message in a bound channel becomes one indexed
data_item — the customer can ask Effi questions like "what did we
decide about Q3?" and get back an answer with a link to the original
Slack thread. It's read-only at MVP (Effi never posts back), bounded
to ~90 days of historical backfill (because Slack's May-2025 throttle
makes "everything" impossible without Marketplace listing, which is
the parallel paperwork track), and disconnect cleans up on either
side.

The **team product** (Slacker, the UseGin-Slack bot) is the inverse
shape: not a connector but a CLI persona. `dx slack send #effi-dev
"deploying staging"` is how Gin speaks into the team's own Slack —
mirroring how `plan` speaks into Linear. One bot token, attribution in
the message (`*[via Lihu]*`), shared `#slacker-*` channels for Gin's
proactive output (Brown relays, alerts, logs). It exists on the
team's own Slack workspace and ships first because its blast radius
is internal — it's the sandbox where bidirectional behavior gets
hardened before any customer-facing bidirectional ever ships.

The two products are the **same OAuth shape but different apps** —
distinct `app_id`s, distinct scopes, distinct review tracks, distinct
identities in the Slack UI (`Effi` for customers, Slacker/UseGin for
the team). They're separate because conflating them means either
over-scoping the customer app (review-rejection risk) or under-scoping
the team app (Gin can't admin-grade-operate). The substrate is consistent
on this from H whiteboard onward.

The shape Slack forced on the rest of AskEffi: **all third-party OAuth
integrations migrate to "install at workspace, bind at project"**.
Drive, Linear, Fathom, SharePoint — each ships its own migration plan
later, but the canonical shape is the Slack shape. The cluster-finding
behind it: every prior integration re-asked "is this per-project or
per-workspace?" and answered differently; the codebase has been
waiting for a declaration. Slack is the declaration.

---

## Appendix — sources read

Plans:
- `zisser/plans/2026-04-29-slack-fully-functional.md`
- `zisser/plans/2026-05-04-slack-ux-alignment.md`
- `zisser/plans/2026-05-05-slack-workspace-reorg.md`
- `zisser/plans/2026-05-05-slack-for-effi-app-creation.md`
- `zisser/plans/2026-05-08-doppler-and-slack-ground-down.md`

Dispatched:
- `zisser/dispatched/2026-04-28-slack-ingest-poc.md`
- `zisser/dispatched/2026-04-29-slack-c4-message-ingestion-wes.md` (incl. Wes return rounds 1+2)
- `zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md`
- `zisser/dispatched/2026-05-04-slack-ux-alignment-zisser.md`
- `zisser/dispatched/2026-05-05-slack-arc-close-tikur-and-tests.md`
- `zisser/dispatched/2026-05-05-slack-slice1-modal-from-project-wes.md` (incl. Wes return)

Inbox:
- `zisser/inbox/2026-05-05-oria-slack-dev-channel-probe.md`
- `zisser/inbox/2026-05-05-slack-private-channel-invite-automation.md`

Notes:
- `zisser/notes/2026-05-05-integration-naming-convention.md`

Handoff:
- `zisser/handoff/2026-05-04-brown-oauth-probes.md`
- `zisser/handoff/2026-05-05-uxui-track-probe-reply.md`

Logs:
- `zisser/log/2026-04.md` (slack-relevant entries 2026-04-27 → 2026-04-29)
- `zisser/log/2026-05.md` (2026-05-04 → 2026-05-05 entries)

Research (`usegin/research/slack-integration/`):
- `SYNTHESIS.md`, `recommendation.md`, `CLOSE.md`, `RESUME.md`,
  `DEMO.md`, `c4-spec.md`, `FOR-TOM.md` (referenced)
- `customer-channel-binding/whiteboard.md` (C)
- `slack-direct-platform/whiteboard.md` (B)
- `usegin-slack-team/whiteboard.md` (D)
- `auth-identity-cardinality/whiteboard.md` (H)
- `askeffi-slack-team-relation/whiteboard.md` (E — collapsed into C)

Marketplace (`usegin/research/slack-marketplace/`):
- `listing-draft.md`, `submission-checklist.md` (referenced
  `review-blockers.md`, `security-questionnaire.md`)

Zettels:
- `z089-first-integration-to-hold-raw-oauth-tokens-no-encryption-hel.md`
- `z096-autosync-mode-1-cluster-of-collisions-during-parallel-rd-slack.md`
- `z116-bag-of-files-cluster-of-three-team-converged-three-times-on.md`

Parallel POC (out-of-tree reference):
- `oria-crazy-world/ground/oria-crazy-space/slack-ingest-poc/README.md`
  — overnight 2026-04-28 → 04-29 parallel-JSONL POC; 33/33 tests; not
  production. End-to-end shape proven; production swap is one-step
  once approved.
