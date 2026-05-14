# Experiment 005 — runbook

How to run the wiki tool locally (smoke), how to run paired comparisons through
the eval harness, and the open question for prod-Effi.

## Local smoke (Effi reads source wiki directly)

```bash
just agent-dev-kill            # ensure clean slate
export EFFI_WIKI_PATH=/workspaces/test-mvp/usegin/effi-memory/askeffi-app-really
export EFFI_WIKI_PROJECT_ID=<dogfooding-project-uuid>   # see "Sourcing the UUID" below
just agent-dev
# In another terminal:
effi chat "Who are the design partners?" --profile agent-dev --project <dogfooding-project-uuid>
# Should see Effi call memory_lookup(design-partners).
```

Edits to wiki notes hot-reload via `just agent-dev-kill && just agent-dev` (no Docker rebuild).

`EFFI_WIKI_PROJECT_ID` is still required on the server side — it names the project the
curated wiki is eligible for. It does NOT need to be set in the harness operator's shell;
python-services reads it once at startup. The per-request `disable_wiki` body bit
(`effi ask --wiki off`) is the only knob the harness uses to toggle the wiki at runtime.

## How to run paired comparisons (eval harness)

Both sides of every pair hit the **same project** — the dogfooding project the server
already designates as wiki-eligible. The wiki-off side opts out per request via
`effi ask --wiki off` (sets `disable_wiki: true` in the request body; both python-services
gate sites suppress the wiki for that one turn).

```bash
# Pre-flight: python-services running locally with EFFI_WIKI_PROJECT_ID set
just agent-dev-status

# Dry-run first to verify the planned spawn commands
bun run usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts \
  --project <dogfooding-project-uuid> \
  --filter "design partner" \
  --dry-run

# Real run
bun run usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts \
  --project <dogfooding-project-uuid> \
  --profile agent-dev
```

The harness:

- Passes `--project <uuid>` to both spawns so the project is fixed regardless of
  whatever the profile is linked to.
- Passes `--new` to both spawns so the CLI doesn't resume a stored session;
  each turn is a fresh server-side conversation, so the second side of a pair
  can't inherit context from the first.
- Passes `--wiki off` on the wiki-off side and omits the flag on the wiki-on side
  (the CLI's default is "on").
- Writes per-pair artifacts to `usegin/effi-memory/experiments/005-effi-wiki-tool/runs/<timestamp>/`.

**State.json footprint**: `effi ask --new` does NOT prevent post-turn state writes —
the harness's last spawn will leave the named project's `state.json` entry pointing
at the last harness session_id (per `saveSessionAfterAsk`). For a dogfooding project
this is harmless (the operator can `--new` themselves next time); be aware if
running against a project where you care about resuming a prior session.

## Sourcing the dogfooding project UUID

Liaison fetches via `effi projects list --profile production` (filter for "dogfooding") or queries Supabase directly. Not in code.

For experiment 005 the project is **AskEffi App (really)** —
UUID `1bf0f507-7627-40a0-be72-8d2eacc40dec`. Same project on both sides of the harness; the
server's `EFFI_WIKI_PROJECT_ID` must equal this UUID for wiki-on to have wiki access.

## Production (Railway-hosted Effi) — Option 1 wired (staged-and-committed)

The bundle plumbing is complete via Option 1 below: `python-services/wiki/` is checked in and re-staged from `usegin/effi-memory/askeffi-app-really/` before any prod-bound push. Read the gotcha for context on why this was needed.

### What's in place

- `python-services/scripts/stage-wiki-for-bundle.sh` copies `usegin/effi-memory/askeffi-app-really/` into `python-services/wiki/`.
- `python-services/wiki/` is gitignored — staging is a build-time operation, not a checked-in artifact.

### Deploy mechanic gotcha (read this before pushing)

Railway's build context for the python service is **`python-services/`** (each service in this monorepo has its own `railpack.json`; Railway's per-service Root Directory points at the subdir). That means:

- The wiki source at `usegin/effi-memory/askeffi-app-really/` is **outside** Railway's build context — Railway never sees it.
- `python-services/wiki/` is gitignored, so committing locally-staged content doesn't help either.
- Running `stage-wiki-for-bundle.sh` locally before `git push` populates the dir but git doesn't track it.

**Net effect:** the wiki now lives in git under `python-services/wiki/` (Option 1 below) and is re-staged from `usegin/effi-memory/askeffi-app-really/` via `stage-wiki-for-bundle.sh` before each prod-bound push, so Railway's build context sees current content.

### Options for a real prod path

1. **Un-gitignore + commit staged content. — CHOSEN.** Run `stage-wiki-for-bundle.sh` before each prod-bound push, `git add python-services/wiki/`, commit. Trades repo bloat (~412KB markdown today) for simplicity. The `wiki/` line has been removed from `python-services/.gitignore`.
   - **Re-staging cadence:** the operator must re-run `stage-wiki-for-bundle.sh` and commit the result before any prod-bound push so the bundled `python-services/wiki/` stays in sync with the canonical source at `usegin/effi-memory/askeffi-app-really/`.
2. **Railpack `steps` hook.** Define a build step in `python-services/railpack.json` with `inputs: [{ local: true, include: ["usegin/effi-memory/askeffi-app-really"] }]` and a `cp` command. Requires Railway's per-service Root Directory to be the repo root (currently it's `python-services/`), or restructuring the build graph. Not investigated end-to-end.
3. **Bake the wiki into a sibling git submodule** that lives inside `python-services/` (e.g. `python-services/wiki` pointing at a separate repo). Heavyweight; only worth it if the wiki gets its own lifecycle.

### Env vars for prod

- `EFFI_WIKI_PATH=/app/wiki` (or whatever the bundle path resolves to)
- `EFFI_WIKI_PROJECT_ID=<dogfooding-project-uuid>`
