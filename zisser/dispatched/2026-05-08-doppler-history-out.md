---
date: 2026-05-08
authored_by: general-purpose sub-agent (history pass)
parent_charter: zisser/dispatched/2026-05-08-doppler-history.md
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
mode: latent intent only — substrate read, no code/dashboard
---

# Doppler — what we said it should look like

This is the historian's pass. It captures what the team **said and decided**
about Doppler over the ~2 weeks ending 2026-05-08, drawn from `zisser/`
plans/dispatched/inbox/notes/log, the Doppler-touching zettel(s), and
recent Claude session JSONLs. It does **not** look at live Doppler or at
the code that consumes Doppler — those are sibling tracks.

## 1. The shape

The latent picture, rolled up across all artifacts, is **one Doppler
project named `effi`** (workspace `AskEffi`) with **environments per
secret-class**, and per-human personals on the dev-side environments
only.

```
project: effi
└─ environments (configs):
   ├─ dev          ← App-class — runtime keys for Next.js + python-services in devcontainer
   │  └─ (personals: dev_<user> if a human needs an override)
   ├─ rnd          ← R&D shared — team-minted dev tooling keys (Linear, Figma team, Context7,
   │  │             usegin-Slack bot, Cloudflare tunnel, etc.)
   │  ├─ rnd_oria  ← per-human overlay (Figma personal, Atuin, etc.)
   │  ├─ rnd_lihu  ← (open-to-empty)
   │  └─ rnd_nitsan← per-human overlay (Figma Nitsan)
   ├─ testing      ← CI-class — Gemini, NO_BUDGET_KEY, CLAUDE_CODE_OAUTH_TOKEN
   │  └─ testing_gh_ci ← per-runner overlay
   ├─ devops       ← owner-grade — Supabase access token, GCP SA, staging DB password.
   │                 Personals ON. NOT loaded in default shell.
   ├─ stg          ← App-class for staging Railway. Personals OFF. Schema-only until
   │                 Railway swap fills values.
   └─ prod         ← App-class for production Railway. Personals OFF. Same.
```

Key-holder policy for `devops`:

- A single high-entropy Doppler service token for `effi/devops`.
- Split via Shamir Secret Sharing **2-of-3** across the three devs
  (Oria, Lihu, Nitsan) — one share per dev's personal vault.
- Reconstructed only via a `devops-run --recover` wrapper (proposed
  `tools/devops-run/`) that opens a 15-minute time-boxed shell with
  the token in env, then evaporates.
- Default devcontainer shell loads **App + R&D + per-user overlay only**;
  DevOps keys are absent. A `tests/external/` boundary assertion
  enforces this.
- Quarterly rotation cadence + on-event (offboard / leak / suspicion).

Side-channel: **GitHub Actions secrets are a parallel store, not
Doppler-synced** — owner-grade keys stored as `gh secret` (e.g.
`GCP_SERVICE_ACCOUNT_JSON`, `SUPABASE_DB_PASSWORD_STAGING`) must be
rotated in **both** places.

## 2. Decisions made

Each row: decision + one-line why + source.

| # | Decision | Why | Source |
|---|---|---|---|
| D1 | Three secret classes — **App / R&D / DevOps** | Owner-grade keys must not sit next to runtime keys in every shell | `zisser/plans/2026-05-05-doppler-three-group-reorg.md` (Oria pour) |
| D2 | One Doppler **project** named `effi`, classes are **environments** under it (not separate projects) | Doppler workspace doesn't have a project umbrella; one project = one creation, simpler ACL surface — Oria's choice once Zisser surfaced both shapes | session `10653a2f-…` (May 6 Zisser↔Oria); `zisser/dispatched/2026-05-06-doppler-migration-team.md` |
| D3 | Six environments: `dev / rnd / testing / stg / prod / devops` | Maps the three classes to runtime envs (dev/stg/prod for App, plus rnd/testing/devops as their own envs) | `notes/2026-05-06-doppler-migration-done.md`, migration-team dispatch |
| D4 | Personals **ON** for `rnd`, `dev`, `testing`, `devops`; **OFF** for `stg`, `prod` | Per-human overlay is meaningful only on dev-side and owner-grade; prod must be deterministic | `dispatched/2026-05-06-doppler-migration-team.md` (context block) |
| D5 | DevOps key-holder = **3-dev armageddon-key, Shamir 2-of-3** | 3-of-3 means any single dev unavailable = locked out; trust model (3 named devs) supports threshold 2 | `plans/2026-05-05-doppler-three-group-reorg.md` §armageddon (Oria's confirmed v1 answer) |
| D6 | DevOps reach-path = **`devops-run --recover` wrapper**, 15-min auto-timeout, no disk write | "Bring the key, don't always-on it" — friction without fight; 15 min covers any single owner-grade action | same plan, decisions table row 3 + row 10 |
| D7 | Use Debian `ssss` apt package (not the `shamirs-secret-sharing` npm) | Puts the binary alongside `doppler` itself; no Node-runtime dep; widely-audited C impl | same plan, decision row 5 |
| D8 | Rotation cadence = **quarterly + on-event**, NOT per-use | Per-use is theater + breaks the wrapper UX; quarterly catches drift; on-event covers actual risk | same plan, decision row 6 |
| D9 | Migration is **parallel-build → cutover**: live `dev-env` stays untouched, all writes go to `effi`, smoke-test, then archive `dev-env` | Reversible at every step until the wrapper repoint; protects prod | `dispatched/2026-05-06-doppler-migration-team.md` context block; runbook |
| D10 | Migration is **sliced one-Wes-per-step** (App → R&D → DevOps), each step is one commit + Ron review + verified rollback before next | One-shot risks a prod outage we can't recover from before Monday | plan §migration; team dispatch table |
| D11 | Stale-secret cleanup at decommission: drop `SLACK_USER_TOKEN`, `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING` | Zero code consumers found in repo grep | plan inventory + classification table; team dispatch "Stale-pending-Oria-check — DO NOT migrate" |
| D12 | `GCP_SERVICE_ACCOUNT_JSON` defaults to **DevOps** classification (conservative) until Oria confirms IAM scope | Easier to demote to R&D later than to discover a leak | plan ↑Q-A + decision row 12 |
| D13 | Per-human R&D overlay only for keys **literally tied to one human's account** (Figma personal, Atuin), not for shared team keys (Linear PAT, Figma team) | Pattern was already organically in flight (`FIGMA_NITSAN_API_KEY` only in `dev_personal`); reorg formalizes it | plan §appendix surprise #1; decision row 2 |
| D14 | FECLI bootstrap secret lands in **R&D** (per-human), not DevOps | Goal is "save the team's OTP-per-env time", not "let Gin act as owner" | plan decision row 9; FECLI inbox |
| D15 | Customer-Slack OAuth keys (`SLACK_CLIENT_ID/SECRET/SIGNING_SECRET`) are **App-class** (live in `effi/dev`, `stg`, `prod`) | They're runtime keys the Next.js OAuth callback reads; not owner-grade | plan inventory; `notes/2026-05-06-doppler-migration-done.md` "Notes for the Slack agent"; ENG-5761 (rename to `ASKEFFI_SLACK_*` queued) |
| D16 | `USEGIN_SLACK_*` (internal team-Slack bot) lands in **R&D shared** | It's dev tooling, not customer-facing | same as D15 |
| D17 | Migration uses a **bootstrap Service Account** with Admin role on `effi` only (`zisser-bootstrap-2026-05`); revoked after cutover | Token blast radius scoped to the new project; can't touch `dev-env` | session `10653a2f-…`; `notes/2026-05-06-doppler-migration-done.md` |
| D18 | Stg/prod values seed as `TODO_FROM_RAILWAY` placeholders; real values flow when Oria does the Railway-side swap | Schema can land before values; placeholders make the gap legible | `dispatched/2026-05-06-doppler-migration-team.md` ("Stg / Prod — schema only"); migration-done note |
| D19 | A **boundary test** lives at `tests/external/doppler-no-devops-in-default-shell.test.ts` — RED pre-migration, GREEN after | Regression guard so DevOps keys never re-leak into the default shell | `notes/2026-05-06-doppler-consumer-map.md` §4; team dispatch Wes-C |
| D20 | Reorg **closes Q-C** (owner-grade keys outside Doppler) on Oria's word: "everything we hold is in Doppler, set-env in codebase, and Railway" | No Stripe live, no separate Railway prod admin token, no GCP owner-SA — the inventory is the inventory | `notes/2026-05-06-doppler-migration-done.md` deferred-Q table row C |
| D21 | Migration **executed** 2026-05-06: 41 real values copied + 38 stg/prod placeholders; devcontainer wrapper repointed; `dev-env` left intact | Cutover ran clean per the parallel-build plan | `notes/2026-05-06-doppler-migration-done.md` (commits `c459970a5`, `32f4011f7`); session `4c3b2751-…` / `6c0dc7e9-…` |

## 3. Decisions still open

Items where the latent picture has a placeholder, a default, or a "needs
Oria" line that hasn't been resolved.

| # | Open question | Where it surfaced | Why it stalled |
|---|---|---|---|
| O1 | **`GCP_SERVICE_ACCOUNT_JSON` actual IAM scope** — VAIS-only (→ demote to R&D) or broader (→ keep in DevOps) | plan ↑Q-A; migration-done note Q-A | Conservative default fired (DevOps); Oria has not run `gcloud projects get-iam-policy` and the answer doesn't block anything else |
| O2 | **Stg/prod values flow** — three options surfaced (Railway→Doppler integration; paste real values into Doppler dashboard; keep Railway env vars + Doppler placeholders as schema-only). Default not chosen yet | `notes/2026-05-06-doppler-migration-done.md` step 3 | Requires Oria login + Railway-dashboard work; only she has the access |
| O3 | **`dev-env` decommission** — note says "wait ~1 week of green dev shell, then archive in Doppler dashboard". Date and trigger not pinned | migration-done step 5 | Time-gated (~2026-05-13); also requires Oria dashboard click |
| O4 | **Bootstrap SA token revoke** — `zisser-bootstrap-2026-05` still active per migration-done state row | migration-done state row + step 4 | Waiting for Oria's "I'm confident" ack |
| O5 | **Armageddon-key ceremony NOT YET RUN** — `tools/devops-run/` skeleton landed, `ssss` apt-install + share generation + share distribution + first joint reconstruction test all pending | plan §runbook 1; team dispatch Wes-C "ssss apt-install deferred to ceremony day" | Requires all 3 devs co-located (Zoom or async-but-same-week); not scheduled |
| O6 | **Quarterly rotation calendar reminder** in Oria's calendar | plan acceptance criteria last bullet | Not landed yet (post-ceremony task) |
| O7 | **GH Actions secrets alignment** — owner-grade keys (`GCP_SERVICE_ACCOUNT_JSON`, `SUPABASE_DB_PASSWORD_STAGING`) need `gh secret set` to match the new Doppler values once those are rotated in step 6 | plan §risk R6; team dispatch (acceptance) | Coupled to O5 — happens at ceremony rotation |
| O8 | **FECLI Doppler-bootstrap secret class** — option A (refresh-token-in-Doppler) vs option B (new bootstrap-credential class with `/api/v1/auth/bootstrap`) — which fork? | `inbox/2026-05-05-fecli-doppler-bootstrap.md` ↑Q | Awaiting Oria direction; the prerequisite Doppler reorg is now ~done so this can be unblocked |
| O9 | **Slack key rename `SLACK_*` → `ASKEFFI_SLACK_*`** queued as ENG-5761 (Backlog) | `notes/2026-05-05-integration-naming-convention.md`; Linear ENG-5761 | Per the naming-convention note: "rename only when there's a second Slack app forces disambiguation" — explicitly deferred |
| O10 | **`SLACK_BOT_TOKEN`** classification record — migration-done note says it was an "orphan in `dev-env/dev` (no rule)", added to App-class on the fly | `notes/2026-05-06-doppler-migration-done.md` "Notes for the Slack agent" | Classification ratified after the fact; would benefit from a row in the canonical inventory |

## 4. Contradictions / drift

Places where two artifacts disagree. Resolved by date where the later
decision clearly supersedes; flagged "open" otherwise.

| # | What disagrees | Source A | Source B | Resolution |
|---|---|---|---|---|
| C1 | **Project shape** — three sibling projects (`askeffi-app` / `askeffi-rnd` / `askeffi-devops`) vs one project `effi` with envs | `plans/2026-05-05-doppler-three-group-reorg.md` (assumed three projects, decision row 1) | `dispatched/2026-05-06-doppler-migration-team.md` + session `10653a2f-…` (Oria chose one project `effi` with 6 envs) | **Resolved by date.** May 6 supersedes May 5: Oria chose `effi` + 6 envs after Zisser surfaced both options. The reorg plan's "three projects" framing is the older sketch; reality landed as one project. |
| C2 | **Number of configs** — plan acceptance criteria says "DevOps secrets in `askeffi-devops/rotating`" (one rotating config); migration-done lists 9 configs total: `dev, rnd, rnd_oria, rnd_nitsan, testing, testing_gh_ci, devops, stg, prod` (no `rotating`/`break-glass` split inside devops) | plan acceptance | migration-done | **Resolved by date.** The `rotating` / `break-glass` sub-split inside devops is older sketch language; on the ground there's a single `devops` env with personals on. |
| C3 | **Owner-grade key inventory completeness** — plan ↑Q-C asked "Stripe live, Railway prod admin, separate GCP owner-SA, registrar?"; migration-done closed it on Oria's word: "everything we hold is in Doppler, set-env in codebase, and Railway" | plan ↑Q-C | migration-done Q-C | **Resolved.** Bucket-5 considered closed. Note: registrar/billing-page access still lives outside Doppler intentionally — that's a "what owner-grade access gives you" pointer, not a secret class. |
| C4 | **Migration ordering** — plan §migration says App → R&D → DevOps in **eight sequential steps**; team dispatch ran them as **parallel token-independent prep + sequential token-arrival fire** | plan §migration steps 3–6 | dispatched/2026-05-06-doppler-migration-team.md | **Resolved by date.** Team dispatch is the executed shape. Plan's "one Wes per step" was the desired-state sketch; in practice prep ran 4-wide in parallel because the writes were all token-gated. Same-class boundary discipline (read-only `dev-env`, write-only `effi`) was preserved. |
| C5 | **`testing_gh_ci` env** appears in migration-done's "9 configs" list but is **not** in the team dispatch's source→target mapping | `notes/2026-05-06-doppler-migration-done.md` state row | `dispatched/2026-05-06-doppler-migration-team.md` mapping section | **Open contradiction (minor).** Either the env was created during execution and not back-filled into the dispatch doc, or migration-done's state row over-reports. Doesn't change the shape but worth pinning at decommission time. |
| C6 | **`SLACK_BOT_TOKEN`** — plan inventory does not list it (the bot token wasn't in current Doppler at plan-time); migration-done says it was "orphan in `dev-env/dev` (no rule). Added to App-class — now in `effi/dev`" | plan classification table | migration-done Slack-agent notes | **Resolved by date.** Discovered during execution; classified App-class on the fly. Matches the SLACK_* family pattern (D15). |
| C7 | **`devops-run` wrapper readiness** — plan §migration step 6 lists "Add the `devops-run` wrapper + the `ssss` apt install line" as part of step 6; migration-done says "`tools/devops-run/` and `tests/external/doppler-no-devops-in-default-shell.test.ts` — untouched in this migration; landed earlier as part of the prep team." | plan step 6 | migration-done §"What I touched" | **Resolved.** Step 6's wrapper-add was front-loaded into Wes-C of the prep team; the migration commit didn't need to touch them. |
| C8 | **DevOps boundary test status** — plan acceptance: "tests/external/ assertion exists that no DevOps-grade key is readable in the default shell"; consumer-map: test is "intentionally RED today because the boundary doesn't exist yet"; migration-done: "The boundary test goes green once a shell starts under the new wrapper". | plan acceptance | consumer-map §4 | migration-done §"What I touched" | **Resolved by sequence.** Pre-migration: test exists, RED. Post-migration: GREEN once a fresh shell loads under the new wrapper. As of the migration-done note, "fresh shell" requires Oria to close+reopen the devcontainer terminal — the green confirmation is one of the human-only post-migration steps and was not yet ticked. |

## 5. The click

If a stranger asks "what is Doppler for, in this team?":

Doppler is the team's single secret store, organized by **how dangerous the
key is**. There's one project called `effi` and the environments inside it
say what class of secret a key belongs to. **App** secrets (`dev`, `stg`,
`prod`) are runtime keys the apps boot with — Anthropic, Resend, Sentry,
Slack OAuth, Supabase DB password, etc. **R&D** (`rnd`, with per-human
overlays) is dev-tooling — Linear PAT, Figma, Cloudflare tunnel, the
internal usegin Slack bot — always loaded in the devcontainer shell so
keyboard work is friction-free. **Testing** (`testing`, `testing_gh_ci`)
is the CI-flavored variant. **DevOps** is the radioactive set —
Supabase management API, GCP service account, staging DB password —
sealed behind a 2-of-3 Shamir share that any two of the three devs
(Oria, Lihu, Nitsan) reconstruct ceremoniously through a `devops-run`
wrapper, with a 15-minute auto-timeout, only when an owner-grade
action genuinely needs it. The default devcontainer shell never sees
DevOps keys; a `tests/external/` boundary assertion enforces that.
Migration from the old mixed `dev-env` project ran clean on 2026-05-06
in parallel-build/cutover shape; `dev-env` is parked, slated for
archive after a green-week. The Shamir ceremony itself — apt-installing
`ssss`, generating shares, distributing them to vaults, first joint
reconstruction — is the next remaining step.
