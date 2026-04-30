---
match: \b(bunx|npx)\s+railway\b
prefer: Use `railway-dev` — auto-selects project/service/environment so you don't have to `railway link` manually.
---

# Why

`bunx railway` runs the raw Railway CLI, which requires manual project/service/environment linking each invocation. `railway-dev` is our wrapper that knows the defaults for this monorepo.

See `.claude/skills/railway-cli/` for the full guide.

Origin: commit `9e7ff0b64` (2026-03-06) — initial wrapper-CLI hook, session `d2452b5e-db56-4c0c-9de0-d6029de57cff`.
