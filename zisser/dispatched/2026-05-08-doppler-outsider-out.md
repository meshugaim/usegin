---
date: 2026-05-08
authored_by: outsider sub-agent (no team context loaded)
parent_charter: zisser/dispatched/2026-05-08-doppler-outsider.md
inputs_read:
  - zisser/dispatched/2026-05-08-doppler-history-out.md
  - zisser/dispatched/2026-05-08-doppler-state-out.md
mode: read-only, single pass, fresh eyes
---

# Doppler — outsider read

## 1. The picture in plain words

Doppler is a SaaS app for storing secrets (API keys, DB passwords) and
handing them to whatever needs them — laptops, CI runners, deployed
servers. This team uses it as the single store for the secrets their
Next.js app and Python service need to run, plus the secrets each
developer needs on their own machine to do day-to-day work (Linear,
Figma, Slack tooling, etc.).

The team decided to organize Doppler into one project called `effi`
with environments named after **what kind of secret** lives there:
`dev`, `stg`, `prod` for the app's runtime keys; `rnd` for shared
developer tooling (with per-person overlays like `rnd_oria`); `testing`
for keys CI needs; and `devops` for the dangerous keys (Supabase admin,
GCP service account, staging DB password). The `devops` set is meant
to be sealed — not loaded into anyone's normal shell — and reachable
only via a special wrapper command that reconstructs the access token
from three shares held by the three developers (any two can unlock).
The dev devcontainer's shell auto-loads `dev` + `rnd` + your personal
overlay; everything else is opt-in.

Today, the dev-laptop side of that picture is real and working. A
fresh devcontainer shell pulls the right secrets, the dangerous keys
are absent from it, and there's a test guarding that. **The Railway
side (staging + production deployments) is not connected to Doppler at
all** — those servers still read secrets pasted directly into Railway's
own UI. The `effi/stg` and `effi/prod` environments exist in Doppler
but contain placeholder values and aren't read by anything. CI is the
same story: GitHub Actions reads from GitHub's own secret store, not
from Doppler. The Shamir-share ceremony for the dangerous-key set has
also not happened — the wrapper exists as a skeleton but the shares
were never generated or distributed.

## 2. The gap, named honestly

- Railway production and staging do not pull from Doppler. Two name
  lists exist (Doppler's and Railway's) and they don't even match —
  same secrets under different names, plus Railway has deploy-shape
  vars that Doppler doesn't.
- CI (GitHub Actions) does not pull from Doppler either. The mirror
  config `effi/testing_gh_ci` exists but is dormant.
- The dangerous-key set (`effi/devops`) has no working unlock path.
  The three-share ceremony hasn't happened, so the wrapper that's
  supposed to open a 15-minute shell is a skeleton.
- The bootstrap admin token used to do the migration is still active
  three days later. It was supposed to be revoked once everyone was
  confident.
- The old project (`dev-env`) is still alive as a fallback. There's a
  rough plan to archive it after a green week, but no calendar item.
- One developer (Lihu) has no personal overlay config, while the other
  two do. Minor, but uneven.
- A handful of secrets are in Doppler that nothing in the codebase
  reads (`SLACK_BOT_TOKEN`, `MAILGUN_API_KEY` outside an experiment).
  Either dead weight or undocumented external consumers.
- The audit itself accidentally streamed a real GCP private key
  through the terminal once. The session transcript should be treated
  as sensitive until rotated.

## 3. The smallest path

1. **HUMAN-DECISION** — pick one of three for staging/production
   secrets: (a) point Railway at Doppler via Railway's Doppler
   integration, (b) keep Railway as the source and delete the
   placeholder `effi/stg` and `effi/prod` configs (or mark them
   schema-only with a README), (c) keep both in sync manually. The
   honest reading of the gap is that (a) is the only option that pays
   back the work already done; (b) is the smallest cleanup; (c) is
   the worst of both. Pick one.
2. If (a): connect Railway → Doppler integration in the Railway
   dashboard for both services, both environments. Reconcile the name
   mismatches (Railway's `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`,
   `INTERNAL_RPC_SECRET`, `GEMINI_API_KEY`, deploy-shape URLs need to
   land in `effi/stg` and `effi/prod` too, with real values).
3. If (a): redeploy both services in staging first, verify they boot
   and the smoke path works, then production.
4. **HUMAN-DECISION** — same fork for CI. Either wire one workflow as
   a pilot using the `dopplerhq/cli-action` GitHub Action against
   `effi/testing_gh_ci`, or delete that config and accept that GitHub
   Actions secrets are the source of truth. The migration plan implied
   the former; the smaller move is the latter.
5. Rotate the bootstrap admin token (revoke `zisser-bootstrap-2026-05`
   in the Doppler dashboard). Owner-grade key, blast-radius is the
   whole `effi` project.
6. Schedule and run the three-share ceremony — install the `ssss`
   package, generate the shares, hand one to each developer, do a dry
   run of the unlock wrapper. **HUMAN-DECISION** on the date; needs
   all three developers reachable for ~30 minutes.
7. Add a `rnd_lihu` config so the third developer matches the
   pattern, even if it's empty for now.
8. Decide and act on the orphan keys. `SLACK_BOT_TOKEN` and
   `MAILGUN_API_KEY` either get a documented external consumer or get
   removed.
9. Archive `dev-env` once one calendar week has passed with no
   incidents (target ~2026-05-13).
10. Rotate any secret that passed through the audit transcript —
    minimum the GCP service account private key. **HUMAN-DECISION** on
    scope (just GCP, or wider precaution).

## 4. What I'd cut

- **The `*_personal` placeholder configs** (`dev_personal`,
  `rnd_personal`, `testing_personal`, `devops_personal`). Four configs
  no one has ever fetched, no documented use. They make the dashboard
  noisier without doing anything. Delete or document.
- **`effi/testing_gh_ci`**, unless step 4 above goes the wire-it-up
  way within a week. A dormant mirror is worse than no mirror — it
  invites someone to update it thinking it matters.
- **The three-share ceremony, if you can avoid it.** This is the part
  that smells like over-engineering for a three-person team. The math
  (Shamir 2-of-3 over a Doppler service token) is sound, but the cost
  is real: you need all three developers in a room (or call), an apt
  package most people have never heard of, a custom wrapper, share
  storage in personal vaults, and a quarterly rotation calendar to
  keep it honest. For a team this size, two simpler alternatives buy
  most of the safety: (i) a single Doppler service token stored in
  one shared password-manager item with two-person access, or (ii)
  Doppler's native role-based access where each developer has their
  own login and the dangerous config is gated by per-user permission.
  The wrapper-with-15-minute-shell is a clever ergonomics layer but
  it's not the load-bearing piece — the load-bearing piece is "this
  key isn't in your default shell," which the wrapper-skeleton
  already gives you. **HUMAN-DECISION** — if there's a specific
  threat model (one dev's laptop gets stolen, one dev leaves
  abruptly) that 2-of-3 addresses and 1-of-N with a password manager
  doesn't, keep it. Otherwise the cheaper path is fine.
- **Quarterly rotation as a calendar item**, separate from on-event.
  If you're not running ceremonies often enough that quarterly is
  forced muscle memory, the calendar reminder will be ignored or done
  performatively. On-event rotation (offboard, leak, suspicion) is
  the part that matters.

## 5. What I'd not touch yet

- The naming convention rename (`SLACK_*` → `ASKEFFI_SLACK_*`,
  ENG-5761). The history doc says this is explicitly deferred until a
  second Slack app forces disambiguation. Leave it deferred.
- The `GCP_SERVICE_ACCOUNT_JSON` IAM-scope question (open item O1).
  It's classified conservatively as DevOps; demoting it later if the
  scope turns out narrow is easier than promoting it after a leak.
  Don't reopen.
- The FECLI bootstrap-secret design fork (open item O8). It's a
  separate piece of work that was waiting on the Doppler reorg; now
  unblocked, but a different conversation.
- The `dev-env` archive. Just wait the week.

## 6. The single sentence

**Doppler is done when both Railway environments and CI pull their
secrets from `effi`, the bootstrap admin token is revoked, and the
dangerous-key set has a documented working unlock path (whether that's
Shamir shares or a simpler alternative).**
