# Whiteboard — angle H: auth-identity-cardinality

## Top — the click

**Cardinality call:** 1 AskEffi-workspace ↔ N Slack-workspaces, each Slack install pinned by `(enterprise_id|null, team_id)`. Reverse direction stays 1:1 — one Slack workspace must NOT feed two AskEffi workspaces (lock by unique constraint to prevent data bleed). Storage primary key on the install row is `(askeffi_workspace_id, enterprise_id, team_id)`, NOT `(askeffi_workspace_id)` — same gotcha as Fathom's "one connection per project" bottleneck (`fathom_per_recorder_scoping`), and we name it now so we don't repeat it.

**Token call:** Bot token (`xoxb-`) is the spine. User token (`xoxp-`) is opt-in per feature, only when we need post-as-user (e.g. Gin DM-on-behalf-of-human). Customer-facing channel-binding (angle C) is bot-token-only. UseGin-Slack (angle D) is bot-token-only on the team's own workspace; Gin-as-bot has its own identity, never piggybacks on a human's xoxp.

**Fathom-analog verdict — DOES NOT reproduce.** Fathom's gotcha is per-user-recorder scope on a single OAuth — there's no team token. Slack's bot token is workspace-scoped, sees every channel it's invited to regardless of who installed it, and a re-install by a second admin doesn't fragment coverage. The Slack analog of the Fathom gotcha would only appear if we (mis)designed around xoxp user tokens — which is exactly why the default is xoxb. **Different gotcha lurks instead:** multi-Slack-workspace teams (prod-Slack + dev-Slack, or post-acquisition double-Slack) need N install rows under one AskEffi workspace, and our schema must accept that on day one or we'll re-live the `meeting_connection`-per-project pain on Slack.

## Middle — the body

### OAuth v2 install flow (verified against `docs.slack.dev/authentication/installing-with-oauth`)

`oauth.v2.access` returns:
- `access_token` — bot token, prefix `xoxb-`, scoped to **one workspace** (= one `team.id`)
- `authed_user.access_token` — user token, prefix `xoxp-`, scoped to the installing user, only present if `user_scope` was requested
- `team.id` — workspace ID (always present)
- `enterprise.id` — Enterprise Grid org ID (present iff installed inside a Grid org)
- `bot_user_id`, `app_id`, `scope`, etc.

Each install = one row. Re-install by the same user with new scopes: **scopes are additive**, token is replaced, same `(team_id, app_id)` row. Re-install by a different admin in the same workspace: same install row updated, not duplicated — `team_id` is the natural key.

### Token type matrix

| Capability | xoxb (bot) | xoxp (user) |
|---|---|---|
| Read channels bot is invited to | Yes | Limited to user's membership |
| Post as the app | Yes | No |
| Post as a human | No | Yes (as that human) |
| Survives the human leaving the workspace | Yes | No (token revoked) |
| One per workspace | One per app per workspace | One per (user, workspace) |
| Customer-facing channel-binding (angle C) | Sufficient | Not needed |
| UseGin-Slack team R/W (angle D) | Sufficient | Only for "DM as me" features |

Default = xoxb. Add xoxp only behind an explicit feature gate where post-as-user is the product requirement. The Fathom gotcha is precisely the trap of making xoxp the spine — don't.

### AskEffi-side mapping (post org→workspace migration)

Schema state on main (verified `supabase/migrations/`): `organizations` and `organization_members` were dropped 2026-04-16 (`20260416220350_drop_organizations_and_organization_members.sql`). `workspaces` + `workspace_members` is the live tenant boundary. Per `project_org_to_workspace_migration` memory: design Slack ownership against workspace, full stop.

Proposed install table shape (for angle C/E to spec, not for me to land):

```sql
slack_installs (
  id uuid pk,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slack_team_id text not null,           -- T0123ABCD
  slack_enterprise_id text,              -- E0XYZ... or null
  bot_token_encrypted text not null,
  bot_user_id text not null,
  installed_by_user_id uuid references auth.users(id),  -- audit, not auth
  installed_at timestamptz not null default now(),
  scopes text[] not null,
  unique (slack_enterprise_id, slack_team_id),  -- prevent two Effi-WS owning one Slack-WS
  unique (workspace_id, slack_enterprise_id, slack_team_id)
)
```

Key properties:
- `unique (enterprise_id, team_id)` is the cross-tenant guard. Without it, two AskEffi workspaces could both bind the same Slack workspace and step on each other's channel-binding state.
- No `unique (workspace_id)` — one AskEffi WS deliberately CAN have N Slack installs (multi-Slack teams).
- `installed_by_user_id` is audit metadata, NOT the trust principal. Bot token survives that user being deactivated.
- RLS: scope by `workspace_id` (workspace-owner read, workspace-member read-public-fields, no-org-tier).

Per-user xoxp tokens, if/when they exist, go in a sibling table `slack_user_tokens (workspace_id, slack_team_id, askeffi_user_id, slack_user_id, user_token_encrypted, scopes)` with composite uniqueness — never collapsed into the install row.

### Multi-workspace edge cases (from Slack-side docs)

1. **Same human installs into two Slack workspaces.** Two separate `(team_id, token)` records on Slack's side. Our side: two `slack_installs` rows under the same `askeffi_workspace_id`. No conflict; this is the normal case for cross-Slack teams.
2. **Enterprise Grid org-wide install.** Slack returns `enterprise.id` plus a token that "can represent installations in many workspaces" — bot token call requires `team_id` to scope. Storage: one row keyed by `(enterprise_id, team_id=null|"all")` semantically representing the org install, with per-workspace context resolved at call time. Decide later (angle B/C) whether we model the org install as one row + a workspace dimension on every API call, or as N rows expanded out at install time. Lean toward the explicit-N-rows model for query simplicity.
3. **Slack Connect / shared channels.** Per Slack's Enterprise Grid docs: "Your odds of encountering a Slack Connect channel are high." A channel shared between Workspace A (where we're installed) and Workspace B (where we're not) — our bot in A sees messages posted from A's side and from B's users insofar as they appear in the shared channel, BUT users from B carry foreign user IDs (`U` from B's namespace) that won't resolve via our A-token's `users.info`. Implication for ingestion (hand-off to angle C): authors of cross-workspace messages need a stub-user model, not "fail to lookup."
4. **Workspace rename.** `team_id` is stable across rename — install row is unaffected. Fetch display name on-demand or cache with TTL.
5. **App uninstalled by Slack admin.** `tokens_revoked` event fires; install row should be soft-marked `revoked_at`, not deleted (audit + reinstall idempotency).

### UseGin-Slack identity (intersection with angle D, my answer)

UseGin-Slack and customer-facing AskEffi-Slack are **separate Slack apps**, even though both are owned by us. Reasoning:
- Different scope surface. UseGin-Slack on the dev team's workspace wants reads/writes that customer apps don't (e.g. cross-channel R/W to mediate Linear-style coordination). Customer apps want minimum-scope-of-trust.
- Different identity in Slack UI. Gin should appear as "Gin" with its own avatar/handle on the team's Slack; the customer-facing app appears as "Effi" or "AskEffi" on the customer's Slack.
- Different OAuth client_id, different review track on Slack's app marketplace, different rotation policy.
- Same code path can power both bots (one Bolt app, two manifests + two sets of credentials).

The team's own AskEffi tenant (per angle E) installs both apps: customer-facing AskEffi-Slack for dogfooding the channel-binding product, and UseGin-Slack for Gin-as-mediator. They live in different `slack_installs` rows because they have different `app_id` values — extend the unique constraint to `(enterprise_id, team_id, app_id)` to allow that without ambiguity.

### Token lifecycle / rotation

Slack supports token rotation (`auth.revoke`, refresh-token flow on opt-in apps). For v1 we can ship without rotation (long-lived xoxb), but the `slack_installs` schema should reserve `refresh_token_encrypted` and `expires_at` columns from day one so we don't migrate later. Per `reference_supabase_auth_signing` discipline: don't infer signing/lifetime from token prefix shape — verify against the OAuth response payload at install time and persist.

## Bottom — the open ends (z026-shape dilemmas)

### Dilemma 1 — Enterprise Grid: org-wide install vs explicit N-row expansion

**Decision needed:** When an admin installs into a Grid org with `enterprise.id` set, do we store one row representing the org and resolve `team_id` at call time, or expand into N rows at install time (one per child workspace) and re-sync the row set when workspaces are added/removed from the org?

**Options:** (a) one-org-row, dynamic-team-id — minimal storage, harder queries ("which channels are bound under this org?"); (b) N-rows-at-install — easy queries, but needs `team.list` polling to stay in sync as the org grows.

**Lean:** (b) N-rows. Channel-binding is per-team-per-channel, queries naturally scope by `team_id`, and Grid org churn is rare enough that a daily reconcile-from-`team.list` is fine.

**Price:** extra polling job + reconcile logic; one-time write of expansion code.

**Risk if wrong:** (a) leads to N+1 query patterns and Grid-only edge cases everywhere. (b) leads to drift if reconcile lags — bounded blast radius (a new workspace can't bind channels until next sync) which is acceptable.

**For Lihu to weigh:** is "Grid customers" a v1 target or v2? If v2, ship (a) as a stub and revisit. If v1, do (b) now.

### Dilemma 2 — Reverse-direction lock: hard unique vs soft warning

**Decision needed:** `unique (slack_enterprise_id, slack_team_id)` across the whole `slack_installs` table prevents two AskEffi workspaces from binding the same Slack workspace. Is that the right hard-stop, or should we allow it with a warning (and segregate by channel-binding rules)?

**Options:** (a) hard unique — clean, no data bleed possible, but if a Slack admin installs into the wrong AskEffi workspace by mistake, recovery requires uninstall+reinstall. (b) soft — same Slack-WS can feed two AskEffi-WSes if their channel sets are disjoint; needs runtime guards everywhere.

**Lean:** (a) hard. Cheap recovery path (uninstall in Slack admin, reinstall under correct AskEffi-WS) is fine. The cost of (b) is paid in every channel-binding query.

**Price:** install-flow needs a clear "this Slack workspace is already connected to AskEffi workspace X — disconnect there first" error.

**Risk if wrong:** (a) blocks a real legitimate two-tenant scenario we haven't imagined. (b) we eat correctness bugs forever.

**For Lihu:** any business case where one Slack workspace genuinely should feed two AskEffi tenants? Holding-company / agency models?

### Dilemma 3 — Per-user xoxp: opt-in feature, or never?

**Decision needed:** Do we ever ask for user tokens (`user_scope`)?

**Options:** (a) never — all features bot-token-only, simpler trust model, no Fathom-analog risk; (b) opt-in per feature — if/when a feature genuinely needs post-as-user (e.g. Gin DM-as-Lihu), gate it behind explicit per-user OAuth.

**Lean:** (b) but with a strong default of (a). The bar to introduce xoxp is "this feature CANNOT be done as bot."

**Price:** a second token store, a second OAuth flow, per-user revocation handling.

**Risk if wrong:** (a) blocks features we'll want later (post-as-me threads). (b) opens the Fathom-analog door — discipline needed to keep xoxp opt-in, not creeping into the spine.

**For Lihu:** is "Gin posts as me" a near-term product line, or a fantasy?

### Dilemma 4 — UseGin-Slack as separate app vs shared

**Decision needed:** One Slack app powering both UseGin-Slack (internal Gin mediator) and customer-facing AskEffi-Slack, or two separate apps?

**Lean:** two apps (see Middle § UseGin-Slack identity). Re-using one app would conflate UI identity, scope surface, and review tracks.

**For Lihu:** confirm. If two apps, we need two app_ids in env from day one.

### Open end — Slack Connect cross-workspace user identity

Foreign-workspace user IDs in shared channels are unresolvable via our local token. Hand-off to angle C: ingestion needs a `slack_external_user` stub model, not a hard FK to a fully-resolved profile. Flagging here, not solving.
