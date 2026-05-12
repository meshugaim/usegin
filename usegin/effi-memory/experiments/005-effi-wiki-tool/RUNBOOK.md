# Experiment 005 — runbook

How to run the wiki tool locally (smoke) and the open question for prod-Effi.

## Local smoke (Effi reads source wiki directly)

```bash
just agent-dev-kill            # ensure clean slate
export EFFI_WIKI_PATH=/workspaces/test-mvp/usegin/effi-memory/askeffi-app-really
export EFFI_WIKI_PROJECT_ID=<dogfooding-project-uuid>   # see "Sourcing the UUID" below
just agent-dev
# In another terminal:
effi chat "Who are the design partners?" --profile agent-dev
# Should see Effi call memory_lookup(design-partners).
```

Edits to wiki notes hot-reload via `just agent-dev-kill && just agent-dev` (no Docker rebuild).

## Sourcing the dogfooding project UUID

Liaison fetches via `effi projects list --profile production` (filter for "dogfooding") or queries Supabase directly. Not in code.

## Production (Railway-hosted Effi) — NOT WIRED YET

The bundle plumbing exists but the deploy path is **not complete**. Read the gotcha before pushing anything that depends on prod-Effi seeing the wiki.

### What's in place

- `python-services/scripts/stage-wiki-for-bundle.sh` copies `usegin/effi-memory/askeffi-app-really/` into `python-services/wiki/`.
- `python-services/wiki/` is gitignored — staging is a build-time operation, not a checked-in artifact.

### Deploy mechanic gotcha (read this before pushing)

Railway's build context for the python service is **`python-services/`** (each service in this monorepo has its own `railpack.json`; Railway's per-service Root Directory points at the subdir). That means:

- The wiki source at `usegin/effi-memory/askeffi-app-really/` is **outside** Railway's build context — Railway never sees it.
- `python-services/wiki/` is gitignored, so committing locally-staged content doesn't help either.
- Running `stage-wiki-for-bundle.sh` locally before `git push` populates the dir but git doesn't track it.

**Net effect:** running the script today produces a local-only `python-services/wiki/` that never reaches Railway. There is no working prod path as-shipped.

### Options for a real prod path (pick one before promoting)

1. **Un-gitignore + commit staged content.** Run `stage-wiki-for-bundle.sh` before each prod-bound push, `git add python-services/wiki/`, commit. Trades repo bloat (~412KB markdown today) for simplicity. Requires removing the `wiki/` line from `.gitignore`.
2. **Railpack `steps` hook.** Define a build step in `python-services/railpack.json` with `inputs: [{ local: true, include: ["usegin/effi-memory/askeffi-app-really"] }]` and a `cp` command. Requires Railway's per-service Root Directory to be the repo root (currently it's `python-services/`), or restructuring the build graph. Not investigated end-to-end.
3. **Bake the wiki into a sibling git submodule** that lives inside `python-services/` (e.g. `python-services/wiki` pointing at a separate repo). Heavyweight; only worth it if the wiki gets its own lifecycle.

Option 1 is simplest. Today the experiment runs locally with `EFFI_WIKI_PATH` pointed at the source tree — promotion to prod-Effi is deferred until one of the above is chosen.

### Env vars for prod (once a path is chosen)

- `EFFI_WIKI_PATH=/app/wiki` (or whatever the bundle path resolves to)
- `EFFI_WIKI_PROJECT_ID=<dogfooding-project-uuid>`
