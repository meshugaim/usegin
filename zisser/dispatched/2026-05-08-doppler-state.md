---
date: 2026-05-08
charter_for: general-purpose sub-agent
caller: Zisser
parent_plan: zisser/plans/2026-05-08-doppler-and-slack-ground-down.md
output_path: zisser/dispatched/2026-05-08-doppler-state-out.md
read: code/configs/live Doppler/Railway/devcontainer — NOT zisser/plans or substrate
mode: read-only against external systems and code, no commits, no edits outside output file
---

# Charter — State-Doppler — what Doppler actually IS, right now

## Purpose

Capture **ground truth**. What's actually in Doppler today, what's
actually in the code that reads from Doppler, what's actually injected
into shells / Railway / CI. Latent intent and historical plans are
**out of scope** — that's a sibling charter. Your job is reality.

## End state

A single markdown file at `zisser/dispatched/2026-05-08-doppler-state-out.md`
containing:

1. **Doppler dashboard reality** — projects, configs, secrets-by-config,
   service accounts, integrations. Use the `doppler` CLI; you have
   read access (devcontainer is authenticated). Snapshot now.
2. **Code consumers** — every file/script/test/workflow that reads from
   Doppler. Path:line + which secret(s) it expects. Use ripgrep over
   the repo. Include `nextjs-app/`, `python-services/`, `scripts/`,
   `tools/`, `.devcontainer/`, `.github/workflows/`, root-level configs.
3. **Devcontainer shell injection** — what gets loaded into a fresh dev
   shell? Which configs are merged? Trace `.devcontainer/doppler-wrapper.sh`
   + `scripts/ensure-auth.sh` end-to-end and produce: "after fresh
   shell, these N secrets are in the env."
4. **Railway** — what env vars are configured for staging/production
   today, and where do they come from (Doppler integration vs pasted
   values)? `railway` CLI is available; use it. Don't write.
5. **CI** — what secrets do GitHub workflows pull, from which Doppler
   project + config?
6. **Drift** — places where the live state differs from the migration
   plan in `notes/2026-05-06-doppler-migration-done.md` (you may
   reference that single file as ground-truth-as-of-2026-05-06; do not
   read the broader plans).
7. **Stranded items** — secrets in Doppler with no consumer in code;
   secrets expected by code but missing in Doppler.
8. **Two-line summary** — "Doppler today is X; the migration to Y is
   Z% landed."

## Tools you may use

- `doppler` CLI — read-only commands: `doppler projects`,
  `doppler configs --project <p>`, `doppler secrets --only-names
  --project <p> --config <c>`, `doppler activity` (read), `doppler
  service-accounts list`, `doppler integrations list`. NEVER run any
  `doppler secrets set`, `delete`, `download`, or anything that writes.
- `railway` CLI — read-only: `railway variables`, `railway environment`,
  `railway status`. **Do not switch envs, do not `railway up`, do not
  set anything.**
- Ripgrep over the repo.
- `gh` for workflow file inspection (already in repo) and workflow
  variable discovery.
- Memory: `reference_railway_uv_attestation_lag` is FYI only.

## What you must NOT do

- Do NOT read `zisser/plans/`, `zisser/dispatched/`, `zisser/inbox/`,
  `zisser/notes/` (except the single ground-truth file noted in step 6).
  You are the reality team; latent context contaminates you.
- Do NOT read agent session JSONLs. Do NOT read zettels. Do NOT read
  personas.
- Do NOT commit. Do NOT edit any file outside your output path.
- Do NOT modify Doppler, Railway, or anything live.
- Do NOT propose remediations — describe what *is*.

## Investigative posture

- All time. Thoroughness over speed. Be the boring honest auditor.
- For each secret: name, project, config, "expected by", "actually
  there?" — three columns minimum.
- When unsure if a secret has a consumer, grep all of it; record both
  positive and negative (`No consumers found in repo`).
- Mask values when displaying — names + presence only.

## Stop condition

Output file exists with all eight sections filled. Return to caller:
the path + a one-line summary.
