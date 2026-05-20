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

**In a typechecked package, the import specifier must be a `const` variable, not a string literal.** If the package's pre-push / CI runs `tsc` (e.g. nextjs-app, effi-cli), a string-literal `await import("@/app/api/my-route/route")` of a not-yet-existing module fails typecheck with `TS2307: Cannot find module` — and `const { foo } = await import("@/lib/x")` of a not-yet-exported `foo` fails with a missing-property error — so pre-push rejects your Red commit. Assign the specifier to a `const` first; tsc then types the dynamic import as `any` and skips static resolution, keeping the Red commit's typecheck green:

```ts
const ROUTE = "@/app/api/my-route/route"; // const, not inline literal
test.failing("ENG-XXX: description", async () => {
  const { POST } = await import(ROUTE); // typed `any` → no TS2307 / missing-export error
  // ... assertions
});
```

When Green lands and the module exists, convert back to a normal top-level import for real type-checking.

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

### Shell

Bash has no `test.failing` primitive, so we wrap the assertions in a script
that gates exit code on an `EXPECT=fail|pass` variable. Canonical example:
`docs/bugs/098-verifier/ensure-session-sync-safety.sh`.

```bash
EXPECT="${EXPECT:-fail}"  # flip to "pass" once green lands

# ... run the thing, evaluate assertions, count FAILs into $TOTAL_FAIL ...

if [[ "$EXPECT" == "fail" ]]; then
    if [[ $TOTAL_FAIL -gt 0 ]]; then
        echo "EXPECTED-FAIL: ENG-XXX not yet landed ($TOTAL_FAIL/N assertions failed as expected)"
        exit 0  # CI stays green
    else
        echo "UNEXPECTED-PASS: flip EXPECT=pass; assertions now pass — Green has landed"
        exit 1  # CI catches the un-flipped mark
    fi
else  # EXPECT=pass
    [[ $TOTAL_FAIL -eq 0 ]] && exit 0 || exit 1
fi
```

When Green lands, the developer flips `EXPECT=fail` → `EXPECT=pass` in the
test file (the equivalent of removing `test.failing` / `xfail`). Strictness
matches bun/pytest/playwright: an unexpected pass under `EXPECT=fail`
fails the run.

## Convention

- Always include Linear issue ID in the reason: `"ENG-XXX: short description"`
- Use xfail for "not yet implemented", NOT for flaky tests (use `.skip` for those)
- Keep xfail marks temporary — they're bridges, not permanent fixtures
