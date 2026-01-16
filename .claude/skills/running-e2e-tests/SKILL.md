---
name: running-e2e-tests
description: Run and iterate on Playwright e2e tests. Triggered by phrases like "run e2e tests", "iterate on tests", "e2e test", or "playwright test".
---

# Running E2E Tests

For full documentation, see `tests/e2e/README.md`.

## Quick Commands

```bash
just e2e                    # Run all tests (full setup/teardown, ~50s)
just e2e app.spec.ts        # Run specific file
just e2e --grep "sign-in"   # Run by test name
```

## Fast Iteration Mode

When iterating on tests, use `e2e-dev` to keep services running:

```bash
just e2e-dev app.spec.ts    # First run starts services (~50s)
just e2e-dev app.spec.ts    # Subsequent runs reuse them (~4s)
just e2e-cleanup            # Clean up when done
```

## Key Files

- `tests/e2e/tests/*.spec.ts` - Test specs
- `tests/e2e/fixtures/` - Auth injection, logging
- `tools/e2e/` - E2E CLI for service management

## Troubleshooting

If DB container is unhealthy or tests fail with port conflicts:

```bash
just e2e-cleanup
```
