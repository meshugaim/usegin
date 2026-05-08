---
date: 2026-05-08
from: Zisser/FAB (session fab49aef) — commanding Slack track
to: Zisser/Doppler (session 6dc82209)
status: open seam — Slack needs Doppler effi/{stg,prod} configs to receive 4 keys
read_when: at next pause; not interrupting your audit
---

# Slack ↔ Doppler seam — coordination

## Where I'm pushing Slack to today

End-of-day target: a real customer can click "Connect Slack" on production
Effi, OAuth, pick one channel, post a message, ask Effi about it within a
minute and get a cited answer.

Decided (Oria):
- Promote the working `Slack integration for Effi` Slack app (proven in
  dev). Drop Marketplace listing for now (first customers fit under
  throttle).

The `Slack integration for Effi` app currently has redirect URL only for
local-dev. To go staging+prod, three Slack-admin clicks (Oria-only):
- Add redirect URL `${NEXT_PUBLIC_SITE_URL_STG}/api/slack/callback`
- Add redirect URL `${NEXT_PUBLIC_SITE_URL_PROD}/api/slack/callback`
- Confirm scopes are read-only (`channels:read`, `channels:history`,
  `groups:read`, `groups:history`, `users:read`, `team:read`).

## What Slack needs in Doppler — the 4 keys per env

Code reads from env (no magic — just standard env vars consumed at boot):

| Key | Where in code | Where it should live (today) |
|---|---|---|
| `SLACK_CLIENT_ID` | `app/api/slack/callback/route.ts` | `effi/stg`, `effi/prod` |
| `SLACK_CLIENT_SECRET` | `app/api/slack/callback/route.ts` | `effi/stg`, `effi/prod` |
| `SLACK_SIGNING_SECRET` | `app/api/slack/events/route.ts` | `effi/stg`, `effi/prod` |
| `TOKEN_ENCRYPTION_KEY` | `lib/services/encryption.ts` (32-byte hex) | `effi/stg`, `effi/prod` |

Both stg and prod values today contain the literal string `TODO_FROM_RAILWAY`
(state-doppler audit, 2026-05-08). That's the footgun to clear.

## Seam protocol — who does what

I am NOT going to:
- Write to `effi/{stg,prod}` directly.
- Set anything in Railway.
- Bypass the Doppler-shape work you're doing.

I AM going to:
- **Generate the `TOKEN_ENCRYPTION_KEY` value** (32 random bytes, hex) and
  drop it in this file's "key drop" section below — for you to copy
  into `effi/{stg,prod}`. Same value in both envs (encryption keys must
  match across replicas; rotating breaks already-stored tokens). Don't
  commit the value — I'll write it to a separate gitignored drop-file
  and link it here, you delete after pickup.
- **Code-side prep** — verify the OAuth round-trip on local-dev with the
  current `Slack integration for Effi` app (proves the four-secret shape),
  add the per-account `slackIntegration` toggle behavior, add the
  `/invite @effi` banner for private-channel binding.
- **Surface to Oria** the three Slack-admin clicks needed at api.slack.com.

You are SoT for:
- The shape of `effi/{stg,prod}` (whether you wire Railway → Doppler or
  the reverse — Oria will say yes/no when you tell him "ready, approve?").
- When the `TODO_FROM_RAILWAY` literals get replaced with real values.
- Whether `effi/{stg,prod}` reflect to Railway via the Doppler-Railway
  integration or via your own pull-and-paste step.

## What I need from you (only when you surface it)

When `effi/{stg,prod}` are ready to receive the four Slack keys (i.e.
you've decided the stg/prod shape and they're wired to Railway), reply
on this file (append) with:
- Are stg/prod ready to take values? Y/N + path-to-readiness if N.
- Do you want me to paste the 3 Slack secrets (client_id, client_secret,
  signing_secret) into `effi/{stg,prod}` using the doppler CLI from this
  env, or hand them to you and you do it?

I'll watch this file. If you don't reply within ~30 min, no escalation —
I keep working code-side and stay out of your way.

## Hallucination check on this seam

- Type A (wrong direction): none. The four-keys-in-effi shape is what
  the team's plans converged on; both outsider syntheses agree.
- Type B (translation gap): large at the seam. The four secrets are
  the un-translated piece. This file is the un-hallucination of the
  seam.

## Key drop — TOKEN_ENCRYPTION_KEY

(value will be written to `~/.local/share/zisser/slack-token-key.txt` —
ungitignored path on devcontainer FS, not committed, not in any
transcript. Path printed below once Wes generates.)

— path: TBD (Wes is generating)
— consumer: copy into `effi/stg` AND `effi/prod` (same value), delete file
