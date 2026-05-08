---
date: 2026-05-08
authored_by: outsider sub-agent (cold context, no team history)
reads: zisser/dispatched/2026-05-08-slack-history-out.md, zisser/dispatched/2026-05-08-slack-state-out.md
mode: read-only — no commits, single output file
---

# Outsider read on Slack — where the gap is and the smallest path across it

## 1. The picture in plain words

**(a) What the customer-facing feature is trying to do.** A customer of
Effi (the AI-answer product) clicks a "Connect Slack" button inside Effi.
Their browser bounces to Slack, they log in, they approve some
permissions, and they come back to Effi. Then they pick which of their
Slack channels Effi should read. From that moment on, every new message
posted in those channels gets stored by Effi and becomes searchable —
when the customer asks Effi a question, Effi can pull from Slack to
answer, and cite the original Slack message.

**(b) What the team decided it should look like.** One Slack login per
Slack workspace (not per project, not per user). After the login, the
customer goes into a project and picks one or more channels for that
project. Public channels: Effi joins itself. Private channels: a person
already in the channel has to type `/invite @effi` once. Effi never
posts back to Slack — it only reads. There's a 90-day-ish backfill of
old messages, then live messages from then on. If the customer
disconnects, Effi forgets. The bot is called "Effi"; the Slack app is
called "Slack for Effi".

**(c) What it actually looks like today.** The code is essentially
finished. The OAuth handshake, the encrypted token storage, the channel
picker, the message ingestion, the lifecycle handlers (uninstall,
revoke, channel rename) — all of it is written, tested, and deployed in
the development environment, where the team has it installed in their
own Slack and it works. But no real customer can reach it, for four
independent reasons stacked on top of each other:

  1. There is a hidden feature toggle in the front-end called
     `slackIntegration`, which defaults to OFF. Customers don't see
     the "Connect Slack" button at all.
  2. The production server is missing **all** the Slack configuration
     it would need (client id, client secret, signing secret, and an
     encryption key for storing tokens).
  3. The staging server has most of those, but is missing the encryption
     key — so even staging can't finish a connection.
  4. The Slack-side app paperwork is split across at least two
     half-finished apps and one app the team can't administer. The team
     also has not submitted the app for Slack's Marketplace review,
     which Slack will require by March 2026 once a customer's history
     is bigger than a few hundred messages.

So: the feature is built. It just isn't turned on.

## 2. The gap, named honestly

Each bullet is one concrete thing standing between today and "a paying
customer can connect their Slack and Effi answers from it".

- **The production server has no Slack credentials.** No client id, no
  client secret, no signing secret, no token-encryption key. Production
  cannot start an OAuth flow, never mind finish one.
- **The staging server is missing the token-encryption key.** Even with
  the other three secrets, the callback would crash when it tries to
  encrypt the bot token before saving it.
- **Two of the secrets in staging/prod's secrets manager hold the
  literal text `TODO_FROM_RAILWAY` as their value.** That is a footgun
  — anything that reads them gets the placeholder string, not a real
  secret, and behaves as if the secret existed (just wrong).
- **The "Connect Slack" UI is hidden behind a feature toggle that
  defaults to off.** Even if the back-end were perfect, no customer
  would see the button.
- **The team has at least three Slack apps registered and isn't sure
  which is "the" customer one.** There's `Effi Spike` (admin access
  unclear, the person who runs the team can't change its settings),
  `ingest-poc` (an experimental app whose credentials never made it
  into the secrets manager), and `Slack integration for Effi` (the
  one currently working in development). The plan documents reference
  a fourth, "Slack for Effi", which doesn't exist yet.
- **No Slack Marketplace submission.** Slack's terms of service throttle
  any unlisted app to ~15 messages per minute on the history-fetch API,
  which makes "ingest a real customer's archive" effectively impossible
  without listing. Slack's review is 2-6 weeks, and there are
  unanswered legal/compliance items (privacy policy text, security
  questionnaire) before the team can submit.
- **A discrepancy in which Slack workspace is "the team's real
  workspace".** A constant in the internal CLI says one workspace id;
  the live token authenticates against a different one. One of the two
  is wrong. This blocks the team's own "we use our own bot internally"
  flow but not the customer flow directly.
- **Two scope inconsistencies inside the customer-app paperwork.** The
  runbook for creating the customer Slack app lists permissions to
  *write* messages (`chat:write`, `reactions:write`); the Marketplace
  submission draft, correctly, doesn't. The team explicitly decided
  read-only at launch. The runbook needs to drop the write scopes
  before anyone follows it.
- **Private-channel onboarding has a silent-failure mode.** If a
  customer admin binds a private channel but no human in that channel
  remembers to type `/invite @effi`, ingestion silently does nothing
  forever and there's no UI hint. Not a launch blocker, but a
  customer-visible papercut on day one.

## 3. The smallest path

Ten ordered steps from today to "a real customer can really use this."

1. **HUMAN-DECISION.** Pick exactly one Slack app to be the production
   customer app. Realistic options: (a) promote the working
   `Slack integration for Effi` app already in development, or (b)
   create the planned `Slack for Effi` app fresh per the existing
   11-step runbook. (b) is cleaner for branding and Marketplace
   submission; (a) is faster and already proven. Recommend (b) only if
   Marketplace listing is imminent.
2. **HUMAN-DECISION + paperwork.** In Slack's app dashboard for the
   chosen app, set the redirect URL to
   `https://app.askeffi.ai/api/slack/callback` (production) and the
   staging equivalent. Confirm the Events URL is wired and subscribed
   to `message.channels`, `message.groups`, `app_uninstalled`,
   `tokens_revoked`, `channel_rename`. Confirm scopes are *only* the
   six read scopes the code uses (`channels:read`, `channels:history`,
   `groups:read`, `groups:history`, `users:read`, `team:read`) — drop
   `chat:write`, `reactions:write`, `commands` from any earlier draft.
3. Copy the chosen app's client id, client secret, and signing secret
   into the staging and production secret stores. Replace the literal
   `TODO_FROM_RAILWAY` placeholders. Generate a fresh 32-byte token
   encryption key (e.g. `openssl rand -hex 32`) and put it in both
   environments under `TOKEN_ENCRYPTION_KEY`. **Critical:** once
   production has a token-encryption key, never rotate it casually —
   tokens already encrypted with it become unrecoverable.
4. Smoke the OAuth round-trip on staging end-to-end. With a test
   account, click "Connect Slack" against staging (after temporarily
   enabling the front-end toggle for that account or the staging
   build), authorize, return, confirm the database row was written and
   the token decrypts.
5. Bind a single channel in staging. Post a message in that channel.
   Confirm one new row appears in the messages table within a few
   seconds. Ask Effi a question that should pull from that message;
   confirm it does and cites the Slack thread.
6. **HUMAN-DECISION.** Decide whether the first wave of customers needs
   Marketplace listing on day one. If yes — start the Slack
   Marketplace submission now, in parallel with steps 7-10 (review
   takes weeks; do not block on it). If no — accept the throttle as a
   per-customer-onboarding-cost limit and revisit when the first
   customer hits it.
7. Flip the `slackIntegration` front-end toggle on for the first pilot
   customer's account (per-account, not globally). Walk that customer
   through the connect flow with someone watching.
8. Add one missing UX bit: when a customer binds a private channel,
   show a banner in the channel-picker that says "private channels
   need a one-time `/invite @effi` from someone in the channel — type
   that in Slack now." Optional but high-value; takes an hour.
9. Watch error monitoring (Sentry) for the first 48 hours after the
   pilot customer connects. The lifecycle handlers (uninstall,
   revoke, channel rename) have not been exercised in the wild — be
   ready to iterate.
10. Once one customer is happily using it, flip the toggle on for the
    rest of the customer base, in cohorts.

## 4. What I'd cut

- **The internal team's own Slack bot ("Slacker" / `dx slack`) is on
  the critical path in some of the planning, but it isn't.** It's a
  separate product that just happens to share the word "Slack". Treat
  it as a parallel track. Don't block customer launch on its
  `account_inactive` token, or its workspace-id discrepancy, or its
  channel-rename plan, or its 13-channel reorg. Those are real but
  separate.
- **The proposed env-var rename (`SLACK_*` → `ASKEFFI_SLACK_*` and
  `USEGIN_SLACK_*`).** Naming-cleanup is what you do *after* you ship,
  not what you do to ship. Today there is one customer-facing app and
  the unprefixed names work. Rename when there are two apps actually
  fighting for the namespace.
- **The Drive/Linear/Fathom/SharePoint "migrate them all to the same
  shape" cluster work.** It's a real and good observation that those
  integrations should follow Slack's pattern, but doing the migration
  before any Slack customer exists is over-investment. Ship Slack to
  one customer first; let the pattern prove itself; *then* migrate the
  others.
- **The "modal flow when install is errored" decision (open question
  O-8).** Errored installs are a tiny fraction of users. Pick the
  default (same modal, reconnect copy) and move on; revisit if it
  causes a real complaint.
- **Multi-channel-per-project marketing copy.** The schema already
  supports it; the copy says "one channel per project". Leave the copy
  alone until customers actually ask for multi-channel — at which
  point change two strings.

## 5. What I'd not touch yet

- **Don't try to retire `Effi Spike` or `ingest-poc` right now.**
  They're dormant. Removing them requires admin access the team
  doesn't have. They aren't doing harm. Leave them for a later
  cleanup pass.
- **Don't change the access-level model.** All Slack messages are
  marked "internal" right now. There's a temptation to add a
  per-message "external/internal" classifier; resist it until a
  customer asks. The default-internal posture is safe.
- **Don't build the auto-`/invite @effi` for private channels yet.**
  Four candidate approaches were sketched. All of them either need a
  user OAuth token (extra scope surface, customer friction) or rely on
  Slack APIs that are partly deprecated. A banner telling the human to
  type `/invite` is enough for v1.
- **Don't enable thread-aware retrieval, message edits, or message
  deletes.** Those are deferred to a later slice (C7) for a reason —
  edits/deletes have a tombstone-tracking cost and an "is this
  redaction or correction?" semantic question. Ship without them.
- **Don't let Marketplace listing block the first customer.** Use
  Marketplace listing as a *parallel* track. The first one or two
  pilot customers can live within Slack's throttle (a 90-day backfill
  on a small Slack workspace is well under the 1-req-per-minute
  ceiling).

## 6. The single sentence

**Slack is done when** a real customer admin clicks "Connect Slack" on
production Effi, signs in to their own Slack workspace, picks one
channel, posts a message in that channel, and asks Effi about it within
the same minute and gets an answer that quotes their message.

## 7. One paragraph on the team's own Slack flow

There is a second, separate flow: the AskEffi team's own Slack
workspace, with their own bot called `Slacker` / `useginslack` /
`UseGin`. This is *not* the customer feature — it's an internal
developer tool. The team uses it to make their internal AI agents talk
into their own Slack channels (announcements, alerts, logs).
**The plans are mostly keeping the two flows clean** — they correctly
state the customer app and the team app are separate Slack apps with
separate ids, separate scopes, separate review tracks. The risk of
conflation is in the *secrets and naming layer*, not the architecture
layer: today the customer-app secrets (`SLACK_CLIENT_ID` etc.) and the
team-bot token (`USEGIN_SLACK_BOT_TOKEN`) live in the same Doppler
project under similar-looking names, and a planned rename to prefix
them is sitting un-done. The cleanest mental separation is to treat the
team-bot work (broken token, workspace-id discrepancy, 13-channel
reorg, `dx slack` CLI verbs) as an entirely different project that can
slip without affecting customer launch. Stop talking about them in the
same breath. They share a vendor; they don't share a road map.
