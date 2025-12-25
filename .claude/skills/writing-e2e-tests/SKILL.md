---
name: writing-e2e-tests
description: Write Playwright e2e tests using driver pattern. Triggered by "write e2e test", "add e2e test for", "e2e test for X", or "test this page".
---

# Writing E2E Tests

Write maintainable Playwright e2e tests using the driver pattern.

**Reference implementation:** Project Settings page demonstrates all patterns:
- Driver: `tests/e2e/drivers/project-settings.driver.ts`
- E2E tests: `tests/e2e/tests/project-settings.spec.ts`
- Unit tests: `nextjs-app/tests/unit/components/project-file-manager.test.tsx`
- Component: `nextjs-app/components/project-file-manager.tsx` (data-testid usage)

## Workflow

### 1. Explore with Playwright MCP First

Before writing test scripts, manually test the flow using Playwright MCP:

```
1. Navigate to the page with mcp__playwright__browser_navigate
2. Take snapshots with mcp__playwright__browser_snapshot
3. Interact with elements using mcp__playwright__browser_click, etc.
4. Verify the flow works as expected
```

This helps you:
- Understand the actual DOM structure
- Find the right selectors
- Discover edge cases
- Validate the test scenario before coding

### 2. Write Tests with e2e-dev Mode

When iterating on new tests, use `e2e-dev` to keep services running:

```bash
just e2e-dev my-test.spec.ts   # First run starts services (~50s)
just e2e-dev my-test.spec.ts   # Subsequent runs reuse them (~4s)
just e2e-cleanup               # Clean up when done
```

This dramatically speeds up the write-run-fix cycle.

### 3. Convert to Driver Pattern

Once the test works, refactor into the driver pattern for maintainability.

## When to Use E2E vs Unit Tests

| Use E2E for | Use Unit for |
|-------------|--------------|
| Browser APIs (`confirm()`, `window.open()`) | Component logic |
| Multi-page navigation | State management |
| Auth redirects | Error handling |
| Full user journeys | Input validation |
| Real API integration | Mocked API responses |

**Rule of thumb:** If you can test it by mocking, use unit tests. E2E is for browser-only behavior.

## File Structure

```
tests/e2e/
├── tests/
│   └── <page>.spec.ts       # Test specs
├── drivers/
│   └── <page>.driver.ts     # Page driver (selectors + actions)
└── fixtures/
    └── index.ts             # Auth, logging fixtures
```

## Driver Pattern

### 1. Create Driver

```typescript
// drivers/example.driver.ts
import { expect, type Page } from "@playwright/test";

const DEFAULT_TIMEOUT = 10000;

export function createExampleDriver(page: Page) {
  const selectors = {
    // Group by section
    submitButton: () => page.getByTestId("submit-btn"),
    emailInput: () => page.getByTestId("email-input"),
    successMessage: () => page.getByTestId("success-message"),
  };

  return {
    // Navigation
    goto: async () => {
      await page.goto("/example");
      await expect(selectors.submitButton()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    },

    // Actions
    fillEmail: async (email: string) => {
      await selectors.emailInput().fill(email);
    },

    submit: async () => {
      await selectors.submitButton().click();
    },

    // Assertions
    expectSuccess: async () => {
      await expect(selectors.successMessage()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    },

    // Dialog handling
    confirmAndDelete: async () => {
      page.once("dialog", (dialog) => dialog.accept());
      await selectors.deleteButton().click();
    },

    // Popup handling
    openInNewTab: async () => {
      const [popup] = await Promise.all([
        page.waitForEvent("popup"),
        selectors.externalLink().click(),
      ]);
      return popup;
    },

    // Raw access
    page,
    selectors,
  };
}
```

### 2. Write Tests

```typescript
// tests/example.spec.ts
import { test, expect, TEST_IDS } from "../fixtures";
import { createExampleDriver } from "../drivers/example.driver";

test.describe("Example Page", () => {
  test("user can submit form", async ({ authAsOwner: page }) => {
    const driver = createExampleDriver(page);

    await driver.goto();
    await driver.fillEmail("test@example.com");
    await driver.submit();
    await driver.expectSuccess();
  });
});
```

## Adding data-testid

Add to components for stable selectors:

```tsx
// In component
<Button data-testid="submit-btn">Submit</Button>
<input data-testid="email-input" />
<div data-testid="success-message">{message}</div>

// Dynamic IDs for lists
<Button data-testid={`delete-file-${file.id}`}>Delete</Button>
```

## Common Patterns

### Auth Fixtures

```typescript
test("owner can access", async ({ authAsOwner: page }) => { ... });
test("internal user sees limited view", async ({ authAsInternal: page }) => { ... });
test("redirects unauthenticated", async ({ page }) => { ... });
```

### Dialog Handling

```typescript
// Accept confirm dialog
page.once("dialog", (dialog) => dialog.accept());
await driver.clickDelete();

// Dismiss (cancel)
page.once("dialog", (dialog) => dialog.dismiss());
await driver.clickDelete();
```

### File Upload

```typescript
await page.getByTestId("file-input").setInputFiles({
  name: "test.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("content"),
});
```

### Wait for Navigation

```typescript
await expect(page).toHaveURL(/\/success/);
```

## Checklist

### Before Writing

- [ ] Explore the flow manually with Playwright MCP
- [ ] Add `data-testid` to interactive elements in component
- [ ] Start services with `just e2e-dev`

### While Writing

- [ ] Create driver file in `tests/e2e/drivers/`
- [ ] Use fixtures for auth (`authAsOwner`, `authAsInternal`, etc.)
- [ ] Handle dialogs with `page.once("dialog", ...)`
- [ ] Clean up test data (delete uploaded files, remove added members)
- [ ] Run with `just e2e-dev <file>` for fast iteration

### After Writing

- [ ] Run full suite with `just e2e` to verify
- [ ] Clean up with `just e2e-cleanup`

## Running Tests

```bash
just e2e                      # All tests
just e2e example.spec.ts      # Specific file
just e2e-dev example.spec.ts  # Fast iteration (keeps services running)
just e2e-cleanup              # Clean up containers
```

## Reference

- Full e2e docs: `tests/e2e/README.md`
- Running tests skill: `running-e2e-tests`
