# For Tom — Slack integration round, mid-flight

**From:** Lihu's session — Claude session id `c2f48116-8355-4edf-969f-e9e85239cc46`
**Date:** 2026-04-27 (Lihu went on vacation — this Gin is running autonomous-vibe per z091)

## The goal — please remind this Gin if it drifts

**Get a functional Slack integration shipped.** Two surfaces:
1. **Customer-facing Slack** — 1 Slack channel ↔ 1 AskEffi project, messages indexed for Effi.
2. **UseGin-Slack (internal)** — Slack as the team's task/discussion surface, mediated by Gin (`dx slack send/read/inbox`).

That's the one goal. Marketplace listing, encryption, channel pickers — all subsidiary tracks toward that goal.

## Where things live

- **Round entry:** `usegin/research/slack-integration/RESUME.md` — round is CLOSED. Read SYNTHESIS.md + recommendation.md.
- **Linear parent:** ENG-5399 (sub-issues ENG-5400..5407 are R&D whiteboards; ENG-5408..5416 are slices in progress).
- **Active slices** as of this handoff:
  - ENG-5408 D1 ✅, ENG-5412 D2 ✅, ENG-5415 D3 just landed (push blocked — see below)
  - ENG-5409 C1 ✅, ENG-5411 C2 ✅, ENG-5416 C3 in flight
  - ENG-5410 z089 R&D ✅, ENG-5413 z089-impl in flight
  - ENG-5414 marketplace prep ✅

## The autonomous-vibe protocol Lihu set

`usegin/zettel/zettels/z091-autonomous-vibe-for-gin.md`:
- Gin runs on its own, parallel sub-Gins, ship slice after slice
- Stop **only** if continuing would compromise quality because Gin needs a human
- If a block is async-completable without quality compromise → leave a small Lihu/Tom task list, keep moving

## The Yohai (Comptroller) persona

`usegin/comptroller/charter.md` — between-phase audit voice. Hebrew *mevaker*. Single-shot, fresh, scores GREEN/YELLOW/RED on focus / code / process / fight signal. Lihu instructed me to invoke Yohai between each parallel batch.

## What Lihu (and you, Tom) need to do — running list

This list grows as Gin finds things only humans can do:

### High priority (unblocks more code work)

1. **Register the two Slack apps** at api.slack.com:
   - **UseGin** app — bot scopes: `chat:write`, `channels:read|history`, `groups:read|history`, `im:history`, `mpim:history`, `app_mentions:read`, `reactions:write`, `users:read`. Install on AskEffi workspace. Copy `xoxb-…` token.
   - **AskEffi-Slack** app — DISTINCT from UseGin. Bot scopes: `channels:read|history`, `groups:read|history`, `users:read`, `team:read`. NO DM scopes. NO `commands` (R2 lean: read-only at MVP). OAuth redirect: `${NEXT_PUBLIC_SITE_URL}/api/slack/callback`.
2. **Set Doppler secrets:**
   - `USEGIN_SLACK_BOT_TOKEN=xoxb-…` (UseGin app's token)
   - `SLACK_CLIENT_ID=…`, `SLACK_CLIENT_SECRET=…` (AskEffi-Slack app's OAuth credentials)
3. **Generate `TOKEN_ENCRYPTION_KEY`:** `openssl rand -base64 32` → set in Doppler + Railway sealed vars. ENG-5413 (token-crypto helper) is in flight; until the key is real, the helper fails loud per its quality gate.
4. **Confirm rotation cadence** for the encryption key — proposed default: on suspected compromise + annually.

### Medium priority (Marketplace track)

5. Read `usegin/research/slack-marketplace/security-questionnaire.md` § Appendix — 6 items marked `[LIHU UNKNOWN]` need answers.
6. Read `usegin/research/slack-marketplace/submission-checklist.md` — 7 phased blockers; submission itself is Lihu-only.
7. Privacy policy + terms of service need Slack-specific clauses.

### Cross-agent friction — Tom watch this

8. Pre-push hook tests run against the full working tree, not just commits in scope. If one Gin's commit fails tests in another Gin's in-flight code, push gets blocked for everyone. See zettel z095. Lihu should decide whether to:
   - Tighten pre-push to only the scope of the commit
   - Accept this and let Gins coordinate via "wait for the parallel batch to fully land before push"
   - Allow `--no-verify` for Gin-orchestrator pushes (NOT for slice commits)

## How to talk to this Gin

If you want this Gin to keep working (resume the same session):
```
claude --resume c2f48116-8355-4edf-969f-e9e85239cc46
```

If you want to fire a fresh Gin (recommended if context has rotated): give it this file as the first read, plus `usegin/research/slack-integration/RESUME.md`.

## What Lihu wants to see when he's back

A working `dx slack whoami` → `dx slack send #usegin "hi"` → message appears in team Slack. **That's the demo.** Customer surface (channel binding + ingestion) is graduate-from-D track.

## Yohai-audit cadence

Gin should call Yohai between each parallel batch. Audits land in `usegin/comptroller/audits/YYYY-MM-DD-HHMM-<topic>.md`. If you (Tom) want to spot-check the team's quality posture, read the most recent audit there.
