---
name: writing-e2e-tests
description: Write Playwright e2e tests using driver pattern. Triggered by "write e2e test", "add e2e test for", "e2e test for X", or "test this page".
---

# Writing E2E Tests

Write maintainable Playwright e2e tests using the driver pattern.

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

Before writing e2e tests:

- [ ] Add `data-testid` to interactive elements in component
- [ ] Create driver file in `tests/e2e/drivers/`
- [ ] Use fixtures for auth (`authAsOwner`, `authAsInternal`, etc.)
- [ ] Handle dialogs with `page.once("dialog", ...)`
- [ ] Clean up test data (delete uploaded files, remove added members)

## Running Tests

```bash
just e2e                      # All tests
just e2e example.spec.ts      # Specific file
just e2e-dev example.spec.ts  # Fast iteration (keeps services running)
just e2e-cleanup              # Clean up containers
```

## Reference

- Full docs: `tests/e2e/README.md`
- Example driver: `tests/e2e/drivers/project-settings.driver.ts`
- Example tests: `tests/e2e/tests/project-settings.spec.ts`
