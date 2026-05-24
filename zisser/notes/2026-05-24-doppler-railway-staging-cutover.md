---
date: 2026-05-24
authored_by: Zisser
audience: Oria — read on return; this is the cutover landing pad
status: blocked-on-human-clicks (Doppler + Railway dashboard)
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
---

# Doppler→Railway staging cutover — status & next clicks

Two faces — yours and Zisser's. Yours first.

## Your side — the clicks only you can do

You greenlit blocker #1 path (a) — wire Railway to pull from `effi/{stg,prod}`,
staging first. I tried to start; both prerequisite credentials are missing
in my shell. Two ~5-minute Oria-only unlock paths; pick one.

### Path A (preferred) — grant your account project access

**In Doppler dashboard:**

1. Confirm `oria@askeffi.ai` is a workplace member (Access → Members).
2. **Projects → `effi` → Access** → add `oria@askeffi.ai` with role
   sufficient to read+write all configs (Admin/Project Admin). My CLI
   currently sees the workplace `AskEffi (75315c2234b3b6cde79c)` but
   `doppler projects` returns an empty list — the token has no
   project-level grant on `effi`. This step fixes it.

**In Railway dashboard:**

3. Railway → AskEffi project → **Staging service** → Settings →
   Integrations → **Doppler** → install. Authorize against the AskEffi
   Doppler workplace, point at project `effi`, config `stg`. Pick
   "sync on change" (the "values flow once" language from your May 6
   note).
4. Leave the existing Railway staging env vars as-is for now — they are
   the fallback until I've confirmed Doppler-side values are populated
   and loading.

Then tell me "go" and I'll do everything after.

### Path B — give me a scoped service-account token

If you'd rather not grant your user account project access right now:

1. Doppler dashboard → **Service Accounts → Create** → name
   `zisser-cutover-2026-05`, scope to the `effi` project (read+write
   all configs), not workplace-admin.
2. Paste the token in chat. I'll use it for the cutover, then revoke.

You still need to do the Railway dashboard step (3) above either way —
that integration install is a one-time human authorization no CLI replaces.

## My side — what runs without further questions once unlocked

1. List `effi/stg` placeholders (`doppler secrets --only-names`, masked).
2. Source the 19 `TODO_FROM_RAILWAY` values from Railway staging and set
   them in `effi/stg` (`doppler secrets set` per key).
3. Trigger a staging redeploy and verify the container loaded from
   Doppler — by reading a value Doppler holds that differs from
   Railway's old env, or by checking the Railway-side Doppler sync log.
4. Write the prod-cutover gate at the bottom of this same note (what
   we want to see on staging before doing prod).
5. Report back.

If unlock path A is taken: I also `doppler login` with my own session
so the `oria 24.5` CLI token gets the new grant (one extra command on
my side, zero clicks for you).

## What stays read-only

- Railway production env — untouched.
- `effi/prod` — untouched.
- Staging DB — no migrations.
- Existing Railway staging vars — left in place until step (3)
  verification proves Doppler-side is loading. Reversible.

## Why this stays scoped to staging

The May 6 migration landed `effi/stg` + `effi/prod` as structure
(19 placeholders each) — that's the deferred half of the dev-side
reorg. Wiring staging first lets us catch any
Doppler→Railway integration surprise on a non-customer environment.
The prod cutover gate gets written after staging is verified.

## Prod-cutover gate (placeholder — will be filled after staging green)

To be written after step (4) above. Will name: how many deploys we
want to see staging stay green, whether we revoke the bootstrap
token before or after prod cutover, what the rollback steps look
like.
