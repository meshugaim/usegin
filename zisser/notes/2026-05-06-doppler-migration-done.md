---
date: 2026-05-06
authored_by: Zisser
audience: Oria — read on return
tldr: Doppler migration to project `effi` complete (dev-side). Railway swap is your move; everything else is ready.
---

# Doppler migration — what to read when you're back

Welcome back. The migration ran clean. Below is what to do, in order.

## 30-second status

| Thing | State |
|---|---|
| `effi` project structure | 9 configs (dev, rnd, rnd_oria, rnd_nitsan, testing, testing_gh_ci, devops, stg, prod) |
| Secrets populated | 41 real values copied from `dev-env`, plus 38 placeholders for stg/prod |
| Devcontainer shell | Wrapper now merges App + R&D + your personal overlay; DevOps boundary held |
| `dev-env` | Untouched. Live rollback intact. |
| Bootstrap SA token | Still active; revoke when you're confident (Doppler dashboard → Service Accounts → `zisser-bootstrap-2026-05`) |
| Commits | `c459970a5` (migration script fixes), `32f4011f7` (devcontainer cutover) |

## Things only you can do

1. **Open a fresh shell** (close + reopen the devcontainer terminal). The new wrapper takes effect on next bash startup. Verify: `echo $LINEAR_API_KEY` should print, `echo $SUPABASE_ACCESS_TOKEN` should be empty.
2. **Run `doppler login`** with your account against `effi` — this materializes/links your `effi/rnd_oria` overlay so your personal Figma/Atuin keys load.
3. **Railway swap (stg/prod)** — `effi/stg` and `effi/prod` have 19 placeholder values each (`TODO_FROM_RAILWAY`). Either:
   - Point Railway's Doppler integration at `effi` (preferred — values flow once),
   - Or paste real values into Doppler dashboard for `effi/stg` and `effi/prod`,
   - Or keep Railway's own env vars and leave Doppler placeholders as schema-only.
4. **Revoke the bootstrap SA token** — once shell + Railway are green.
5. **Decommission `dev-env`** — wait ~1 week of green dev shell, then archive in Doppler dashboard.

## The 4 deferred questions (answer when convenient)

| # | Q | Default if you don't answer |
|---|---|---|
| A | What IAM roles does the `effi-vais-worker` GCP service account hold? | Stays in `effi/devops` (conservative). If only VAIS roles, demote to `effi/rnd`. |
| B | Drop `SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING`? | Already dropped per the plan — zero code consumers. |
| C | Owner-grade keys outside Doppler (Stripe live, Railway prod admin, GCP owner-SA, registrar)? | You said: "everything we hold is in Doppler, set-env in codebase, and Railway." Bucket-5 considered closed. |
| D | Where do stg/prod values live today? | Implicit: Railway dashboard. Resolved by step 3 above. |

## What I touched and why

- `scripts/doppler-migrate.ts` — the migration script. Idempotent; safe to re-run for stg/prod once Railway gives real values.
- `doppler.yaml`, `scripts/ensure-auth.sh` — repointed `dev-env` → `effi`.
- `.devcontainer/doppler-wrapper.sh` — three-config merge (App + R&D + per-user). DevOps intentionally not loaded.
- `docs/WINDOWS_SETUP.md` — one stale reference fixed.
- `tools/devops-run/` and `tests/external/doppler-no-devops-in-default-shell.test.ts` — untouched in this migration; landed earlier as part of the prep team. The boundary test goes green once a shell starts under the new wrapper (DevOps keys absent from default env).

## Audit trail

Doppler activity log (Service Account `zisser-bootstrap-2026-05`) captures every write. 41 `secrets.set` actions on 2026-05-06 against project `effi`.

`dev-env` source: read-only, no writes ever issued from this token.

## Notes for the Slack agent

If they're tracking Slack-side migrations, the relevant moves are:
- `SLACK_BOT_TOKEN` was orphan in `dev-env/dev` (no rule). Added to App-class — now in `effi/dev`.
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` — same place, same shape.
- `USEGIN_SLACK_BOT_TOKEN`, `USEGIN_SLACK_APP_TOKEN` — internal dev-team Slack bot, R&D-class — now in `effi/rnd`.
- After fresh shell, all five are present.
