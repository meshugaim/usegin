# `dx slack` — UseGin-Slack CLI

Gin-mediated team Slack R/W, mirroring `plan` (Linear-via-Gin), not `effi`
(per-user identity). One bot, one token, attribution lives in the message
payload (`*[via Lihu]*`). See
`usegin/research/slack-integration/usegin-slack-team/whiteboard.md` for the
full design.

## Commands at a glance

| Command | What it does | Slack API | Bot scope |
|---|---|---|---|
| `dx slack whoami` | Show bot identity, workspace, granted scopes | `auth.test` | (any) |
| `dx slack send <ch> <msg>` | Post a message; supports `--thread` | `chat.postMessage` | `chat:write` |
| `dx slack post <msg>` | Post to outbox channel (default `#usegin`) | `chat.postMessage` | `chat:write` |
| `dx slack read <ch>` | Read messages; `--since 1h\|1d\|7d\|2w`, `--limit N` | `conversations.history` | `channels:history`, `groups:history` |
| `dx slack inbox` | Pull `@usegin` mentions across joined channels | `conversations.history` + filter | `channels:history`, `app_mentions:read` |
| `dx slack channel create <name> [--private] [--topic]` | Create a public/private channel | `conversations.create` | `channels:manage` / `groups:write` |
| `dx slack channel invite <ch> <u>...` | Invite users (id, @handle, or email) | `conversations.invite` + resolver | `channels:manage`, `users:read.email` |
| `dx slack channel join <ch>` | Bot self-joins | `conversations.join` | `channels:join` |
| `dx slack channel archive <ch>` | Archive (soft-delete) | `conversations.archive` | `channels:manage` |
| `dx slack channel topic <ch> <text>` | Set topic | `conversations.setTopic` | `channels:manage` |
| `dx slack channel purpose <ch> <text>` | Set purpose | `conversations.setPurpose` | `channels:manage` |
| `dx slack channel members <ch>` | List members (id + name + email) | `conversations.members` + `users.info` | `channels:read`, `users:read.email` |
| `dx slack channel bookmark add <ch> <url> [--title]` | Pin a link bookmark | `bookmarks.add` | `bookmarks:write` |
| `dx slack user find <id\|@handle\|email>` | Resolve to a user record | `users.lookupByEmail` / `.list` / `.info` | `users:read`, `users:read.email` |
| `dx slack dm <user> <msg>` | Open DM + post in one call | `conversations.open` + `chat.postMessage` | `im:write`, `chat:write` |
| `dx slack files upload <ch> <path>` | Upload a file (uses `uploadV2`, NOT deprecated `files.upload`) | `files.uploadV2` | `files:write` |
| `dx slack react <ch> <ts> <emoji>` | Add a reaction | `reactions.add` | `reactions:write` |
| `dx slack smoke [--skip-live] [--channel <n>]` | Six-check post-install verification gate | (all of the above) | (verifies) |

Every command supports `--json` (or auto-on when piped / `DX_OUTPUT=json` /
`CLAUDECODE=1`). Output convention: human → stderr, JSON → stdout.

## Lihu-please-add-these — scopes the bot still needs

The test-workspace bot today has these Bot Token Scopes:

```
chat:write, app_mentions:read, reactions:write, channels:read,
channels:history, groups:read, groups:history, users:read
```

To unlock the full admin-grade surface, add these in
**OAuth & Permissions → Bot Token Scopes** at api.slack.com/apps and reinstall:

| Scope | Unlocks |
|---|---|
| `channels:manage` | `channel create / archive / topic / purpose / invite` (public) |
| `groups:write` | same, for private channels |
| `channels:join` | `channel join` |
| `users:read.email` | `user find <email>`, `channel members` email column, smoke's lihu lookup |
| `bookmarks:write` | `channel bookmark add` |
| `files:write` | `files upload` |
| `im:write` | `dm` |

Subcommands that need a missing scope return `error: missing_scope` with a
hint pointing here. They DON'T silently no-op.

## Doppler key table — one canonical name per token type

UseGin-Slack and customer-facing AskEffi-Slack are **two different apps**
with two different `app_id`s. Don't share keys between them.

| Doppler key | What it is | Used by |
|---|---|---|
| `USEGIN_SLACK_BOT_TOKEN` | UseGin-Slack `xoxb-…` bot token | `dx slack *` (this CLI) |
| `USEGIN_SLACK_APP_TOKEN` | UseGin-Slack `xapp-…` app-level token (socket mode, future) | (reserved) |
| `USEGIN_SLACK_SIGNING_SECRET` | UseGin-Slack signing secret (events, future) | (reserved) |
| `ASKEFFI_SLACK_CLIENT_ID` | Customer AskEffi-Slack OAuth `client_id` | `nextjs-app/app/api/slack/callback` |
| `ASKEFFI_SLACK_CLIENT_SECRET` | Customer AskEffi-Slack OAuth client secret | same |
| `ASKEFFI_SLACK_SIGNING_SECRET` | Customer AskEffi-Slack signing secret | events route (future) |

There's a follow-up Linear sub-issue to rename the existing unprefixed
customer keys (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`,
`SLACK_SIGNING_SECRET`) to the `ASKEFFI_*` namespace — the unprefixed
names conflate UseGin and customer surfaces and have already caused
near-misses in env wiring. Don't break consumers in that rename slice;
just propose.

## Slices landed

- **Slice 1 — ENG-5408 — `whoami`**.
- **Slice 2 — ENG-5412 — `send` + `read`**.
- **Slice 3 — ENG-5760 — admin-grade ops + smoke** (this slice):
  channel create/invite/join/archive/topic/purpose/members, channel
  bookmark add, user find, dm, files upload, react, smoke. Plus the
  channel registry (`registry.ts`) and `EXPECTED_REAL_TEAM_ID`.

## Setup — one-time, Lihu-only

These steps require a browser session and admin rights. They cannot be
automated by Gin.

### 1. Register the UseGin Slack app

Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.

- **Name:** `UseGin` (or `UseGin-dev` for cloud devcontainers).
- **Workspace:** AskEffi team Slack.

This is a **separate app** from the customer-facing AskEffi-Slack.

### 2. Configure scopes

Under **OAuth & Permissions → Scopes → Bot Token Scopes**, add **all of
these** so future slices don't need re-scoping (covers slices 1–3):

```
chat:write
channels:read
channels:history
groups:read
groups:history
im:history
mpim:history
app_mentions:read
reactions:write
users:read
channels:manage      # slice 3
groups:write         # slice 3
channels:join        # slice 3
users:read.email     # slice 3
bookmarks:write      # slice 3
files:write          # slice 3
im:write             # slice 3
```

### 3. Install on the workspace

**OAuth & Permissions → Install to AskEffi**. Approve scopes. Copy the
`xoxb-…` bot token.

### 4. Store in Doppler

```bash
doppler secrets set USEGIN_SLACK_BOT_TOKEN="xoxb-…" --project usegin --config dev
```

### 5. Set the smoke channel

Create a channel for smoke verification (e.g. `#dev` or `#zisser-out`),
invite the bot (`/invite @usegin`), then:

```bash
doppler secrets set DX_SLACK_SMOKE_CHANNEL="#dev" --project usegin --config dev
```

### 6. Run the smoke

```bash
doppler run -- dx slack smoke
```

Expect six checks all `[ OK ]`. If `team_id` mismatches `EXPECTED_REAL_TEAM_ID`
(`tools/dx/src/slack/registry.ts`), update the constant in the same commit
that lands the new token.

## Channel-name registry

`registry.ts` exports `ZISSER_CHANNELS` constants:

```ts
{ outbox: '#zisser-out', alerts: '#zisser-alerts', log: '#zisser-log' }
```

These are NAMES Zisser refers to in code. The actual channels get created
via `dx slack channel create` once the bot is in the real workspace. The
registry decouples Zisser's intent from Slack's runtime ids — Lihu can
rename channels later, we update the registry, code stays put.

## Architecture

Three-layer like the rest of `dx`:

1. **Pure functions** (`config.ts`, `whoami.ts`, `channelOps.ts`, `user.ts`,
   `dm.ts`, `bookmark.ts`, `files.ts`, `react.ts`, `smoke.ts`, …) —
   testable, dependency-injected. Take a structural client subset, not the
   `WebClient` directly.
2. **Commander builder** (`commands/<verb>.ts`) — CLI surface, exit codes
   0/1/2.
3. **CLI wiring** (`index.ts` → `cli.ts`) — `dx slack <verb>` registration.

Output: human → stderr, JSON → stdout, `--json` flag, `DX_OUTPUT=json`.

Every error path threads a token mask (`xoxb…CdEf`) instead of the raw
secret; tests assert the mask is present and the raw secret is not.

## Why TS, not Python

The handoff said "defer to existing dx convention". `tools/dx/` is TS via
Commander + Bun. Sticking to that: zero new tooling, reuse `dxShouldOutputJson`
and prefix-matching helpers, single test runner (`bun test`).
