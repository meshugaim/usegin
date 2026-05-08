---
date: 2026-05-08
authored_by: Zisser
caller: Oria (live-user banner; "I'm not here. Like you, we work high level.")
status: phase-1 dispatched
audience: Oria — read on return; only blocking decisions surfaced inline to chat
related:
  - zisser/plans/2026-05-05-doppler-three-group-reorg.md
  - zisser/notes/2026-05-06-doppler-migration-done.md
  - zisser/notes/2026-05-06-doppler-consumer-map.md
  - zisser/plans/2026-04-29-slack-fully-functional.md
  - zisser/plans/2026-05-04-slack-ux-alignment.md
  - zisser/plans/2026-05-05-slack-workspace-reorg.md
  - zisser/plans/2026-05-05-slack-for-effi-app-creation.md
---

# Doppler & Slack — ground down to working

## What Oria asked for (verbatim, distilled)

> "I want to get Doppler done and Slack done." Doppler organized per the
> conversations with agents; Slack: customers can integrate Slack into Effi
> the way we defined. Don't try to resolve it — generate a clear picture.
> Three teams per topic. **Don't get me into details.** Surface only key
> blocking decisions. All time, all resources. Bring someone fresh — no
> personas, no zettels — to say "you're far in latent-world; here's the
> connection."

Two topics × three angles = six dispatches. Sequenced as two phases.

## Phase 1 — parallel (4 spawns, all read-only)

Independent investigations. No commits from sub-agents; each writes one
output file at a path the charter names; Zisser commits the bundle on
return.

| Track | Reads | Output | Charter |
|---|---|---|---|
| **History-Doppler** | `zisser/plans/`, `dispatched/`, `inbox/`, `notes/`, agent sessions, Linear, recent zettels — NOT code | `zisser/dispatched/2026-05-08-doppler-history-out.md` | `2026-05-08-doppler-history.md` |
| **History-Slack** | same substrate, Slack-scoped — NOT code | `zisser/dispatched/2026-05-08-slack-history-out.md` | `2026-05-08-slack-history.md` |
| **State-Doppler** | live Doppler dashboard, code/configs that consume Doppler, devcontainer wrapper, Railway env, `.env*` files, scripts | `zisser/dispatched/2026-05-08-doppler-state-out.md` | `2026-05-08-doppler-state.md` |
| **State-Slack** | live Slack apps (api.slack.com), workspace, OAuth code paths, env vars in code/Doppler, ENG-* tickets, redirect URLs configured | `zisser/dispatched/2026-05-08-slack-state-out.md` | `2026-05-08-slack-state.md` |

All four spawn as `general-purpose` (no persona load, fresh).

## Phase 2 — fresh-eyes outsiders (2 spawns)

Spawn after phase 1 returns. They read ONLY phase-1 outputs (latent +
state) plus public docs (Doppler/Slack). **No persona files. No zettels.
No principles. No skills.** Their job: name the gap in plain English,
propose the smallest path from current-state to desired-state.

| Track | Output | Charter |
|---|---|---|
| **Outsider-Doppler** | `zisser/dispatched/2026-05-08-doppler-outsider-out.md` | written after phase 1 |
| **Outsider-Slack** | `zisser/dispatched/2026-05-08-slack-outsider-out.md` | written after phase 1 |

## Phase 3 — Zisser synthesis

When phase 2 returns: I distill into this plan as three sections per
topic — **clean / recreate / missing**. Surface only blocking decisions
to Oria; default everything else.

## Stop conditions

- All six outputs land → Zisser writes synthesis → returns to Oria with
  blocker(s) only (or "no blockers, executing").
- A phase-1 sub-agent declares it cannot proceed without a key/decision
  → Zisser surfaces that one to Oria with a default and continues.

## Log

- 2026-05-08 — plan written; phase-1 charters drafted; spawned 4 in parallel.
- 2026-05-08 — phase 1 returned (4/4); phase 2 charters drafted; spawned 2 in parallel.
- 2026-05-08 — phase 2 returned (2/2); writing synthesis below.

---

# Phase 3 — Synthesis

Read in this order: **the two single sentences** (acceptance tests), **the
two five-step recommended paths** (clean/recreate/missing collapsed —
the team's plan was good and over-engineered in a couple of places, not
broken), then **the blocker list** (where you, Oria, are the only one
who can answer).

## The two acceptance sentences

> **Doppler is done when** both Railway environments and CI pull their
> secrets from `effi`, the bootstrap admin token is revoked, and the
> dangerous-key set has a documented working unlock path.

> **Slack is done when** a real customer admin clicks "Connect Slack" on
> production Effi, signs in to their own Slack workspace, picks one
> channel, posts a message there, and asks Effi about it within the
> same minute and gets an answer that quotes their message.

## Doppler — clean / recreate / missing

| Bucket | Item | Why |
|---|---|---|
| **Recreate** | Wire Railway `staging` + `production` to pull from `effi/stg` and `effi/prod` (Doppler-Railway integration), reconcile name mismatches (`SUPABASE_*`, `INTERNAL_RPC_SECRET`, `GEMINI_API_KEY`, deploy-shape URLs) into `effi/{stg,prod}` with real values, redeploy stg → prod | Railway is still source-of-truth for deployed secrets; the migration only landed dev-side. Until this happens, the reorg pays no dividends in production. |
| **Recreate** | Wire one CI workflow as a pilot to `effi/testing_gh_ci` via `dopplerhq/cli-action` — OR — delete `effi/testing_gh_ci` and accept GitHub Actions secrets as SoT | Currently `effi/testing_gh_ci` is dormant; that's worse than no mirror — invites someone to update a config nothing reads. Pick a side. |
| **Recreate** | Run the dangerous-key unlock ceremony — generate the share material, distribute, dry-run the wrapper unlock | Wrapper exists as skeleton; shares were never generated. Without this, the `effi/devops` set has no working access path. |
| **Clean** | Revoke bootstrap admin token `zisser-bootstrap-2026-05` in the Doppler dashboard | Live owner-grade key, three days past its purpose. Memory note: an audit transcript briefly held a real `GCP_SERVICE_ACCOUNT_JSON` value before the prober switched to safe-probe; treat that one secret as also needing rotation. |
| **Clean** | Archive `dev-env` after one calendar week green (target ~2026-05-13) | The fallback. Just wait. |
| **Clean** | Add `effi/rnd_lihu` (empty is fine) | Pattern parity with `rnd_oria` and `rnd_nitsan`. |
| **Clean** | Resolve orphan secrets: `SLACK_BOT_TOKEN`, `MAILGUN_API_KEY` outside experiment — either document the external consumer or remove | Dead weight or undocumented consumers. |
| **Cut** | The 4 `*_personal` placeholder configs | No one fetches them; dashboard noise. |
| **Cut (decision)** | Shamir 2-of-3 ceremony, IF a simpler alternative covers the threat model | Outsider read: 2-of-3 looks like over-engineering for a 3-person team. Two simpler paths buy most of the safety: (i) one Doppler service token in a 2-person-access password-manager item, or (ii) Doppler native role-based access with per-user permissions on `effi/devops`. The load-bearing piece is "this key is not in your default shell" — the wrapper-skeleton already gives you that. **Decide based on threat model.** |
| **Defer** | `SLACK_*` → `ASKEFFI_SLACK_*` rename (ENG-5761) | Already deferred. Leave it. |
| **Defer** | `GCP_SERVICE_ACCOUNT_JSON` IAM-scope question (open item O1) | Conservative DevOps classification is right; demoting later is easier than promoting after a leak. |

**Status read:** dev-laptop side of the reorg is **real and working**.
Railway and CI are not connected at all. The Shamir ceremony hasn't
happened. Bootstrap token still live. ~70% landed by line count, but
the remaining 30% is the part that touches deployed code.

## Slack — clean / recreate / missing

The code is essentially **finished**. The customer-facing OAuth, token
encryption, channel picker, message ingestion, and lifecycle handlers
are written, tested, and working in dev. The gap is **deploy + paperwork**,
not architecture.

| Bucket | Item | Why |
|---|---|---|
| **Recreate** | Pick ONE Slack app to be the production customer app (4 candidates exist; only one survives). Set redirect URL to `https://app.askeffi.ai/api/slack/callback` (+ staging equivalent), confirm Events URL subscribed to `message.channels`/`message.groups`/`app_uninstalled`/`tokens_revoked`/`channel_rename`, drop write scopes (`chat:write`, `reactions:write`) per the read-only-at-launch decision | Without one canonical app, the redirect mismatch is the load-bearing block. Three apps were registered (`Effi Spike`, `ingest-poc`, `Slack integration for Effi`) and a fourth is referenced in plans (`Slack for Effi`) that doesn't exist. |
| **Recreate** | Copy the chosen app's `client_id`, `client_secret`, `signing_secret` into `effi/stg` and `effi/prod`. **Replace the literal `TODO_FROM_RAILWAY` placeholder strings** in those configs. Generate one fresh 32-byte `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`) and put it in both stg and prod | Production has zero Slack secrets. Staging is missing only the encryption key. Two configs hold the literal string `TODO_FROM_RAILWAY` as a value — a footgun (anything reading them gets the placeholder, not "missing"). |
| **Recreate** | Smoke OAuth round-trip on staging end-to-end with a test account, then bind one channel and post a message; confirm row in DB and Effi answers + cites | Lifecycle handlers (uninstall/revoke/rename) have never been exercised against a real install. |
| **Clean** | Flip `slackIntegration` front-end toggle on for the first pilot customer's account (per-account, not globally) | Default-OFF UI gate. Customers don't see the button. |
| **Clean** | Add channel-picker UX banner for private-channel binding: "private channels need a one-time `/invite @effi` from someone in the channel" | Silent-failure-mode for private channels otherwise. ~1 hour of work; high-value. |
| **Cut** | Treat the AskEffi team's own Slack flow (`Slacker` / `useginslack` / `UseGin` — broken token, workspace-id discrepancy, 13-channel reorg, `dx slack` CLI verbs) as an **entirely separate track** that can slip without affecting customer launch | Same vendor, different roadmap. The plans are architecturally clean but the conversation conflates them. Stop discussing them in the same breath. |
| **Cut** | The `SLACK_*` → `ASKEFFI_SLACK_*` rename, before customer launch | Naming cleanup is post-ship, not pre-ship. One namespace, no conflict yet. |
| **Cut** | The "migrate Drive/Linear/Fathom/SharePoint to the same shape" cluster work, before customer launch | Real and good observation; over-investment to do before Slack proves the pattern in production. |
| **Cut** | The "modal flow when install is errored" question (O-8) — pick the default (same modal, reconnect copy) and move on | Tiny fraction of users; revisit if it produces a real complaint. |
| **Defer** | Marketplace listing as a **parallel** track if needed at all | Slack throttle (~1 req/min for unlisted apps) doesn't bite first 1-2 pilot customers; review takes weeks. Don't block on it. **Decide based on first customer's archive size.** |
| **Defer** | Auto-`/invite @effi` for private channels (4 sketched approaches, all needing user OAuth or partly-deprecated APIs) | Banner-telling-human is enough for v1. |
| **Defer** | Thread-aware retrieval, message edits, message deletes (slice C7) | Real cost (tombstone tracking, redaction-vs-correction semantics). Ship without. |
| **Defer** | Retiring `Effi Spike` and `ingest-poc` apps | Dormant; require admin access the team doesn't have; not causing harm. |

**Status read:** ~95% of the *code* is done. The gap to a real customer
is four stacked deploy/config blockers + one app-paperwork choice.

## Blockers requiring your decision (Oria)

These are the only items the orchestration cannot proceed past without
your input. Everything else has a sensible default Zisser will execute
(or charter Gin to execute) when you greenlight the run.

### Doppler

1. **Railway integration vs. keep Railway as SoT.** Pick (a) wire
   Railway → Doppler integration so `effi/{stg,prod}` becomes
   authoritative; (b) keep Railway dashboard as SoT and delete
   placeholder configs in Doppler; (c) keep both in sync manually.
   Outsider's lean: **(a)** is the only one that pays back the
   migration work; **(b)** is the smallest cleanup; **(c)** is
   the worst of both. Recommended default if silent: **(a)**.
2. **CI integration vs. keep GitHub Actions secrets as SoT.** Same
   shape. Mirror config `effi/testing_gh_ci` is dormant. Pick wire-it-up
   or delete-it. Recommended default if silent: **wire one workflow as
   pilot, judge then**.
3. **Dangerous-key unlock model.** Three options: (i) Shamir 2-of-3
   ceremony as planned; (ii) one Doppler service token in a shared
   password-manager item with 2-person access; (iii) Doppler native
   role-based access with per-user permissions on `effi/devops`. (i)
   is the planned shape but the outsider flagged it as
   over-engineering for a 3-person team unless a specific threat model
   justifies it (e.g. one dev's laptop stolen + simultaneous abrupt
   departure). Recommended default if silent: **(ii) — simpler,
   reversible**, and you can upgrade to (i) later.

### Slack

4. **Which Slack app is the production customer app?** Promote the
   working `Slack integration for Effi` (already proven in dev) or
   create a fresh `Slack for Effi` per the 11-step runbook. Outsider's
   lean: **promote `Slack integration for Effi`** unless Marketplace
   listing is imminent (in which case the fresh app makes branding +
   review cleaner). Recommended default if silent: **promote**.
5. **Marketplace listing on day one — yes or no.** If yes: start the
   submission now in parallel. If no: accept the throttle as a
   per-customer onboarding cost limit. Recommended default if silent:
   **no — first customer fits under the throttle**.

### Safety

6. **Rotate `GCP_SERVICE_ACCOUNT_JSON`.** A sub-agent transcript
   briefly held the value during the audit. Did not land in any
   committed file or output. Outsider recommended rotation; cheap.
   Recommended default if silent: **rotate it; just one key**.

## What Zisser will do without further input

If you don't reply, on the next session-touch I:

- Charter Gin (with a tight per-step charter) to execute the Doppler
  defaults: rotate bootstrap token, archive `dev-env` (after the
  one-week green window, ~2026-05-13), add `rnd_lihu`, resolve orphan
  secrets, delete `*_personal` placeholders.
- Charter Gin to execute the Slack defaults: copy chosen app's
  credentials into `effi/{stg,prod}`, replace `TODO_FROM_RAILWAY`
  literals, generate fresh `TOKEN_ENCRYPTION_KEY`, smoke staging
  end-to-end.
- Hold on the 6 blockers above until you reply.
- Treat the team-internal Slack flow (`Slacker` / `useginslack`
  reorg) as a parallel track; will not let it block customer launch.

