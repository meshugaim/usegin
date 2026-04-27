# AskEffi-Slack — Marketplace Listing Draft

**Linear:** ENG-5414. **Inputs:** SYNTHESIS R4 (Marketplace critical-path), C1's
`nextjs-app/app/api/slack/callback/route.ts` (actual scope set), Slack
Marketplace requirements (api.slack.com/slack-marketplace, fetched
2026-04-27).

This is a **draft** — every value below is a Lihu-pass-and-edit field. Where a
field requires a human-only artifact (icon, screenshot, video, support email
wiring, privacy/terms URL), it's marked `[LIHU]` and listed in
`submission-checklist.md`.

---

## App identity

| Field | Value | Notes |
|---|---|---|
| App name | **AskEffi for Slack** | Slack convention is `<Service> for Slack`. Searchable, distinguishes from "Effi", matches `app_id` registered in C1. |
| Short description (≤10 words) | "Search and analyze your team's Slack conversations with AI." | 9 words. Other candidate: "Bring Effi's AI-search to your Slack workspaces." |
| Pricing model | **Free and paid plans** | Pilot users free; paid tier post-GA. Confirm with Lihu. |
| Primary category | **Productivity** (secondary: Analytics) | Slack lists these as standard taxonomy. |
| Support email | `support@askeffi.ai` | `[LIHU]` confirm or set up alias. |
| Privacy policy URL | `https://askeffi.ai/privacy` | `[LIHU]` confirm live, covers Slack data per Marketplace requirements (see review-blockers §B5). |
| Terms of service URL | `https://askeffi.ai/terms` | `[LIHU]` confirm live. |
| Landing page | `https://askeffi.ai/integrations/slack` | `[LIHU]` page must exist + work at review time (review-blockers §B11). |

---

## Long description (draft, markdown — Slack accepts standard markdown + emoji)

> **AskEffi brings AI-powered search and synthesis to your Slack
> conversations.**
>
> Connect AskEffi to a Slack channel, and your team can ask Effi questions
> across everything that's been said there — past decisions, open questions,
> who said what about which customer. Effi grounds its answers in actual
> messages, with citations back to the original Slack thread.
>
> ### What you get
>
> - **Conversational search across channels.** Ask "what did we decide about
>   the Q3 roadmap?" — Effi pulls the relevant threads, summarizes the
>   discussion, and links to the source messages.
> - **Per-project bindings.** Map specific channels to specific AskEffi
>   projects. Each project sees only the channels it's bound to.
> - **Read-only, by design.** Effi reads what your team writes. It does not
>   post messages, react, or modify anything in Slack at MVP. (Bidirectional
>   support is a v2 surface — see roadmap.)
> - **Honest history window.** Effi indexes new messages in real time via
>   Events API and backfills up to 90 days of recent history at connection
>   time. We don't promise we have data we don't.
>
> ### What's in scope
>
> - Public channels (`channels:*`) and private channels you explicitly invite
>   the bot to (`groups:*`).
> - Workspace member directory (display names, profile photos for
>   message-attribution UI).
>
> ### What's out of scope
>
> - DMs and group DMs. Effi does not read direct messages.
> - File contents (attachments are referenced by URL, not downloaded into the
>   index — file ingestion is a separate consent flow).
> - Posting messages, reactions, or any write action.
> - Slack Connect / shared-channel external-user data (we surface external
>   users as opaque IDs, no profile lookup across workspaces).
>
> ### Privacy & security
>
> AskEffi runs on SOC 2 Type II-certified infrastructure (Supabase, Railway,
> Anthropic, Google Cloud). Slack tokens are stored encrypted at rest. All
> data is tenant-isolated via Postgres Row-Level Security enforced at the
> database layer. See askeffi.ai/security for the full posture.
>
> ### Disconnecting
>
> Disconnect the integration from your AskEffi workspace settings or by
> removing the app from your Slack workspace. Either action immediately
> revokes the bot token, stops ingestion, and queues deletion of all indexed
> messages from that workspace.

---

## Scope-justification table

The scope set below matches `oauth.v2.access` consent in C1's callback +
SYNTHESIS CF1 (no `commands` at MVP per R2 lean (c) — read-only, bidirectional
graduates from D). **Lihu: confirm the final set against the registered Slack
app's manifest before submitting.**

| Scope | Type | Why we need it | Least-privilege check |
|---|---|---|---|
| `channels:read` | Bot | Discover and present public channels in the AskEffi channel-picker UI so admins can choose which to bind to a project. Enumerate channel metadata (id, name, archived, is_general) for the lifecycle handlers (rename / archive). | Cannot use a narrower scope; channel listing requires this. We do **not** request `channels:join` — bot is invited by the user, not self-joining. |
| `channels:history` | Bot | The core feature: read messages in public channels the user has explicitly bound to an AskEffi project, so Effi can answer questions grounded in those messages with citations. | Used **only** for bound channels. We don't fan out to all public channels. Per R5, real-time via Events; bounded 90-day backfill on connect. |
| `groups:read` | Bot | Same as `channels:read` for **private channels the bot has been explicitly invited to**. Without this, admins can't bind private channels they care about (HR-internal, exec, etc.). | Bot only sees private channels a workspace member explicitly invites it into. Slack's invite flow is the consent gate. |
| `groups:history` | Bot | Read messages in private channels the bot is invited to and that an admin has bound to a project. Same product surface as `channels:history`, restricted to invited private channels. | Bot has no way to enumerate private channels it isn't in. Double consent: invite + bind. |
| `users:read` | Bot | Resolve message-author IDs (`U…`) to display names and avatars for the citation UI ("said by @alice in #project-acme"). Also needed for `app_uninstalled` / `tokens_revoked` lifecycle handler to identify who did the revocation. | We do **not** request `users:read.email`. Display name + avatar URL is the minimum that makes citations human-readable. |
| `team:read` | Bot | Identify the workspace (team) the install belongs to (`team_id`, `team_name`, `team_domain`) for the `slack_installs` row and admin UI labeling ("Connected to: Acme Corp Slack"). | Smallest scope that yields workspace identity. Returned in `oauth.v2.access` payload regardless; this scope makes follow-up `team.info` calls available for refresh. |

### Scopes deliberately **not** requested at MVP

| Scope | Why skipped (R2/R3 alignment) |
|---|---|
| `commands` | R2 lean (c): bidirectional ships via UseGin-Slack (D, separate app) first. AskEffi-Slack is read-only at MVP. Re-request when bidirectional graduates. |
| `chat:write` | Same — read-only. |
| `app_mentions:read` | Same — no `@AskEffi` surface in customer Slack at MVP. |
| `reactions:read` | Captured in raw payload via Events API; not used for retrieval at MVP. Add when "reactions as signal" lands. |
| `im:*`, `mpim:*` | DMs explicitly out of scope per long description. |
| `files:read` | File ingestion is a separate consent surface; deferred. |
| `users:read.email` | Not needed — display names + IDs suffice for citations. Adding email triggers extra reviewer scrutiny. |
| `admin.*`, `identity.*`, `search:read` | Restricted by Slack and not needed. |

---

## Permission-modal copy (what users see at install)

Slack auto-generates the modal from the scope list above. The string surfaced
to users is roughly:

> **AskEffi for Slack would like to:**
> - View basic information about public channels in your workspace
> - View messages and other content in public channels that AskEffi has been added to
> - View basic information about private channels that AskEffi has been added to
> - View messages and other content in private channels that AskEffi has been added to
> - View people in your workspace
> - View information about your workspace

Lihu: review the rendered modal in the Slack app config UI before submission.
Slack edits these strings periodically — what's documented here is the shape,
not the exact wording.

### Custom install-success copy (in AskEffi UI, post-callback redirect)

C1's callback redirects to `/workspace/<id>/settings?slack=connected`.
Suggested toast/banner copy on landing:

> **AskEffi connected to <team_name>.** We're indexing the channels you bind
> below. New messages appear immediately; up to 90 days of history backfills
> over the next few hours.

Error reasons C1 emits and matching user copy:

| `?slack=error&reason=` | User-facing message |
|---|---|
| `user_declined` | "Slack connection cancelled. You can try again any time." |
| `invalid_state` | "Slack connection expired. Please start the flow again from this page." |
| `access_denied` | "You don't have access to this AskEffi workspace." |
| `not_configured` | "Slack integration isn't configured for this environment. Contact support." |
| `exchange_failed` | "Slack didn't accept the authorization. Please try again." |
| `already_bound` | "This Slack workspace is already connected to a different AskEffi tenant. Contact support if this is unexpected." |
| `internal` | "Something went wrong on our end. Please retry; we've logged the failure." |

---

## Feature-list bullets (Marketplace card body)

For the Marketplace card "Features" section (Slack accepts ~6 short bullets):

- **Channel-grounded AI search** — ask Effi questions, get answers with Slack-thread citations.
- **Per-project channel bindings** — map channels to AskEffi projects with strict tenant isolation.
- **Real-time + 90-day backfill** — new messages indexed via Events API; recent history backfilled on connect.
- **Invite-only private channels** — Effi reads private channels only when explicitly invited and bound.
- **Read-only by design** — no posting, no reactions, no Slack-side modifications at MVP.
- **One-click disconnect** — revoke from AskEffi or Slack; tokens revoked and indexed messages purged.

---

## App icon, screenshots, video — `[LIHU]`

These are human-only artifacts; flagged in `submission-checklist.md`:
- App icon (1600×1000, .png/.jpg, ≤21MB)
- 3–6 screenshots showing AskEffi-in-Slack (channel picker, citation in
  Effi's answer linking to a Slack message, disconnect flow, error toast)
- 30–90 sec demo video on YouTube, captions on, ads off

Demo-video script outline (for Marketing/Lihu):
1. Admin clicks "Connect Slack" in AskEffi workspace settings (5s)
2. Slack consent modal renders, scopes visible (5s)
3. Redirect back to AskEffi → "Connected to <team>" banner (5s)
4. Admin opens project, picks channel from list, clicks "Bind" (10s)
5. User asks Effi "what did we decide about X?" — answer appears with a
   citation linking to the Slack thread (15s)
6. Click citation → opens the Slack message in-context (10s)
7. Admin disconnects → message reads "All <team> Slack data queued for
   deletion." (5s)

Total: ~55s. Comfortably inside Slack's 30–90s window.

---

## Open questions for Lihu (don't fabricate, ask)

1. **Pricing model confirmation.** "Free and paid plans" assumed; if AskEffi
   itself is currently free-pilot-only, "Free" might be the honest answer at
   submission. Either is changeable post-launch.
2. **Privacy policy coverage.** Does the existing `askeffi.ai/privacy` page
   already enumerate Slack data fields, retention, deletion procedure? Slack
   reviewers will read it. If gaps, legal needs to amend before submit (out
   of scope per ENG-5414 charter — flagged in checklist).
3. **Support contact form vs. email.** Slack accepts either. We default to
   `support@askeffi.ai`; Lihu confirm wired and monitored.
4. **Demo Slack workspace for reviewers.** Slack reviewers expect a working
   demo install. Lihu: confirm we have an isolated reviewer-facing tenant or
   are willing to give them a seat in the team's dogfood workspace.
