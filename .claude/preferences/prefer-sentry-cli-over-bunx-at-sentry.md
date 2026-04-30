---
match: \b(bunx|npx)\s+@sentry\/cli\b
prefer: Use `sentry` (already on PATH) — wraps the CLI with project defaults and our common query patterns.
---

# Why

`bunx @sentry/cli` is the raw upstream CLI with no defaults. Our `sentry` wrapper preselects org/project and exposes the queries we actually use (issues, events, replays, traces).

Memory: `reference_sentry_cli.md` — "use `sentry` on PATH, not the long `bun run tools/sentry-cli/...` path". Skill: `.claude/skills/sentry/`.

Origin: commit `9e7ff0b64` (2026-03-06), session `d2452b5e-db56-4c0c-9de0-d6029de57cff`.
