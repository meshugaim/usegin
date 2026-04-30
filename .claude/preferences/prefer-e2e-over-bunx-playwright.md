---
match: \b(bunx|npx)\s+playwright\s+test\b
prefer: Use `e2e` — handles Supabase + Next.js + Python API lifecycle (start/stop/seed) around the Playwright run.
---

# Why

`bunx playwright test` runs the test binary in isolation; our e2e suite needs Supabase, the Next.js server, and the Python API up with the right seed data first. The `e2e` wrapper orchestrates that lifecycle so the test run is reproducible.

See `tests/e2e/CLAUDE.md` and skill `.claude/skills/running-e2e-tests/` for the full ritual.

Origin: commit `9e7ff0b64` (2026-03-06), session `d2452b5e-db56-4c0c-9de0-d6029de57cff`.
