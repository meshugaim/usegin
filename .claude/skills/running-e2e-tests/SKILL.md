---
name: running-e2e-tests
description: Run and iterate on Playwright e2e tests. Triggered by phrases like "run e2e tests", "iterate on tests", "e2e test", or "playwright test".
---

# Running E2E Tests

Read `tests/e2e/CLAUDE.md` first — it has the full setup guide.

## Quick steps

1. `e2e run -- tests/foo.spec.ts` — builds if stale, starts services if needed, runs tests
2. `e2e restore` — restore dev DB snapshot
3. `e2e down` — stop e2e services

E2E uses dedicated ports (65000/59000) that don't conflict with agent-dev.

For AI-dependent tests (GFS sync, chat): `E2E_REAL_GEMINI_KEY=true e2e run -- ...`

## Troubleshooting

- **"Build is stale"** from `e2e up` → run `e2e run` (handles build automatically) or `e2e build` first
- **Test skipped** → check credential gates (`E2E_REAL_GEMINI_KEY`, Claude credentials)

Run `e2e --help` or `e2e docs` for full CLI documentation.
