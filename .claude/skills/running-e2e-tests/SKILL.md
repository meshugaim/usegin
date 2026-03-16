---
name: running-e2e-tests
description: Run and iterate on Playwright e2e tests. Triggered by phrases like "run e2e tests", "iterate on tests", "e2e test", or "playwright test".
---

# Running E2E Tests

Read `tests/e2e/CLAUDE.md` first — it has the full local setup ritual.

## Quick steps

1. `just agent-dev-kill` — free up ports (e2e uses 63000/58000)
2. `e2e build` — build Next.js with correct env vars (**required**, don't skip)
3. `e2e up` — start Supabase + Next.js + Python API
4. `e2e run -- tests/foo.spec.ts` — run tests
5. `e2e restore` — restore dev DB snapshot
6. `e2e down` — stop e2e services
7. `just agent-dev` — restart agent dev servers

For AI-dependent tests (GFS sync, chat): `E2E_REAL_GEMINI_KEY=true e2e run -- ...`

## Troubleshooting

- **"Services not running"** → run `e2e up` first
- **Port conflict / EADDRINUSE** → `just agent-dev-kill` then retry
- **Chat proxy connects to wrong port** → you skipped `e2e build`
- **Test skipped** → check credential gates (`E2E_REAL_GEMINI_KEY`, Claude credentials)

Run `e2e --help` or `e2e docs` for full CLI documentation.
