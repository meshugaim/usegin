# Plan — Slack: fully functional

**Started:** 2026-04-29 (Lihu busy; Zisser running autonomous-vibe).
**Goal:** drive Slack integration from "code mostly there, gaps in paperwork
+ ingestion" → "fully functional end-to-end."

## Current state (verified live this session)

### ✅ What works

- **UseGin-Slack (team) — fully live.**
  - Bot token in Doppler (`USEGIN_SLACK_BOT_TOKEN`) — verified via
    `auth.test`: team `askeffi`, bot `useginslack`, scopes
    `chat:write, app_mentions:read, reactions:write, channels:read,
    channels:history, groups:read, groups:history, users:read`.
  - `dx slack {whoami,send,post,read,inbox}` all working.
- **AskEffi-Slack (customer) — code shipped.**
  - `/api/slack/callback`, `/api/slack/events`, `connectSlackAction`,
    `SlackIntegrationCard`, channel-picker modal, AES-256-GCM token
    encryption, lifecycle handlers (app_uninstalled / tokens_revoked /
    channel_rename), 12/12 tests pass.
  - Migrations: `slack_installs`, `slack_channel_bindings`.

### ⚠ What's missing for "fully functional"

1. **Message ingestion is NOT built.** `slack-event-handlers.ts` explicitly
   parks `message.*` as "C4 territory — out of scope." Without this, the
   customer can connect, bind a channel, but nothing flows into
   `data_items`. **This is the meaningful gap.**
2. **OAuth-UI smoke test never landed** — peer Zisser (2026-04-28) flagged
   a two-app paperwork mismatch: Brown was driven through `ingest-poc`
   creds (`10968745065781.11016697005682`), Doppler holds `Effi Spike`
   creds (`9761199231332.11011255384930`). **Either app would work**;
   needs the right redirect URL registered (`local-dev.askeffi.ai/api/slack/callback`).
3. **Linear status drift** — ENG-5412 and ENG-5415 are still "In Progress"
   despite the code being shipped (whoami/send/read/inbox all in
   `tools/dx/src/slack/`).
4. **Marketplace listing track** — pure paperwork, Lihu-only.

## What I (Zisser) can advance autonomously

### A. Linear hygiene (cheap, no Lihu needed)

- [ ] Close ENG-5412 with comment pointing at shipped commits + verified
      live dx slack send/read.
- [ ] Close ENG-5415 (inbox shipped).
- [ ] Comment on ENG-5409 with the "code complete; gap is C4 ingestion +
      OAuth-UI smoke."

### B. C4 message ingestion (real code work — charter Wes)

- [ ] Charter Wes to land `message.*` event handler:
  - Subscribe to `message.channels`, `message.groups` events on
    AskEffi-Slack app
  - In `slack-event-handlers.ts`, add `handleMessageEvent` that:
    - Looks up the binding for `(team_id, channel_id, app_id)`
    - If no binding → ignore (channel not bound to a project)
    - If binding exists → write a `data_items` row with the message
      payload (per CF5 — per-message granularity, idempotent on
      `(team_id, channel_id, ts)`)
  - Honor `subtype` filtering (skip bot_message from our own bot, joins,
    leaves)
  - Test coverage: bound-channel happy path, unbound-channel ignore,
    self-bot ignore, idempotent re-deliver, thread reply binding to
    parent message
- [ ] Charter Ron to review

### C. Backfill primer (smaller; can follow C4 or stand alone)

- [ ] After binding lands, fetch last N messages via
      `conversations.history` once and write them as data_items.
      Subject to CF1 ToS cap (1 req/min × 15 msgs/page) — degrade
      gracefully when exceeded.

### D. Documentation

- [x] This plan.
- [ ] Update `usegin/research/slack-integration/RESUME.md` with current
      state.

## What needs Lihu (block list — don't try to bypass)

- **Marketplace submission** — Lihu's call (R4 in recommendation.md).
- **Doppler/Slack-app paperwork resolution** — confirm which Slack app
  (`9761199231332.…` Effi Spike or a fresh AskEffi-Slack registration)
  is the customer-facing one. If Effi Spike is the production target,
  add `https://local-dev.askeffi.ai/api/slack/callback` to its OAuth
  redirect URL set so the in-app smoke can run.
- **Manual end-to-end smoke** — a human clicking through the OAuth flow.
  Once the redirect URL is registered, this is a 5-minute test.

## Open questions (non-blocking, marked for Lihu)

- ↑ Q1: Use `Effi Spike` app (already in Doppler) for AskEffi-Slack
  customer-facing, or register a separate `AskEffi-Slack` app? The R&D
  recommended separate per H — but spike app is already live; cheaper
  to re-purpose.
- ↑ Q2: C4 ingestion: `data_items` row per message (CF5), or batched per
  thread? Synthesis says per-message; want to confirm before chartering.

## Stop conditions (when Zisser halts and waits for Lihu)

- ENG-5412/5415 close hits a Linear-permissions wall → halt
- C4 charter writes hit production data shape decisions Wes can't
  default to safely → halt and surface
- Anything that needs touching prod DB or deploys → halt

## Linked

- ENG-5399 (parent), ENG-5408 (UseGin handoff), ENG-5409 (AskEffi handoff)
- `usegin/research/slack-integration/SYNTHESIS.md`
- `usegin/research/slack-integration/recommendation.md`
- Peer Zisser's tmuna report — referenced in `zisser/log/2026-04.md`
  (file itself was never landed in git; the thread-of-record is the log)
