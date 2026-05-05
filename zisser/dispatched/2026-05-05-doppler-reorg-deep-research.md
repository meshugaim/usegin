---
charter_for: general-purpose agent (Wes-shaped: research + plan-update, no Doppler writes)
authored_by: Zisser
date: 2026-05-05
purpose: Take `zisser/plans/2026-05-05-doppler-three-group-reorg.md` from "draft + open Qs" to "approval-ready: clear plan, risks, assertions, devops, everything." Oria will return to keyboard, read it once, approve, and we execute.
---

# Charter — Doppler reorg, approval-ready plan

## Purpose

Oria has approved the three-group shape (App / R&D / DevOps) and the
"armageddon key" 3-dev mechanism. She's leaving the keyboard. When she's
back, she wants to read **one document**, see clear plan + risks +
assertions + DevOps mechanics + step-by-step migration, approve, and we
execute.

Your job is to make `zisser/plans/2026-05-05-doppler-three-group-reorg.md`
that document. Ground every claim in live state — don't speculate.

## Key tasks (in order)

1. **Read the existing plan** end-to-end. It already has the architecture,
   the eight-step migration, the seven Zisser-decided defaults, and two
   open Qs (Q-A: key-holder policy, Q-B: DevOps inventory). Don't redesign
   — *deepen and verify*.

2. **Bake in Oria's confirmed answers from this turn:**
   - **Q-A → DevOps key-holder = "armageddon key" 3-dev split.** The 3
     devs are Oria, Lihu, Nitsan. Trust model: they trust each other.
     Mechanism: a single high-entropy Doppler service token for
     `askeffi-devops/rotating`, split via Shamir Secret Sharing
     **2-of-3** (`ssss` package, widely available). Each dev gets one
     share at setup, stores it once in their personal vault
     (1Password / Bitwarden / wherever). To use:
     - Two devs combine shares → reconstruct token → `devops-run -- <cmd>`
       evaporates env after.
     - Single-dev convenience cache: NO. The reconstruction step is the
       ceremony; that's the friction. The "armageddon key" is exactly
       that — used rarely, ceremoniously, jointly.
   - **Why 2-of-3 not 3-of-3**: 3-of-3 means any one dev unavailable =
     locked out of own infra. 2-of-3 keeps continuity if Nitsan's on
     vacation. Trust model supports this.
   - **Wrapper UX**: `devops-run` becomes a two-stage flow:
     1. `devops-run --recover` — prompts for 2 shares (paste-in or
        file-path), reconstructs token, exports to a *single* shell
        session, prints "DevOps shell open — type `exit` when done".
     2. From inside that shell, normal `doppler run -- <cmd>` works
        because `DOPPLER_TOKEN` is in env.
   - **Per-dev part = "this is your part, save it"** literally — at
     setup, each dev runs `setup-armageddon-share` once, gets ONE
     ssss-formatted line, copies to vault, the share is wiped from
     disk. Setup script source-controlled; share material never is.

3. **Research live ground truth** — this is the bulk of your work.

   **3a. Live Doppler inventory.** With whatever Doppler token is
   available in this devcontainer (`/tmp/.doppler-env-cache` exists +
   `doppler me` likely works inside the wrapped shell — try
   `doppler secrets --only-names --project dev-env --config dev` and
   the same for `stg`/`prd` if they exist; also `doppler projects` and
   `doppler configs --project <each>`). If you can't auth from the
   bare shell, run inside `doppler run -- ...` or read names from
   `/tmp/.doppler-env-cache` via `cut -d= -f1` (DO NOT log values;
   memory `reference_env_masking_multiline` warns about JSON-with-`=`
   leaking — use `cut -d= -f1` not `sed 's/=.*/=<set>/'`).

   Produce a **per-secret classification table** in the plan:
   `NAME | proposed group (App/R&D/DevOps) | why | known consumers`.
   Where you don't know, mark `??` and add to a "needs Oria" list.

   **3b. Consumer mapping.** For every secret name:
   - `rg -n "<NAME>" --no-heading -g '!node_modules' -g '!.git' .`
     across the repo.
   - Check `.github/workflows/` specifically — a leaked secret in a
     workflow YAML is a different blast radius.
   - Check `railway.json`, `railway.toml`, `nixpacks.toml`,
     `nextjs-app/next.config.*`, `python-services/Dockerfile*` —
     anywhere a deploy reads env.
   - Note whether the consumer reads from env (Doppler-injected) vs
     hardcoded reference vs Railway-side service-token sync.

   **3c. The "hidden" DevOps inventory.** Things that *should* exist
   if the org has them but I can't see from injected env. Probe each:
   - Stripe live keys — `rg -i "stripe" .github/ scripts/ usegin/`
   - Railway admin token — `which railway`, `railway whoami` in the
     wrapped shell, check for `RAILWAY_TOKEN` in cache.
   - GCP owner-role SAs — `rg "GCP_" /tmp/.doppler-env-cache 2>/dev/null
     | cut -d= -f1`; check `docs/security/reports/` and
     `docs/setup/vais-gcp-*.md`.
   - Domain-registrar admin (askeffi.ai) — likely lives in Oria's
     personal vault, not Doppler. Note absence.
   - Supabase: `SUPABASE_ACCESS_TOKEN` (mgmt API), `SUPABASE_DB_PASSWORD`
     (per-env), `SUPABASE_SERVICE_ROLE_KEY` (per-env).
   - Sentry: `SENTRY_AUTH_TOKEN` — could be either group depending on
     scope; check the token's scope notes.
   - Mailgun / Resend production keys.
   - The credit card on file is at the Doppler/Railway/Vercel/GCP
     billing pages — not a "secret" but a "what owner-grade access
     gives you." Note this in the plan.

   **3d. ssss availability check.** The `ssss` package isn't installed
   in this devcontainer (just confirmed — `which ssss-split` empty).
   Either propose adding it to `.devcontainer/Dockerfile` (one line,
   `apt-get install -y ssss`) or pick a JS/Bun alternative
   (`shamirs-secret-sharing` npm; trade-off: install step vs apt
   step). Recommend **apt** because it puts the bin alongside
   `doppler` itself. Verify the package exists in the Debian repo.

4. **Write the runbook.** In the plan, add three concrete runbooks:
   - **First-time armageddon-key setup** (one-time, 3 devs at the
     same Zoom or async-but-same-week): rotate-then-split. Script
     name + every command + expected output + rollback if a share
     fails to write to vault.
   - **Routine `devops-run` use** (any 2 devs): step-by-step.
   - **Quarterly rotation** (any 2 devs + the third within 24h):
     rotate the underlying Doppler token, re-split, distribute
     new shares, **explicit step to delete old share** from each
     vault.

5. **Risk register.** Rank by (blast-radius × likelihood). At minimum:
   - Wrong-secret-in-wrong-group ships (App reads DevOps key by accident
     or vice-versa).
   - Railway service-token swap leaves prod with stale env mid-deploy.
   - One dev loses their share → can the other two reconstruct?
     (Answer: yes, with 2-of-3, but write the procedure.)
   - Two devs lose shares simultaneously → org locked out of own infra.
     What's the break-glass-squared? (Probably: pre-shared
     escrow with the third dev's lawyer or 1Password emergency-access.)
   - The `devops-run --recover` shell stays open and a malicious
     process reads its env. Mitigation: `--recover` shell forces a
     timeout (default 15min, `exit` on `<Ctrl-D>`).
   - GitHub Actions secrets sync — if any workflow reads from Doppler,
     swapping projects might break a CI run mid-deploy.
   - Migration ordering — if R&D moves first and a script in `.github/`
     was reading R&D-class via the old `dev-env/dev` path, CI breaks.
     Step-1 inventory must surface this.

6. **Acceptance criteria** for the migration. The plan must end with
   a checklist Oria can tick after we execute:
   - [ ] All App secrets land in `askeffi-app/{dev,stg,prd}` and the
         devcontainer + Railway boot fine.
   - [ ] All R&D secrets in `askeffi-rnd/shared` (+ overlays).
   - [ ] DevOps secrets in `askeffi-devops/rotating`, accessible only
         via `devops-run --recover` after share reconstruction.
   - [ ] `dev-env/dev` archived; old paths removed from
         `scripts/ensure-auth.sh` and `.devcontainer/doppler-wrapper.sh`.
   - [ ] Three armageddon shares distributed; setup script exists;
         routine-use runbook tested by 2 devs without help.
   - [ ] `docs/security/doppler-shape.md` exists and matches reality.

## Constraints

- **NO live writes to Doppler.** No `doppler secrets set`, no
  `doppler projects create`, no `doppler configs create`. Reads only.
- **NO secret values in any committed file or any agent output.** Names
  only. Use `cut -d= -f1` per the env-masking memory.
- **NO touching `scripts/ensure-auth.sh`, `.devcontainer/doppler-wrapper.sh`,
  or any deploy config.** Document changes in the plan; execution is a
  separate later dispatch.
- **DO NOT spawn sub-agents** — this is a single-agent depth pass.
- **Commit the updated plan to main when done** with a clear message
  (`zisser(doppler-reorg): research-pass — approval-ready`).

## End state

The plan file at `zisser/plans/2026-05-05-doppler-three-group-reorg.md`
is *approval-ready*: Oria reads it once, makes a Yes/No call, and on
Yes we dispatch execution. Specifically:

- The per-secret classification table is filled with real names from
  live Doppler, not speculation.
- Every consumer of every secret is listed.
- The armageddon-key mechanism is fully spec'd including the
  `devops-run --recover` flow and the three runbooks.
- Risks are ranked and each has a stated mitigation.
- Acceptance criteria are concrete.
- The "needs Oria" list at the bottom is short — only items where a
  single human signal changes the plan.

## Decision rights (Selbständigkeit)

You own:
- Classification of each secret (App / R&D / DevOps).
- Wording / table layout / runbook shape in the plan.
- Whether to recommend `ssss` (apt) vs `shamirs-secret-sharing` (npm).
- The `devops-run --recover` UX details (timeout default, prompt
  format, share-input mechanism).

You do NOT own (escalate as a "needs Oria" item):
- Renaming any of the three groups.
- The 2-of-3 vs 3-of-3 Shamir threshold (Zisser called 2-of-3 above;
  surface if you find a strong reason to flip).
- Whether to delete `dev-env/dev` immediately vs keep as fallback.
- Whether the third dev (Nitsan) joins the kickoff Zoom or gets
  shares async.

## Fresh-Haiku test

If a fresh agent spawned with this charter and zero prior context, can
they:
- Find the plan file? **Yes** — path is given.
- Know what's already decided vs open? **Yes** — Oria's confirmations
  are in §2 above.
- Know what to commit? **Yes** — §3 gives the exact files and the
  commit-message convention.
- Know when they're done? **Yes** — §6 has acceptance criteria for
  the *plan itself* (research is done when those are filled).

## Return shape (append below this line)

When done, append a "Return" section here with:
- Commit SHA of the plan update.
- The "needs Oria" list verbatim (items where you couldn't decide).
- Anything you found that surprised you (so Zisser can update mental
  model + maybe a zettel).

---

## Return (2026-05-05, research agent)

**Plan file**: `zisser/plans/2026-05-05-doppler-three-group-reorg.md`
(573 lines, full rewrite — was 261 lines).

**Commit SHA**: `0e6f0cb20` — note: autosync grouped the plan rewrite
under a parallel sub-Zisser's commit message (`zisser(identity):
root-cause + resolution plan`) instead of my intended
`zisser(doppler-reorg): research-pass — approval-ready`. The plan
content landed correctly (verified `git show HEAD:<plan>` shows the
new 573-line file with the armageddon mechanism). Mentioning so the
git log doesn't mislead you when scanning for "doppler-reorg".

**"needs Oria" list** (from the plan's ↑Q section, verbatim shape):

- ↑ Q-A. `GCP_SERVICE_ACCOUNT_JSON` actual IAM scope on the GCP
  project — VAIS-only or broader? Defaulted DevOps for safety; demote
  to R&D if the SA only holds VAIS roles.
- ↑ Q-B. Stale-pending-confirmation: `SLACK_USER_TOKEN`,
  `SENTRY_PASSWORD`, `ORIA_RAILWAY_STAGING` — zero code consumers in
  repo. Confirm stale → drop at step 7, or name the out-of-band use
  → classify properly.
- ↑ Q-C. Owner-grade keys NOT currently in Doppler that should land
  in `askeffi-devops`: Stripe live keys (do we take payments?), Railway
  prod admin token (only staging is in Doppler today),
  domain-registrar admin (askeffi.ai), separate GCP owner-role SA.
  30-second brain dump expected; whatever you can name we add to step
  6's rotation ceremony.
- ↑ Q-D. Where do stg/prd App secrets live today? My token only sees
  `dev-env/dev`. Either there's a `dev-env/staging`+`dev-env/prod`
  config I can't read, or Railway has env vars set directly in its
  dashboard. Affects step 3's manual-ceremony cost.

**Surprises (worth a zettel)**:

1. **`FIGMA_NITSAN_API_KEY` already in `dev_personal` only.** The
   per-human R&D pattern this plan formalizes is already in flight,
   organically. The reorg names what's happening, doesn't invent it.
2. **`dev_personal` is a full superset of `dev`, not an inheritance
   overlay.** Doppler's `INHERITS` column is empty for both — they're
   standalone configs duplicating shared keys. Personal-overlay-via-
   inheritance is something we get to enable as part of the reorg, not
   something we already have. Worth a zettel: "we've been hand-rolling
   what Doppler offers for free."
3. **GitHub Actions secrets are a parallel store, not Doppler-synced.**
   `secrets.GCP_SERVICE_ACCOUNT_JSON`, `secrets.SENTRY_AUTH_TOKEN`,
   etc. live in `gh secret`, separately from Doppler. This shifts
   the rotation runbook (step 6 now has explicit `gh secret set` calls
   for owner-grade keys) and adds R6 to the risk register. I expected
   Doppler to be SoT for everything; it isn't, and that's a finding
   the plan now bakes in.
4. **`ssss` is in Ubuntu universe, version 0.5-5, ~17KB.** One apt-get
   line on `.devcontainer/Dockerfile` and the binary is on PATH next
   to `doppler` on every fresh devcontainer. No Node-runtime dep, no
   custom install script — clean.
5. **Live Doppler access from the devcontainer worked first try.** The
   token in Codespaces (`codespaces-brocoli`) reads `dev-env/{dev,
   dev_personal,ci}` without any extra auth. Made the inventory step
   trivial; the read-only `--only-names` is exactly the safe-by-default
   tool the constraint asked for.

**Constraints honored**: no live writes to Doppler (zero
`doppler secrets set` / project-create / config-create). No secret
values anywhere in the plan or this Return — names only, sourced via
`--only-names`. No edits to `scripts/ensure-auth.sh`, the
`doppler-wrapper.sh`, or any deploy config. No sub-agents spawned.
Single-agent depth pass.

