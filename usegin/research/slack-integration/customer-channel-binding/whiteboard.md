# Whiteboard — angle C: customer-channel-binding

## Top — the click

**Read-only first. Per-message data items, not a per-channel rollup. One Slack-workspace connection at the AskEffi-workspace level, one channel→project binding at the project level. External-tier sees nothing from Slack until per-message labeling exists — Slack is internal-only at MVP.**

The single hardest decision: *what is the unit of ingestion?* If we pick "the channel" as the unit, RLS, citations, freshness, and access-tier all collapse onto a single moving artifact and we need rollup logic, dedupe windows, and "which version did Effi cite?" answers. If we pick "the message (or thread-as-message-bundle)" as the unit, we get one `data_items` row per addressable thing — clean citations ("[#proj-acme, 2026-04-22 14:03 from @oria]"), clean RLS, clean per-item access_level, and the ingestion shape mirrors `meetings` + `meeting_participants` almost 1:1. Per-message wins. The cost is volume — a busy channel produces 100s of items/day vs Drive's 10s of files/year — and that's the real risk to flag, not the schema.

The second-hardest is **read-only vs bidirectional**. Slack culturally invites bidirectional ("@Effi what did we decide on the redesign?") — but bidirectional forces us into Slack-app-distribution-review purgatory (scope `chat:write`, `app_mentions:read`, slash commands), and conflates the customer-channel surface with the team-bot surface (angles D/E). MVP ships read-only. Bidirectional is a separate product surface that probably belongs in angle D (UseGin-Slack) first, then graduates here.

## Middle — the body

### Existing-pattern shape (what we copy)

The codebase has a crisp, repeated shape across Drive / SharePoint / Fathom / Linear / Email. Slack should slot into the same mold — diverge only where the medium forces it.

| Concern | Pattern |
|---|---|
| Connection table | `<provider>_connections` — one active per project (or per project+provider for meetings), `unified_connection_id`, `status`, `disconnected_at` (soft delete), `last_sync_at`. RLS gated by `is_project_owner()`. |
| Scope/sub-selection table | `<provider>_*_scopes` — chosen sub-resources under a connection (Linear projects, SharePoint drives/folders). Soft-deleted via `removed_at`. |
| Content table | Provider-specific entity table (`meetings`, `sharepoint_files`) carrying medium-native fields (date, speakers, summary, mime). |
| Universal pivot | Every content row has a `data_item_id` FK to the universal `data_items` table. `data_items` owns `status` (`pending/active/excluded/deleted`), `access_level` (`internal/external`), `title`, `entity_type`. |
| UX shape | Card on `/projects/[projectId]/config` Integrations tab → "Connect" button → OAuth bounce → callback returns to `?<provider>=connected#integrations` → auto-opens config modal → user picks scope → save. Disconnect from inside the modal. |
| Sync status surface | `connection-status-badge.tsx`, `sync-status-module.tsx` already generic — reusable. |

This pattern is so well-trodden that **the work for Slack is mostly schema + connector + ingest worker, not UX invention**. The integrations tab grid grows by one card.

### UX flow (admin-side, MVP)

1. Workspace admin lands on `/projects/[projectId]/config` → Integrations tab.
2. Sees "Slack" card with `Connect` button. (Source-of-truth icon + description: "Connect a Slack channel to ingest messages for AI search.")
3. Click → `connectSlackAction(projectId)` server action returns OAuth URL → redirect to Slack OAuth (or Unified.to depending on angle A's verdict).
4. OAuth callback lands at `?slack=connected#integrations` → auto-opens `SlackConfigModal`.
5. **Modal step 1 — workspace check**: shows "Connected to `Acme Corp` Slack workspace" (read-only display).
6. **Modal step 2 — channel picker**: lists channels visible to the bot (`channels.list` with `types=public_channel,private_channel`). Includes search filter (workspaces have 100s of channels). Each row shows channel name, member count, last activity, lock icon if private.
7. User picks **exactly one** channel. (Charter says 1:1.) Save → writes `slack_connections` + `slack_channel_binding`.
8. **Backfill prompt**: "Backfill last [30 / 90 / all] days?" — defaulted to 30, with "this will create N data items" preview. Confirm → background job kicks off.
9. Returns to integrations tab, card now shows "Connected — #proj-acme · syncing 247/3140 messages" via the existing `SyncStatusModule`.

### DB schema sketch

```sql
-- 1. slack_connections — one per (workspace, slack_team_id)
-- (Note: connection lives at AskEffi-workspace level, NOT project level —
-- diverges from Drive/Linear because one Slack workspace OAuth covers many
-- channels which can each bind to different AskEffi projects.)
CREATE TABLE slack_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    slack_team_id TEXT NOT NULL,             -- Slack's T0123ABCD
    slack_team_name TEXT NOT NULL,
    unified_connection_id TEXT,              -- if Unified.to path
    bot_user_id TEXT NOT NULL,
    bot_token_secret_ref TEXT NOT NULL,      -- pointer into Supabase Vault, NOT raw token
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disconnecting', 'error', 'token_revoked')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX slack_connections_active_idx
    ON slack_connections (workspace_id, slack_team_id)
    WHERE disconnected_at IS NULL;

-- 2. slack_channel_bindings — 1 channel ↔ 1 project (the click of this angle)
CREATE TABLE slack_channel_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slack_channel_id TEXT NOT NULL,           -- C0123ABCD
    slack_channel_name TEXT NOT NULL,         -- denormalized, refreshed on rename
    is_private BOOLEAN NOT NULL DEFAULT false,
    backfill_window_days INTEGER,             -- NULL = unlimited
    backfill_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (backfill_status IN ('pending', 'running', 'complete', 'failed')),
    last_synced_message_ts TEXT,              -- Slack's "ts" cursor for incremental
    archived_at TIMESTAMPTZ,                  -- mirrors Slack channel archived state
    removed_at TIMESTAMPTZ                    -- user-initiated unbind (soft delete)
);
CREATE UNIQUE INDEX slack_channel_bindings_active_channel_idx
    ON slack_channel_bindings (connection_id, slack_channel_id)
    WHERE removed_at IS NULL;
-- Charter says 1 channel ↔ 1 project: also enforce reverse direction.
CREATE UNIQUE INDEX slack_channel_bindings_active_project_idx
    ON slack_channel_bindings (project_id)
    WHERE removed_at IS NULL;

-- 3. slack_messages — one row per message, cited 1:1 by data_items
CREATE TABLE slack_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binding_id UUID NOT NULL REFERENCES slack_channel_bindings(id) ON DELETE CASCADE,
    data_item_id UUID REFERENCES data_items(id),  -- born-together pattern
    slack_ts TEXT NOT NULL,                       -- "1714155600.123456" — Slack's PK
    thread_ts TEXT,                               -- parent if this is a reply
    slack_user_id TEXT NOT NULL,
    user_display_name TEXT,
    user_email TEXT,                              -- if bot has users:read.email
    is_bot BOOLEAN NOT NULL DEFAULT false,
    text TEXT NOT NULL,                           -- raw Slack mrkdwn
    rendered_text TEXT,                           -- mrkdwn → plain for indexing
    has_attachments BOOLEAN NOT NULL DEFAULT false,
    attachment_count INTEGER NOT NULL DEFAULT 0,
    edited_at TIMESTAMPTZ,
    deleted_in_slack BOOLEAN NOT NULL DEFAULT false,
    posted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX slack_messages_binding_ts_idx
    ON slack_messages (binding_id, slack_ts);
CREATE INDEX slack_messages_thread_idx
    ON slack_messages (binding_id, thread_ts) WHERE thread_ts IS NOT NULL;

-- 4. slack_message_files — file attachments (image/pdf/snippets) become their
--    own data_items via the existing file pipeline; we cross-link.
CREATE TABLE slack_message_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES slack_messages(id) ON DELETE CASCADE,
    data_item_id UUID REFERENCES data_items(id),
    slack_file_id TEXT NOT NULL,
    mime_type TEXT,
    file_name TEXT,
    size_bytes BIGINT,
    fetched_at TIMESTAMPTZ
);
```

RLS: same shape as `meetings` — `is_project_owner(project_id, auth.uid())` via the binding → connection lookup.

### Data-item granularity decision (per-message vs per-thread vs per-channel)

| Unit | Pros | Cons | Verdict |
|---|---|---|---|
| Per-channel rollup | 1 data_item; small index footprint | citations are useless ("Effi cited #proj-acme"), no per-message access tier, every new message rewrites the rollup → cache thrash | NO |
| Per-thread bundle | Citations meaningful at thread level; matches conversation grain | a 200-reply thread = one giant data_item; updates re-extract entire thread; access-tier per-thread loses per-reply nuance | maybe v2 |
| Per-message | 1:1 citation; per-message access_level (future); incremental sync trivial; matches meetings shape | high item count; thread context split across rows; embedding model needs windowing | **YES (MVP)** |

Mitigation for per-message granularity: **at retrieval time**, bundle thread siblings. Slack's `thread_ts` makes this cheap — one extra query at search-time, no schema cost. Effi's prompt shape stays "given these N messages with surrounding thread context, answer X."

### Backfill strategy

Mirrors meetings/SharePoint:
1. User picks a window (30d default; 90d / unlimited as options).
2. Background worker pages through `conversations.history` with `oldest=<window>` and `cursor`.
3. For each message: insert `slack_messages` + create `data_items` with `status='pending'` (born-together pattern, see migration `20260410133824_born_together_create_sharepoint_file_with_data_item.sql`).
4. Resolve user IDs in batch via `users.info` cache.
5. Resolve attachments → kick off file-fetch jobs (which use existing file ingest pipeline).
6. Promote `data_items.status` to `active` once text is extracted/indexed.
7. Update `slack_channel_bindings.backfill_status='complete'` and persist `last_synced_message_ts`.

Forward sync runs via Events API webhook (`message`, `message.changed`, `message.deleted`, `channel_archive`, `channel_rename`) — same job lane.

**Non-LLM extraction**: Slack message text is already structured (mrkdwn). Apply the email-splitter precedent — regex-only normalization (mrkdwn → plain, user-mention resolution, URL extraction). No LLM in the ingest path. LLM stays at the chat-time retrieval layer.

### Lifecycle table

| Slack-side event | Detection | Effi-side response |
|---|---|---|
| Channel renamed | `channel_rename` Events API | Update `slack_channel_bindings.slack_channel_name`; data_items unaffected (FK-stable). User sees new name on next page load. |
| Channel archived | `channel_archive` event | Set `slack_channel_bindings.archived_at`; halt forward sync; existing data_items remain searchable; integration card shows "Channel archived — search-only". |
| Channel unarchived | `channel_unarchive` | Clear `archived_at`; resume forward sync from `last_synced_message_ts`. |
| Channel deleted | not directly emitted; detected via `channels.info` 404 | Soft-delete binding; mark data_items `excluded` (user can choose to fully delete in modal). Same pattern as Fathom disconnect (see migration `20260420111858_fix_c1_meeting_branch_gate_on_disconnect.sql`). |
| Bot kicked from channel | `channel_left` (bot's POV) or `not_in_channel` from API | Set `status='error'` on connection (or just on binding); show "Effi was removed from #channel — re-add or unbind"; pause sync. |
| Workspace OAuth revoked | `tokens_revoked` Events API or 401 from API | `slack_connections.status='token_revoked'`; ALL bindings under it pause; admin sees "Reconnect Slack" CTA. |
| Workspace deleted/Slack plan downgrade | repeated 401s | Same as revoked; eventually mark `disconnected_at`. |
| Message edited in Slack | `message.changed` | Update `slack_messages.text`, set `edited_at`, re-index data_item (reuses existing `data_items.status='pending'` re-promotion path). |
| Message deleted in Slack | `message.deleted` | Set `slack_messages.deleted_in_slack=true`; cascade `data_items.status='deleted'` + VAIS purge. **Compliance-relevant** — must respect deletes. |
| User account deactivated | `user_change` with `deleted=true` | Keep messages, but flag `slack_messages.user_email` as historical; surface as "[deactivated user]" in citations. |
| Workspace renames itself | implicit via OAuth refresh | Update `slack_connections.slack_team_name`. |

### RLS / access tier

Default at MVP: **all Slack data_items are `access_level='internal'`**. Slack channels (especially private ones) almost always contain internal-team chatter; assuming external-tier blanket access is a leak risk. External-tier users see zero Slack content until either:
- a per-message labeling mechanism exists (future), or
- a per-channel default override ("this channel is client-shared, default external") is added to `slack_channel_bindings` — feasible, but a v2 surface.

The schema supports future per-message override (data_items.access_level is already per-row); the click is just *MVP defaults to internal*, not "schema can't express external."

This matches the meetings access-tier default ('internal') — same posture.

### Diff vs Drive / SharePoint / Fathom / Linear

| Aspect | Drive | SharePoint | Fathom (meetings) | Linear | **Slack** |
|---|---|---|---|---|---|
| Connection scope | per-project | per-project | per-(project, provider) | per-project | **per-workspace** (one OAuth covers many channels across projects) |
| OAuth grain | one Google account | one M365 tenant | one provider per project | one Linear workspace | one Slack workspace |
| Sub-selection | folder picker | drive/folder tree | rule-based meeting matcher | team/project checkboxes | **single channel picker (1:1)** |
| Cardinality of sub-scopes | many folders | many drives × folders | many meetings (auto-classified) | many teams + projects | **exactly one channel per project** |
| Content unit | file | file | meeting (single artifact) | issue (single artifact) | **message** (high-volume stream) |
| Volume per scope | low (10s–100s) | medium | low (10s–100s) | medium (100s) | **high (1000s+)** |
| Real-time updates | polling | webhooks | webhooks via Unified | polling | **events API webhooks** |
| Native deletes | trash → cleanup | recycle bin | rare | archive | **immediate hard-delete in source — must respect** |
| Privacy granularity | folder-level | folder-level | meeting-level | project-level | **channel-level + message-level potential** |
| Bidirectional | no | no | no | future-maybe | **strongly tempting but defer** |

The two real divergences: (1) **connection lives at workspace, binding lives at project** — splits what other integrations conflate; (2) **content volume + real-time + native deletes** — forces stricter event-handling discipline than any prior integration.

### Cardinality clarification (interlock with angle H)

The 1:1 channel↔project rule is the customer-facing covenant. The model accommodates:
- 1 Slack workspace → N AskEffi projects (via 1 connection, N bindings).
- 1 AskEffi workspace → N Slack workspaces (multiple `slack_connections` rows under same AskEffi workspace) — needed for agencies with multi-tenant Slacks.
- **Forbidden**: 1 channel → N projects (enforced by `slack_channel_bindings_active_project_idx`). This avoids the Fathom per-recorder gotcha translated to channels — if a channel could fan out to multiple projects, we'd lose RLS clarity and double-index every message.
- **Forbidden**: N channels → 1 project (also enforced by the partial unique index above). If a project needs many channels, that's a v2 ask; MVP forbids it for crispness. *(See dilemma D2 below — this is the one place the "1:1 covenant" might bend.)*

## Bottom — the open ends

### Dilemma D1 — Read-only vs bidirectional

**Decision needed:** Does the customer-channel surface include `@Effi` mentions and slash commands at MVP, or is it strictly ingest?

**Options:**
1. **Read-only ingest only.** Slack is a data source, full stop. Users ask Effi via the Effi web UI.
2. **Bidirectional from day 1.** `@Effi what did we decide on the redesign?` posts a reply in-channel.
3. **Read-only here; bidirectional in angle D (UseGin-Slack) first.** Treat the team-bot surface as a separate product.

**Lean: 3.**

**Why:** Bidirectional in a customer Slack means we ship a public Slack app, request `chat:write` + `app_mentions:read` + `commands` scopes, pass Slack's app-review for distribution, and figure out billing for "chat-with-Effi-from-Slack." That's a 4-6-week diversion from "ingest works." Doing it first in our own team's Slack (angle D) lets us harden the bot UX with no app-review pressure and no customer-tenant blast radius. Customer-facing bidirectional graduates from there.

**Price:** Customers will ask "can I just ask Effi in Slack?" on day one. Honest answer: "v2, after we dogfood it ourselves." That's a known cost.

**Risk if wrong:** Competitive pressure from Glean/etc. who do bidirectional in Slack natively. Mitigation: angle G should size this risk.

### Dilemma D2 — 1:1 channel↔project, or many-to-one?

**Decision needed:** Do we genuinely enforce one-channel-per-project, or allow a project to bind multiple channels?

**Options:**
1. **Strict 1:1** (charter's stated rule).
2. **N channels → 1 project**, e.g., a project bound to `#proj-acme-eng`, `#proj-acme-design`, `#proj-acme-pm`.
3. **Pattern-bind**: project binds to `#proj-acme-*` (glob), channels auto-attach as they're created.

**Lean: 1 for MVP, 2 as fast-follow.**

**Why:** Real customer projects span ≥3 channels in active engagements (eng / design / PM split). The 1:1 rule is clean for MVP UX but will break against reality fast. The schema above (binding has its own table; project_id unique partial index can be dropped) is forward-compatible — moving from 1:1 to N:1 is a one-migration change.

**Price of strict 1:1:** Customers create "umbrella" channels just to bind to Effi, distorting their Slack hygiene. Or they pick the wrong channel and don't notice they're missing data.

**Risk:** If we ship 1:1 and never relax, we leak data-blindness into the product. Concrete trigger to upgrade: ≥30% of customers ask "can I add a second channel" in the first month → ship N:1.

### Dilemma D3 — Per-message data_item vs per-thread

Already argued in the Middle section. Logging here as an explicit dilemma so the synthesis can treat it as a decision Lihu needs to weigh, not a quiet author's choice. The cost of being wrong on this is high — re-shaping data_items for Slack mid-flight cascades through retrieval, citations, and access-tier code.

**Lean: per-message** (per Middle).

### Gaps / open questions for other angles to resolve

- **Angle A (Unified.to)**: Does Unified.to's Slack connector deliver Events API streaming, or only history-pull? If only history, our forward-sync UX has a polling-lag floor that must be communicated.
- **Angle B (direct Slack)**: Confirm that `users:read.email` is grantable in customer-installed Slack apps without enterprise-grid friction; we rely on it for citation legibility.
- **Angle G (risks)**: Slack rate limit tiers (Tier 2 for `conversations.history` is 50 reqs/min). A 5000-message backfill at 50/min × 1000-msg-per-page → 100 reqs → ~2min, fine. But N customers backfilling concurrently against shared rate limits = real risk.
- **Angle H (auth/identity)**: How does Slack-user-ID ↔ AskEffi-user-ID resolution work? Citations reading "@U0123" is bad UX; we want "@oria". Need a per-workspace user-mapping cache. Email match is the cheap path but requires `users:read.email` scope.
- **Compliance**: Slack message retention can be set to 1 day at the customer's discretion. If they delete + we kept a copy, *we now hold data they consider ephemeral*. Need an explicit `respect_slack_retention` toggle on the binding, or a contractual stance.

### Friction zettels captured

None this session. Notable would-be candidates skipped because they're already encoded:
- The "connection at workspace, sub-scope at project" split echoes the org→workspace migration memory; not novel friction.
- The per-message granularity choice echoes meetings/SharePoint precedent; not novel.

If during build we hit a real surprise (e.g., Slack's API doesn't expose what the schema needs), capture then.

### Things to NOT do (anti-decisions worth naming)

- Do **not** put the channel-picker as "comma-separated channel names in a textarea." (Tempting MVP shortcut. Breaks on rename, on re-binds, on permissions discovery.)
- Do **not** ingest DMs or group DMs at MVP, even if technically scoped. Different consent model, different RLS shape, different angle entirely.
- Do **not** use LLM for message extraction (per email-splitter precedent). Mrkdwn → plain is regex.
- Do **not** auto-bind newly-created channels matching a pattern at MVP (D2 option 3). Surprising behavior; opt-in only.
- Do **not** store raw bot tokens in `slack_connections` — vault reference only. (Same posture as we should have for all OAuth tokens; if we don't, that's its own zettel.)
