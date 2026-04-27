# `dx slack` — UseGin-Slack CLI

Gin-mediated team Slack R/W, mirroring `plan` (Linear-via-Gin), not `effi`
(per-user identity). One bot, one token, attribution lives in the message
payload (`*[via Lihu]*`). See
`usegin/research/slack-integration/usegin-slack-team/whiteboard.md` for the
full design.

## Slices landed

- **Slice 1 — ENG-5408 — `dx slack whoami`**: calls `auth.test`, prints
  workspace, bot user, app id, granted scopes. Stateless, proves the spine.
- **Slice 2 — ENG-5412 — `dx slack send` + `dx slack read`**: post via
  `chat.postMessage`, read via `conversations.history`. Reuses
  `config.ts` + `client.ts` from slice 1. Channel input accepts `#name` or
  raw `Cxxxxx` id. `--thread <ts>` for thread replies on send. `--since
  1h|1d|7d|2w` and `--limit N` (default 50, max 1000) on read. 429 rate-limit
  surfaces as `error: ratelimited` with `retry_after`.

## Setup — what Lihu does once (human-only steps)

These steps require a browser session and admin rights. They cannot be
automated by Gin.

### 1. Register the UseGin Slack app

Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.

- **Name:** `UseGin` (or `UseGin-dev` if you want a separate app for the
  cloud devcontainers).
- **Workspace:** AskEffi team Slack.

This is a **separate app** from any future AskEffi-Slack customer-facing
app (per synthesis CF7 + angle H). Two `app_id`s in env from day one.

### 2. Configure scopes

Under **OAuth & Permissions → Scopes → Bot Token Scopes**, add:

| Scope | Why (which slice will need it) |
|---|---|
| `chat:write` | `dx slack send` (slice 2) |
| `channels:read` | `dx slack channels`, mention resolution |
| `channels:history` | `dx slack read`, `dx slack inbox` |
| `groups:read` | private channel listing |
| `groups:history` | private channel reading |
| `im:history` | DMs to the bot |
| `mpim:history` | group DMs |
| `app_mentions:read` | `@usegin` mentions in `dx slack inbox` |
| `reactions:write` | `dx slack react` |
| `users:read` | resolve `*[via <human>]*` from Slack user ids |

`whoami` itself only requires a valid token — Slack returns identity
info on `auth.test` regardless of scope. Scopes above are scoped to
"generous on day one so the next slices don't re-scope" per the handoff.

### 3. Install the app on the workspace

Under **OAuth & Permissions** click **Install to AskEffi**. Approve the
scope grants. Slack will issue a **Bot User OAuth Token** that starts with
`xoxb-`. **Copy it** — you'll paste it into Doppler in step 4.

### 4. Store the bot token in Doppler

```bash
doppler secrets set USEGIN_SLACK_BOT_TOKEN="xoxb-…" --project usegin --config dev
```

(Adjust `--project` / `--config` to the Doppler project where Gin's other
team-tier secrets live, e.g. wherever `LINEAR_API_KEY` lives. If a
dedicated `usegin` project doesn't exist yet, create one — UseGin-Slack
is a team-tier secret, not a customer-tier secret.)

The env var name `USEGIN_SLACK_BOT_TOKEN` is matched by
`tools/dx/src/slack/config.ts`.

### 5. Smoke-test

```bash
doppler run -- dx slack whoami
# UseGin-Slack OK
#   workspace: AskEffi (T01ABCD)
#   bot user:  usegin (U02XYZ)
#   app id:    A03LMNO
#   url:       https://askeffi.slack.com/
#   token:     xoxb…abcd
#   scopes:    chat:write, channels:read, ...

doppler run -- dx slack whoami --json
# {"ok":true,"workspace":{...},"bot":{...},"scopes":[...]}
```

If `auth.test` fails, the CLI exits with code 1 and a hint pointing at
the env var.

## What's next

- `dx slack inbox` — pulls `@usegin` mentions on demand (no Events API yet).
- `dx slack react`, `dx slack thread`, `dx slack channels`, `dx slack search`, `dx slack docs`.
- `#usegin` channel convention (default outbox target).
- Cross-surface ENG-id auto-link on read; Linear permalinks on write.

## Architecture

Three-layer like the rest of `dx`:

1. Pure functions (`config.ts`, `whoami.ts`) — testable, dependency-injected.
2. Commander builder (`commands/whoami.ts`) — CLI surface, exit codes.
3. CLI wiring (`index.ts` → `cli.ts`) — `dx slack <verb>` registration.

Output convention: human → stderr, JSON → stdout, `--json` flag and
`DX_OUTPUT=json` env (matches existing `dx` and `effi` patterns).

## Why TS, not Python

The handoff said "defer to existing dx convention". `tools/dx/` is TS via
Commander + Bun. Sticking to that: zero new tooling, reuse `dxShouldOutputJson`
and prefix-matching helpers, single test runner (`bun test`). When ingestion-
shaped Slack work lands later (Events API receiver in `python-services/`,
per synthesis DV5 lean), it will live there — but `dx slack` is a CLI, and
CLIs in this repo are TS.
