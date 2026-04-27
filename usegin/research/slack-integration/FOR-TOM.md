# For Tom — Slack integration round, mid-flight

**From:** Lihu's session — Claude session id `c2f48116-8355-4edf-969f-e9e85239cc46`
**Date:** 2026-04-27 (Lihu went on vacation — this Gin is running autonomous-vibe per z091)

## The goal — please remind this Gin if it drifts

**Get a functional Slack integration shipped.** Two surfaces:
1. **Customer-facing Slack** — 1 Slack channel ↔ 1 AskEffi project, messages indexed for Effi.
2. **UseGin-Slack (internal)** — Slack as the team's task/discussion surface, mediated by Gin (`dx slack send/read/inbox`).

That's the one goal. Marketplace listing, encryption, channel pickers — all subsidiary tracks toward that goal.

## Where things live

- **Round entry:** `usegin/research/slack-integration/RESUME.md` — round is CLOSED. Read **DEMO.md first** (end-to-end recipe), then SYNTHESIS.md + recommendation.md.
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
   - **AskEffi-Slack** app — DISTINCT from UseGin. Bot scopes: `channels:read|history`, `groups:read|history`, `users:read`, `team:read`. NO DM scopes (G's RLS-leak posture). OAuth redirect: `${NEXT_PUBLIC_SITE_URL}/api/slack/callback`. **Plus Event Subscriptions:** turn on, set Request URL to `${NEXT_PUBLIC_SITE_URL}/api/slack/events`, subscribe to bot events `app_uninstalled`, `tokens_revoked`, `channel_rename` (per C5).
2. **Set Doppler secrets:**
   - `USEGIN_SLACK_BOT_TOKEN=xoxb-…` (UseGin app's token)
   - `SLACK_CLIENT_ID=…`, `SLACK_CLIENT_SECRET=…` (AskEffi-Slack app's OAuth credentials)
   - `SLACK_SIGNING_SECRET=…` (AskEffi-Slack "Basic Information → Signing Secret" — required for Events route)
3. **Generate `TOKEN_ENCRYPTION_KEY`:** `openssl rand -base64 32` → set in Doppler + Railway sealed vars. The Slack callback fails loud without it (z091 quality gate).
4. **Confirm rotation cadence** for the encryption key — proposed default: on suspected compromise + annually.

### Medium priority (Marketplace track)

5. Read `usegin/research/slack-marketplace/security-questionnaire.md` § Appendix — 6 items marked `[LIHU UNKNOWN]` need answers.
6. Read `usegin/research/slack-marketplace/submission-checklist.md` — 7 phased blockers; submission itself is Lihu-only.
7. Privacy policy + terms of service need Slack-specific clauses.

### Cross-agent friction — STRUCTURAL, escalated by Yohai audit 1

**This is now the dominant time-sink for parallel-Gin batches. Yohai audit 1 (`usegin/comptroller/audits/2026-04-27-2130-slack-batch-2.md`) flagged it RED. Parallel batches are PAUSED until Lihu/Tom pick a fix.**

8. **Three autosync collision modes have fired in single batches.** Captured in z094, z095, z096. Pick one fix:
   - **(a) Stash-before-reset.** `git stash --include-untracked` before any autosync `git reset --hard`. Cheap. Doesn't fix attribution swap.
   - **(b) Range-scoped pre-push.** Pre-push lint/typecheck only against the diff of commits being pushed, not the full working tree. Removes cross-agent block. Doesn't fix reset-wipe.
   - **(c) `dx wait-for-clean-tree` + commit-serialization.** Agents acquire a lock before `git add`+`git commit`+`git push`. Fixes attribution swap. Adds latency.
   - **Combined:** (a)+(b)+(c) is the principled answer. Probably worth a tikur (`.claude/skills/tikur/`).

9. **Tikur recommended.** Three failure modes in one batch is the criterion. Run it once Lihu/Tom is back.

10. **Until a fix lands**, Gin-orchestrator runs slices **single-agent** (this Gin does the work directly, no parallel sub-Gins) for:
   - ✅ ~~C3 UI restoration~~ — DONE (single-agent, ENG-5416 closed). Card + modal + tests + wiring landed in 74b56a2b6..57040a9b4.
   - Any future slice that touches `nextjs-app/` (most-collision-prone area) until autosync structural fix lands.

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
