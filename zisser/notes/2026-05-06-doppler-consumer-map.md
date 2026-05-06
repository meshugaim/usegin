---
authored_by: Explore-B
date: 2026-05-06
status: committed
context: |
  Doppler migration team dispatch (charter: zisser/dispatched/2026-05-06-doppler-migration-team.md).
  Enumerated every file in the repo that references Doppler project `dev-env` or its configs
  (`dev`, `dev_personal`, `ci`) in a Doppler context.

related:
  - zisser/dispatched/2026-05-06-doppler-migration-team.md
  - zisser/plans/2026-05-05-doppler-three-group-reorg.md
---

# Doppler Consumer Map — `dev-env` → `effi`

## Summary

**Total files touched by migration:** 6

**Breakdown by category:**
- Devcontainer config: 2 files
- Scripts: 2 files
- Root config: 1 file
- Test files: 1 file
- Documentation: 2 files (informational only, no Doppler CLI invocations)

---

## 1. Devcontainer & Shell

### File: `.devcontainer/doppler-wrapper.sh`

**Status:** Generic wrapper, no hardcoded project/config — **no changes needed**

**Current snippet (lines 1–50):**
```bash
# Doppler secrets wrapper - auto-inject on new shell
# ...
DOPPLER_ENV_CACHE="/tmp/.doppler-env-cache"

if [ -n "$DOPPLER_PROJECT" ] && [ -f "$DOPPLER_ENV_CACHE" ]; then
  set -a
  . "$DOPPLER_ENV_CACHE"
  set +a
fi

if [ -z "$DOPPLER_PROJECT" ]; then
  # ...calls ensure-auth.sh which configures the project
  if [ -x /workspaces/test-mvp/scripts/ensure-auth.sh ]; then
    /workspaces/test-mvp/scripts/ensure-auth.sh
  fi
  # ...then wraps shell: doppler run -- bash
  exec doppler run -- bash
fi
```

**Analysis:** This file is a generic wrapper that sources the config via `ensure-auth.sh`. Once that script is fixed (see below), this file's behavior will automatically follow the new project/config. **No direct edit required.**

---

### File: `.devcontainer/post-create.sh`

**Status:** No Doppler references — **no changes needed**

**Current snippet (line 119):**
```bash
bun run set-env --supabase local --urls "$URL_MODE" --root /workspaces/test-mvp
```

This is part of the post-create setup and calls `set-env` to configure local environment files. It does not invoke Doppler directly. **No changes required.**

---

## 2. Scripts (Doppler CLI consumers)

### File: `scripts/ensure-auth.sh`

**Status:** **MUST CHANGE** — hardcoded `dev-env` + `dev` config

**Current (lines 24–26):**
```bash
if doppler me >/dev/null 2>&1 && ! doppler configs >/dev/null 2>&1; then
  echo "  Configuring Doppler (project: dev-env, config: dev)..."
  doppler setup --project dev-env --config dev --no-interactive
fi
```

**Proposed change:**
```bash
if doppler me >/dev/null 2>&1 && ! doppler configs >/dev/null 2>&1; then
  echo "  Configuring Doppler (project: effi, config: dev)..."
  doppler setup --project effi --config dev --no-interactive
fi
```

**Lines to change:** 25–26
**Migration mapping:** `dev-env/dev` → `effi/dev`
**Human-personals note:** The `dev` config (post-migration: `effi/dev`) has personals enabled in the new project `effi`. Users can override with `effi/dev_<USER>` if needed, but the default setup points to the shared `effi/dev`.

---

### File: `scripts/doppler-migrate.ts`

**Status:** Reference doc + migration tool — **NO CHANGES** (reads `dev-env`, writes `effi` by design)

**Lines 3, 7, 38, 61, 64, 78, 85, 92, 99, 101 (throughout):**
```typescript
/**
 * doppler-migrate.ts — migrate secrets from Doppler `dev-env` → `effi`
 * ...
 * Reads (read-only) from Doppler project `dev-env` (existing devcontainer auth)
 * and writes to Doppler project `effi` (token in $DOPPLER_TOKEN_EFFI).
 * ...
 */

type SourceConfig = "dev" | "dev_personal" | "ci";
type TargetConfig = "dev" | "rnd" | "rnd_oria" | "rnd_nitsan" | "testing" | "devops" | "stg" | "prod";

// App-class — source: dev-env/dev → target: effi/dev (root)
const APP_CLASS_KEYS = [ ... ];

const COPY_RULES: readonly CopyRule[] = [
  // App-class — dev-env/dev → effi/dev
  { sourceConfig: "dev", targetConfig: "dev", keys: APP_CLASS_KEYS },

  // R&D shared — dev-env/dev → effi/rnd
  { sourceConfig: "dev", targetConfig: "rnd", keys: [...] },

  // R&D personal (Oria) — dev-env/dev_personal → effi/rnd_oria
  { sourceConfig: "dev_personal", targetConfig: "rnd_oria", keys: [...] },

  // R&D personal (Nitsan) — dev-env/dev_personal → effi/rnd_nitsan
  { sourceConfig: "dev_personal", targetConfig: "rnd_nitsan", keys: [...] },

  // Testing — dev-env/ci → effi/testing
  { sourceConfig: "ci", targetConfig: "testing", keys: [...] },

  // DevOps — dev-env/dev → effi/devops (conservative classification)
  { sourceConfig: "dev", targetConfig: "devops", keys: [...] },
];

const SOURCE_PROJECT = "dev-env";
```

**Analysis:** This is the **migration script itself** (Wes-A's charter output). It is designed to read from `dev-env` and write to `effi` — this is correct and intentional. **The script MUST NOT be changed.** It remains the single source of truth for the mapping and is executed *once* to perform the one-way migration (token arrival phase, Wes-E step 1).

---

## 3. Root Config

### File: `doppler.yaml`

**Status:** **MUST CHANGE** — hardcoded `dev-env` + `dev` config

**Current (lines 2–3):**
```yaml
setup:
  project: dev-env
  config: dev
```

**Proposed change:**
```yaml
setup:
  project: effi
  config: dev
```

**Lines to change:** 2–3
**Migration mapping:** `dev-env/dev` → `effi/dev`
**Note:** This file is read by `doppler setup` if no `--project`/`--config` flags are passed. After the cutover, this becomes the "canonical layout" for everyone using the devcontainer.

---

## 4. Test Files

### File: `tests/external/doppler-no-devops-in-default-shell.test.ts`

**Status:** Reference/informational — **NO CHANGES required to code, but document context**

**Lines 3–7, 22–24 (comments only):**
```typescript
/**
 * Migration charter: zisser/dispatched/2026-05-06-doppler-migration-team.md
 * ...
 * Today (pre-migration), all three keys below live in `dev-env/dev` /
 * `dev-env/dev_personal` and are loaded into every devcontainer shell by
 * `.devcontainer/doppler-wrapper.sh`. So this test fails.
 */
```

**Analysis:** This is a **boundary assertion test** (Wes-C's charter output). The comment documents the *current state* (pre-migration) where DevOps keys live in `dev-env/dev`. The test is intentionally RED today because the boundary doesn't exist yet.

**Post-migration behavior:** After Wes-E executes `doppler-migrate.ts --apply`, DevOps keys move to `effi/devops` (not in the default shell anymore). The test will turn GREEN, and it remains the "regression guard" thereafter.

**No code changes required** — the comments are accurate documentation of why the test fails today and why it will pass post-migration.

---

## 5. Documentation (Informational Only)

### File: `docs/WINDOWS_SETUP.md`

**Status:** Informational prose — update for clarity post-migration

**Lines 131, 199:**
```markdown
doppler setup
# Auto-detects project: dev-env, config: dev

...

doppler run -- just dev
```

**Proposed update (lines 131, 199):**
```markdown
doppler setup
# Auto-detects project: effi, config: dev

...

doppler run -- just dev
```

**Note:** These lines reference the `doppler.yaml` config, which will be updated. Update the comments/prose to match the new state after the migration.

---

### File: `docs/security/doppler-shape.md`

**Status:** New reference doc (Wes-D's charter output) — informational, supersedes ad-hoc `dev-env` layout

**Lines 3, 9:**
```markdown
**Scope:** Secret organization in Doppler project `effi` (workspace AskEffi)

This is the canonical reference for the Doppler structure that backs every
runtime, dev shell, CI job, and owner-grade action in AskEffi. It supersedes
the ad-hoc `dev-env` project layout that preceded the 2026-05 reorg.
```

**Analysis:** This document is the **post-migration canonical reference**. It documents the shape of `effi` (the new project) and is accurate as-is. It explicitly notes that it supersedes the old `dev-env` layout. **No changes required** — it's the target state.

---

## 6. Other References (Not Doppler CLI calls)

The following files contain mentions of `dev-env` or `dev_personal` **but are not Doppler CLI consumers** and require no changes:

| File | Context | Reason for no change |
|------|---------|---------------------|
| `/workspaces/test-mvp/CLAUDE.md` (line 97) | Prose mention: "friction with infra/tests/dev-env" | Generic reference to "development environment", not a Doppler project name |
| `/workspaces/test-mvp/usegin/zettel/zettels/z010-dev-env-orient.md` (lines 3, 15) | Zettel principle: "Dev-env should be easy to להתמצה" | Refers to the concept of "development environment", not the Doppler project name |
| `/workspaces/test-mvp/usegin/memento/scopes/effi-drive-oauth/latest.md` (line 1) | Prose: "mid-flow, blocked on Lihu's two dev-env clicks" | Context-dependent reference, does not require change |
| `/workspaces/test-mvp/docs/releases/production-week-2026-04-11-to-2026-04-17.md` (lines 1, 3) | Release notes: "Dev-env and agent workflow", "Auto-memory in dev-env" | Descriptive release notes, does not reference Doppler project |

---

## 7. Migration Checklist

**Before Wes-F runs (repoint commit):**

- [ ] Verify `scripts/doppler-migrate.ts` is committed (Wes-A output)
- [ ] Verify `docs/security/doppler-shape.md` is committed (Wes-D output)
- [ ] Wes-E has executed `doppler-migrate.ts --apply` with token (fire sequence step 1)
- [ ] Verify `effi` project now holds all target secrets

**Wes-F changes (single commit):**

1. `scripts/ensure-auth.sh` — lines 25–26: `--project dev-env` → `--project effi`
2. `doppler.yaml` — lines 2–3: `project: dev-env` → `project: effi`
3. `docs/WINDOWS_SETUP.md` — lines 131, 199: update comments to reflect new project
4. `docs/WINDOWS_SETUP.md` — (optional) add a note about the migration for clarity

**Post-commit smoke test (fire sequence step 3):**

```bash
# Fresh devcontainer
cont rebuild

# Verify Doppler auto-setup points to effi
doppler configs list          # should show effi configs (dev, rnd, testing, devops, stg, prod)
doppler secrets list --config dev | head -5   # sample secrets

# Verify app boots
just dev                       # App + Python services up
just agent-dev                 # Claude Code boots

# Verify R&D tools work (they read from rnd config)
plan list                      # Linear API (requires rnd/LINEAR_API_KEY)
tunnel start                   # Cloudflare (requires rnd/CLOUDFLARE_TUNNEL_TOKEN)
effi ask "what did we do last week?" # Effi query
```

---

## 8. Coverage Check

**Verification command:**
```bash
rg -i "dev-env|dev_personal" -g '!zisser/' -g '!docs/decisions/' -g '!**/*.md.bak' /workspaces/test-mvp
```

**Expected result:** Only matches in:
- `doppler.yaml` (will be changed to `effi`)
- `scripts/ensure-auth.sh` (will be changed to `effi`)
- `scripts/doppler-migrate.ts` (intentional reference doc; no change)
- `tests/external/doppler-no-devops-in-default-shell.test.ts` (comment; no change)
- `docs/WINDOWS_SETUP.md` (informational; will be updated)
- `docs/security/doppler-shape.md` (references old layout in supersede note; no change)
- `CLAUDE.md` (generic "dev-env" prose reference; no change)
- `usegin/` zettels (generic "dev-env" concept; no change)

All Doppler CLI consumers have been catalogued and mapped.

