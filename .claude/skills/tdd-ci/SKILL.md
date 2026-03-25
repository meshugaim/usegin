# TDD Expected-Failure Workflow

<!-- triggers: write a failing test, mark test as expected to fail, xfail, test.failing, tdd workflow, commit failing test -->

## The Workflow

1. **Write a failing test** (Red)
2. **Run it locally**, see it fail
3. **Mark as expected-to-fail**
4. **Commit and push** — CI stays green
5. **Implement** — test passes, CI fails ("expected to fail but passed")
6. **Remove the mark** — CI green again

## Quick Reference

### Bun Test (`bun:test`)

```ts
test.failing("ENG-XXX: description", () => { ... });
test.failingIf(condition)("description", () => { ... });
```

- Always strict: unexpected pass = suite failure
- Test body always runs (unlike `.skip` or `.todo`)

**Lazy import for missing modules:** When the module under test doesn't exist yet, a lazy dynamic import keeps the file loadable so `test.failing` can register and run:

```ts
// Lazy import — module doesn't exist yet
async function getPOST() {
  const mod = await import("@/app/api/my-route/route");
  return mod.POST;
}

test.failing("ENG-XXX: description", async () => {
  const POST = await getPOST();
  // ... assertions
});
```

This works because the import failure happens inside the test body, where `test.failing` expects it.

### Pytest

```python
@pytest.mark.xfail(strict=True, reason="ENG-XXX: description")
def test_something():
    ...
```

- `strict=True` is set globally via `xfail_strict = true` in pyproject.toml
- `raises=ExceptionType` narrows what counts as expected failure
- Imperative form: `pytest.xfail("reason")` inside test body

### Playwright (`@playwright/test`)

```ts
test("ENG-XXX: description", async ({ page }) => {
  test.fail();  // mark this test as expected-to-fail
  ...
});

// Conditional:
test.fail(browserName === "webkit", "Known WebKit bug");

// Describe-level (all tests in block):
test.describe("Feature X", () => {
  test.fail();
  ...
});
```

- Always strict: unexpected pass = suite failure

## Convention

- Always include Linear issue ID in the reason: `"ENG-XXX: short description"`
- Use xfail for "not yet implemented", NOT for flaky tests (use `.skip` for those)
- Keep xfail marks temporary — they're bridges, not permanent fixtures
